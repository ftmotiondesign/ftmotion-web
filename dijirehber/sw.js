const CACHE='dijirehber-public-v4';
const ASSETS=['/dijirehber/offline.html','/dijirehber/icons/dijirehber-192.png','/dijirehber/icons/dijirehber-512.png','/dijirehber/icons/dijirehber-maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('dijirehber-public-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
// Authentication, private media, API responses and protected screens are never cached.
self.addEventListener('fetch',event=>{const request=event.request,url=new URL(request.url);if(request.method!=='GET'||url.origin!==self.location.origin)return;
if(request.mode==='navigate'&&url.pathname.startsWith('/dijirehber/')){event.respondWith(fetch(request,{cache:'reload'}).catch(()=>caches.match('/dijirehber/offline.html')));return;}
if(ASSETS.includes(url.pathname))event.respondWith(caches.match(url.pathname).then(cached=>cached||fetch(request)));});
