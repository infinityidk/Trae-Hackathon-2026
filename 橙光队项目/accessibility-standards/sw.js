/**
 * 橙光队无障碍督导标准查询 - Service Worker
 * Copyright © 2025 Wayhhow
 * Licensed under MIT
 * https://github.com/Wayhhow/accessibility-standards
 *
 * 功能：缓存 PDF 文件，提升加载速度
 */

const CACHE_NAME = 'accessibility-standards-pdf-cache-v1';
const PDF_FILES = [
  '/pdf/gb55019-2021.pdf',
  '/pdf/gb50763-2012.pdf',
  '/pdf/sjg103-2021.pdf'
];

// 安装时跳过预缓存，改为按需缓存
// 避免在移动端安装时占用大量带宽
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  // Skip pre-caching to avoid blocking mobile network on first install
  // PDFs will be cached on-demand when user accesses them
  self.skipWaiting();
});

// 激活时清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[Service Worker] Activated');
      return self.clients.claim();
    })
  );
});

// 拦截请求，优先从缓存读取
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 只处理 PDF 文件请求
  if (url.pathname.endsWith('.pdf')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        // 如果缓存中有，直接返回缓存
        if (cachedResponse) {
          console.log('[Service Worker] Serving from cache:', url.pathname);
          return cachedResponse;
        }

        // 否则从网络获取并缓存
        console.log('[Service Worker] Fetching from network:', url.pathname);
        return fetch(request).then((networkResponse) => {
          // 检查响应是否有效
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // 克隆响应（因为 response 只能使用一次）
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
            console.log('[Service Worker] Cached new PDF:', url.pathname);
          });

          return networkResponse;
        }).catch((error) => {
          console.error('[Service Worker] Fetch failed:', error);
          // 如果网络请求失败，返回一个友好的错误响应
          return new Response('PDF 加载失败，请检查网络连接', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' }
          });
        });
      })
    );
  }
});

// 监听消息（用于更新缓存）
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
