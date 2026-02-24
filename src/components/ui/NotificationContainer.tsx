// src/components/ui/NotificationContainer.tsx
import React from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt, FaFlag } from 'react-icons/fa';
import './NotificationContainer.css';

const NotificationContainer: React.FC = () => {
  const { notifications, markAsRead, removeNotification } = useNotifications();

  console.log('🔔 NotificationContainer: Current notifications:', notifications);
  console.log('🔔 NotificationContainer: Unread count:', notifications.filter(n => !n.read).length);

  const handleMarkAsRead = async (id: string) => {
    console.log('🔔 NotificationContainer: Marking notification as read:', id);
    await markAsRead(id);
  };

  const getIcon = (type: string) => {
    const iconProps = {
      size: 18,
      className: 'notification-type-icon'
    };

    switch (type) {
      case 'success': return <FaCheckCircle {...iconProps} />;
      case 'warning': return <FaExclamationTriangle {...iconProps} />;
      case 'error': return <FaExclamationTriangle {...iconProps} />;
      case 'checklist': return <FaCalendarAlt {...iconProps} />;
      case 'handover': return <FaFlag {...iconProps} />;
      default: return <FaInfoCircle {...iconProps} />;
    }
  };

  return (
    <div className="notification-container">
      {notifications.map(notification => (
        <div 
          key={notification.id}
          className={`notification ${notification.type} ${notification.read ? 'read' : 'unread'}`}
        >
          <div className="notification-icon">{getIcon(notification.type)}</div>
          <div className="notification-content">
            {notification.message}
          </div>
          <button 
            className="notification-close"
            onClick={() => handleMarkAsRead(notification.id)}
            aria-label="Close notification"
            title="Mark as read"
          >
            <FaTimes />
          </button>
        </div>
      ))}
    </div>
  );
};

export default NotificationContainer;