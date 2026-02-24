// src/services/websocket.ts
// Notifications WebSocket service - now using centralized manager

import centralizedWebSocketManager, { WebSocketEndpoint } from './centralizedWebSocketManager';
import {
  WsEnvelope,
  Notification,
  BackendError,
} from '../contracts/generated/api.types';

interface WebSocketEvent {
  type: string;
  data?: any;
}

// Emitted events after routing through wsRouter
type EmittedEvent =
  | { type: 'connected' }
  | { type: 'disconnected'; data?: { code?: number; reason?: string } }
  | { type: 'reconnecting'; data: { attempt: number; delay: number } }
  | { type: 'reconnect_failed'; data: { attempts: number } }
  | { type: 'auth_error'; data: { code: number; reason: string } }
  | { type: 'error'; data: BackendError }
  | { type: 'new_notification'; data: Notification }
  | { type: 'unread_notifications'; data: { count: number; notifications: Notification[] } }
  | { type: 'notification_updated'; data: { notification_id: string } };

type EventCallback = (event: EmittedEvent) => void;

class WebSocketService {
  private endpoint: WebSocketEndpoint = 'notifications';
  private subscribers: Set<EventCallback> = new Set();
  private unreadCount = 0;
  private notifications: any[] = [];
  public static readonly GLOBAL_KEY = '__sentinel_notifications_websocket_service__';
  private static instance: WebSocketService | null = null;

  constructor() {
    // HMR-proof singleton pattern - check global window first
    if (typeof window !== 'undefined') {
      const existingInstance = (window as any)[WebSocketService.GLOBAL_KEY];
      if (existingInstance) {
        console.log('♻️ Reusing existing Notifications WebSocketService from global window');
        return existingInstance;
      }
    }
    
    // Check static instance as fallback
    if (WebSocketService.instance) {
      console.log('♻️ Reusing existing Notifications WebSocketService static instance');
      return WebSocketService.instance;
    }
    
    console.log('🆕 Creating new Notifications WebSocketService instance');
    
    // Set static instance
    WebSocketService.instance = this;
    
    // Store in global window for HMR survival
    if (typeof window !== 'undefined') {
      (window as any)[WebSocketService.GLOBAL_KEY] = this;
    }
    
    // Set up event handlers from centralized manager
    this.setupCentralizedHandlers();
  }

  private setupCentralizedHandlers() {
    centralizedWebSocketManager.subscribe(this.endpoint, (event) => {
      this.handleCentralizedEvent(event);
    });
  }

  private handleCentralizedEvent(event: any) {
    switch (event.type) {
      case 'connected':
        console.log('✅ Notifications WebSocket connected via centralized manager');
        this.notifySubscribers({ type: 'connected' });
        break;

      case 'disconnected':
        console.log('🔌 Notifications WebSocket disconnected via centralized manager');
        this.notifySubscribers({ 
          type: 'disconnected',
          data: { code: event.data?.code, reason: event.data?.reason }
        });
        break;

      case 'auth_error':
        console.error('🚫 Notifications WebSocket authentication failed');
        this.notifySubscribers({ 
          type: 'auth_error', 
          data: { code: event.data?.code, reason: event.data?.reason } 
        });
        break;

      case 'error':
        console.error('❌ Notifications WebSocket error:', event.data);
        this.notifySubscribers({ type: 'error', data: event.data });
        break;

      case 'unread_notifications':
        this.unreadCount = event.data?.count || 0;
        this.notifications = event.data?.notifications || [];
        this.notifySubscribers({
          type: 'unread_notifications',
          data: { count: this.unreadCount, notifications: this.notifications },
        });
        break;

      case 'notification_updated':
        // Find and update notification in cache
        const idx = this.notifications.findIndex(
          (n: any) => n.id === event.data?.notification_id
        );
        if (idx >= 0) {
          this.notifications[idx].is_read = true;
        }
        this.notifySubscribers({
          type: 'notification_updated',
          data: { notification_id: event.data?.notification_id },
        });
        break;

      case 'new_notification':
        this.notifications = [event.data, ...this.notifications];
        this.unreadCount++;
        this.notifySubscribers({
          type: 'new_notification',
          data: event.data
        });
        break;

      case 'pong':
        // Heartbeat response - no action needed
        break;

      default:
        console.log('📨 Unhandled notification event:', event);
        break;
    }
  }

  /**
   * Connect to WebSocket (now uses centralized manager)
   */
  async connect(): Promise<void> {
    try {
      await centralizedWebSocketManager.connect(this.endpoint);
    } catch (error) {
      console.error('Failed to connect notifications WebSocket:', error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket (now uses centralized manager)
   */
  disconnect(): void {
    centralizedWebSocketManager.disconnect(this.endpoint);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return centralizedWebSocketManager.isConnected(this.endpoint);
  }

  /**
   * Get current connection state
   */
  getState(): string {
    return centralizedWebSocketManager.getConnectionState(this.endpoint);
  }

  /**
   * Send message to WebSocket
   */
  send(message: WebSocketEvent): void {
    centralizedWebSocketManager.send(this.endpoint, message);
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Get unread notification count
   */
  getUnreadCount(): number {
    return this.unreadCount;
  }

  /**
   * Get cached notifications
   */
  getNotifications(): any[] {
    return this.notifications;
  }

  /**
   * Request unread notifications
   */
  getUnreadNotifications(limit: number = 10): void {
    this.send({
      type: 'get_unread',
      data: { limit },
    });
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    this.send({
      type: 'mark_read',
      data: { notification_id: notificationId },
    });
  }

  private notifySubscribers(event: EmittedEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
        // Prevent Event objects from propagating
        if (error instanceof Event) {
          console.error('❌ Event object thrown in notification subscriber, converting to error:', error);
          // Convert Event to proper BackendError
          const errorObj: BackendError = {
            code: 'SUBSCRIBER_ERROR',
            message: 'Error in notification event subscriber',
            context: { originalEvent: error }
          };
          try {
            callback({ type: 'error', data: errorObj });
          } catch (retryError) {
            console.error('❌ Failed to notify notification subscriber of error:', retryError);
          }
        }
      }
    });
  }
}

// Export singleton instance with HMR protection
let wsService: WebSocketService;

if (typeof window !== 'undefined') {
  // Try to get existing instance from global window
  const existingInstance = (window as any)[WebSocketService.GLOBAL_KEY];
  if (existingInstance) {
    wsService = existingInstance;
    console.log('♻️ Exporting existing Notifications WebSocketService from global window');
  } else {
    wsService = new WebSocketService();
    console.log('🆕 Creating and exporting new Notifications WebSocketService instance');
  }
} else {
  // Fallback for non-browser environments
  wsService = new WebSocketService();
}

export { wsService };
export default wsService;
