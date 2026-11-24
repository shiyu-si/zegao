import test from 'node:test'
import assert from 'node:assert/strict'
import {JSDOM} from 'jsdom'
import {installInputBridge} from '../src/input-bridge.js'
import {act,disposeStores} from '../src/state.js'
const pause=()=>new Promise(r=>setTimeout(r,5))
test('capture ownership: IME, Shift+Enter, focus button, attachments, per-session and cleanup',async()=>{
 const dom=new JSDOM('<div data-conversation-session="test-A"><div data-composer-card><textarea></textarea><button aria-label="发送">send</button></div></div><div data-conversation-session="test-B"><div data-composer-card><textarea></textarea><button>send</button></div></div>');const doc=dom.window.document,w=dom.window
 let current={phase:'plain',draft:'接着写下一段',draftRev:1,attachmentIds:[],occurrences:[]},calls=0,notices=[]
 globalThis.fetch=async(_url,options)=>{calls++;const body=JSON.parse(options.body);return {ok:true,json:async()=>({document:{sessionId:'test-A',revision:calls,writing:{enabled:true},groups:[],jobs:body.action==='generate'?[{id:body.requestId,status:'queued'}]:[]}})}}
 await act('test-A',{action:'read'});calls=0
 const input={state:{getSnapshot:()=>current},setDraft:t=>{current={...current,draft:t}},notify:(_s,t)=>notices.push(t)},ctx={sessions:{binding:()=>({ctx:{}})},conversation:{input:{for:()=>input},blocks:{storeFor:()=>({getSnapshot:()=>undefined})}}}
 const remove=installInputBridge(ctx,doc),a=doc.querySelector('textarea'),button=doc.querySelector('button')
 const key=options=>a.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...options}))
 assert.equal(key({isComposing:true}),true);assert.equal(key({shiftKey:true}),true);assert.equal(key({repeat:true}),true);button.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await pause();assert.equal(calls,0)
 current={...current,attachmentIds:['attachment']};button.click();await pause();assert.equal(calls,0);assert.match(notices.at(-1),/附件/)
 current={...current,attachmentIds:[]};doc.querySelector('[data-conversation-session="test-B"] button').click();await pause();assert.equal(calls,0)
 button.click();await pause();assert.equal(calls,1);assert.equal(current.draft,'')
 remove();current={...current,draft:'接着写',draftRev:2};button.click();await pause();assert.equal(calls,1);disposeStores();dom.window.close()
})
