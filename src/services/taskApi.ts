// src/services/taskApi.ts
import api from './api';

// Task Types (matching backend schemas)
export type TaskType = 'PERSONAL' | 'TEAM' | 'DEPARTMENT' | 'SYSTEM';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'DRAFT' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'ON_HOLD';
export type CommentType = 'COMMENT' | 'STATUS_UPDATE' | 'ASSIGNMENT_CHANGE' | 'SYSTEM_UPDATE';

export interface Task {
  id: string;
  title: string;
  description?: string;
  task_type: TaskType;
  priority: Priority;
  status: TaskStatus;
  assigned_to_id?: string;
  assigned_by_id: string;
  department_id?: number | string;
  section_id?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage: number;
  tags: string[];
  parent_task_id?: string;
  is_recurring: boolean;
  recurrence_pattern?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  deleted_at?: string;
  
  // Nested relationships
  assigned_to?: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  assigned_by?: {
    id: string;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  department?: {
    id: string;
    name: string;
  };
  section?: {
    id: string;
    name: string;
  };
  parent_task?: {
    id: string;
    title: string;
  };
  subtasks_count: number;
  comments_count: number;
  attachments_count: number;
  permissions: TaskPermissions;
  
  // Optional nested arrays for detailed view
  history?: TaskHistory[];
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
}

export interface TaskPermissions {
  can_view: boolean;
  can_edit: boolean;
  can_assign: boolean;
  can_complete: boolean;
  can_delete: boolean;
  can_comment: boolean;
  can_add_attachments: boolean;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  task_type: TaskType;
  assigned_to?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
  };
  due_date?: string;
  completion_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  comment_type: CommentType;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
  };
  // Sometimes backend returns flattened user fields joined in query
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  filename: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  uploaded_by_id: string;
  uploaded_at: string;
  uploaded_by?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
  };
}

export interface TaskHistory {
  id: string;
  task_id: string;
  user_id: string;
  action: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  timestamp: string;
  user?: {
    id: string;
    username: string;
    first_name: string;
    last_name: string;
  };
  // Backend may include flattened user fields when joining
  username?: string;
  first_name?: string;
  last_name?: string;
}

// Request Types
export interface CreateTaskRequest {
  title: string;
  description?: string;
  task_type: TaskType;
  priority?: Priority;
  status?: TaskStatus;
  assigned_to_id?: string;
  department_id?: number | string;
  section_id?: string;
  due_date?: string;
  estimated_hours?: number;
  tags?: string[];
  parent_task_id?: string;
  is_recurring?: boolean;
  recurrence_pattern?: string;
  assigned_by_id: string; // Required for creation
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  status?: TaskStatus;
  assigned_to_id?: string;
  department_id?: number | string;
  section_id?: string;
  due_date?: string;
  estimated_hours?: number;
  actual_hours?: number;
  completion_percentage?: number;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_pattern?: string;
}

export interface AssignTaskRequest {
  assigned_to_id: string;
  assigned_by_id: string;
  notes?: string;
}

export interface TaskFilters {
  status?: TaskStatus[];
  assigned_to?: string;
  assigned_by?: string;
  department_id?: number | string;
  section_id?: string;
  priority?: Priority[];
  task_type?: TaskType[];
  due_before?: string;
  due_after?: string;
  created_after?: string;
  created_before?: string;
  tags?: string[];
  search?: string;
  parent_task_id?: string;
  is_overdue?: boolean;
}

export interface TaskListResponse {
  tasks: TaskSummary[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters_applied?: TaskFilters;
}

export interface TaskAnalytics {
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  active_tasks: number;
  completion_rate: number;
  average_completion_time_hours?: number;
  tasks_by_priority: Record<string, number>;
  tasks_by_status: Record<string, number>;
  tasks_by_type: Record<string, number>;
}

export interface BulkTaskOperation {
  task_ids: string[];
  operation: 'assign' | 'complete' | 'cancel' | 'delete';
  parameters?: Record<string, any>;
}

export interface BulkTaskResponse {
  successful: string[];
  failed: Array<{
    task_id: string;
    error: string;
  }>;
  total_processed: number;
  success_count: number;
  failure_count: number;
}

// API Response Types
export interface TaskMutationResponse {
  id: string;
  created_at?: string;
  updated_at?: string;
  completed_at?: string;
  deleted_at?: string;
  assigned_to_id?: string;
  message: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

// Query Parameters
export interface TaskQueryParams {
  status?: TaskStatus[];
  assigned_to?: string;
  assigned_by?: string;
  department_id?: number | string;
  section_id?: string;
  priority?: Priority[];
  task_type?: TaskType[];
  due_before?: string;
  due_after?: string;
  created_after?: string;
  created_before?: string;
  tags?: string[];
  search?: string;
  parent_task_id?: string;
  is_overdue?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

class TaskApi {
  // Core CRUD Operations
  async createTask(data: CreateTaskRequest): Promise<TaskMutationResponse> {
    console.log('🚀 Creating task with payload:', data);
    console.log('🎯 Target endpoint: POST /api/v1/tasks');
    
    const response = await api.post<TaskMutationResponse>('/api/v1/tasks', data);
    
    console.log('📥 Task creation response:', response.data);
    return response.data;
  }

