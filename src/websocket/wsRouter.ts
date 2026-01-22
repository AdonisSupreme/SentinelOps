// src/websocket/wsRouter.ts
// Centralized, strict WebSocket envelope parsing and routing

import {
  WsEnvelope,
  WsNewNotificationPayload,
  WsErrorPayload,
  Notification,
  BackendError,
} from '../contracts/generated/api.types';

type WsHandler = (payload: unknown, meta?: Record<string, any>) => void;

// Forward-declare wsService emit (avoid circular import)
declare const __wsServiceEmit: (event: any) => void;

class WsRouter {
  private handlers = new Map<string, WsHandler>();
  private readonly SUPPORTED_VERSION = 1;

  constructor() {
    this.registerDefaultHandlers();
  }

  private registerDefaultHandlers() {
    this.addHandler('NEW_NOTIFICATION', this.handleNewNotification);
    this.addHandler('ERROR', this.handleError);
    // Future: add more handlers here
  }

  public addHandler(type: string, handler: WsHandler) {
    this.handlers.set(type, handler);
  }

  public removeHandler(type: string) {
    this.handlers.delete(type);
  }

  /**
   * Parse and route a WebSocket message.
   * Returns false if the message should be ignored.
   */
  public route(raw: unknown): boolean {
    // Basic type guard
    if (typeof raw !== 'object' || raw === null) {
      console.warn('WS: Ignoring non-object message', raw);
      return false;
    }

    const envelope = raw as Partial<WsEnvelope>;

    // Version check
    if (envelope.version !== this.SUPPORTED_VERSION) {
      console.error(`WS: Unsupported envelope version: ${envelope.version}`);
      return false;
    }

    // Type check
    if (!envelope.type || typeof envelope.type !== 'string') {
      console.warn('WS: Missing or invalid message type', envelope);
      return false;
    }

    const handler = this.handlers.get(envelope.type);
    if (!handler) {
      console.warn(`WS: Unknown message type: ${envelope.type}`);
      return false;
    }

    try {
      handler(envelope.payload, envelope.meta);
      return true;
    } catch (err) {
      console.error(`WS: Handler error for type ${envelope.type}:`, err);
      return false;
    }
  }

  private handleNewNotification = (payload: unknown, meta?: Record<string, any>) => {
    // Minimal runtime validation; rely on generated types elsewhere
    const notification = payload as WsNewNotificationPayload['notification'];
    if (!notification || typeof notification !== 'object') {
      console.warn('WS: Invalid NEW_NOTIFICATION payload', payload);
      return;
    }
    // Emit to subscribers (handled by wsService)
    if (typeof window !== 'undefined' && (window as any).__wsServiceEmit) {
      (window as any).__wsServiceEmit({ type: 'new_notification', data: notification });
    }
  };

  private handleError = (payload: unknown, meta?: Record<string, any>) => {
    const error = payload as WsErrorPayload;
    if (!error || typeof error !== 'object' || !error.code || !error.message) {
      console.warn('WS: Invalid ERROR payload', payload);
      return;
    }
    console.error('WS: Backend error', error);
    // Surface to error boundary or global error handler
    if (typeof window !== 'undefined' && (window as any).__wsServiceEmit) {
      (window as any).__wsServiceEmit({ type: 'error', data: error });
    }
  };
}

export const wsRouter = new WsRouter();
