// src/contexts/checklistContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { checklistApi, ChecklistInstance, ChecklistItemInstance, ItemActivity } from '../services/checklistApi';
import { ChecklistInstanceSubitem } from '../contracts/generated/api.types';
import { useNotifications } from './NotificationContext';
import { useAuth } from './AuthContext';
import websocketService, { ChecklistUpdateEvent } from '../services/websocketService';

// Extended interface to include subitems that are returned by API but not in generated types
interface ExtendedChecklistItemInstance extends ChecklistItemInstance {
  subitems?: ChecklistInstanceSubitem[];
}

interface ChecklistContextType {
  currentInstance: ChecklistInstance | null;
  todayInstances: ChecklistInstance[];
  loading: boolean;
  error: string | null;
  
  // Actions
  loadTodayInstances: () => Promise<void>;
  loadInstance: (id: string) => Promise<void>;
  joinInstance: (instanceId: string) => Promise<void>;
  updateItemStatus: (
    instanceId: string,
    itemId: string,
    status: string,
    comment?: string,
    reason?: string
  ) => Promise<void>;
  updateSubitemStatus: (
    instanceId: string,
    itemId: string,
    subitemId: string,
    status: string,
    comment?: string,
    reason?: string
  ) => Promise<void>;
  completeInstance: (instanceId: string, withExceptions?: boolean) => Promise<void>;
  deleteInstance: (instanceId: string) => Promise<void>;
  createHandoverNote: (content: string, priority: number) => Promise<void>;
  refreshInstance: () => Promise<void>;
}

const ChecklistContext = createContext<ChecklistContextType | null>(null);

export const useChecklist = () => {
  const context = useContext(ChecklistContext);
  if (!context) {
    throw new Error('useChecklist must be used within a ChecklistProvider');
  }
  return context;
};

