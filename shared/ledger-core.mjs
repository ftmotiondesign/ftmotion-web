import {activePayments} from './ledger-workflow.mjs?v=2';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = cents => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(cents||0)/100);
export const dateLabel = value => value ? new Date(value.length===10 ? value+'T12:00:00' : value).toLocaleDateString('tr-TR') : '—';
export function decimalUnits(value,places=2){
 const str=String(value).trim().replace(',','.');
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+places+'})?$').test(str))throw Error('Geçerli bir pozitif sayı girin.');
 const [whole,fraction='']=str.split('.');
 const result=Number(whole)*10**places+Number(fraction.padEnd(places,'0'));
 if(!Number.isSafeInteger(result))throw Error('Tutar çok yüksek.');
 return result;
}
export function calculate(items,discount=0,vat=0){
 if(!items.length||items.length>100)throw Error('1–100 iş kalemi ekleyin.');
 let subtotal=0n;
 for(const row of items){
  const qty=decimalUnits(row.quantity,3),price=row.unit_price_cents;
  if(!String(row.name||'').trim()||String(row.name).length>300||qty<=0||qty>100000000||!Number.isSafeInteger(price)||price<0||price>100000000000)throw Error('İş kalemi, miktar veya fiyatı kontrol edin.');
  subtotal+=(BigInt(qty)*BigInt(price)+500n)/1000n;
 }
 if(!Number.isSafeInteger(discount)||discount<0||BigInt(discount)>subtotal)throw Error('İndirim ara toplamı aşamaz.');
 const rate=decimalUnits(vat,2);if(rate>10000)throw Error('KDV %0–100 arasında olmalı.');
 const tax=((subtotal-BigInt(discount))*BigInt(rate)+5000n)/10000n;
 const total=subtotal-BigInt(discount)+tax;
 if(total>1000000000000n)throw Error('Teklif tutarı çok yüksek.');
 return {subtotal_cents:Number(subtotal),discount_cents:discount,vat_cents:Number(tax),total_cents:Number(total)};
}
export function whatsappPhone(phone){
 let p=String(phone||'').replace(/\D/g,'');if(p.startsWith('00'))p=p.slice(2);if(p.length===11&&p[0]==='0')p='90'+p.slice(1);else if(p.length===10)p='90'+p;
 return /^\d{10,15}$/.test(p)?p:'';
}
export function statusLabel(version){return version?.response==='accepted'?'Onaylandı':version?.response==='changes'?'Değişiklik istendi':version?.valid_until<new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'})?'Süresi doldu':'Yanıt bekliyor';}
export function documentHTML(v,payments=[]){
 payments=activePayments(payments);const d=v.document,e=escapeHTML,paid=payments.reduce((s,p)=>s+Number(p.amount_cents),0);
 const logo=/^https:\/\//i.test(d.business.logo_url||'')?`<img class="doc-logo" src="${e(d.business.logo_url)}" alt="${e(d.business.name)} logosu" referrerpolicy="no-referrer">`:'';
 return `<article class="quote-document"><div class="doc-head"><div>${logo}<h2>${e(d.business.name)}</h2><p>${e(d.business.phone)} ${e(d.business.email)}</p><p>${e(d.business.address)}</p></div><div class="doc-number"><b>TEKLİF FORMU</b><p>#${e(v.quote_id.slice(0,8).toUpperCase())} · Sürüm ${v.revision}</p><p>${dateLabel(v.created_at)}</p></div></div><div class="doc-customer"><small>SAYIN</small><h3>${e(d.customer.name)}</h3><p>${e(d.customer.phone)} ${e(d.customer.email)}</p><p>${e(d.customer.address)}</p></div><h2>${e(d.title)}</h2><div class="table-scroll"><table><thead><tr><th>Ürün / Hizmet</th><th>Miktar</th><th>Birim fiyat</th><th>Tutar</th></tr></thead><tbody>${d.items.map(r=>`<tr><td>${e(r.name)}</td><td>${e(r.quantity)}</td><td>${money(r.unit_price_cents)}</td><td>${money(r.line_cents)}</td></tr>`).join('')}</tbody></table></div><div class="doc-totals"><p><span>Ara toplam</span><b>${money(d.subtotal_cents)}</b></p><p><span>İndirim</span><b>${money(d.discount_cents)}</b></p><p><span>KDV (%${e(d.vat_percent)})</span><b>${money(d.vat_cents)}</b></p><p class="grand"><span>Genel toplam</span><b>${money(d.total_cents)}</b></p></div><div class="doc-terms"><b>Şartlar ve iş kapsamı</b><p>${e(d.terms||'Ek şart belirtilmedi.')}</p><p><b>Teklif geçerlilik tarihi:</b> ${dateLabel(v.valid_until)}</p></div><div class="doc-payment"><h3>${v.current_revision&&v.revision!==v.current_revision?'Güncel işin ödeme özeti':'Ödeme özeti'}</h3>${payments.map(p=>`<p>${dateLabel(p.paid_on)} <b>${money(p.amount_cents)}</b></p>`).join('')||'<p>Henüz ödeme kaydedilmedi.</p>'}<p>Alınan ödeme <b>${money(paid)}</b></p><p>Kalan tutar <b>${money((v.current_total_cents??d.total_cents)-paid)}</b></p><small>Ödeme kaydı fatura veya resmî makbuz yerine geçmez.</small></div><footer class="doc-footer">${e(d.business.name)} · Teklif #${e(v.quote_id.slice(0,8).toUpperCase())} / ${v.revision}</footer></article>`;
}
export function printDocument(html){
 let target=document.getElementById('ledgerPrint');if(!target){target=document.createElement('div');target.id='ledgerPrint';document.body.append(target);}target.innerHTML=html;
 window.print();
}

export function recordId(){if(crypto.randomUUID)return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');}
