import {useSyncExternalStore} from 'react'
const pending=new Map(),listeners=new Set(),reading=new Set()
const publish=()=>{for(const f of listeners)f()}
export function useTxt(id){return useSyncExternalStore(f=>{listeners.add(f);return()=>listeners.delete(f)},()=>pending.get(id)??null)}
export function clearTxt(id,value){if(!value||pending.get(id)===value){pending.delete(id);publish()}}
export async function decodeTxt(file){
 if(!file||!/^.+\.txt$/i.test(file.name)||file.size>1024*1024)throw Error('请选择1MiB以内的TXT文件')
 const bytes=await file.arrayBuffer(),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
 if(!text.trim()||text.length>80000)throw Error('TXT须非空且不超过80000字符；请拆分材料，不会截断')
 return {name:file.name,text}
}
export async function receiveTxt(id,files,cleanup,sourceId){if(reading.has(id))return;reading.add(id);try{
 if(pending.has(id))throw Error('请先处理待确认的TXT')
 if(files.length!==1)throw Error('请一次添加一个TXT；附件已保留')
 const value={...await decodeTxt(files[0]),cleanup,sourceId};pending.set(id,value);publish()
 }finally{reading.delete(id)}}
export async function receiveComposerTxt(ctx,id,input,snapshot){
 if(snapshot.occurrences?.length||snapshot.quotes?.length)throw Error('附件与引用请分开发送，输入已保留')
 if(typeof ctx.conversation.resolveDraftAttachments!=='function')throw Error('宿主附件接口不可用，请使用择稿工具中的添加TXT')
 const ids=[...snapshot.attachmentIds],items=ctx.conversation.resolveDraftAttachments(ids)
 if(items.length!==ids.length||items.some((m,i)=>m.id!==ids[i]||m.kind!=='file'))throw Error('仅支持TXT文件附件，输入已保留')
 await receiveTxt(id,items.map(m=>m.file),()=>{
  const binding=ctx.sessions.binding(id);if(!binding)throw Error('材料已保存，会话已关闭；附件未清理')
  const current=ctx.conversation.input.for(binding.ctx)
  if(typeof ctx.conversation.releaseDraftAttachment!=='function')throw Error('材料已保存，宿主附件清理接口不可用，请手动移除原附件')
  for(const attachmentId of ids){if(current.state.getSnapshot().attachmentIds.includes(attachmentId)){if(current.removeAttachment(attachmentId)===false)throw Error('材料已保存，输入正忙，请手动移除原附件');ctx.conversation.releaseDraftAttachment(attachmentId)}}
 })
}
