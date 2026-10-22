// Protected data and authenticated pages are always fetched live, never cached.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{if(event.request.method==='GET'&&event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>new Response('<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>DijiRehber</title><body style="font:16px system-ui;padding:40px;color:#244a40"><h1>İnternet bağlantısı gerekli.</h1><p>Bağlantınız geldiğinde DijiRehber’i yeniden açın.</p><button onclick="location.reload()">Yeniden dene</button></body></html>',{headers:{'Content-Type':'text/html;charset=utf-8'}})))});
