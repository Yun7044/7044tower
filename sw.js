// ============================================================
// Service Worker — 塔防（自動更新版）
// ============================================================
const CACHE_VERSION = 'v' + Date.now(); // 每次瀏覽器重新載入 SW 就會換新版本號
const CACHE_NAME = 'tower-defense-' + CACHE_VERSION;
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './bg.jpg',
];

// 安裝：跳過等待
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_ASSETS).catch(function(err) {
        console.log('[SW] 部分檔案快取失敗:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 啟用：清掉所有舊版快取
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
            console.log('[SW] 刪除舊快取:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// 攔截請求
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // Firebase 完全走網路
  if (url.indexOf('firebase') !== -1 ||
      url.indexOf('googleapis.com') !== -1 ||
      url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('firebaseio.com') !== -1) {
    return;
  }

  if (event.request.method !== 'GET') return;

  // HTML 檔案永遠優先走網路（避免卡舊版）
  if (event.request.destination === 'document' ||
      url.endsWith('.html') ||
      url.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 其他資源：先快取
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      });
    })
  );
});

// 收到訊息時立刻更新
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
