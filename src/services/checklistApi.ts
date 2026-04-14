// src/services/checklistApi.ts
import api from './api';
import {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistInstance,
  ChecklistItemInstance,
  ItemActivity,
  CreateChecklistInstanceRequest,
  UpdateChecklistItemRequest,
  HandoverNote as BackendHandoverNote,
  CreateHandoverNoteRequest,
  Notification,
  MarkAsReadRequest,
  MarkAllReadRequest,
  GamificationDashboard,
  LeaderboardResponse,
  UserScoresResponse,
  PerformanceMetrics as BackendPerformanceMetrics,
  DashboardSummary as GeneratedDashboardSummary,
  ChecklistStatePolicy,
  AuthorizationPolicy,
  BackendEffects,
  BackendError,
  CreateChecklistTemplateRequest,
  UpdateChecklistTemplateRequest,
  CreateTemplateItemRequest,
  CreateTemplateSubitemRequest,
  ChecklistScheduledEvent,
  TemplateMutationResponse,
} from '../contracts/generated/api.types';

// Re-export generated types for convenience
export type {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistInstance,
  ChecklistItemInstance,
  ItemActivity,
  CreateChecklistInstanceRequest,
  UpdateChecklistItemRequest,
  HandoverNote as BackendHandoverNote,
  CreateHandoverNoteRequest,
  Notification,
  MarkAsReadRequest,
  MarkAllReadRequest,
  GamificationDashboard,
  LeaderboardResponse,
  UserScoresResponse,
  PerformanceMetrics as BackendPerformanceMetrics,
  GeneratedDashboardSummary as DashboardSummary,
  ChecklistStatePolicy,
  AuthorizationPolicy,
  BackendEffects,
  BackendError,
  CreateChecklistTemplateRequest,
  UpdateChecklistTemplateRequest,
  CreateTemplateItemRequest,
  CreateTemplateSubitemRequest,
  ChecklistScheduledEvent,
  TemplateMutationResponse,
};

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

interface BackendPaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ChecklistInstanceQueryParams {
  start_date?: string;
  end_date?: string;
  shift?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort_by?: 'checklist_date' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface ChecklistItemActivity {
  id: string;
  user: {
    id: string;
    username: string;
  };
  action: 'STARTED' | 'COMPLETED' | 'COMMENTED' | 'ACKNOWLEDGED' | 'SKIPPED' | 'ESCALATED';
  comment: string | null;
  created_at: string;
}

export interface HandoverNote {
  id: string;
  content: string;
  priority: number;
  acknowledged_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface PerformanceMetrics {
  shift_date: string;
  shift_type: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  total_instances: number;
  completed_on_time: number;
  completed_with_exceptions: number;
  avg_completion_time_minutes: number;
  avg_points_per_shift: number;
  team_engagement_score: number;
}

export interface GamificationScore {
  id: string;
  user_id: string;
  shift_instance_id: string;
  points: number;
  reason: string;
  awarded_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_points: number;
  current_streak: number;
  perfect_shifts: number;
  rank: number;
  avatar_url: string;
}

export interface ChecklistDateChangeResponse {
  message: string;
  instance: ChecklistInstance;
  target_date: string;
  verification: Array<{
    table_name: string;
    total_records: number;
    earliest_date: string | null;
    latest_date: string | null;
  }>;
}

export interface TodayChecklistCoverage {
  MORNING: number;
  AFTERNOON: number;
  NIGHT: number;
}

export type DashboardShiftName = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export interface DashboardCommandMetrics {
  active_instances: number;
  in_progress_count: number;
  pending_review_count: number;
  completed_count: number;
  exception_count: number;
  coverage_gap_count: number;
  total_items: number;
  completed_items: number;
  actioned_items: number;
  critical_items: number;
  open_critical_items: number;
  participants: number;
  handover_count: number;
  execution_rate: number;
  completion_rate: number;
  critical_containment: number;
  posture_label: 'Elevated' | 'Guarded' | 'Stable' | 'Standby';
}

export interface DashboardShiftCard {
  shift: DashboardShiftName;
  window: string;
  operations: number;
  participants: number;
  exceptions: number;
  readiness: number;
  status: string;
}

export interface DashboardChecklistThread {
  id: string;
  template_id: string | null;
  template_name: string;
  checklist_date: string;
  shift: DashboardShiftName;
  status: string;
  participant_count: number;
  user_joined: boolean;
  total_items: number;
  completed_items: number;
  actioned_items: number;
  critical_items: number;
  open_critical_items: number;
  exception_items: number;
  handover_count: number;
  execution_percentage: number;
  has_exception_pressure: boolean;
}

export interface DashboardAttentionItem {
  id: string;
  title: string;
  detail: string;
  tone: 'warning' | 'critical' | 'network-down' | 'network-degraded';
}

export interface DashboardHandoverFeedItem {
  id: string;
  shift: DashboardShiftName;
  count: number;
}

export interface DashboardOperationalDay {
  checklist_date: string;
  window_start: string;
  window_end: string;
  timezone: string;
  boundary_time: string;
}

export interface OperationalDashboardSummary {
  operational_day: DashboardOperationalDay;
  command_metrics: DashboardCommandMetrics;
  shift_cards: DashboardShiftCard[];
  checklist_threads: DashboardChecklistThread[];
  attention_queue: DashboardAttentionItem[];
  handover_feed: DashboardHandoverFeedItem[];
  notifications_unread: number;
  generated_at: string;
}

class ChecklistApi {
    async deleteInstance(instanceId: string): Promise<{ message: string; effects?: any }> {
      const response = await api.delete<{ message: string; effects?: any }>(`/api/v1/checklists/instances/${instanceId}`);
      return response.data;
    }
  // Templates
  async getTemplates(params?: { shift?: string; sectionId?: string }): Promise<ChecklistTemplate[]> {
    const queryParams: Record<string, string> = {};
    if (params?.shift) queryParams.shift = params.shift;
    if (params?.sectionId) queryParams.section_id = params.sectionId;
    const response = await api.get<ChecklistTemplate[]>('/api/v1/checklists/templates', { params: queryParams });
    return response.data;
  }

