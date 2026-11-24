import React,{useState,useRef,useEffect} from 'react'
import {useTxt,clearTxt,receiveTxt} from './txt-input.js'
import {useDocument,act,uid,busy} from './state.js'
export function Materials({id}){
 const [{document:d}]=useDocument(id),pending=useTxt(id),[purpose,setPurpose]=useState('reference'),[selection,setSelection]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[view,setView]=useState(null),area=useRef(null),file=useRef(null),operation=useRef(null)
 useEffect(()=>{setPurpose('reference');setSelection(null);operation.current=null},[pending])
 async function save(){setError('');setSaving(true);try{
  if(purpose==='mixed'&&!selection)throw Error('请先选择已有正文')
  const duplicate=(d.materials??[]).find(m=>m.name===pending.name);let replaceId=pending.sourceId
  if(duplicate&&duplicate.id!==pending.sourceId&&purpose!=='import'){if(confirm('已有同名材料，确定替换参考材料？取消则保留两份。'))replaceId=duplicate.id}
  const material={name:pending.name,text:pending.text,purpose,...(selection??{}),...(replaceId?{replaceId}:{})}
  const fingerprint=JSON.stringify(material)
  if(!operation.current||operation.current.fingerprint!==fingerprint)operation.current={fingerprint,body:{action:'generate',requestId:uid(),expectedRevision:d.revision,operation:{kind:'material',text:'添加TXT：'+pending.name,material}}}
  const result=await act(id,operation.current.body),job=result.document.jobs.find(j=>j.id===operation.current.body.requestId)
  if(!job||['failed','cancelled','interrupted'].includes(job.status))throw Error(job?.error||'材料保存未确认')
  // A queued response is admission, not a durable completed material save.
  let document=result.document
  for(let i=0;i<180&&['queued','running','stopping'].includes(document.jobs.find(j=>j.id===job.id)?.status);i++){await new Promise(r=>setTimeout(r,200));document=(await act(id,{action:'read'})).document}
  if(document.jobs.find(j=>j.id===job.id)?.status!=='completed')throw Error('任务未完成或结果未知，附件保留；请重读核对后重试')
  try{pending.cleanup?.()}catch(e){setError(e.message)}
  clearTxt(id,pending);operation.current=null;setSelection(null)
 }catch(e){setError(e.message)}finally{setSaving(false)}}
 async function toggle(m){try{await act(id,{action:'materialToggle',materialId:m.id,enabled:!m.enabled,requestId:uid(),expectedRevision:d.revision})}catch(e){setError(e.message)}}
 return <section><p>参考材料仅属于当前作品。待定内容不自动成为确定设定。添加材料本身不调用模型；聊天要求保留在输入框，保存后可继续发送。</p><input hidden ref={file} type="file" accept=".txt,text/plain" onChange={async e=>{try{await receiveTxt(id,[...e.target.files]);setPurpose('reference');setSelection(null);setError('')}catch(e){setError(e.message)}finally{if(file.current)file.current.value=''}}}/><button type="button" disabled={saving||!!pending} onClick={()=>file.current.click()}>添加 TXT</button>
 {pending&&<section className="zi-material"><h3>{pending.name}</h3><p>{pending.text.length} 字符 · 待确认用途</p><div className="zi-purpose">{[['reference','作为参考材料'],['import','作为已有正文'],['mixed','大纲与正文混合']].map(([key,label])=><button type="button" key={key} disabled={saving} aria-pressed={purpose===key} onClick={()=>{setPurpose(key);setSelection(null)}}>{label}</button>)}</div><textarea aria-label="TXT内容" ref={area} readOnly value={pending.text}/>{purpose==='mixed'&&<><button type="button" disabled={saving} onClick={()=>{const a=area.current;if(a.selectionStart===a.selectionEnd){setError('请先在文件内容中选中文字');return}setSelection({start:a.selectionStart,end:a.selectionEnd})}}>将选中文字作为已有正文</button>{selection&&<p>已选 {selection.end-selection.start} 字符</p>}</>}<p>{purpose==='reference'?'不加入已采用正文，后续生成参考已启用材料。':'确认后原文追加为已采用正文，现有稿件保留。'}</p><button type="button" disabled={saving||!!busy(d)} onClick={save}>{saving?'等待保存确认…':'确认保存'}</button><button type="button" disabled={saving} onClick={()=>{clearTxt(id,pending);operation.current=null}}>取消，保留原输入</button></section>}
 {error&&<p className="zi-error" role="alert">{error}</p>}
 {(d.materials??[]).map(m=><section className="zi-material" key={m.id}><strong>{m.name}</strong><small> · {m.enabled?'已启用':'已停用'} · {m.originalText.length} 字符</small><p>{m.text.slice(0,100)}{m.text.length>100?'…':''}</p><button type="button" onClick={()=>setView(view===m.id?null:m.id)}>{view===m.id?'收起全文':'查看全文'}</button><button type="button" disabled={saving||!!pending} onClick={()=>receiveTxt(id,[new File([m.originalText],m.name)],undefined,m.id).catch(e=>setError(e.message))}>用途设置</button><button type="button" disabled={saving||!!busy(d)} onClick={()=>toggle(m)}>{m.enabled?'停用参考':'启用参考'}</button>{view===m.id&&<textarea readOnly aria-label="参考材料全文" value={m.originalText}/>}</section>)}</section>
}

export function MaterialCard({id,materialId}){
 const [{document:d}]=useDocument(id),[view,setView]=useState(false),[error,setError]=useState('');const m=d?.materials?.find(m=>m.id===materialId);if(!m)return null
 return <section className="zi-material"><strong>{m.name}</strong><small> · {m.enabled?'已启用':'已停用'} · {m.originalText.length} 字符</small><p>{m.text.slice(0,90)}{m.text.length>90?'…':''}</p><button type="button" onClick={()=>setView(!view)}>{view?'收起全文':'查看全文'}</button><button type="button" disabled={!!busy(d)} onClick={async()=>{try{await act(id,{action:'materialToggle',materialId:m.id,enabled:!m.enabled,requestId:uid(),expectedRevision:d.revision});setError('')}catch(e){setError(e.message)}}}>{m.enabled?'停用参考':'启用参考'}</button>{view&&<textarea readOnly aria-label="材料全文" value={m.originalText}/>}<p className="zi-error" hidden={!error}>{error}</p></section>
}
