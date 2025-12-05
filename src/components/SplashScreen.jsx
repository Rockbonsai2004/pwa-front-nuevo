import { useState, useEffect } from 'react';
import './SplashScreen.css';

const SplashScreen = ({ onLoadingComplete, backendStatus }) => {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingText, setLoadingText] = useState('Inicializando aplicación...');

  useEffect(() => {
    console.log('🎬 SplashScreen: Iniciando secuencia de carga...');
    
    const loadingSteps = [
      { progress: 20, text: 'Cargando componentes...' },
      { progress: 40, text: 'Verificando conexión...' },
      { progress: 60, text: 'Inicializando servicios...' },
      { progress: 80, text: 'Preparando interfaz...' },
      { progress: 95, text: 'Finalizando...' },
    ];

    let currentStep = 0;
    const totalSteps = loadingSteps.length;

    const interval = setInterval(() => {
      if (currentStep < totalSteps) {
        const step = loadingSteps[currentStep];
        setLoadingProgress(step.progress);
        setLoadingText(step.text);
        currentStep++;
      } else {
        clearInterval(interval);
        setLoadingProgress(100);
        setLoadingText('¡Listo!');
        
        // Esperar un poco antes de completar
        setTimeout(() => {
          console.log('✅ SplashScreen: Carga completada');
          if (onLoadingComplete) {
            onLoadingComplete();
          } else {
            console.warn('⚠️ SplashScreen: onLoadingComplete no proporcionado, auto-completando...');
            // Auto-completar después de 1 segundo adicional
            setTimeout(() => {
              console.log('🔄 SplashScreen: Auto-completado por seguridad');
            }, 1000);
          }
        }, 800);
      }
    }, 400);

    // Limpieza del intervalo
    return () => {
      clearInterval(interval);
      console.log('🧹 SplashScreen: Limpiando intervalos...');
    };
  }, [onLoadingComplete]);

  // Si el backend responde rápido, acelerar la carga
  useEffect(() => {
    if (backendStatus && !backendStatus.loading && loadingProgress < 80) {
      console.log('⚡ SplashScreen: Backend respondió, acelerando carga...');
      setLoadingProgress(80);
      setLoadingText('Conectado al servidor...');
    }
  }, [backendStatus, loadingProgress]);

  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="app-logo">
          <div className="logo-icon">🚀</div>
          <h1>Mi PWA App</h1>
        </div>
        
        <div className="loading-section">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          <p className="loading-text">{loadingText}</p>
          <div className="loading-details">
            {backendStatus && (
              <p className="backend-status">
                {backendStatus.loading ? '🔄 Verificando servidor...' : 
                 backendStatus.online ? '✅ Servidor conectado' : 
                 '❌ Servidor no disponible'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;