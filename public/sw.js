const CACHE="avenyn-taxi-v5";
const CORE=["/icon-192.png","/icon-512.png","/customer.webmanifest","/driver.webmanifest"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));self.skipWaiting()});
self.addEventListener("activate",event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener("message",event=>{if(event.data==="SKIP_WAITING")self.skipWaiting()});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  if(event.request.mode==="navigate"){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
    return;
  }
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(CORE.includes(url.pathname)){
    event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request)));
    return;
  }
  // Application JavaScript and CSS must always come from the latest publish.
  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
self.addEventListener("push",event=>{
  let payload={};
  try{payload=event.data?event.data.json():{}}catch{payload={body:event.data?.text()||"Du har fått en ny bokning."}}
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients)client.postMessage({type:String(payload.tag||'').startsWith('driver-reminder-')?'AVENYN_DRIVER_REMINDER':'AVENYN_BOOKING_PUSH',body:payload.body,url:payload.url})}));
  const title=payload.title||"Avenyn Taxi · ny bokning";
  const options={
    body:payload.body||"Öppna förarappen för att se körningen.",
    icon:"/icon-192.png",
    badge:"/icon-192.png",
    tag:payload.tag||"avenyn-driver-booking",
    renotify:true,
    requireInteraction:true,
    vibrate:[300,100,300,100,500],
    data:{url:payload.url||"/driver"},
    actions:[{action:"open",title:"Öppna bokningen"}]
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url||"/driver",self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(clients=>{
    for(const client of clients){
      if("focus" in client){
        if("navigate" in client)client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow?self.clients.openWindow(target):undefined;
  }));
});
