// src/components/ui/NotificationContainer.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';
import { FaTimes, FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaCalendarAlt, FaFlag } from 'react-icons/fa';
import './NotificationContainer.css';

const NotificationContainer: React.FC = () => {
  const { notifications, markAsRead, removeNotification } = useNotifications();
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const closeTimersRef = useRef<Map<string, number>>(new Map());
  const unreadNotifications = notifications.filter((notification) => !notification.read);

  const formatRelativeTime = (timestamp: Date) => {
    const deltaMs = Date.now() - timestamp.getTime();
    const seconds = Math.floor(deltaMs / 1000);
    if (seconds < 60) return 'now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  useEffect(() => {
    const timers = closeTimersRef.current;
    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      timers.clear();
    };
  }, []);

  const handleClose = useCallback((id: string) => {
    let shouldClose = false;
    setClosingIds(prev => {
      if (prev.has(id)) return prev;
      shouldClose = true;
      return new Set(prev).add(id);
    });
    if (!shouldClose) return;

    // Keep read sync with backend, but never block UI dismissal.
    void markAsRead(id);

    const timerId = window.setTimeout(() => {
      removeNotification(id);
      setClosingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      closeTimersRef.current.delete(id);
    }, 180);

    closeTimersRef.current.set(id, timerId);
  }, [markAsRead, removeNotification]);

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
      {unreadNotifications.map(notification => (
        <div 
          key={notification.id}
          className={`notification ${notification.type} priority-${notification.priority} ${notification.read ? 'read' : 'unread'} ${closingIds.has(notification.id) ? 'closing' : ''}`}
        >
          <div className="notification-icon">{getIcon(notification.type)}</div>
          <div className="notification-content">
            <div className="notification-message">{notification.message}</div>
            <div className="notification-meta">
              <span className="notification-priority">{notification.priority}</span>
              <span className="notification-time">{formatRelativeTime(notification.timestamp)}</span>
            </div>
          </div>
          <button 
            className="notification-close"
            onClick={() => handleClose(notification.id)}
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
