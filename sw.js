const CACHE = "babella-stunden-v2";
const ASSETS = ["./index.html", "./app.js", "./manifest.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// Network-first für HTML/JS (verhindert alte Versionen), cache-first für alles andere
self.addEventListener("fetch", e => {
  const isAppShell = ASSETS.some(a => e.request.url.endsWith(a.replace("./","")));
  if(isAppShell){
    e.respondWith(
      fetch(e.request).then(res => {
        caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => caches.match(e.request))
    );
  }
});
