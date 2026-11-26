const CACHE_NAME="amwemari-shell-v76";
const CACHE_PREFIX="amwemari-shell-";
const CORE_FILES=["/","/index.html","/manifest.json","/icons/icon.svg","/icons/logo.svg","/pwa-install.js","/feedback-center.js"];
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const save=async path=>{
   try{const response=await fetch(path,{cache:"reload"});if(response.ok)await cache.put(path,response.clone());return response;}catch(_){return null;}
  };
  let page=await save("/");
  if(!page) page=await save("/index.html");
  if(page){
   try{
    const html=await page.clone().text();
    const found=[...html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)].map(m=>m[1]);
    const urls=[...new Set([...CORE_FILES,...found])];
    await Promise.all(urls.map(async value=>{
     try{const url=new URL(value,self.location.origin);if(url.origin!==self.location.origin)return;const response=await fetch(url.href,{cache:"reload"});if(response.ok)await cache.put(url.href,response.clone());}catch(_){}
    }));
   }catch(_){}
  }
  await Promise.all(CORE_FILES.map(async path=>{try{const hit=await cache.match(path);if(!hit){const response=await fetch(path,{cache:"reload"});if(response.ok)await cache.put(path,response.clone());}}catch(_){}}));
 })());
});
self.addEventListener("message",event=>{
 if(event.data&&event.data.type==="SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET")return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 if(url.pathname==="/api"||url.pathname.startsWith("/api/")||url.pathname==="/health"||url.pathname==="/healthz"||url.pathname.startsWith("/webhook"))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const isPage=request.mode==="navigate"||url.pathname==="/"||url.pathname==="/index.html";
  if(!isPage){
   const cached=await cache.match(request);
   if(cached)return cached;
  }
  try{
   const response=await fetch(request,{cache:isPage?"no-store":"default"});
   if(response.ok)await cache.put(request,response.clone());
   return response;
  }catch(error){
   const fallback=await cache.match(request)||(isPage?await cache.match("/")||await cache.match("/index.html"):null);
   if(fallback)return fallback;
   throw error;
  }
 })());
});
