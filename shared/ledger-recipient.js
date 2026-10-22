import {client} from './supabase-client.js';
import {documentHTML,printDocument,statusLabel,dateLabel} from './ledger-core.mjs';
const $=id=>document.getElementById(id),token=location.hash.slice(1);
let db,version;
async function load(){
 const {data,error}=await db.rpc('crm_shared_quote',{p_token:token});if(error)throw error;
 if(!data)throw Error('Teklif bağlantısı bulunamadı, süresi doldu veya işletme tarafından kapatıldı.');
 version=data;$('recipientDocument').innerHTML=documentHTML(data,data.payments);
 $('recipientBadge').textContent=statusLabel(data);$('recipientApp').hidden=false;
 const stale=data.revision!==data.current_revision,expired=data.valid_until<new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Istanbul'});
 $('responsePanel').hidden=!!data.response||stale||expired;
 $('recipientStatus').textContent=stale?'Bu teklifin daha yeni bir sürümü var. Güncel teklif için işletmeyle iletişime geçin.':data.response?`Yanıtınız: ${statusLabel(data)} · ${dateLabel(data.responded_at)}${data.response_note?' · '+data.response_note:''}`:expired?'Teklifin geçerlilik süresi doldu. İşletmeden yeni teklif isteyebilirsiniz.':'';
}
$('recipientPrint').onclick=()=>printDocument(documentHTML(version,version.payments));
$('responseForm').addEventListener('submit',async event=>{
 event.preventDefault();const response=event.submitter?.value;if(!response)return;
 const note=new FormData(event.currentTarget).get('note').trim();
 if(response==='changes'&&!note){$('recipientStatus').textContent='İstediğiniz değişikliği not alanına yazın.';return;}
 if(response==='accepted'&&!confirm('Bu teklifin belirtilen sürümünü onaylıyor musunuz?'))return;
 const buttons=[...event.currentTarget.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
 try{const {error}=await db.rpc('crm_respond_quote',{p_token:token,p_response:response,p_note:note});if(error)throw error;await load();}catch(error){$('recipientStatus').textContent=error.message;}finally{buttons.forEach(b=>b.disabled=false);}
});
try{if(!/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(token))throw Error('Geçerli bir teklif bağlantısı gerekli. İşletmeden size gönderilen bağlantıyı açın.');db=await client();await load();}catch(error){$('recipientStatus').textContent=error.message;}
