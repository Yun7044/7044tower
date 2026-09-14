// ============================================================
// Service Worker — 塔防
// ============================================================
const CACHE_NAME = 'tower-defense-v1';
const CACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './bg.jpg',
];

// 安裝：預先快取檔案
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(CACHE_ASSETS).catch(function(err) {
        console.log('[SW] 部分檔案快取失敗（可能未準備）:', err);
      });
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// 啟用：清掉舊版快取
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.map(function(key) {
          if (key !== CACHE_NAME) {
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

  // 1. Firebase / Google API 的請求：完全不快取，直接走網路
  if (url.indexOf('firebase') !== -1 ||
      url.indexOf('googleapis.com') !== -1 ||
      url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('firebaseio.com') !== -1) {
    return; // 讓瀏覽器自己處理
  }

  // 2. 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  // 3. 其他資源：先看快取，沒有再走網路（Cache First）
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;

      return fetch(event.request).then(function(response) {
        // 只快取成功的回應
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });

        return response;
      }).catch(function() {
        // 網路失敗時，如果是 HTML 請求就回傳 index.html
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});