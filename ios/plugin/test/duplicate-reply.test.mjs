import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createUserMessage} from '@deepseek-ai/dsh-llm'
import {environment} from './environment.mjs'
import {install as installClock} from './fixtures/ds-bot-0.3.8/time-context.js'

// Actual published DS Bot 0.3.8 clock middleware; only its Bot/session lookup
// services are substitutes. Cordis waterfall and rc.4 Agent loop are real.
function installClockOnly(ctx){
 installClock({ctx,config:{timeZone:'Asia/Shanghai'},load:async()=>{},isBotSession:()=>true,async *eventsBackwards(){}})
}
function installBeforeHost(ctx){
 installClockOnly(ctx)
 // Memory/context-style enrichment also appends after next(). Deliberately
 // unguarded for empty messages, as in the clock and memory paths under test.
 ctx.on('agent/pre-step',async(_payload,next)=>{
  const decision=await next()
  return decision.kind==='reject'?decision:{...decision,messages:[...decision.messages,createUserMessage({content:[{type:'text',text:'固定测试设定'}],source:{kind:'test-memory-context'}})]}
 })
}
const change=(d,body)=>({...body,requestId:crypto.randomUUID(),expectedRevision:d.revision})
async function withEnv(options,run){
 const directory=await mkdtemp(join(tmpdir(),'zegao-duplicate-'));let env
 try{env=await environment(directory,undefined,{installBeforeHost,...options});await run(env)}finally{await env?.close();await rm(directory,{recursive:true,force:true})}
}
async function runOperation(env,kind='discuss',text='你好'){
 let d=(await env.handle({action:'read'},env.agent)).document
 if(!d.writing.enabled)d=(await env.handle(change(d,{action:'writing',enabled:true}),env.agent)).document
 await env.handle(change(d,{action:'generate',operation:{kind,text,...(kind==='material'?{material:{name:'参考.txt',text:'固定参考',purpose:'reference'}}:{})}}),env.agent);await env.agent.whenIdle()
 return (await env.handle({action:'read'},env.agent)).document
}

test('r2 control: clock/context wraps empty decision and causes a second independent model call',async()=>{
 await withEnv({ignorePrepend:true,installBeforeHost:installClockOnly},async env=>{
  const d=await runOperation(env)
  assert.equal(d.jobs[0].status,'completed');assert.equal(d.groups.length,0)
  assert.equal(env.calls,2);assert.equal(env.requests.length,2)
  assert.equal(env.requests[0].purpose,'zegao-ios-draft')
  assert.equal(env.snapshot().filter(e=>e.type==='turn/start').length,1)
  assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,1)
  assert.equal(env.snapshot().filter(e=>e.type==='assistant/message').length,1)
  assert(env.snapshot().some(e=>e.type==='user/message'&&e.data.source.kind==='ds-bot-time-context'))
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

for(const kind of ['discuss','continue','import','material'])test(`owned ${kind}: no host model step even with DS Bot clock/context middleware`,async()=>{
 await withEnv({},async env=>{
  const d=await runOperation(env,kind,kind==='import'?'固定导入正文':'你好')
  assert.equal(d.jobs[0].status,'completed');assert.equal(env.calls,['import','material'].includes(kind)?0:1)
  assert.equal(d.groups.length,['discuss','material'].includes(kind)?0:1)
  assert.equal(env.snapshot().filter(e=>e.type==='turn/start').length,1)
  assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
  assert.equal(env.snapshot().filter(e=>e.type==='assistant/message').length,0)
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

test('ordinary host input still delegates, keeps clock/context and produces one normal reply',async()=>{
 await withEnv({},async env=>{
  await env.agent.followup(createUserMessage({content:[{type:'text',text:'普通宿主测试'}],source:{kind:'user'}}));await env.agent.whenIdle()
  assert.equal(env.calls,1);assert.equal(env.snapshot().filter(e=>e.type==='assistant/message').length,1)
  assert(env.snapshot().some(e=>e.type==='user/message'&&e.data.source.kind==='ds-bot-time-context'))
  assert(env.snapshot().some(e=>e.type==='user/message'&&e.data.source.kind==='test-memory-context'))
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

test('built r3 Host also short-circuits actual DS Bot clock',async()=>{
 const {initializeHost}=await import('../lib/index.js')
 await withEnv({initializeHost,installBeforeHost:installClockOnly},async env=>{
  const d=await runOperation(env);assert.equal(d.jobs[0].status,'completed')
  assert.equal(env.calls,1);assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

test('settled plugin message replay is consumed without a plugin or host model request',async()=>{
 await withEnv({},async env=>{
  await runOperation(env)
  const anchor=env.snapshot().find(e=>e.type==='user/message'&&e.data.source.kind==='zegao-ios-operation').data
  await env.agent.followup(anchor);await env.agent.whenIdle()
  assert.equal(env.calls,1);assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
  assert.equal(env.snapshot().filter(e=>e.type==='user/message').length,1)
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

test('provider failure settles job and does not fall through to the host provider',async()=>{
 await withEnv({},async env=>{
  env.setProviderFailure(true);const d=await runOperation(env)
  assert.equal(d.jobs[0].status,'failed');assert.equal(env.calls,1)
  assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})

test('stopped job with context middleware never resumes as an ordinary host call',async()=>{
 await withEnv({},async env=>{
  let d=(await env.handle({action:'read'},env.agent)).document
  d=(await env.handle(change(d,{action:'writing',enabled:true}),env.agent)).document
  env.setDelay(5000);const op=change(d,{action:'generate',operation:{kind:'continue',text:'停止测试'}})
  await env.handle(op,env.agent)
  for(let i=0;i<100&&!env.calls;i++)await new Promise(resolve=>setTimeout(resolve,5))
  assert.equal(env.calls,1);await env.handle({action:'stop',jobId:op.requestId},env.agent);await env.agent.whenIdle()
  d=(await env.handle({action:'read'},env.agent)).document
  assert.equal(d.jobs[0].status,'cancelled');assert.equal(d.groups.length,0);assert.equal(env.calls,1)
  assert.equal(env.snapshot().filter(e=>e.type==='step/start').length,0)
  assert.equal(env.snapshot().at(-1).data.reason.kind,'completed')
 })
})
