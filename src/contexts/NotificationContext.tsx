// src/contexts/NotificationContext.tsx
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { checklistApi } from '../services/checklistApi';
import {
  Notification as BackendNotification,
} from '../contracts/generated/api.types';

type BackendNotificationWithCompat = BackendNotification & {
  read?: boolean;
  isRead?: boolean;
  title?: string;
};

type NotificationType = 'info' | 'warning' | 'success' | 'error' | 'checklist' | 'handover' | 'reminder';
type Priority = 'low' | 'medium' | 'high';

interface Notification {
  id: string;
  type: NotificationType;
  title?: string;
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
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const hiddenNotificationIdsRef = useRef<Set<string>>(new Set());

  const mapNotificationType = (value?: string): NotificationType => {
    switch (value) {
      case 'CHECKLIST_ASSIGNED':
      case 'ITEM_DUE':
      case 'checklist':
        return 'checklist';
      case 'HANDOVER_NOTE':
      case 'handover':
        return 'handover';
      case 'REMINDER':
      case 'reminder':
        return 'reminder';
      case 'SUCCESS':
      case 'success':
        return 'success';
      case 'WARNING':
      case 'warning':
        return 'warning';
      case 'ERROR':
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  };

  const resolveNotificationType = (notification: BackendNotificationWithCompat): NotificationType => {
    if ((notification.related_entity || '').toLowerCase() === 'trustlink_run') {
      const signal = `${notification.title || ''} ${notification.message || ''}`.toLowerCase();
      if (signal.includes('failed')) return 'error';
      if (signal.includes('ready') || signal.includes('successfully')) return 'success';
      return 'info';
    }
    return mapNotificationType(notification.type || notification.category || notification.related_entity);
  };

  const isNotificationRead = (notification: BackendNotificationWithCompat): boolean => {
    return Boolean(notification.is_read ?? notification.read ?? notification.isRead);
  };

  const mapPriority = (priority?: string): Priority => {
    if (priority === 'high') return 'high';
    if (priority === 'low') return 'low';
    return 'medium';
  };

  const loadNotifications = useCallback(async () => {
    try {
      const apiNotifications = await checklistApi.getNotifications(true);
      const mappedNotifications: Notification[] = apiNotifications
        .map((n: BackendNotificationWithCompat) => ({
        id: n.id,
        type: resolveNotificationType(n),
        title: n.title || undefined,
        message: n.message,
        priority: mapPriority(n.priority),
        read: isNotificationRead(n),
        timestamp: new Date(n.created_at),
        relatedId: n.related_id,
        relatedType: n.related_type || n.related_entity
      }))
      .filter((n) => !n.read && !hiddenNotificationIdsRef.current.has(n.id));

      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      hiddenNotificationIdsRef.current.clear();
      setNotifications([]);
      return;
    }

    void loadNotifications();

    const intervalId = setInterval(() => {
      void loadNotifications();
    }, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, loadNotifications]);

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
        body: notification.title ? `${notification.title}\n${notification.message}` : notification.message,
        icon: '/logo192.png'
      });
    }
  };

  const markAsRead = async (id: string) => {
    hiddenNotificationIdsRef.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));

    try {
      await checklistApi.markNotificationAsRead(id);
      void loadNotifications();
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      hiddenNotificationIdsRef.current.delete(id);
      void loadNotifications();
    }
  };

  const markAllAsRead = async () => {
    notifications.forEach((notification) => hiddenNotificationIdsRef.current.add(notification.id));
    setNotifications([]);

    try {
      await checklistApi.markAllNotificationsAsRead();
      void loadNotifications();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      hiddenNotificationIdsRef.current.clear();
      void loadNotifications();
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

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
};
