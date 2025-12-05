import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Inicializar IndexedDB
const initIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open('PWA_PostsDB', 1);
    
    request.onerror = (event) => {
      console.error('❌ Error abriendo IndexedDB:', event.target.error);
      reject(event.target.error);
    };
    
    request.onsuccess = (event) => {
      console.log('✅ IndexedDB inicializada correctamente');
      resolve(event.target.result);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      console.log('🔄 Creando/actualizando IndexedDB...');
      
      // Crear object store para posts pendientes si no existe
      if (!db.objectStoreNames.contains('pending_posts')) {
        const store = db.createObjectStore('pending_posts', { 
          keyPath: 'id', 
          autoIncrement: true 
        });
        
        // Crear índices
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('endpoint', 'endpoint', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        
        console.log('✅ ObjectStore "pending_posts" creado con índices');
      }
    };

    request.onblocked = () => {
      console.warn('⚠️ IndexedDB bloqueada - Cierra otras pestañas de la app');
    };
  });
};

// Registrar Service Worker
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ Service Worker registrado:', registration.scope);
      
      // Escuchar actualizaciones del SW
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('🔄 Nuevo Service Worker encontrado:', newWorker.state);
        
        newWorker.addEventListener('statechange', () => {
          console.log('🔄 Estado del SW:', newWorker.state);
          if (newWorker.state === 'activated') {
            console.log('✅ Nuevo Service Worker activado');
            // Recargar para usar la nueva versión
            window.location.reload();
          }
        });
      });

      // Verificar si hay una actualización periódicamente
      setInterval(async () => {
        await registration.update();
      }, 60 * 60 * 1000); // Cada 1 hora

    } catch (error) {
      console.error('❌ Error registrando Service Worker:', error);
    }
  } else {
    console.log('⚠️ Service Worker no soportado en este navegador');
  }
};

// Inicializar la mensajería del SW
const initializeSWMessaging = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // Esperar a que el SW esté listo
      const registration = await navigator.serviceWorker.ready;
      
      // Importar dinámicamente el módulo de mensajería
      const { swMessaging } = await import('./utils/swMessaging.js');
      console.log('✅ SW Messaging inicializado');
      
      // Configurar listeners globales
      swMessaging.on('syncStatusUpdate', (data) => {
        console.log('📊 Actualización de sincronización:', data);
      });
      
      swMessaging.on('postSyncSuccess', (data) => {
        console.log('✅ Post sincronizado exitosamente:', data);
      });
      
    } catch (error) {
      console.log('⚠️ SW Messaging no disponible:', error.message);
    }
  }
};

// Inicializar notificaciones push
const initializePushNotifications = async () => {
  if ('Notification' in window && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Verificar permisos existentes
      if (Notification.permission === 'granted') {
        console.log('✅ Permisos de notificación ya concedidos');
      }
      
    } catch (error) {
      console.log('⚠️ Error inicializando notificaciones:', error);
    }
  }
};

// Inicializar la aplicación
const initApp = async () => {
  try {
    console.log('🚀 Inicializando aplicación PWA...');
    
    await initIndexedDB();
    await registerServiceWorker();
    await initializeSWMessaging();
    await initializePushNotifications();
    
    console.log('✅ Aplicación inicializada correctamente');
    
  } catch (error) {
    console.error('❌ Error inicializando aplicación:', error);
  }
};

// Ejecutar inicialización
initApp();

// Renderizar la aplicación
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);