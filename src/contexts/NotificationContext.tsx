// src/contexts/NotificationContext.tsx (Updated)
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { FaInfoCircle, FaExclamationTriangle, FaCheckCircle, FaBell, FaCalendarAlt, FaFlag } from 'react-icons/fa';
import { useAuth } from './AuthContext';
import { checklistApi } from '../services/checklistApi';
import {
  Notification as BackendNotification,
  BackendError,
} from '../contracts/generated/api.types';

type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'checklist' | 'handover' | 'reminder';
type Priority = 'low' | 'medium' | 'high';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  priority: Priority;
  read: boolean;
  timestamp: Date;
  relatedId?: string;
  relatedType?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();

  // Load initial notifications from API
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // Poll for notifications every 30 seconds (instead of WebSocket)
  useEffect(() => {
    if (!user) return;

    // Initial load
    loadNotifications();

    // Set up polling interval
    const intervalId = setInterval(() => {
      loadNotifications();
    }, 30000); // Poll every 30 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [user]);

  const mapNotificationType = (category: string): NotificationType => {
    switch (category) {
      case 'CHECKLIST_ASSIGNED':
      case 'ITEM_DUE':
        return 'checklist';
      case 'HANDOVER_NOTE':
        return 'handover';
      case 'REMINDER':
        return 'reminder';
      case 'SUCCESS':
        return 'success';
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      default:
        return 'info';
    }
  };

  const loadNotifications = async () => {
    try {
      const apiNotifications = await checklistApi.getNotifications(true);
      const mappedNotifications: Notification[] = apiNotifications.map((n: BackendNotification) => ({
        id: n.id,
        type: mapNotificationType(n.related_entity || 'info'),
        message: n.message,
        priority: n.priority === 'high' ? 'high' : n.priority === 'low' ? 'low' : 'medium',
        read: n.is_read,
        timestamp: new Date(n.created_at),
        relatedId: n.related_id,
        relatedType: n.related_entity
      }));
      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      ...notification,
      read: false,
      timestamp: new Date()
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 49)]);
    
    // Show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('SentinelOps', {
        body: notification.message,
        icon: '/logo192.png'
      });
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await checklistApi.markNotificationAsRead(id);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await checklistApi.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
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
        removeNotification,
        loadNotifications
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

// Updated NotificationContainer component
export const NotificationContainer: React.FC = () => {
  const { notifications, markAsRead, markAllAsRead, unreadCount, loadNotifications } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  
  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success': return <FaCheckCircle />;
      case 'warning': 
      case 'error': return <FaExclamationTriangle />;
      case 'checklist': return <FaBell />;
      case 'handover': return <FaFlag />;
      case 'reminder': return <FaCalendarAlt />;
      default: return <FaInfoCircle />;
    }
  };

  const getTypeClass = (type: NotificationType) => {
    switch (type) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'checklist': return 'checklist';
      case 'handover': return 'handover';
      default: return 'info';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    // Navigate based on notification type
    if (notification.relatedType === 'CHECKLIST_INSTANCE' && notification.relatedId) {
      window.location.href = `/checklist/${notification.relatedId}`;
    }
  };

  return (
    <div className="notification-wrapper">
      <button 
        className="notification-trigger"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            loadNotifications();
          }
        }}
        aria-label="Toggle notifications"
      >
        <FaBell />
        {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
      </button>
      
      {isOpen && (
        <div className="notification-container">
          <div className="notification-header">
            <h4>Operational Notifications</h4>
            <button onClick={markAllAsRead}>Mark all as read</button>
          </div>
          
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-state">All caught up! No new notifications.</div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`notification ${getTypeClass(notification.type)} ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => handleNotificationClick(notification)}
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
          
          <div className="notification-footer">
            <button className="refresh-btn" onClick={loadNotifications}>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};