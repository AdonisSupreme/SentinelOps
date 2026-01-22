// src/hooks/useNotifications.ts
import { useEffect, useState, useCallback } from 'react';
import { wsService } from '../services/websocket';
import { useAuth } from '../contexts/AuthContext';

interface UseNotificationsReturn {
  unreadCount: number;
  notifications: any[];
  isConnected: boolean;
  error: string | null;
  connectionState: string;
  getUnread: (limit?: number) => void;
  markAsRead: (notificationId: string) => void;
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

  // Auto-connect when token is available
  useEffect(() => {
    if (!token) {
      wsService.disconnect();
      return;
    }

    const connect = async () => {
      try {
        setError(null);
        await wsService.connect();
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
  }, [token]);

  // Subscribe to WebSocket events
  useEffect(() => {
    const unsubscribe = wsService.subscribe((event) => {
      switch (event.type) {
        case 'connected':
          setIsConnected(true);
          setConnectionState('OPEN');
          setError(null);
          // Request initial unread notifications
          wsService.getUnreadNotifications(20);
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
          setUnreadCount(event.data?.count || 0);
          break;

        case 'new_notification':
          setNotifications((prev) => [event.data, ...prev]);
          setUnreadCount((prev) => prev + 1);
          break;

        case 'notification_updated':
          // Update notification read status in cache
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === event.data?.notification_id ? { ...n, is_read: true } : n
            )
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
          break;

        case 'error':
          console.error('WebSocket error:', event.data?.message);
          setError('Connection error');
          break;
      }
    });

    return () => unsubscribe();
  }, []);

  const getUnread = useCallback((limit: number = 10) => {
    wsService.getUnreadNotifications(limit);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    wsService.markAsRead(notificationId);
  }, []);

  return {
    unreadCount,
    notifications,
    isConnected,
    error,
    connectionState: wsService.getState(),
    getUnread,
    markAsRead,
  };
};

export default useNotifications;
