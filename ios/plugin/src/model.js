import { randomUUID, createHash } from 'node:crypto'
import { partialRange, mergePartial } from './partial.js'
import { readBackup as readLegacy } from './legacy/backup.js'
export const VERSION='0.1.0', MAX_TEXT=80000, BACKUP_LIMIT=16*1024*1024
export const clone=v=>structuredClone(v)
export const canonical=v=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')}}`:JSON.stringify(v)
export const hash=v=>createHash('sha256').update(typeof v==='string'?v:canonical(v)).digest('hex')
export function check(ok,message){if(!ok)throw new Error(message)}
export function text(v,max=MAX_TEXT){check(typeof v==='string'&&v.trim()&&v.length<=max,`文字须非空且不超过${max}个UTF-16字符`);return v}
export function identity(v){check(typeof v==='string'&&/^[a-zA-Z0-9_-]{1,160}$/.test(v),'标识无效');return v}
export function newDocument(sessionId,workspaceId=''){
 return {schema:1,documentId:randomUUID(),sessionId,workspaceId,title:'未命名作品',revision:0,canonRevision:0,groups:[],materials:[],writing:{enabled:false,longTerm:'',progress:''},summary:{drafts:[],activeId:null},jobs:[],receipts:[],createdAt:Date.now(),updatedAt:Date.now()}
}
export function validateDocument(d){
 check(d?.schema===1,'不支持的数据版本');identity(d.documentId);identity(d.sessionId)
 check(Number.isSafeInteger(d.revision)&&d.revision>=0&&Number.isSafeInteger(d.canonRevision)&&d.canonRevision>=0,'修订号无效')
 check(typeof d.title==='string'&&typeof d.workspaceId==='string'&&Number.isFinite(d.createdAt)&&Number.isFinite(d.updatedAt),'作品元信息无效')
 if(d.materials!==undefined){check(Array.isArray(d.materials)&&d.materials.length<=100,'材料数据无效');const ids=new Set();for(const m of d.materials){identity(m.id);check(!ids.has(m.id),'材料标识重复');ids.add(m.id);text(m.name,255);text(m.originalText);check(typeof m.text==='string'&&m.text.length<=MAX_TEXT&&typeof m.enabled==='boolean','材料内容无效')}}
 check(Array.isArray(d.groups)&&d.groups.length<=2000,'段落数据无效')
 const seen=new Set();for(const g of d.groups){identity(g.id);check(!seen.has(g.id),'重复段落');seen.add(g.id);text(g.prompt);check(Array.isArray(g.candidates)&&g.candidates.length<=2000,'候选无效');const ids=new Set();for(const c of g.candidates){identity(c.id);check(!ids.has(c.id),'重复版本');ids.add(c.id);text(c.text)}check(g.selectedId===null||ids.has(g.selectedId),'采用版本缺失');check(typeof g.dismissed==='boolean','段落状态无效')}
 check(typeof d.writing?.enabled==='boolean'&&['longTerm','progress'].every(k=>typeof d.writing[k]==='string'&&d.writing[k].length<=16000),'设定数据无效')
 check(Array.isArray(d.summary?.drafts)&&d.summary.drafts.length<=2000,'摘要无效');for(const s of d.summary.drafts){identity(s.id);text(s.text,16000);check(Array.isArray(s.sources),'摘要来源无效')}
 check(d.summary.activeId===null||d.summary.drafts.some(s=>s.id===d.summary.activeId),'启用摘要缺失')
 check(Array.isArray(d.jobs)&&Array.isArray(d.receipts),'请求记录无效');const jobs=new Set();for(const j of d.jobs){identity(j.id);check(!jobs.has(j.id),'任务重复');jobs.add(j.id);check(['queued','running','stopping','completed','failed','interrupted','cancelled'].includes(j.status),'任务状态无效');check(typeof j.fingerprint==='string'&&typeof j.messageId==='string','任务身份缺失')}
 const requests=new Set();for(const r of d.receipts){identity(r.id);check(!requests.has(r.id)&&typeof r.fingerprint==='string','请求回执重复或损坏');requests.add(r.id)}
 return d
}
export const adopted=g=>g.candidates.find(c=>c.id===g.selectedId)
export const canon=d=>d.groups.filter(g=>adopted(g)).map(g=>({id:g.id,text:adopted(g).text,hash:hash(adopted(g).text)}))
export function summaryValid(d,s){return !!s&&!s.unverified&&s.sources.every((x,i)=>canon(d)[i]?.id===x.id&&canon(d)[i]?.hash===x.hash)}
export const activeJob=d=>d.jobs.find(j=>['queued','running','stopping'].includes(j.status))
export function groupOf(d,id){const g=d.groups.find(g=>g.id===id);check(g,'找不到这组选稿');return g}
export function mutateDocument(old,b){
 identity(b.requestId);const fingerprint=hash(b),previous=old.receipts.find(r=>r.id===b.requestId)
 if(previous){check(previous.fingerprint===fingerprint,'相同请求标识对应不同内容');return old}
 check(b.expectedRevision===old.revision,'稿件已变化，请刷新后再操作；编辑文字仍保留')
 check(!activeJob(old),'请先等待或停止当前写作任务')
 const d=clone(old);let g,c
 switch(b.action){
 case 'writing':if(Object.hasOwn(b,'title'))d.title=text(b.title,100);for(const k of ['enabled','longTerm','progress'])if(Object.hasOwn(b,k))d.writing[k]=b[k];break
 case 'materialToggle':{const m=(d.materials??[]).find(m=>m.id===b.materialId);check(m,'材料不存在');check(typeof b.enabled==='boolean','材料状态无效');m.enabled=b.enabled;break}
 case 'title':d.title=text(b.title,100);break
 case 'select':g=groupOf(d,b.groupId);c=g.candidates.find(c=>c.id===b.candidateId);check(c,'候选不存在');g.selectedId=c.id;g.dismissed=false;d.canonRevision++;break
 case 'dismiss':g=groupOf(d,b.groupId);check(g.selectedId===null,'已有采用结果，请改选其他版本');g.dismissed=true;break
 case 'edit':g=groupOf(d,b.groupId);check(g.candidates.some(c=>c.id===b.baseId),'底稿不存在');c={id:randomUUID(),text:text(b.text),origin:'manual',baseId:b.baseId,createdAt:Date.now(),requestId:b.requestId};g.candidates.push(c);if(b.adopt===true){g.selectedId=c.id;g.dismissed=false;d.canonRevision++}break
 case 'summarySave':d.summary.drafts.push({id:randomUUID(),text:text(b.text,16000),sources:canon(d).map(({id,hash})=>({id,hash})),createdAt:Date.now(),origin:'manual'});break
 case 'summaryApply':{const s=d.summary.drafts.find(s=>s.id===b.summaryId);check(summaryValid(d,s),'摘要来源已过期，请重新生成或核对后另存摘要');d.summary.activeId=s.id;break}
 case 'summaryDisable':d.summary.activeId=null;break
 default:throw Error('不支持的操作')
 }
 d.revision++;d.updatedAt=Date.now();d.receipts.push({id:b.requestId,fingerprint,revision:d.revision});return validateDocument(d)
}
export function classify(value,mode='auto'){
 text(value);if(['discuss','continue','import'].includes(mode))return mode
 if(value.length>300&&/[。！？\n]/.test(value)&&!/^\s*(请|帮|写|续写|继续)/.test(value))return 'confirm-import'
 const continuation=/^(请|帮我|麻烦)?\s*(续写|接着写|继续写|往下写|写下一段|下一段|写一段|写一个|写雨夜)/.test(value.trim())
 const discussion=/设定|人设|世界观|分析|讨论|会不会|为什么|合理吗|怎么样|怎么理解|你觉得/.test(value)
 if(continuation&&!discussion)return 'continue';if(discussion&&!continuation)return 'discuss';return 'ask'
}
export function contextFor(d,op,discussion=''){
 const all=canon(d),group=op.groupId?groupOf(d,op.groupId):null
 let preceding=group?all.filter(x=>d.groups.findIndex(g=>g.id===x.id)<d.groups.findIndex(g=>g.id===group.id)):all
 const s=d.summary.drafts.find(s=>s.id===d.summary.activeId),use=summaryValid(d,s)&&s.sources.length>0&&s.sources.every(x=>preceding.some(p=>p.id===x.id&&p.hash===x.hash))
 const included=use?preceding.filter(p=>!s.sources.some(x=>x.id===p.id)):preceding
 const base=group?.candidates.find(c=>c.id===op.baseId)
 if(['revise','partial'].includes(op.kind))check(base,'修改底稿不存在')
 let instruction=op.text||group?.prompt||''
 if(op.kind==='partial'){const range=partialRange(base.text,op.from,op.to);instruction=`只输出以下片段的替换正文，不输出全篇。\n【完整底稿】\n${base.text}\n【仅替换片段】\n${base.text.slice(range.start,range.end)}\n【修改要求】\n${op.text}`}
 else if(base)instruction=`【本段原要求】\n${group.prompt}\n【本次底稿，仅一次】\n${base.text}\n【本次要求】\n${op.text||'重新创作不同表达的一版'}\n只输出本版完整正文。`
 if(op.kind==='discuss')instruction=`只讨论人物、设定或情节，不续写正文，不把建议当作作者已确认事实。\n【作者问题】\n${op.text}`
 if(op.kind==='summary')instruction='只概括上面已采用正文的人物、事件、因果与未解线索，不补写故事；输出可供后续续写的剧情摘要。'
 const references=(op.kind==='summary'?[]:(d.materials??[])).filter(m=>m.enabled&&m.text.trim());
 const prompt=`【参考材料；待定内容不自动成为确定事实】\n${references.map(m=>`文件：${m.name}\n${m.text}`).join('\n\n')||'（无）'}\n【作者确认的长期设定】\n${d.writing.longTerm||'（无）'}\n【当前进度】\n${d.writing.progress||'（无）'}\n${use?`【有效剧情摘要】\n${s.text}\n`:''}【按顺序的已采用前文】\n${included.map(x=>x.text).join('\n\n')||'（无）'}\n【相关聊天，仅作讨论参考，AI建议未经作者确认不构成事实】\n${discussion||'（无）'}\n【本次任务】\n${instruction}`
 // Explicit conservative character guard; never claim an exact token count or truncate canon.
 check(prompt.length<=40000,'上下文超过当前保守上限40000字符；请先整理设定或生成并启用剧情摘要，再重试（这不是精确token预算）')
 return {prompt,manifest:{documentId:d.documentId,sessionId:d.sessionId,revision:d.revision,canonRevision:d.canonRevision,materials:references.map(m=>({id:m.id,hash:hash(m.text)})),canon:preceding.map(({id,hash})=>({id,hash})),summaryId:use?s.id:null,baseId:base?.id??null,promptHash:hash(prompt),characters:prompt.length}}
}
export function queueJob(old,op,message){
 identity(op.requestId);const fingerprint=hash(op),duplicate=old.jobs.find(j=>j.id===op.requestId)
 if(duplicate){check(duplicate.fingerprint===fingerprint,'任务标识冲突');return old}
 check(old.revision===op.expectedRevision,'稿件已变化，请刷新');check(!activeJob(old),'已有任务，请先等待或停止');check(old.writing.enabled,'请先开启写作模式')
 const d=clone(old);if(op.kind==='continue')check(!d.groups.some(g=>!g.selectedId&&!g.dismissed),'请先采用上一段或选择暂不采用')
 if(op.kind==='material'){const m=op.material;check(m&&['reference','import','mixed'].includes(m.purpose),'材料用途无效');text(m.name,255);text(m.text);if(m.purpose==='mixed')check(Number.isSafeInteger(m.start)&&Number.isSafeInteger(m.end)&&m.start>=0&&m.end>m.start&&m.end<=m.text.length,'材料选段无效');if(m.replaceId)check((d.materials??[]).some(v=>v.id===m.replaceId),'材料替换目标不存在');check((d.materials??[]).length<100||m.replaceId,'材料数量超过100份')}
 if(op.kind==='restore')check(!d.groups.length&&!(d.materials??[]).length,'请在新的空对话中恢复；原稿不会被覆盖')
 if(op.kind==='import')check(d.groups.length===0||op.append===true,'已有正文，请明确选择追加，不会自动替换')
 if(['revise','partial','rewrite'].includes(op.kind))groupOf(d,op.groupId)
 d.jobs.push({id:op.requestId,fingerprint,messageId:message.id,operation:op,status:'queued',createdAt:Date.now(),error:null});d.revision++;return validateDocument(d)
}
export function finishJob(old,id,result){
 const d=clone(old),j=d.jobs.find(j=>j.id===id);check(j,'任务不存在');check(['queued','running','stopping'].includes(j.status),'任务已结束');
 if(result.error){j.status=result.cancelled?'cancelled':'failed';j.error=result.error}
 else if(j.status==='stopping'){j.status='cancelled';j.error='停止请求已收敛，未保存为完整候选'}
 else{
  const op=j.operation;let g
  if(op.kind==='material'){
   const m=op.material;d.materials??=[];if(m.purpose==='import'&&m.replaceId){const old=d.materials.find(v=>v.id===m.replaceId);if(old)old.enabled=false;}
   if(m.purpose!=='import'){const ref={id:m.replaceId??randomUUID(),name:m.name,originalText:m.text,text:m.purpose==='mixed'?m.text.slice(0,m.start)+m.text.slice(m.end):m.text,enabled:true,createdAt:Date.now()};const index=d.materials.findIndex(v=>v.id===ref.id);if(index>=0)d.materials[index]=ref;else d.materials.push(ref);j.materialId=ref.id}
   if(m.purpose!=='reference'){const value=m.purpose==='mixed'?m.text.slice(m.start,m.end):m.text;text(value);const c={id:randomUUID(),text:value,origin:'import',createdAt:Date.now(),requestId:id};d.groups.push({id,prompt:'用户确认导入TXT正文',candidates:[c],selectedId:c.id,dismissed:false,jobId:id});d.canonRevision++;j.groupId=id}
  }
  else if(op.kind==='discuss'){j.output=text(result.text)}
  else if(op.kind==='restore'){const imported=parseBackup(op.text)[op.index];check(imported,'恢复作品不存在');d.groups=clone(imported.groups).map(g=>({...g,cardId:id}));d.writing={...imported.writing,enabled:d.writing.enabled};d.summary=clone(imported.summary);d.materials=clone(imported.materials??[]);d.title=imported.title+'（恢复副本）';d.restoredFrom=imported.documentId;d.canonRevision++;j.restored=true}
  else if(op.kind==='summary'){d.summary.drafts.push({id:randomUUID(),text:text(result.text,16000),sources:j.manifest.canon,createdAt:Date.now(),origin:'model'})}
  else{
   if(op.kind==='continue'||op.kind==='import'){g={id:id,prompt:text(op.kind==='import'?'用户确认导入原文':op.text),candidates:[],selectedId:null,dismissed:false,jobId:id};d.groups.push(g)}else g=groupOf(d,op.groupId)
   let output=result.text;if(op.kind==='partial'){const base=g.candidates.find(c=>c.id===op.baseId);check(base,'底稿缺失');output=mergePartial(base.text,partialRange(base.text,op.from,op.to),output)}
   const c={id:randomUUID(),text:text(output),origin:op.kind==='import'?'import':'model',baseId:op.baseId??null,createdAt:Date.now(),requestId:id,usage:result.usage??null};g.candidates.push(c)
   if(op.kind==='import'){g.selectedId=c.id;d.canonRevision++}j.groupId=g.id
  }
  j.status='completed';j.usage=result.usage??null
 }
 j.completedAt=Date.now();d.revision++;d.updatedAt=Date.now();return validateDocument(d)
}
export function packBackup(records){
 const documents=records.map(d=>{check(!activeJob(d),'生成期间不能制作备份，请先等待或停止');return clone(d)})
 const payload={format:'zegao-ios-backup',formatVersion:2,pluginVersion:VERSION,createdAt:new Date().toISOString(),documents}
 const value={...payload,integrity:{algorithm:'SHA-256',digest:hash(payload)}};const result=JSON.stringify(value,null,2);check(Buffer.byteLength(result)<=BACKUP_LIMIT,'备份超过16MiB，请按对话导出');return result
}
export function parseBackup(raw){
 check(typeof raw==='string'&&Buffer.byteLength(raw)<=BACKUP_LIMIT,'备份超过16MiB或格式无效');const value=JSON.parse(raw,(k,v)=>{check(!['__proto__','constructor','prototype'].includes(k),'备份包含非法字段');return v})
 if(value.format==='zegao-backup')return readLegacy(raw).sessions.map(row=>{
  const d=newDocument(randomUUID());d.title='安卓备份恢复副本';d.writing={enabled:false,longTerm:row.data.writing.longTerm,progress:row.data.writing.progress}
  d.groups=row.data.groups.map(g=>({id:randomUUID(),prompt:g.prompt,candidates:g.candidates.map(c=>({id:c.id,text:c.id===g.selectedId?g.selectedText:c.text,origin:c.origin??'legacy',createdAt:Date.now()})),selectedId:g.selectedId,dismissed:g.status==='dismissed'}));d.summary={activeId:null,drafts:row.data.summary.drafts.map(s=>({id:s.id,text:s.text,sources:[],unverified:true,legacySources:s.sources,createdAt:Date.now(),origin:'legacy'}))};d.importedFrom={format:1,sessionId:row.sourceId};return validateDocument(d)
 })
 const {integrity,...payload}=value;check(value.format==='zegao-ios-backup'&&value.formatVersion===2,'不支持的备份格式');check(integrity?.algorithm==='SHA-256'&&hash(payload)===integrity.digest,'备份校验失败，未修改稿件');check(Array.isArray(value.documents)&&value.documents.length>0&&value.documents.length<=2000,'备份范围无效');return value.documents.map(validateDocument)
}
export function restoreDocument(old,b){
 const previous=old.receipts.find(r=>r.id===b.requestId);if(previous){check(previous.fingerprint===hash(b),'恢复请求冲突');return old}
 check(old.revision===b.expectedRevision&&!old.groups.length&&!(old.materials??[]).length&&!activeJob(old),'请在新的空对话中恢复；原稿不会被覆盖')
 const source=parseBackup(b.text)[b.index];check(source,'请选择有效的备份作品');const d=clone(source);d.sessionId=old.sessionId;d.documentId=old.documentId;d.workspaceId=old.workspaceId;d.title=source.title+'（恢复副本）';d.jobs=[];d.receipts=[{id:identity(b.requestId),fingerprint:hash(b),revision:old.revision+1}];d.revision=old.revision+1;d.writing.enabled=false;d.restoredFrom=source.documentId;return validateDocument(d)
}