  async getTemplate(templateId: string): Promise<ChecklistTemplate> {
    const response = await api.get<ChecklistTemplate>(`/api/v1/checklists/templates/${templateId}`);
    return response.data;
  }

  async createTemplate(data: CreateChecklistTemplateRequest): Promise<TemplateMutationResponse> {
    const response = await api.post<TemplateMutationResponse>('/api/v1/checklists/templates', data);
    return response.data;
  }

  async updateTemplate(templateId: string, data: UpdateChecklistTemplateRequest): Promise<TemplateMutationResponse> {
    const response = await api.put<TemplateMutationResponse>(`/api/v1/checklists/templates/${templateId}`, data);
    return response.data;
  }

  async deleteTemplate(templateId: string): Promise<TemplateMutationResponse> {
    const response = await api.delete<TemplateMutationResponse>(`/api/v1/checklists/templates/${templateId}`);
    return response.data;
  }

  async addTemplateItem(templateId: string, data: CreateTemplateItemRequest): Promise<TemplateMutationResponse> {
    const response = await api.post<TemplateMutationResponse>(`/api/v1/checklists/templates/${templateId}/items`, data);
    return response.data;
  }

  async addTemplateSubitem(
    templateId: string,
    itemId: string,
    data: CreateTemplateSubitemRequest
  ): Promise<TemplateMutationResponse> {
    const response = await api.post<TemplateMutationResponse>(
      `/api/v1/checklists/templates/${templateId}/items/${itemId}/subitems`,
      data
    );
    return response.data;
  }

  // Instances
  async createInstance(data: CreateChecklistInstanceRequest): Promise<ChecklistInstance> {
    console.log('🚀 Creating checklist instance with payload:', data);
    console.log('🎯 Target endpoint: POST /api/v1/checklists/instances');
    
    const response = await api.post<any>('/api/v1/checklists/instances', data);
    
    console.log('📥 Raw API response:', response);
    console.log('📥 Response data:', response.data);
    console.log('📥 Response status:', response.status);
    
    // Extract instance from response - handle both array and nested object formats
    let instance: ChecklistInstance;
    if (Array.isArray(response.data)) {
      instance = response.data[0];
    } else if (response.data?.instance) {
      instance = response.data.instance;
    } else {
      instance = response.data as ChecklistInstance;
    }
    
    console.log('✅ Extracted instance:', instance);
    console.log('✅ Instance ID:', instance?.id);
    console.log('✅ Instance ID type:', typeof instance?.id);
    
    if (!instance || !instance.id) {
      console.error('❌ Invalid instance response - missing id property');
      throw new Error('Invalid instance response: missing id');
    }
    
    return instance;
  }

