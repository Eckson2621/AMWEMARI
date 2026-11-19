const CACHE_NAME='amwemari-shell-v43';
const CORE_FILES=['/','/index.html','/manifest.json'];
const SUPABASE_SCRIPT='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0';

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  for(const path of CORE_FILES){
   try{
    const response=await fetch(path,{cache:'reload'});
    if(response.ok)await cache.put(path,response.clone());
   }catch(error){console.warn('Could not cache app file:',path,error)}
  }
  try{
   const response=await fetch(SUPABASE_SCRIPT,{cache:'reload'});
   if(response.ok)await cache.put(SUPABASE_SCRIPT,response.clone());
  }catch(error){console.warn('Supabase library not cached:',error)}
  await self.skipWaiting();
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('amwemari-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});

// Receive server-originated security notifications when a push subscription
// has been registered and the backend has sent a Web Push message.
// This handler does not itself create a subscription or detect attacks.
self.addEventListener('push',event=>{
 event.waitUntil((async()=>{
  let payload={};
  try{payload=event.data?event.data.json():{}}catch(error){payload={body:'Fungua AMWEMARI Security Center kukagua taarifa.'}}
  const severity=String(payload.severity||'').toLowerCase();
  const critical=severity==='critical';
  const title=critical?'AMWEMARI — CRITICAL SECURITY ALERT':String(payload.title||'AMWEMARI Security');
  const body=String(payload.body||'Kuna taarifa mpya ya usalama. Fungua Security Center.').slice(0,240);
  const target=typeof payload.url==='string'&&payload.url.startsWith('/')&&!payload.url.startsWith('//')?payload.url:'/';
  await self.registration.showNotification(title,{
   body,
   tag:critical?'amwemari-critical-security':'amwemari-security',
   renotify:critical,
   requireInteraction:critical,
   vibrate:critical?[500,250,500,250,900]:[180,100,180],
   data:{url:target,severity:critical?'critical':'notice'},
   timestamp:Date.now()
  });
 })());
});

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=event.notification.data&&typeof event.notification.data.url==='string'?event.notification.data.url:'/';
 event.waitUntil((async()=>{
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){
   if('focus' in client){
    await client.focus();
    if('navigate' in client)await client.navigate(target);
    return;
   }
  }
  if(self.clients.openWindow)await self.clients.openWindow(target);
 })());
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin&&url.hostname!=='cdn.jsdelivr.net')return;

 // Always check the network first for the app page so users receive the latest fix.
 const isAppPage=request.mode==='navigate'||url.pathname==='/'||url.pathname.endsWith('.html');
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  if(isAppPage){
   try{
    const response=await fetch(request,{cache:'no-store'});
    if(response.ok)await cache.put(request,response.clone());
    return response;
   }catch(error){
    const cached=await cache.match(request)||await cache.match('/index.html');
    if(cached)return cached;
    throw error;
   }
  }
  const cached=await cache.match(request);
  if(cached)return cached;
  try{
   const response=await fetch(request);
   if(response.ok)await cache.put(request,response.clone());
   return response;
  }catch(error){throw error}
 })());
});
