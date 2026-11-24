import React,{useEffect,useState} from 'react'
import {createRoot} from 'react-dom/client'
import {Card,Dock} from '../src/UI.jsx'
import {definition} from '../src/client.jsx'
import {installInputBridge} from '../src/input-bridge.js'
import {installLogoFilter} from '../src/appearance.js'
import {writeReading} from '../src/reading.js'
import {projectIcon} from '../src/assets.js'
installLogoFilter();writeReading({dark:true})
let draft='',rev=0
const input={state:{getSnapshot:()=>({phase:'plain',draft,draftRev:rev,attachmentIds:[],occurrences:[],claim:null})},setDraft:t=>{draft=t;document.querySelector('#composer').value=t;rev++},submit:async()=>{document.querySelector('#notice').textContent='普通讨论在此隔离测试页不接模型。'},notify:(_level,t)=>document.querySelector('#notice').textContent=t}
const ctx={sessions:{binding:()=>({ctx:{}})},conversation:{input:{for:()=>input},blocks:{storeFor:()=>({getSnapshot:()=>undefined})}}};installInputBridge(ctx)
function App(){const [nodes,setNodes]=useState([])
 useEffect(()=>{const refresh=async()=>{const events=await (await fetch('/test/events')).json(),map=new Map();for(const event of events){const match=definition.match(event);if(match&&!map.has(match.id)){const state=definition.start({}, {event});map.set(match.id,{data:state})}}setNodes([...map.values()])};refresh();const t=setInterval(refresh,1000);return()=>clearInterval(t)},[])
 return <main data-conversation-session="session-A"><header className="test-header"><img src={projectIcon}/><div>择稿 iOS v0.1.0<small>隔离集成页 · 固定模型输出 · 不收费</small></div></header><section className="test-chat">{nodes.map(n=><Card key={n.data.jobId} node={n} pluginSessionId="session-A"/>)}</section><footer><Dock pluginSessionId="session-A" ctx={ctx}/><div data-composer-card><textarea id="composer" aria-label="聊天输入栏" placeholder="写一段雨夜重逢…" onInput={e=>{draft=e.target.value;rev++}}/><button aria-label="发送" onClick={()=>input.submit()}>↑</button></div><small id="notice"/></footer></main>
}createRoot(document.getElementById('app')).render(<App/> )
