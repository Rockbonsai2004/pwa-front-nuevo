// public/sw.js
const CACHE_STATIC = 'app_shell_v4.0';
const CACHE_DYNAMIC = 'dynamic_cache_v4.0';
const CACHE_API = 'api_cache_v4.0';

// Assets estáticos críticos (solo los que tienes)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.jsx',
  '/src/App.jsx',
  '/manifest.json',
  '/icons/icon72.png',
  '/icons/icon128.png',
  '/icons/icon192.png',
  '/icons/icon256.png'
];

// URLs a excluir del cache
const EXCLUDE_FROM_CACHE = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/push/send',
  '/api/push/subscribe'
];

// ==================== INSTALACIÓN ====================
self.addEventListener('install', (event) => {
  console.log('🔄 SW: Instalando versión 4.0...');
  
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => {
        console.log('📦 Cacheando App Shell');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('❌ Error durante la instalación:', error);
      })
  );
});

// ==================== ACTIVACIÓN ====================
self.addEventListener('activate', (event) => {
  console.log('✅ SW: Activado - Versión 4.0');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Eliminar caches antiguas
          if (![CACHE_STATIC, CACHE_DYNAMIC, CACHE_API].includes(cacheName)) {
            console.log('🗑️ Eliminando cache vieja:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      console.log('🚀 SW listo y reclamando clientes');
    })
  );
});

// ==================== NOTIFICACIONES PUSH ====================
self.addEventListener('push', (event) => {
  console.log('📨 Evento push recibido', event);
  
  let data = {};
  
  try {
    if (event.data) {
      data = event.data.json();
    } else {
      data = {
        title: 'Mi PWA App',
        body: 'Tienes una nueva notificación',
        icon: '/icons/icon-192x192.png'
      };
    }
  } catch (error) {
    console.log('❌ Error parseando datos push:', error);
    data = {
      title: 'Mi PWA App',
      body: 'Tienes una nueva notificación',
      icon: '/icons/icon-192x192.png'
    };
  }

  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    image: data.image,
    data: data.data || { url: data.url || '/' },
    actions: [
      {
        action: 'open',
        title: 'Abrir App',
        icon: '/icons/icon-72x72.png'
      },
      {
        action: 'dismiss',
        title: 'Descartar',
        icon: '/icons/icon-72x72.png'
      }
    ],
    tag: data.tag || 'general',
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Mi PWA App', options)
  );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notificación clickeada:', event.notification.tag);
  
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// ==================== BACKGROUND SYNC ====================
self.addEventListener('sync', (event) => {
  console.log('🔄 Evento Background Sync:', event.tag);
  
  if (event.tag === 'pending-posts-sync') {
    console.log('📝 Sincronizando posts pendientes...');
    event.waitUntil(syncPendingPosts());
  }
});

// Sincronizar posts pendientes
async function syncPendingPosts() {
  try {
    console.log('🔄 Iniciando sincronización de posts...');
    
    const clients = await self.clients.matchAll();
    
    if (clients.length === 0) {
      console.log('❌ No hay clientes activos para sincronizar');
      return;
    }

    clients.forEach(client => {
      client.postMessage({
        type: 'GET_PENDING_POSTS',
        data: { source: 'background-sync' }
      });
    });

    console.log('✅ Solicitud de sincronización enviada a la app');
    
  } catch (error) {
    console.error('❌ Error en syncPendingPosts:', error);
  }
}

// ==================== MANEJO DE MENSAJES ====================
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;
  console.log('📨 Mensaje recibido de la app:', type);

  switch (type) {
    case 'PROCESS_PENDING_POSTS':
      await processPendingPosts(data.posts);
      break;
      
    case 'REQUEST_SYNC':
      await syncPendingPosts();
      break;
      
    default:
      console.log('📨 Mensaje no manejado:', type);
  }
});

// Procesar posts pendientes
async function processPendingPosts(posts = []) {
  if (!posts || posts.length === 0) {
    console.log('📭 No hay posts para procesar');
    return;
  }

  console.log(`🔄 Procesando ${posts.length} posts pendientes...`);
  
  let successCount = 0;
  let errorCount = 0;

  for (const post of posts) {
    try {
      // Simular envío al backend
      const response = await fetch(post.endpoint || '/api/posts', {
        method: post.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${post.token || ''}`
        },
        body: JSON.stringify(post.data)
      });

      if (response.ok) {
        successCount++;
        console.log(`✅ Post ${post.id} sincronizado exitosamente`);
        
        // Notificar a la app para eliminar el post
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'DELETE_PENDING_POST',
            data: { postId: post.id }
          });
        });
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Error sincronizando post ${post.id}:`, error);
      
      // Actualizar intentos
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'UPDATE_POST_ATTEMPTS',
          data: { 
            postId: post.id, 
            attempts: (post.attempts || 0) + 1 
          }
        });
      });
    }
  }

  // Notificar resultados
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETED',
      data: {
        successCount,
        errorCount,
        total: posts.length,
        timestamp: Date.now()
      }
    });
  });

  console.log(`✅ Sincronización completada: ${successCount} exitosos, ${errorCount} fallidos`);
}

// ==================== FETCH ====================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Excluir ciertas URLs del cache
  if (EXCLUDE_FROM_CACHE.some(pattern => url.pathname.includes(pattern))) {
    return;
  }

  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            
            // Solo cachear si no es API (o APIs específicas)
            if (!event.request.url.includes('/api/')) {
              caches.open(CACHE_DYNAMIC)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            } else if (event.request.url.includes('/api/images')) {
              // Cachear imágenes de la API
              caches.open(CACHE_API)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }

            return networkResponse;
          })
          .catch((error) => {
            console.log('🌐 Modo offline - Request falló:', event.request.url);
            
            // Fallback para páginas
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
            
            // Fallback para imágenes
            if (event.request.destination === 'image') {
              return new Response('', { 
                status: 200, 
                headers: { 'Content-Type': 'image/svg+xml' } 
              });
            }
            
            return new Response('🔌 Sin conexión', { 
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

console.log('🚀 Service Worker 4.0 cargado correctamente');