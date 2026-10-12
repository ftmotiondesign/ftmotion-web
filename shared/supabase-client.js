import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
let cache; export async function client(){if(cache)return cache;let response=await fetch('/supabase-config.json',{cache:'no-store'});if(!response.ok)throw Error('Supabase ayar dosyası bulunamadı');let cfg=await response.json();if(!/^https:\/\//.test(cfg.url||'')||!cfg.anonKey)throw Error('Supabase ayarları eksik');cache=createClient(cfg.url,cfg.anonKey);return cache}
export async function currentUser(db){const {data,error}=await db.auth.getUser();if(error)throw error;return data.user}
export function message(error){return error?.message||String(error)}
