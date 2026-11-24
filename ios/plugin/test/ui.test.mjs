import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import React,{act} from 'react'
import {createRoot} from 'react-dom/client'
import {newDocument,mutateDocument,queueJob,finishJob,clone} from '../src/model.js'
const tick=()=>new Promise(r=>setTimeout(r,15))
test('actual React card: alternate versions, long manual edit, save and adoption; reading Aa and dark shared',async()=>{
 const dom=new JSDOM('<!doctype html><div id="app"></div>',{url:'http://localhost/',pretendToBeVisual:true})
 const w=dom.window;Object.assign(globalThis,{window:w,document:w.document,HTMLElement:w.HTMLElement,localStorage:w.localStorage,requestAnimationFrame:cb=>setTimeout(()=>cb(performance.now()),16),cancelAnimationFrame:clearTimeout,matchMedia:()=>({matches:false}),IS_REACT_ACT_ENVIRONMENT:true});Object.defineProperty(globalThis,'navigator',{configurable:true,value:w.navigator});w.HTMLElement.prototype.scrollIntoView=()=>{};globalThis.confirm=()=>true
 let d=newDocument('session-ui'),op={action:'writing',enabled:true,requestId:crypto.randomUUID(),expectedRevision:0};d=mutateDocument(d,op)
 const job={kind:'continue',text:'写一段',requestId:crypto.randomUUID(),expectedRevision:d.revision};d=queueJob(d,job,{id:'ui-message'});d=clone(d);d.jobs[0].status='running';d=finishJob(d,job.requestId,{text:'第一版正文'});const g=d.groups[0];d=mutateDocument(d,{action:'edit',groupId:g.id,baseId:g.candidates[0].id,text:'第二版正文',adopt:true,expectedRevision:d.revision,requestId:crypto.randomUUID()})
 globalThis.fetch=async(_url,options)=>{const b=options?.body?JSON.parse(options.body):null;if(b)d=mutateDocument(d,b);return {ok:true,json:async()=>({document:clone(d)})}}
 const {Card,Dock}=await import('../work/UI.mjs'),root=createRoot(document.getElementById('app'))
 const node={data:{sessionId:d.sessionId,jobId:job.requestId,prompt:'写一段',operation:'continue'}}
 const click=async(label)=>{const button=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')===label||x.textContent===label);assert(button,label);await act(async()=>{button.click();await tick()})}
 try{
  await act(async()=>{root.render(React.createElement(React.Fragment,null,React.createElement(Card,{node,pluginSessionId:d.sessionId}),React.createElement(Dock,{pluginSessionId:d.sessionId})));await tick()})
  assert.match(document.body.textContent,/第二版正文/);await click('上一版');assert.match(document.body.textContent,/第一版正文/);assert.match(document.body.textContent,/已采用第 2 版/)
  await click('手工编辑');const editor=document.querySelector('.zi-editor');const long='长文编辑中文换行。\n'.repeat(2400);await act(async()=>{const setter=Object.getOwnPropertyDescriptor(w.HTMLTextAreaElement.prototype,'value').set;setter.call(editor,long);editor.dispatchEvent(new w.Event('input',{bubbles:true}));editor.dispatchEvent(new w.Event('change',{bubbles:true}));await tick()})
  // React initialized before JSDOM in Node does not always bind the input event plugin; use the real element's React onChange for this isolated semantic test.
  if(!document.querySelector('.zi-modal').textContent.includes('有未保存修改')){const key=Object.keys(editor).find(k=>k.startsWith('__reactProps'));await act(async()=>{editor[key].onChange({target:{value:long}});await tick()})}
  await click('保存并采用');assert.equal(d.groups[0].candidates.length,3);assert.equal(d.groups[0].candidates.at(-1).text,long);assert.equal(d.groups[0].selectedId,d.groups[0].candidates.at(-1).id);assert(!document.querySelector('.zi-editor'))
  await click('择稿工具');await click('输入设置回车换行与发送方式');assert.match(document.querySelector('.zi-modal').textContent,/网页无法可靠自动识别手机外接键盘/);const radios=document.querySelectorAll('input[name=zi-enter]');await act(async()=>{radios[0].click();await tick()});assert.equal(JSON.parse(localStorage.getItem('zegao-ios-input')).enter,'newline');await click('返回')
  await click('择稿工具');await click('阅读模式只查看本对话已采用正文');await click('阅读设置');assert(document.querySelector('.zi-reading-sheet'));const toggle=document.querySelector('.zi-reading-sheet input[role=switch]');await act(async()=>{toggle.click();await tick()});assert(document.querySelector('.zi-reading-sheet').closest('.zi-dark'));assert.equal(document.documentElement.dataset.zegaoIosTheme,'dark');assert(document.querySelector('.zi-reading-preview'))
  await click('增大字号');await act(async()=>{await new Promise(r=>setTimeout(r,280))});assert.equal(document.querySelector('.zi-reading-sheet').closest('.zi').style.getPropertyValue('--zi-font'),'16px')
 }finally{await act(async()=>{root.unmount();await tick()});dom.window.close()}
})
