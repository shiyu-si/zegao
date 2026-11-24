import {useSyncExternalStore} from 'react'
import {syncPageAppearance} from './appearance.js'
const defaults={size:15,line:1.5,dark:false,reduced:false},listeners=new Set();let value,theme
try{value={...defaults,...JSON.parse(localStorage.getItem('zegao-ios-reading')||'{}')}}catch{value={...defaults}}
value.size=Math.max(14,Math.min(26,Number(value.size)||15));value.line=Math.max(1.4,Math.min(2.2,Number(value.line)||1.5))
export function writeReading(patch){value={...value,...patch};try{localStorage.setItem('zegao-ios-reading',JSON.stringify(value))}catch{}if(Object.hasOwn(patch,'dark')){theme?.setTheme(value.dark?'dark':'light');syncPageAppearance(value.dark)}for(const f of listeners)f()}
export function useReading(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn)},()=>value)}
export const readingStyle=p=>({'--zi-font':p.size+'px','--zi-leading':p.line})
export function bindTheme(ctx){theme=ctx.theme;let stop;const previous=document.documentElement.getAttribute('data-zegao-ios-theme')
 if(theme){value={...value,dark:theme.getTheme().active.colorScheme==='dark'};syncPageAppearance(value.dark);stop=ctx.on('theme/change',s=>{value={...value,dark:s.active.colorScheme==='dark'};syncPageAppearance(value.dark);for(const f of listeners)f()})}
 if(!theme)syncPageAppearance(value.dark)
 return()=>{stop?.();theme=null;if(previous===null)document.documentElement.removeAttribute('data-zegao-ios-theme');else document.documentElement.setAttribute('data-zegao-ios-theme',previous)}
}
