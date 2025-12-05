// utils/swMessaging.js
import { dbManager } from './indexedDB.js';

class SWMessaging {
  constructor() {
    this.messageHandlers = new Map();
    this.init();
  }

  init() {
    if ('serviceWorker' in navigator) {
      // Esperar a que el service worker esté listo
      navigator.serviceWorker.ready.then(() => {
        navigator.serviceWorker.addEventListener('message', this.handleSWMessage.bind(this));
        console.log('📨 Sistema de mensajería con Service Worker inicializado');
      });
    } else {
      console.warn('⚠️ Service Worker no soportado en este navegador');
    }
  }

  // Registrar manejadores de mensajes
  registerHandler(type, handler) {
    this.messageHandlers.set(type, handler);
  }

  // Manejar mensajes del Service Worker
  async handleSWMessage(event) {
    const { type, data } = event.data;
    console.log('📨 Mensaje recibido del SW:', type, data);

    // Manejar mensajes predefinidos
    switch (type) {
      case 'GET_PENDING_POSTS':
        await this.sendPendingPostsToSW();
        break;
        
      case 'DELETE_PENDING_POST':
        if (data.postId) {
          await dbManager.deletePendingPost(data.postId);
        }
        break;
        
      case 'UPDATE_POST_ATTEMPTS':
        if (data.postId && data.attempts !== undefined) {
          await dbManager.updatePostAttempts(data.postId, data.attempts);
        }
        break;
        
      case 'SYNC_STATUS_UPDATE':
        this.dispatchEvent('syncStatusUpdate', data);
        break;
        
      case 'POST_SYNC_SUCCESS':
        this.dispatchEvent('postSyncSuccess', data);
        break;
        
      case 'POST_SYNC_ERROR':
        this.dispatchEvent('postSyncError', data);
        break;

      default:
        // Ejecutar manejador personalizado si existe
        const customHandler = this.messageHandlers.get(type);
        if (customHandler) {
          customHandler(data);
        } else {
          console.log('📨 Mensaje no manejado del SW:', event.data);
        }
    }
  }

  // Enviar posts pendientes al Service Worker
  async sendPendingPostsToSW() {
    try {
      const pendingPosts = await dbManager.getAllPendingPosts();
      
      if (pendingPosts.length > 0) {
        this.sendMessage({
          type: 'PROCESS_PENDING_POSTS',
          data: { posts: pendingPosts }
        });
        console.log(`📤 Enviados ${pendingPosts.length} posts pendientes al SW`);
      } else {
        console.log('📭 No hay posts pendientes para enviar al SW');
      }
    } catch (error) {
      console.error('❌ Error enviando posts al SW:', error);
    }
  }

  // Enviar mensaje al SW (mejorado)
  async sendMessage(message) {
    if (!navigator.serviceWorker.controller) {
      console.warn('⚠️ No hay Service Worker controller activo');
      return false;
    }

    try {
      navigator.serviceWorker.controller.postMessage(message);
      console.log('📤 Mensaje enviado al SW:', message.type);
      return true;
    } catch (error) {
      console.error('❌ Error enviando mensaje al SW:', error);
      return false;
    }
  }

  // Solicitar sincronización de posts
  async requestSync() {
    const result = await this.sendMessage({
      type: 'REQUEST_SYNC',
      data: { timestamp: Date.now() }
    });
    
    if (result) {
      console.log('🔄 Sincronización solicitada al Service Worker');
    }
    
    return result;
  }

  // Obtener estado de sincronización
  async getSyncStatus() {
    const result = await this.sendMessage({
      type: 'GET_SYNC_STATUS',
      data: { timestamp: Date.now() }
    });
    return result;
  }

  // Sistema de eventos para la aplicación
  dispatchEvent(eventName, detail) {
    const event = new CustomEvent(`sw:${eventName}`, { detail });
    window.dispatchEvent(event);
  }

  // Escuchar eventos del Service Worker
  on(eventName, callback) {
    window.addEventListener(`sw:${eventName}`, (event) => {
      callback(event.detail);
    });
  }

  // Verificar si el Service Worker está listo
  async isSWReady() {
    if (!('serviceWorker' in navigator)) return false;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      return !!registration.active;
    } catch (error) {
      return false;
    }
  }

  // Forzar actualización del Service Worker
  async updateServiceWorker() {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      console.log('🔄 Service Worker actualizado');
      return true;
    } catch (error) {
      console.error('❌ Error actualizando Service Worker:', error);
      return false;
    }
  }
}

// Crear instancia global
export const swMessaging = new SWMessaging();

// Exportar funciones de conveniencia
export const sendMessageToSW = (type, data) => swMessaging.sendMessage({ type, data });
export const requestSync = () => swMessaging.requestSync();
export const onSWMessage = (event, callback) => swMessaging.on(event, callback);