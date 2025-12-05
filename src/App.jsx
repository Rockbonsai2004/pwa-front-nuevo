import { useState, useEffect } from 'react';
import { apiService } from './services/api.js';
import { offlineService } from './services/offlineService.js';
import SplashScreen from './components/SplashScreen.jsx';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import UserNotifications from './components/UserNotifications.jsx';
import CreatePost from './components/CreatePost.jsx';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('splash');
  const [user, setUser] = useState(null);
  const [backendStatus, setBackendStatus] = useState({
    online: false,
    loading: true,
    error: null
  });
  const [apiBaseUrl, setApiBaseUrl] = useState(
    import.meta.env.VITE_API_URL || 'https://pwa-back-xmqw.onrender.com'
  );
  const [splashLoading, setSplashLoading] = useState(true);

  useEffect(() => {
    initializeApp();
  }, [apiBaseUrl]);

  const initializeApp = async () => {
    console.log('🚀 Inicializando aplicación...');
    
    // Primero verificamos el backend
    await checkBackendStatus();
    
    // Luego verificamos si hay usuario almacenado
    await checkStoredUser();
    
    // Finalizamos el splash screen
    setSplashLoading(false);
    
    // Determinamos a qué vista ir
    determineNextView();
  };

  const checkBackendStatus = async () => {
    setBackendStatus(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔍 Verificando estado del backend...', apiBaseUrl);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${apiBaseUrl}/api/health`, {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Backend conectado:', data);
        setBackendStatus({
          online: true,
          loading: false,
          error: null,
          data: data
        });
      } else {
        console.warn('⚠️ Backend respondió con error:', response.status);
        setBackendStatus({
          online: false,
          loading: false,
          error: `Error ${response.status}: ${response.statusText}`
        });
      }
    } catch (error) {
      console.error('❌ Error conectando al backend:', error);
      
      let errorMessage = 'No se pudo conectar al servidor';
      
      if (error.name === 'AbortError') {
        errorMessage = 'El servidor está tardando demasiado en responder';
      } else if (error.name === 'TypeError') {
        if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Error de CORS o red - Verifica la configuración del servidor';
        } else {
          errorMessage = 'Error de red - Verifica tu conexión';
        }
      } else {
        errorMessage = error.message || 'Error desconocido';
      }

      setBackendStatus({
        online: false,
        loading: false,
        error: errorMessage
      });
    }
  };

  const checkStoredUser = async () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      try {
        console.log('🔐 Verificando token almacenado...');
        apiService.setToken(token);
        
        // Verificar si el token es válido intentando obtener el perfil
        if (backendStatus.online) {
          const profile = await apiService.getProfile(apiBaseUrl);
          if (profile && profile._id) {
            console.log('✅ Usuario autenticado encontrado:', profile.username);
            setUser(profile);
            return;
          }
        }
      } catch (error) {
        console.log('❌ Token inválido o expirado, limpiando...');
        apiService.logout();
      }
    }
    console.log('👤 No hay usuario autenticado');
    setUser(null);
  };

  const determineNextView = () => {
    // Si hay un usuario autenticado, ir al dashboard
    if (user) {
      console.log('🎯 Redirigiendo a dashboard (usuario autenticado)');
      setCurrentView('dashboard');
    } 
    // Si el backend está caído pero hay token, intentar login offline
    else if (!backendStatus.online && localStorage.getItem('authToken')) {
      console.log('🎯 Redirigiendo a login (modo offline con token)');
      setCurrentView('login');
    }
    // En cualquier otro caso, ir al login
    else {
      console.log('🎯 Redirigiendo a login');
      setCurrentView('login');
    }
  };

  const handleLogin = (userData, token) => {
    console.log('✅ Login exitoso:', userData.username);
    setUser(userData);
    apiService.setToken(token);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    console.log('🚪 Cerrando sesión...');
    setUser(null);
    apiService.logout();
    setCurrentView('login');
  };

  const handleSplashComplete = () => {
    console.log('🎬 Splash screen completado');
    setSplashLoading(false);
    determineNextView();
  };

  const retryBackendConnection = () => {
    setBackendStatus(prev => ({ ...prev, loading: true }));
    setTimeout(() => {
      checkBackendStatus().then(() => {
        determineNextView();
      });
    }, 500);
  };

  const changeApiBaseUrl = (newUrl) => {
    console.log('🔄 Cambiando URL del backend:', newUrl);
    setApiBaseUrl(newUrl);
    setBackendStatus({ online: false, loading: true, error: null });
    
    // Reiniciar la aplicación con la nueva URL
    setTimeout(() => {
      initializeApp();
    }, 1000);
  };

  const renderCurrentView = () => {
    // Mostrar splash screen mientras se inicializa
    if (splashLoading || (currentView === 'splash' && backendStatus.loading)) {
      return (
        <SplashScreen 
          onLoadingComplete={handleSplashComplete}
          backendStatus={backendStatus}
        />
      );
    }

    // Si el backend está caído, mostrar pantalla de error
    if (!backendStatus.online && !backendStatus.loading && currentView !== 'login') {
      return (
        <div className="error-screen">
          <div className="error-content">
            <h1>🔌 Problema de Conexión</h1>
            <p>No se pudo conectar con el servidor backend.</p>
            
            <div className="error-details">
              <p><strong>Error:</strong> {backendStatus.error}</p>
              <p><strong>URL intentada:</strong> {apiBaseUrl}</p>
              <p><strong>Usuario:</strong> {user ? user.username : 'No autenticado'}</p>
            </div>

            <div className="error-actions">
              <button onClick={retryBackendConnection} className="retry-btn">
                🔄 Reintentar Conexión
              </button>
              
              <div className="alternative-urls">
                <p>Si el problema persiste, prueba con:</p>
                <button 
                  onClick={() => changeApiBaseUrl('https://pwa-back-xmqw.onrender.com')}
                  className={`url-btn ${apiBaseUrl === 'https://pwa-back-xmqw.onrender.com' ? 'active' : ''}`}
                >
                  🌐 Producción: pwa-back-xmqw.onrender.com
                </button>
                <button 
                  onClick={() => changeApiBaseUrl('http://localhost:5000')}
                  className={`url-btn ${apiBaseUrl === 'http://localhost:5000' ? 'active' : ''}`}
                >
                  💻 Local: localhost:5000
                </button>
              </div>
            </div>

            <div className="offline-info">
              <p>
                <strong>Modo offline:</strong> Puedes usar la aplicación en modo limitado.
                Los datos se sincronizarán cuando se restablezca la conexión.
              </p>
              <button 
                onClick={() => setCurrentView('login')}
                className="offline-btn"
              >
                Continuar en Modo Offline
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Vistas normales cuando la aplicación está inicializada
    switch (currentView) {
      case 'login':
        return (
          <Login 
            onLogin={handleLogin} 
            backendStatus={backendStatus}
            apiBaseUrl={apiBaseUrl}
          />
        );
      case 'dashboard':
        return (
          <Dashboard 
            user={user} 
            onLogout={handleLogout}
            backendStatus={backendStatus}
            apiBaseUrl={apiBaseUrl}
          />
        );
      case 'notifications':
        return (
          <UserNotifications 
            user={user}
            onBack={() => setCurrentView('dashboard')}
            backendStatus={backendStatus}
            apiBaseUrl={apiBaseUrl}
          />
        );
      case 'create-post':
        return (
          <CreatePost 
            user={user}
            onBack={() => setCurrentView('dashboard')}
            backendStatus={backendStatus}
            apiBaseUrl={apiBaseUrl}
          />
        );
      default:
        return (
          <Login 
            onLogin={handleLogin} 
            backendStatus={backendStatus}
            apiBaseUrl={apiBaseUrl}
          />
        );
    }
  };

  return (
    <div className="app">
      {/* Header con estado de conexión - Solo mostrar cuando no sea splash */}

      {/* Contenido principal */}
      <main className="app-main">
        {renderCurrentView()}
      </main>

      {/* Footer informativo - Solo mostrar cuando no sea splash */}
      {!splashLoading && currentView !== 'splash' && currentView !== 'login' && (
        <footer className="app-footer">
          <p>
            Backend: {apiBaseUrl} | 
            Estado: {backendStatus.online ? '✅ En línea' : '❌ Offline'} |
            {user ? ` Usuario: ${user.username}` : ' No autenticado'}
          </p>
        </footer>
      )}
    </div>
  );
}

export default App;