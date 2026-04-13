// src/hooks/useTasks.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import taskApi, { 
  Task, 
  TaskSummary, 
  TaskFilters, 
  TaskQueryParams, 
  CreateTaskRequest, 
  UpdateTaskRequest, 
  AssignTaskRequest,
  TaskListResponse,
  TaskMutationResponse,
  BulkTaskOperation,
  BulkTaskResponse,
  TaskAnalytics
} from '../services/taskApi';

// State interfaces
interface TasksState {
  tasks: TaskSummary[];
  currentTask: Task | null;
  myTasks: TaskSummary[];
  assignedByMeTasks: TaskSummary[];
  assignedToMeTasks: TaskSummary[];
  teamTasks: TaskSummary[];
  departmentTasks: TaskSummary[];
  analytics: TaskAnalytics | null;
  loading: boolean;
  error: string | null;
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

interface TasksActions {
  fetchTasks: (params?: TaskQueryParams) => Promise<void>;
  fetchMyTasks: (params?: Omit<TaskQueryParams, 'assigned_to'>) => Promise<void>;
  fetchTasksAssignedByMe: (params?: TaskQueryParams) => Promise<void>;
  fetchAssignedToMe: (params?: TaskQueryParams) => Promise<void>;
  fetchTeamTasks: (params?: Omit<TaskQueryParams, 'task_type'> & { team_id?: string }) => Promise<void>;
  fetchDepartmentTasks: (params?: Omit<TaskQueryParams, 'task_type'> & { department_id?: number | string }) => Promise<void>;
  fetchTask: (taskId: string) => Promise<void>;
  createTask: (data: CreateTaskRequest) => Promise<TaskMutationResponse>;
  updateTask: (taskId: string, data: UpdateTaskRequest) => Promise<TaskMutationResponse>;
  deleteTask: (taskId: string) => Promise<TaskMutationResponse>;
  assignTask: (taskId: string, data: AssignTaskRequest) => Promise<TaskMutationResponse>;
  completeTask: (taskId: string) => Promise<TaskMutationResponse>;
  changeTaskStatus: (taskId: string, status: string) => Promise<TaskMutationResponse>;
  bulkOperation: (data: BulkTaskOperation) => Promise<BulkTaskResponse>;
  fetchAnalytics: () => Promise<void>;
  clearError: () => void;
  clearCurrentTask: () => void;
  refreshTasks: () => Promise<void>;
}

// Custom hook for task management
export const useTasks = (): TasksState & TasksActions => {
  const { user } = useAuth();
  const [state, setState] = useState<TasksState>({
    tasks: [],
    currentTask: null,
    myTasks: [],
    assignedByMeTasks: [],
    assignedToMeTasks: [],
    teamTasks: [],
    departmentTasks: [],
    analytics: null,
    loading: false,
    error: null,
    pagination: {
      total: 0,
      limit: 50,
      offset: 0,
      has_more: false
    }
  });

  const currentParamsRef = useRef<TaskQueryParams>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to update state
  const updateState = useCallback((updates: Partial<TasksState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Helper to handle API errors
  const handleError = useCallback((error: any, operation: string) => {
    console.error(`❌ ${operation} error:`, error);
    
    // Extract error message safely
    let errorMessage = `Failed to ${operation}`;
    
    if (error?.response?.data?.detail) {
      if (typeof error.response.data.detail === 'string') {
        errorMessage = error.response.data.detail;
      } else if (Array.isArray(error.response.data.detail)) {
        errorMessage = error.response.data.detail.map((err: any) => err.msg || err.message).join(', ');
      }
    } else if (error?.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    
    updateState({ error: errorMessage, loading: false });
  }, [updateState]);

  // Generic fetch function with loading states
  const fetchWithLoading = useCallback(async <T>(
    fetchFn: () => Promise<T>,
    loadingMessage: string = 'Loading...'
  ): Promise<T | null> => {
    try {
      updateState({ loading: true, error: null });
      
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const result = await fetchFn();
      updateState({ loading: false });
      return result;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        handleError(error, loadingMessage);
      }
      return null;
    }
  }, [updateState, handleError]);

  // Fetch tasks with role-aware filtering
  const fetchTasks = useCallback(async (params: TaskQueryParams = {}) => {
    if (!user) return;

    console.log('🔍 fetchTasks called with params:', params);
    currentParamsRef.current = params;

    const result = await fetchWithLoading(
      () => taskApi.listTasks(params),
      'fetch tasks'
    );

    if (result) {
      updateState({
        tasks: result.tasks,
        pagination: result.pagination,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch tasks assigned to current user
  const fetchAssignedToMe = useCallback(async (params: TaskQueryParams = {}) => {
    if (!user) return;

    console.log('📥 fetchAssignedToMe called with params:', params);

    const result = await fetchWithLoading(
      () => taskApi.listTasks({ ...params, assigned_to: user.id }),
      'fetch tasks assigned to me'
    );

    if (result) {
      updateState({
        assignedToMeTasks: result.tasks,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch my private tasks
  const fetchMyTasks = useCallback(async (params: Omit<TaskQueryParams, 'assigned_to'> = {}) => {
    if (!user) return;

    console.log('👤 fetchMyTasks called with params:', params);

    const result = await fetchWithLoading(
      () => taskApi.getMyTasks(params),
      'fetch my tasks'
    );

    if (result) {
      updateState({
        myTasks: result.tasks,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch tasks assigned by me (manager/admin only)
  const fetchTasksAssignedByMe = useCallback(async (params: TaskQueryParams = {}) => {
    if (!user) return;

    // Check if user has permission to view tasks they assigned
    const userRole = user.role?.toLowerCase();
    if (!['admin', 'manager'].includes(userRole || '')) {
      console.warn('⚠️ User does not have permission to view assigned tasks');
      updateState({ 
        error: 'Insufficient permissions to view assigned tasks',
        loading: false 
      });
      return;
    }

    console.log('📤 fetchTasksAssignedByMe called with params:', params);

    const result = await fetchWithLoading(
      () => taskApi.listTasks({ ...params, assigned_by: user.id }),
      'fetch tasks assigned by me'
    );

    if (result) {
      updateState({
        assignedByMeTasks: result.tasks,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch team tasks (manager/admin only)
  const fetchTeamTasks = useCallback(async (params: Omit<TaskQueryParams, 'task_type'> & { team_id?: string } = {}) => {
    if (!user) return;

    // Check if user has permission to view team tasks
    const userRole = user.role?.toLowerCase();
    if (!['admin', 'manager'].includes(userRole || '')) {
      console.warn('⚠️ User does not have permission to view team tasks');
      updateState({ 
        error: 'Insufficient permissions to view team tasks',
        loading: false 
      });
      return;
    }

    console.log('👥 fetchTeamTasks called with params:', params);

    const result = await fetchWithLoading(
      () => taskApi.getTeamTasks(params),
      'fetch team tasks'
    );

    if (result) {
      updateState({
        teamTasks: result.tasks,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch department tasks (manager/admin only)
  const fetchDepartmentTasks = useCallback(async (params: Omit<TaskQueryParams, 'task_type'> & { department_id?: number | string } = {}) => {
    if (!user) return;

    // Check if user has permission to view department tasks
    const userRole = user.role?.toLowerCase();
    if (!['admin', 'manager'].includes(userRole || '')) {
      console.warn('⚠️ User does not have permission to view department tasks');
      updateState({ 
        error: 'Insufficient permissions to view department tasks',
        loading: false 
      });
      return;
    }

    console.log('🏢 fetchDepartmentTasks called with params:', params);

    const result = await fetchWithLoading(
      () => taskApi.getDepartmentTasks(params),
      'fetch department tasks'
    );

    if (result) {
      updateState({
        departmentTasks: result.tasks,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Fetch single task
  const fetchTask = useCallback(async (taskId: string) => {
    if (!user) return;

    console.log('🔍 fetchTask called for:', taskId);

    const result = await fetchWithLoading(
      () => taskApi.getTask(taskId),
      'fetch task'
    );

    if (result) {
      updateState({
        currentTask: result,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Create task with role validation
  const createTask = useCallback(async (data: CreateTaskRequest): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Validate task creation permissions
    const userRole = user.role?.toLowerCase();
    const taskType = data.task_type;

    console.log('🆕 createTask called with data:', data);

    // Role-based validation
    if (taskType === 'PERSONAL') {
      // Anyone can create personal tasks
    } else if (taskType === 'TEAM') {
      if (!['admin', 'manager'].includes(userRole || '')) {
        throw new Error('Only managers and admins can create team tasks');
      }
    } else if (taskType === 'DEPARTMENT') {
      if (!['admin', 'manager'].includes(userRole || '')) {
        throw new Error('Only managers and admins can create department tasks');
      }
    } else if (taskType === 'SYSTEM') {
      if (!['admin', 'manager'].includes(userRole || '')) {
        throw new Error('Only managers and admins can create system tasks');
      }
    }

    // Ensure assigned_by_id is set to current user
    const taskData = {
      ...data,
      assigned_by_id: user.id
    };

    const result = await fetchWithLoading(
      () => taskApi.createTask(taskData),
      'create task'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to create task');
  }, [user, fetchWithLoading]);

  // Update task with permission validation
  const updateTask = useCallback(async (taskId: string, data: UpdateTaskRequest): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('📝 updateTask called for:', taskId, 'with data:', data);

    const result = await fetchWithLoading(
      () => taskApi.updateTask(taskId, data),
      'update task'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to update task');
  }, [user, fetchWithLoading]);

  // Delete task with permission validation
  const deleteTask = useCallback(async (taskId: string): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🗑️ deleteTask called for:', taskId);

    const result = await fetchWithLoading(
      () => taskApi.deleteTask(taskId),
      'delete task'
    );

    if (result) {
      if (state.currentTask?.id === taskId) {
        updateState({ currentTask: null });
      }

      return result;
    }

    throw new Error('Failed to delete task');
  }, [user, fetchWithLoading, state.currentTask, updateState]);

  // Assign task with permission validation
  const assignTask = useCallback(async (taskId: string, data: AssignTaskRequest): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('👤 assignTask called for:', taskId, 'with data:', data);

    const result = await fetchWithLoading(
      () => taskApi.assignTask(taskId, data),
      'assign task'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to assign task');
  }, [user, fetchWithLoading]);

  // Complete task
  const completeTask = useCallback(async (taskId: string): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('✅ completeTask called for:', taskId);

    const result = await fetchWithLoading(
      () => taskApi.completeTask(taskId),
      'complete task'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to complete task');
  }, [user, fetchWithLoading]);

  // Change task status
  const changeTaskStatus = useCallback(async (taskId: string, status: string): Promise<TaskMutationResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 changeTaskStatus called for:', taskId, 'to:', status);

    const result = await fetchWithLoading(
      () => taskApi.changeTaskStatus(taskId, status as any),
      'change task status'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to change task status');
  }, [user, fetchWithLoading]);

  // Bulk operation
  const bulkOperation = useCallback(async (data: BulkTaskOperation): Promise<BulkTaskResponse> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    console.log('🔄 bulkOperation called with data:', data);

    const result = await fetchWithLoading(
      () => taskApi.bulkOperation(data),
      'bulk operation'
    );

    if (result) {
      return result;
    }

    throw new Error('Failed to perform bulk operation');
  }, [user, fetchWithLoading]);

  // Fetch analytics (managers and admins only)
  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    // Check if user has permission to view analytics
    const userRole = user.role?.toLowerCase();
    if (!['admin', 'manager'].includes(userRole || '')) {
      console.warn('⚠️ User does not have permission to view analytics');
      updateState({ 
        error: 'Insufficient permissions to view analytics',
        loading: false 
      });
      return;
    }

    console.log('📊 fetchAnalytics called');

    const result = await fetchWithLoading(
      () => taskApi.getTaskAnalytics(),
      'fetch analytics'
    );

    if (result) {
      updateState({
        analytics: result,
        error: null
      });
    }
  }, [user, fetchWithLoading, updateState]);

  // Clear error
  const clearError = useCallback(() => {
    updateState({ error: null });
  }, [updateState]);

  // Clear current task
  const clearCurrentTask = useCallback(() => {
    updateState({ currentTask: null });
  }, [updateState]);

  // Refresh all relevant task lists
  const refreshTasks = useCallback(async () => {
    if (!user) return;

    console.log('🔄 refreshTasks called');

    // Refresh based on user role
    await fetchMyTasks();
    await fetchTasks();

    if (['admin', 'manager'].includes(user.role?.toLowerCase() || '')) {
      await fetchTasksAssignedByMe();
      await fetchAnalytics();
    }
  }, [user, fetchMyTasks, fetchTasks, fetchTasksAssignedByMe, fetchAnalytics]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    fetchTasks,
    fetchMyTasks,
    fetchTasksAssignedByMe,
    fetchAssignedToMe,
    fetchTeamTasks,
    fetchDepartmentTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    assignTask,
    completeTask,
    changeTaskStatus,
    bulkOperation,
    fetchAnalytics,
    clearError,
    clearCurrentTask,
    refreshTasks
  };
};

export default useTasks;
