// src/components/ui/NotificationContainer.tsx
import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaCheckCircle } from 'react-icons/fa';

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <FaCheckCircle />;
      case 'warning': return <FaExclamationTriangle />;
      case 'error': return <FaExclamationTriangle />;
      default: return <FaInfoCircle />;
    }
  };

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id}
          className={`notification ${notification.type}`}
        >
          <div className="notification-icon">{getIcon(notification.type)}</div>
          <div className="notification-content">
            {notification.message}
          </div>
          <button 
            className="notification-close"
            onClick={() => removeNotification(notification.id)}
            aria-label="Close notification"
          >
            <FaTimes />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;