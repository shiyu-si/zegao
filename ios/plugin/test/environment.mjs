import {DomainFacility} from '@deepseek-ai/dsh-storage-domain'
import {JsonStorageBackend} from '@deepseek-ai/dsh-storage-json'
import {initializeHost} from '../src/host.js'
import {ReactLoopAgent,Session,Context,inboxProjectionDefinition,modelSelectionProjectionDefinition} from '../work/engine-harness.mjs'
export async function environment(root,seed,options={}){
 const ctx=new Context(),backend=new JsonStorageBackend(root),effects=[];let failWrites=false
 const open=backend.kv.open;backend.kv.open=async spec=>{const unit=await open(spec),put=unit.putRecord.bind(unit);unit.putRecord=(...args)=>{if(failWrites)throw Error('simulated-disk-write-failure');return put(...args)};return unit}
 const facility=new DomainFacility({storage:{backend:{get:()=>backend}},emit:()=>{},logger:{warn:()=>{},error:()=>{}}},{backend:'json'})
 const agentMap=new Map();let calls=0,prompts=[],requests=[],delay=0,providerFailure=false
 const session=Session.create('session-A',seed)
 function fold(def,session){let state=def.init();for(const e of session.snapshotEvents())state=def.apply(state,e);return state}
 ctx.provide('tools',{resolve:async()=>({dispose(){},schemas:[]})})
 ctx.provide('systemPrompt',{assemble:async()=>({sections:[],contexts:[],variables:{},tools:[]}),refreshContext:assembly=>assembly})
 ctx.provide('agents',{withInitiator:(_a,fn)=>fn()})
 const agent=new ReactLoopAgent(ctx,'session-A',{provider:'test',model:'fixed'},session,{inbox:()=>fold(inboxProjectionDefinition,session),modelSelection:()=>fold(modelSelectionProjectionDefinition,session)},seed?.filter(e=>e.type==='turn/start').length??0,new AbortController().signal)
 agentMap.set(agent.id,agent)
 const fake={storageDomain:facility,agents:{get:id=>agentMap.get(id)},sessions:{flush:async()=>true},llm:{prepareCall:async config=>{calls++;if(providerFailure)throw Error('fixed-provider-failure');return {config,async *stream(options){requests.push(options);prompts.push(options.messages.flatMap(m=>m.content??[]).filter(b=>b.type==='text').map(b=>b.text).join('\n')); if(delay)await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,delay);options.signal.addEventListener('abort',()=>{clearTimeout(timer);reject(Error('cancelled'))},{once:true})});yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'模型固定输出\n完整正文'};yield {type:'block-end',index:0,block:{type:'text',text:'模型固定输出\n完整正文'}};yield {type:'finish',reason:{kind:'stop'}}}}}},connection:{requestRejection:()=>undefined},webServer:{register:route=>{fake.route=route;return()=>{}}},systemPrompt:{context:definition=>{fake.prompt=definition;return()=>{}}},on:(event,handler,hookOptions)=>ctx.on(event,handler,options.ignorePrepend?undefined:hookOptions),effect:fn=>effects.push(fn())}
 ctx.provide('llm',fake.llm)
 await options.installBeforeHost?.(ctx)
 const mounted=await (options.initializeHost??initializeHost)(fake)
 return {...mounted,agent,session,fake,addAgent:id=>{const session=Session.create(id);const other=new ReactLoopAgent(ctx,id,{provider:'test',model:'fixed'},session,{inbox:()=>fold(inboxProjectionDefinition,session),modelSelection:()=>fold(modelSelectionProjectionDefinition,session)},0,new AbortController().signal);agentMap.set(id,other);return other},failWrites:value=>{failWrites=value},get calls(){return calls},get prompts(){return prompts},get requests(){return requests},setDelay:n=>{delay=n},setProviderFailure:value=>{providerFailure=value},close:async()=>{for(const dispose of effects.splice(0).reverse())await dispose?.();await backend.close()},snapshot:()=>session.snapshotEvents()}
}
