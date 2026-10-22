(()=>{'use strict';
const ROOT='/dijirehber/',nativeFetch=window.fetch.bind(window);
let deferred=null,phase='checking',detail='',dialog=null,checking=null,waitTimer=null;
const health={secure:window.isSecureContext===true,manifest:false,worker:false};
const standalone=()=>matchMedia('(display-mode:standalone)').matches||navigator.standalone===true;
const messages={checking:'Uygulama yüklemeye hazırlanıyor…',waiting:'Chrome’un uygulama yüklemesini etkinleştirmesi bekleniyor. Bu sayfayı açık tut.',ready:'Hazır. DijiRehber’i uygulama olarak yükleyebilirsin.',prompting:'Chrome’un yükleme penceresini onayla.',installing:'Yükleme isteği Chrome’a iletildi. İşlemin tamamlanması bekleniyor.',installed:'DijiRehber uygulama olarak yüklendi.',dismissed:'Yükleme iptal edildi.',error:'Yükleme hazırlanamadı.'};
function syncButton(button=document.getElementById('dijiInstall')){if(!button)return;if(standalone()||phase==='installed'){button.remove();return;}button.dataset.installState=phase;button.textContent=phase==='installing'?'DijiRehber yükleniyor…':'↓ DijiRehber’i yükle';button.disabled=phase==='installing'||phase==='prompting';}
function render(){syncButton();if(!dialog)return;dialog.querySelector('[data-status]').textContent=detail||messages[phase];const action=dialog.querySelector('[data-action]');action.hidden=['installed','installing','prompting','dismissed'].includes(phase);action.disabled=phase!=='ready'&&phase!=='error';action.textContent=phase==='ready'?'DijiRehber’i yükle':phase==='error'?'Tekrar dene':'Yükleme hazırlanıyor…';const note=dialog.querySelector('[data-note]');note.textContent=phase==='ready'?'Chrome’un açacağı pencerede Yükle seçeneğini onayla.':phase==='waiting'?'Bu düğme yalnızca gerçek uygulama yükleme penceresini açar. Chrome izin vermeden kısayol oluşturarak işlemi tamamlamaz.':'';}
function state(value,reason=''){phase=value;detail=reason;render();window.dispatchEvent(new Event('diji-pwa-state'));}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferred=event;clearTimeout(waitTimer);state('ready');});
window.addEventListener('appinstalled',()=>{deferred=null;clearTimeout(waitTimer);state('installed');});
window.addEventListener('pageshow',()=>{if(standalone())state('installed');});
function showDialog(){if(!dialog||!dialog.isConnected){dialog=document.createElement('dialog');dialog.id='dijiPwaInstall';dialog.setAttribute('aria-labelledby','dijiPwaTitle');dialog.style.cssText='max-width:410px;width:calc(100% - 48px);box-sizing:border-box;border:0;border-radius:22px;padding:28px;color:#244a40;font:15px/1.7 system-ui;box-shadow:0 20px 80px #0004';dialog.innerHTML='<img src="'+ROOT+'icons/dijirehber-192.png" alt="" width="68" height="68"><h2 id="dijiPwaTitle" style="line-height:1.25">DijiRehber’i yükle</h2><p data-status role="status" aria-live="polite"></p><p data-note style="font-size:13px;color:#60756a"></p><button data-action type="button" style="width:100%;padding:14px;border:0;border-radius:12px;background:#244a40;color:white;font:600 15px system-ui"></button><button data-close type="button" style="display:block;margin:16px auto 0;background:none;border:0;color:#244a40;font:14px system-ui">Kapat</button>';dialog.querySelector('[data-action]').onclick=()=>phase==='error'?check():requestInstall();dialog.querySelector('[data-close]').onclick=()=>dialog.close();document.body.append(dialog);}render();if(!dialog.open)dialog.showModal();}
function requestInstall(){
 if(standalone()||phase==='installed'){state('installed');return Promise.resolve();}
 if(!deferred){showDialog();if(phase==='error')return Promise.resolve();if(!checking)check();return Promise.resolve();}
 // Invoke prompt synchronously in this click handler; do not lose user activation to async checks.
 const event=deferred;deferred=null;state('prompting');let prompted;
 try{prompted=event.prompt();}catch{state('error','Chrome yükleme penceresini açamadı. Chrome menüsündeki Uygulamayı yükle seçeneğini kontrol et.');showDialog();return Promise.resolve();}
 return Promise.resolve(prompted).then(()=>event.userChoice).then(choice=>{if(phase==='installed')return;if(choice.outcome==='accepted')state('installing');else state('dismissed');}).catch(()=>{state('error','Yükleme isteği tamamlanamadı. Chrome menüsündeki Uygulamayı yükle seçeneğini kontrol et.');showDialog();});
}
async function check(){if(checking)return checking;if(deferred){state('ready');return;}checking=(async()=>{try{
 if(standalone()){state('installed');return;}
 if(!window.isSecureContext)throw Error('Uygulama yalnızca güvenli HTTPS bağlantısında yüklenebilir.');
 if(!('serviceWorker' in navigator))throw Error('Bu tarayıcı uygulama yüklemesini desteklemiyor. Bağlantıyı Chrome’da aç.');
 if(!deferred)state('checking');
 const registration=await navigator.serviceWorker.register(ROOT+'sw.js?v=4',{scope:ROOT,updateViaCache:'none'});await new Promise((resolve,reject)=>{let watched=null;const timer=setTimeout(()=>{cleanup();reject(Error('DijiRehber uygulama altyapısı etkinleşmedi. İnternet bağlantını kontrol edip tekrar dene.'))},15000);function cleanup(){clearTimeout(timer);registration.removeEventListener('updatefound',inspect);watched?.removeEventListener('statechange',inspect)}function inspect(){if(registration.active?.state==='activated'){cleanup();resolve(registration.active);return;}const worker=registration.installing||registration.waiting;if(worker?.state==='redundant'){cleanup();reject(Error('DijiRehber kurulum dosyaları yüklenemedi. Tekrar dene.'));return;}if(worker&&worker!==watched){watched?.removeEventListener('statechange',inspect);watched=worker;worker.addEventListener('statechange',inspect)}}registration.addEventListener('updatefound',inspect);inspect()});health.worker=true;
 const response=await nativeFetch(ROOT+'manifest.webmanifest?v=4',{cache:'reload'});if(!response.ok)throw Error('Uygulama bilgileri yüklenemedi. İnternet bağlantını kontrol et.');const manifest=await response.json();
 if(manifest.display!=='standalone'||!manifest.name||!manifest.icons?.some(i=>i.sizes==='512x512'&&i.type==='image/png'))throw Error('Uygulama yükleme bilgileri doğrulanamadı.');
 health.manifest=true;if(deferred){state('ready');return;}if(phase==='installed'||phase==='installing'||phase==='prompting')return;
 state('waiting');clearTimeout(waitTimer);waitTimer=setTimeout(()=>{if(phase==='waiting')state('waiting','Chrome bu sayfa için uygulama yükleme penceresini henüz açmadı. Chrome’un ⋮ menüsündeki Yükle seçeneğini kontrol et. Sayfayı yenilemen gerekmiyor.');},40000);
 }catch(error){if(!deferred)state('error',error.message||'Uygulama yüklenemedi. Tekrar dene.');}finally{checking=null;}})();return checking;}
window.DijiPwa={requestInstall,syncButton,check,getStatus:()=>({phase,ready:!!deferred,message:detail||messages[phase],checks:{...health,native:!!deferred||phase==='prompting'||phase==='installing'||phase==='installed'}})};
check();
})();
