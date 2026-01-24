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

  const loadInstance = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const instance = await checklistApi.getInstance(id);
      setCurrentInstance(instance);
      setError(null);
    } catch (err) {
      setError('Failed to load checklist');
      console.error('Error loading instance:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const joinInstance = useCallback(async (instanceId: string) => {
    setLoading(true);
    try {
      const updatedInstance = await checklistApi.joinInstance(instanceId);
      setCurrentInstance(updatedInstance);
      setError(null);
      
      // Update today instances
      await loadTodayInstances();
      
      addNotification({
        type: 'success',
        message: 'Successfully joined the checklist',
        priority: 'medium'
      });
    } catch (err) {
      setError('Failed to join checklist');
      console.error('Error joining instance:', err);
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
      const updatedItem = await checklistApi.updateItemStatus(instanceId, itemId, {
        status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'NOT_APPLICABLE',
        notes: comment
      });
      setError(null);
      
      // Update today instances
      await loadTodayInstances();
      
      // Add notification
      const item = updatedItem.item;
      if (item) {
        const action = status === 'COMPLETED' ? 'completed' :
                      status === 'SKIPPED' ? 'skipped' :
                      status === 'FAILED' ? 'escalated' : 'updated';
        addNotification({
          type: status === 'COMPLETED' ? 'success' : 
                status === 'FAILED' ? 'error' : 'info',
          message: `${action} "${item.title}"`,
          priority: 'medium'
        });
      }
    } catch (err) {
      setError('Failed to update item');
      console.error('Error updating item:', err);
    } finally {
      setLoading(false);
    }
  }, [loadTodayInstances, addNotification]);

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
