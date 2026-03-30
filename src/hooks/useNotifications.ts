// src/hooks/useNotifications.ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { wsService } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';
import { checklistApi } from '../services/checklistApi';

interface UseNotificationsReturn {
  unreadCount: number;
  notifications: any[];
  isConnected: boolean;
  error: string | null;
  connectionState: string;
  getUnread: (limit?: number) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => Promise<void>;
}

/**
 * React hook for WebSocket notifications integration
 * Auto-connects on mount, handles reconnection, provides unread count and notification list
 */
const useNotifications = (): UseNotificationsReturn => {
  const { token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState('CLOSED');
  const hiddenNotificationIdsRef = useRef<Set<string>>(new Set());

  const normalizeUnreadNotifications = useCallback((items: any[] = []) => {
    const seen = new Set<string>();

    return items.filter((item) => {
      const id = item?.id;
      if (!id || seen.has(id) || hiddenNotificationIdsRef.current.has(id)) {
        return false;
      }
      if (item.is_read) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }, []);

  const applyUnreadNotifications = useCallback((items: any[] = []) => {
    const unreadItems = normalizeUnreadNotifications(items);
    setNotifications(unreadItems);
    setUnreadCount(unreadItems.length);
  }, [normalizeUnreadNotifications]);

  const refreshUnreadFromApi = useCallback(async () => {
    try {
      const unreadItems = await checklistApi.getNotifications(true);
      applyUnreadNotifications(unreadItems);
    } catch (err) {
      console.error('Failed to refresh unread notifications from API:', err);
    }
  }, [applyUnreadNotifications]);

  // Auto-connect when token is available
  useEffect(() => {
    if (!token) {
      wsService.disconnect();
      hiddenNotificationIdsRef.current.clear();
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    const connect = async () => {
      try {
        setError(null);
        await wsService.connect();
        void refreshUnreadFromApi();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Connection failed';
        setError(message);
        console.error('WebSocket connection error:', err);
      }
    };

    connect();

    return () => {
      // Don't disconnect on unmount - keep connection alive across components
      // User should explicitly call wsService.disconnect() on logout
    };
  }, [token, refreshUnreadFromApi]);

  // Subscribe to WebSocket events
  useEffect(() => {
    setIsConnected(wsService.isConnected());
    setConnectionState(wsService.getState());
    applyUnreadNotifications(wsService.getNotifications());

    if (wsService.isConnected()) {
      wsService.getUnreadNotifications(20);
    }

    const unsubscribe = wsService.subscribe((event) => {
      switch (event.type) {
        case 'connected':
          setIsConnected(true);
          setConnectionState('OPEN');
          setError(null);
          // Request initial unread notifications
          wsService.getUnreadNotifications(20);
          void refreshUnreadFromApi();
          break;

        case 'reconnecting':
          setIsConnected(false);
          setConnectionState('CONNECTING');
          setError(`Reconnecting... (attempt ${event.data?.attempt})`);
          break;

        case 'reconnect_failed':
          setIsConnected(false);
          setConnectionState('CLOSED');
          setError('Reconnection failed - please refresh the page');
          break;

        case 'auth_error':
          setIsConnected(false);
          setConnectionState('CLOSED');
          setError('Authentication failed - please log in again');
          break;

        case 'unread_notifications':
          applyUnreadNotifications(event.data?.notifications || []);
          break;

        case 'new_notification':
          setNotifications((prev) => {
            const incoming = event.data;
            if (!incoming?.id || incoming.is_read || hiddenNotificationIdsRef.current.has(incoming.id)) {
              return prev;
            }
            if (prev.some((notification) => notification.id === incoming.id)) {
              return prev;
            }
            const next = [incoming, ...prev];
            setUnreadCount(next.length);
            return next;
          });
          break;

        case 'notification_updated':
          if (event.data?.notification_id) {
            hiddenNotificationIdsRef.current.add(event.data.notification_id);
          }
          setNotifications((prev) => {
            const next = prev.filter((n) => n.id !== event.data?.notification_id);
            setUnreadCount(next.length);
            return next;
          });
          break;

        case 'error':
          console.error('WebSocket error:', event.data?.message);
          setError('Connection error');
          break;
      }
    });

    return () => unsubscribe();
  }, [applyUnreadNotifications, refreshUnreadFromApi]);

  const getUnread = useCallback((limit: number = 10) => {
    wsService.getUnreadNotifications(limit);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    hiddenNotificationIdsRef.current.add(notificationId);
    setNotifications((prev) => {
      const next = prev.filter((notification) => notification.id !== notificationId);
      setUnreadCount(next.length);
      return next;
    });
    wsService.markAsRead(notificationId);

    void checklistApi.markNotificationAsRead(notificationId).catch((err) => {
      console.error('Failed to persist notification as read:', err);
      hiddenNotificationIdsRef.current.delete(notificationId);
      void refreshUnreadFromApi();
      wsService.getUnreadNotifications(20);
    });
  }, [refreshUnreadFromApi]);

  const markAllAsRead = useCallback(async () => {
    notifications.forEach((notification) => {
      if (notification?.id) {
        hiddenNotificationIdsRef.current.add(notification.id);
      }
    });
    setNotifications([]);
    setUnreadCount(0);
    try {
      await checklistApi.markAllNotificationsAsRead();
      wsService.getUnreadNotifications(20);
      void refreshUnreadFromApi();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      hiddenNotificationIdsRef.current.clear();
      void refreshUnreadFromApi();
      wsService.getUnreadNotifications(20);
    }
  }, [notifications, refreshUnreadFromApi]);

  return {
    unreadCount,
    notifications,
    isConnected,
    error,
    connectionState,
    getUnread,
    markAsRead,
    markAllAsRead,
  };
};

export default useNotifications;
