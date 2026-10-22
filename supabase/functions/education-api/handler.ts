import { createDatabase, createBucket, verifiedUser, rpc } from './database.ts';
import { AppError, must, blankData, scopedData, mergeState, gradeAttempt, decodeProfileImage } from './academy.mjs';
const now=()=>new Date().toISOString(),uid=()=>crypto.randomUUID();
const json=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Vary':'Cookie'}});
async function body(req:Request){const text=await req.text();must(text.length<4_000_000,'İstek çok büyük.',413);try{return JSON.parse(text)}catch{throw new AppError('Geçersiz JSON.')}}
export async function handle(req:Request){try{
 const url=new URL(req.url),route=url.pathname.split('/education-api/')[1]||'',method=req.method;
 const db=createDatabase();
 if(route==='manifest'&&method==='GET'){
  const slug=url.searchParams.get('slug')||'';
  must(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=100,'Adres geçersiz.');
  const row=await db.prepare('SELECT id,name,slug FROM institutions WHERE slug=?').bind(slug).first();must(row,'Kurum bulunamadı.',404);
  const role=url.searchParams.get('giris')||'admin',titles:any={admin:'Yönetim',teacher:'Öğretmen',student:'Öğrenci',parent:'Veli'};must(titles[role],'Giriş türü geçersiz.');
  return Response.json({id:'https://ftmotion.com/'+row.slug+'?uygulama='+role,name:row.name+' · '+titles[role],short_name:row.name.slice(0,24),lang:'tr',start_url:'https://ftmotion.com/'+row.slug+'?giris='+role,scope:'https://ftmotion.com/',display:'standalone',background_color:'#f6f7f2',theme_color:'#233a2d',icons:[{src:'https://ftmotion.com/egitim-uygulama/icons/academy-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'https://ftmotion.com/egitim-uygulama/icons/academy-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]},{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-store'}});
 }
 if(route==='resolve'&&method==='GET'){
  const slug=url.searchParams.get('slug')||'';
  must(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)&&slug.length<=100,'Adres geçersiz.');
  const row=await db.prepare('SELECT id,name,slug FROM institutions WHERE slug=?').bind(slug).first();
  must(row,'Kurum bulunamadı.',404);return json(row);
 }

 const u=await verifiedUser(req);must(u,'Devam etmek için hesabınızla giriş yapın.',401);const user=u!;

 const input=method==='GET'?{}:await body(req);
 if(route==='account'&&method==='GET'){
  const rows=await db.prepare('SELECT m.tenant_id,m.role,m.student_id,i.name,i.slug FROM memberships m JOIN institutions i ON i.id=m.tenant_id WHERE m.user_id=? ORDER BY i.created').bind(user.userId).all();
  return json({user:{name:user.displayName,email:user.email},institutions:rows.results});
 }
 if(route==='institutions'&&method==='POST'){
  must(typeof input.name==='string'&&input.name.trim().length>=2&&input.name.trim().length<=80,'Kurum adı 2–80 karakter olmalı.');
  const count:any=await db.prepare('SELECT COUNT(*) AS n FROM institutions WHERE owner=?').bind(user.userId).first();must(count.n<5,'Hesap başına en fazla 5 kurum oluşturulabilir.');
  const id=uid(),data=blankData(input.name.trim());
  let slug=slugify(data.institution);
  if(RESERVED.includes(slug)||await db.prepare('SELECT id FROM institutions WHERE slug=?').bind(slug).first())slug+='-'+id.slice(0,8);await db.batch([db.prepare('INSERT INTO institutions(id,name,owner,data,revision,created,slug) VALUES(?,?,?,?,0,?,?)').bind(id,data.institution,user.userId,JSON.stringify(data),now(),slug),db.prepare('INSERT INTO memberships(id,tenant_id,user_id,email,role,student_id,name) VALUES(?,?,?,?,?,NULL,?)').bind(uid(),id,user.userId,user.email.toLowerCase(),'admin',user.displayName)]);return json({tenantId:id,slug});
 }
 if(route==='claim'&&method==='POST'){
  must(typeof input.code==='string'&&/^[a-f0-9]{64}$/.test(input.code),'Davet kodu geçersiz.');const hash=await hashToken(input.code);const invite:any=await db.prepare('SELECT * FROM invitations WHERE id=? AND used_by IS NULL AND expires>?').bind(hash,Date.now()).first();must(invite,'Davet geçersiz, kullanılmış veya süresi dolmuş.',404);must(invite.email===user.email.toLowerCase(),'Bu davet farklı bir e-posta adresine ait.',403);
  const already:any=await db.prepare('SELECT id FROM memberships WHERE tenant_id=? AND user_id=?').bind(invite.tenant_id,user.userId).first();must(!already,'Bu kurumda zaten üyeliğiniz var.',409);
  const res=await db.batch([db.prepare('INSERT INTO memberships(id,tenant_id,user_id,email,role,student_id,name) SELECT ?,tenant_id,?,email,role,student_id,? FROM invitations WHERE id=? AND used_by IS NULL AND expires>?').bind(uid(),user.userId,user.displayName,hash,Date.now()),db.prepare('UPDATE invitations SET used_by=? WHERE id=? AND used_by IS NULL').bind(user.userId,hash)]);must(res[0].meta.changes===1,'Davet kullanılamadı.',409);return json({tenantId:invite.tenant_id});
 }
 const tenantId=url.searchParams.get('tenant')||input.tenantId;must(typeof tenantId==='string'&&tenantId.length<100,'Kurum seçin.');
 const m:any=await db.prepare('SELECT * FROM memberships WHERE tenant_id=? AND user_id=?').bind(tenantId,user.userId).first();must(m,'Bu kuruma erişiminiz yok.',403);m.studentId=m.student_id;
 const tenant:any=await db.prepare('SELECT * FROM institutions WHERE id=?').bind(tenantId).first();must(tenant,'Kurum bulunamadı.',404);let state=JSON.parse(tenant.data);
 const getMedia=async()=>{
  const rows:any=await db.prepare('SELECT a.id,a.kind,a.subject_id,a.updated,a.object_key,a.mime,m.email FROM media_assets a LEFT JOIN memberships m ON m.id=a.subject_id AND m.tenant_id=a.tenant_id WHERE a.tenant_id=?').bind(tenantId).all();
  for(const a of rows.results as any[]){const file=await createBucket().get(a.object_key);a.image=file?'data:'+a.mime+';base64,'+file.base64:''}
  const logo=rows.results.find((a:any)=>a.kind==='logo'),own=rows.results.find((a:any)=>a.kind==='photo'&&a.subject_id===m.id);
  return {logo:logo?.image||'',profilePhoto:own?.image||'',teachers:['admin','teacher'].includes(m.role)?Object.fromEntries(rows.results.filter((a:any)=>a.kind==='photo'&&a.email).map((a:any)=>[a.email,a.image])):{}};
 };
 if(route==='media'&&method==='GET'){
  const asset:any=await db.prepare('SELECT * FROM media_assets WHERE id=? AND tenant_id=?').bind(url.searchParams.get('id')||'',tenantId).first();must(asset,'Görsel bulunamadı.',404);
  const bucket=createBucket();must(bucket,'Dosya alanı henüz hazır değil.',503);const file=await bucket.get(asset.object_key);must(file,'Görsel bulunamadı.',404);
  return new Response(file.body,{headers:{'Content-Type':asset.mime,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'",'Vary':'Cookie'}});
 }
 if(route==='media'&&method==='POST'){
  must(input.kind==='logo'||input.kind==='photo','Görsel türü geçersiz.');must(input.kind==='logo'?m.role==='admin':m.role==='teacher',input.kind==='logo'?'Logoyu yalnızca kurum yöneticisi değiştirebilir.':'Fotoğrafı öğretmen hesabından yükleyin.',403);
  const bucket=createBucket();must(bucket,'Dosya alanı henüz hazır değil.',503);const subject=input.kind==='logo'?tenantId:m.id;
  const previous:any=await db.prepare('SELECT * FROM media_assets WHERE tenant_id=? AND kind=? AND subject_id=?').bind(tenantId,input.kind,subject).first();
  if(input.remove){if(previous){const removed=await db.prepare('DELETE FROM media_assets WHERE id=? AND object_key=?').bind(previous.id,previous.object_key).run();must(removed.meta.changes===1,'Görsel başka bir oturumda değişti. Yenileyin.',409);await bucket.delete(previous.object_key)}return json({media:await getMedia()})}
  const image=decodeProfileImage(input.data),id=previous?.id||uid(),key='institutions/'+tenantId+'/'+input.kind+'/'+uid(),updated=uid();
  await bucket.put(key,image.bytes,{httpMetadata:{contentType:image.mime}});
  try{if(previous){const changed=await db.prepare('UPDATE media_assets SET object_key=?,mime=?,updated=? WHERE id=? AND object_key=?').bind(key,image.mime,updated,id,previous.object_key).run();must(changed.meta.changes===1,'Görsel başka bir oturumda değişti. Yenileyin.',409)}else await db.prepare('INSERT INTO media_assets(id,tenant_id,kind,subject_id,object_key,mime,updated) VALUES(?,?,?,?,?,?,?)').bind(id,tenantId,input.kind,subject,key,image.mime,updated).run()}catch(error){await bucket.delete(key);throw error}
  if(previous)await bucket.delete(previous.object_key);return json({media:await getMedia()});
 }
 if(route==='manifest'&&method==='GET'){
  const titles:any={admin:'Yönetim',teacher:'Öğretmen',student:'Öğrenci',parent:'Veli'};
  const manifest={id:'/?app='+encodeURIComponent(tenantId+'-'+m.role),name:state.institution+' · '+titles[m.role],short_name:state.institution.slice(0,24),lang:'tr',description:'Kurumunuzun '+titles[m.role].toLocaleLowerCase('tr')+' paneli',start_url:'/?tenant='+encodeURIComponent(tenantId)+'&giris='+m.role,scope:'/',display:'standalone',background_color:'#f6f7f2',theme_color:'#233a2d',icons:[{src:'/icons/academy-192.png',sizes:'192x192',type:'image/png',purpose:'any'},{src:'/icons/academy-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}]};
  return new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/manifest+json','Cache-Control':'no-store, private','Vary':'Cookie','X-Content-Type-Options':'nosniff'}});
 }
 const getState=async()=>{const attempt=m.role==='student'?await db.prepare('SELECT * FROM attempts WHERE tenant_id=? AND user_id=? AND finished=0 ORDER BY expires DESC LIMIT 1').bind(tenantId,user.userId).first():null;return {slug:tenant.slug,media:await getMedia(),db:scopedData(state,m),revision:tenant.revision,membership:{role:m.role,studentId:m.student_id},user:{name:user.displayName,email:user.email},activeAttempt:attempt?publicAttempt(attempt):null}};
 if(route==='state'&&method==='GET')return json(await getState());
 if(route==='state'&&method==='POST'){
  must(input.revision===tenant.revision,'Başka bir oturum kayıtları güncelledi. Yenileyip tekrar deneyin.',409);const next=mergeState(state,input.db,m);
  let invitation:any=null;if(input.invite){must(m.role==='admin','Yalnızca yönetici davet oluşturabilir.',403);invitation=await prepareInvitation(db,tenantId,next,input.invite)}
  const update=db.prepare('UPDATE institutions SET data=?,name=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(next),next.institution,tenantId,tenant.revision);
  const operations=[update];if(invitation)operations.push(db.prepare('INSERT INTO invitations(id,tenant_id,email,role,student_id,expires,used_by,created) SELECT ?,?,?,?,?,?,NULL,? WHERE changes()=1').bind(invitation.hash,tenantId,invitation.email,invitation.role,invitation.studentId,invitation.expires,now()));
  const saved=await db.batch(operations);must(saved[0].meta.changes===1,'Kayıt değişti. Güncel veriyi yükleyin.',409);return json({db:scopedData(next,m),revision:tenant.revision+1,invite:invitation?{code:invitation.code,expires:invitation.expires,email:invitation.email,role:invitation.role}:null});
 }
 if(route==='members'&&method==='GET'){
  must(m.role==='admin','Bu bölüm yöneticiye açık.',403);const members=await db.prepare('SELECT id,user_id,email,role,student_id,name FROM memberships WHERE tenant_id=?').bind(tenantId).all();const invites=await db.prepare('SELECT id,email,role,student_id,expires FROM invitations WHERE tenant_id=? AND used_by IS NULL AND expires>?').bind(tenantId,Date.now()).all();return json({members:members.results,invitations:invites.results,ownerId:tenant.owner});
 }
 if(route==='invite'&&method==='POST'){
  must(m.role==='admin','Yalnızca yönetici davet oluşturabilir.',403);must(typeof input.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)&&input.email.length<=254,'E-posta adresi geçersiz.');must(['teacher','student','parent'].includes(input.role),'Davet rolü geçersiz.');
  const studentId=['student','parent'].includes(input.role)?input.studentId:null;must(!studentId||state.students.some((s:any)=>s.id===studentId),'Öğrenci bulunamadı.');must(!['student','parent'].includes(input.role)||studentId,'Öğrenci bağlantısı seçin.');
  const email=input.email.trim().toLowerCase(),existing=await db.prepare('SELECT id FROM memberships WHERE tenant_id=? AND email=?').bind(tenantId,email).first();must(!existing,'Bu e-posta zaten kurum üyesi.',409);
  const count:any=await db.prepare('SELECT COUNT(*) AS n FROM invitations WHERE tenant_id=? AND used_by IS NULL AND expires>?').bind(tenantId,Date.now()).first();must(count.n<200,'Bekleyen davet sınırına ulaşıldı.');
  const code=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join(''),hash=await hashToken(code);const expires=Date.now()+7*86400000;
  await db.prepare('INSERT INTO invitations(id,tenant_id,email,role,student_id,expires,used_by,created) VALUES(?,?,?,?,?,?,NULL,?)').bind(hash,tenantId,email,input.role,studentId,expires,now()).run();return json({code,expires});
 }
 if(route==='revoke'&&method==='POST'){
  must(m.role==='admin','Yalnızca yönetici erişim kaldırabilir.',403);must(input.kind==='member'||input.kind==='invite','İşlem türü geçersiz.');
  if(input.kind==='member'){const target:any=await db.prepare('SELECT * FROM memberships WHERE tenant_id=? AND id=?').bind(tenantId,input.id).first();must(target,'Üye bulunamadı.',404);must(target.user_id!==tenant.owner,'Kurum sahibinin erişimi kaldırılamaz.',403);await db.prepare('DELETE FROM memberships WHERE id=? AND tenant_id=?').bind(input.id,tenantId).run()}else await db.prepare('DELETE FROM invitations WHERE id=? AND tenant_id=? AND used_by IS NULL').bind(input.id,tenantId).run();return json({ok:true});
 }
 if(route==='attempt'&&method==='POST'){
  must(m.role==='student','Sınavı öğrenci hesabından başlatın.',403);const s=state.students.find((s:any)=>s.id===m.student_id),exam=state.exams.find((e:any)=>e.id===input.examId&&e.grade===s?.grade&&e.status!=='draft');must(exam,'Bu sınav hesabınıza atanmadı.',403);
  const active:any=await db.prepare('SELECT * FROM attempts WHERE tenant_id=? AND user_id=? AND finished=0 LIMIT 1').bind(tenantId,user.userId).first();if(active)return json({attempt:publicAttempt(active)});
  const qs=exam.questionIds.map((id:string)=>state.questions.find((q:any)=>q.id===id));must(qs.length&&qs.every(Boolean),'Sınav soruları eksik.');const a={id:uid(),exam_id:exam.id,answers:'{}',expires:Date.now()+exam.duration*60000};await db.prepare('INSERT INTO attempts(id,tenant_id,user_id,student_id,exam_id,questions,answers,expires,finished,penalty,title) VALUES(?,?,?,?,?,?,?,?,0,?,?)').bind(a.id,tenantId,user.userId,s.id,exam.id,JSON.stringify(qs),'{}',a.expires,exam.penalty,exam.title).run();return json({attempt:{...a,questions:JSON.stringify(qs.map((q:any)=>({...q,correct:-1,explanation:''}))),title:exam.title,penalty:exam.penalty}});
 }
 if(route==='answer'&&method==='POST'){
  must(m.role==='student','Bu işlem öğrenci hesabına açık.',403);const a:any=await db.prepare('SELECT * FROM attempts WHERE id=? AND tenant_id=? AND user_id=? AND finished=0').bind(input.attemptId,tenantId,user.userId).first();must(a,'Devam eden sınav bulunamadı.',404);must(a.expires>Date.now(),'Süre doldu. Sınavı tamamlayın.',409);const q=JSON.parse(a.questions).find((q:any)=>q.id===input.questionId);must(q,'Soru bu sınava ait değil.');must(input.answer===null||(Number.isInteger(input.answer)&&input.answer>=0&&input.answer<q.options.length),'Cevap geçersiz.');const answers=JSON.parse(a.answers);if(input.answer===null)delete answers[q.id];else answers[q.id]=input.answer;
  const changed=await db.prepare('UPDATE attempts SET answers=? WHERE id=? AND tenant_id=? AND user_id=? AND finished=0 AND answers=? AND expires>?').bind(JSON.stringify(answers),a.id,tenantId,user.userId,a.answers,Date.now()).run();must(changed.meta.changes===1,'Cevap kaydı değişti veya süre doldu. Yenileyin.',409);return json({ok:true});
 }
 if(route==='finish'&&method==='POST'){
  must(m.role==='student','Bu işlem öğrenci hesabına açık.',403);const a:any=await db.prepare('SELECT * FROM attempts WHERE id=? AND tenant_id=? AND user_id=?').bind(input.attemptId,tenantId,user.userId).first();must(a,'Sınav kaydı bulunamadı.',404);const resultId='attempt-'+a.id;
  if(a.finished||state.results.some((r:any)=>r.id===resultId)){await db.prepare('UPDATE attempts SET finished=1 WHERE id=? AND tenant_id=?').bind(a.id,tenantId).run();return json({resultId,db:scopedData(state,m),revision:tenant.revision})}
  const result=gradeAttempt(a,a.title,new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Istanbul'}),resultId);state.results.push(result);
  const update=await db.prepare('UPDATE institutions SET data=?,revision=revision+1 WHERE id=? AND revision=?').bind(JSON.stringify(state),tenantId,tenant.revision).run();must(update.meta.changes===1,'Kayıtlar değişti. Tekrar tamamlayın.',409);
  await db.prepare('UPDATE attempts SET finished=1 WHERE id=? AND tenant_id=?').bind(a.id,tenantId).run();return json({resultId,db:scopedData(state,m),revision:tenant.revision+1});
 }
 throw new AppError('İşlem bulunamadı.',404);
}catch(e:any){if(e instanceof AppError)return json({error:e.message},e.status);console.error('Academy API failed',e?.message);return json({error:'İşlem tamamlanamadı. Lütfen tekrar deneyin.'},500)}}
async function prepareInvitation(db:any,tenantId:string,state:any,input:any){
 must(typeof input.email==='string'&&input.email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email),'E-posta adresi geçersiz.');must(['teacher','student','parent'].includes(input.role),'Davet rolü geçersiz.');
 const email=input.email.trim().toLowerCase(),studentId=input.role==='teacher'?null:input.studentId;must(input.role==='teacher'||state.students.some((s:any)=>s.id===studentId),'Öğrenci bağlantısı seçin.');
 const existing=await db.prepare('SELECT id FROM memberships WHERE tenant_id=? AND email=?').bind(tenantId,email).first();must(!existing,'Bu e-posta zaten kurum üyesi. Davet seçimini kapatıp kaydedebilirsiniz.',409);
 const count:any=await db.prepare('SELECT COUNT(*) AS n FROM invitations WHERE tenant_id=? AND used_by IS NULL AND expires>?').bind(tenantId,Date.now()).first();must(count.n<200,'Bekleyen davet sınırına ulaşıldı.');
 const code=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');return {code,hash:await hashToken(code),expires:Date.now()+7*86400000,email,role:input.role,studentId};
}
function publicAttempt(a:any){return {id:a.id,exam_id:a.exam_id,answers:a.answers,expires:a.expires,title:a.title,penalty:a.penalty,questions:JSON.stringify(JSON.parse(a.questions).map((q:any)=>({...q,correct:-1,explanation:''})))}}
async function hashToken(token:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')}


const RESERVED=["404", "BASLANGIC-V4", "CNAME", "FT-HIZMET-AKTIF-PASIF", "FT-HIZMET-METIN-DUZENLEME", "KURULUM", "KURULUM-V12", "KURULUM-V3", "QR-INTRO-AYARLARI", "QR-INTRO-VIDEO-YONETIM", "QR-PREMIUM-INTRO", "QR-V10-SUPABASE", "README", "SUPABASE-KURULUM", "V11-KURULUM", "V13-KURULUM", "V14-KURULUM", "V15-KONTROL", "V16-KURULUM", "V30-DUYURULAR", "V31-DUYURU-GORSEL", "V34-DUYURU-OKUNMA", "V6-KURULUM", "V6-SUPABASE", "V7-KAMPANYA-SQL", "V7-KURULUM", "YONETIM-V5", "admin", "admin-duyurular", "admin-isletmeler", "admin-qr-stok", "admin-sidebar", "admin-teklifler", "api", "assets", "banner-test", "cebimde-test", "database", "docs", "duyuru-banner", "egitim", "egitim-uygulama", "ftmotion-banner-1", "ftmotion-banner-2", "ftmotion-banner-3", "ftmotion-logo", "giris", "google-yorum-karti", "hesap", "hizmet", "hizmet-medyalari", "hizmet-yonetimi", "index", "isletme-yonetimi", "k", "kampanya", "kampanyalarim", "kartim", "kartlarim", "kartlarim-test", "kesfet-test", "kurum", "kurumsal-kartlar", "login", "magaza-test", "mail", "manifest", "menu", "musteri-defterim", "nfc-dijital-kartvizit", "offline", "paket-yonetimi", "panel", "pwa", "pwa-192", "pwa-512", "pwa-icon", "pwa-maskable", "qr", "qr-demo", "qr-yonetimi", "robots", "shared", "sifre-yenile", "siparis", "sitemap", "sponsor-basvuru", "sponsor-yonetim", "sql", "supabase", "supabase-config", "support", "sw", "teklif", "telefonla-giris", "tests", "uygulamalar", "www", "yonetim"];
export function slugify(value:string){return value.toLocaleLowerCase("tr").replace(/ı/g,"i").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)||"kurum";}
