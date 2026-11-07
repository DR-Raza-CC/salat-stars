// Salat Stars service worker: offline shell + prayer notifications.
const CACHE = 'salat-stars-v1';
const SHELL = ['/', '/index.html', '/css/styles.css', '/js/app.js', '/js/core/praytimes.js', '/js/core/hijri.js',
  '/js/core/content.js', '/js/core/scoring.js', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'ss-meta').map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.pathname.startsWith('/api/') || url.origin !== location.origin) return;
  // network first, fall back to cache (so updates arrive quickly)
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('/index.html'))));
});

// The app tells us which family/member this device belongs to.
self.addEventListener('message', e => {
  if (e.data?.type === 'meta') caches.open('ss-meta').then(c => c.put('/__meta', new Response(JSON.stringify(e.data.meta))));
});

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let title = '🕌 Salat Stars', body = "It's salat time.", tag = 'salat';
    try {
      const meta = await (await caches.open('ss-meta')).match('/__meta').then(r => r && r.json());
      if (meta) {
        const r = await fetch(`/api/push-text?c=${encodeURIComponent(meta.c)}&m=${encodeURIComponent(meta.m)}`);
        const j = await r.json(); title = j.title; body = j.body; tag = j.tag || tag;
      }
    } catch (err) { /* fall back to generic text */ }
    await self.registration.showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', renotify: true });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('/');
  }));
});
