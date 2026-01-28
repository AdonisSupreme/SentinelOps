// src/contexts/checklistContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { checklistApi, ChecklistInstance, ChecklistItemInstance } from '../services/checklistApi';
import { useNotifications } from './NotificationContext';

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
        firstItemTitle: instance?.items?.[0]?.template_item?.title,
        firstItemStructure: instance?.items?.[0] ? Object.keys(instance.items[0]) : [],
        firstItemItemStructure: instance?.items?.[0]?.template_item ? Object.keys(instance.items[0].template_item) : [],
        hasItemProperty: !!(instance?.items?.[0]?.template_item),
        allItemTitles: instance?.items?.map(item => item.template_item?.title || 'NO TITLE')
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
        setCurrentInstance(updatedInstance);
        setError(null);
        
        // Update today instances to reflect the join
        await loadTodayInstances();
        
        addNotification({
          type: 'success',
          message: `Successfully joined the checklist as ${updatedInstance.participants?.[updatedInstance.participants.length - 1]?.username || 'user'}`,
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
  }, [loadTodayInstances, addNotification]);

  const updateItemStatus = useCallback(async (
    instanceId: string,
    itemId: string,
    status: string,
    comment?: string,
    reason?: string
  ) => {
    setLoading(true);
    try {
      console.log('🔄 Updating item status:', {
        instanceId,
        itemId,
        status,
        comment,
        reason
      });

      // Optimistic update - update local state immediately
      if (currentInstance && currentInstance.id === instanceId) {
        const updatedItems = currentInstance.items.map(item => {
          if (item.id === itemId) {
            const updatedItem = {
              ...item,
              status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NOT_APPLICABLE',
              notes: comment || reason || null,
              updated_at: new Date().toISOString()
            };

            // Set completion details if status is COMPLETED
            if (status === 'COMPLETED') {
              updatedItem.completed_at = new Date().toISOString();
              updatedItem.completed_by = {
                id: '785cfda9-38c7-4b8d-844a-5c8c7672a12b',
                username: 'ashumba'
              };
            }

            console.log('🔄 Optimistic update for item:', {
              itemId,
              oldStatus: item.status,
              newStatus: updatedItem.status,
              completedBy: updatedItem.completed_by
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

      // Make API call to persist changes
      const updatedItem = await checklistApi.updateItemStatus(instanceId, itemId, {
        status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NOT_APPLICABLE',
        notes: comment || reason || undefined
      });

      console.log('✅ Item status updated successfully on server:', {
        itemId,
        newStatus: updatedItem.status,
        completedBy: updatedItem.completed_by,
        completedAt: updatedItem.completed_at
      });

      setError(null);
      
      // Update today instances to ensure consistency
      await loadTodayInstances();
      
      // Add notification
      const item = updatedItem.template_item;
      if (item) {
        const action = status === 'COMPLETED' ? 'completed' :
                      status === 'SKIPPED' ? 'skipped' :
                      status === 'FAILED' ? 'escalated' : 
                      status === 'IN_PROGRESS' ? 'started' : 'updated';
        addNotification({
          type: status === 'COMPLETED' ? 'success' : 
                status === 'FAILED' ? 'error' : 
                status === 'SKIPPED' ? 'warning' : 'info',
          message: `${action} "${item.title}"`,
          priority: 'medium'
        });
      }
    } catch (err: any) {
      console.error('❌ Error updating item:', {
        instanceId,
        itemId,
        error: err,
        errorMessage: err.message,
        errorStatus: err.response?.status,
        errorData: err.response?.data
      });
      
      // Revert optimistic update on error
      if (currentInstance && currentInstance.id === instanceId) {
        await loadInstance(instanceId);
        console.log('🔄 Reverted optimistic update due to error');
      }
      
      setError(`Failed to update item: ${err.message || 'Unknown error'}`);
      
      // Provide specific error messages
      let errorMessage = 'Failed to update item. Please try again.';
      if (err.response?.status === 404) {
        errorMessage = 'Checklist item not found.';
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data.error || 'Invalid item update request.';
      }
      
      addNotification({
        type: 'error',
        message: errorMessage,
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  }, [loadTodayInstances, addNotification, currentInstance, loadInstance]);

  const createHandoverNote = useCallback(async (content: string, priority: number) => {
    setLoading(true);
    try {
      await checklistApi.createHandoverNote({
        content,
        checklist_instance_id: currentInstance?.id || ''
      });
      
      addNotification({
        type: 'info',
        message: 'Handover note created successfully',
        priority: 'medium'
      });
      
      setError(null);
    } catch (err) {
      setError('Failed to create handover note');
      console.error('Error creating handover note:', err);
    } finally {
      setLoading(false);
    }
  }, [currentInstance?.shift, addNotification]);

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
      createHandoverNote,
      refreshInstance
    }}>
      {children}
    </ChecklistContext.Provider>
  );
};
