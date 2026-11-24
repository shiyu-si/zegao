import {useSyncExternalStore} from 'react'
const key='zegao-ios-input',listeners=new Set(),actions=new Map()
function defaultEnter(){
 const nav=globalThis.navigator
 return /iPhone|iPad|iPod|Android/i.test(nav?.userAgent??'')||(nav?.platform==='MacIntel'&&nav?.maxTouchPoints>1)?'newline':'send'
}
let value={enter:defaultEnter()}
try{const saved=JSON.parse(globalThis.localStorage?.getItem(key)||'null');if(['newline','send'].includes(saved?.enter))value={enter:saved.enter}}catch{}
export const inputSettings=()=>value
export function writeInputSettings(patch){if(!['newline','send'].includes(patch.enter))return;value={enter:patch.enter};try{globalThis.localStorage?.setItem(key,JSON.stringify(value))}catch{}for(const f of listeners)f()}
export function useInputSettings(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},inputSettings)}
// SessionStandardProps supplies these public actions. Never reach into the
// private Lexical editor or replace the draft to insert a newline.
export function bindInputActions(id,api){const token={api};actions.set(id,token);return()=>{if(actions.get(id)===token)actions.delete(id)}}
export const inputActionsFor=id=>actions.get(id)?.api
