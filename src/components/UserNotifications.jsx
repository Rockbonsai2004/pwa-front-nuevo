// components/UserNotifications.jsx
import { useState, useEffect } from 'react';
import { apiService } from '../services/api.js';
import './UserNotifications.css';

const UserNotifications = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [notificationForm, setNotificationForm] = useState({
    targetUserId: '',
    title: '',
    message: '',
    type: 'message'
  });

  useEffect(() => {
    fetchAvailableUsers();
  }, []);

  const fetchAvailableUsers = async () => {
    try {
      const response = await apiService.getAvailableUsers();
      if (response.success) {
        setUsers(response.users);
      }
    } catch (error) {
      console.error('❌ Error obteniendo usuarios:', error);
      setMessage('❌ Error cargando usuarios disponibles');
    }
  };

  const sendNotificationToUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await apiService.sendNotificationToUser(notificationForm);
      
      if (response.success) {
        setMessage('✅ Notificación enviada exitosamente');
        setNotificationForm({
          targetUserId: '',
          title: '',
          message: '',
          type: 'message'
        });
      } else {
        setMessage(`❌ ${response.message}`);
      }
    } catch (error) {
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendQuickNotification = async (userId, presetType) => {
    const presets = {
      greeting: {
        title: '👋 ¡Hola!',
        message: `${currentUser.username} te está saludando`
      },
      reminder: {
        title: '⏰ Recordatorio',
        message: `${currentUser.username} te envió un recordatorio`
      },
      alert: {
        title: '🚨 Alerta Importante',
        message: `${currentUser.username} te envió una alerta`
      }
    };

    const preset = presets[presetType];
    setNotificationForm(prev => ({
      ...prev,
      targetUserId: userId,
      title: preset.title,
      message: preset.message,
      type: presetType
    }));

    // Auto-enviar después de un breve delay
    setTimeout(() => {
      document.getElementById('notification-form').dispatchEvent(
        new Event('submit', { cancelable: true })
      );
    }, 100);
  };

};

export default UserNotifications;