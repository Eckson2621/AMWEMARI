const CACHE_NAME='amwemari-shell-v24';
const CORE_FILES=['/','/index.html','/manifest.json'];
const SUPABASE_SCRIPT='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';

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
