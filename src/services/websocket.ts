// src/services/websocket.ts
// Singleton WebSocket service for real-time notifications
// Backend: GET /api/v1/notifications/ws?token={JWT}

type ConnectionState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';
type EventCallback = (event: WebSocketEvent) => void;

interface WebSocketEvent {
  type: string;
  data?: any;
}

interface ReconnectConfig {
  maxAttempts: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string | null = null;
  private state: ConnectionState = 'CLOSED';
  private reconnectAttempts = 0;
  private reconnectConfig: ReconnectConfig = {
    maxAttempts: 5,
    initialDelay: 3000, // 3s
    maxDelay: 48000, // 48s
  };
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketEvent[] = [];
  private subscribers: Set<EventCallback> = new Set();
  private unreadCount = 0;
  private notifications: any[] = [];

  constructor() {
    this.url = this.buildUrl();
  }

  private buildUrl(): string {
    const baseUrl = process.env.REACT_APP_WS_BASE_URL || 'ws://localhost:8000';
    const endpoint = '/api/v1/notifications/ws';
    return `${baseUrl}${endpoint}`;
  }

  /**
   * Connect to WebSocket endpoint
   */
  async connect(): Promise<void> {
    if (this.state === 'OPEN' || this.state === 'CONNECTING') {
      console.log('WebSocket already connecting/connected');
      return;
    }

    // Get fresh token
    this.token = localStorage.getItem('token');
    if (!this.token) {
      throw new Error('No authentication token found');
    }

    this.setState('CONNECTING');

    try {
      const wsUrl = `${this.url}?token=${this.token}`;
      this.ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('WebSocket connection timeout'));
        }, 10000);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.setState('OPEN');
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.flushMessageQueue();
          console.log('WebSocket connected');
          this.emit({ type: 'connected' });
          resolve();
        };

        this.ws!.onmessage = (event) => this.handleMessage(event);
        this.ws!.onerror = (event) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', event);
          this.emit({ type: 'error', data: { message: 'Connection error' } });
          reject(new Error('WebSocket connection failed'));
        };
        this.ws!.onclose = (event) => {
          clearTimeout(timeout);
          this.handleClose(event);
        };
      });
    } catch (error) {
      this.setState('CLOSED');
      this.handleConnectionError(error);
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.ws && this.state !== 'CLOSED') {
      this.setState('CLOSING');
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.setState('CLOSED');
    console.log('WebSocket disconnected');
  }

  /**
   * Send message to server
   */
  send(message: WebSocketEvent): void {
    if (!this.ws || this.state !== 'OPEN') {
      console.warn('WebSocket not connected, queueing message:', message);
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
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

  // Private methods

  private setState(state: ConnectionState): void {
    this.state = state;
  }

  private emit(event: WebSocketEvent): void {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in subscriber:', error);
      }
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log('WebSocket message:', message.type);

      switch (message.type) {
        case 'pong':
          // Heartbeat response - no action needed
          break;

        case 'unread_notifications':
          this.unreadCount = message.count || 0;
          this.notifications = message.notifications || [];
          this.emit({
            type: 'unread_notifications',
            data: message,
          });
          break;

        case 'new_notification':
          this.notifications.unshift(message.notification);
          this.unreadCount = (this.unreadCount || 0) + 1;
          this.emit({
            type: 'new_notification',
            data: message.notification,
          });
          break;

        case 'notification_updated':
          // Find and update notification in cache
          const idx = this.notifications.findIndex(
            (n: any) => n.id === message.notification_id
          );
          if (idx >= 0) {
            this.notifications[idx].is_read = true;
          }
          this.emit({
            type: 'notification_updated',
            data: message,
          });
          break;

        case 'error':
          console.error('Server error:', message.message);
          this.emit({
            type: 'server_error',
            data: message,
          });
          break;

        default:
          // Pass through other message types
          this.emit(message);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    this.setState('CLOSED');
    this.stopHeartbeat();

    // Check for auth errors
    if (event.code === 4000 || event.code === 4001) {
      console.error('Authentication error, not reconnecting');
      this.emit({
        type: 'auth_error',
        data: { code: event.code, reason: event.reason },
      });
      return;
    }

    // Attempt reconnection with exponential backoff
    if (this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectConfig.initialDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.reconnectConfig.maxDelay
      );

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.reconnectConfig.maxAttempts})`);
      this.emit({
        type: 'reconnecting',
        data: { attempt: this.reconnectAttempts, delay },
      });

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit({
        type: 'reconnect_failed',
        data: { attempts: this.reconnectAttempts },
      });
    }
  }

  private handleConnectionError(error: any): void {
    if (this.reconnectAttempts < this.reconnectConfig.maxAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(
        this.reconnectConfig.initialDelay * Math.pow(2, this.reconnectAttempts - 1),
        this.reconnectConfig.maxDelay
      );

      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.reconnectConfig.maxAttempts})`);
      this.emit({
        type: 'reconnecting',
        data: { attempt: this.reconnectAttempts, delay },
      });

      setTimeout(() => {
        this.connect().catch((error) => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService();

export default wsService;
