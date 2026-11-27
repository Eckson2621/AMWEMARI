/* Per-device, user-approved PWA version pinning. Bump CACHE_NAME for every release. */
const CACHE_NAME="amwemari-shell-v78";
const CACHE_PREFIX="amwemari-shell-";
const CORE_FILES=["/","/index.html","/manifest.json","/icons/icon.svg","/icons/logo.svg","/pwa-install.js","/feedback-center.js"];
const DB_NAME="eam-pwa-version-control";
const DB_STORE="settings";
const DB_KEY="selectedCache";
let pinnedCachePromise=null;
function cacheVersion(name){
 const match=name.match(/-v(\d+)$/i);
 return match?Number(match[1]):0;
}
function newestCache(names){
 const sorted=[...names].sort((a,b)=>cacheVersion(a)-cacheVersion(b)||a.localeCompare(b,undefined,{numeric:true}));
 return sorted.length?sorted[sorted.length-1]:null;
}
function previousCache(names,selected){
 const version=cacheVersion(selected);
 const candidates=version?names.filter(name=>cacheVersion(name)<version):names.filter(name=>name!==selected);
 return newestCache(candidates);
}

function openVersionDb(){
 return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(DB_STORE))request.result.createObjectStore(DB_STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error||new Error("Could not open update settings"));
 });
}
async function readPinnedCache(){
 const db=await openVersionDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(DB_STORE,"readonly");
  const request=tx.objectStore(DB_STORE).get(DB_KEY);
  request.onsuccess=()=>resolve(typeof request.result==="string"?request.result:null);
  request.onerror=()=>reject(request.error||new Error("Could not read update settings"));
  tx.oncomplete=()=>db.close();
  tx.onerror=()=>{db.close();reject(tx.error||new Error("Update settings read failed"));};
 });
}
async function writePinnedCache(value){
 const db=await openVersionDb();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(DB_STORE,"readwrite");
  tx.objectStore(DB_STORE).put(value,DB_KEY);
  tx.oncomplete=()=>{db.close();resolve(true);};
  tx.onerror=()=>{db.close();reject(tx.error||new Error("Could not save update choice"));};
  tx.onabort=()=>{db.close();reject(tx.error||new Error("Update choice was not saved"));};
 });
}
async function ensurePinnedCache(){
 let selected=null;
 try{selected=await readPinnedCache();}catch(_){}
 const keys=await caches.keys();
 if(selected&&keys.includes(selected))return selected;
 const previous=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME);
 selected=newestCache(previous)||CACHE_NAME;
 await writePinnedCache(selected);
 return selected;
}
async function getPinnedCache(){
 if(!pinnedCachePromise)pinnedCachePromise=ensurePinnedCache();
 return pinnedCachePromise;
}
function isExcludedPath(path){
 return /^\/(?:api|auth|rest|storage|functions|rpc)(?:\/|$)/i.test(path)||
        /^\/(?:health|healthz|webhook)(?:\/|$)/i.test(path);
}
function isStaticPath(path){
 return /\.(?:avif|css|eot|gif|ico|jpe?g|js|mjs|json|map|png|svg|ttf|webmanifest|webp|woff2?)(?:$)/i.test(path);
}
function canStore(response){
 const control=response.headers.get("cache-control")||"";
 return response.ok&&!/no-store|private/i.test(control);
}
async function cacheShell(){
 const cache=await caches.open(CACHE_NAME);
 const save=async path=>{
  try{
   const response=await fetch(path,{cache:"reload"});
   if(canStore(response))await cache.put(path,response.clone());
   return response;
  }catch(_){return null;}
 };
 let page=await save("/");
 if(!page)page=await save("/index.html");
 if(page){
  try{
   const html=await page.clone().text();
   const found=[...html.matchAll(/(?:src|href)=["']([^"'#]+)["']/gi)].map(match=>match[1]);
   const urls=[...new Set([...CORE_FILES,...found])];
   await Promise.all(urls.map(async value=>{
    try{
     const url=new URL(value,self.location.origin);
     if(url.origin!==self.location.origin||isExcludedPath(url.pathname))return;
     if(url.pathname!=="/"&&url.pathname!=="/index.html"&&!isStaticPath(url.pathname))return;
     const response=await fetch(url.href,{cache:"reload"});
     if(canStore(response))await cache.put(url.href,response.clone());
    }catch(_){}
   }));
  }catch(_){}
 }
 await Promise.all(CORE_FILES.map(async path=>{
  try{
   if(isExcludedPath(path))return;
   if(path!=="/"&&path!=="/index.html"&&!isStaticPath(path))return;
   if(await cache.match(path))return;
   const response=await fetch(path,{cache:"reload"});
   if(canStore(response))await cache.put(path,response.clone());
  }catch(_){}
 }));
}
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  await cacheShell();
  /* First upgrade pins the previous shell; first install pins itself. */
  await getPinnedCache();
 })());
});
self.addEventListener("message",event=>{
 const message=event.data||{};
 const port=event.ports&&event.ports[0];
 if(message.type==="GET_VERSION_STATE"){
  event.waitUntil((async()=>{
   try{
    const selected=await getPinnedCache();
    const state={ok:true,selectedCache:selected,availableCache:CACHE_NAME,hasUpdate:selected!==CACHE_NAME};
    if(port)port.postMessage(state);
    else if(event.source)event.source.postMessage(state);
   }catch(error){if(port)port.postMessage({ok:false,error:String(error)});}
  })());
 }
 if(message.type==="APPROVE_UPDATE"){
  event.waitUntil((async()=>{
   try{
    await writePinnedCache(CACHE_NAME);
    pinnedCachePromise=Promise.resolve(CACHE_NAME);
    if(port)port.postMessage({ok:true,selectedCache:CACHE_NAME});
    self.skipWaiting();
   }catch(error){if(port)port.postMessage({ok:false,error:String(error)});}
  })());
 }
});

