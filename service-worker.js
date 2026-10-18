const APP_CACHE = 'coatingscan-shell-v1';
const DATA_CACHE = 'coatingscan-ocr-v1';
const SHELL = ['./','./index.html','./styles.css','./app.js','./manifest.webmanifest','./img/icon-192.png','./img/icon-512.png','./img/demo-0926.png'];
const OCR_FILES = ['./vendor/tesseract.min.js','./vendor/worker.min.js','./vendor/lang/eng.traineddata.gz','./vendor/core/tesseract-core.wasm.js','./vendor/core/tesseract-core-simd.wasm.js','./vendor/core/tesseract-core-lstm.wasm.js','./vendor/core/tesseract-core-simd-lstm.wasm.js'];
self.addEventListener('install', event => event.waitUntil((async()=>{const cache=await caches.open(APP_CACHE);await cache.addAll(SHELL);await self.skipWaiting()})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{for(const name of await caches.keys()){if(name.startsWith('coatingscan-') && ![APP_CACHE,DATA_CACHE].includes(name))await caches.delete(name)}await self.clients.claim()})()));
self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin || !url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith((async()=>{
    const cached = await caches.match(event.request);
    if(cached) return cached;
    try{
      const response=await fetch(event.request);
      if(response.ok && url.pathname.includes('/vendor/')){
        const cache=await caches.open(DATA_CACHE);await cache.put(event.request,response.clone());
      }
      return response;
    }catch(err){if(event.request.mode==='navigate')return (await caches.match('./index.html')) || Response.error();throw err}
  })());
});
