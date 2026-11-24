import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {environment} from './environment.mjs'
import {contextFor,canon,packBackup,parseBackup,newDocument,validateDocument} from '../src/model.js'
import {decodeTxt,receiveComposerTxt,clearTxt} from '../src/txt-input.js'
const body=(d,b)=>({...b,requestId:crypto.randomUUID(),expectedRevision:d.revision})
test('TXT persisted by actual no-charge turn, context toggles, mixed text once, restart and backup',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'zegao-txt-'));let env
 try{
 env=await environment(directory);let d=(await env.handle({action:'read'},env.agent)).document
 d=(await env.handle(body(d,{action:'writing',enabled:true}),env.agent)).document
 const op=body(d,{action:'generate',operation:{kind:'material',text:'导入测试资料',material:{name:'大纲.txt',text:'大纲参考\n已有正文\n待定结局',purpose:'mixed',start:5,end:9}}})
 await env.handle(op,env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document
 assert.equal(d.jobs[0].status,'completed');assert.equal(env.calls,0);assert.equal(d.materials.length,1);assert.equal(canon(d)[0].text,'已有正文');assert.equal(d.materials[0].originalText,'大纲参考\n已有正文\n待定结局')
 assert.equal(contextFor(d,{kind:'continue',text:'下一段'}).prompt.split('已有正文').length-1,1)
 assert.equal(env.snapshot().filter(e=>e.type==='turn/start').length,1);assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
 await env.handle(op,env.agent);assert.equal((await env.handle({action:'read'},env.agent)).document.materials.length,1)
 d=(await env.handle(body(d,{action:'materialToggle',materialId:d.materials[0].id,enabled:false}),env.agent)).document
 assert(!contextFor(d,{kind:'continue',text:'下一段'}).prompt.includes('待定结局'))
 assert.equal(parseBackup(packBackup([d]))[0].materials[0].originalText,d.materials[0].originalText)
 const other=env.addAgent('session-B');assert.equal((await env.handle({action:'read'},other)).document.materials.length,0)
 const seed=env.snapshot();await env.close();env=await environment(directory,seed);d=(await env.handle({action:'read'},env.agent)).document;assert.equal(d.materials.length,1);assert.equal(env.calls,0)
 }finally{await env?.close();await rm(directory,{recursive:true,force:true})}
})
test('old documents remain readable; invalid or oversized TXT refused without truncation',async()=>{
 const old=newDocument('session-old');delete old.materials;assert.equal(validateDocument(old),old);assert.equal(parseBackup(packBackup([old]))[0].sessionId,'session-old')
 assert.deepEqual(await decodeTxt(new File(['中文\n\n末尾\n'],'test.txt')),{name:'test.txt',text:'中文\n\n末尾\n'})
 await assert.rejects(()=>decodeTxt(new File([new Uint8Array([255,254,128])],'bad.txt')))
 await assert.rejects(()=>decodeTxt(new File(['x'.repeat(80001)],'large.txt')),/80000/)
 await assert.rejects(()=>decodeTxt(new File(['x'],'not.json')),/TXT/)
})
test('attachment reads do not submit or clear input; unavailable host interface refuses',async()=>{
 let removed=0;const file=new File(['大纲'],'draft.txt'),input={state:{getSnapshot:()=>({attachmentIds:['one','later']})},removeAttachment:id=>{assert.equal(id,'one');removed++;return true}}
 const ctx={sessions:{binding:()=>({ctx:{}})},conversation:{input:{for:()=>input},resolveDraftAttachments:()=>[{id:'one',kind:'file',file}],releaseDraftAttachment:id=>assert.equal(id,'one')}}
 await receiveComposerTxt(ctx,'txt-test',input,{attachmentIds:['one'],occurrences:[]});assert.equal(removed,0);clearTxt('txt-test')
 delete ctx.conversation.resolveDraftAttachments;await assert.rejects(()=>receiveComposerTxt(ctx,'txt-test',input,{attachmentIds:['one']}),/宿主附件接口/)
})
