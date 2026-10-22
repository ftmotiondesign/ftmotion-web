import {handle} from './handler.ts';
const allowed=new Set(['https://ftmotion.com','https://www.ftmotion.com']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin');
 if(origin&&!allowed.has(origin))return new Response('Forbidden',{status:403});
 const cors={'Access-Control-Allow-Origin':origin||'https://ftmotion.com','Access-Control-Allow-Headers':'authorization, apikey, content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(!['GET','POST'].includes(req.method))return new Response('Method not allowed',{status:405,headers:cors});
 const result=await handle(req);const headers=new Headers(result.headers);for(const [k,v]of Object.entries(cors))headers.set(k,v);return new Response(result.body,{status:result.status,headers});
});
