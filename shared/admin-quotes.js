import {client,currentUser} from './supabase-client.js';
import {escapeHTML as e,money,dateLabel,documentHTML,printDocument} from './ledger-core.mjs?v=3';
import {quoteRows,filterQuotes,quoteSummary,quoteState,quoteStates} from './admin-quotes-core.mjs?v=1';
const $=id=>document.getElementById(id),pageSize=25;
let db,rows=[],page=0,busy=false,detailRequest=0,detailVersions=[],detailPayments=[],detailRow;
function status(text,bad=false){$('loadState').hidden=!text;$('loadState').textContent=text;$('loadState').className='notice'+(bad?' error':'');}
async function checked(query){const {data,error}=await query;if(error)throw error;return data;}
async function all(table,columns,where){let output=[];for(let start=0;;start+=1000){let query=db.from(table).select(columns).order('id',{ascending:true});if(where)query=where(query);const batch=await checked(query.range(start,start+999));output.push(...batch);if(batch.length<1000)return output;}}
function filters(){return {business:$('businessFilter').value,status:$('statusFilter').value,from:$('fromDate').value,to:$('toDate').value,search:$('search').value};}
function render(){
 const selected=filters(),invalid=!!(selected.from&&selected.to&&selected.from>selected.to);$('filterError').hidden=!invalid;
 const list=invalid?[]:filterQuotes(rows,selected),summary=quoteSummary(list);page=Math.max(0,Math.min(page,Math.ceil(list.length/pageSize)-1));
 $('statCount').textContent=summary.count;$('statTotal').textContent=money(summary.total);$('statPaid').textContent=money(summary.paid);$('statRemaining').textContent=money(summary.receivable);
 $('resultCount').textContent=list.length+' teklif';$('previous').disabled=page===0;$('next').disabled=(page+1)*pageSize>=list.length;$('pageLabel').textContent=list.length?'Sayfa '+(page+1)+' / '+Math.ceil(list.length/pageSize):'0 teklif';
 $('results').innerHTML=list.length?`<div class="list-table"><table class="quote-table"><thead><tr><th>İŞLETME / MÜŞTERİ</th><th>TEKLİF</th><th>SON SÜRÜM TARİHİ</th><th>DURUM</th><th>TOPLAM</th><th>TAHSİLAT / KALAN</th><th></th></tr></thead><tbody>${list.slice(page*pageSize,(page+1)*pageSize).map(r=>`<tr><td data-label="İşletme / Müşteri"><strong>${e(r.business_name)}</strong><small>${e(r.version.customer_name||'Müşteri')}</small></td><td data-label="Teklif">${e(r.version.title)}<small>#${e(r.id.slice(0,8).toUpperCase())} · Sürüm ${r.current_revision}</small></td><td data-label="Son sürüm tarihi">${e(dateLabel(r.day))}</td><td data-label="Durum"><span class="badge">${e(quoteStates[quoteState(r.version)])}</span></td><td data-label="Toplam" class="amount"><strong>${e(money(r.total))}</strong></td><td data-label="Tahsilat / Kalan" class="amount">${e(money(r.paid))}<small>Kalan ${e(money(r.remaining))}</small></td><td data-label="İşlem"><button type="button" class="secondary" data-quote="${e(r.id)}">Ayrıntıyı aç</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty-result">${invalid?'Tarih aralığını düzeltin.':rows.length?'Bu filtrelere uygun teklif bulunamadı.':'Henüz oluşturulmuş bir teklif yok.'}</div>`;
}
async function load(){if(busy)return;busy=true;$('refresh').disabled=true;$('dashboard').hidden=true;status('Teklifler ve tahsilatlar yükleniyor…');try{
 const [quotes,versions,payments,businesses]=await Promise.all([
  all('crm_quotes','id,business_id,current_revision,created_at'),
  all('crm_quote_versions','id,quote_id,revision,total_cents,valid_until,response,created_at,title:document->>title,customer_name:document->customer->>name'),
  all('crm_payments','id,quote_id,amount_cents',q=>q.is('voided_at',null)),
  all('businesses','id,name')
 ]);
 rows=quoteRows(quotes,versions,payments,businesses);const previous=$('businessFilter').value;
 $('businessFilter').innerHTML='<option value="">Tüm işletmeler</option>'+businesses.slice().sort((a,b)=>a.name.localeCompare(b.name,'tr')).map(b=>`<option value="${e(b.id)}">${e(b.name)}</option>`).join('');$('businessFilter').value=businesses.some(b=>b.id===previous)?previous:'';
 render();$('dashboard').hidden=false;status('');
 }catch(error){rows=[];status('Teklifler yüklenemedi: '+error.message,true);}finally{busy=false;$('refresh').disabled=false;}}