export const ChecklistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentInstance, setCurrentInstance] = useState<ChecklistInstance | null>(null);
  const [todayInstances, setTodayInstances] = useState<ChecklistInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addNotification } = useNotifications();
  const { user } = useAuth();

  // Register handlers once; keep the connection itself lazy.
  useEffect(() => {
    websocketService.onChecklistUpdateCallback(handleRealtimeUpdate);
    websocketService.onConnectionChangeCallback(handleConnectionChange);
    websocketService.onErrorCallback(handleWebSocketError);
  }, []);

  // Only open the checklist socket when an actual checklist is active.
  useEffect(() => {
    if (!currentInstance?.id) {
      websocketService.disconnect();
      return;
    }

    console.log('Subscribing to checklist instance:', currentInstance.id);
    websocketService.forceSubscribeToInstance(currentInstance.id);
    websocketService.connect().catch((error: any) => {
      console.error('Failed to connect to WebSocket:', error);
    });

    return () => {
      console.log('Unsubscribing from checklist instance:', currentInstance.id);
      websocketService.unsubscribeFromInstance(currentInstance.id);
      websocketService.disconnect();
    };
  }, [currentInstance?.id]);

  // Handle real-time updates from WebSocket
  const handleRealtimeUpdate = useCallback(async (event: ChecklistUpdateEvent) => {
    console.log('🔄 Real-time update received:', event);
    console.log('📋 Current instance ID:', currentInstance?.id);
    console.log('🎯 Event instance ID:', event.data.instance_id);
    
    // Only process updates for the current instance
    if (!currentInstance || event.data.instance_id !== currentInstance.id) {
      console.log('❌ Skipping update - not for current instance');
      return;
    }

    console.log('✅ Processing update for current instance');

    try {
      // Fetch the latest instance data from server
      const updatedInstance = await checklistApi.getInstance(currentInstance.id);
      console.log('📥 Fetched updated instance:', updatedInstance);
      
      // Update local state with server data
      console.log('🔄 Updating currentInstance state with:', updatedInstance);
      setCurrentInstance(updatedInstance);
      
      // Update today instances list if needed
      setTodayInstances(prev => {
        console.log('🔄 Updating todayInstances list');
        const index = prev.findIndex(instance => instance.id === updatedInstance.id);
        if (index !== -1) {
          const newInstances = [...prev];
          newInstances[index] = updatedInstance;
          console.log('🔄 Updated todayInstances at index', index, 'with new data');
          return newInstances;
        }
        return prev;
      });

      // Show notification for the update
      const updateType = event.type;
      let message = 'Checklist updated';
      
      switch (updateType) {
        case 'ITEM_UPDATED': {
          const updatedItem = updatedInstance.items?.find(i => i.id === event.data.item_id);
          const itemTitle = updatedItem?.title || updatedItem?.template_item?.title || 'Unknown item';
          const itemStatus = event.data.status || 'updated';
          message = `Item "${itemTitle}" ${itemStatus.toLowerCase()}`;
          break;
        }
          
        case 'SUBITEM_UPDATED': {
          const updatedItem = updatedInstance.items?.find(i => i.id === event.data.item_id);
          const itemTitle = updatedItem?.title || updatedItem?.template_item?.title || 'Unknown item';
          const subitem = updatedItem?.subitems?.find(s => s.id === event.data.subitem_id);
          const subitemTitle = subitem?.title || 'Unknown subitem';
          const subitemStatus = event.data.status || 'updated';
          message = `Subitem "${subitemTitle}" ${subitemStatus.toLowerCase()}`;
          break;
        }
          
        case 'INSTANCE_JOINED': {
          message = 'New participant joined';
          break;
        }
          
        case 'INSTANCE_CREATED': {
          message = 'New checklist created';
          break;
        }

        case 'PARTICIPANT_PRESENCE_CHANGED': {
          message = `Participant is now ${event.data.is_online ? 'online' : 'offline'}`;
          break;
        }
      }
      // Only show notification if the update wasn't made by the current user
      if (event.data.user_id !== user?.id) {
        console.log('🔔 Showing notification for other user:', message);
        addNotification({
          type: 'info',
          message,
          priority: 'low'
        });
      } else {
        console.log('🤫 Skipping notification - update from current user');
      }
      
    } catch (error) {
      console.error('Failed to process real-time update:', error);
      setError('Failed to sync latest changes');
    }
  }, [currentInstance, user?.id, addNotification]);

  // Handle WebSocket connection changes
  const handleConnectionChange = useCallback((connected: boolean) => {
    console.log('WebSocket connection status:', connected);
    
    if (connected && currentInstance) {
      // Re-subscribe to current instance when reconnected
      websocketService.subscribeToInstance(currentInstance.id);
    }
  }, [currentInstance]);

  // Handle WebSocket errors
  const handleWebSocketError = useCallback((error: string) => {
    console.error('WebSocket error:', error);
    setError('Real-time connection error');
  }, []);

  const loadTodayInstances = useCallback(async () => {
    setLoading(true);
    try {
      const instances = await checklistApi.getTodayInstances();
      setTodayInstances(instances);
      setError(null);
    } catch (err) {
      setError('Failed to load today\'s checklists');
      console.error('Error loading today instances:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInstanceWithRetry = useCallback(async (id: string, retryCount = 0) => {
    if (!id || id === 'undefined') {
      console.error('Invalid instance ID provided:', id);
      setError('Invalid checklist ID');
      return;
    }
    
    setLoading(true);
    try {
      console.log('🔍 ChecklistContext Debug - Fetching instance with ID:', id);
      const instance = await checklistApi.getInstance(id);
      
      console.log('🔍 ChecklistContext Debug - Instance received from API:', {
        instanceId: instance?.id,
        templateName: instance?.template?.name,
        itemsCount: instance?.items?.length || 0,
        firstItem: instance?.items?.[0],
        firstItemTitle: instance?.items?.[0]?.title || instance?.items?.[0]?.template_item?.title,
        firstItemStructure: instance?.items?.[0] ? Object.keys(instance.items[0]) : [],
        firstItemItemStructure: instance?.items?.[0]?.template_item ? Object.keys(instance.items[0].template_item) : [],
        hasItemProperty: !!(instance?.items?.[0]?.template_item),
        allItemTitles: instance?.items?.map(item => item.title || item.template_item?.title || 'NO TITLE')
      });
      
      setCurrentInstance(instance);
      setError(null);
    } catch (err: any) {
      console.error('Error loading instance:', err);
      
      // Auto-retry for network errors (max 2 retries)
      if (retryCount < 2 && (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('fetch'))) {
        console.log(`Retrying... attempt ${retryCount + 1}`);
        setTimeout(() => loadInstanceWithRetry(id, retryCount + 1), 2000);
        return;
      }
      
      // Handle different types of errors
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || err.message?.includes('fetch')) {
        setError('Network connection failed. Please check your internet connection and try again.');
      } else if (err.response?.status === 500) {
        setError('Server error occurred. The team has been notified. Please try again in a few moments.');
      } else if (err.response?.status === 404) {
        setError('Checklist not found or has been removed.');
      } else {
        setError('Failed to load checklist. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInstance = useCallback((id: string) => {
    return loadInstanceWithRetry(id, 0);
  }, [loadInstanceWithRetry]);

  const joinInstance = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      console.log('🔄 Attempting to join checklist instance:', instanceId);
      const updatedInstance = await checklistApi.joinInstance(instanceId);
      console.log('✅ Successfully joined checklist instance:', {
        instanceId,
        instance: updatedInstance,
        participants: updatedInstance?.participants,
        participantCount: updatedInstance?.participants?.length
      });

      // Ensure the instance has all required data
      if (updatedInstance) {
        // Trust backend participant mapping (UserInfo) and use as-is
        setCurrentInstance(updatedInstance);
        setError(null);
        
        // Update today instances to reflect the join
        await loadTodayInstances();
        
        addNotification({
          type: 'success',
          message: `Successfully joined the checklist as ${user?.username || 'user'}`,
          priority: 'medium'
        });
      } else {
        throw new Error('No data returned from join operation');
      }
    } catch (err: any) {
      console.error('❌ Error joining checklist instance:', {
        instanceId,
        error: err,
        errorMessage: err.message,
        errorStatus: err.response?.status,
        errorData: err.response?.data
      });
      
      setError(`Failed to join checklist: ${err.message || 'Unknown error'}`);
      
      // Provide more specific error messages based on status code
      let errorMessage = 'Failed to join checklist. Please try again.';
      if (err.response?.status === 400) {
        if (err.response?.data?.error?.includes('not open')) {
          errorMessage = 'This checklist is no longer open for joining.';
        } else {
          errorMessage = err.response.data.error || 'Invalid request to join checklist.';
        }
      } else if (err.response?.status === 404) {
        errorMessage = 'Checklist instance not found.';
      } else if (err.response?.status === 401) {
        errorMessage = 'You are not authorized to join this checklist.';
      }
      
      addNotification({
        type: 'error',
        message: errorMessage,
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [loadTodayInstances, addNotification, user]);

  // State transition validation (updated to allow SKIPPED/FAILED -> COMPLETED)
  const validateTransition = useCallback((currentStatus: string, newStatus: string): boolean => {
    const allowedTransitions: Record<string, string[]> = {
      'PENDING': ['IN_PROGRESS', 'SKIPPED', 'FAILED'],
      'IN_PROGRESS': ['COMPLETED', 'SKIPPED', 'FAILED'],
      'COMPLETED': [], // No transitions from completed
      'SKIPPED': ['COMPLETED'], // Allow completion after skip
      'FAILED': ['COMPLETED'] // Allow completion after issue resolution
    };
    
    return allowedTransitions[currentStatus]?.includes(newStatus) || false;
  }, []);

  const getActionType = useCallback((newStatus: string): 'STARTED' | 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'ESCALATED' | 'UPDATED' => {
    switch (newStatus) {
      case 'IN_PROGRESS': return 'STARTED';
      case 'COMPLETED': return 'COMPLETED';
      case 'SKIPPED': return 'SKIPPED';
      case 'FAILED': return 'FAILED';
      default: return 'UPDATED';
    }
  }, []);

  // Enhanced error logging and reporting
  const logErrorToService = useCallback((error: any, context: any) => {
    try {
      // Log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Enhanced Error Logging:', {
          error: error.message || error,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }
      
      // In production, you would send to error tracking service
      // Example: Sentry.captureException(error, { extra: context });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }, []);

  // Retry logic with exponential backoff
  const retryWithBackoff = useCallback(
    async <T,>(
      operation: () => Promise<T>,
      maxRetries: number = 3,
      baseDelay: number = 1000
    ): Promise<T> => {
      let lastError: any;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (error: any) {
          lastError = error;
          
          // Don't retry on client errors (4xx)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            throw error;
          }
          
          // Don't retry on last attempt
          if (attempt === maxRetries) {
            throw error;
          }
          
          // Calculate exponential backoff delay
          const delay = baseDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          console.log(`Retrying operation (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms`);
        }
      }
      
      throw lastError;
    },
    []
  );

  // Input validation helpers
  const validateUpdateItemStatusInput = useCallback((
    instanceId: string,
    itemId: string,
    status: string
  ): string[] => {
    const errors: string[] = [];
    
    if (!instanceId || typeof instanceId !== 'string') {
      errors.push('Valid instance ID is required');
    }
    
    if (!itemId || typeof itemId !== 'string') {
      errors.push('Valid item ID is required');
    }
    
    if (!status || typeof status !== 'string') {
      errors.push('Valid status is required');
    }
    
    const validStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'FAILED', 'NOT_APPLICABLE'];
    if (!validStatuses.includes(status)) {
      errors.push(`Status must be one of: ${validStatuses.join(', ')}`);
    }
    
    return errors;
  }, []);

  const updateItemStatus = useCallback(async (
    instanceId: string,
    itemId: string,
    status: string,
    comment?: string,
    reason?: string
  ) => {
    setLoading(true);
    const operationId = `update_item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Input validation
      const validationErrors = validateUpdateItemStatusInput(instanceId, itemId, status);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
      
      // Context validation
      if (!currentInstance) {
        throw new Error('No active checklist instance');
      }
      
      console.log('🔄 Updating item status:', {
        operationId,
        instanceId,
        itemId,
        status,
        comment,
        reason
      });

      // Find current item for previous status and timing
      const currentItem = currentInstance?.items.find(item => item.id === itemId);
      const previousStatus = currentItem?.status || 'PENDING';
      
      // Validate state transition before proceeding
      if (!validateTransition(previousStatus, status)) {
        throw new Error(`Invalid state transition from ${previousStatus} to ${status}`);
      }
      
      const startTime = currentItem?.activities
        ?.filter(activity => activity.action === 'STARTED')
        ?.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0]?.timestamp;
      
      let durationMs: number | undefined;
      if (startTime && (status === 'COMPLETED' || status === 'SKIPPED')) {
        durationMs = Date.now() - new Date(startTime).getTime();
      }

      // Optimistic update - update local state immediately
      if (currentInstance && currentInstance.id === instanceId) {
        const updatedItems = currentInstance.items.map(item => {
          if (item.id === itemId) {
            const updatedItem = {
              ...item,
              status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NOT_APPLICABLE',
              notes: comment || reason || null,
              updated_at: new Date().toISOString(),
              skipped_reason: (status === 'SKIPPED' ? reason : null) || item.skipped_reason,
              failure_reason: (status === 'FAILED' ? reason : null) || item.failure_reason
            };

            // Set completion details if status is COMPLETED
            if (status === 'COMPLETED') {
              updatedItem.completed_at = new Date().toISOString();
              if (user) {
                updatedItem.completed_by = {
                  id: user.id,
                  username: user.username
                };
              }
            }

            // Add activity log entry
            const newActivity: ItemActivity = {
              id: `activity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              action: getActionType(status),
              actor: user ? {
                id: user.id,
                username: user.username,
                email: user.email
              } : {
                id: 'system',
                username: 'system',
                email: 'system@sentinel.com'
              },
              timestamp: new Date().toISOString(),
              notes: comment || reason || undefined,
              metadata: {
                previous_status: previousStatus,
                new_status: status,
                reason: reason,
                duration_ms: durationMs
              }
            };

            updatedItem.activities = [...(item.activities || []), newActivity];

            console.log('🔄 Optimistic update for item:', {
              operationId,
              itemId,
              oldStatus: item.status,
              newStatus: updatedItem.status,
              completedBy: updatedItem.completed_by,
              activity: newActivity
            });

            return updatedItem;
          }
          return item;
        });

        // Update current instance with optimistic changes
        const updatedInstance = {
          ...currentInstance,
          items: updatedItems,
          updated_at: new Date().toISOString()
        };

        setCurrentInstance(updatedInstance);
        console.log('✅ Local state updated optimistically');
      }

      // Make API call with retry logic - server returns the full instance
      const updatedInstance = await retryWithBackoff(async () => {
        return await checklistApi.updateItemStatus(instanceId, itemId, {
          status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NOT_APPLICABLE',
          notes: comment || reason || undefined,
          action_type: getActionType(status),
          reason: reason,
          metadata: {
            previous_status: previousStatus,
            duration_ms: durationMs
          }
        });
      });

      console.log('✅ Item status updated successfully on server:', {
        operationId,
        itemId,
        instanceId: updatedInstance.id,
        // find updated item for logging
        updatedItem: updatedInstance.items.find(i => i.id === itemId)
      });

      // Check if we need to transition instance from OPEN to IN_PROGRESS
      // This happens when the first item starts working (PENDING → IN_PROGRESS)
      if (
        currentInstance.status === 'OPEN' && 
        status === 'IN_PROGRESS' && 
        previousStatus === 'PENDING'
      ) {
        console.log('🔄 Transitioning checklist instance from OPEN to IN_PROGRESS');
        
        // Update the instance status to IN_PROGRESS
        const instanceWithInProgress: ChecklistInstance = {
          ...updatedInstance,
          status: 'IN_PROGRESS' as const
        };
        
        setCurrentInstance(instanceWithInProgress);
        
        // Also update todayInstances list if it exists
        setTodayInstances(prev => {
          if (!prev || prev.length === 0) return prev;
          const idx = prev.findIndex(p => p.id === instanceWithInProgress.id);
          if (idx === -1) return prev;
          const copy = [...prev];
          copy[idx] = instanceWithInProgress;
          return copy;
        });
        
        console.log('✅ Checklist instance status transitioned to IN_PROGRESS');
      } else {
        // Normal flow - use server-returned instance
        setError(null);

        // Refresh currentInstance from server-provided instance to ensure source-of-truth
        setCurrentInstance(updatedInstance);
      }

      // Also update the in-memory `todayInstances` list to replace the instance
      setTodayInstances(prev => {
        if (!prev || prev.length === 0) return prev;
        const idx = prev.findIndex(p => p.id === updatedInstance.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = updatedInstance;
        return copy;
      });

      // Defer refreshing the full today instances list to avoid immediate race
      // with other components that may trigger instance reloads simultaneously.
      setTimeout(() => {
        loadTodayInstances().catch(err => console.error('Deferred loadTodayInstances failed', err));
      }, 400);

      // Add notification using the updated item (if available)
      const updatedItem = updatedInstance.items.find(i => i.id === itemId) as any;
      if (updatedItem) {
        const action = status === 'COMPLETED' ? 'completed' :
                      status === 'SKIPPED' ? 'skipped' :
                      status === 'FAILED' ? 'escalated' : 
                      status === 'IN_PROGRESS' ? 'started' : 'updated';
        addNotification({
          type: status === 'COMPLETED' ? 'success' : 
                status === 'FAILED' ? 'error' : 
                status === 'SKIPPED' ? 'warning' : 'info',
          message: `${action} "${updatedItem.title || updatedItem.template_item?.title || 'Item'}"`,
          priority: 'medium'
        });
      }
    } catch (err: any) {
      console.error('❌ Error updating item:', {
        operationId,
        instanceId,
        itemId,
        error: err,
        errorMessage: err.message,
        errorStatus: err.response?.status,
        errorData: err.response?.data
      });
      
      // Enhanced error logging and reporting
      logErrorToService(err, {
        operationId,
        instanceId,
        itemId,
        status,
        user: user?.id,
        timestamp: new Date().toISOString()
      });
      
      // Revert optimistic update on error
      if (currentInstance && currentInstance.id === instanceId) {
        await loadInstance(instanceId);
        console.log('🔄 Reverted optimistic update due to error');
      }
      
      // Enhanced error messages based on error type
      let errorMessage = 'Failed to update item. Please try again.';
      if (err.response?.status === 400) {
        const errorData = err.response.data;
        if (errorData?.code === 'INVALID_TRANSITION') {
          errorMessage = `Invalid state transition: ${errorData.error}`;
        } else if (errorData?.code === 'VALIDATION_ERROR') {
          errorMessage = `Validation error: ${errorData.error}`;
        } else {
          errorMessage = errorData?.error || 'Invalid request.';
        }
      } else if (err.response?.status === 404) {
        errorMessage = 'Checklist item not found.';
      } else if (err.response?.status === 401) {
        errorMessage = 'You are not authorized to perform this action.';
      } else if (err.response?.status === 409) {
        errorMessage = 'Conflict detected. Please refresh and try again.';
      } else if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
        errorMessage = 'Network connection failed. Please check your internet connection.';
      } else if (err.message?.includes('Validation failed')) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      addNotification({
        type: 'error',
        message: errorMessage,
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [loadTodayInstances, addNotification, currentInstance, loadInstance, validateTransition, user, retryWithBackoff, validateUpdateItemStatusInput, logErrorToService]);

  const updateSubitemStatus = useCallback(async (
    instanceId: string,
    itemId: string,
    subitemId: string,
    status: string,
    comment?: string,
    reason?: string
  ) => {
    setLoading(true);
    const operationId = `update_subitem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Input validation
      if (!instanceId || !itemId || !subitemId || !status) {
        throw new Error('Instance ID, Item ID, Subitem ID, and status are required');
      }
      
      // Context validation
      if (!currentInstance) {
        throw new Error('No active checklist instance');
      }
      
      console.log('🔄 Updating subitem status:', {
        operationId,
        instanceId,
        itemId,
        subitemId,
        status,
        comment,
        reason
      });

      // Find current item and subitem for previous status
      const currentItem = currentInstance?.items.find(item => item.id === itemId) as ExtendedChecklistItemInstance;
      const currentSubitem = currentItem?.subitems?.find((subitem: any) => subitem.id === subitemId);
      const previousStatus = currentSubitem?.status || 'PENDING';
      
      // Validate state transition before proceeding
      if (!validateTransition(previousStatus, status)) {
        throw new Error(`Invalid state transition from ${previousStatus} to ${status}`);
      }

      // Optimistic update - update local state immediately
      if (currentInstance && currentInstance.id === instanceId) {
        const updatedItems = currentInstance.items.map((item: ChecklistItemInstance) => {
          if (item.id === itemId) {
            return {
              ...item,
              subitems: item.subitems?.map((subitem: ChecklistInstanceSubitem) => {
                if (subitem.id === subitemId) {
                  return {
                    ...subitem,
                    status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED',
                    completed_by: status === 'COMPLETED' && user?.id ? { id: user.id, username: user.username || '' } : null,
                    completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
                    skipped_reason: status === 'SKIPPED' ? (reason || null) : null,
                    failure_reason: status === 'FAILED' ? (reason || null) : null,
                  };
                }
                return subitem;
              })
            };
          }
          return item;
        });

        // Update current instance with optimistic changes
        const updatedInstance = {
          ...currentInstance,
          items: updatedItems,
          updated_at: new Date().toISOString()
        };

        setCurrentInstance(updatedInstance);
        console.log('✅ Local state updated optimistically for subitem');
      }

      // Make API call using the proper API service
      await checklistApi.updateSubitemStatus(
        instanceId,
        itemId,
        subitemId,
        {
          status: status,
          reason: reason,
          comment: comment || reason || undefined
        }
      );

      console.log('✅ Subitem status updated successfully on server:', {
        operationId,
        subitemId,
        instanceId
      });

      setError(null);

      // Fetch the updated instance from server to get latest state
      const updatedInstance = await checklistApi.getInstance(instanceId);
      setCurrentInstance(updatedInstance);

      // Update today instances list
      setTodayInstances(prev => {
        if (!prev || prev.length === 0) return prev;
        const idx = prev.findIndex(p => p.id === updatedInstance.id);
        if (idx === -1) return prev;
        const copy = [...prev];
        copy[idx] = updatedInstance;
        return copy;
      });

      // Add notification
      const updatedItem = updatedInstance.items.find(i => i.id === itemId) as ExtendedChecklistItemInstance;
      const updatedSubitem = updatedItem?.subitems?.find((s: any) => s.id === subitemId);
      
      if (updatedSubitem) {
        const action = status === 'COMPLETED' ? 'completed' :
                      status === 'SKIPPED' ? 'skipped' :
                      status === 'FAILED' ? 'escalated' : 
                      status === 'IN_PROGRESS' ? 'started' : 'updated';
        addNotification({
          type: status === 'COMPLETED' ? 'success' : 
                status === 'FAILED' ? 'error' : 
                status === 'SKIPPED' ? 'warning' : 'info',
          message: `Subitem "${updatedSubitem.title || 'Subitem'}" ${action}`,
          priority: 'medium'
        });
      }
    } catch (err: any) {
      console.error('❌ Error updating subitem:', {
        operationId,
        instanceId,
        itemId,
        subitemId,
        error: err,
        errorMessage: err.message,
        errorStatus: err.status
      });
      
      // Intelligent error recovery - only reload if it's a state transition error
      if (err.message?.includes('Invalid state transition') && currentInstance && currentInstance.id === instanceId) {
        // Only reload the specific item, not the entire instance
        await loadInstance(instanceId);
        console.log('🔄 Reverted optimistic update due to state transition error');
      } else if (err.status === 404 || err.status === 500) {
        // Full reload only for critical errors
        await loadInstance(instanceId);
        console.log('🔄 Full instance reload due to critical error');
      }
      
      setError(`Failed to update subitem: ${err.message || 'Unknown error'}`);
      
      addNotification({
        type: 'error',
        message: 'Failed to update subitem. Please try again.',
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [currentInstance, loadInstance, validateTransition, user, addNotification]);

  const createHandoverNote = useCallback(async (content: string, priority: number) => {
    setLoading(true);
    try {
      const handoverResult: any = await checklistApi.createHandoverNote({
        content,
        priority,
        from_instance_id: currentInstance?.id
      });

      const summary = handoverResult?.notification_summary;
      const currentCount = Number(summary?.current_shift_notified || 0);
      const nextCount = Number(summary?.next_shift_notified || 0);
      const emailCount = Number(summary?.email_recipients || 0);
      const detailLine = (currentCount || nextCount || emailCount)
        ? ` Current shift notified: ${currentCount}, next shift notified: ${nextCount}, email alerts: ${emailCount}.`
        : '';
      
      addNotification({
        type: 'info',
        message: `Handover note created successfully.${detailLine}`,
        priority: 'medium'
      });
      
      setError(null);
    } catch (err: any) {
      let errorMessage = 'Failed to create handover note';
      
      // Handle specific error cases
      if (err?.response?.data?.detail) {
        if (err.response.data.detail.includes('No active checklist found')) {
          errorMessage = 'No active checklist found. Please start a checklist first before creating handover notes.';
        } else {
          errorMessage = err.response.data.detail;
        }
      }
      
      setError(errorMessage);
      console.error('Error creating handover note:', err);
      
      addNotification({
        type: 'error',
        message: errorMessage,
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [currentInstance?.id, currentInstance?.shift, addNotification]);

  const completeInstance = useCallback(async (instanceId: string, withExceptions: boolean = false) => {
    setLoading(true);
    try {
      console.log('🔄 Completing checklist instance:', { instanceId, withExceptions });
      const completedInstance = await checklistApi.completeInstance(instanceId, withExceptions);
      
      setCurrentInstance(completedInstance);
      setError(null);
      
      // Update today instances to reflect completion
      await loadTodayInstances();
      
      const statusLabel = withExceptions ? 'completed with exceptions' : 'completed';
      addNotification({
        type: 'success',
        message: `Checklist ${statusLabel} successfully`,
        priority: 'high'
      });
      
      console.log('✅ Checklist completed successfully:', {
        instanceId,
        status: completedInstance.status
      });
    } catch (err: any) {
      console.error('❌ Error completing checklist:', {
        instanceId,
        error: err,
        errorMessage: err.message,
        errorStatus: err.response?.status
      });
      
      let errorMessage = 'Failed to complete checklist. Please try again.';
      if (err.response?.status === 403) {
        errorMessage = 'You are not authorized to complete this checklist.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.detail || 'Invalid request to complete checklist.';
      } else if (err.response?.status === 404) {
        errorMessage = 'Checklist instance not found.';
      }
      
      setError(errorMessage);
      addNotification({
        type: 'error',
        message: errorMessage,
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [loadTodayInstances, addNotification]);

  const deleteInstance = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      await checklistApi.deleteInstance(instanceId);
      
      // Remove from todayInstances state
      setTodayInstances(prev => prev.filter(instance => instance.id !== instanceId));
      
      // Clear currentInstance if it's the deleted one
      if (currentInstance?.id === instanceId) {
        setCurrentInstance(null);
      }
      
      setError(null);
      
      addNotification({
        type: 'success',
        message: 'Checklist instance deleted successfully',
        priority: 'medium'
      });
    } catch (err: any) {
      console.error('Error deleting checklist instance:', err);
      setError('Failed to delete checklist instance');
      
      addNotification({
        type: 'error',
        message: 'Failed to delete checklist instance. Please try again.',
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [currentInstance, addNotification]);

  const refreshInstance = useCallback(async () => {
    if (currentInstance) {
      await loadInstance(currentInstance.id);
    }
  }, [currentInstance, loadInstance]);

  return (
    <ChecklistContext.Provider value={{
      currentInstance,
      todayInstances,
      loading,
      error,
      loadTodayInstances,
      loadInstance,
      joinInstance,
      updateItemStatus,
      updateSubitemStatus,
      completeInstance,
      deleteInstance,
      createHandoverNote,
      refreshInstance
    }}>
      {children}
    </ChecklistContext.Provider>
  );
};
