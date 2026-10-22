const toggle=document.getElementById('mobileToggle'),links=document.getElementById('navlinks');
toggle.addEventListener('click',()=>{const open=links.classList.toggle('open');toggle.setAttribute('aria-expanded',String(open))});
links.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{links.classList.remove('open');toggle.setAttribute('aria-expanded','false')}));
try{
 const {client}=await import('../shared/supabase-client.js');
 const db=await client(),{data,error}=await db.auth.getSession();
 if(!error&&data?.session?.user){
  document.getElementById('hubSession').textContent='FTMotion oturumunuz açık. İşletme Kartım ve müşteri takibine mevcut hesabınızla devam edebilirsiniz. Eğitim, kendi kurum hesabınızla açılır.';
  const member=document.getElementById('memberNav');member.textContent='Kartımı yönet ↗';member.href='/kartim.html';
 }
}catch{ /* Links remain available when session lookup cannot complete. */ }
