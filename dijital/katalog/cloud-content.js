(function(){
 const cfg=window.FT_CLOUD||{};
 const ready=()=>/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(cfg.url||'')&&!!cfg.anonKey;
 const base=()=>cfg.url.replace(/\/$/,'');
 const headers=(token)=>({'apikey':cfg.anonKey,'Authorization':'Bearer '+(token||cfg.anonKey),'Content-Type':'application/json'});
 async function req(path,opts={},token){if(!ready())throw Error('Supabase ayarları eksik');const res=await fetch(base()+path,{...opts,headers:{...headers(token),...(opts.headers||{})}});const txt=await res.text();let data;try{data=txt?JSON.parse(txt):null}catch{data=txt}if(!res.ok)throw Error(data?.message||data?.error||('HTTP '+res.status));return data}
 const keys=['categories','campaigns','settings'];
 window.FTContent={ready,
  read:async()=>{const rows=await req('/rest/v1/ft_content?select=key,payload');return Object.fromEntries(rows.map(x=>[x.key,x.payload]))},
  write:async(token,key,payload)=>{if(!keys.includes(key))throw Error('Geçersiz anahtar');return req('/rest/v1/ft_content?on_conflict=key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({key,payload})},token)},
  keys
 };
})();
