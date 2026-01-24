// src/websocket/wsRouter.ts
// WebSocket message router for handling incoming messages

import { WsEnvelope, Notification, BackendError } from '../contracts/generated/api.types';

export interface WebSocketMessage {
  type?: string;
  data?: any;
  [key: string]: any;
}

export interface WsRouter {
  route(message: any): boolean;
}

class WebSocketRouter implements WsRouter {
  // Expose emit method globally for service communication
  constructor() {
    if (typeof window !== 'undefined') {
      const emit = (window as any).__wsServiceEmit;
      if (emit) {
        this.emit = emit;
      }
    }
  }

  private emit(event: any): void {
    // This will be replaced with the actual service emit method
    console.warn('WebSocket emit not properly initialized');
  }

  route(message: any): boolean {
    try {
      // Handle WsEnvelope messages
      if (this.isWsEnvelope(message)) {
        return this.handleEnvelope(message);
      }

      // Handle legacy messages (for backward compatibility)
      if (this.isLegacyMessage(message)) {
        return this.handleLegacyMessage(message);
      }

      console.warn('Unknown message format:', message);
      return false;
    } catch (error) {
      console.error('Error routing message:', error);
      return false;
    }
  }

  private isWsEnvelope(message: any): message is WsEnvelope {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message &&
      'payload' in message &&
      'version' in message
    );
  }

  private isLegacyMessage(message: any): boolean {
    return (
      typeof message === 'object' &&
      message !== null &&
      'type' in message
    );
  }

  private handleEnvelope(envelope: WsEnvelope): boolean {
    const { type, payload } = envelope;

    switch (type) {
      case 'notification':
        return this.handleNotification(payload as Notification);

      case 'unread_count':
        return this.handleUnreadCount(payload as { count: number; notifications: Notification[] });

      case 'notification_updated':
        return this.handleNotificationUpdated(payload as { notification_id: string });

      case 'error':
        return this.handleError(payload as BackendError);

      case 'pong':
        // Heartbeat response
        return true;

      default:
        console.warn('Unknown envelope type:', type);
        return false;
    }
  }

  private handleLegacyMessage(message: any): boolean {
    const { type, data } = message;

    switch (type) {
      case 'new_notification':
        return this.handleNotification(data as Notification);

      case 'unread_notifications':
        return this.handleUnreadCount(data as { count: number; notifications: Notification[] });

      case 'notification_updated':
        return this.handleNotificationUpdated(data as { notification_id: string });

      case 'pong':
        // Heartbeat response
        return true;

      default:
        console.warn('Unknown legacy message type:', type);
        return false;
    }
  }

  private handleNotification(notification: Notification): boolean {
    this.emit({
      type: 'new_notification',
      data: notification
    });
    return true;
  }

  private handleUnreadCount(data: { count: number; notifications: Notification[] }): boolean {
    this.emit({
      type: 'unread_notifications',
      data
    });
    return true;
  }

  private handleNotificationUpdated(data: { notification_id: string }): boolean {
    this.emit({
      type: 'notification_updated',
      data
    });
    return true;
  }

  private handleError(error: BackendError): boolean {
    this.emit({
      type: 'error',
      data: error
    });
    return true;
  }
}

// Export singleton instance
export const wsRouter = new WebSocketRouter();

// Export the class for type checking
export { WebSocketRouter };

export default wsRouter;
