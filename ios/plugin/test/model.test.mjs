import test from 'node:test'
import assert from 'node:assert/strict'
import {newDocument,mutateDocument,queueJob,finishJob,contextFor,canon,packBackup,parseBackup,hash,clone,validateDocument} from '../src/model.js'
import {classifyInput} from '../src/intent.js'
const request=(d,body)=>({...body,expectedRevision:d.revision,requestId:crypto.randomUUID()})
function enabled(){let d=newDocument('session-A');return mutateDocument(d,request(d,{action:'writing',enabled:true}))}
function add(d,value,adopt=true){const id=crypto.randomUUID(),op=request(d,{kind:'continue',text:'写一段'});d=queueJob(d,op,{id:'msg-'+id});d=clone(d);d.jobs.at(-1).status='running';d.jobs.at(-1).manifest=contextFor(d,op).manifest;d=finishJob(d,op.requestId,{text:value});if(adopt)d=mutateDocument(d,request(d,{action:'select',groupId:d.groups.at(-1).id,candidateId:d.groups.at(-1).candidates[0].id}));return d}
test('manual save-and-adopt is one immutable revision; stale and duplicate requests are safe',()=>{
 let d=add(enabled(),'第一版中文\n换行'),before=clone(d),g=d.groups[0];const op=request(d,{action:'edit',groupId:g.id,baseId:g.selectedId,text:'手工版本\n不覆盖旧版',adopt:true});d=mutateDocument(d,op)
 assert.equal(d.revision,before.revision+1);assert.equal(d.groups[0].candidates[0].text,'第一版中文\n换行');assert.equal(canon(d)[0].text,op.text);assert.deepEqual(mutateDocument(d,op),d);assert.throws(()=>mutateDocument(d,{...op,text:'冲突'}));assert.throws(()=>mutateDocument(d,{...op,requestId:crypto.randomUUID()}));assert.equal(before.groups[0].candidates.length,1)
})
test('context includes latest adoptions once; excludes alternatives, current group and future groups on rewrite',()=>{
 let d=add(enabled(),'CANON-ONE');d=add(d,'CANON-TWO');const g=d.groups[0];d=mutateDocument(d,request(d,{action:'edit',groupId:g.id,baseId:g.selectedId,text:'UNADOPTED',adopt:false}));let c=contextFor(d,{kind:'continue',text:'下一段'});assert.equal(c.prompt.split('CANON-ONE').length-1,1);assert(!c.prompt.includes('UNADOPTED'))
 c=contextFor(d,{kind:'revise',groupId:g.id,baseId:g.selectedId,text:'修改当前段'});assert.equal(c.prompt.split('CANON-ONE').length-1,1);assert(!c.prompt.includes('CANON-TWO'))
})
test('summary becomes stale on canon edit; no silent truncation',()=>{
 let d=add(enabled(),'正文');d=mutateDocument(d,request(d,{action:'summarySave',text:'摘要内容'}));d=mutateDocument(d,request(d,{action:'summaryApply',summaryId:d.summary.drafts[0].id}));assert(contextFor(d,{kind:'continue',text:'续写'}).manifest.summaryId)
 const g=d.groups[0];d=mutateDocument(d,request(d,{action:'edit',groupId:g.id,baseId:g.selectedId,text:'新正文',adopt:true}));assert.equal(contextFor(d,{kind:'continue',text:'续写'}).manifest.summaryId,null)
 d.groups[0].candidates.at(-1).text='文'.repeat(41000);assert.throws(()=>contextFor(d,{kind:'continue',text:'下一段'}),/40000/)
})
test('job deduplication, cancellation, partial merge and no automatic adoption',()=>{
 let d=add(enabled(),'首段不变\n\n中段需改\n\n末段不变'),g=d.groups[0];const op=request(d,{kind:'partial',groupId:g.id,baseId:g.selectedId,from:1,to:1,text:'改中段'});d=queueJob(d,op,{id:'message-id'});assert.deepEqual(queueJob(d,op,{id:'other'}),d);assert.throws(()=>queueJob(d,{...op,text:'另一个要求'},{id:'other'}));d=clone(d);d.jobs.at(-1).status='running';d=finishJob(d,op.requestId,{text:'只改中段'});assert.equal(d.groups[0].candidates.at(-1).text,'首段不变\n\n只改中段\n\n末段不变');assert.equal(canon(d)[0].text,'首段不变\n\n中段需改\n\n末段不变')
})
test('backup round trip, tamper refusal, restore isolation and validation',()=>{
 const a=add(enabled(),'A稿件'),b=add({...enabled(),sessionId:'session-B'},'B稿件');const raw=packBackup([a,b]),v=parseBackup(raw);assert.equal(v[0].sessionId,'session-A');assert.equal(v[1].groups[0].candidates[0].text,'B稿件');assert.throws(()=>parseBackup(raw.replace('A稿件','被篡改')))
 let d=enabled();const op=request(d,{kind:'restore',text:raw,index:1});d=queueJob(d,op,{id:'restore-message'});d=clone(d);d.jobs.at(-1).status='running';d=finishJob(d,op.requestId,{text:raw});assert.equal(d.sessionId,'session-A');assert.equal(canon(d)[0].text,'B稿件');assert.equal(canon(a)[0].text,'A稿件');assert.throws(()=>validateDocument({...d,schema:2}));assert.equal(hash(JSON.parse(raw).documents),hash([a,b]))
})
test('discussion, explicit intention and ambiguous import are separated without a paid classifier',()=>{
 assert.equal(classifyInput('讨论一下人物设定'),'discuss');assert.equal(classifyInput('接着写下一段'),'continue');assert.equal(classifyInput('好'),'ask');assert.equal(classifyInput('好','continue'),'continue');assert.equal(classifyInput('雨夜。'.repeat(150)),'import');assert.equal(classifyInput('续写，但你觉得人设合理吗'),'ask')
})