  async getTask(taskId: string): Promise<Task> {
    if (!taskId || taskId === 'undefined') {
      throw new Error(`Invalid task ID: ${taskId}`);
    }
    
    console.log('🔍 Fetching task:', taskId);
    const response = await api.get<Task>(`/api/v1/tasks/${taskId}`);
    console.log('📥 Task response:', response.data);
    return response.data;
  }

  async updateTask(taskId: string, data: UpdateTaskRequest): Promise<TaskMutationResponse> {
    console.log('📝 Updating task:', taskId, 'with data:', data);
    const response = await api.patch<TaskMutationResponse>(`/api/v1/tasks/${taskId}`, data);
    console.log('📥 Task update response:', response.data);
    return response.data;
  }

  async deleteTask(taskId: string): Promise<TaskMutationResponse> {
    console.log('🗑️ Deleting task:', taskId);
    const response = await api.delete<TaskMutationResponse>(`/api/v1/tasks/${taskId}`);
    console.log('📥 Task delete response:', response.data);
    return response.data;
  }

  // Task Listing with Filtering
  async listTasks(params: TaskQueryParams = {}): Promise<TaskListResponse> {
    console.log('📋 Listing tasks with params:', params);
    
    const searchParams = new URLSearchParams();
    
    // Add array parameters properly
    if (params.status) {
      params.status.forEach(status => searchParams.append('status', status));
    }
    if (params.priority) {
      params.priority.forEach(priority => searchParams.append('priority', priority));
    }
    if (params.task_type) {
      params.task_type.forEach(type => searchParams.append('task_type', type));
    }
    if (params.tags) {
      params.tags.forEach(tag => searchParams.append('tags', tag));
    }
    
    // Add single parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        searchParams.append(key, String(value));
      }
    });
    
    const url = `/api/v1/tasks?${searchParams.toString()}`;
    console.log('🎯 Target URL:', url);
    
    const response = await api.get<TaskListResponse>(url);
    console.log('📥 Tasks list response:', response.data);
    return response.data;
  }

