import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {installInputBridge} from '../src/input-bridge.js'
import {act,disposeStores,startStores} from '../src/state.js'
import {bindInputActions,writeInputSettings} from '../src/input-settings.js'
const wait=()=>new Promise(resolve=>setTimeout(resolve,5))
async function setup(){
 startStores()
 const dom=new JSDOM('<div data-conversation-session="newline-A"><div data-composer-card><div contenteditable="true"></div><button aria-label="发送">发送</button></div></div>'),doc=dom.window.document,w=dom.window
 let state={phase:'plain',draft:'前文后文',draftRev:1,attachmentIds:['file-A'],occurrences:[]},enabled=true,calls=0,selection={start:2,end:2},apiReady=true,inserted=0
 const notices=[]
 globalThis.fetch=async(_url,options)=>{const b=JSON.parse(options.body);if(b.action==='generate')calls++;return {ok:true,json:async()=>({document:{sessionId:'newline-A',revision:calls,writing:{enabled},groups:[],jobs:b.action==='generate'?[{id:b.requestId,status:'queued'}]:[]}})}}
 await act('newline-A',{action:'read'})
 const input={state:{getSnapshot:()=>state},setDraft(){throw Error('must not replace entire draft')},notify:(_level,text)=>notices.push(text)}
 const ctx={sessions:{binding:()=>({ctx:{}})},conversation:{input:{for:()=>input},blocks:{storeFor:()=>({getSnapshot:()=>undefined})}}}
 const actions={captureInsertion:()=>({...selection,draftRev:state.draftRev}),insertText:(text,span)=>{if(!apiReady)return false;assert.equal(span.draftRev,state.draftRev);inserted++;state={...state,draft:state.draft.slice(0,span.start)+text+state.draft.slice(span.end),draftRev:state.draftRev+1};selection={start:span.start+text.length,end:span.start+text.length};return true}}
 const unbind=bindInputActions('newline-A',actions),remove=installInputBridge(ctx,doc),editor=doc.querySelector('[contenteditable]')
 return {doc,w,input,notices,editor,actions,get state(){return state},setState:patch=>{state={...state,...patch}},get calls(){return calls},get inserted(){return inserted},setReady:v=>{apiReady=v},disable:async()=>{enabled=false;await act('newline-A',{action:'read'})},key:patch=>{const event=new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...patch});editor.dispatchEvent(event);return event},before:patch=>{const event=new w.InputEvent('beforeinput',{inputType:'insertParagraph',bubbles:true,cancelable:true,...patch});editor.dispatchEvent(event);return event},close(){remove();unbind();writeInputSettings({enter:'send'});disposeStores();dom.window.close()}}
}

test('newline uses guarded selection insertion, preserves attachments/references and never sends',async()=>{
 const e=await setup();writeInputSettings({enter:'newline'})
 try{
  e.setState({occurrences:[{occurrenceId:1,offset:0,length:1}]})
  assert(e.key().defaultPrevented);assert.equal(e.state.draft,'前文\n后文');assert.deepEqual(e.state.attachmentIds,['file-A']);assert.equal(e.state.occurrences.length,1)
  assert(e.before().defaultPrevented);assert.equal(e.state.draft,'前文\n\n后文');await wait();assert.equal(e.calls,0)
  e.setState({draft:'',draftRev:e.state.draftRev+1});assert(e.key().defaultPrevented);assert.equal(e.state.draft,'\n');assert.equal(e.calls,0)
 }finally{e.close()}
})

test('IME, Shift+Enter, list menus, mode off and teardown retain host editing',async()=>{
 const e=await setup();writeInputSettings({enter:'newline'})
 try{
  assert(!e.key({isComposing:true}).defaultPrevented);assert(!e.key({keyCode:229}).defaultPrevented);assert(!e.before({isComposing:true}).defaultPrevented);assert(!e.key({shiftKey:true}).defaultPrevented);assert.equal(e.inserted,0)
  const menu=e.doc.createElement('div');menu.setAttribute('role','listbox');e.doc.querySelector('[data-composer-card]').append(menu);assert(!e.key().defaultPrevented);assert.equal(e.inserted,0);menu.remove()
  await e.disable();assert(!e.key().defaultPrevented);assert(!e.before().defaultPrevented);assert.equal(e.inserted,0)
 }finally{e.close()}
 assert(!e.key().defaultPrevented)
})

test('failed insertion never sends or destroys text; Enter-send and arrow still route once',async()=>{
 const e=await setup();writeInputSettings({enter:'newline'})
 try{
  const unchanged=e.state.draft;const noncancel=e.before({cancelable:false});assert(!noncancel.defaultPrevented);assert.equal(e.state.draft,unchanged);assert.equal(e.calls,0)
  e.setReady(false);assert(e.key().defaultPrevented);assert.equal(e.state.draft,'前文后文');assert.match(e.notices.at(-1),/输入已变化/);assert.equal(e.calls,0)
  const unbind=bindInputActions('newline-A',undefined);e.key();assert.match(e.notices.at(-1),/尚未就绪/);unbind()
  // Keep failure and attachment handling independent from send routing.
  e.setState({draft:'接着写下一段',attachmentIds:[]});e.input.setDraft=text=>e.setState({draft:text});writeInputSettings({enter:'send'})
  assert(e.key().defaultPrevented);await wait();assert.equal(e.calls,1)
  await act('newline-A',{action:'read'});e.setState({draft:'接着写下一段',draftRev:e.state.draftRev+1});writeInputSettings({enter:'newline'});e.doc.querySelector('button').click();await wait();assert.equal(e.calls,2)
 }finally{e.close()}
})

test('mobile default is newline; desktop default is send; explicit preference persists',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator'),storage=globalThis.localStorage
 try{
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'iPhone',maxTouchPoints:5}})
  let saved;globalThis.localStorage={getItem:()=>saved,setItem:(_key,value)=>{saved=value}}
  const mobile=await import('../src/input-settings.js?mobile-test');assert.equal(mobile.inputSettings().enter,'newline')
  mobile.writeInputSettings({enter:'send'});assert.equal(JSON.parse(saved).enter,'send')
  const reload=await import('../src/input-settings.js?reload-test');assert.equal(reload.inputSettings().enter,'send')
  saved=undefined;Object.defineProperty(globalThis,'navigator',{configurable:true,value:{userAgent:'Desktop'}})
  const desktop=await import('../src/input-settings.js?desktop-test');assert.equal(desktop.inputSettings().enter,'send')
 }finally{if(original)Object.defineProperty(globalThis,'navigator',original);else delete globalThis.navigator;if(storage===undefined)delete globalThis.localStorage;else globalThis.localStorage=storage}
})
