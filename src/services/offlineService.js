import { dbManager } from '../utils/indexedDB.js';

class OfflineService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.authStoreName = 'pending_auth_operations';
    this.useIndexedDB = true;
    this.init();
  }

  async init() {
    // Escuchar cambios de conexión
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Verificar si IndexedDB está disponible
    await this.checkIndexedDBSupport();
    
    console.log('🌐 Servicio offline inicializado. Estado:', this.isOnline ? 'online' : 'offline');
  }

  async checkIndexedDBSupport() {
    try {
      // Intentar inicializar IndexedDB
      await dbManager.init();
      this.useIndexedDB = true;
      console.log('✅ IndexedDB disponible');
    } catch (error) {
      this.useIndexedDB = false;
      console.log('⚠️ IndexedDB no disponible, usando localStorage como fallback');
    }
  }

  // ===== OPERACIONES DE AUTENTICACIÓN OFFLINE =====

  async saveAuthOperation(operationType, data) {
    try {
      const operation = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        type: operationType,
        data: data,
        timestamp: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
        lastAttempt: null
      };

      if (this.useIndexedDB) {
        await dbManager.saveAuthOperation(operation);
      } else {
        // Fallback a localStorage
        await this.saveToLocalStorage(operation);
      }
      
      // Emitir evento de actualización
      window.dispatchEvent(new CustomEvent('pendingOperationsUpdated'));
      
      console.log(`✅ Operación de ${operationType} guardada offline`);
      return true;
    } catch (error) {
      console.error('❌ Error guardando operación de autenticación:', error);
      
      // Intentar con localStorage como último recurso
      try {
        const operation = {
          id: Date.now() + Math.random().toString(36).substr(2, 9),
          type: operationType,
          data: data,
          timestamp: new Date().toISOString(),
          status: 'pending'
        };
        await this.saveToLocalStorage(operation);
        window.dispatchEvent(new CustomEvent('pendingOperationsUpdated'));
        return true;
      } catch (fallbackError) {
        console.error('❌ Error incluso con fallback localStorage:', fallbackError);
        return false;
      }
    }
  }

  async saveToLocalStorage(operation) {
    const key = 'pending_auth_operations';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.push(operation);
    localStorage.setItem(key, JSON.stringify(existing));
  }

  async getPendingAuthOperations() {
    try {
      if (this.useIndexedDB) {
        const operations = await dbManager.getAllAuthOperations();
        return operations.filter(op => op.status === 'pending');
      } else {
        // Fallback a localStorage
        const operations = JSON.parse(localStorage.getItem('pending_auth_operations') || '[]');
        return operations.filter(op => op.status === 'pending');
      }
    } catch (error) {
      console.error('❌ Error obteniendo operaciones pendientes:', error);
      
      // Fallback a localStorage
      try {
        const operations = JSON.parse(localStorage.getItem('pending_auth_operations') || '[]');
        return operations.filter(op => op.status === 'pending');
      } catch (fallbackError) {
        return [];
      }
    }
  }

  async syncPendingAuthOperations(onLoginCallback = null) {
    if (!this.isOnline) {
      console.log('🔌 No hay conexión - No se puede sincronizar');
      return { synced: 0, failed: 0, total: 0 };
    }

    try {
      const pendingOperations = await this.getPendingAuthOperations();
      let synced = 0;
      let failed = 0;

      console.log(`🔄 Sincronizando ${pendingOperations.length} operaciones de autenticación...`);

      for (const operation of pendingOperations) {
        try {
          const { apiService } = await import('./api.js');
          let result;

          if (operation.type === 'login') {
            result = await apiService.login(
              operation.data.email,
              operation.data.password,
              operation.data.apiBaseUrl || '/api'
            );
          } else if (operation.type === 'register') {
            result = await apiService.register(
              operation.data.username,
              operation.data.email,
              operation.data.password,
              operation.data.apiBaseUrl || '/api'
            );
          }

          if (result && result.success) {
            // Marcar como completado
            await this.markOperationCompleted(operation);
            synced++;
            
            // Ejecutar callback de login si está disponible
            if (operation.type === 'login' && onLoginCallback && typeof onLoginCallback === 'function') {
              onLoginCallback(result.user, result.token);
            }
            
            console.log(`✅ ${operation.type} sincronizado exitosamente`);
          } else {
            await this.handleFailedOperation(operation);
            failed++;
          }
        } catch (error) {
          await this.handleFailedOperation(operation);
          failed++;
          console.error(`❌ Error sincronizando ${operation.type}:`, error);
        }
      }

      // Emitir evento de actualización
      window.dispatchEvent(new CustomEvent('pendingOperationsUpdated'));

      console.log(`📊 Sincronización completada: ${synced} exitosas, ${failed} fallidas`);
      return { synced, failed, total: pendingOperations.length };
    } catch (error) {
      console.error('❌ Error en sincronización de autenticación:', error);
      return { synced: 0, failed: 0, total: 0 };
    }
  }

  async markOperationCompleted(operation) {
    try {
      const completedOperation = {
        ...operation,
        status: 'completed',
        completedAt: new Date().toISOString()
      };

      if (this.useIndexedDB) {
        await dbManager.update(this.authStoreName, completedOperation);
      } else {
        await this.updateInLocalStorage(completedOperation);
      }
    } catch (error) {
      console.error('Error marcando operación como completada:', error);
    }
  }

  async updateInLocalStorage(updatedOperation) {
    const key = 'pending_auth_operations';
    const operations = JSON.parse(localStorage.getItem(key) || '[]');
    const index = operations.findIndex(op => op.id === updatedOperation.id);
    
    if (index !== -1) {
      operations[index] = updatedOperation;
      localStorage.setItem(key, JSON.stringify(operations));
    }
  }

  async handleFailedOperation(operation) {
    const updatedOperation = {
      ...operation,
      attempts: (operation.attempts || 0) + 1,
      lastAttempt: new Date().toISOString()
    };

    // Si hay demasiados intentos fallidos, marcar como fallido permanentemente
    if (updatedOperation.attempts >= 3) {
      updatedOperation.status = 'failed';
    }

    if (this.useIndexedDB) {
      await dbManager.updateAuthStatus(operation.id, 'completed');
    } else {
      await this.updateInLocalStorage(updatedOperation);
    }
  }

  async clearPendingAuthOperations() {
    try {
      if (this.useIndexedDB) {
        const operations = await this.getPendingAuthOperations();
        for (const operation of operations) {
          await dbManager.delete(this.authStoreName, operation.id);
        }
      } else {
        // En localStorage, simplemente limpiamos todo
        localStorage.setItem('pending_auth_operations', '[]');
      }
      
      window.dispatchEvent(new CustomEvent('pendingOperationsUpdated'));
      console.log('🗑️ Operaciones de autenticación pendientes eliminadas');
      return true;
    } catch (error) {
      console.error('❌ Error eliminando operaciones pendientes:', error);
      return false;
    }
  }

  async getAuthOperationsStats() {
    try {
      let allOperations = [];
      
      if (this.useIndexedDB) {
        allOperations = await dbManager.getAllAuthOperations();
      } else {
        allOperations = JSON.parse(localStorage.getItem('pending_auth_operations') || '[]');
      }
      
      const pending = allOperations.filter(op => op.status === 'pending');
      const completed = allOperations.filter(op => op.status === 'completed');
      const failed = allOperations.filter(op => op.status === 'failed');

      return {
        total: allOperations.length,
        pending: pending.length,
        completed: completed.length,
        failed: failed.length
      };
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return { total: 0, pending: 0, completed: 0, failed: 0 };
    }
  }

  // ===== MÉTODOS EXISTENTES =====

  handleOnline() {
    this.isOnline = true;
    console.log('✅ Conexión restaurada - Sincronizando datos...');
    
    window.dispatchEvent(new CustomEvent('connectionChange', { 
      detail: { online: true } 
    }));

    // Sincronizar tanto posts como autenticación
    this.syncPendingData();
    this.syncPendingAuthOperations();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('🔌 Sin conexión - Modo offline activado');
    
    window.dispatchEvent(new CustomEvent('connectionChange', { 
      detail: { online: false } 
    }));
  }

  async syncPendingData() {
    try {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_PENDING_POSTS',
          data: { source: 'connection-restored' }
        });
      }
      console.log('🔄 Sincronización automática iniciada');
    } catch (error) {
      console.error('❌ Error en sincronización automática:', error);
    }
  }

  getConnectionStatus() {
    return {
      online: this.isOnline,
      timestamp: new Date().toISOString()
    };
  }

  // ... otros métodos existentes
}

// Crear instancia global
export const offlineService = new OfflineService();

// Exportar funciones individuales
export const getConnectionStatus = () => offlineService.getConnectionStatus();
export const saveAuthOperation = (type, data) => offlineService.saveAuthOperation(type, data);
export const getPendingAuthOperations = () => offlineService.getPendingAuthOperations();
export const syncPendingAuthOperations = (callback) => offlineService.syncPendingAuthOperations(callback);
export const clearPendingAuthOperations = () => offlineService.clearPendingAuthOperations();
export const getAuthOperationsStats = () => offlineService.getAuthOperationsStats();