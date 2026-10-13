(function(){
 const cfg=window.FT_CLOUD||{};
 const ready=()=>/^https:\/\/[\w.-]+\.supabase\.co\/?$/.test(cfg.url||'')&&!!cfg.anonKey;
 const base=()=>cfg.url.replace(/\/$/,'');
 const headers=(token)=>({'apikey':cfg.anonKey,'Authorization':'Bearer '+(token||cfg.anonKey),'Content-Type':'application/json'});
 async function request(path,options={}){
   const res=await fetch(base()+path,{...options,headers:{...headers(options.token),...(options.headers||{})}});
   const raw=await res.text();let data;try{data=raw?JSON.parse(raw):null}catch{data=raw}
   if(!res.ok)throw Error((data&& (data.message||data.error_description||data.error))||('HTTP '+res.status));
   return data;
 }
 window.FTOrders={ready,
   submit:async item=>{if(!ready())throw Error('Bulut bağlantısı kurulmamış');return request('/rest/v1/ft_orders',{method:'POST',headers:{'Prefer':'return=minimal'},body:JSON.stringify({kind:item.kind,category:item.category,service:item.service,customer_name:item.name,phone:item.phone,email:item.email||null,note:item.note||null})})},
   login:async(email,password)=>request('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})}),
   list:async(token)=>request('/rest/v1/ft_orders?select=*&order=created_at.desc&limit=500',{token}),
   status:async(token,id,status)=>request('/rest/v1/ft_orders?id=eq.'+encodeURIComponent(id),{method:'PATCH',token,headers:{Prefer:'return=minimal'},body:JSON.stringify({status})})
 };
})();
