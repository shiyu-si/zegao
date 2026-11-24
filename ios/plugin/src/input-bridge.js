import {docOf,modeOf,ask,act,uid,busy} from './state.js'
import {receiveComposerTxt} from './txt-input.js'
import {classifyInput} from './intent.js'
import {inputSettings,inputActionsFor} from './input-settings.js'
export function installInputBridge(ctx,doc=document){
 const flights=new Set(),retained=new Map();let composing=false,ended=0
 function inputOf(id){const b=ctx.sessions.binding(id);return b?ctx.conversation.input.for(b.ctx):null}
 async function route(id,input,snapshot,decision){
  if(flights.has(id))return;flights.add(id)
  try{
   const current=input.state.getSnapshot();if(current.draft!==snapshot.draft||current.draftRev!==snapshot.draftRev)throw Error('输入已变化，请重新确认发送')
      const d=docOf(id);if(busy(d))throw Error('正在处理上一任务，输入已保留')
   const fingerprint=snapshot.draft+'\0'+snapshot.draftRev+'\0'+decision;let saved=retained.get(id)
   if(saved?.fingerprint!==fingerprint){saved={fingerprint,body:{action:'generate',requestId:uid(),expectedRevision:d.revision,operation:{kind:decision==='import'?'import':decision==='discuss'?'discuss':'continue',text:snapshot.draft,append:d.groups.length>0}}};retained.set(id,saved)}
   const result=await act(id,saved.body);const admitted=result.document?.jobs.find(j=>j.id===saved.body.requestId);if(!admitted||['failed','interrupted','cancelled'].includes(admitted.status))throw Error(admitted?.error||'任务未确认，输入已保留');ask(id,null)
   const after=input.state.getSnapshot();if(after.draft===snapshot.draft&&after.draftRev===snapshot.draftRev)input.setDraft('')
   retained.delete(id)
  }catch(e){input.notify('error',e.message)}finally{flights.delete(id)}
 }
 function consume(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation()}
 function handle(e){
  const card=e.target?.closest?.('[data-composer-card]');if(!card)return
  const id=card.closest('[data-conversation-session]')?.dataset.conversationSession;if(!id)return
  const d=docOf(id);if(!d?.writing.enabled)return
  const enter=e.type==='keydown',before=e.type==='beforeinput',editor=e.target.closest?.('[contenteditable=true],textarea')
  if(enter&&(e.key!=='Enter'||!editor))return
  if(before&&(!['insertParagraph','insertLineBreak'].includes(e.inputType)||!editor))return
  if((enter||before)&&(e.isComposing||e.keyCode===229||composing||Date.now()-ended<50)){
   // Leave native IME confirmation alone, but prevent the host Enter submit
   // handler from interpreting a late composition-closing keydown as send.
   if(enter){e.stopPropagation();e.stopImmediatePropagation()}return
  }
  if(enter&&e.repeat){e.stopPropagation();e.stopImmediatePropagation();return}
  if(enter&&e.altKey)return
  if(enter&&e.shiftKey)return // host's own Shift+Enter keeps native editing
  if(!enter&&!before){const button=e.target.closest('button');if(!button||!card.contains(button))return
   const buttons=[...card.querySelectorAll('button')];if(button!==buttons.at(-1)||button.hasAttribute('data-sending')||button.querySelector('rect')||/停止|继续|stop|continue/i.test(button.getAttribute('aria-label')||''))return
  }
  if(card.querySelector('[role=listbox]:not([hidden])'))return
  let input,s;try{input=inputOf(id);s=input?.state.getSnapshot()}catch{return}
  if(!s||s.phase!=='plain'||s.claim||/^\s*[\/@]/.test(s.draft))return
  if(ctx.conversation.blocks.storeFor(id).getSnapshot()!==undefined)return
  // beforeinput covers software-keyboard line breaks with no keydown. A
  // cancelled keydown never produces a native beforeinput; no synthetic key
  // events are dispatched and the original editor owns the inserted text.
  if(before&&!e.cancelable){e.stopImmediatePropagation();input.notify('error','当前键盘事件无法安全接管，请检查输入内容后再操作');return}
  if(((enter||before)&&inputSettings().enter==='newline'&&!e.ctrlKey&&!e.metaKey)||(before&&e.inputType==='insertLineBreak')){
   if(!e.cancelable){e.stopImmediatePropagation();input.notify('error','当前键盘事件无法安全改为换行，输入已保留；请使用 Shift＋Enter 或更换输入方式');return}
   consume(e)
   try{const api=inputActionsFor(id);if(!api?.captureInsertion||!api?.insertText)throw Error('宿主换行接口尚未就绪，请稍后重试；不会发送')
    const span=api.captureInsertion();if(span.draftRev!==s.draftRev||!api.insertText('\n',span))throw Error('输入已变化或暂不可编辑，请重试换行；不会发送')
   }catch(error){input.notify('error',error.message)}return
  }
  if(!s.draft.trim()&&!s.attachmentIds?.length)return
  consume(e)
  if(s.attachmentIds?.length){void receiveComposerTxt(ctx,id,input,s).catch(e=>input.notify('error',e.message));return}
  if(s.attachmentIds?.length||s.occurrences?.length){input.notify('error','择稿当前接收纯文字。附件或引用已保留，请关闭写作模式后发送。');return}
  const decision=classifyInput(s.draft,modeOf(id))
  if(decision==='ask'||decision==='import')ask(id,{text:s.draft,kind:decision,confirm:chosen=>route(id,input,s,chosen)})
  else void route(id,input,s,decision)
 }
 const start=()=>{composing=true},end=()=>{composing=false;ended=Date.now()}
 doc.addEventListener('beforeinput',handle,true);doc.addEventListener('compositionstart',start,true);doc.addEventListener('compositionend',end,true);doc.addEventListener('click',handle,true);doc.addEventListener('keydown',handle,true)
 return()=>{doc.removeEventListener('beforeinput',handle,true);doc.removeEventListener('compositionstart',start,true);doc.removeEventListener('compositionend',end,true);doc.removeEventListener('click',handle,true);doc.removeEventListener('keydown',handle,true);retained.clear()}
}
