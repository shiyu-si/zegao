import { createHash } from 'node:crypto'
import { validateGroup, reduceState, RECORD, SELECTION } from './core.js'
import { defaultWriting, reduceWriting, validateWriting } from './writing.js'
import { emptySummary, reduceSummary, validateSummary } from './summary.js'
export const BACKUP_LIMIT=16*1024*1024
export const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v)
export const checksum=v=>createHash('sha256').update(canonical(v)).digest('hex')
const clone=v=>JSON.parse(JSON.stringify(v))
export function backupState(events){let g={groups:{}},w=defaultWriting(),s=emptySummary();for(const e of events){g=reduceState(g,e);w=reduceWriting(w,e);s=reduceSummary(s,e)}return {groups:Object.values(g.groups).sort((a,b)=>a.anchorSeq-b.anchorSeq).map(group=>{const {contextHistory,...safe}=group;return safe}),writing:w,summary:s}}
export function validateBackupState(data){
 if(!data||!Array.isArray(data.groups)||data.groups.length>2000)throw Error('备份组选稿无效')
 const ids=new Set();for(const g of data.groups){validateGroup(g);if(ids.has(g.id)||g.pending||g.status==='generating')throw Error('备份含重复或未结束选稿');ids.add(g.id)}
 validateWriting(data.writing);validateSummary(data.summary);if(data.summary.pending)throw Error('请先结束摘要生成再备份')
 for(const d of data.summary.drafts)for(const s of [...d.sources,...d.confirmedSources??[]])if(!ids.has(s.groupId)||!(/^[a-f0-9]{64}$/.test(s.hash??'')))throw Error('摘要来源不完整')
 return data
}
export function packBackup(sessions,scope='conversation'){
 const payload={format:'zegao-backup',formatVersion:1,pluginVersion:'0.0.8',createdAt:new Date().toISOString(),scope,sessions:sessions.map(s=>({sourceId:String(s.id),data:validateBackupState(backupState(s.events))}))}
 const value={...payload,integrity:{algorithm:'SHA-256',digest:checksum(payload)}},text=JSON.stringify(value,null,2);if(Buffer.byteLength(text)>BACKUP_LIMIT)throw Error('备份超过16MiB，请逐个对话备份');return{text,value}
}
export function readBackup(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>BACKUP_LIMIT)throw Error('备份过大或格式无效')
 const v=JSON.parse(text,(k,x)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('备份字段无效');return x})
 if(v?.format!=='zegao-backup'||v.formatVersion!==1)throw Error('不支持该备份格式；HTML示例备份不能用于正式恢复')
 const {integrity,...payload}=v;if(integrity?.algorithm!=='SHA-256'||checksum(payload)!==integrity.digest)throw Error('备份内容校验失败，原稿未修改')
 if(!['conversation','profile'].includes(v.scope)||!Array.isArray(v.sessions)||!v.sessions.length||v.sessions.length>2000)throw Error('备份范围无效')
 const ids=new Set();for(const row of v.sessions){if(typeof row.sourceId!=='string'||ids.has(row.sourceId))throw Error('备份对话标识重复');ids.add(row.sourceId);validateBackupState(row.data)}return clone(v)
}
