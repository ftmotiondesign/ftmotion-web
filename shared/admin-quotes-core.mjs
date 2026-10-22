export const quoteDay=value=>value?new Date(value).toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'}):'';
export function quoteState(version,today=quoteDay(new Date().toISOString())){
 return version.response==='accepted'?'accepted':version.response==='changes'?'changes':version.valid_until<today?'expired':'pending';
}
export const quoteStates={pending:'Yanıt bekliyor',accepted:'Onaylandı',changes:'Değişiklik istendi',expired:'Süresi doldu'};
export function quoteRows(quotes,versions,payments,businesses){
 const byVersion=new Map(versions.map(v=>[v.quote_id+':'+v.revision,v]));
 const byBusiness=new Map(businesses.map(b=>[b.id,b.name]));
 const paid=new Map();for(const p of payments)if(!p.voided_at)paid.set(p.quote_id,(paid.get(p.quote_id)||0)+Number(p.amount_cents));
 return quotes.filter(q=>q.current_revision>0).map(q=>{
  const version=byVersion.get(q.id+':'+q.current_revision);
  if(!version)throw Error('Bazı tekliflerin son sürümü alınamadı. Listeyi yenileyin.');
  const amount=Number(version.total_cents),received=paid.get(q.id)||0;
  return {...q,version,business_name:byBusiness.get(q.business_id)||'İşletme',total:amount,paid:received,remaining:Math.max(0,amount-received),day:quoteDay(version.created_at)};
 }).sort((a,b)=>b.version.created_at.localeCompare(a.version.created_at)||a.id.localeCompare(b.id));
}
export function filterQuotes(rows,{business='',status='',from='',to='',search=''}={},today){
 const query=search.trim().toLocaleLowerCase('tr-TR');
 return rows.filter(r=>(!business||r.business_id===business)&&(!status||quoteState(r.version,today)===status)&&(!from||r.day>=from)&&(!to||r.day<=to)&&(!query||[r.business_name,r.version.customer_name,r.version.title,r.id.slice(0,8)].join(' ').toLocaleLowerCase('tr-TR').includes(query)));
}
export function quoteSummary(rows){return rows.reduce((s,r)=>({count:s.count+1,total:s.total+r.total,paid:s.paid+r.paid,receivable:s.receivable+((r.version.response==='accepted'||r.paid>0)?r.remaining:0)}),{count:0,total:0,paid:0,receivable:0});}
