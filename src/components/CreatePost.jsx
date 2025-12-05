import { useState } from 'react';
import { postService } from '../services/postService.js';
import './CreatePost.css';

const CreatePost = () => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // Usar el servicio de posts actualizado
      const result = await postService.sendPost(title, content);
      
      if (result.success === false && result.localId) {
        setMessage('Post guardado localmente. Se enviará cuando haya conexión.');
      } else {
        setMessage('Post publicado exitosamente!');
        setTitle('');
        setContent('');
      }
    } catch (error) {
      setMessage('❌ Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSync = () => {
    // Esta función ahora está integrada en el servicio
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SYNC_PENDING_POSTS'
      });
      setMessage(' Sincronización manual iniciada...');
    } else {
      setMessage('❌ Service Worker no disponible para sincronización');
    }
  };

  return (
    <div className="create-post">
      <h2>Crear Nuevo Post</h2>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Título del post"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          minLength="3"
        />
        
        <textarea
          placeholder="Contenido del post"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          minLength="10"
          rows="5"
        />
        
        <button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : 'Publicar Post'}
        </button>
      </form>

      {message && (
        <div className={`message ${message.includes('✅') ? 'success' : 
                          message.includes('📝') ? 'info' : 'error'}`}>
          {message}
        </div>
      )}

      <button 
        onClick={handleManualSync}
        className="sync-btn"
      >
        🔄 Sincronizar Manualmente Posts Pendientes
      </button>

      <div className="post-info">
        <p><strong>💡 Funcionalidades:</strong></p>
        <ul>
          <li>✅ Posts se guardan en IndexedDB si no hay conexión</li>
          <li>🔄 Sincronización automática cuando recuperas conexión</li>
          <li>📱 Funciona completamente offline</li>
          <li>🚀 Background Sync para envío automático</li>
        </ul>
      </div>
    </div>
  );
};

export default CreatePost;