class ApiService {
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL || 'https://pwa-back-xmqw.onrender.com';
    this.token = localStorage.getItem('authToken');
  }

  // Obtener token de autenticación
  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  // Establecer token
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  // ==================== UTILIDADES ====================

  // Construir URL correctamente (CORREGIDO)
  buildUrl(endpoint, customBaseUrl = null) {
    const baseUrl = customBaseUrl || this.baseUrl;
    
    console.log('🔗 Construyendo URL:', { baseUrl, endpoint });
    
    // Limpiar la base URL - remover trailing slash
    let cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    
    // Limpiar el endpoint - asegurar que empiece con /
    let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    // Si la base URL ya contiene /api, no duplicar
    if (cleanBaseUrl.endsWith('/api')) {
      cleanBaseUrl = cleanBaseUrl.slice(0, -4); // Remover /api
    }
    
    // Asegurar que el endpoint empiece con /api/
    if (!cleanEndpoint.startsWith('/api/')) {
      cleanEndpoint = `/api${cleanEndpoint}`;
    }
    
    const finalUrl = `${cleanBaseUrl}${cleanEndpoint}`;
    console.log('🔗 URL final construida:', finalUrl);
    
    return finalUrl;
  }

  // Manejar respuesta HTTP
  async handleResponse(response) {
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      let errorMessage = data.error || data.message || `Error ${response.status}: ${response.statusText}`;
      
      // Mensajes más específicos para errores comunes
      if (response.status === 401) {
        errorMessage = data.error || data.message || 'Credenciales inválidas. Verifica tu email y contraseña.';
      } else if (response.status === 404) {
        errorMessage = data.error || data.message || 'Ruta no encontrada. Verifica la URL del servidor.';
      } else if (response.status === 500) {
        errorMessage = data.error || data.message || 'Error interno del servidor.';
      }
      
      const error = new Error(errorMessage);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    
    return data;
  }

  // ==================== AUTENTICACIÓN ====================
  
  // Login de usuario
  async login(email, password, customBaseUrl = null) {
    try {
      const url = this.buildUrl('/auth/login', customBaseUrl);
      console.log('🔗 URL de login:', url);
      console.log('📧 Email:', email);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password })
      });

      const data = await this.handleResponse(response);
      
      if (data.token) {
        this.setToken(data.token);
        console.log('✅ Token guardado correctamente');
      }
      
      return {
        success: true,
        user: data.user || data,
        token: data.token,
        message: data.message || 'Login exitoso'
      };
    } catch (error) {
      console.error('❌ Error en login:', error);
      
      // Retornar estructura consistente incluso en errores
      return {
        success: false,
        error: error.message,
        status: error.status
      };
    }
  }

  // Registro de usuario
  async register(username, email, password, customBaseUrl = null) {
    try {
      const url = this.buildUrl('/auth/register', customBaseUrl);
      console.log('🔗 URL de registro:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, email, password })
      });

      const data = await this.handleResponse(response);
      
      if (data.token) {
        this.setToken(data.token);
        console.log('✅ Token guardado correctamente');
      }
      
      return {
        success: true,
        user: data.user || data,
        token: data.token,
        message: data.message || 'Registro exitoso'
      };
    } catch (error) {
      console.error('❌ Error en registro:', error);
      
      return {
        success: false,
        error: error.message,
        status: error.status
      };
    }
  }

  // Obtener perfil del usuario actual
  async getProfile(customBaseUrl = null) {
    try {
      const url = this.buildUrl('/auth/profile', customBaseUrl);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error obteniendo perfil:', error);
      throw error;
    }
  }

  // Cerrar sesión
  logout() {
    this.setToken(null);
    localStorage.removeItem('authToken');
    console.log('✅ Sesión cerrada');
  }

  // ==================== USUARIOS ====================

  // Buscar usuario por email
  async getUserByEmail(email, customBaseUrl = null) {
    try {
      const url = this.buildUrl(`/users/email/${encodeURIComponent(email)}`, customBaseUrl);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error buscando usuario por email:', error);
      throw error;
    }
  }

  // Buscar múltiples usuarios por emails
  async getUsersByEmails(emails, customBaseUrl = null) {
    try {
      const url = this.buildUrl('/users/emails', customBaseUrl);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ emails })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error buscando usuarios por emails:', error);
      throw error;
    }
  }

  // ==================== NOTIFICACIONES PUSH ====================

  // Suscribirse a notificaciones push
  async subscribeToPush(subscription, customBaseUrl = null) {
    try {
      const url = this.buildUrl('/push/subscribe', customBaseUrl);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ subscription })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error suscribiendo a push:', error);
      throw error;
    }
  }

  // Desuscribirse de notificaciones push
  async unsubscribeFromPush(subscription, customBaseUrl = null) {
    try {
      const url = this.buildUrl('/push/subscription', customBaseUrl);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error desuscribiendo de push:', error);
      throw error;
    }
  }

  // Enviar notificación global
  async sendNotification(title, message, icon, url, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/push/send', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          title,
          message,
          icon,
          url
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error enviando notificación global:', error);
      throw error;
    }
  }

  // Enviar notificación a usuario específico
  async sendNotificationToUser(userId, title, message, icon, url, image, tag, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl(`/push/send-to-user/${userId}`, customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          title,
          message,
          icon,
          url,
          image,
          tag
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error enviando notificación a usuario:', error);
      throw error;
    }
  }

  // Enviar notificación a usuario por email
  async sendNotificationToEmail(email, title, message, icon, url, image, tag, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/push/send-to-email', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          email,
          title,
          message,
          icon,
          url,
          image,
          tag
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error enviando notificación por email:', error);
      throw error;
    }
  }

  // Enviar notificación a múltiples usuarios
  async sendNotificationToUsers(userIds, title, message, icon, url, image, tag, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/push/send-to-users', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          userIds,
          title,
          message,
          icon,
          url,
          image,
          tag
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error enviando notificación a usuarios:', error);
      throw error;
    }
  }

  // Enviar notificación a múltiples usuarios por emails
  async sendNotificationToEmails(emails, title, message, icon, url, image, tag, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/push/send-to-emails', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify({
          emails,
          title,
          message,
          icon,
          url,
          image,
          tag
        })
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error enviando notificación a emails:', error);
      throw error;
    }
  }

  // Obtener estadísticas de notificaciones
  async getPushStats(customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/push/stats', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      throw error;
    }
  }

  // ==================== POSTS ====================

  // Obtener todos los posts
  async getPosts(customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/posts', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error obteniendo posts:', error);
      throw error;
    }
  }

  // Crear nuevo post
  async createPost(postData, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/posts', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getToken()}`
        },
        body: JSON.stringify(postData)
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error creando post:', error);
      throw error;
    }
  }

  // Obtener imágenes
  async getImages(customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/images', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error obteniendo imágenes:', error);
      throw error;
    }
  }

  // ==================== NOTIFICACIONES ====================

  // Obtener notificaciones del usuario
  async getNotifications(customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl('/notifications', customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error obteniendo notificaciones:', error);
      throw error;
    }
  }

  // Marcar notificación como leída
  async markNotificationAsRead(notificationId, customBaseUrl = null) {
    try {
      const endpoint = this.buildUrl(`/notifications/${notificationId}/read`, customBaseUrl);
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getToken()}`
        }
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error('❌ Error marcando notificación como leída:', error);
      throw error;
    }
  }

  // ==================== MÉTODOS DE PRUEBA ====================

  // Método de prueba para notificaciones
  async tNotification(customBaseUrl = null) {
    return await this.sendNotification(
      'Notificación de prueba',
      'Esta es una notificación de prueba enviada desde la aplicación',
      '/icons/icon-192x192.png',
      '/',
      customBaseUrl
    );
  }

  // Verificar conexión con el servidor
  async healthCheck(customBaseUrl = null) {
    try {
      const url = this.buildUrl('/health', customBaseUrl);
      const response = await fetch(url);
      return response.ok;
    } catch (error) {
      console.error('❌ Error en health check:', error);
      return false;
    }
  }

  // Verificar si el backend está disponible
  async checkBackendStatus(customBaseUrl = null) {
    try {
      const health = await this.healthCheck(customBaseUrl);
      return {
        online: health,
        url: customBaseUrl || this.baseUrl,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        online: false,
        url: customBaseUrl || this.baseUrl,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Método para debug: mostrar información de la URL
  debugUrl(endpoint, customBaseUrl = null) {
    const url = this.buildUrl(endpoint, customBaseUrl);
    console.log('🔍 Debug URL:', {
      endpoint,
      customBaseUrl,
      finalUrl: url
    });
    return url;
  }
}

export const apiService = new ApiService();