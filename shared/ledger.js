import {client,currentUser} from './supabase-client.js';
import {escapeHTML as e,money,dateLabel,decimalUnits,calculate,whatsappPhone,statusLabel,documentHTML,printDocument,recordId} from './ledger-core.mjs?v=3';
import {activePayments,mergeDrafts,parseSpokenQuote} from './ledger-workflow.mjs?v=3';
import {downloadQuotePDF} from './ledger-pdf.mjs?v=3';
import {SECTORS,sectorProfile,customerSectorData,sectorStage} from './ledger-sectors.mjs?v=3';
const $=id=>document.getElementById(id),today=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
const state={tab:'overview',customers:[],quotes:[],versions:[],payments:[],notes:[],businesses:[],business:null,ready:false,products:[],drafts:[],filter:'',calendarMonth:today().slice(0,7),calendarDay:today(),sector:'general',sectorConfigured:false,customerStage:''};
let db,user,viewVersion,detailCustomer,loadSequence=0,activeQuoteSector='general';
const profile=()=>sectorProfile(state.sector);
const field=(form,name)=>form.elements.namedItem(name);
const showStatus=(text,error=false)=>{$('status').textContent=text;$('status').classList.toggle('error',error);};
const customer=id=>state.customers.find(c=>c.id===id);
const latest=q=>state.versions.find(v=>v.quote_id===q.id&&v.revision===q.current_revision);
const payments=q=>activePayments(state.payments.filter(p=>p.quote_id===q.id));
const paid=q=>payments(q).reduce((s,p)=>s+Number(p.amount_cents),0);
const action=(label,type,id,secondary=true)=>`<button class="${secondary?'secondary':''}" data-action="${type}" data-id="${e(id)}">${label}</button>`;
function open(id){if(!$(id).open)$(id).showModal();}
document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
function navigate(tab,filter=''){
 state.tab=tab;state.filter=filter;$('search').value='';render();
 const target=tab==='overview'?$('pageTitle'):$('sectionLabel').querySelector('h2');
 requestAnimationFrame(()=>{target?.focus({preventScroll:true});(tab==='overview'?document.querySelector('.page-heading'):$('sectionTools')).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});});
}
 document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>navigate(button.dataset.tab));
 document.querySelectorAll('[data-goto]').forEach(button=>button.onclick=()=>{const tab=button.dataset.goto;navigate(tab==='due'?'quotes':tab,tab==='due'?'due':tab==='quotes'?'waiting':'');});