  async getTodayInstances(): Promise<ChecklistInstance[]> {
    const response = await api.get<ChecklistInstance[]>('/api/v1/checklists/instances/today');
    return response.data;
  }

  async getTodayChecklistCoverage(): Promise<TodayChecklistCoverage> {
    const response = await api.get<TodayChecklistCoverage>('/api/v1/checklists/instances/today/coverage');
    return response.data;
  }

  async getAllInstances(startDate?: string, endDate?: string, shift?: string): Promise<ChecklistInstance[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (shift) params.append('shift', shift);
    
    const response = await api.get<ChecklistInstance[]>(`/api/v1/checklists/instances?${params.toString()}`);
    return response.data;
  }

  async getInstancesPaginated(params: ChecklistInstanceQueryParams): Promise<PaginatedResponse<ChecklistInstance>> {
    const searchParams = new URLSearchParams();
    
    if (params.start_date) searchParams.append('start_date', params.start_date);
    if (params.end_date) searchParams.append('end_date', params.end_date);
    if (params.shift) searchParams.append('shift', params.shift);
    if (params.status) searchParams.append('status', params.status);
    if (params.search) searchParams.append('search', params.search);
    if (params.page) searchParams.append('page', params.page.toString());
    if (params.limit) searchParams.append('limit', params.limit.toString());
    if (params.sort_by) searchParams.append('sort_by', params.sort_by);
    if (params.sort_order) searchParams.append('sort_order', params.sort_order);
    
    const response = await api.get<PaginatedResponse<ChecklistInstance> | BackendPaginatedResponse<ChecklistInstance>>(
      `/api/v1/checklists/instances/paginated?${searchParams.toString()}`
    );
    const payload: any = response.data;

    if (Array.isArray(payload?.data) && payload?.pagination) {
      return payload as PaginatedResponse<ChecklistInstance>;
    }

    return {
      data: Array.isArray(payload?.items) ? payload.items : [],
      pagination: {
        page: payload?.page || 1,
        limit: params.limit || (Array.isArray(payload?.items) ? payload.items.length : 0),
        total: payload?.total || 0,
        totalPages: payload?.pages || 1,
        hasNext: Boolean(payload?.has_next),
        hasPrev: Boolean(payload?.has_prev),
      },
    };
  }

  async getInstance(id: string): Promise<ChecklistInstance> {
    if (!id || id === 'undefined') {
      throw new Error(`Invalid instance ID: ${id}`);
    }
    const response = await api.get<ChecklistInstance>(`/api/v1/checklists/instances/${id}`);
    const instance = response.data;
    // Normalize activities for all items
    if (instance && Array.isArray(instance.items)) {
      instance.items = instance.items.map(item => ({
        ...item,
        activities: Array.isArray(item.activities)
          ? item.activities.map((activity: any) => ({
              id: activity.id,
              action: activity.action,
              actor: activity.user || activity.actor || { id: 'system', username: 'system' },
              timestamp: activity.created_at || activity.timestamp,
              notes: activity.comment || activity.notes || '',
              metadata: activity.metadata || {},
            }))
          : [],
      }));
    }
    return instance;
  }

  async joinInstance(instanceId: string): Promise<ChecklistInstance> {
    const response = await api.post<{instance: ChecklistInstance, effects: any}>(`/api/v1/checklists/instances/${instanceId}/join`);
    return response.data.instance; // Extract the instance from the response
  }

  async completeInstance(instanceId: string, withExceptions: boolean = false): Promise<ChecklistInstance> {
    void withExceptions; // Legacy compatibility; backend derives the final outcome from checklist evidence.
    const response = await api.post<{instance: ChecklistInstance, effects: any}>(`/api/v1/checklists/instances/${instanceId}/complete`);
    return response.data.instance; // Extract the instance from the response
  }

  async changeInstanceDate(instanceId: string, targetDate: string): Promise<ChecklistDateChangeResponse> {
    const response = await api.post<ChecklistDateChangeResponse>(
      `/api/v1/checklists/instances/${instanceId}/change-date`,
      { target_date: targetDate }
    );
    return response.data;
  }

