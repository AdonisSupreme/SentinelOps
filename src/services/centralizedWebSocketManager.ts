// src/services/centralizedWebSocketManager.ts
// Centralized WebSocket manager that handles multiple endpoints with shared connection infrastructure

import { ChecklistUpdateEvent } from './websocketService';

type WebSocketEndpoint = 'checklists' | 'notifications';
type ConnectionState = 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED';

interface CentralizedEvent {
  endpoint: WebSocketEndpoint;
  type: string;
  data?: any;
  timestamp?: string;
}

interface EventCallback {
  endpoint: WebSocketEndpoint;
  callback: (event: any) => void;
}

class CentralizedWebSocketManager {
  private connections: Map<WebSocketEndpoint, WebSocket | null> = new Map();
  private connectionStates: Map<WebSocketEndpoint, ConnectionState> = new Map();
  private subscribers: Map<WebSocketEndpoint, Set<(event: any) => void>> = new Map();
  private reconnectTimers: Map<WebSocketEndpoint, NodeJS.Timeout | null> = new Map();
  private heartbeatTimers: Map<WebSocketEndpoint, NodeJS.Timeout | null> = new Map();
  private reconnectAttempts: Map<WebSocketEndpoint, number> = new Map();
  private authToken: string | null = null;
  private static instance: CentralizedWebSocketManager | null = null;
  public static readonly GLOBAL_KEY = '__sentinel_centralized_websocket_manager__';

  // Connection configuration
  private readonly MAX_RECONNECT_ATTEMPTS = 3;
  private readonly INITIAL_RECONNECT_DELAY = 2000;
  private readonly MAX_RECONNECT_DELAY = 10000;
  private readonly CONNECTION_TIMEOUT = 8000;
  private readonly HEARTBEAT_INTERVAL = 25000;

  constructor() {
    // HMR-proof singleton pattern - check global window first
    if (typeof window !== 'undefined') {
      const existingInstance = (window as any)[CentralizedWebSocketManager.GLOBAL_KEY];
      if (existingInstance) {
        console.log('♻️ Reusing existing CentralizedWebSocketManager from global window');
        return existingInstance;
      }
    }
    
    // Check static instance as fallback
    if (CentralizedWebSocketManager.instance) {
      console.log('♻️ Reusing existing CentralizedWebSocketManager static instance');
      return CentralizedWebSocketManager.instance;
    }
    
    console.log('🆕 Creating new CentralizedWebSocketManager instance');
    
    // Set static instance
    CentralizedWebSocketManager.instance = this;
    
    // Store in global window for HMR survival
    if (typeof window !== 'undefined') {
      (window as any)[CentralizedWebSocketManager.GLOBAL_KEY] = this;
    }
    
    // Initialize connection states and load auth token
    this.initializeConnectionStates();
    this.loadAuthToken();
    
    // Cleanup existing connections on HMR
    this.cleanupExistingConnections();
  }

