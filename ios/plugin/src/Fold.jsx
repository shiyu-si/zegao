import React,{useEffect,useRef,useState} from 'react'
import {Icon} from './Icon.jsx'
const cache=new Map()
export function Fold({text,lines=12,defaultOpen=false,cacheKey,className='zi-prose'}){
 const [open,setOpen]=useState(()=>cache.get(cacheKey)??defaultOpen),[height,setHeight]=useState(null),[limit,setLimit]=useState(0),ref=useRef(null),outer=useRef(null)
 useEffect(()=>{const node=ref.current;const measure=()=>{const style=node.ownerDocument.defaultView.getComputedStyle(node);setLimit((parseFloat(style.lineHeight)||24)*lines);setHeight(node.scrollHeight)};measure();const observer=typeof ResizeObserver==='function'?new ResizeObserver(measure):null;observer?.observe(node);return()=>observer?.disconnect()},[text,lines])
 const long=height!==null&&height>limit+2
 function toggle(){const node=outer.current;if(open&&node){let parent=node.parentElement;while(parent&&!/(auto|scroll)/.test(node.ownerDocument.defaultView.getComputedStyle(parent).overflowY))parent=parent.parentElement;if(node.getBoundingClientRect().top<(parent?.getBoundingClientRect().top??0))node.scrollIntoView({block:'start',behavior:'auto'})}if(cacheKey){cache.set(cacheKey,!open);if(cache.size>2000)cache.delete(cache.keys().next().value)}setOpen(!open)}
 return <section className={`zi-fold ${long&&!open?'zi-folded':''}`} ref={outer}>{long&&open&&<button type="button" className="zi-fold-top" onClick={toggle} aria-label="收起长气泡"><Icon name="up"/>收起</button>}<div className="zi-fold-viewport" style={{maxHeight:height===null?undefined:long&&!open?limit:height+2}}><article ref={ref} className={className}>{text}</article></div>{long&&<button type="button" className="zi-fold-toggle" aria-expanded={open} onClick={toggle}><Icon name={open?'up':'down'}/>{open?'收起':'展开全文'}</button>}</section>
}
