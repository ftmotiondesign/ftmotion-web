// Free, offline-only test engine. No production API, no personal data storage.
export function addContact(state,businessId,contact) {
  if(!businessId || !contact.name?.trim()) throw Error('İşletme ve ad gerekli');
  const email=(contact.email||'').trim().toLowerCase();
  const phone=(contact.phone||'').replace(/\D/g,'');
  if(!email&&!phone) throw Error('Telefon veya e-posta gerekli');
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('E-posta geçersiz');
  if(phone&&(phone.length<10||phone.length>15)) throw Error('Telefon geçersiz');
  if(state.some(x=>x.businessId===businessId&&((email&&x.email===email)||(phone&&x.phone===phone)))) throw Error('Bu işletmede müşteri mevcut');
  const entry={id:'demo-'+(state.length+1),businessId,name:contact.name.trim(),email,phone,consents:{whatsapp:false,email:false},history:[]};
  return [...state,entry];
}
export function recordConsent(state,businessId,id,channel,granted,noticeVersion='demo-v1'){
  if(!['whatsapp','email'].includes(channel)) throw Error('Kanal geçersiz');
  if(typeof granted!=='boolean') throw Error('İzin durumu geçersiz');
  if(!state.some(x=>x.businessId===businessId&&x.id===id)) throw Error('Müşteri bulunamadı');
  return state.map(x=>x.businessId===businessId&&x.id===id?{...x,consents:{...x.consents,[channel]:granted},history:[...x.history,{channel,granted,noticeVersion,at:new Date().toISOString()}]}:x);
}
export function listContacts(state,businessId){return state.filter(x=>x.businessId===businessId)}
export function eligible(state,businessId,channel){if(!['whatsapp','email'].includes(channel))throw Error('Kanal geçersiz');return listContacts(state,businessId).filter(x=>x.consents[channel]&&(channel==='whatsapp'?x.phone:x.email))}
