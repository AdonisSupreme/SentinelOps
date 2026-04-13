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
  priority?: string;
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
  popupNotifications: Notification[];
  unreadCount: number;
  browserPermission: NotificationPermission | 'unsupported';
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  requestBrowserPermission: () => Promise<NotificationPermission | 'unsupported'>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  removeNotification: (id: string) => void;
  loadNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [popupNotifications, setPopupNotifications] = useState<Notification[]>([]);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | 'unsupported'>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const { user } = useAuth();
  const hiddenNotificationIdsRef = useRef<Set<string>>(new Set());
  const popupTimeoutsRef = useRef<Map<string, number>>(new Map());
  const seenPersistentNotificationIdsRef = useRef<Set<string>>(new Set());
  const browserAlertedIdsRef = useRef<Set<string>>(new Set());
  const baselineLoadedRef = useRef(false);

  const clearPopupTimeout = useCallback((id: string) => {
    const timeoutId = popupTimeoutsRef.current.get(id);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      popupTimeoutsRef.current.delete(id);
    }
  }, []);

  const getPopupDuration = useCallback((priority: Priority) => {
    switch (priority) {
      case 'high':
        return 12000;
      case 'medium':
        return 8000;
      default:
        return 5000;
    }
  }, []);

  const getRouteForNotification = useCallback((notification: Pick<Notification, 'relatedId' | 'relatedType'>) => {
    const relatedType = (notification.relatedType || '').toLowerCase();

    if (
      notification.relatedId &&
      ['checklist_manager_review', 'checklist_manager_alert', 'checklist_instance'].includes(relatedType)
    ) {
      return `/checklist/${notification.relatedId}`;
    }

    if (notification.relatedId && relatedType === 'task') {
      return `/tasks?task=${notification.relatedId}`;
    }

    if (notification.relatedId && relatedType === 'network_service') {
      return `/network-sentinel?service=${notification.relatedId}&tab=timeline`;
    }

    if (relatedType === 'schedule') {
      return '/schedule';
    }

    if (relatedType === 'performance_badge') {
      return '/performance#badge-forge';
    }

    return null;
  }, []);

  const showBrowserNotification = useCallback((notification: Notification) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }
    if (browserAlertedIdsRef.current.has(notification.id)) {
      return;
    }

    browserAlertedIdsRef.current.add(notification.id);
    const route = getRouteForNotification(notification);
    const desktopNotification = new Notification(notification.title || 'SentinelOps', {
      body: notification.message,
      icon: '/logo192.png',
      tag: `sentinelops-${notification.id}`,
      requireInteraction: notification.priority === 'high',
      silent: false,
    });

    desktopNotification.onclick = () => {
      window.focus();
      if (route) {
        window.location.assign(route);
      }
      desktopNotification.close();
    };
  }, [getRouteForNotification]);

  const queuePopupNotification = useCallback((notification: Notification) => {
    setPopupNotifications((prev) => {
      const withoutDuplicate = prev.filter((item) => item.id !== notification.id);
      return [notification, ...withoutDuplicate].slice(0, 5);
    });

    clearPopupTimeout(notification.id);
    const timeoutId = window.setTimeout(() => {
      setPopupNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      popupTimeoutsRef.current.delete(notification.id);
    }, getPopupDuration(notification.priority));
    popupTimeoutsRef.current.set(notification.id, timeoutId);
  }, [clearPopupTimeout, getPopupDuration]);

  const pushLiveAlert = useCallback((notification: Notification, options?: { browser?: boolean }) => {
    queuePopupNotification(notification);
    if (options?.browser !== false) {
      showBrowserNotification(notification);
    }
  }, [queuePopupNotification, showBrowserNotification]);

  const dismissPopupNotification = useCallback((id: string) => {
    clearPopupTimeout(id);
    setPopupNotifications((prev) => prev.filter((notification) => notification.id !== id));
  }, [clearPopupTimeout]);

  const mapNotificationType = (value?: string): NotificationType => {
    switch (value) {
      case 'checklist_manager_review':
        return 'warning';
      case 'checklist_manager_alert':
        return 'error';
      case 'CHECKLIST_ASSIGNED':
      case 'ITEM_DUE':
      case 'item_action':
      case 'subitem_action':
      case 'checklist_completion':
      case 'checklist':
        return 'checklist';
      case 'performance_badge':
        return 'success';
      case 'schedule':
        return 'reminder';
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

      if (!baselineLoadedRef.current) {
        seenPersistentNotificationIdsRef.current = new Set(mappedNotifications.map((notification) => notification.id));
        baselineLoadedRef.current = true;
      } else {
        const unseenNotifications = mappedNotifications
          .filter((notification) => !seenPersistentNotificationIdsRef.current.has(notification.id))
          .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());

        unseenNotifications.forEach((notification) => {
          pushLiveAlert(notification);
        });

        seenPersistentNotificationIdsRef.current = new Set(mappedNotifications.map((notification) => notification.id));
      }

      setNotifications(mappedNotifications);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, [pushLiveAlert]);

  const requestBrowserPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!('Notification' in window)) {
      setBrowserPermission('unsupported');
      return 'unsupported';
    }

    if (Notification.permission === 'granted') {
      setBrowserPermission('granted');
      return 'granted';
    }

    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
    return permission;
  }, []);

  useEffect(() => {
    if (!user) {
      hiddenNotificationIdsRef.current.clear();
      seenPersistentNotificationIdsRef.current.clear();
      browserAlertedIdsRef.current.clear();
      baselineLoadedRef.current = false;
      setNotifications([]);
      popupTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      popupTimeoutsRef.current.clear();
      setPopupNotifications([]);
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

  useEffect(() => {
    if (!('Notification' in window)) {
      setBrowserPermission('unsupported');
      return;
    }
    setBrowserPermission(Notification.permission);
  }, []);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotification: Notification = {
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...notification,
      read: false,
      timestamp: new Date()
    };

    pushLiveAlert(newNotification);
  }, [pushLiveAlert]);

  const markAsRead = async (id: string) => {
    const isPersistentNotification = notifications.some((notification) => notification.id === id);
    if (!isPersistentNotification) {
      dismissPopupNotification(id);
      return;
    }

    hiddenNotificationIdsRef.current.add(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    dismissPopupNotification(id);

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
    const persistentIds = new Set(notifications.map((notification) => notification.id));
    notifications.forEach((notification) => hiddenNotificationIdsRef.current.add(notification.id));
    setNotifications([]);
    setPopupNotifications((prev) => prev.filter((notification) => !persistentIds.has(notification.id)));
    persistentIds.forEach((id) => clearPopupTimeout(id));

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
    dismissPopupNotification(id);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider 
      value={{ 
        notifications, 
        popupNotifications,
        unreadCount, 
        browserPermission,
        addNotification, 
        requestBrowserPermission,
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
