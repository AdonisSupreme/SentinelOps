import React, { createContext, useContext, useState, ReactNode } from 'react';
import { FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaBell, FaCalendarAlt } from 'react-icons/fa';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from './AuthContext';

type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'leave' | 'reminder';
type Priority = 'low' | 'medium' | 'high';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  priority: Priority;
  read: boolean;
  timestamp: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';
  
  useWebSocket(wsUrl, (data) => {
    if (data.type === 'notification' && data.userId === user?.id) {
      addNotification({
        type: data.category,
        message: data.message,
        priority: data.priority
      });
    }
  });

  const addNotification = (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      ...notification,
      read: false,
      timestamp: new Date()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        unreadCount, 
        addNotification, 
        markAsRead, 
        markAllAsRead,
        removeNotification
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};

export const NotificationContainer: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <FaCheckCircle />;
      case 'warning': 
      case 'error': return <FaExclamationTriangle />;
      case 'leave': return <FaCalendarAlt />;
      case 'reminder': return <FaBell />;
      default: return <FaInfoCircle />;
    }
  };

  return (
    <div className="notification-wrapper">
      <button 
        className="notification-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle notifications"
      >
        <FaBell />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      
      {isOpen && (
        <div className="notification-container">
          <div className="notification-header">
            <h4>Notifications</h4>
            <button onClick={markAllAsRead}>Mark all as read</button>
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-state">No notifications</div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`notification ${notification.type} ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="notification-icon">{getIcon(notification.type)}</div>
                  <div className="notification-content">
                    <div className="message">{notification.message}</div>
                    <div className="timestamp">
                      {new Date(notification.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!notification.read && <div className="unread-indicator"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};