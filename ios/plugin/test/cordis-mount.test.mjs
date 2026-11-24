import test from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {Context} from '@deepseek-ai/cordis'
import {DomainFacility} from '@deepseek-ai/dsh-storage-domain'
import {JsonStorageBackend} from '@deepseek-ai/dsh-storage-json'
import * as sourcePlugin from '../src/host.js'
import * as builtPlugin from '../lib/index.js'

test('Cordis 4.1.0 control reproduces Invalid effect for an async object return',async()=>{
 const ctx=new Context(),fiber=ctx.plugin({name:'invalid-effect-control',async apply(){return {handle(){},domain:{}}}})
 try{await assert.rejects(fiber.await(),/Invalid effect/);assert.equal(fiber.state,3)}finally{await fiber.dispose()}
})

for(const [label,plugin] of [['source',sourcePlugin],['built host entry',builtPlugin]])test(`Cordis 4.1.0 real mount/unmount: ${label} activates, owns route and releases domain`,async()=>{
 const directory=await mkdtemp(join(tmpdir(),'zegao-cordis-mount-')),ctx=new Context(),backend=new JsonStorageBackend(directory)
 const routes=new Map(),sections=new Map();let opened,providerCalls=0,closed=0,fiber
 const domainFacility=new DomainFacility({storage:{backend:{get:()=>backend}},emit(){},logger:{warn(){},error(){}}},{backend:'json'})
 // Only external host services are test doubles. ctx.plugin(), injection,
 // effect collection, Fiber activation and teardown use actual Cordis 4.1.0.
 ctx.provide('storageDomain',{open:async spec=>{opened=await domainFacility.open(spec);const close=opened.close.bind(opened);opened.close=async()=>{closed++;return close()};return opened}})
 ctx.provide('agents',{get:()=>undefined})
 ctx.provide('sessions',{flush:async()=>true})
 ctx.provide('llm',{prepareCall:async()=>{providerCalls++;throw Error('no model calls permitted in mount smoke test')}})
 ctx.provide('webServer',{register:route=>{assert(!routes.has(route.path));routes.set(route.path,route);return()=>routes.delete(route.path)}})
 ctx.provide('connection',{requestRejection:()=>401})
 ctx.provide('systemPrompt',{context:section=>{sections.set(section.name,section);return()=>sections.delete(section.name)}})
 try{
  fiber=ctx.plugin(plugin);await fiber.await();assert.equal(fiber.state,2,'must be ACTIVE, not merely enabled or installed')
  assert(routes.has('/api/zegao-ios'));assert(sections.has('zegao-ios-canon'));assert.equal(opened.name,'zegao_ios');assert.equal(providerCalls,0)
  let status;await routes.get('/api/zegao-ios').handler({},{writeHead:value=>{status=value},end(){}});assert.equal(status,401,'registered route must execute the auth boundary')
  await fiber.dispose();assert.equal(routes.size,0);assert.equal(sections.size,0);assert.equal(closed,1);assert.equal(providerCalls,0)
  // Reopening the exact domain proves awaited teardown released it.
  const domain=await domainFacility.open({name:'zegao_ios',version:1,layout:'single',tables:{}});await domain.close()
 }finally{if(fiber?.uid!==null)await fiber?.dispose();await backend.close();await rm(directory,{recursive:true,force:true})}
})