$('search').oninput=render;
async function checked(query){const result=await query;if(result.error)throw result.error;return result.data;}
async function load(){
 const sequence=++loadSequence,bid=state.business.id;state.ready=false;$('app').hidden=true;showStatus('Kayıtlar yükleniyor…');
 // Explicit pages avoid silently dropping records at PostgREST's 1000-row default.
 async function all(table,order='created_at'){
  const rows=[];for(let start=0;;start+=500){const page=await checked(db.from(table).select('*').eq('business_id',bid).order(order,{ascending:false}).order('id').range(start,start+499));rows.push(...page);if(page.length<500)return rows;}
 }
 const result=await Promise.all([...['crm_customers','crm_quotes','crm_quote_versions','crm_payments','crm_notes','crm_products','crm_quote_drafts'].map(t=>all(t)),checked(db.from('crm_ledger_settings').select('*').eq('business_id',bid).maybeSingle())]);
 if(sequence!==loadSequence)return;
 const settings=result.pop();state.sector=settings?.sector||'general';state.sectorConfigured=!!settings;[state.customers,state.quotes,state.versions,state.payments,state.notes,state.products,state.drafts]=result;state.drafts=mergeDrafts(state.drafts,localDrafts());$('resumeDraft').hidden=!state.drafts.length;state.ready=true;$('app').hidden=false;showStatus('');render();
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
function decorateTables(){document.querySelectorAll('.list-table table').forEach(table=>{const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent);table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,i)=>{cell.dataset.label=labels[i]||'';}));});}
function render(){
 if(!state.ready)return;
 applySectorLabels();
 document.body.dataset.section=state.tab;document.querySelectorAll('[data-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.tab===state.tab);b.setAttribute('aria-current',b.dataset.tab===state.tab?'page':'false');});
 $('customerCount').textContent=state.customers.length;
 $('waitingCount').textContent=state.quotes.filter(q=>{const v=latest(q);return v&&!v.response&&v.valid_until>=today();}).length;
 $('paidTotal').textContent=money(activePayments(state.payments).reduce((s,p)=>s+Number(p.amount_cents),0));
 $('dueTotal').textContent=money(state.quotes.reduce((s,q)=>{const v=latest(q);return s+(v&&(v.response==='accepted'||paid(q)>0)?Math.max(0,v.total_cents-paid(q)):0);},0));
 const titles={products:['Ürün ve hizmetlerim','Bir kez kaydedin, tekliflerinize listeden ekleyin.'],calendar:['İş takvimim','Görüşme hatırlatmaları ve teklif geçerlilik tarihleri.'],overview:['Son teklifler','Konuşulanlar yazılı, işiniz takipte.'],customers:['Müşterilerim','Görüşmeler, teklifler ve ödemeler aynı dosyada.'],quotes:['Tekliflerim','Her sürüm saklanır; konuşulan ayrıntılar kaybolmaz.'],payments:['Tahsilatlarım','Hangi işten ne kadar ödeme aldığınızı görün.']};
 titles.customers[0]=profile().customers;titles.products[0]=profile().catalogTitle;titles.quotes[0]=({general:'Tekliflerim',driving_school:'Kurs Teklifleri',education:'Eğitim Teklifleri',wholesale:'Satış Teklifleri'})[state.sector];
 $('sectionLabel').innerHTML=`<h2 tabindex="-1">${titles[state.tab][0]}</h2><p class="muted">${titles[state.tab][1]}</p>`;
 if(state.tab==='products'){renderProducts();return;}
 if(state.tab==='calendar'){renderCalendar();return;}
 if(state.tab==='customers'){
  const rows=state.customers.filter(c=>!state.customerStage||sectorStage(c,state.sector)[0]===state.customerStage).filter(c=>searchMatch(c.name+' '+c.phone+' '+c.email+' '+Object.values(customerSectorData(c,state.sector)).join(' ')));
  $('content').innerHTML=rows.length?`<div class="list-table"><div class="table-scroll"><table><thead><tr><th>${e(profile().customer)}</th><th>İLETİŞİM</th><th>TEKLİF</th><th></th></tr></thead><tbody>${rows.map(c=>`<tr><td><strong>${e(c.name)}</strong><small>${dateLabel(c.created_at)}</small><br><span class="badge">${e(sectorStage(c,state.sector)[1])}</span></td><td>${e(c.phone||'—')}<br><small>${e(c.email)}</small></td><td>${state.quotes.filter(q=>q.customer_id===c.id).length}</td><td>${action('Dosyayı aç','customer',c.id)}</td></tr>`).join('')}</tbody></table></div></div>`:empty('Müşteri bulunamadı','Müşteri ekle butonuyla ilk kaydınızı oluşturun.');
 }else if(state.tab==='payments'){
  const rows=state.payments.filter(p=>{const q=state.quotes.find(q=>q.id===p.quote_id);return searchMatch((customer(q?.customer_id)?.name||'')+' '+(q?latest(q)?.document.title:'')+' '+p.memo);});
  $('content').innerHTML=rows.length?`<div class="list-table"><div class="table-scroll"><table><thead><tr><th>MÜŞTERİ / İŞ</th><th>TARİH</th><th>TUTAR</th><th>ÖDEME / ÖZEL NOT</th><th>İŞLEM</th></tr></thead><tbody>${rows.map(p=>{const q=state.quotes.find(q=>q.id===p.quote_id);return `<tr class="${p.voided_at?'voided-payment':''}"><td><strong>${e(customer(q?.customer_id)?.name)}</strong><small>${e(q?latest(q)?.document.title:'')}</small></td><td>${dateLabel(p.paid_on)}</td><td><strong>${money(p.amount_cents)}</strong></td><td>${e(p.method)}<br><small>${e(p.memo)}</small>${p.voided_at?`<br><span class="badge expired">${p.replacement_id?'Düzeltildi':'İptal edildi'}</span><br><small>${e(p.void_reason)} · ${dateLabel(p.voided_at)}</small>`:''}</td><td>${!p.voided_at?action('Düzelt / İptal','correct-payment',p.id):'Geçmiş kayıt'}</td></tr>`;}).join('')}</tbody></table></div></div>`:empty('Henüz tahsilat yok','Bir teklifin yanındaki Tahsilat butonuyla ödeme ekleyin.');
 }else{
  const rows=state.quotes.filter(q=>!state.filter||(state.filter==='waiting'?latest(q)&&!latest(q).response&&latest(q).valid_until>=today():latest(q)&&(latest(q).response==='accepted'||paid(q)>0)&&latest(q).total_cents>paid(q))).filter(q=>searchMatch((customer(q.customer_id)?.name||'')+' '+(customer(q.customer_id)?.phone||'')+' '+(latest(q)?.document.title||'')));
  const reminders=state.notes.filter(n=>!n.done&&n.remind_on&&n.remind_on<=today());
  $('content').innerHTML=(state.filter?`<p class="filter-notice">${state.filter==='due'?'Kalan alacağı olan işler':'Yanıt bekleyen teklifler'} ${action('Tüm teklifleri göster','all-quotes','')}</p>`:'')+(state.tab==='overview'&&reminders.length?`<div class="panel"><h2>Bugün ilgilenilecekler <span class="badge">${reminders.length}</span></h2>${reminders.map(n=>`<div class="reminder"><input type="checkbox" data-action="complete-note" data-id="${n.id}" aria-label="${e(n.body)} tamamlandı"><div><p>${e(n.body)}</p><small>${e(customer(n.customer_id)?.name)} · ${dateLabel(n.remind_on)}</small></div>${action('Dosya','customer',n.customer_id)}</div>`).join('')}</div>`:'')+quoteTable(state.tab==='overview'?rows.slice(0,8):rows);
 }
 decorateTables();
}
function customerOptions(selected){const select=field($('quoteForm'),'customer_id');select.innerHTML='<option value="">'+e(sectorProfile(activeQuoteSector).customer)+' seçin</option>'+state.customers.map(c=>`<option value="${c.id}">${e(c.name)}</option>`).join('');if(selected)select.value=selected;}
function newCustomer(id){if(!state.ready)return;const form=$('customerForm');form.reset();form.querySelector('.form-message').textContent='';const c=customer(id);$('customerFormTitle').textContent=c?profile().customer+' bilgilerini düzenle':'Yeni '+profile().customer.toLocaleLowerCase('tr-TR');$('customerNameLabel').textContent=profile().nameLabel;$('customerPhoneLabel').textContent=profile().phoneLabel;renderCustomerFields(c);for(const name of ['id','name','phone','email','address'])field(form,name).value=c?.[name]||'';open('customerDialog');}
$('newCustomer').onclick=()=>newCustomer();$('quoteNewCustomer').onclick=()=>newCustomer();
async function submitForm(form,work){const buttons=[...form.querySelectorAll('button')],message=form.querySelector('.form-message');buttons.forEach(b=>b.disabled=true);message.textContent='Kaydediliyor…';message.classList.remove('error');try{await work();message.textContent='';}catch(error){message.textContent=error.message;message.classList.add('error');}finally{buttons.forEach(b=>b.disabled=false);}}
$('customerForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{
 const id=field(form,'id').value,common={};for(const key of ['name','phone','email','address'])common[key]=field(form,key).value.trim();
 const saved=await checked(db.rpc('crm_save_sector_customer',{p_business:state.business.id,p_customer:id||null,p_common:common,p_sector:state.sector,p_details:readSectorFields('customerSectorFields')}));
 await load();$('customerDialog').close();if($('quoteDialog').open)customerOptions(saved.id);if($('detailDialog').open)showCustomer(saved.id);
 });};
