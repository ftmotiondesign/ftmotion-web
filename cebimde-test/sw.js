/* FTMotion Cebimde push worker - separate scope from member panel */
self.addEventListener('push', event => {
  let payload={};try{payload=event.data?.json()||{}}catch{payload={body:event.data?.text()||''}}
  const title=String(payload.title||'🎁 FTMotion Cebimde');
  const body=String(payload.body||'Kaydettiğin işletmede yeni fırsat var.');
  const target=typeof payload.url==='string'&&payload.url.startsWith('/cebimde-test/')?payload.url:'/cebimde-test/';
  event.waitUntil(self.registration.showNotification(title,{
    body,icon:'/pwa-192.png',badge:'/pwa-192.png',
    tag:payload.tag||'ftmotion-offer',data:{url:target}
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL(event.notification.data?.url||'/cebimde-test/',self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(w=>w.url.startsWith(self.location.origin+'/cebimde-test/'));
    return existing?existing.focus().then(()=>existing.navigate(url)):clients.openWindow(url);
  }));
});