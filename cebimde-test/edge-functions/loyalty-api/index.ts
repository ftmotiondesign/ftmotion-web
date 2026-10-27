// Private Cebimde loyalty endpoint; development branch only, NOT deployed.
// Requires LOYALTY_DATABASE_URL: direct PostgreSQL connection string stored ONLY as
// an Edge Function secret. Never expose the connection string in browser code.
// Requires SUPABASE_URL and SUPABASE_ANON_KEY for authoritative JWT validation.
// POST {action:"issue", membership_id}, {action:"confirm",token}, or
// {action:"redeem",membership_id}. The owner/customer identity comes ONLY from JWT.
// Requires a private DB role with limited EXECUTE permissions, not postgres admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";
import postgres from "https://deno.land/x/postgresjs@v3.4.5/mod.js";
const json=(code:number,payload:unknown)=>new Response(JSON.stringify(payload),{
 status:code,headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tokenPattern=/^[A-Za-z0-9_-]{43}$/;
const sha256=async(s:string)=>{
 const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
};
Deno.serve(async(req)=>{
 if(req.method!=="POST") return json(405,{error:"Method not allowed"});
 const url=Deno.env.get("SUPABASE_URL"),key=Deno.env.get("SUPABASE_ANON_KEY");
 const dbUrl=Deno.env.get("LOYALTY_DATABASE_URL");
 if(!url||!key||!dbUrl) return json(503,{error:"Service not configured"});
 const bearer=req.headers.get("Authorization")?.match(/^Bearer (\S+)$/);
 if(!bearer) return json(401,{error:"Login required"});
 const auth=createClient(url,key,{auth:{persistSession:false}});
 const {data,error}=await auth.auth.getUser(bearer[1]);
 if(error||!data.user) return json(401,{error:"Invalid session"});
 let body:Record<string,unknown>;
 try {body=await req.json();}catch{return json(400,{error:"Invalid JSON"});}
 if(!body||typeof body!=="object"||Array.isArray(body)) return json(400,{error:"Invalid body"});
 const action=body.action;
 if(!["issue","confirm","redeem"].includes(String(action))) return json(400,{error:"Invalid action"});
 const sql=postgres(dbUrl,{max:1,prepare:false,connect_timeout:5,idle_timeout:1});
 try{
  if(action==="issue"){
   if(typeof body.membership_id!=="string"||!uuid.test(body.membership_id)) return json(400,{error:"Invalid membership"});
   const raw=crypto.getRandomValues(new Uint8Array(32));
   const token=btoa(String.fromCharCode(...raw)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
   const hash=await sha256(token);
   const rows=await sql`select cebimde_loyalty.issue_visit_token(${body.membership_id}::uuid,${data.user.id}::uuid,${hash}::text) as expires_at`;
   return json(200,{kind:"cebimde_visit",version:1,token,expires_at:rows[0].expires_at});
  }
  if(action==="confirm"){
   if(typeof body.token!=="string"||!tokenPattern.test(body.token)) return json(400,{error:"Invalid token"});
   const hash=await sha256(body.token);
   const rows=await sql`select cebimde_loyalty.confirm_visit(${hash}::text,${data.user.id}::uuid) as visit_id`;
   return json(200,{visit_id:rows[0].visit_id});
  }
  if(typeof body.membership_id!=="string"||!uuid.test(body.membership_id)) return json(400,{error:"Invalid membership"});
  const rows=await sql`select cebimde_loyalty.redeem_reward(${body.membership_id}::uuid,${data.user.id}::uuid) as redemption_id`;
  return json(200,{redemption_id:rows[0].redemption_id});
 }catch(_error){
  // Avoid exposing membership existence, database details, and internal SQL errors.
  return json(403,{error:"Operation rejected"});
 }finally{await sql.end({timeout:1});}
});
