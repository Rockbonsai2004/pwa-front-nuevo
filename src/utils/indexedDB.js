// utils/indexedDB.js
const DB_NAME = 'PWA_OfflineDB';
const DB_VERSION = 2; // Incrementamos versión para añadir nuevo store
const STORES = {
  PENDING_POSTS: 'pending_posts',
  PENDING_AUTH: 'pending_auth_operations'
};

class IndexedDBManager {
  constructor() {
    this.db = null;
    this.isOpening = false;
    this.openQueue = [];
  }

  // Abrir/Crear la base de datos (con manejo de cola)
  async openDB() {
    if (this.db) return this.db;
    
    if (this.isOpening) {
      return new Promise((resolve) => {
        this.openQueue.push(resolve);
      });
    }

    this.isOpening = true;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        this.isOpening = false;
        this.processQueue(null);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isOpening = false;
        
        // Manejar cierre inesperado
        this.db.onclose = () => {
          console.log('⚠️ Conexión a IndexedDB cerrada');
          this.db = null;
        };
        
        this.db.onerror = (event) => {
          console.error('❌ Error en IndexedDB:', event.target.error);
        };
        
        resolve(this.db);
        this.processQueue(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const oldVersion = event.oldVersion;
        console.log('🔄 Actualizando IndexedDB de versión', oldVersion, 'a', DB_VERSION);
        
        // Migración desde versión 1 a 2
        if (oldVersion < 1) {
          // Crear store para posts pendientes
          if (!db.objectStoreNames.contains(STORES.PENDING_POSTS)) {
            const store = db.createObjectStore(STORES.PENDING_POSTS, { 
              keyPath: 'id', 
              autoIncrement: true 
            });
            
            // Crear índices para búsquedas
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('endpoint', 'endpoint', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('attempts', 'attempts', { unique: false });
            
            console.log('✅ ObjectStore creado:', STORES.PENDING_POSTS);
          }
        }

        // Migración para añadir store de autenticación
        if (oldVersion < 2) {
          // Crear store para operaciones de autenticación
          if (!db.objectStoreNames.contains(STORES.PENDING_AUTH)) {
            const store = db.createObjectStore(STORES.PENDING_AUTH, { 
              keyPath: 'id', 
              autoIncrement: true 
            });
            
            // Crear índices para búsquedas
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('type', 'type', { unique: false });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('attempts', 'attempts', { unique: false });
            store.createIndex('email', 'data.email', { unique: false });
            
            console.log('✅ ObjectStore creado:', STORES.PENDING_AUTH);
          }
        }
      };

      request.onblocked = () => {
        console.warn('⚠️ IndexedDB bloqueado por versión antigua abierta');
      };
    });
  }

  processQueue(db) {
    while (this.openQueue.length > 0) {
      const resolve = this.openQueue.shift();
      resolve(db);
    }
  }

  // Verificar si IndexedDB es soportado
  isSupported() {
    return 'indexedDB' in window;
  }

  // ===== MÉTODOS GENÉRICOS =====

  async add(storeName, data) {
    if (!this.isSupported()) {
      throw new Error('IndexedDB no es soportado en este navegador');
    }

    try {
      await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        
        const request = store.add({
          ...data,
          timestamp: data.timestamp || Date.now()
        });
        
        request.onsuccess = () => {
          console.log(`✅ Dato guardado en ${storeName}. ID:`, request.result);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error(`❌ Error guardando en ${storeName}:`, request.error);
          reject(request.error);
        };

        transaction.oncomplete = () => {
          console.log(`✅ Transacción completada para ${storeName}`);
        };
      });
    } catch (error) {
      console.error(`❌ Error en add para ${storeName}:`, error);
      throw error;
    }
  }

  async getAll(storeName) {
    if (!this.isSupported()) {
      console.warn('⚠️ IndexedDB no soportado, retornando array vacío');
      return [];
    }

    try {
      await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        
        request.onsuccess = () => {
          console.log(`📊 Obtenidos ${request.result.length} elementos de ${storeName}`);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error(`❌ Error obteniendo datos de ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`❌ Error en getAll para ${storeName}:`, error);
      return [];
    }
  }

  async update(storeName, data) {
    if (!this.isSupported()) {
      throw new Error('IndexedDB no es soportado');
    }

    try {
      await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = () => {
          console.log(`✅ Dato actualizado en ${storeName}. ID:`, data.id);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error(`❌ Error actualizando en ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`❌ Error en update para ${storeName}:`, error);
      throw error;
    }
  }

  async delete(storeName, id) {
    if (!this.isSupported()) {
      throw new Error('IndexedDB no es soportado');
    }

    try {
      await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);
        
        request.onsuccess = () => {
          console.log(`🗑️ Dato eliminado de ${storeName}. ID:`, id);
          resolve();
        };
        
        request.onerror = () => {
          console.error(`❌ Error eliminando de ${storeName}:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`❌ Error en delete para ${storeName}:`, error);
      throw error;
    }
  }

  async clear(storeName) {
    if (!this.isSupported()) return;

    try {
      await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          console.log(`🗑️ Todos los datos eliminados de ${storeName}`);
          resolve();
        };
        
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`❌ Error limpiando ${storeName}:`, error);
      throw error;
    }
  }

  // ===== MÉTODOS ESPECÍFICOS PARA POSTS =====

  async savePendingPost(postData) {
    return this.add(STORES.PENDING_POSTS, {
      ...postData,
      attempts: 0,
      status: 'pending',
      lastAttempt: null
    });
  }

  async getAllPendingPosts() {
    return this.getAll(STORES.PENDING_POSTS);
  }

  async getPostsByStatus(status = 'pending') {
    try {
      const allPosts = await this.getAllPendingPosts();
      return allPosts.filter(post => post.status === status);
    } catch (error) {
      console.error('❌ Error obteniendo posts por estado:', error);
      return [];
    }
  }

  async deletePendingPost(id) {
    return this.delete(STORES.PENDING_POSTS, id);
  }

  async updatePostAttempts(id, attempts) {
    try {
      const posts = await this.getAllPendingPosts();
      const post = posts.find(p => p.id === id);
      
      if (post) {
        post.attempts = attempts;
        post.lastAttempt = Date.now();
        
        // Cambiar estado si hay muchos intentos fallidos
        if (attempts >= 3) {
          post.status = 'failed';
        }
        
        await this.update(STORES.PENDING_POSTS, post);
        console.log(`🔄 Post ${id} actualizado. Intentos: ${attempts}`);
      } else {
        throw new Error(`Post con ID ${id} no encontrado`);
      }
    } catch (error) {
      console.error('❌ Error en updatePostAttempts:', error);
      throw error;
    }
  }

  async updatePostStatus(id, status) {
    try {
      const posts = await this.getAllPendingPosts();
      const post = posts.find(p => p.id === id);
      
      if (post) {
        post.status = status;
        post.lastAttempt = Date.now();
        await this.update(STORES.PENDING_POSTS, post);
      } else {
        throw new Error('Post no encontrado');
      }
    } catch (error) {
      console.error('❌ Error en updatePostStatus:', error);
      throw error;
    }
  }

  // ===== MÉTODOS ESPECÍFICOS PARA AUTENTICACIÓN =====

  async saveAuthOperation(operationData) {
    return this.add(STORES.PENDING_AUTH, {
      ...operationData,
      attempts: 0,
      status: 'pending',
      lastAttempt: null
    });
  }

  async getAllAuthOperations() {
    return this.getAll(STORES.PENDING_AUTH);
  }

  async getAuthOperationsByStatus(status = 'pending') {
    try {
      const allOperations = await this.getAllAuthOperations();
      return allOperations.filter(op => op.status === status);
    } catch (error) {
      console.error('❌ Error obteniendo operaciones por estado:', error);
      return [];
    }
  }

  async deleteAuthOperation(id) {
    return this.delete(STORES.PENDING_AUTH, id);
  }

  async updateAuthAttempts(id, attempts) {
    try {
      const operations = await this.getAllAuthOperations();
      const operation = operations.find(op => op.id === id);
      
      if (operation) {
        operation.attempts = attempts;
        operation.lastAttempt = Date.now();
        
        // Cambiar estado si hay muchos intentos fallidos
        if (attempts >= 3) {
          operation.status = 'failed';
        }
        
        await this.update(STORES.PENDING_AUTH, operation);
        console.log(`🔄 Operación auth ${id} actualizada. Intentos: ${attempts}`);
      } else {
        throw new Error(`Operación auth con ID ${id} no encontrada`);
      }
    } catch (error) {
      console.error('❌ Error en updateAuthAttempts:', error);
      throw error;
    }
  }

  async updateAuthStatus(id, status) {
    try {
      const operations = await this.getAllAuthOperations();
      const operation = operations.find(op => op.id === id);
      
      if (operation) {
        operation.status = status;
        operation.lastAttempt = Date.now();
        await this.update(STORES.PENDING_AUTH, operation);
      } else {
        throw new Error('Operación auth no encontrada');
      }
    } catch (error) {
      console.error('❌ Error en updateAuthStatus:', error);
      throw error;
    }
  }

  // ===== MÉTODOS DE ESTADÍSTICAS =====

  async getStats() {
    try {
      const [allPosts, allAuthOps] = await Promise.all([
        this.getAllPendingPosts(),
        this.getAllAuthOperations()
      ]);

      const postStats = {
        total: allPosts.length,
        pending: allPosts.filter(p => p.status === 'pending').length,
        failed: allPosts.filter(p => p.status === 'failed').length,
        totalAttempts: allPosts.reduce((sum, post) => sum + post.attempts, 0)
      };

      const authStats = {
        total: allAuthOps.length,
        pending: allAuthOps.filter(op => op.status === 'pending').length,
        failed: allAuthOps.filter(op => op.status === 'failed').length,
        totalAttempts: allAuthOps.reduce((sum, op) => sum + op.attempts, 0)
      };

      return {
        posts: postStats,
        auth: authStats,
        total: postStats.total + authStats.total,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { 
        posts: { total: 0, pending: 0, failed: 0, totalAttempts: 0 },
        auth: { total: 0, pending: 0, failed: 0, totalAttempts: 0 },
        total: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Limpiar todos los datos (para desarrollo)
  async clearAllData() {
    try {
      await Promise.all([
        this.clear(STORES.PENDING_POSTS),
        this.clear(STORES.PENDING_AUTH)
      ]);
      console.log('🗑️ Todos los datos eliminados de IndexedDB');
    } catch (error) {
      console.error('❌ Error limpiando datos:', error);
      throw error;
    }
  }

  // Verificar salud de la base de datos
  async healthCheck() {
    try {
      await this.openDB();
      const stats = await this.getStats();
      
      return {
        status: 'healthy',
        dbVersion: DB_VERSION,
        stores: Object.keys(STORES),
        ...stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        dbVersion: DB_VERSION,
        stores: Object.keys(STORES)
      };
    }
  }

  // Cerrar conexión (para limpieza)
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔒 Conexión a IndexedDB cerrada');
    }
  }

  // Crear object store dinámicamente (para compatibilidad)
  async createObjectStore(storeName, options = {}) {
    // En nuestra implementación, los stores se crean automáticamente en onupgradeneeded
    console.log(`ℹ️ Store ${storeName} se creará automáticamente en la próxima actualización`);
    return true;
  }
}

export const dbManager = new IndexedDBManager();