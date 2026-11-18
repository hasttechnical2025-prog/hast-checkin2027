// Service Worker — app Chấm Công HSTC 2027.
// VERSION là NGUỒN DUY NHẤT: đổi version khi deploy -> SW mới dọn cache cũ + reload.
const VERSION = 'v2027.11.18.01';
const CACHE = 'chamcong-' + VERSION;
const SHELL = ['/icon.svg'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

// Network-first, fallback cache (dữ liệu chấm công cần tươi; offline mới dùng cache).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    (async () => {
      try {
        const net = await fetch(req);
        if (net && net.ok && net.type === 'basic') {
          const c = await caches.open(CACHE);
          c.put(req, net.clone()).catch(() => {});
        }
        return net;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        throw new Error('offline');
      }
    })(),
  );
});