  private cleanupExistingConnections() {
    console.log('🧹 Cleaning up existing WebSocket connections for HMR');
    const endpoints: WebSocketEndpoint[] = ['checklists', 'notifications'];
    endpoints.forEach(endpoint => {
      const existingWs = this.connections.get(endpoint);
      if (existingWs) {
        console.log(`🔌 Closing existing ${endpoint} connection for HMR cleanup`);
        existingWs.close();
        this.connections.set(endpoint, null);
      }
      
      const reconnectTimer = this.reconnectTimers.get(endpoint);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.reconnectTimers.set(endpoint, null);
      }
    });
  }

  private initializeConnectionStates() {
    const endpoints: WebSocketEndpoint[] = ['checklists', 'notifications'];
    endpoints.forEach(endpoint => {
      this.connections.set(endpoint, null);
      this.connectionStates.set(endpoint, 'CLOSED');
      this.subscribers.set(endpoint, new Set());
      this.reconnectTimers.set(endpoint, null);
      this.heartbeatTimers.set(endpoint, null);
      this.reconnectAttempts.set(endpoint, 0);
    });
  }

  private loadAuthToken() {
    try {
      this.authToken = localStorage.getItem('auth_token') || localStorage.getItem('token') || null;
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  setAuthToken(token: string) {
    this.authToken = token;
    try {
      localStorage.setItem('auth_token', token);
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  }

  /**
   * Connect to specific WebSocket endpoint
   */
  async connect(endpoint: WebSocketEndpoint): Promise<void> {
    if (!this.authToken) {
      throw new Error('No authentication token available');
    }

    const currentState = this.connectionStates.get(endpoint);
    if (currentState === 'OPEN' || currentState === 'CONNECTING') {
      console.log(`🔌 ${endpoint} WebSocket already connecting/connected`);
      return;
    }

    // Close existing connection if any
    const existingWs = this.connections.get(endpoint);
    if (existingWs) {
      existingWs.close();
      this.connections.set(endpoint, null);
    }

    this.connectionStates.set(endpoint, 'CONNECTING');

    const wsUrl = this.buildWebSocketUrl(endpoint);
    console.log(`🔌 Connecting to ${endpoint} WebSocket:`, wsUrl);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.connectionStates.set(endpoint, 'CLOSED');
        reject(new Error(`${endpoint} WebSocket connection timeout`));
      }, this.CONNECTION_TIMEOUT);

      const ws = new WebSocket(wsUrl);
      this.connections.set(endpoint, ws);

      ws.onopen = () => {
        clearTimeout(timeout);
        this.connectionStates.set(endpoint, 'OPEN');
        this.reconnectAttempts.set(endpoint, 0);
        this.startHeartbeat(endpoint);
        console.log(`✅ ${endpoint} WebSocket connected`);
        
        // Notify subscribers
        this.notifySubscribers(endpoint, { type: 'connected' });
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(endpoint, data);
        } catch (error) {
          console.error(`❌ Error parsing ${endpoint} message:`, error);
          // Create proper error object
          const errorObj = {
            type: 'MessageParseError',
            message: `Failed to parse ${endpoint} message`,
            originalError: error,
            rawData: event.data
          };
          this.notifySubscribers(endpoint, { type: 'error', data: errorObj });
        }
      };

      ws.onclose = (event) => {
        clearTimeout(timeout);
        this.handleClose(endpoint, event);
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error(`❌ ${endpoint} WebSocket error:`, error);
        this.connectionStates.set(endpoint, 'CLOSED');
        
        // Create proper error object instead of passing Event
        const errorObj = {
          type: 'WebSocketError',
          message: `${endpoint} WebSocket connection failed`,
          originalError: error
        };
        
        // Notify subscribers
        this.notifySubscribers(endpoint, { type: 'error', data: errorObj });
        reject(new Error(`${endpoint} WebSocket connection failed`));
      };
    });
  }

  /**
   * Disconnect from specific endpoint
   */
  disconnect(endpoint: WebSocketEndpoint) {
    const reconnectTimer = this.reconnectTimers.get(endpoint);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.reconnectTimers.set(endpoint, null);
    }

    this.stopHeartbeat(endpoint);
    this.reconnectAttempts.set(endpoint, 0);

    const ws = this.connections.get(endpoint);
    if (ws && this.connectionStates.get(endpoint) !== 'CLOSED') {
      this.connectionStates.set(endpoint, 'CLOSING');
      ws.close(1000, 'Normal closure');
      this.connections.set(endpoint, null);
    }

    this.connectionStates.set(endpoint, 'CLOSED');
    console.log(`🔌 ${endpoint} WebSocket disconnected`);
  }

  /**
   * Disconnect from all endpoints
   */
  disconnectAll() {
    const endpoints: WebSocketEndpoint[] = ['checklists', 'notifications'];
    endpoints.forEach(endpoint => this.disconnect(endpoint));
  }

  /**
   * Subscribe to events from specific endpoint
   */
  subscribe(endpoint: WebSocketEndpoint, callback: (event: any) => void): () => void {
    const subscribers = this.subscribers.get(endpoint)!;
    subscribers.add(callback);

    // Auto-connect if not connected
    if (this.connectionStates.get(endpoint) === 'CLOSED') {
      this.connect(endpoint).catch(error => {
        console.error(`Failed to auto-connect ${endpoint}:`, error);
      });
    }

    // Return unsubscribe function
    return () => {
      subscribers.delete(callback);
    };
  }

  /**
   * Send message to specific endpoint
   */
  send(endpoint: WebSocketEndpoint, message: any) {
    const ws = this.connections.get(endpoint);
    const state = this.connectionStates.get(endpoint);

    if (!ws || state !== 'OPEN') {
      console.warn(`⚠️ ${endpoint} WebSocket not connected, cannot send message:`, message);
      return;
    }

    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`❌ Error sending message to ${endpoint}:`, error);
    }
  }

  /**
   * Check if specific endpoint is connected
   */
  isConnected(endpoint: WebSocketEndpoint): boolean {
    return this.connectionStates.get(endpoint) === 'OPEN';
  }

  /**
   * Get connection state for specific endpoint
   */
  getConnectionState(endpoint: WebSocketEndpoint): string {
    return this.connectionStates.get(endpoint) || 'CLOSED';
  }

  /**
   * Get connection states for all endpoints
   */
  getAllConnectionStates(): Record<WebSocketEndpoint, string> {
    return {
      checklists: this.connectionStates.get('checklists') || 'CLOSED',
      notifications: this.connectionStates.get('notifications') || 'CLOSED'
    };
  }

  private buildWebSocketUrl(endpoint: WebSocketEndpoint): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let baseUrl: string;

    if (window.location.hostname === 'localhost' && window.location.port === '3000') {
      // Development: React dev server on 3000, backend on 8000
      baseUrl = `${protocol}//localhost:8000`;
    } else {
      // Production: same host as the frontend
      baseUrl = `${protocol}//${window.location.host}`;
    }

    const endpointPaths = {
      checklists: '/api/v1/checklists/ws',
      notifications: '/api/v1/notifications/ws'
    };

    const wsUrl = `${baseUrl}${endpointPaths[endpoint]}?token=${encodeURIComponent(this.authToken!)}`;
    return wsUrl;
  }

  private handleMessage(endpoint: WebSocketEndpoint, data: any) {
    const normalizedData = this.normalizeMessage(endpoint, data);
    console.log(`📨 ${endpoint} message received:`, data);

    // Route message to appropriate subscribers
    if (endpoint === 'checklists') {
      // Handle checklist-specific events
      this.handleChecklistMessage(normalizedData);
    } else if (endpoint === 'notifications') {
      // Handle notification-specific events
      this.handleNotificationMessage(normalizedData);
    }

    // Notify general subscribers
    this.notifySubscribers(endpoint, normalizedData);
  }

  private handleChecklistMessage(data: any) {
    // Handle checklist-specific message routing
    if (data.type === 'CONNECTION_ESTABLISHED') {
      console.log('🔗 Checklist connection established');
    } else if (data.type === 'CHECKLIST_UPDATE') {
      console.log('📋 Checklist update received');
    }
  }

  private handleNotificationMessage(data: any) {
    // Handle notification-specific message routing
    if (data.type === 'unread_notifications') {
      console.log('🔔 Unread notifications received');
    } else if (data.type === 'new_notification') {
      console.log('📬 New notification received');
    }
  }

  private handleClose(endpoint: WebSocketEndpoint, event: CloseEvent) {
    const previousState = this.connectionStates.get(endpoint);
    this.connectionStates.set(endpoint, 'CLOSED');
    this.connections.set(endpoint, null);
    this.stopHeartbeat(endpoint);

    console.log(`🔌 ${endpoint} WebSocket disconnected:`, event.code, event.reason);

    // Notify subscribers
    this.notifySubscribers(endpoint, { 
      type: 'disconnected', 
      data: { code: event.code, reason: event.reason } 
    });

    // Handle authentication errors
    if (event.code === 1008) {
      console.error(`🚫 ${endpoint} authentication failed`);
      this.notifySubscribers(endpoint, { 
        type: 'auth_error', 
        data: { code: event.code, reason: event.reason } 
      });
      return;
    }

    // Attempt reconnection for abnormal closures
    if (event.code !== 1000 && previousState === 'OPEN') {
      this.scheduleReconnect(endpoint);
    }
  }

  private scheduleReconnect(endpoint: WebSocketEndpoint) {
    const attempts = this.getReconnectAttempts(endpoint);
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.notifySubscribers(endpoint, {
        type: 'reconnect_failed',
        data: { attempts }
      });
      return;
    }

    const timer = this.reconnectTimers.get(endpoint);
    if (timer) {
      clearTimeout(timer);
    }

    const nextAttempt = attempts + 1;
    this.reconnectAttempts.set(endpoint, nextAttempt);
    const delay = Math.min(
      this.INITIAL_RECONNECT_DELAY * Math.pow(2, nextAttempt - 1),
      this.MAX_RECONNECT_DELAY
    );

    console.log(`🔄 Scheduling ${endpoint} reconnect in ${delay}ms`);

    this.notifySubscribers(endpoint, {
      type: 'reconnecting',
      data: { attempt: nextAttempt, delay }
    });

    const newTimer = setTimeout(() => {
      this.connect(endpoint).catch(error => {
        console.error(`❌ ${endpoint} reconnect failed:`, error);
        this.scheduleReconnect(endpoint);
      });
    }, delay);

    this.reconnectTimers.set(endpoint, newTimer);
  }

  private getReconnectAttempts(endpoint: WebSocketEndpoint): number {
    return this.reconnectAttempts.get(endpoint) || 0;
  }

  private startHeartbeat(endpoint: WebSocketEndpoint) {
    this.stopHeartbeat(endpoint);

    const timer = setInterval(() => {
      if (!this.isConnected(endpoint)) {
        return;
      }

      this.send(endpoint, {
        type: endpoint === 'notifications' ? 'ping' : 'PING'
      });
    }, this.HEARTBEAT_INTERVAL);

    this.heartbeatTimers.set(endpoint, timer);
  }

  private stopHeartbeat(endpoint: WebSocketEndpoint) {
    const timer = this.heartbeatTimers.get(endpoint);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.set(endpoint, null);
    }
  }

  private normalizeMessage(endpoint: WebSocketEndpoint, raw: any) {
    if (!raw || typeof raw !== 'object') {
      return raw;
    }

    if (endpoint !== 'notifications' || !('payload' in raw)) {
      return raw;
    }

    const payload = raw.payload || {};
    switch (raw.type) {
      case 'unread_notifications':
        return { type: raw.type, data: payload };
      case 'new_notification':
        return { type: raw.type, data: payload.notification };
      case 'notification_updated':
        return { type: raw.type, data: payload };
      case 'error':
        return { type: raw.type, data: payload };
      case 'pong':
        return { type: raw.type, data: payload };
      default:
        return { ...raw, data: payload };
    }
  }

  private notifySubscribers(endpoint: WebSocketEndpoint, event: any) {
    const subscribers = this.subscribers.get(endpoint);
    if (subscribers) {
      subscribers.forEach(callback => {
        try {
          callback(event);
        } catch (error) {
          console.error(`❌ Error in ${endpoint} subscriber:`, error);
          // Prevent Event objects from propagating
          if (error instanceof Event) {
            console.error(`❌ Event object thrown in subscriber, converting to error:`, error);
            // Convert Event to proper error object
            const errorObj = {
              type: 'SubscriberError',
              message: `Error in ${endpoint} event subscriber`,
              code: 'SUBSCRIBER_EVENT_ERROR',
              originalEvent: error
            };
            try {
              callback({ type: 'error', data: errorObj });
            } catch (retryError) {
              console.error(`❌ Failed to notify subscriber of error:`, retryError);
            }
          }
        }
      });
    }
  }
}

// Export singleton instance with HMR protection
let centralizedWebSocketManager: CentralizedWebSocketManager;

if (typeof window !== 'undefined') {
  // Debug: Log existing instances
  console.log('🔍 Checking for existing CentralizedWebSocketManager instances...');
  console.log('🔍 Window keys:', Object.keys(window).filter(key => key.includes('websocket')));
  
  // Try to get existing instance from global window first
  const existingInstance = (window as any)[CentralizedWebSocketManager.GLOBAL_KEY];
  if (existingInstance) {
    centralizedWebSocketManager = existingInstance;
    console.log('♻️ Exporting existing CentralizedWebSocketManager from global window');
  } else {
    centralizedWebSocketManager = new CentralizedWebSocketManager();
    console.log('🆕 Creating and exporting new CentralizedWebSocketManager instance');
  }
} else {
  // Fallback for non-browser environments
  centralizedWebSocketManager = new CentralizedWebSocketManager();
}

export default centralizedWebSocketManager;

// Export types for use in components
export type { WebSocketEndpoint, CentralizedEvent, EventCallback };
