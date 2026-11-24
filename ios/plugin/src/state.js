import {useSyncExternalStore} from 'react'
export const VERSION='0.1.0'
export const uid=()=>crypto.randomUUID()
const stores=new Map(),modes=new Map(),choices=new Map();let alive=true
export async function request(sessionId,body){
 const r=await fetch(`/api/zegao-ios?session=${encodeURIComponent(sessionId)}`,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})})
 const v=await r.json();if(!r.ok)throw Error(v.error||'操作未确认，请保留文字后重新读取');return v
}
function store(id){if(!stores.has(id)){
 const s={snapshot:{document:null,error:'',loading:false},listeners:new Set(),timer:null,flight:null}
 s.publish=v=>{if(!alive)return;s.snapshot={...s.snapshot,...v};for(const fn of s.listeners)fn()}
 s.accept=v=>{if(v.document&&v.document.sessionId===id&&v.document.revision>=(s.snapshot.document?.revision??-1))s.publish({document:v.document,error:''});return v}
 s.refresh=()=>{if(!s.flight){s.flight=request(id).then(v=>s.accept(v)).catch(e=>s.publish({error:e.message})).finally(()=>{s.flight=null;s.publish({loading:false})})}return s.flight}
 s.subscribe=fn=>{s.listeners.add(fn);if(s.listeners.size===1){void s.refresh();s.timer=setInterval(s.refresh,1200)}return()=>{s.listeners.delete(fn);if(!s.listeners.size){clearInterval(s.timer);s.timer=null}}}
 stores.set(id,s)
 }return stores.get(id)}
export function useDocument(id){const s=store(id);return [useSyncExternalStore(s.subscribe,()=>s.snapshot),s]}
export async function act(id,body){const s=store(id);const v=await request(id,body);return s.accept(v)}
export const modeOf=id=>modes.get(id)||'auto'
export function setMode(id,value){modes.set(id,value);store(id).publish({})}
export function ask(id,value){choices.set(id,value);store(id).publish({})}
export const choiceOf=id=>choices.get(id)
export const docOf=id=>store(id).snapshot.document
export const busy=d=>d?.jobs.find(j=>['queued','running','stopping'].includes(j.status))
export function startStores(){alive=true}
export function disposeStores(){alive=false;for(const s of stores.values())clearInterval(s.timer);stores.clear();choices.clear()}
export function draftGet(key){try{return JSON.parse(localStorage.getItem('zegao-ios-draft:'+key)||'null')}catch{return null}}
export function draftSet(key,value){try{if(value===null)localStorage.removeItem('zegao-ios-draft:'+key);else localStorage.setItem('zegao-ios-draft:'+key,JSON.stringify(value));return true}catch{return false}}
