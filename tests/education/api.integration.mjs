import assert from 'node:assert/strict';
import fs from 'node:fs';import ts from 'typescript';import {DatabaseSync} from 'node:sqlite';import * as academy from '../../supabase/functions/education-api/academy.mjs';
const sqlite=new DatabaseSync(':memory:');
sqlite.exec(`CREATE TABLE institutions(id TEXT PRIMARY KEY,name TEXT,owner TEXT,data TEXT,revision INTEGER,created TEXT,slug TEXT UNIQUE);
CREATE TABLE memberships(id TEXT PRIMARY KEY,tenant_id TEXT,user_id TEXT,email TEXT,role TEXT,student_id TEXT,name TEXT,UNIQUE(tenant_id,user_id));
CREATE TABLE invitations(id TEXT PRIMARY KEY,tenant_id TEXT,email TEXT,role TEXT,student_id TEXT,expires INTEGER,used_by TEXT,created TEXT);
CREATE TABLE attempts(id TEXT PRIMARY KEY,tenant_id TEXT,user_id TEXT,student_id TEXT,exam_id TEXT,questions TEXT,answers TEXT,expires INTEGER,finished INTEGER,penalty INTEGER,title TEXT);
CREATE UNIQUE INDEX one_active_attempt ON attempts(tenant_id,user_id) WHERE finished=0;
CREATE TABLE media_assets(id TEXT PRIMARY KEY,tenant_id TEXT,kind TEXT,subject_id TEXT,object_key TEXT,mime TEXT,updated TEXT,UNIQUE(tenant_id,kind,subject_id));`);
const d1={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}},async batch(stmts){sqlite.exec('BEGIN');try{const r=[];for(const s of stmts)r.push(await s.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const storedImages=new Map();const bucket={async put(key,bytes){storedImages.set(key,new Uint8Array(bytes))},async get(key){const bytes=storedImages.get(key);return bytes?{body:bytes,base64:Buffer.from(bytes).toString('base64')}:null},async delete(key){storedImages.delete(key)}};
let testUser=null;const exports={};const compiled=ts.transpileModule(fs.readFileSync('supabase/functions/education-api/handler.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','exports',compiled)(name=>name==='./database.ts'?{createDatabase:()=>d1,createBucket:()=>bucket,verifiedUser:async()=>testUser}:academy,exports);


const origin='http://127.0.0.1:4173';
let checks=0;
async function call(path,{user='qa-admin',email=user+'@example.test',body,tenant,status=200}={}){testUser=user&&email?{userId:user,email,displayName:user}:null;const r=await exports.handle(new Request(origin+'/functions/v1/education-api/'+path+(tenant?'?tenant='+tenant:''),{method:body?'POST':'GET',headers:{'oai-authenticated-user-id':user,'oai-authenticated-user-email':email,origin,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));let d;try{d=await r.json()}catch{throw Error(path+': non-JSON '+await r.text())}assert.equal(r.status,status,path+': '+JSON.stringify(d));checks++;return d}
const institution=await call('institutions',{body:{name:'QA Kurum '+Date.now()}}),tenant=institution.tenantId;
let v=await call('state',{tenant});assert.equal(v.membership.role,'admin');
const data=v.db;data.students=[{id:'qa-s1',name:'QA Öğrenci',grade:'8',section:'A',parent:'QA Veli',phone:''}];data.questions=[{id:'qa-q1',grade:'8',subject:'Matematik',text:'2+2?',topic:'İşlemler',options:['1','2','3','4'],correct:3,explanation:'4',difficulty:'Kolay',image:''},{id:'qa-q2',grade:'8',subject:'Matematik',text:'3+2?',topic:'İşlemler',options:['2','3','4','5'],correct:3,explanation:'5',difficulty:'Kolay',image:''}];data.exams=[{id:'qa-e1',title:'QA Sınav',grade:'8',questionIds:['qa-q1','qa-q2'],duration:10,penalty:3}];
v=await call('state',{tenant,body:{db:data,revision:v.revision}});
await call('state',{tenant,body:{db:data,revision:v.revision-1},status:409});
await call('state',{tenant,user:'qa-outsider',status:403});
const inv=await call('invite',{tenant,body:{email:'qa-student@example.test',role:'student',studentId:'qa-s1'}});
await call('claim',{user:'qa-wrong',body:{code:inv.code},status:403});
await call('claim',{user:'qa-student',body:{code:inv.code}});
await call('claim',{user:'qa-student',body:{code:inv.code},status:404});
let sv=await call('state',{tenant,user:'qa-student'});assert.equal(sv.db.questions[0].correct,-1);assert.equal(sv.db.questions[0].explanation,'');
sv.db.results.push({id:'fake',percent:100});await call('state',{tenant,user:'qa-student',body:{db:sv.db,revision:sv.revision},status:403});
const a=await call('attempt',{tenant,user:'qa-student',body:{examId:'qa-e1'}});assert.equal(JSON.parse(a.attempt.questions)[0].correct,-1);
await call('answer',{tenant,user:'qa-student',body:{attemptId:a.attempt.id,questionId:'qa-q1',answer:3}});
await call('answer',{tenant,user:'qa-student',body:{attemptId:a.attempt.id,questionId:'qa-q2',answer:0}});
await call('answer',{tenant,user:'qa-outsider',body:{attemptId:a.attempt.id,questionId:'qa-q2',answer:3},status:403});
sv=await call('state',{tenant,user:'qa-student'});assert.equal(JSON.parse(sv.activeAttempt.answers)['qa-q1'],3);
const finished=await call('finish',{tenant,user:'qa-student',body:{attemptId:a.attempt.id}}),result=finished.db.results[0];assert.equal(result.correct,1);assert.equal(result.wrong,1);assert.ok(Math.abs(result.net-2/3)<.000001);assert.equal(result.snapshot[0].correct,3);
const again=await call('finish',{tenant,user:'qa-student',body:{attemptId:a.attempt.id}});assert.equal(again.db.results.length,1);
const second=await call('institutions',{body:{name:'QA Ayrı Kurum '+Date.now()}});await call('state',{tenant:second.tenantId,user:'qa-student',status:403});
const pinv=await call('invite',{tenant,body:{email:'qa-parent@example.test',role:'parent',studentId:'qa-s1'}});await call('claim',{user:'qa-parent',body:{code:pinv.code}});const pv=await call('state',{tenant,user:'qa-parent'});await call('state',{tenant,user:'qa-parent',body:{db:pv.db,revision:pv.revision},status:403});
const ti=await call('invite',{tenant,body:{email:'qa-teacher@example.test',role:'teacher'}});await call('claim',{user:'qa-teacher',body:{code:ti.code}});const tv=await call('state',{tenant,user:'qa-teacher'});assert.deepEqual(tv.db.payments,[]);tv.db.payments=[{id:'p-fake'}];await call('state',{tenant,user:'qa-teacher',body:{db:tv.db,revision:tv.revision},status:403});
const pending=await call('attempt',{tenant,user:'qa-student',body:{examId:'qa-e1'}});sqlite.prepare('UPDATE attempts SET expires=? WHERE id=?').run(Date.now()-1000,pending.attempt.id);await call('answer',{tenant,user:'qa-student',body:{attemptId:pending.attempt.id,questionId:'qa-q1',answer:3},status:409});const expired=await call('finish',{tenant,user:'qa-student',body:{attemptId:pending.attempt.id}});assert.equal(expired.db.results.at(-1).blank,2);
const members=await call('members',{tenant});const sm=members.members.find(m=>m.user_id==='qa-student');await call('revoke',{tenant,body:{kind:'member',id:sm.id}});await call('state',{tenant,user:'qa-student',status:403});
await call('account',{user:'',email:'',status:401});
// Draft access and atomic record + invitation checks.
let current=await call('state',{tenant});
current.db.exams.push({id:'qa-draft',title:'Yarım sınav',grade:'8',questionIds:[],duration:5,penalty:0,status:'draft'});
current=await call('state',{tenant,body:{db:current.db,revision:current.revision}});
const reinvite=await call('invite',{tenant,body:{email:'qa-student@example.test',role:'student',studentId:'qa-s1'}});await call('claim',{user:'qa-student',body:{code:reinvite.code}});
const hidden=await call('state',{tenant,user:'qa-student'});assert.ok(!hidden.db.exams.some(e=>e.id==='qa-draft'));
await call('attempt',{tenant,user:'qa-student',body:{examId:'qa-draft'},status:403});
current.db.students.push({id:'qa-s2',name:'Davetli Öğrenci',grade:'8',section:'A',parent:'',phone:'',email:'new-student@example.test'});
const combined=await call('state',{tenant,body:{db:current.db,revision:current.revision,invite:{email:'new-student@example.test',role:'student',studentId:'qa-s2'}}});assert.equal(combined.invite.email,'new-student@example.test');assert.ok(combined.db.students.some(s=>s.id==='qa-s2'));
await call('claim',{user:'new-student',body:{code:combined.invite.code}});assert.equal((await call('state',{tenant,user:'new-student'})).membership.studentId,'qa-s2');
const bad=structuredClone(combined.db);bad.students.push({id:'not-saved',name:'Kaydedilmemeli',grade:'8',section:'A',parent:'',phone:''});
await call('state',{tenant,body:{db:bad,revision:combined.revision,invite:{email:'bad',role:'student',studentId:'not-saved'}},status:400});
assert.ok(!(await call('state',{tenant})).db.students.some(s=>s.id==='not-saved'));
const teacherState=await call('state',{tenant,user:'qa-teacher'});await call('state',{tenant,user:'qa-teacher',body:{db:teacherState.db,revision:teacherState.revision,invite:{email:'other@example.test',role:'teacher'}},status:403});
await call('state',{tenant,body:{db:combined.db,revision:combined.revision-1,invite:{email:'stale@example.test',role:'teacher'}},status:409});assert.ok(!(await call('members',{tenant})).invitations.some(i=>i.email==='stale@example.test'));

// Media authorization, object replacement and role-specific PWA manifests.
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
const logo=await call('media',{tenant,body:{kind:'logo',data:image}});assert.ok(logo.media.logo.startsWith('data:image/png;base64,'));assert.equal(storedImages.size,1);
let mediaState=await call('state',{tenant});assert.equal(mediaState.media.logo,logo.media.logo);const originalRevision=mediaState.revision;
const updatedLogo=await call('media',{tenant,body:{kind:'logo',data:image}});assert.equal(storedImages.size,1);assert.equal((await call('state',{tenant})).revision,originalRevision);
await call('media',{tenant,user:'qa-student',body:{kind:'logo',data:image},status:403});await call('media',{tenant,user:'qa-parent',body:{kind:'photo',data:image},status:403});
await call('media',{tenant,user:'qa-teacher',body:{kind:'logo',data:image},status:403});await call('media',{tenant,body:{kind:'photo',data:image},status:403});
await call('media',{tenant,user:'qa-outsider',body:{kind:'logo',data:image},status:403});await call('media',{tenant,body:{kind:'logo',data:'data:image/png;base64,'+Buffer.from('not an image'.repeat(5)).toString('base64')},status:400});
const photo=await call('media',{tenant,user:'qa-teacher',body:{kind:'photo',data:image,subjectId:'forged-target'}});assert.ok(photo.media.profilePhoto);assert.equal(storedImages.size,2);const ownMember=sqlite.prepare('SELECT id FROM memberships WHERE tenant_id=? AND user_id=?').get(tenant,'qa-teacher');assert.equal(sqlite.prepare("SELECT subject_id FROM media_assets WHERE tenant_id=? AND kind='photo'").get(tenant).subject_id,ownMember.id);
mediaState=await call('state',{tenant});assert.equal(mediaState.media.teachers['qa-teacher@example.test'],photo.media.profilePhoto);const studentMedia=await call('state',{tenant,user:'qa-student'});assert.deepEqual(studentMedia.media.teachers,{});assert.equal(studentMedia.media.profilePhoto,'');
for(const [user,role] of [['qa-admin','admin'],['qa-teacher','teacher'],['qa-student','student'],['qa-parent','parent']]){const slug=sqlite.prepare('SELECT slug FROM institutions WHERE id=?').get(tenant).slug;const r=await exports.handle(new Request(origin+'/functions/v1/education-api/manifest?slug='+slug+'&giris='+role));assert.equal(r.status,200);const manifest=await r.json();assert.ok(manifest.start_url.startsWith('https://ftmotion.com/'+slug));assert.ok(manifest.start_url.includes('giris='+role));assert.equal(manifest.display,'standalone');checks++;}
const asset=sqlite.prepare("SELECT id FROM media_assets WHERE tenant_id=? AND kind='logo'").get(tenant);
testUser={userId:'qa-student',email:'qa-student@example.test',displayName:'Student'};const mediaResponse=await exports.handle(new Request(origin+'/functions/v1/education-api/media?tenant='+tenant+'&id='+asset.id));assert.equal(mediaResponse.status,200);assert.equal(mediaResponse.headers.get('Content-Type'),'image/png');assert.match(mediaResponse.headers.get('Cache-Control'),/no-store/);assert.ok((await mediaResponse.arrayBuffer()).byteLength>24);checks++;
testUser={userId:'qa-outsider',email:'qa-outsider@example.test',displayName:'Outsider'};assert.equal((await exports.handle(new Request(origin+'/functions/v1/education-api/media?tenant='+tenant+'&id='+asset.id))).status,403);checks++;
await call('media',{tenant,user:'qa-teacher',body:{kind:'photo',remove:true}});assert.equal(storedImages.size,1);assert.equal((await call('state',{tenant,user:'qa-teacher'})).media.profilePhoto,'');
console.log(`${checks} API kontrolü geçti: kurum ayrımı, davet, yetki, cevap kaydı, sunucuda değerlendirme, tekrar tamamlama.`);
