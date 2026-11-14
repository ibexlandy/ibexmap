const APP="reisebuch-app-v1.18",TILES="reisebuch-tiles-v2",OFFLINE="reisebuch-offline",MAXTILES=5000;
const SHELL=["./","index.html","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","favicon.png",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(APP).then(c=>Promise.all(SHELL.map(u=>fetch(u,{cache:"no-store"}).then(r=>{if(r.ok)return c.put(u,r);})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==APP&&n!==TILES&&n!==OFFLINE).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));});
async function trim(){const c=await caches.open(TILES);const k=await c.keys();for(let i=0;i<k.length-MAXTILES;i++)await c.delete(k[i]);}
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(/googleapis\.com$|accounts\.google\.com$|overpass/.test(u.hostname))return;
 if(/server\.arcgisonline\.com$|tile\.opentopomap\.org$/.test(u.hostname)){
  e.respondWith((async()=>{
   const off=await (await caches.open(OFFLINE)).match(e.request.url);if(off)return off;
   const c=await caches.open(TILES);const hit=await c.match(e.request);if(hit)return hit;
   try{const r=await fetch(e.request);if(r.ok||r.type==="opaque"){c.put(e.request,r.clone());trim();}return r;}catch(err){return Response.error();}})());return;}
 if(e.request.method!=="GET")return;
 if(u.origin===location.origin){
  /* App-Dateien immer frisch vom Server (am HTTP-Cache vorbei), offline aus dem Speicher */
  e.respondWith((async()=>{
   try{let r=await fetch(u.href,{cache:"no-cache",credentials:"same-origin"});
     if(r.redirected)r=new Response(await r.blob(),{status:r.status,statusText:r.statusText,headers:r.headers});
     if(r.ok){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request,cl));}return r;}
   catch(err){return (await caches.match(e.request,{ignoreSearch:true}))||(await caches.match("index.html"))||Response.error();}})());return;}
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&u.hostname==="cdnjs.cloudflare.com"){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request,cl));}return r;})
  .catch(()=>caches.match(e.request).then(m=>m||Response.error())));
});
