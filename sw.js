const APP="reisebuch-app-v4.1",TILES="reisebuch-tiles-v4",OFFLINE="reisebuch-offline",MAXTILES=3000;
const SHELL=["./","index.html","topo.svg","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","favicon.png",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(APP).then(c=>Promise.all(SHELL.map(u=>fetch(u,{cache:"no-store"}).then(r=>{if(r.ok)return c.put(u,r);})))).then(()=>self.skipWaiting()));});
async function cleanOpaque(){try{const c=await caches.open(OFFLINE);for(const k of await c.keys()){const r=await c.match(k);if(r&&r.type==="opaque")await c.delete(k);}}catch(e){}}
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==APP&&n!==TILES&&n!==OFFLINE).map(n=>caches.delete(n)))).then(cleanOpaque).then(()=>self.clients.claim()));});
/* Zwischenspeicher nur jedes 50. Mal aufräumen (das Durchzählen ist langsam) */
let putN=0;async function trim(){if(++putN%50)return;const c=await caches.open(TILES);const k=await c.keys();for(let i=0;i<k.length-MAXTILES;i++)await c.delete(k[i]);}
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(/googleapis\.com$|accounts\.google\.com$|overpass/.test(u.hostname))return;
 if(/server\.arcgisonline\.com$|tile\.opentopomap\.org$|wmts\.geo\.admin\.ch$/.test(u.hostname)){
  e.respondWith((async()=>{
   const off=await (await caches.open(OFFLINE)).match(e.request.url);if(off)return off;
   const c=await caches.open(TILES);const hit=await c.match(e.request);if(hit)return hit;
   /* Esri: fehlende Kacheln als 404 statt Bild «Map data not yet available» – die App zeigt dann die vergrösserte gröbere Kachel */
   const nu=/arcgisonline/.test(u.hostname)?e.request.url+(u.search?"&":"?")+"blankTile=false":e.request.url;
   try{const r=await fetch(nu,{mode:"cors",credentials:"omit"});if(r.ok&&r.type!=="opaque"){c.put(e.request,r.clone());trim();}return r;}catch(err){return Response.error();}})());return;}
 if(e.request.method!=="GET")return;
 if(u.origin===location.origin){
  /* Schnellstart: App-Dateien sofort aus dem Speicher, im Hintergrund frisch vom Server holen.
     Neue Versionen kommen über das neue sw.js (Versionsnummer) und laden die App einmal neu. */
  /* ausdrücklich frische Anfragen (Update-Prüfung, Familienseite) gehen direkt ans Netz */
  if(e.request.cache==="no-store"||e.request.cache==="reload"){e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!r.redirected){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request.url.split("?")[0],cl));}return r;}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(m=>m||Response.error())));return;}
  const net=(async()=>{let r=await fetch(u.href,{cache:"no-cache",credentials:"same-origin"});
     if(r.redirected)r=new Response(await r.blob(),{status:r.status,statusText:r.statusText,headers:r.headers});
     if(r.ok){const cl=r.clone();const c=await caches.open(APP);await c.put(e.request,cl);}return r;})();
  e.respondWith((async()=>{const hit=await caches.match(e.request,{ignoreSearch:true});
   if(hit){e.waitUntil(net.catch(()=>{}));return hit;}
   try{return await net;}catch(err){return (await caches.match("index.html"))||Response.error();}})());return;}
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&u.hostname==="cdnjs.cloudflare.com"){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request,cl));}return r;})
  .catch(()=>caches.match(e.request).then(m=>m||Response.error())));
});
