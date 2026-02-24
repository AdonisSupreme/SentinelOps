// src/services/websocketService.ts
// Checklist WebSocket service - now using centralized manager

import centralizedWebSocketManager, { WebSocketEndpoint } from './centralizedWebSocketManager';

export interface ChecklistUpdateEvent {
  type: 'CHECKLIST_UPDATE' | 'ITEM_UPDATED' | 'SUBITEM_UPDATED' | 'INSTANCE_JOINED' | 'INSTANCE_CREATED';
  data: {
    instance_id: string;
    user_id?: string;
    item_id?: string;
    subitem_id?: string;
    status?: string;
    timestamp?: string;
    [key: string]: any;
  };
  timestamp: string;
}

class WebSocketService {
  private endpoint: WebSocketEndpoint = 'checklists';
  private subscriptions: Set<string> = new Set();
  private currentInstanceId: string | null = null;
  public static readonly GLOBAL_KEY = '__sentinel_websocket_service__';
  private static instance: WebSocketService | null = null;

  // Event callbacks
  private onChecklistUpdate?: (event: ChecklistUpdateEvent) => void;
  private onConnectionChange?: (connected: boolean) => void;
  private onError?: (error: string) => void;

  constructor() {
    // HMR-proof singleton pattern - check global window first
    if (typeof window !== 'undefined') {
      const existingInstance = (window as any)[WebSocketService.GLOBAL_KEY];
      if (existingInstance) {
        console.log('♻️ Reusing existing WebSocketService from global window');
        return existingInstance;
      }
    }
    
    // Check static instance as fallback
    if (WebSocketService.instance) {
      console.log('♻️ Reusing existing WebSocketService static instance');
      return WebSocketService.instance;
    }
    
    console.log('🆕 Creating new WebSocketService instance');
    
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
        console.log('✅ Checklist WebSocket connected via centralized manager');
        this.onConnectionChange?.(true);
        // On reconnect, re-subscribe to any instances we were tracking.
        this.resubscribeInstances();
        break;

      case 'disconnected':
        console.log('🔌 Checklist WebSocket disconnected via centralized manager');
        this.onConnectionChange?.(false);
        break;

      case 'auth_error':
        console.error('🚫 Checklist WebSocket authentication failed');
        this.onError?.('Authentication failed. Please log in again.');
        break;

      case 'error':
        console.error('❌ Checklist WebSocket error:', event.data);
        this.onError?.('Connection error occurred');
        break;

      case 'CHECKLIST_UPDATE':
      case 'ITEM_UPDATED':
      case 'SUBITEM_UPDATED':
      case 'INSTANCE_JOINED':
      case 'INSTANCE_CREATED':
        console.log('📋 Checklist update received:', event);
        this.onChecklistUpdate?.(event as ChecklistUpdateEvent);
        break;

      case 'CONNECTION_ESTABLISHED':
        // Handshake/welcome message from backend. Not an actionable checklist event.
        console.log('🔗 Checklist WS handshake established:', event.data);
        break;

      case 'SUBSCRIBED':
        // Ack from backend after SUBSCRIBE_INSTANCE.
        console.log('✅ Subscribed to instance via WS:', event.instance_id || event.data?.instance_id);
        break;

      default:
        console.log('📨 Unhandled checklist event:', event);
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
      console.error('Failed to connect checklist WebSocket:', error);
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
   * Get connection state
   */
  getConnectionState(): string {
    return centralizedWebSocketManager.getConnectionState(this.endpoint);
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(message: any): void {
    centralizedWebSocketManager.send(this.endpoint, message);
  }

  /**
   * Subscribe to checklist instance updates
   */
  subscribeToInstance(instanceId: string): void {
    console.log('🔔 Subscribing to checklist instance:', instanceId);
    this.subscriptions.add(instanceId);
    
    if (this.isConnected()) {
      this.sendMessage({
        type: 'SUBSCRIBE_INSTANCE',
        instance_id: instanceId
      });
    }
  }

  /**
   * Force subscribe to instance (used when checklist loads)
   */
  forceSubscribeToInstance(instanceId: string): void {
    console.log('🔥 Force subscribing to checklist instance:', instanceId);
    this.currentInstanceId = instanceId;
    this.subscribeToInstance(instanceId);
    
    // If not connected, the centralized manager will auto-connect
    if (!this.isConnected()) {
      console.log('🔄 Not connected, centralized manager will auto-connect');
    }
  }

  /**
   * Unsubscribe from checklist instance updates
   */
  unsubscribeFromInstance(instanceId: string): void {
    console.log('🔕 Unsubscribing from checklist instance:', instanceId);
    this.subscriptions.delete(instanceId);
    
    if (this.isConnected()) {
      this.sendMessage({
        type: 'UNSUBSCRIBE_INSTANCE',
        instance_id: instanceId
      });
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    centralizedWebSocketManager.setAuthToken(token);
  }

  /**
   * Refresh authentication token
   */
  refreshAuthToken(): void {
    // Centralized manager handles token refresh automatically
    console.log('🔄 Token refreshed in centralized manager');
  }

  /**
   * Set up event callbacks
   */
  onChecklistUpdateCallback(callback: (event: ChecklistUpdateEvent) => void): void {
    this.onChecklistUpdate = callback;
  }

  onConnectionChangeCallback(callback: (connected: boolean) => void): void {
    this.onConnectionChange = callback;
  }

  onErrorCallback(callback: (error: string) => void): void {
    this.onError = callback;
  }

  /**
   * Resubscribe to all instances (called after reconnection)
   */
  private resubscribeInstances(): void {
    console.log('🔄 Resubscribing to checklist instances:', Array.from(this.subscriptions));
    this.subscriptions.forEach(instanceId => {
      this.subscribeToInstance(instanceId);
    });
  }

  /**
   * Get current subscriptions
   */
  getSubscriptions(): Set<string> {
    return new Set(this.subscriptions);
  }

  /**
   * Get current instance ID
   */
  getCurrentInstanceId(): string | null {
    return this.currentInstanceId;
  }
}

// Export singleton instance with HMR protection
let websocketService: WebSocketService;

if (typeof window !== 'undefined') {
  // Try to get existing instance from global window first
  const existingInstance = (window as any)[WebSocketService.GLOBAL_KEY];
  if (existingInstance) {
    websocketService = existingInstance;
    console.log('♻️ Exporting existing WebSocketService instance from global window');
  } else {
    // Create new instance which will set up the singleton pattern
    websocketService = new WebSocketService();
    console.log('🆕 Creating and exporting new WebSocketService instance');
  }
} else {
  // Fallback for non-browser environments
  websocketService = new WebSocketService();
}

export default websocketService;
