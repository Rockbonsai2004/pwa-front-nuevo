import { useState, useEffect } from 'react';
import { apiService } from '../services/api.js';
import { notificationService } from '../services/notificationService.js';
import { postService } from '../services/postService.js';
import { dbManager } from '../utils/indexedDB.js';
import './Dashboard.css';

const Dashboard = ({ user, onLogout, backendStatus, apiBaseUrl }) => {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbInfo, setDbInfo] = useState(null);
  const [notificationStatus, setNotificationStatus] = useState({
    permission: 'default',
    subscribed: false,
    loading: false
  });
  const [customNotification, setCustomNotification] = useState({
    title: '',
    message: '',
    targetEmail: '',
    targetType: 'all'
  });
  const [sendingNotification, setSendingNotification] = useState(false);

  useEffect(() => {
    fetchImages();
    checkNotificationStatus();
  }, [apiBaseUrl]);

  const checkNotificationStatus = async () => {
    const status = await notificationService.getNotificationStatus();
    setNotificationStatus(prev => ({
      ...prev,
      ...status
    }));
  };

  const fetchImages = async () => {
    try {
      const data = await apiService.getImages(apiBaseUrl);
      setImages(data);
    } catch (error) {
      console.log('🌐 Error cargando imágenes, usando respaldo:', error.message);
      // Imágenes de respaldo
      const localImages = [
        { id: 1, url: 'https://picsum.photos/300/200?random=1', title: 'Imagen 1' },
        { id: 2, url: 'https://picsum.photos/300/200?random=2', title: 'Imagen 2' },
        { id: 3, url: 'https://picsum.photos/300/200?random=3', title: 'Imagen 3' },
        { id: 4, url: 'https://picsum.photos/300/200?random=4', title: 'Imagen 4' },
        { id: 5, url: 'https://picsum.photos/300/200?random=5', title: 'Imagen 5' },
        { id: 6, url: 'https://picsum.photos/300/200?random=6', title: 'Imagen 6' }
      ];
      setImages(localImages);
    } finally {
      setLoading(false);
    }
  };

  // ==================== NOTIFICACIONES PUSH ====================
  const handleEnableNotifications = async () => {
    setNotificationStatus(prev => ({ ...prev, loading: true }));
    
    try {
      const permissionGranted = await notificationService.requestPermission();
      
      if (permissionGranted) {
        await notificationService.subscribeToPush(apiBaseUrl);
        await checkNotificationStatus();
        setDbInfo('Notificaciones push activadas correctamente');
      }
    } catch (error) {
      setDbInfo(`Error activando notificaciones: ${error.message}`);
    } finally {
      setNotificationStatus(prev => ({ ...prev, loading: false }));
    }
  };

  const handleSendNotification = async () => {
    try {
      await apiService.sendNotification(
        'Notificación de prueba',
        'Esta es una notificación de prueba enviada desde el dashboard',
        '/icons/icon-192x192.png',
        '/',
        apiBaseUrl
      );
      setDbInfo('Notificación de prueba enviada a todos los usuarios');
    } catch (error) {
      setDbInfo(`Error enviando notificación: ${error.message}`);
    }
  };

  // Función para enviar notificación a usuario específico por email
  const handleSendToUser = async () => {
    if (!customNotification.targetEmail) {
      setDbInfo('❌ Por favor ingresa el email del usuario');
      return;
    }

    if (!customNotification.title) {
      setDbInfo('❌ Por favor ingresa un título para la notificación');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customNotification.targetEmail)) {
      setDbInfo('❌ Por favor ingresa un email válido');
      return;
    }

    setSendingNotification(true);
    try {
      // Primero verificamos que el usuario existe
      const userCheck = await apiService.getUserByEmail(customNotification.targetEmail, apiBaseUrl);
      
      if (!userCheck.success) {
        setDbInfo(`❌ Usuario no encontrado: ${customNotification.targetEmail}`);
        return;
      }

      // Enviar notificación usando el nuevo endpoint por email
      const result = await apiService.sendNotificationToEmail(
        customNotification.targetEmail,
        customNotification.title,
        customNotification.message || 'Tienes una nueva notificación',
        '/icons/icon-192x192.png',
        '/',
        null,
        'personal',
        apiBaseUrl
      );

      if (result.success) {
        setDbInfo(`✅ Notificación enviada a: ${customNotification.targetEmail}`);
        setCustomNotification({
          title: '',
          message: '',
          targetEmail: '',
          targetType: 'all'
        });
      } else {
        setDbInfo(`❌ Error: ${result.error || result.message}`);
      }
    } catch (error) {
      setDbInfo(`❌ Error enviando notificación: ${error.message}`);
    } finally {
      setSendingNotification(false);
    }
  };

  // Función para enviar notificación a múltiples usuarios por emails
  const handleSendToMultipleUsers = async () => {
    if (!customNotification.targetEmail) {
      setDbInfo('❌ Por favor ingresa los emails de los usuarios');
      return;
    }

    if (!customNotification.title) {
      setDbInfo('❌ Por favor ingresa un título para la notificación');
      return;
    }

    setSendingNotification(true);
    try {
      // Separar emails por comas y limpiar espacios
      const emails = customNotification.targetEmail
        .split(',')
        .map(email => email.trim())
        .filter(email => email.length > 0);

      if (emails.length === 0) {
        setDbInfo('❌ Por favor ingresa al menos un email válido');
        return;
      }

      // Validar formato de cada email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        setDbInfo(`❌ Emails inválidos: ${invalidEmails.join(', ')}`);
        return;
      }

      // Verificar qué usuarios existen
      const usersCheck = await apiService.getUsersByEmails(emails, apiBaseUrl);
      
      if (usersCheck.found === 0) {
        setDbInfo('❌ No se encontraron usuarios con los emails proporcionados');
        return;
      }

      // Enviar notificación a los emails usando el nuevo endpoint
      const result = await apiService.sendNotificationToEmails(
        emails,
        customNotification.title,
        customNotification.message || 'Tienes una nueva notificación',
        '/icons/icon-192x192.png',
        '/',
        null,
        'group',
        apiBaseUrl
      );

      if (result.success) {
        setDbInfo(`✅ Notificación enviada a ${usersCheck.found} de ${emails.length} usuarios`);
        setCustomNotification({
          title: '',
          message: '',
          targetEmail: '',
          targetType: 'all'
        });
      } else {
        setDbInfo(`❌ Error: ${result.error || result.message}`);
      }
    } catch (error) {
      setDbInfo(`❌ Error enviando notificaciones: ${error.message}`);
    } finally {
      setSendingNotification(false);
    }
  };

  const handleDisableNotifications = async () => {
    await notificationService.unsubscribe(apiBaseUrl);
    await checkNotificationStatus();
    setDbInfo('Notificaciones deshabilitadas');
  };

  // ==================== INDEXEDDB ====================
  const handleCreateObjectStore = () => {
    return new Promise((resolve, reject) => {
      const request = window.indexedDB.open('PWA_Database', 1);
      
      request.onerror = (event) => {
        const error = `❌ Error: ${event.target.error}`;
        setDbInfo(error);
        reject(event.target.error);
      };
      
      request.onsuccess = (event) => {
        const db = event.target.result;
        const info = `
✅ Base de datos abierta
📊 Nombre: ${db.name}
🔢 Versión: ${db.version}
📦 ObjectStores: ${Array.from(db.objectStoreNames).join(', ') || 'Ninguno'}
        `;
        setDbInfo(info);
        resolve(db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Crear ObjectStore para posts pendientes
        if (!db.objectStoreNames.contains('pending_posts')) {
          const store = db.createObjectStore('pending_posts', { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('endpoint', 'endpoint', { unique: false });
          setDbInfo('ObjectStore "pending_posts" creado con índices');
        }
      };
    });
  };

  const addTestData = async () => {
    try {
      const db = await handleCreateObjectStore();
      
      const transaction = db.transaction(['pending_posts'], 'readwrite');
      const postStore = transaction.objectStore('pending_posts');
      
      // Datos de prueba para posts pendientes
      const testPost = {
        endpoint: `${apiBaseUrl}/posts`,
        data: {
          title: 'Post de prueba desde IndexedDB',
          content: 'Este post se guardó localmente y se sincronizará cuando haya conexión',
          author: user.username,
          timestamp: new Date().toISOString()
        },
        method: 'POST',
        timestamp: Date.now(),
        attempts: 0,
        status: 'pending'
      };
      
      const postRequest = postStore.add(testPost);
      
      postRequest.onsuccess = () => {
        setDbInfo(prev => prev + `\n\n Post de prueba agregado (ID: ${postRequest.result})`);
      };
      
      postRequest.onerror = (error) => {
        setDbInfo(`❌ Error agregando post: ${error.target.error}`);
      };
      
    } catch (error) {
      setDbInfo(`❌ Error: ${error}`);
    }
  };

  const viewAllData = async () => {
    const request = window.indexedDB.open('PWA_Database');
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('pending_posts')) {
        setDbInfo('❌ No existe el ObjectStore "pending_posts". Crea primero la DB.');
        return;
      }
      
      const transaction = db.transaction(['pending_posts'], 'readonly');
      const postStore = transaction.objectStore('pending_posts');
      const postRequest = postStore.getAll();
      
      postRequest.onsuccess = () => {
        const posts = postRequest.result;
        let info = `POSTS PENDIENTES (${posts.length}):\n\n`;
        
        if (posts.length === 0) {
          info += 'No hay posts pendientes';
        } else {
          posts.forEach((post, index) => {
            info += `  POST ${index + 1}:\n`;
            info += `   ID: ${post.id}\n`;
            info += `   Endpoint: ${post.endpoint}\n`;
            info += `   Intentos: ${post.attempts}\n`;
            info += `   Estado: ${post.status}\n`;
            info += `   Fecha: ${new Date(post.timestamp).toLocaleString()}\n`;
            info += `   Datos: ${JSON.stringify(post.data).substring(0, 50)}...\n\n`;
          });
        }
        
        setDbInfo(info);
      };
      
      postRequest.onerror = (error) => {
        setDbInfo(`❌ Error leyendo datos: ${error.target.error}`);
      };
    };
  };

  const clearDatabase = () => {
    const request = window.indexedDB.open('PWA_Database');
    
    request.onsuccess = (event) => {
      const db = event.target.result;
      
      if (db.objectStoreNames.contains('pending_posts')) {
        const transaction = db.transaction(['pending_posts'], 'readwrite');
        const store = transaction.objectStore('pending_posts');
        const clearRequest = store.clear();
        
        clearRequest.onsuccess = () => {
          setDbInfo('Todos los posts pendientes fueron eliminados');
        };
        
        clearRequest.onerror = (error) => {
          setDbInfo(`❌ Error limpiando DB: ${error.target.error}`);
        };
      } else {
        setDbInfo('❌ No existe el ObjectStore "pending_posts"');
      }
    };
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="user-info">
          <h1>¡Bienvenido, {user.username}!</h1>
          <p>{user.email} | {user.role}</p>
        </div>
        <button onClick={onLogout} className="logout-btn">Cerrar Sesión</button>
      </header>

      {/* Panel de Notificaciones Push Mejorado */}
      <div className="notification-panel">
        <h2>Notificaciones Push</h2>
        
        <div className="notification-status">
          <p>
            <strong>Estado:</strong> {notificationStatus.permission === 'granted' ? '✅ Permitido' : 
                                    notificationStatus.permission === 'denied' ? '❌ Denegado' : '⚠️ No decidido'}
          </p>
          <p>
            <strong>Suscripción:</strong> {notificationStatus.subscribed ? '✅ Activa' : '❌ Inactiva'}
          </p>
        </div>

        <div className="notification-buttons">
          {!notificationStatus.subscribed ? (
            <button 
              onClick={handleEnableNotifications}
              disabled={notificationStatus.loading || notificationStatus.permission === 'denied'}
              className="notification-btn enable"
            >
              {notificationStatus.loading ? ' Cargando...' : 'Activar Notificaciones'}
            </button>
          ) : (
            <div className="notification-actions">
              <button 
                onClick={handleSendNotification}
                className="notification-btn send"
              >
                📤 Enviar a Todos
              </button>
            </div>
          )}
        </div>

        {/* Formulario para notificaciones personalizadas por EMAIL */}
        <div className="custom-notification-form">
          <h3>Notificaciones Personalizadas por Email</h3>
          
          <div className="form-group">
            <label>Título de la notificación:</label>
            <input
              type="text"
              value={customNotification.title}
              onChange={(e) => setCustomNotification(prev => ({
                ...prev,
                title: e.target.value
              }))}
              placeholder="Ej: Nuevo mensaje importante"
              disabled={sendingNotification}
            />
          </div>

          <div className="form-group">
            <label>Mensaje (opcional):</label>
            <textarea
              value={customNotification.message}
              onChange={(e) => setCustomNotification(prev => ({
                ...prev,
                message: e.target.value
              }))}
              placeholder="Ej: Tienes un nuevo mensaje de un usuario"
              rows="3"
              disabled={sendingNotification}
            />
          </div>

          <div className="target-selection">
            <div className="form-group">
              <label>Enviar a un usuario específico:</label>
              <input
                type="email"
                value={customNotification.targetEmail}
                onChange={(e) => setCustomNotification(prev => ({
                  ...prev,
                  targetEmail: e.target.value
                }))}
                placeholder="usuario@ejemplo.com"
                disabled={sendingNotification}
              />
              <div className="email-help">
                <small>Ingresa un solo email</small>
              </div>
              {customNotification.targetEmail && !customNotification.targetEmail.includes(',') && (
                <button 
                  onClick={handleSendToUser}
                  className="notification-btn user-specific"
                  disabled={sendingNotification}
                >
                  {sendingNotification ? '⏳ Enviando...' : '📨 Enviar a Usuario'}
                </button>
              )}
            </div>

            <div className="form-group">
              <label>Enviar a múltiples usuarios:</label>
              <textarea
                value={customNotification.targetEmail}
                onChange={(e) => setCustomNotification(prev => ({
                  ...prev,
                  targetEmail: e.target.value
                }))}
                placeholder="usuario1@ejemplo.com, usuario2@ejemplo.com, usuario3@ejemplo.com"
                rows="3"
                disabled={sendingNotification}
              />
              <div className="email-help">
                <small>Separa los emails con comas</small>
              </div>
              {customNotification.targetEmail && customNotification.targetEmail.includes(',') && (
                <div className="selected-users-info">
                  <p>Se enviará a {customNotification.targetEmail.split(',').filter(e => e.trim()).length} usuarios</p>
                  <button 
                    onClick={handleSendToMultipleUsers}
                    className="notification-btn multiple-users"
                    disabled={sendingNotification}
                  >
                    {sendingNotification ? '⏳ Enviando...' : `📬 Enviar a Múltiples Usuarios`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {notificationStatus.permission === 'denied' && (
          <p className="notification-warning">
            ❌ Los permisos para notificaciones están denegados. 
            Debes habilitarlos manualmente en la configuración de tu navegador.
          </p>
        )}
      </div>

      {/* Panel de Control - IndexedDB */}
      <div className="db-control-panel">
        <h2>Panel de Control - IndexedDB</h2>
        <p>Gestiona la base de datos local para posts offline</p>
        
        <div className="db-buttons">
          <button onClick={handleCreateObjectStore} className="db-btn create">
            Crear DB
          </button>
          <button onClick={addTestData} className="db-btn add">
            Agregar Post Prueba
          </button>
          <button onClick={viewAllData} className="db-btn view">
            Ver Posts Pendientes
          </button>
          <button onClick={clearDatabase} className="db-btn clear">
            Limpiar DB
          </button>
        </div>
        
        {dbInfo && (
          <div className="db-info">
            <h3>Información de la Base de Datos:</h3>
            <pre>{dbInfo}</pre>
          </div>
        )}
      </div>

      {/* Galería de Imágenes */}
      <div className="images-section">
        <h2>Galería de Imágenes</h2>
        <p>Las imágenes se cargan desde el backend y se cachean para offline</p>
        
        {loading ? (
          <div className="loading">Cargando imágenes...</div>
        ) : (
          <div className="images-grid">
            {images.map(image => (
              <div key={image.id} className="image-card">
                <img 
                  src={image.url} 
                  alt={image.title}
                  loading="lazy"
                  onError={(e) => {
                    e.target.src = `https://picsum.photos/300/200?random=${image.id + 10}`;
                  }}
                />
                <div className="image-info">
                  <h3>{image.title}</h3>
                  <span>ID: {image.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;