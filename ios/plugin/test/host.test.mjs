import {environment} from './environment.mjs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,readFile,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {DomainFacility} from '@deepseek-ai/dsh-storage-domain'
import {JsonStorageBackend} from '@deepseek-ai/dsh-storage-json'
import {apply} from '../src/host.js'
import {canon} from '../src/model.js'
import {ReactLoopAgent,Session,Context,inboxProjectionDefinition,modelSelectionProjectionDefinition} from '../work/engine-harness.mjs'
const nextBody=(d,body)=>({...body,requestId:crypto.randomUUID(),expectedRevision:d.revision})
test('real rc.4 Agent loop + JSON domain: actual turn, one call, durable anchor and restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-engine-'));let env
 try{
  env=await environment(root);let d=(await env.handle({action:'read'},env.agent)).document
  d=(await env.handle(nextBody(d,{action:'writing',enabled:true}),env.agent)).document
  const op=nextBody(d,{action:'generate',operation:{kind:'continue',text:'写一段雨夜重逢'}})
  await env.handle(op,env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document
  assert.equal(d.jobs[0].status,'completed',JSON.stringify(d.jobs[0]));assert.equal(d.groups.length,1);assert.equal(env.calls,1)
  assert.equal(env.snapshot().filter(e=>e.type==='turn/start').length,1);assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0);assert.equal(env.snapshot().filter(e=>e.type==='user/message').length,1)
  assert.equal(env.snapshot().at(-1).type,'turn/end');assert.equal(env.snapshot().at(-1).data.reason.kind,'completed');assert(!env.snapshot().some(e=>e.type.startsWith('plugin:')))
  await env.handle(op,env.agent);assert.equal(env.calls,1)
  const g=d.groups[0];d=(await env.handle(nextBody(d,{action:'select',groupId:g.id,candidateId:g.candidates[0].id}),env.agent)).document
  const second=nextBody(d,{action:'generate',operation:{kind:'continue',text:'接着写下一段'}});await env.handle(second,env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document
  assert.equal(d.groups.length,2);assert.equal(env.prompts[1].split('模型固定输出\n完整正文').length-1,1)
  const onDisk=JSON.parse(await readFile(join(root,'zegao_ios.json'),'utf8'));assert.equal(onDisk.tables.documents['session-A'].revision,d.revision)
  const seed=env.snapshot();await env.close();env=await environment(root,seed);const restored=(await env.handle({action:'read'},env.agent)).document
  assert.equal(restored.groups.length,2);assert.equal(canon(restored)[0].text,'模型固定输出\n完整正文');assert.equal(env.calls,0)
 }finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('stop is per job and settles without adopting incomplete output',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-cancel-'));let env
 try{env=await environment(root);let d=(await env.handle({action:'read'},env.agent)).document;d=(await env.handle(nextBody(d,{action:'writing',enabled:true}),env.agent)).document;env.setDelay(5000);const op=nextBody(d,{action:'generate',operation:{kind:'continue',text:'写一段'}});await env.handle(op,env.agent);for(let i=0;i<100&&!env.calls;i++)await new Promise(r=>setTimeout(r,5));await env.handle({action:'stop',jobId:op.requestId},env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document;assert.equal(d.jobs[0].status,'cancelled');assert.equal(d.groups.length,0);assert.equal(env.calls,1)}finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('discussion does not create candidates; confirmed import uses a real no-charge turn',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-discuss-'));let env
 try{env=await environment(root);let d=(await env.handle({action:'read'},env.agent)).document;d=(await env.handle(nextBody(d,{action:'writing',enabled:true}),env.agent)).document
 const imported=nextBody(d,{action:'generate',operation:{kind:'import',text:'原文开头保持不变\n含真实换行'}});await env.handle(imported,env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document;assert.equal(env.calls,0);assert.equal(canon(d)[0].text,imported.operation.text);assert.equal(env.snapshot().filter(e=>e.type==='turn/start').length,1)
 const talk=nextBody(d,{action:'generate',operation:{kind:'discuss',text:'讨论人物设定是否合理'}});await env.handle(talk,env.agent);await env.agent.whenIdle();d=(await env.handle({action:'read'},env.agent)).document;assert.equal(d.groups.length,1);assert.equal(d.jobs.at(-1).output,'模型固定输出\n完整正文');assert.equal(env.prompts[0].split(imported.operation.text).length-1,1);assert.match(env.prompts[0],/不续写正文/)
 }finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('backup restored into empty conversation uses a real engine turn and keeps original data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-restore-source-')),target=await mkdtemp(join(tmpdir(),'zegao-ios-restore-target-'));let a,b
 try{a=await environment(root);let d=(await a.handle({action:'read'},a.agent)).document;d=(await a.handle(nextBody(d,{action:'writing',enabled:true}),a.agent)).document;await a.handle(nextBody(d,{action:'generate',operation:{kind:'import',text:'原作者稿件'}}),a.agent);await a.agent.whenIdle();const raw=(await a.handle({action:'backup'},a.agent)).text
 b=await environment(target);let fresh=(await b.handle({action:'read'},b.agent)).document;fresh=(await b.handle(nextBody(fresh,{action:'writing',enabled:true}),b.agent)).document;await b.handle(nextBody(fresh,{action:'generate',operation:{kind:'restore',text:raw,index:0}}),b.agent);await b.agent.whenIdle();const result=(await b.handle({action:'read'},b.agent)).document;assert.equal(canon(result)[0].text,'原作者稿件');assert.equal(result.jobs[0].restored,true);assert.equal(b.calls,0);assert.equal(b.snapshot().filter(e=>e.type==='turn/start').length,1);assert.notEqual(result.documentId,(await a.handle({action:'read'},a.agent)).document.documentId)
 }finally{await a?.close();await b?.close();await rm(root,{recursive:true,force:true});await rm(target,{recursive:true,force:true})}
})
test('one Host domain isolates two live conversations; cross-session late results stay in source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-isolation-'));let env
 try{env=await environment(root);const b=env.addAgent('session-B');let aDoc=(await env.handle({action:'read'},env.agent)).document,bDoc=(await env.handle({action:'read'},b)).document;aDoc=(await env.handle(nextBody(aDoc,{action:'writing',enabled:true}),env.agent)).document;bDoc=(await env.handle(nextBody(bDoc,{action:'writing',enabled:true}),b)).document;env.setDelay(60);await env.handle(nextBody(aDoc,{action:'generate',operation:{kind:'continue',text:'写A的作品'}}),env.agent);const readB=(await env.handle({action:'read'},b)).document;assert.equal(readB.groups.length,0);await env.agent.whenIdle();assert.equal((await env.handle({action:'read'},env.agent)).document.groups.length,1);assert.equal((await env.handle({action:'read'},b)).document.groups.length,0)}finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('reopening durable queued request marks interrupted and never dispatches a provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-restart-'));let env
 try{env=await environment(root);let d=(await env.handle({action:'read'},env.agent)).document;await env.domain.table('documents').update('session-A',old=>({...old,jobs:[{id:crypto.randomUUID(),messageId:'lost-message',fingerprint:'pending',operation:{kind:'continue',text:'未派发请求'},status:'queued',createdAt:Date.now(),error:null}],revision:old.revision+1}));const seed=env.snapshot();await env.close();env=await environment(root,seed);d=(await env.handle({action:'read'},env.agent)).document;assert.equal(d.jobs[0].status,'interrupted');assert.equal(env.calls,0)}finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('failed durable save does not publish a new revision or overwrite the old record',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-save-fault-'));let env
 try{env=await environment(root);const before=(await env.handle({action:'read'},env.agent)).document;env.failWrites(true);await assert.rejects(()=>env.handle(nextBody(before,{action:'writing',enabled:true}),env.agent));env.failWrites(false);const after=(await env.handle({action:'read'},env.agent)).document;assert.equal(after.revision,before.revision);assert.equal(after.writing.enabled,false);const disk=JSON.parse(await readFile(join(root,'zegao_ios.json'),'utf8'));assert.equal(disk.tables.documents['session-A'].revision,before.revision)}finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
test('HTTP endpoint preserves auth and rejects cross-origin mutation',async()=>{
 const root=await mkdtemp(join(tmpdir(),'zegao-ios-http-'));let env
 try{env=await environment(root);const {Readable}=await import('node:stream');async function hit(headers,body){const req=Readable.from(body?[Buffer.from(JSON.stringify(body))]:[]);req.url='/api/zegao-ios?session=session-A';req.method=body?'POST':'GET';req.headers=headers;let status,payload;await env.fake.route.handler(req,{writeHead:s=>{status=s},end:p=>{payload=JSON.parse(p)}});return {status,payload}}
 env.fake.connection.requestRejection=()=>401;assert.equal((await hit({})).status,401);env.fake.connection.requestRejection=()=>undefined;const normal=await hit({});assert.equal(normal.status,200);const rejected=await hit({'content-type':'application/json',origin:'https://other.example',host:'127.0.0.1'},{action:'writing',enabled:true});assert.equal(rejected.status,409);assert.equal((await hit({})).payload.document.revision,normal.payload.document.revision)
 }finally{await env?.close();await rm(root,{recursive:true,force:true})}
})
