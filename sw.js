// Fargo Hanna Service Orders — service worker
//
// Strategy: network-first for everything this app owns (index.html, manifest.json,
// icons). "Network-first" means: if the browser is online, ALWAYS fetch the latest
// version from the server and use that (so uploading a new index.html to GitHub shows
// up immediately on next load/refresh — no stale-cache surprises). The cache is only a
// fallback for when the shop has no internet connection, so the app still opens.
//
// This worker deliberately ignores anything not on this origin — the xlsx export
// library (loaded from a CDN) and mailto: links are never touched, so they keep working
// exactly as before.
//
// Bump CACHE_NAME any time the app shell files themselves change in a way that needs a
// clean slate; the activate step below deletes any old-named caches automatically.
const CACHE_NAME = "fh-orders-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(names){
      return Promise.all(
        names.filter(function(name){ return name !== CACHE_NAME; })
             .map(function(name){ return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  var req = event.request;

  // Only handle GET requests for this app's own origin. Everything else (the CDN xlsx
  // library, mailto: links, any future cross-origin request) passes straight through
  // untouched — this worker never intercepts it.
  if(req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function(networkResponse){
      // Got a fresh copy — use it, and update the offline fallback cache to match.
      var copy = networkResponse.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(req, copy); });
      return networkResponse;
    }).catch(function(){
      // Offline (or the request failed) — fall back to whatever's cached.
      return caches.match(req).then(function(cached){
        return cached || caches.match("./index.html");
      });
    })
  );
});
