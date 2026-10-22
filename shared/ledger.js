import {client,currentUser} from './supabase-client.js';
import {escapeHTML as e,money,dateLabel,decimalUnits,calculate,whatsappPhone,statusLabel,documentHTML,printDocument} from './ledger-core.mjs';
const $=id=>document.getElementById(id),today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const state={tab:'overview',customers:[],quotes:[],versions:[],payments:[],notes:[],businesses:[],business:null,ready:false};
let db,user,viewVersion,detailCustomer,loadSequence=0;
const field=(form,name)=>form.elements.namedItem(name);
const showStatus=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const customer=id=>state.customers.find(c=>c.id===id);
const latest=q=>state.versions.find(v=>v.quote_id===q.id&&v.revision===q.current_revision);
const payments=q=>state.payments.filter(p=>p.quote_id===q.id);
const paid=q=>payments(q).reduce((s,p)=>s+Number(p.amount_cents),0);
const action=(label,type,id,secondary=true)=>`<button class="${secondary?'secondary':''}" data-action="${type}" data-id="${e(id)}">${label}</button>`;
function open(id){if(!$(id).open)$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>{state.tab=button.dataset.tab;$('search').value='';render();});
$('search').oninput=render;
async function checked(query){const result=await query;if(result.error)throw result.error;return result.data;}
async function load(){
 const sequence=++loadSequence,bid=state.business.id;state.ready=false;$('app').hidden=true;showStatus('Kayıtlar yükleniyor…');
 // Explicit pages avoid silently dropping records at PostgREST's 1000-row default.
 async function all(table,order='created_at'){
  const rows=[];for(let start=0;;start+=500){const page=await checked(db.from(table).select('*').eq('business_id',bid).order(order,{ascending:false}).order('id').range(start,start+499));rows.push(...page);if(page.length<500)return rows;}
 }
 const result=await Promise.all(['crm_customers','crm_quotes','crm_quote_versions','crm_payments','crm_notes'].map(t=>all(t)));
 if(sequence!==loadSequence)return;
 [state.customers,state.quotes,state.versions,state.payments,state.notes]=result;state.ready=true;$('app').hidden=false;showStatus('');render();
}
function searchMatch(text){return text.toLocaleLowerCase('tr-TR').includes($('search').value.trim().toLocaleLowerCase('tr-TR'));}
function empty(title,body){return `<div class="empty"><h3>${title}</h3><p>${body}</p></div>`;}
function quoteTable(rows){
 if(!rows.length)return empty('Henüz teklif yok','Hızlı teklif ile ilk teklif formunuzu oluşturun.');
 return `<div class="list-table"><div class="table-scroll"><table><thead><tr><th>TEKLİF / MÜŞTERİ</th><th>DURUM</th><th>TOPLAM / KALAN</th><th>İŞLEMLER</th></tr></thead><tbody>${rows.map(q=>{
  const v=latest(q);if(!v)return '';const status=statusLabel(v),remaining=v.total_cents-paid(q);
  return `<tr><td><strong>${e(v.document.title)}</strong><small>${e(customer(q.customer_id)?.name)} · Sürüm ${v.revision} · ${dateLabel(v.created_at)}</small></td><td><span class="badge ${v.response||(/doldu/.test(status)?'expired':'')}">${status}</span>${q.work_status!=='waiting'?`<br><small>${q.work_status==='completed'?'İş tamamlandı':'İş devam ediyor'}</small>`:''}</td><td><strong>${money(v.total_cents)}</strong><small>Kalan ${money(remaining)}</small></td><td><div class="actions">${action('Görüntüle','view',v.id)}${action('Tahsilat','payment',q.id)}</div></td></tr>`;
 }).join('')}</tbody></table></div></div>`;
}
function render(){
 if(!state.ready)return;
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===state.tab));
 $('customerCount').textContent=state.customers.length;
 $('waitingCount').textContent=state.quotes.filter(q=>{const v=latest(q);return v&&!v.response&&v.valid_until>=today();}).length;
 $('paidTotal').textContent=money(state.payments.reduce((s,p)=>s+Number(p.amount_cents),0));
 $('dueTotal').textContent=money(state.quotes.reduce((s,q)=>{const v=latest(q);return s+(v&&(v.response==='accepted'||paid(q)>0)?Math.max(0,v.total_cents-paid(q)):0);},0));
 const titles={overview:['Son teklifler','Konuşulanlar yazılı, işiniz takipte.'],customers:['Müşterilerim','Görüşmeler, teklifler ve ödemeler aynı dosyada.'],quotes:['Tekliflerim','Her sürüm saklanır; konuşulan ayrıntılar kaybolmaz.'],payments:['Tahsilatlarım','Hangi işten ne kadar ödeme aldığınızı görün.']};
 $('sectionLabel').innerHTML=`<h2>${titles[state.tab][0]}</h2><p class="muted">${titles[state.tab][1]}</p>`;
 if(state.tab==='customers'){
  const rows=state.customers.filter(c=>searchMatch(c.name+' '+c.phone+' '+c.email));
  $('content').innerHTML=rows.length?`<div class="list-table"><div class="table-scroll"><table><thead><tr><th>MÜŞTERİ</th><th>İLETİŞİM</th><th>TEKLİF</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong>${e(c.name)}</strong><small>${dateLabel(c.created_at)}</small></td><td>${e(c.phone||'—')}<br><small>${e(c.email)}</small></td><td>${state.quotes.filter(q=>q.customer_id===c.id).length}</td><td>${action('Dosyayı aç','customer',c.id)}</td></tr>`).join('')}</tbody></table></div></div>`:empty('Müşteri bulunamadı','Müşteri ekle butonuyla ilk kaydınızı oluşturun.');
 }else if(state.tab==='payments'){
  const rows=state.payments.filter(p=>{const q=state.quotes.find(q=>q.id===p.quote_id);return searchMatch((customer(q?.customer_id)?.name||'')+' '+(q?latest(q)?.document.title:'')+' '+p.memo);});
  $('content').innerHTML=rows.length?`<div class="list-table"><div class="table-scroll"><table><thead><tr><th>MÜŞTERİ / İŞ</th><th>TARİH</th><th>TUTAR</th><th>ÖDEME / ÖZEL NOT</th></tr></thead><tbody>${rows.map(p=>{const q=state.quotes.find(q=>q.id===p.quote_id);return `<tr><td><strong>${e(customer(q?.customer_id)?.name)}</strong><small>${e(q?latest(q)?.document.title:'')}</small></td><td>${dateLabel(p.paid_on)}</td><td><strong>${money(p.amount_cents)}</strong></td><td>${e(p.method)}<br><small>${e(p.memo)}</small></td></tr>`;}).join('')}</tbody></table></div></div>`:empty('Henüz tahsilat yok','Bir teklifin yanındaki Tahsilat butonuyla ödeme ekleyin.');
 }else{
  const rows=state.quotes.filter(q=>searchMatch((customer(q.customer_id)?.name||'')+' '+(customer(q.customer_id)?.phone||'')+' '+(latest(q)?.document.title||'')));
  const reminders=state.notes.filter(n=>!n.done&&n.remind_on&&n.remind_on<=today());
  $('content').innerHTML=(state.tab==='overview'&&reminders.length?`<div class="panel"><h2>Bugün ilgilenilecekler <span class="badge">${reminders.length}</span></h2>${reminders.map(n=>`<div class="reminder"><input type="checkbox" data-action="complete-note" data-id="${n.id}" aria-label="${e(n.body)} tamamlandı"><div><p>${e(n.body)}</p><small>${e(customer(n.customer_id)?.name)} · ${dateLabel(n.remind_on)}</small></div>${action('Dosya','customer',n.customer_id)}</div>`).join('')}</div>`:'')+quoteTable(state.tab==='overview'?rows.slice(0,8):rows);
 }
}
function customerOptions(selected){const select=field($('quoteForm'),'customer_id');select.innerHTML='<option value="">Müşteri seçin</option>'+state.customers.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('');if(selected)select.value=selected;}
function newCustomer(id){if(!state.ready)return;const form=$('customerForm');form.reset();form.querySelector('.form-message').textContent='';const c=customer(id);$('customerFormTitle').textContent=c?'Müşteriyi düzenle':'Yeni müşteri';for(const name of ['id','name','phone','email','address'])field(form,name).value=c?.[name]||'';open('customerDialog');}
$('newCustomer').onclick=()=>newCustomer();$('quoteNewCustomer').onclick=()=>newCustomer();
async function submitForm(form,work){const buttons=[...form.querySelectorAll('button')],message=form.querySelector('.form-message');buttons.forEach(b=>b.disabled=true);message.textContent='Kaydediliyor…';message.classList.remove('error');try{await work();message.textContent='';}catch(error){message.textContent=error.message;message.classList.add('error');}finally{buttons.forEach(b=>b.disabled=false);}}
$('customerForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{
 const data=Object.fromEntries(new FormData(form));const id=data.id;delete data.id;for(const key in data)data[key]=data[key].trim();data.business_id=state.business.id;
 const saved=await checked((id?db.from('crm_customers').update(data).eq('id',id).eq('business_id',state.business.id):db.from('crm_customers').insert(data)).select().single());
 await load();$('customerDialog').close();if($('quoteDialog').open)customerOptions(saved.id);if($('detailDialog').open)showCustomer(saved.id);
 });};
function addLine(item={name:'',quantity:1,unit_price_cents:0}){
 const row=document.createElement('div');row.className='quote-line';row.innerHTML=`<label>Ürün / hizmet<input class="line-name" maxlength="300" required value="${e(item.name)}" placeholder="Ürün veya yapılacak iş"></label><label>Miktar<input class="line-qty" type="number" min="0.001" max="100000" step="0.001" required value="${e(item.quantity)}"></label><label>Birim fiyat (TL)<input class="line-price" type="number" min="0" max="1000000000" step="0.01" required value="${Number(item.unit_price_cents)/100}"></label><button type="button" class="icon-button" aria-label="İş kalemini kaldır">×</button>`;
 row.querySelector('button').onclick=()=>{if($('quoteLines').children.length===1)return;row.remove();updateCalculation();};$('quoteLines').append(row);
}
function readItems(){return [...$('quoteLines').children].map(row=>({name:row.querySelector('.line-name').value.trim(),quantity:row.querySelector('.line-qty').value,unit_price_cents:decimalUnits(row.querySelector('.line-price').value)}));}
function updateCalculation(){try{const f=$('quoteForm'),totals=calculate(readItems(),decimalUnits(field(f,'discount').value),field(f,'vat').value);$('quoteCalculation').textContent='Genel toplam '+money(totals.total_cents);}catch(error){$('quoteCalculation').textContent=error.message;}}
$('quoteForm').oninput=updateCalculation;$('addLine').onclick=()=>{if($('quoteLines').children.length<100)addLine();};
function newQuote(customerId,quoteId){
 if(!state.ready)return;const form=$('quoteForm');form.reset();form.querySelector('.form-message').textContent='';$('quoteLines').replaceChildren();
 const q=state.quotes.find(q=>q.id===quoteId),v=q?latest(q):null;
 field(form,'quote_id').value=q?.id||'';field(form,'expected').value=q?.current_revision||0;customerOptions(q?.customer_id||customerId);
 field(form,'customer_id').disabled=!!q;$('quoteNewCustomer').hidden=!!q;
 const deadline=new Date();deadline.setDate(deadline.getDate()+15);field(form,'valid_until').value=deadline.toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});field(form,'valid_until').min=today();
 $('quoteFormTitle').textContent=q?'Teklifin yeni sürümünü oluşturun':'Yeni teklif hazırlayın';
 if(v){field(form,'title').value=v.document.title;field(form,'terms').value=v.document.terms;field(form,'discount').value=v.document.discount_cents/100;field(form,'vat').value=v.document.vat_percent;v.document.items.forEach(addLine);}else addLine();
 updateCalculation();open('quoteDialog');
}
$('newQuote').onclick=()=>newQuote();
$('quoteForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{
 const items=readItems(),discount=decimalUnits(field(form,'discount').value),vat=field(form,'vat').value;calculate(items,discount,vat);
 const verId=await checked(db.rpc('crm_issue_quote',{p_business:state.business.id,p_customer:field(form,'customer_id').value,p_quote:field(form,'quote_id').value||null,p_expected:Number(field(form,'expected').value),p_input:{title:field(form,'title').value.trim(),terms:field(form,'terms').value.trim(),items,discount_cents:discount,vat_percent:Number(vat),valid_until:field(form,'valid_until').value}}));
 await load();$('quoteDialog').close();if($('detailDialog').open)showCustomer(detailCustomer);showQuote(verId);
 });};
function showCustomer(id){
 const c=customer(id);if(!c)return;detailCustomer=id;$('detailTitle').textContent=c.name;
 const notes=state.notes.filter(n=>n.customer_id===id),quotes=state.quotes.filter(q=>q.customer_id===id);
 $('detailContent').innerHTML=`<p class="profile-contact muted">${e([c.phone,c.email,c.address].filter(Boolean).join('\n'))}</p><div class="actions">${action('Bilgileri düzenle','edit-customer',id)}${action('＋ Teklif hazırla','new-quote',id,false)}</div><h3 style="margin-top:26px">Görüşme notları</h3><p class="muted">Bu notlar müşteriye gönderilmez.</p><form id="noteForm" class="note-form"><label>Görüşmede konuşulanlar<textarea name="body" maxlength="5000" required rows="3" placeholder="İstenen iş, ölçüler, konuşulan ayrıntılar…"></textarea></label><div class="actions"><label>Hatırlatma tarihi (isteğe bağlı)<input name="remind_on" type="date"></label><button type="submit">Notu kaydet</button></div><p class="form-message" role="status"></p></form>${notes.map(n=>`<div class="note"><p>${e(n.body)}</p><small>${dateLabel(n.created_at)}${n.remind_on?' · Hatırlatma: '+dateLabel(n.remind_on):''}${n.done?' · Tamamlandı':''}</small>${n.remind_on&&!n.done?' '+action('Tamamla','complete-note',n.id):''}</div>`).join('')}<h3 style="margin-top:25px">Teklif geçmişi</h3>${quoteTable(quotes)}`;
 $('noteForm').onsubmit=event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const f=event.currentTarget;await checked(db.from('crm_notes').insert({business_id:state.business.id,customer_id:id,body:field(f,'body').value.trim(),remind_on:field(f,'remind_on').value||null}));await load();showCustomer(id);});};
 open('detailDialog');
}
function shareURL(v){const url=new URL('teklif.html',new URL('../',import.meta.url));url.hash=v.share_token;return url.href;}
function showQuote(id){
 const v=state.versions.find(v=>v.id===id);if(!v)return;const q=state.quotes.find(q=>q.id===v.quote_id);v.current_revision=q.current_revision;v.current_total_cents=latest(q).total_cents;viewVersion=id;
 const phone=whatsappPhone(v.document.customer.phone),url=shareURL(v),message=`Merhaba ${v.document.customer.name}, ${v.document.business.name} olarak hazırladığımız ${v.document.title} teklifini inceleyebilirsiniz. Toplam: ${money(v.total_cents)}. Teklif #${q.id.slice(0,8).toUpperCase()} / Sürüm ${v.revision}\n${url}`;
 const canShare=q.share_enabled&&new Date(v.share_expires_at)>new Date();
 $('viewActions').innerHTML=`${action('PDF / Yazdır','print',id)}${canShare?`<a class="button" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone}?text=${encodeURIComponent(message)}">WhatsApp ile paylaş</a>${action('Bağlantıyı kopyala','copy-link',id)}<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${e(url)}">Müşteri görünümü ↗</a>`:''}${action('Yeni sürüm','revise',q.id)}${action(q.share_enabled?'Paylaşımı kapat':'Paylaşımı aç','toggle-sharing',q.id)}${action('Tahsilat ekle','payment',q.id)}<label>İş durumu<select id="workStatus"><option value="waiting">Bekliyor</option><option value="progress">Devam ediyor</option><option value="completed">Tamamlandı</option></select></label>`;
 $('workStatus').value=q.work_status;$('workStatus').onchange=async event=>{try{await checked(db.from('crm_quotes').update({work_status:event.target.value}).eq('id',q.id).select().single());await load();showQuote(id);}catch(error){$('viewMessage').textContent=error.message;}};
 const versions=state.versions.filter(x=>x.quote_id===q.id).sort((a,b)=>b.revision-a.revision);
 const history=document.createElement('label');history.textContent='Teklif sürümü';const select=document.createElement('select');select.innerHTML=versions.map(x=>`<option value="${x.id}">Sürüm ${x.revision} · ${dateLabel(x.created_at)} · ${money(x.total_cents)}</option>`).join('');select.value=id;select.onchange=()=>showQuote(select.value);history.append(select);$('viewActions').append(history);
 $('viewMessage').textContent=`${v.revision!==q.current_revision?'Önceki sürüm. Güncel sürüm: '+q.current_revision+'. ':''}${statusLabel(v)}${v.responded_at?' · '+new Date(v.responded_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):''}${v.response_note?' · Müşteri notu: '+v.response_note:''}${!canShare?' · Paylaşım kapalı veya bağlantı süresi doldu.':''}`;
 $('documentView').innerHTML=documentHTML(v,payments(q));open('viewDialog');
}
function showPayment(id){const q=state.quotes.find(q=>q.id===id),v=q?latest(q):null;if(!v)return;const due=v.total_cents-paid(q);if(due<=0){showStatus('Bu teklifin kalan tutarı yok.');return;}const f=$('paymentForm');f.reset();field(f,'quote_id').value=id;field(f,'payment_id').value=crypto.randomUUID();field(f,'paid_on').value=today();field(f,'paid_on').max=today();field(f,'amount').max=due/100;f.querySelector('.form-message').textContent='';$('paymentSummary').textContent=`${v.document.title} · Kalan: ${money(due)}`;open('paymentDialog');}
$('paymentForm').onsubmit=event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const id=field(f,'quote_id').value;await checked(db.rpc('crm_record_payment',{p_quote:id,p_amount:decimalUnits(field(f,'amount').value),p_date:field(f,'paid_on').value,p_method:field(f,'method').value,p_memo:field(f,'memo').value.trim(),p_id:field(f,'payment_id').value}));await load();$('paymentDialog').close();if($('viewDialog').open)showQuote(viewVersion);if($('detailDialog').open)showCustomer(detailCustomer);showStatus('Tahsilat kaydedildi. Kalan tutar güncellendi.');});};
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;const {action:type,id}=button.dataset;
 try{
  if(type==='customer')showCustomer(id);
  if(type==='edit-customer')newCustomer(id);
  if(type==='new-quote')newQuote(id);
  if(type==='view')showQuote(id);
  if(type==='payment')showPayment(id);
  if(type==='revise'){const q=state.quotes.find(q=>q.id===id);$('viewDialog').close();newQuote(q.customer_id,id);}
  if(type==='print'){const v=state.versions.find(v=>v.id===id);printDocument(documentHTML(v,payments(state.quotes.find(q=>q.id===v.quote_id))));}
  if(type==='copy-link'){await navigator.clipboard.writeText(shareURL(state.versions.find(v=>v.id===id)));$('viewMessage').textContent='Teklif bağlantısı kopyalandı.';}
  if(type==='toggle-sharing'){const q=state.quotes.find(q=>q.id===id);if(!confirm(q.share_enabled?'Bu teklifin tüm sürümlerine ait müşteri bağlantılarını kapatmak istiyor musunuz?':'Teklif bağlantılarını yeniden açmak istiyor musunuz?'))return;await checked(db.from('crm_quotes').update({share_enabled:!q.share_enabled}).eq('id',id).select().single());await load();showQuote(viewVersion);}
  if(type==='complete-note'){await checked(db.from('crm_notes').update({done:true}).eq('id',id).select().single());await load();if($('detailDialog').open)showCustomer(detailCustomer);}
 }catch(error){showStatus(error.message,true);if($('viewDialog').open)$('viewMessage').textContent=error.message;}
});
$('refresh').onclick=()=>load().catch(error=>showStatus(error.message,true));
async function selectBusiness(id){state.business=state.businesses.find(b=>b.id===id);$('businessLabel').textContent=state.business.name;const back=new URL('kartim.html',location.href);back.searchParams.set('business_id',id);$('backToCard').href=back.href;const url=new URL(location.href);url.searchParams.set('business_id',id);history.replaceState(null,'',url);await load();}
try{
 db=await client();user=await currentUser(db);if(!user){location.replace('giris.html?next='+encodeURIComponent('musteri-defterim.html'+location.search));throw Error('Giriş sayfasına yönlendiriliyorsunuz.');}
 const admin=await checked(db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle());
 let query=db.from('businesses').select('id,name,owner_id,active,created_at').order('active',{ascending:false}).order('created_at',{ascending:false});if(!admin)query=query.eq('owner_id',user.id);
 state.businesses=await checked(query);if(!state.businesses.length)throw Error('Önce İşletme Kartım bölümünden işletmenizi oluşturun.');
 const select=$('businessSelect');select.innerHTML=state.businesses.map(b=>`<option value="${b.id}">${e(b.name)}</option>`).join('');select.hidden=state.businesses.length<2;select.onchange=()=>selectBusiness(select.value).catch(error=>showStatus(error.message,true));
 const requested=new URLSearchParams(location.search).get('business_id');if(requested&&!state.businesses.some(b=>b.id===requested))throw Error('Bu işletmenin defterine erişim yetkiniz yok.');
 select.value=requested||state.businesses[0].id;await selectBusiness(select.value);
}catch(error){showStatus(error.message,true);}