function addLine(item={name:'',quantity:1,unit_price_cents:0}){
 const row=document.createElement('div');row.className='quote-line';row.innerHTML=`<label>Ürün / hizmet<input class="line-name" maxlength="300" required value="${e(item.name)}" placeholder="Ürün veya yapılacak iş"></label><label>Miktar<input class="line-qty" type="number" min="0.001" max="100000" step="0.001" required value="${e(item.quantity)}"></label><label>Birim fiyat (TL)<input class="line-price" type="number" min="0" max="1000000000" step="0.01" required value="${Number(item.unit_price_cents)/100}"></label><button type="button" class="icon-button" aria-label="İş kalemini kaldır">×</button>`;
 row.querySelector('button').onclick=()=>{if($('quoteLines').children.length===1)return;row.remove();updateCalculation();queueDraft();};$('quoteLines').append(row);
}
function readItems(){return [...$('quoteLines').children].map(row=>({name:row.querySelector('.line-name').value.trim(),quantity:row.querySelector('.line-qty').value,unit_price_cents:decimalUnits(row.querySelector('.line-price').value)}));}
function updateCalculation(){try{const f=$('quoteForm'),totals=calculate(readItems(),decimalUnits(field(f,'discount').value),field(f,'vat').value);$('quoteCalculation').textContent='Genel toplam '+money(totals.total_cents);}catch(error){$('quoteCalculation').textContent=error.message;}}
$('quoteForm').oninput=()=>{updateCalculation();queueDraft();};$('quoteForm').onchange=queueDraft;$('addLine').onclick=()=>{if($('quoteLines').children.length<100){addLine();queueDraft();}};
function newQuote(customerId,quoteId,skipRestore=false){
 if(!state.ready)return;const form=$('quoteForm');delete form.dataset.issuedVersion;form.reset();form.querySelector('.form-message').textContent='';$('quoteLines').replaceChildren();
 const q=state.quotes.find(q=>q.id===quoteId),v=q?latest(q):null;activeQuoteSector=v?(v.document.sector||'general'):state.sector;renderQuoteSectorFields(v?.document.sector_details||{});
 $('voiceText').value='';field(form,'quote_id').value=q?.id||'';field(form,'expected').value=q?.current_revision||0;customerOptions(q?.customer_id||customerId);
 field(form,'customer_id').disabled=!!q;$('quoteNewCustomer').hidden=!!q;
 const deadline=new Date();deadline.setDate(deadline.getDate()+15);field(form,'valid_until').value=deadline.toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});field(form,'valid_until').min=today();
 $('quoteFormTitle').textContent=q?'Teklifin yeni sürümünü oluşturun':'Yeni '+sectorProfile(activeQuoteSector).quote.toLocaleLowerCase('tr-TR')+' hazırlayın';
 if(v){field(form,'title').value=v.document.title;field(form,'terms').value=v.document.terms;field(form,'discount').value=v.document.discount_cents/100;field(form,'vat').value=v.document.vat_percent;v.document.items.forEach(addLine);}else addLine();
 populateCatalog();activeDraftKey=quoteId||'new';const draft=skipRestore?null:state.drafts.find(d=>d.draft_key===activeDraftKey);if(draft)restoreDraft(draft.payload);else if(!v)fillQuoteSectorFromCustomer();$('draftStatus').textContent=draft?'Kaydedilmiş taslağınız açıldı. Değişiklikler otomatik kaydedilir.':'Yazdıklarınız otomatik olarak taslağa kaydedilir.';updateCalculation();open('quoteDialog');
}
$('newQuote').onclick=()=>newQuote();
$('quoteForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{
 const items=readItems(),discount=decimalUnits(field(form,'discount').value),vat=field(form,'vat').value;calculate(items,discount,vat);
 const verId=form.dataset.issuedVersion||await checked(db.rpc('crm_issue_quote',{p_business:state.business.id,p_customer:field(form,'customer_id').value,p_quote:field(form,'quote_id').value||null,p_expected:Number(field(form,'expected').value),p_input:{sector:activeQuoteSector,sector_details:readSectorFields('quoteSectorFields'),title:field(form,'title').value.trim(),terms:field(form,'terms').value.trim(),items,discount_cents:discount,vat_percent:Number(vat),valid_until:field(form,'valid_until').value}}));
 form.dataset.issuedVersion=verId;try{await clearDraft(activeDraftKey);}catch{}await load();suppressDraftClose=true;$('quoteDialog').close();if($('detailDialog').open)showCustomer(detailCustomer);showQuote(verId);
 });};
