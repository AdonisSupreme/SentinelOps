// src/services/checklistApi.ts
import api from './api';
import type { AxiosResponse } from 'axios';
import {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistInstance,
  ChecklistItemInstance,
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
  DashboardSummary,
  ChecklistStatePolicy,
  AuthorizationPolicy,
  BackendEffects,
  BackendError,
} from '../contracts/generated/api.types';

// Re-export generated types for convenience
export type {
  ChecklistTemplate,
  ChecklistItem,
  ChecklistInstance,
  ChecklistItemInstance,
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
  DashboardSummary,
  ChecklistStatePolicy,
  AuthorizationPolicy,
  BackendEffects,
  BackendError,
};

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

class ChecklistApi {
  // Templates
  async getTemplates(shift?: string): Promise<ChecklistTemplate[]> {
    const response = await api.get<ChecklistTemplate[]>('/api/v1/checklists/templates', { params: { shift } });
    return response.data;
  }

  // Instances
  async createInstance(data: CreateChecklistInstanceRequest): Promise<ChecklistInstance> {
    const response = await api.post<ChecklistInstance>('/api/v1/checklists/instances', data);
    return response.data;
  }

  async getTodayInstances(): Promise<ChecklistInstance[]> {
    const response = await api.get<ChecklistInstance[]>('/api/v1/checklists/instances/today');
    return response.data;
  }

  async getInstance(id: string): Promise<ChecklistInstance> {
    if (!id || id === 'undefined') {
      throw new Error(`Invalid instance ID: ${id}`);
    }
    const response = await api.get<ChecklistInstance>(`/api/v1/checklists/instances/${id}`);
    return response.data;
  }

  async joinInstance(instanceId: string): Promise<ChecklistInstance> {
    const response = await api.post<ChecklistInstance>(`/api/v1/checklists/instances/${instanceId}/join`);
    return response.data;
  }

  async completeInstance(instanceId: string): Promise<ChecklistInstance> {
    const response = await api.post<ChecklistInstance>(`/api/v1/checklists/instances/${instanceId}/complete`);
    return response.data;
  }

  // Items
  async updateItemStatus(
    instanceId: string,
    itemId: string,
    data: UpdateChecklistItemRequest
  ): Promise<ChecklistItemInstance> {
    const response = await api.patch<ChecklistItemInstance>(
      `/api/v1/checklists/instances/${instanceId}/items/${itemId}`,
      data
    );
    return response.data;
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

  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await api.get<DashboardSummary>('/api/v1/checklists/dashboard/summary');
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
  async getNotifications(unreadOnly: boolean = false): Promise<Notification[]> {
    const response = await api.get<Notification[]>('/api/v1/notifications', {
      params: { unread_only: unreadOnly }
    });
    return response.data;
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