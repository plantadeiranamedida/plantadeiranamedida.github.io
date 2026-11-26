// Guarda a calculadora no celular para funcionar sem internet no campo.
var CACHE = 'pnm-v1';
var ARQUIVOS = ['./', 'index.html', 'nucleo.js', 'manifest.webmanifest', 'icone.svg', 'icone-192.png', 'icone-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARQUIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  // Rede primeiro (pega versão nova), cache se estiver sem sinal.
  e.respondWith(fetch(e.request).then(function (r) {
    var copia = r.clone();
    if (r.ok && new URL(e.request.url).origin === location.origin) caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
    return r;
  }).catch(function () { return caches.match(e.request, { ignoreSearch: true }); }));
});