/* Explicit local rollback hook: call with message type ROLLBACK_TO_PREVIOUS. */
self.addEventListener("message",event=>{
 if(!event.data||event.data.type!=="ROLLBACK_TO_PREVIOUS")return;
 const port=event.ports&&event.ports[0];
 event.waitUntil((async()=>{
  try{
   const selected=await getPinnedCache();
   const keys=await caches.keys();
   const previous=keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==selected&&key!==CACHE_NAME);
   const target=previousCache(previous,selected);
   if(!target){if(port)port.postMessage({ok:false,error:"No earlier cached version is available"});return;}
   await writePinnedCache(target);
   pinnedCachePromise=Promise.resolve(target);
   if(port)port.postMessage({ok:true,selectedCache:target});
  }catch(error){if(port)port.postMessage({ok:false,error:String(error)});}
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  /* Keep old version caches: devices may still be pinned to them for later rollback. */
  await getPinnedCache();
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 const request=event.request;
 if(request.method!=="GET"||request.headers.has("Authorization"))return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||isExcludedPath(url.pathname))return;
 const isShell=request.mode==="navigate"||url.pathname==="/"||url.pathname==="/index.html";
 if(!isShell&&!isStaticPath(url.pathname))return;
 event.respondWith((async()=>{
  const selected=await getPinnedCache();
  const cache=await caches.open(selected);
  const cached=await cache.match(request,{ignoreSearch:false})||
               await cache.match(url.pathname,{ignoreSearch:true});
  if(cached)return cached;
  try{
   const response=await fetch(request,{cache:isShell?"no-store":"default"});
   if(selected===CACHE_NAME&&canStore(response))await cache.put(request,response.clone());
   return response;
  }catch(error){
   if(isShell){
    const fallback=await cache.match("/")||await cache.match("/index.html");
    if(fallback)return fallback;
   }
   throw error;
  }
 })());
});
