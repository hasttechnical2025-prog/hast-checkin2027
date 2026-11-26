// Service Worker — app Chấm Công HSTC 2027.
// VERSION là NGUỒN DUY NHẤT: đổi version khi deploy -> SW mới dọn cache cũ + reload.
const VERSION = 'v2027.11.26.02';
const CACHE = 'chamcong-' + VERSION;

// install: KHÔNG tải tài nguyên nào (tránh trễ) -> active NGAY để sớm nắm quyền trang.
// (Trang /c/<token> phải được SW kiểm soát NGAY từ đầu thì Chrome Android mới mời "Cài đặt".)
self.addEventListener('install', () => {
  self.skipWaiting();
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

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Ping kiểm tra kết nối: KHÔNG qua SW -> đi mạng thật, offline sẽ lỗi đúng
  // (nếu để SW cache rồi trả lại, client tưởng online dù đã mất mạng).
  if (url.pathname === '/api/ping') return;

  // Tài nguyên tĩnh BĂM NỘI DUNG của Next (/_next/static/...) là BẤT BIẾN -> CACHE-FIRST:
  // lần mở sau trả ngay từ cache (không tải lại JS/CSS) => app mở nhanh hơn hẳn.
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      (async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const net = await fetch(req);
        if (net && net.ok) {
          const c = await caches.open(CACHE);
          c.put(req, net.clone()).catch(() => {});
        }
        return net;
      })(),
    );
    return;
  }

  // Còn lại (HTML động, API...): network-first, fallback cache (dữ liệu cần tươi).
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
