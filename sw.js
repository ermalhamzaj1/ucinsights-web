/* UCInsights service worker — offline app shell + safe runtime caching */
var CACHE = 'ucinsights-v1';
var SHELL = [
  './',
  './index.html',
  './favicon.ico',
  './ucinsight.png',
  './manifest.webmanifest'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return c.add(u).catch(function () {}); // ignore individual failures
    }));
  }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  // Only handle GET; let POST (AI/api) pass straight through.
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // Never intercept API or cross-origin requests (Anthropic, fonts CDNs, ads, analytics).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf('/api/') === 0) return;

  // Navigations & the HTML doc: network-first so updates show, fall back to cache offline.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') > -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Static same-origin assets: cache-first, then network (and cache it).
  e.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return cached; });
    })
  );
});

/* Tapping a reminder notification focuses/opens the app. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) { if ('focus' in list[i]) return list[i].focus(); }
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