  // Specialized Task Endpoints
  async getMyTasks(params: Omit<TaskQueryParams, 'assigned_to'> = {}): Promise<TaskListResponse> {
    console.log('👤 Fetching my tasks with params:', params);
    
    const searchParams = new URLSearchParams();
    
    // Always add default values to avoid validation errors
    const defaultParams = {
      sort: 'due_date',
      order: 'asc',
      limit: 20,
      offset: 0,
      ...params
    };
    
    // Add array parameters properly
    if (defaultParams.status && Array.isArray(defaultParams.status)) {
      defaultParams.status.forEach(status => searchParams.append('status', status));
    }
    if (defaultParams.priority && Array.isArray(defaultParams.priority)) {
      defaultParams.priority.forEach(priority => searchParams.append('priority', priority));
    }
    
    // Add single parameters
    Object.entries(defaultParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        searchParams.append(key, String(value));
      }
    });
    
    const url = `/api/v1/tasks/my-tasks?${searchParams.toString()}`;
    console.log('🎯 Target URL:', url);
    console.log('🔍 Search params:', Object.fromEntries(searchParams.entries()));
    
    try {
      const response = await api.get<TaskListResponse>(url);
      console.log('📥 My tasks response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ API Error:', error.response?.data);
      console.error('❌ Full error:', error);
      
      // Log the validation details specifically
      if (error.response?.status === 422) {
        console.error('❌ Validation Error Details:', JSON.stringify(error.response.data.detail, null, 2));
      }
      
      throw error;
    }
  }

  async getTasksAssignedByMe(params: Omit<TaskQueryParams, 'assigned_by'> = {}): Promise<TaskListResponse> {
    console.log('📤 Fetching tasks assigned by me with params:', params);
    
    const searchParams = new URLSearchParams();
    
    // Add array parameters properly
    if (params.status) {
      params.status.forEach(status => searchParams.append('status', status));
    }
    if (params.priority) {
      params.priority.forEach(priority => searchParams.append('priority', priority));
    }
    if (params.task_type) {
      params.task_type.forEach(type => searchParams.append('task_type', type));
    }
    
    // Add single parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Array.isArray(value)) {
        searchParams.append(key, String(value));
      }
    });
    
    const url = `/api/v1/tasks?${searchParams.toString()}`;
    console.log('🎯 Target URL:', url);
    
    const response = await api.get<TaskListResponse>(url);
    console.log('📥 Tasks assigned by me response:', response.data);
    return response.data;
  }

  async getTeamTasks(params: Omit<TaskQueryParams, 'task_type'> & { team_id?: string } = {}): Promise<TaskListResponse> {
    console.log('👥 Fetching team tasks with params:', params);
    
    const searchParams = new URLSearchParams();
    
    // Set task_type to TEAM by default
    searchParams.append('task_type', 'TEAM');
    
    // Add array parameters properly
    if (params.status) {
      params.status.forEach(status => searchParams.append('status', status));
    }
    if (params.priority) {
      params.priority.forEach(priority => searchParams.append('priority', priority));
    }
    
    // Add single parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Array.isArray(value) && key !== 'task_type') {
        searchParams.append(key, String(value));
      }
    });
    
    const url = `/api/v1/tasks/team-tasks?${searchParams.toString()}`;
    console.log('🎯 Target URL:', url);
    
    const response = await api.get<TaskListResponse>(url);
    console.log('📥 Team tasks response:', response.data);
    return response.data;
  }

  async getDepartmentTasks(params: Omit<TaskQueryParams, 'task_type'> & { department_id?: number | string } = {}): Promise<TaskListResponse> {
    console.log('🏢 Fetching department tasks with params:', params);
    
    const searchParams = new URLSearchParams();
    
    // Set task_type to DEPARTMENT by default
    searchParams.append('task_type', 'DEPARTMENT');
    
    // Add array parameters properly
    if (params.status) {
      params.status.forEach(status => searchParams.append('status', status));
    }
    if (params.priority) {
      params.priority.forEach(priority => searchParams.append('priority', priority));
    }
    
    // Add single parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && !Array.isArray(value) && key !== 'task_type') {
        searchParams.append(key, String(value));
      }
    });
    
    const url = `/api/v1/tasks/department-tasks?${searchParams.toString()}`;
    console.log('🎯 Target URL:', url);
    
    const response = await api.get<TaskListResponse>(url);
    console.log('📥 Department tasks response:', response.data);
    return response.data;
  }

  // Task Assignment Operations
  async assignTask(taskId: string, data: AssignTaskRequest): Promise<TaskMutationResponse> {
    console.log('👤 Assigning task:', taskId, 'to:', data.assigned_to_id);
    const response = await api.post<TaskMutationResponse>(`/api/v1/tasks/${taskId}/assign`, data);
    console.log('📥 Task assignment response:', response.data);
    return response.data;
  }

  async completeTask(taskId: string): Promise<TaskMutationResponse> {
    console.log('✅ Completing task:', taskId);
    const response = await api.post<TaskMutationResponse>(`/api/v1/tasks/${taskId}/complete`);
    console.log('📥 Task completion response:', response.data);
    return response.data;
  }

  // Comments
  async addComment(taskId: string, content: string): Promise<{ id: string; created_at: string }> {
    console.log('💬 Adding comment to task:', taskId, content);
    const response = await api.post<{ id: string; created_at: string }>(`/api/v1/tasks/${taskId}/comments`, { content });
    console.log('📥 Add comment response:', response.data);
    return response.data;
  }

  // Attachments
  async uploadAttachment(taskId: string, file: File): Promise<{ id: string; uploaded_at: string }> {
    console.log('📎 Uploading attachment for task:', taskId, file.name);
    const form = new FormData();
    form.append('file', file);
    const response = await api.post(`/api/v1/tasks/${taskId}/attachments`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    console.log('📥 Upload attachment response:', response.data);
    return response.data;
  }

  // Bulk Operations
  async bulkOperation(data: BulkTaskOperation): Promise<BulkTaskResponse> {
    console.log('🔄 Performing bulk operation:', data);
    const response = await api.post<BulkTaskResponse>('/api/v1/tasks/bulk-operations', data);
    console.log('📥 Bulk operation response:', response.data);
    return response.data;
  }

  // Analytics (Managers and Admins only)
  async getTaskAnalytics(): Promise<TaskAnalytics> {
    console.log('📊 Fetching task analytics');
    const response = await api.get<TaskAnalytics>('/api/v1/tasks/analytics/summary');
    console.log('📥 Task analytics response:', response.data);
    return response.data;
  }

  // Status Change Helper
  async changeTaskStatus(taskId: string, status: TaskStatus): Promise<TaskMutationResponse> {
    console.log('🔄 Changing task status:', taskId, 'to:', status);
    return this.updateTask(taskId, { status });
  }

  // Quick status changes
  async activateTask(taskId: string): Promise<TaskMutationResponse> {
    return this.changeTaskStatus(taskId, 'ACTIVE');
  }

  async startTask(taskId: string): Promise<TaskMutationResponse> {
    return this.changeTaskStatus(taskId, 'IN_PROGRESS');
  }

  async completeTaskById(taskId: string): Promise<TaskMutationResponse> {
    return this.changeTaskStatus(taskId, 'COMPLETED');
  }

  async cancelTask(taskId: string): Promise<TaskMutationResponse> {
    return this.changeTaskStatus(taskId, 'CANCELLED');
  }
}

export const taskApi = new TaskApi();
export default taskApi;
