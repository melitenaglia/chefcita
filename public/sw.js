const CACHE='chefcita-shell-v3';
self.addEventListener('install',event=>event.waitUntil((async()=>{
 const cache=await caches.open(CACHE);
 const response=await fetch('/',{cache:'reload'});if(!response.ok)throw new Error('Cannot cache shell');
 await cache.put('/',response.clone());
 const html=await response.text();
 const assets=[...html.matchAll(/(?:src|href)="(\/assets\/[^"\s]+)"/g)].map(x=>x[1]);
 await cache.addAll([...assets,'/manifest.webmanifest','/icons/chefcita-180.png']);await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('chefcita-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const request=event.request;const url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(async()=>{const cached=await caches.match('/');return cached||Response.error()}));return;
 }
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/icons/')||url.pathname==='/manifest.webmanifest'){
  event.respondWith((async()=>{const cached=await caches.match(request);if(cached)return cached;const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone())}return response})());
 }
});