function renderDetail(){const version=detailVersions.find(v=>v.id===$('versionPicker').value);if(!version)return;const newest=version.revision===detailRow.current_revision;$('versionNote').textContent=newest?'Güncel sürüm · Tahsilatlar teklifin tamamına aittir.':'Önceki sürüm · Tahsilatlar teklifin tamamına aittir; güncel teklif tutarı '+money(detailRow.total)+'.';$('document').innerHTML=documentHTML(version,detailPayments);}
async function detail(id){const row=rows.find(r=>r.id===id);if(!row)return;const request=++detailRequest;detailRow=row;detailVersions=[];detailPayments=[];$('detailContent').hidden=true;$('document').replaceChildren();$('detailTitle').textContent=row.business_name+' · Teklif #'+row.id.slice(0,8).toUpperCase();$('detailState').textContent='Teklif dosyası yükleniyor…';$('quoteDetail').showModal();
 try{
 const [versions,payments]=await Promise.all([
 all('crm_quote_versions','id,quote_id,revision,document,total_cents,valid_until,response,created_at',q=>q.eq('quote_id',id)),
 all('crm_payments','id,quote_id,amount_cents,paid_on',q=>q.eq('quote_id',id).is('voided_at',null))
 ]);if(request!==detailRequest||!$('quoteDetail').open)return;
 detailVersions=versions.sort((a,b)=>b.revision-a.revision);
 if(!detailVersions.length)throw Error('Teklif sürümü bulunamadı.');detailPayments=payments;
 $('versionPicker').innerHTML=detailVersions.map(v=>`<option value="${e(v.id)}">Sürüm ${v.revision} · ${e(dateLabel(v.created_at))}${v.revision===row.current_revision?' · Güncel':''}</option>`).join('');$('businessLedger').href='musteri-defterim.html?business_id='+encodeURIComponent(row.business_id);$('detailContent').hidden=false;$('detailState').textContent='';renderDetail();
 }catch(error){if(request===detailRequest)$('detailState').textContent='Dosya açılamadı: '+error.message;}
}
$('results').onclick=event=>{const button=event.target.closest('[data-quote]');if(button)detail(button.dataset.quote);};
$('closeDetail').onclick=()=>$('quoteDetail').close();$('quoteDetail').addEventListener('close',()=>{detailRequest++;$('document').replaceChildren();});$('versionPicker').onchange=renderDetail;$('printQuote').onclick=()=>printDocument($('document').innerHTML);
$('filters').onsubmit=event=>event.preventDefault();$('filters').oninput=()=>{page=0;render();};$('filters').onchange=()=>{page=0;render();};$('filters').onreset=()=>{queueMicrotask(()=>{page=0;render();});};$('previous').onclick=()=>{page--;render();$('results').scrollIntoView({block:'start'});};$('next').onclick=()=>{page++;render();$('results').scrollIntoView({block:'start'});};$('refresh').onclick=load;
try{db=await client();const user=await currentUser(db);if(!user){location.replace('giris.html?next=admin-teklifler.html');throw Error('Oturum açmanız gerekiyor.');}const admin=await checked(db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle());if(!admin)throw Error('Bu ekran yalnızca ana yöneticiye açıktır.');await load();}catch(error){$('dashboard').hidden=true;status(error.message,true);}