  // Items
  async updateItemStatus(
    instanceId: string,
    itemId: string,
    data: UpdateChecklistItemRequest
  ): Promise<ChecklistInstance> {
    const response = await api.patch<{instance: ChecklistInstance, effects: any}>(
      `/api/v1/checklists/instances/${instanceId}/items/${itemId}`,
      data
    );
    // Return the full instance (source-of-truth) so callers can refresh local state
    return response.data.instance;
  }

  async startItemWork(
    instanceId: string,
    itemId: string,
    comment?: string
  ): Promise<{
    item_id: string;
    item_title: string;
    item_status: 'IN_PROGRESS';
    has_subitems: boolean;
    subitems: any[];
    next_subitem: any | null;
    subitem_count: number;
    completed_subitem_count: number;
    subitem_status?: string | null;
  }> {
    const response = await api.post(
      `/api/v1/checklists/instances/${instanceId}/items/${itemId}/start-work`,
      comment ? { comment } : undefined
    );
    return response.data;
  }

  // Subitems
  async updateSubitemStatus(
    instanceId: string,
    itemId: string,
    subitemId: string,
    data: {
      status: string;
      reason?: string;
      comment?: string;
    }
  ): Promise<void> {
    // Make the subitem update call
    await api.patch(
      `/api/v1/checklists/instances/${instanceId}/items/${itemId}/subitems/${subitemId}`,
      data
    );
    
    // Don't fetch instance immediately - let the context handle it
    // This prevents race conditions and allows the backend to process the update
  }

  // Handover Notes
  async createHandoverNote(data: CreateHandoverNoteRequest): Promise<BackendHandoverNote> {
    const response = await api.post<BackendHandoverNote>('/api/v1/checklists/handover-notes', data);
    return response.data;
  }

  // Performance
  async getPerformanceMetrics(startDate?: string, endDate?: string): Promise<BackendPerformanceMetrics> {
    const response = await api.get<BackendPerformanceMetrics>('/api/v1/checklists/performance/metrics', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  async getDashboardSummary(): Promise<OperationalDashboardSummary> {
    const response = await api.get<OperationalDashboardSummary>('/api/v1/checklists/dashboard/summary');
    return response.data;
  }

  // Gamification
  async getGamificationDashboard(): Promise<GamificationDashboard> {
    const response = await api.get<GamificationDashboard>('/api/v1/gamification/dashboard');
    return response.data;
  }

  async getLeaderboard(timeframe: string = 'weekly', limit: number = 10): Promise<LeaderboardResponse> {
    // Accept both short form ('week','month','quarter') and API expected values
    const tfMap: Record<string, string> = {
      week: 'weekly',
      month: 'monthly',
      quarter: 'quarterly',
      daily: 'daily',
      weekly: 'weekly',
      monthly: 'monthly',
      quarterly: 'quarterly'
    };
    const apiTimeframe = tfMap[timeframe] || timeframe;
    const response = await api.get<LeaderboardResponse>('/api/v1/gamification/leaderboard', {
      params: { timeframe: apiTimeframe, limit }
    });
    return response.data;
  }

  async getUserScores(startDate?: string, endDate?: string): Promise<UserScoresResponse> {
    const response = await api.get<UserScoresResponse>('/api/v1/gamification/scores', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  // Notifications
  async getNotifications(unreadOnly: boolean = true): Promise<Notification[]> {
    const response = await api.get<Notification[] | { notifications?: Notification[]; results?: Notification[]; data?: Notification[] }>(
      '/api/v1/notifications/',
      {
        // Send both naming conventions for compatibility with older/newer backends.
        params: { unread_only: unreadOnly, unreadOnly, include_read: !unreadOnly }
      }
    );

    const payload = response.data;
    const notifications = Array.isArray(payload)
      ? payload
      : payload?.notifications || payload?.results || payload?.data || [];

    // Safety guard: even if backend ignores query params, keep unread-only contract.
    if (!unreadOnly) {
      return notifications;
    }

    return notifications.filter((n: any) => !(n?.is_read ?? n?.read ?? n?.isRead));
  }

  async markNotificationAsRead(notificationId: string): Promise<Notification> {
    const response = await api.patch<Notification>(`/api/v1/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead(): Promise<{ updated: number }> {
    const response = await api.post<{ updated: number }>('/api/v1/notifications/mark-all-read');
    return response.data;
  }
}

export const checklistApi = new ChecklistApi();