function showCustomer(id){
 const c=customer(id);if(!c)return;detailCustomer=id;$('detailTitle').textContent=c.name;
 const notes=state.notes.filter(n=>n.customer_id===id),quotes=state.quotes.filter(q=>q.customer_id===id);
 $('detailContent').innerHTML=customerSectorSummary(c)+`<p class="profile-contact muted">${e([c.phone,c.email,c.address].filter(Boolean).join('\n'))}</p><div class="actions">${action('Bilgileri düzenle','edit-customer',id)}${action('＋ Teklif hazırla','new-quote',id,false)}</div><h3 style="margin-top:26px">Görüşme notları</h3><p class="muted">Bu notlar müşteriye gönderilmez.</p><form id="noteForm" class="note-form"><label>Görüşmede konuşulanlar<textarea name="body" maxlength="5000" required rows="3" placeholder="İstenen iş, ölçüler, konuşulan ayrıntılar…"></textarea></label><div class="actions"><label>Hatırlatma tarihi (isteğe bağlı)<input name="remind_on" type="date"></label><button type="submit">Notu kaydet</button></div><p class="form-message" role="status"></p></form>${notes.map(n=>`<div class="note"><p>${e(n.body)}</p><small>${dateLabel(n.created_at)}${n.remind_on?' · Hatırlatma: '+dateLabel(n.remind_on):''}${n.done?' · Tamamlandı':''}</small>${n.remind_on&&!n.done?' '+action('Tamamla','complete-note',n.id):''}</div>`).join('')}<h3 style="margin-top:25px">Teklif geçmişi</h3>${quoteTable(quotes)}`;
 $('noteForm').onsubmit=event=>{event.preventDefault();submitForm(event.currentTarget,async()=>{const f=event.currentTarget;await checked(db.from('crm_notes').insert({business_id:state.business.id,customer_id:id,body:field(f,'body').value.trim(),remind_on:field(f,'remind_on').value||null}));await load();showCustomer(id);});};
 decorateTables();open('detailDialog');
}
function shareURL(v){const url=new URL('teklif.html',new URL('../',import.meta.url));url.hash=v.share_token;return url.href;}
function showQuote(id){
 const v=state.versions.find(v=>v.id===id);if(!v)return;const q=state.quotes.find(q=>q.id===v.quote_id);v.current_revision=q.current_revision;v.current_total_cents=latest(q).total_cents;viewVersion=id;
 const phone=whatsappPhone(v.document.customer.phone),url=shareURL(v),message=`Merhaba ${v.document.customer.name}, ${v.document.business.name} olarak hazırladığımız ${v.document.title} teklifini inceleyebilirsiniz. Toplam: ${money(v.total_cents)}. Teklif #${q.id.slice(0,8).toUpperCase()} / Sürüm ${v.revision}\n${url}`;
 const canShare=q.share_enabled&&new Date(v.share_expires_at)>new Date();
 $('viewActions').innerHTML=`${action('PDF indir','download-pdf',id)}${action('PDF paylaş','share-pdf',id)}${action('Yazdır','print',id)}${canShare?`<a class="button" target="_blank" rel="noopener noreferrer" href="https://wa.me/${phone}?text=${encodeURIComponent(message)}">WhatsApp ile paylaş</a>${action('Bağlantıyı kopyala','copy-link',id)}<a class="button secondary" target="_blank" rel="noopener noreferrer" href="${e(url)}">Müşteri görünümü ↗</a>`:''}${action('Yeni sürüm','revise',q.id)}${action(q.share_enabled?'Paylaşımı kapat':'Paylaşımı aç','toggle-sharing',q.id)}${action('Tahsilat ekle','payment',q.id)}<label>İş durumu<select id="workStatus"><option value="waiting">Bekliyor</option><option value="progress">Devam ediyor</option><option value="completed">Tamamlandı</option></select></label>`;
 $('workStatus').value=q.work_status;$('workStatus').onchange=async event=>{try{await checked(db.from('crm_quotes').update({work_status:event.target.value}).eq('id',q.id).select().single());await load();showQuote(id);}catch(error){$('viewMessage').textContent=error.message;}};
 const versions=state.versions.filter(x=>x.quote_id===q.id).sort((a,b)=>b.revision-a.revision);
 const history=document.createElement('label');history.textContent='Teklif sürümü';const select=document.createElement('select');select.innerHTML=versions.map(x=>`<option value="${x.id}">Sürüm ${x.revision} · ${dateLabel(x.created_at)} · ${money(x.total_cents)}</option>`).join('');select.value=id;select.onchange=()=>showQuote(select.value);history.append(select);$('viewActions').append(history);
 $('viewMessage').textContent=`${v.revision!==q.current_revision?'Önceki sürüm. Güncel sürüm: '+q.current_revision+'. ':''}${statusLabel(v)}${v.responded_at?' · '+new Date(v.responded_at).toLocaleString('tr-TR',{timeZone:'Europe/Istanbul'}):''}${v.response_note?' · Müşteri notu: '+v.response_note:''}${!canShare?' · Paylaşım kapalı veya bağlantı süresi doldu.':''}`;
 $('documentView').innerHTML=documentHTML(v,payments(q));open('viewDialog');
}
function showPayment(id){const q=state.quotes.find(q=>q.id===id),v=q?latest(q):null;if(!v)return;const due=v.total_cents-paid(q);if(due<=0){showStatus('Bu teklifin kalan tutarı yok.');return;}const f=$('paymentForm');f.reset();field(f,'quote_id').value=id;field(f,'payment_id').value=recordId();field(f,'paid_on').value=today();field(f,'paid_on').max=today();field(f,'amount').max=due/100;f.querySelector('.form-message').textContent='';$('paymentSummary').textContent=`${v.document.title} · Kalan: ${money(due)}`;open('paymentDialog');}
$('paymentForm').onsubmit=event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const id=field(f,'quote_id').value;await checked(db.rpc('crm_record_payment',{p_quote:id,p_amount:decimalUnits(field(f,'amount').value),p_date:field(f,'paid_on').value,p_method:field(f,'method').value,p_memo:field(f,'memo').value.trim(),p_id:field(f,'payment_id').value}));await load();$('paymentDialog').close();if($('viewDialog').open)showQuote(viewVersion);if($('detailDialog').open)showCustomer(detailCustomer);showStatus('Tahsilat kaydedildi. Kalan tutar güncellendi.');});};
document.addEventListener('click',async event=>{
 const button=event.target.closest('[data-action]');if(!button)return;const {action:type,id}=button.dataset;
 try{
  if(type==='all-quotes')navigate('quotes');
  if(type==='new-product')editProduct();
  if(type==='edit-product')editProduct(id);
  if(type==='archive-product'){const product=state.products.find(p=>p.id===id);await checked(db.from('crm_products').update({active:!product.active}).eq('id',id).select().single());await load();}
  if(type==='resume-draft'){const draft=state.drafts.find(d=>d.draft_key===id);if(draft){$('draftsDialog').close();newQuote(draft.payload.customer_id,draft.payload.quote_id||null);}}
  if(type==='correct-payment')showCorrection(id);
  if(type==='calendar-prev'||type==='calendar-next'){const date=new Date(state.calendarMonth+'-15T12:00:00');date.setMonth(date.getMonth()+(type==='calendar-prev'?-1:1));state.calendarMonth=date.toLocaleDateString('sv-SE').slice(0,7);render();}
  if(type==='calendar-day'){state.calendarDay=id;renderCalendar();document.getElementById('calendarAgenda')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
  if(type==='customer')showCustomer(id);
  if(type==='edit-customer')newCustomer(id);
  if(type==='new-quote')newQuote(id);
  if(type==='view')showQuote(id);
  if(type==='payment')showPayment(id);
  if(type==='revise'){const q=state.quotes.find(q=>q.id===id);$('viewDialog').close();newQuote(q.customer_id,id);}
  if(type==='download-pdf'||type==='share-pdf'){button.disabled=true;try{const v=state.versions.find(v=>v.id===id);await downloadQuotePDF(v,payments(state.quotes.find(q=>q.id===v.quote_id)),type==='share-pdf');}finally{button.disabled=false;}}
  if(type==='print'){const v=state.versions.find(v=>v.id===id);printDocument(documentHTML(v,payments(state.quotes.find(q=>q.id===v.quote_id))));}
  if(type==='copy-link'){await navigator.clipboard.writeText(shareURL(state.versions.find(v=>v.id===id)));$('viewMessage').textContent='Teklif bağlantısı kopyalandı.';}
  if(type==='toggle-sharing'){const q=state.quotes.find(q=>q.id===id);if(!confirm(q.share_enabled?'Bu teklifin tüm sürümlerine ait müşteri bağlantılarını kapatmak istiyor musunuz?':'Teklif bağlantılarını yeniden açmak istiyor musunuz?'))return;await checked(db.from('crm_quotes').update({share_enabled:!q.share_enabled}).eq('id',id).select().single());await load();showQuote(viewVersion);}
  if(type==='complete-note'){await checked(db.from('crm_notes').update({done:true}).eq('id',id).select().single());await load();if($('detailDialog').open)showCustomer(detailCustomer);}
 }catch(error){showStatus(error.message,true);if($('viewDialog').open)$('viewMessage').textContent=error.message;}
});
// Catalog -------------------------------------------------------------------
function populateCatalog(){const select=$('catalogPick'),previous=select.value;select.innerHTML='<option value="">Ürün veya hizmet seçin</option>'+state.products.filter(p=>p.active).map(p=>`<option value="${p.id}">${e(p.name)} · ${money(p.unit_price_cents)} / ${e(p.unit)}</option>`).join('');select.value=previous;}
function renderProducts(){
 const rows=state.products.filter(p=>searchMatch(p.name+' '+p.description));
 $('content').innerHTML=`<div class="actions section-actions">${action('＋ Ürün / hizmet ekle','new-product','',false)}</div>`+(rows.length?`<div class="list-table"><div class="table-scroll"><table><thead><tr><th>ÜRÜN / HİZMET</th><th>BİRİM FİYAT</th><th>DURUM</th><th>İŞLEMLER</th></tr></thead><tbody>${rows.map(p=>`<tr><td><strong>${e(p.name)}</strong><small>${e(p.description)}</small></td><td>${money(p.unit_price_cents)} / ${e(p.unit)}</td><td><span class="badge ${p.active?'accepted':'expired'}">${p.active?'Aktif':'Arşivde'}</span></td><td><div class="actions">${action('Düzenle','edit-product',p.id)}${action(p.active?'Arşivle':'Geri al','archive-product',p.id)}</div></td></tr>`).join('')}</tbody></table></div></div>`:empty('Ürün ve hizmet listenizi oluşturun','Kayıtlı fiyatları teklif hazırlarken tek dokunuşla ekleyin.'));
 decorateTables();
}
function editProduct(id){const product=state.products.find(p=>p.id===id),form=$('productForm');form.reset();form.querySelector('.form-message').textContent='';for(const key of ['id','name','description'])field(form,key).value=product?.[key]||'';field(form,'price').value=product?product.unit_price_cents/100:'';field(form,'unit').value=product?.unit||(['education','driving_school'].includes(state.sector)?'paket':'adet');open('productDialog');}
$('productForm').onsubmit=event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const id=field(f,'id').value,data={business_id:state.business.id,name:field(f,'name').value.trim(),description:field(f,'description').value.trim(),unit:field(f,'unit').value.trim(),unit_price_cents:decimalUnits(field(f,'price').value)};await checked((id?db.from('crm_products').update(data).eq('id',id):db.from('crm_products').insert(data)).select().single());await load();$('productDialog').close();populateCatalog();});};
$('addCatalogItem').onclick=()=>{const p=state.products.find(p=>p.id===$('catalogPick').value&&p.active);if(!p)return;const form=$('quoteForm'),terms=field(form,'terms');if(p.description&&terms.value.length+p.description.length+p.name.length+5>5000){$('draftStatus').textContent='Ürün açıklaması için iş şartları alanında yeterli yer yok.';return;}const first=$('quoteLines').firstElementChild;if($('quoteLines').children.length===1&&!first.querySelector('.line-name').value.trim())first.remove();if($('quoteLines').children.length>=100)return;addLine({name:p.name+' ('+p.unit+')',quantity:1,unit_price_cents:p.unit_price_cents});if(p.description)terms.value+=(terms.value?'\n':'')+p.name+': '+p.description;updateCalculation();queueDraft();};
// Autosaved drafts ----------------------------------------------------------
let activeDraftKey=null,draftTimer=null,draftWriteChain=Promise.resolve(),suppressDraftClose=false;
const draftStorageKey=()=>`ftmotion-quote-drafts-v2:${user.id}:${state.business.id}`;
function localDrafts(){try{const data=JSON.parse(localStorage.getItem(draftStorageKey())||'[]');return Array.isArray(data)?data.filter(d=>d?.payload&&typeof d.draft_key==='string'&&typeof d.updated_at==='string'&&d.business_id===state.business.id&&d.user_id===user.id):[];}catch{return [];}}
function captureDraft(){const f=$('quoteForm');return {sector:activeQuoteSector,sector_details:readSectorFields('quoteSectorFields'),quote_id:field(f,'quote_id').value||null,expected:field(f,'expected').value,customer_id:field(f,'customer_id').value,title:field(f,'title').value,terms:field(f,'terms').value,discount:field(f,'discount').value,vat:field(f,'vat').value,valid_until:field(f,'valid_until').value,voice_text:$('voiceText').value,items:[...$('quoteLines').children].map(row=>({name:row.querySelector('.line-name').value,quantity:row.querySelector('.line-qty').value,price:row.querySelector('.line-price').value}))};}
function restoreDraft(payload){activeQuoteSector=SECTORS[payload.sector]?payload.sector:'general';renderQuoteSectorFields(payload.sector_details||{});customerOptions(payload.customer_id);$('quoteFormTitle').textContent=payload.quote_id?'Teklifin yeni sürümünü oluşturun':'Yeni '+sectorProfile(activeQuoteSector).quote.toLocaleLowerCase('tr-TR')+' hazırlayın';const f=$('quoteForm');for(const key of ['title','terms','discount','vat','valid_until','expected'])if(payload[key]!==undefined)field(f,key).value=payload[key];if(payload.customer_id)field(f,'customer_id').value=payload.customer_id;$('voiceText').value=payload.voice_text||'';$('quoteLines').replaceChildren();for(const item of (Array.isArray(payload.items)?payload.items:[]).slice(0,100)){addLine({name:item.name||'',quantity:item.quantity||'',unit_price_cents:0});$('quoteLines').lastElementChild.querySelector('.line-price').value=item.price??'';}if(!$('quoteLines').children.length)addLine();}
function queueDraft(){
 if(!activeDraftKey||!state.business||!user)return;
 const row={business_id:state.business.id,user_id:user.id,draft_key:activeDraftKey,payload:captureDraft(),updated_at:new Date().toISOString()};
 state.drafts=mergeDrafts(state.drafts,[row]);let localOK=false;
 try{localStorage.setItem(draftStorageKey(),JSON.stringify(state.drafts.filter(d=>d.user_id===user.id)));localOK=true;}catch{}
 $('resumeDraft').hidden=false;$('draftStatus').textContent=localOK?'Taslak bu cihazda kaydedildi. Hesabınıza eşitleniyor…':'Taslak hesabınıza kaydediliyor…';
 clearTimeout(draftTimer);draftTimer=setTimeout(()=>persistDraft(row,localOK),700);
}
function persistDraft(row,localOK=true){
 clearTimeout(draftTimer);draftTimer=null;
 draftWriteChain=draftWriteChain.catch(()=>{}).then(async()=>{
  try{await checked(db.from('crm_quote_drafts').upsert(row,{onConflict:'business_id,user_id,draft_key'}));if(activeDraftKey===row.draft_key)$('draftStatus').textContent='✓ Taslak hesabınıza kaydedildi · '+new Date(row.updated_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'});}
  catch(error){if(activeDraftKey===row.draft_key)$('draftStatus').textContent=localOK?'Taslak bu cihazda kayıtlı. Hesaba eşitleme için bağlantınızı kontrol edin.':'Taslak kaydedilemedi: '+error.message;}
 });return draftWriteChain;
}
async function clearDraft(key){clearTimeout(draftTimer);draftTimer=null;await draftWriteChain;await checked(db.from('crm_quote_drafts').delete().eq('business_id',state.business.id).eq('user_id',user.id).eq('draft_key',key));state.drafts=state.drafts.filter(d=>d.draft_key!==key);try{localStorage.setItem(draftStorageKey(),JSON.stringify(state.drafts));}catch{}$('resumeDraft').hidden=!state.drafts.length;}
$('quoteDialog').addEventListener('close',()=>{recognition?.abort();if(suppressDraftClose){suppressDraftClose=false;return;}if(activeDraftKey){const row=state.drafts.find(d=>d.draft_key===activeDraftKey);if(row)persistDraft(row);}});
$('resumeDraft').onclick=()=>{$('draftsList').innerHTML=state.drafts.map(d=>`<div class="draft-row"><div><strong>${e(d.payload.title||'Başlıksız teklif')}</strong><small>${e(customer(d.payload.customer_id)?.name||'Müşteri seçilmedi')} · ${new Date(d.updated_at).toLocaleString('tr-TR')}</small></div>${action('Devam et','resume-draft',d.draft_key)}</div>`).join('')||empty('Taslak yok','Yarım kalan teklifler burada görünür.');open('draftsDialog');};
$('discardDraft').onclick=async()=>{if(!confirm('Bu teklifin taslağını silip boş form ile yeniden başlamak istiyor musunuz?'))return;try{const f=$('quoteForm'),cid=field(f,'customer_id').value,qid=field(f,'quote_id').value;await clearDraft(activeDraftKey);newQuote(cid,qid||null,true);}catch(error){$('draftStatus').textContent=error.message;}};
// Payment corrections -------------------------------------------------------
function showCorrection(id){const p=state.payments.find(p=>p.id===id);if(!p||p.voided_at)return;const f=$('correctionForm');f.reset();field(f,'payment_id').value=id;field(f,'replacement_id').value=recordId();field(f,'amount').value=p.amount_cents/100;field(f,'paid_on').value=p.paid_on;field(f,'paid_on').max=today();field(f,'method').value=p.method;field(f,'memo').value=p.memo;f.querySelector('.form-message').textContent='';$('correctionSummary').textContent=`Mevcut kayıt: ${money(p.amount_cents)} · ${dateLabel(p.paid_on)}`;updateCorrectionFields();open('correctionDialog');}
function updateCorrectionFields(){const isVoid=field($('correctionForm'),'mode').value==='void';$('correctionFields').hidden=isVoid;$('correctionFields').querySelectorAll('input,select,textarea').forEach(input=>input.disabled=isVoid);}
field($('correctionForm'),'mode').onchange=updateCorrectionFields;
$('correctionForm').onsubmit=event=>{event.preventDefault();const f=event.currentTarget;submitForm(f,async()=>{const isVoid=field(f,'mode').value==='void';await checked(db.rpc('crm_correct_payment',{p_payment:field(f,'payment_id').value,p_reason:field(f,'reason').value.trim(),p_amount:isVoid?null:decimalUnits(field(f,'amount').value),p_date:isVoid?null:field(f,'paid_on').value,p_method:isVoid?null:field(f,'method').value,p_memo:isVoid?null:field(f,'memo').value.trim(),p_replacement:isVoid?null:field(f,'replacement_id').value}));await load();$('correctionDialog').close();if($('viewDialog').open)showQuote(viewVersion);showStatus('Tahsilat güncellendi. Eski kayıt işlem geçmişinde korundu.');});};
// Calendar ------------------------------------------------------------------
function calendarEvents(){return [...state.notes.filter(n=>!n.done&&n.remind_on).map(n=>({day:n.remind_on,title:n.body,customerId:n.customer_id,type:'Hatırlatma',id:n.id})),...state.quotes.map(q=>({q,v:latest(q)})).filter(({v})=>v&&!v.response).map(({q,v})=>({day:v.valid_until,title:v.document.title,customerId:q.customer_id,type:'Teklif son günü',versionId:v.id}))].filter(event=>searchMatch(event.title+' '+(customer(event.customerId)?.name||'')));}
function renderCalendar(){
 const events=calendarEvents(),start=new Date(state.calendarMonth+'-01T12:00:00'),count=new Date(start.getFullYear(),start.getMonth()+1,0).getDate(),offset=(start.getDay()+6)%7;
 const monthEvents=events.filter(ev=>ev.day.startsWith(state.calendarMonth)),selected=state.calendarDay.startsWith(state.calendarMonth)?state.calendarDay:state.calendarMonth+'-01';
 const agenda=monthEvents.filter(ev=>ev.day===selected);
 $('content').innerHTML=`<div class="panel"><div class="calendar-heading">${action('←','calendar-prev','')}<h3>${start.toLocaleDateString('tr-TR',{month:'long',year:'numeric'})}</h3>${action('→','calendar-next','')}</div><div class="calendar-grid">${['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(day=>`<span class="calendar-weekday">${day}</span>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:count},(_,i)=>{const day=state.calendarMonth+'-'+String(i+1).padStart(2,'0'),items=monthEvents.filter(ev=>ev.day===day);return `<button data-action="calendar-day" data-id="${day}" class="calendar-date ${day===today()?'today':''} ${day===selected?'selected':''}" aria-label="${dateLabel(day)}: ${items.length} kayıt" aria-pressed="${day===selected}"><strong>${i+1}</strong><small>${items.length?items.length+' kayıt':''}</small></button>`;}).join('')}</div><div id="calendarAgenda"><h3>${dateLabel(selected)}</h3>${agenda.map(ev=>`<div class="reminder"><div><span class="badge">${ev.type}</span><p>${e(ev.title)}</p><small>${e(customer(ev.customerId)?.name)}</small></div>${ev.versionId?action('Teklif','view',ev.versionId):action('Dosya','customer',ev.customerId)}</div>`).join('')||'<p class="muted">Bu gün için kayıt yok.</p>'}</div></div><div class="panel"><h3>Bu ayın işleri ve hatırlatmaları</h3>${monthEvents.sort((a,b)=>a.day.localeCompare(b.day)).map(ev=>`<div class="reminder"><div><p>${e(ev.title)}</p><small>${dateLabel(ev.day)} · ${e(customer(ev.customerId)?.name)} · ${ev.type}</small></div>${action('Aç',ev.versionId?'view':'customer',ev.versionId||ev.customerId)}</div>`).join('')||'<p class="muted">Müşteri dosyasına tarihli not eklediğinizde burada görünür.</p>'}<p class="muted">Hatırlatmalar bu panelde gösterilir.</p></div>`;
}
// Speech input: explicit microphone button; every result is reviewed by owner.
let recognition=null;
$('voiceStart').onclick=()=>{const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;if(!Speech){$('voiceStatus').textContent='Bu tarayıcı ses tanımayı desteklemiyor. Telefon klavyenizin mikrofonunu kullanabilir veya metni yazabilirsiniz.';return;}if(recognition){recognition.stop();return;}recognition=new Speech();recognition.lang='tr-TR';recognition.interimResults=true;recognition.continuous=false;recognition.onstart=()=>{$('voiceStart').textContent='■ Dinlemeyi bitir';$('voiceStatus').textContent='Dinleniyor… İşi ve toplam fiyatı söyleyin.';};recognition.onresult=event=>{$('voiceText').value=Array.from(event.results).map(result=>result[0].transcript).join(' ').slice(0,5000);queueDraft();};recognition.onerror=event=>{$('voiceStatus').textContent=event.error==='not-allowed'?'Mikrofon izni verilmedi. Metni yazarak devam edebilirsiniz.':'Ses alınamadı. Yeniden deneyin veya metni yazın.';};recognition.onend=()=>{recognition=null;$('voiceStart').textContent='🎙 Konuşarak doldur';};try{recognition.start();}catch{$('voiceStatus').textContent='Mikrofon başlatılamadı.';recognition=null;}};
$('voiceApply').onclick=()=>{const raw=$('voiceText').value.trim();if(!raw){$('voiceStatus').textContent='Önce konuşun veya metni yazın.';return;}const f=$('quoteForm');if(field(f,'title').value.trim()&&!confirm('Başlık ve iş kapsamını bu metinle doldurmak istiyor musunuz?'))return;const parsed=parseSpokenQuote(raw,state.customers);if(parsed.customer_id&&!field(f,'customer_id').disabled)field(f,'customer_id').value=parsed.customer_id;field(f,'title').value=parsed.title;field(f,'terms').value=parsed.terms;if(parsed.unit_price_cents!==null){$('quoteLines').replaceChildren();addLine({name:parsed.title,quantity:1,unit_price_cents:parsed.unit_price_cents});}$('voiceStatus').textContent=parsed.unit_price_cents===null?'Metin aktarıldı. Toplam fiyat anlaşılamadı; fiyatı elle girin.':'Metin ve toplam fiyat aktarıldı. Müşteriyi, fiyatı ve iş kapsamını kontrol edin.';updateCalculation();queueDraft();};

// Sector profiles -----------------------------------------------------------
function sectorInputHTML(descriptor,value=''){
 const {key,label,type,options}=descriptor,attrs=`data-sector-key="${e(key)}" aria-label="${e(label)}"`;
 const control=type==='select'?`<select ${attrs}><option value="">Seçin (isteğe bağlı)</option>${options.map(option=>`<option value="${e(option)}" ${option===value?'selected':''}>${e(option)}</option>`).join('')}</select>`:type==='textarea'?`<textarea ${attrs} maxlength="400" rows="2">${e(value)}</textarea>`:`<input ${attrs} type="${type==='date'?'date':'text'}" maxlength="400" value="${e(value)}">`;
 return `<label>${e(label)}${control}</label>`;
}
function readSectorFields(id){return Object.fromEntries([...$(id).querySelectorAll('[data-sector-key]')].map(input=>[input.dataset.sectorKey,input.value.trim()]));}
function renderCustomerFields(c){
 const p=profile(),data=customerSectorData(c,state.sector);
 $('customerSectorFields').innerHTML=`<label>Takip aşaması<select data-sector-key="stage" aria-label="Takip aşaması">${p.stages.map(([key,label])=>`<option value="${key}" ${sectorStage(c,state.sector)[0]===key?'selected':''}>${e(label)}</option>`).join('')}</select></label>`+p.customerFields.map(f=>sectorInputHTML(f,data[f.key]||'')).join('');
}
function renderQuoteSectorFields(values={}){
 const p=sectorProfile(activeQuoteSector);$('quoteSectorFields').innerHTML=p.quoteFields.map(f=>sectorInputHTML(f,values[f.key]||'')).join('');$('quoteSectorFields').hidden=!p.quoteFields.length;
 $('quoteTemplateName').textContent='Teklif şablonu: '+p.name;$('quoteCustomerLabel').textContent=p.customer;
 field($('quoteForm'),'title').placeholder=p.quotePlaceholder;document.querySelector('#quoteForm .line-heading h3').textContent=p.catalog;
}
function fillQuoteSectorFromCustomer(force=false){
 const f=$('quoteForm');if(field(f,'customer_id').disabled)return;
 const data=customerSectorData(customer(field(f,'customer_id').value),activeQuoteSector);
 $('quoteSectorFields').querySelectorAll('[data-sector-key]').forEach(input=>{if(force||!input.value)input.value=data[input.dataset.sectorKey]||'';});
}
field($('quoteForm'),'customer_id').addEventListener('change',()=>{fillQuoteSectorFromCustomer(true);queueDraft();});
function customerSectorSummary(c){const p=profile(),data=customerSectorData(c,state.sector);return `<section class="customer-sector-summary"><span class="badge">${e(sectorStage(c,state.sector)[1])}</span><dl>${p.customerFields.filter(f=>data[f.key]).map(f=>`<div><dt>${e(f.label)}</dt><dd>${e(data[f.key])}</dd></div>`).join('')}</dl></section>`;}
function applySectorLabels(){
 const p=profile();$('chooseSector').textContent=p.name+' ▾';$('sectorBannerTitle').textContent=state.sectorConfigured?p.icon+' '+p.name+' çalışma alanı':'İşletmenize uygun çalışma alanını seçin';$('sectorBannerText').textContent=state.sectorConfigured?p.description:'Sektörünüze özel kayıt alanlarını ve teklif şablonunu kullanın.';$('sectorBannerChoose').textContent=state.sectorConfigured?'Sektörü değiştir':'Sektörümü seç';
 document.querySelector('[data-tab="customers"] span').textContent=p.customers;document.querySelector('[data-tab="products"] span').textContent=p.catalog;document.querySelector('[data-tab="quotes"] span').textContent=({general:'Tekliflerim',driving_school:'Kurs Teklifleri',education:'Eğitim Teklifleri',wholesale:'Satış Teklifleri'})[state.sector];
 document.querySelector('[data-goto="customers"]>span').textContent=p.customer;
 $('newCustomer').textContent='＋ '+p.customer+' ekle';$('newQuote').textContent='＋ '+p.quote;
 const headings={general:'İşinizin tüm ayrıntıları,\ntek bir yerde.',driving_school:'Adaydan kayda,\nher görüşme takipte.',education:'Veli görüşmesinden kayda,\ntüm bilgiler bir arada.',wholesale:'Tekliften siparişe,\nişiniz takipte.'};$('pageTitle').textContent=headings[state.sector];
 $('stageFilterLabel').hidden=state.tab!=='customers';const filter=$('customerStageFilter');filter.innerHTML='<option value="">Tüm aşamalar</option>'+p.stages.map(([key,label])=>`<option value="${key}">${e(label)}</option>`).join('');filter.value=state.customerStage;
 $('search').placeholder=state.tab==='customers'?p.customer+' veya telefon ara…':'Kayıt veya teklif ara…';
}
$('customerStageFilter').onchange=event=>{state.customerStage=event.target.value;render();};
function showSectorPicker(){if(!state.ready)return;$('sectorForm').querySelector('.form-message').textContent='';$('sectorChoices').innerHTML=Object.entries(SECTORS).map(([key,p])=>`<label class="sector-choice"><input type="radio" name="sector" value="${key}" ${state.sector===key?'checked':''} required><span class="sector-icon" aria-hidden="true">${p.icon}</span><strong>${e(p.name)}</strong><small>${e(p.description)}</small></label>`).join('');open('sectorDialog');}
$('chooseSector').onclick=showSectorPicker;$('sectorBannerChoose').onclick=showSectorPicker;
$('sectorForm').onsubmit=event=>{event.preventDefault();const form=event.currentTarget;submitForm(form,async()=>{const sector=new FormData(form).get('sector');if(!SECTORS[sector])throw Error('Geçerli bir sektör seçin.');await checked(db.from('crm_ledger_settings').upsert({business_id:state.business.id,sector,updated_at:new Date().toISOString()},{onConflict:'business_id'}));state.customerStage='';await load();$('sectorDialog').close();showStatus(SECTORS[sector].name+' çalışma alanı açıldı. Kayıt geçmişiniz korundu.');});};

$('refresh').onclick=()=>load().catch(error=>showStatus(error.message,true));
async function selectBusiness(id){document.querySelectorAll('dialog[open]').forEach(d=>d.close());state.business=state.businesses.find(b=>b.id===id);$('businessLabel').textContent=state.business.name;const back=new URL('kartim.html',location.href);back.searchParams.set('business_id',id);$('backToCard').href=back.href;const url=new URL(location.href);url.searchParams.set('business_id',id);history.replaceState(null,'',url);await load();}
try{
 db=await client();user=await currentUser(db);if(!user){location.replace('giris.html?next='+encodeURIComponent('musteri-defterim.html'+location.search));throw Error('Giriş sayfasına yönlendiriliyorsunuz.');}
 const admin=await checked(db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle());
 let query=db.from('businesses').select('id,name,owner_id,active,created_at').order('active',{ascending:false}).order('created_at',{ascending:false});if(!admin)query=query.eq('owner_id',user.id);
 state.businesses=await checked(query);if(!state.businesses.length)throw Error('Önce İşletme Kartım bölümünden işletmenizi oluşturun.');
 const select=$('businessSelect');select.innerHTML=state.businesses.map(b=>`<option value="${b.id}">${e(b.name)}</option>`).join('');select.hidden=state.businesses.length<2;select.onchange=()=>selectBusiness(select.value).catch(error=>showStatus(error.message,true));
 const requested=new URLSearchParams(location.search).get('business_id');if(requested&&!state.businesses.some(b=>b.id===requested))throw Error('Bu işletmenin defterine erişim yetkiniz yok.');
 select.value=requested||state.businesses[0].id;await selectBusiness(select.value);
}catch(error){showStatus(error.message,true);}
