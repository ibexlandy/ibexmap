const APP="reisebuch-app-v10.1",TILES="reisebuch-tiles-v4",OFFLINE="reisebuch-offline",DEM="reisebuch-dem",LIBS="reisebuch-libs",MAXTILES=3000;
const SHELL=["./","index.html","topo.svg","ibex-bg.webp","manifest.webmanifest","icon-192.png","icon-512.png","icon-maskable-512.png","favicon.png",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
"https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(APP).then(c=>Promise.all(SHELL.map(u=>fetch(u,{cache:"no-store"}).then(r=>{if(r.ok)return c.put(u,r);})))).then(()=>self.skipWaiting()));});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>![APP,TILES,OFFLINE,DEM,LIBS].includes(n)).map(n=>caches.delete(n))))
  /* alte Bausteine ohne feste Version (bis v7.4) entfernen – die App lädt nur noch Versionen mit Prüfsumme */
  .then(()=>caches.open(LIBS)).then(c=>c.keys().then(ks=>Promise.all(ks.filter(r=>{const u=new URL(r.url);return u.hostname==="unpkg.com"&&!/@\d+\.\d+\.\d+\//.test(u.pathname);}).map(r=>c.delete(r)))))
  .catch(()=>{}).then(()=>self.clients.claim()));});
/* Zwischenspeicher nur jedes 50. Mal aufräumen (das Durchzählen ist langsam) */
async function appHit(url){try{return await (await caches.open(APP)).match(url);}catch(e){return undefined;}}
let putN=0;async function trim(){if(++putN%50)return;const c=await caches.open(TILES);const k=await c.keys();for(let i=0;i<k.length-MAXTILES;i++)await c.delete(k[i]);}
self.addEventListener("fetch",e=>{const u=new URL(e.request.url);
 if(/googleapis\.com$|accounts\.google\.com$|overpass/.test(u.hostname))return;
 /* Protomaps-Weltkarte: Kartendatei-Abfragen nie zwischenspeichern (Teilabfragen einer grossen Datei) */
 if(u.hostname==="build.protomaps.com")return;
 /* Bausteine der Vektorkarte (MapLibre, Schriften, Symbole): einmal laden, danach aus dem Speicher – auch offline */
 if(u.hostname==="unpkg.com"||u.hostname==="protomaps.github.io"){e.respondWith((async()=>{const c=await caches.open(LIBS);const hit=await c.match(e.request.url);if(hit)return hit;
   try{const r=await fetch(e.request);if(r.ok)c.put(e.request.url,r.clone());return r;}catch(err){return Response.error();}})());return;}
 /* Höhendaten für Höhenlinien und Relief: einmal gesehen = offline vorhanden */
 if(u.hostname==="s3.amazonaws.com"&&u.pathname.startsWith("/elevation-tiles-prod/")){if(e.request.cache==="no-store")return;
   e.respondWith((async()=>{const off=await (await caches.open(OFFLINE)).match(e.request.url);if(off)return off;const c=await caches.open(DEM);const hit=await c.match(e.request.url);if(hit)return hit;
   try{const r=await fetch(e.request.url,{mode:"cors",credentials:"omit"});if(r.ok)c.put(e.request.url,r.clone());return r;}catch(err){return Response.error();}})());return;}
 if(/server\.arcgisonline\.com$|tile\.opentopomap\.org$|wmts\.geo\.admin\.ch$/.test(u.hostname)){
  /* Offline-Download der App (cache:no-store): direkt ans Netz, ohne Umweg über den Zwischenspeicher – sonst doppelte Speicherung und langsamer */
  if(e.request.cache==="no-store")return;
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
  if(e.request.cache==="no-store"||e.request.cache==="reload"){e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!r.redirected){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request.url.split("?")[0],cl));}return r;}).catch(()=>appHit(u.origin+u.pathname).then(m=>m||Response.error())));return;}
  const net=(async()=>{let r=await fetch(u.href,{cache:"no-cache",credentials:"same-origin"});
     if(r.redirected)r=new Response(await r.blob(),{status:r.status,statusText:r.statusText,headers:r.headers});
     if(r.ok){const cl=r.clone();const c=await caches.open(APP);await c.put(u.origin+u.pathname,cl);}return r;})();
  /* nur im kleinen App-Speicher suchen, ohne ignoreSearch: eine Suche über alle Speicher (Tausende Offline-Kacheln) dauerte auf dem Handy bis 20 s */
  e.respondWith((async()=>{const hit=await appHit(u.origin+u.pathname);
   if(hit){e.waitUntil(net.catch(()=>{}));return hit;}
   try{return await net;}catch(err){return (await appHit(new URL("index.html",self.registration.scope).href))||Response.error();}})());return;}
 /* Leaflet (Kartenbibliothek): sofort aus dem Speicher – früher wurde zuerst das Netz gefragt, bei schlechtem Empfang hing der Start */
 if(u.hostname==="cdnjs.cloudflare.com"){e.respondWith(appHit(e.request.url).then(m=>m||fetch(e.request).then(r=>{if(r.ok){const cl=r.clone();caches.open(APP).then(c=>c.put(e.request,cl));}return r;})));return;}
 e.respondWith(fetch(e.request).catch(()=>appHit(e.request.url).then(m=>m||Response.error())));
});
