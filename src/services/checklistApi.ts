// src/services/checklistApi.ts
import api from './api';

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  is_active: boolean;
  version: number;
  created_at: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  item_type: 'ROUTINE' | 'TIMED' | 'SCHEDULED_EVENT' | 'CONDITIONAL' | 'INFORMATIONAL';
  is_required: boolean;
  scheduled_time: string | null;
  severity: number;
  sort_order: number;
}

export interface ChecklistInstance {
  id: string;
  template: ChecklistTemplate;
  checklist_date: string;
  shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
  shift_start: string;
  shift_end: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'COMPLETED' | 'COMPLETED_WITH_EXCEPTIONS' | 'CLOSED_BY_EXCEPTION';
  created_by: {
    id: string;
    username: string;
    email: string;
  } | null;
  closed_by: {
    id: string;
    username: string;
  } | null;
  closed_at: string | null;
  created_at: string;
  items: ChecklistItemInstance[];
  participants: {
    id: string;
    username: string;
    email: string;
    role: string;
  }[];
  statistics: {
    total_items: number;
    completed_items: number;
    completion_percentage: number;
    time_remaining_minutes: number;
  };
}

export interface ChecklistItemInstance {
  id: string;
  template_item: ChecklistItem;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  completed_by: {
    id: string;
    username: string;
  } | null;
  completed_at: string | null;
  skipped_reason: string | null;
  failure_reason: string | null;
  activities: ChecklistItemActivity[];
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

class ChecklistApi {
  // Templates
  async getTemplates(shift?: string) {
    const response = await api.get('/api/v1/checklists/templates', { params: { shift } });
    return response.data;
  }

  // Instances
  async createInstance(data: { checklist_date: string; shift: string; template_id?: string }) {
    const response = await api.post('/api/v1/checklists/instances', data);
    return response.data;
  }

  async getTodayInstances() {
    const response = await api.get('/api/v1/checklists/instances/today');
    return response.data;
  }

  async getInstance(id: string) {
    const response = await api.get(`/api/v1/checklists/instances/${id}`);
    return response.data;
  }

  async joinInstance(instanceId: string) {
    const response = await api.post(`/api/v1/checklists/instances/${instanceId}/join`);
    return response.data;
  }

  async completeInstance(instanceId: string) {
    const response = await api.post(`/api/v1/checklists/instances/${instanceId}/complete`);
    return response.data;
  }

  // Items
  async updateItemStatus(
    instanceId: string,
    itemId: string,
    data: {
      status: string;
      comment?: string;
      reason?: string;
    }
  ) {
    const response = await api.patch(
      `/api/v1/checklists/instances/${instanceId}/items/${itemId}`,
      data
    );
    return response.data;
  }

  // Handover Notes
  async createHandoverNote(data: {
    content: string;
    priority: number;
    to_shift?: string;
    to_date?: string;
  }) {
    const response = await api.post('/api/v1/checklists/handover-notes', data);
    return response.data;
  }

  // Performance
  async getPerformanceMetrics(startDate?: string, endDate?: string) {
    const response = await api.get('/api/v1/checklists/performance/metrics', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  async getDashboardSummary() {
    const response = await api.get('/api/v1/checklists/dashboard/summary');
    return response.data;
  }

  // Gamification
  async getGamificationDashboard() {
    const response = await api.get('/api/v1/gamification/dashboard');
    return response.data;
  }

  async getLeaderboard(timeframe: string = 'weekly', limit: number = 10) {
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
    const response = await api.get('/api/v1/gamification/leaderboard', {
      params: { timeframe: apiTimeframe, limit }
    });
    return response.data;
  }

  async getUserScores(startDate?: string, endDate?: string) {
    const response = await api.get('/api/v1/gamification/scores', {
      params: { start_date: startDate, end_date: endDate }
    });
    return response.data;
  }

  // Notifications
  async getNotifications(unreadOnly: boolean = false) {
    const response = await api.get('/api/v1/notifications', {
      params: { unread_only: unreadOnly }
    });
    return response.data;
  }

  async markNotificationAsRead(notificationId: string) {
    const response = await api.patch(`/api/v1/notifications/${notificationId}/read`);
    return response.data;
  }

  async markAllNotificationsAsRead() {
    const response = await api.post('/api/v1/notifications/mark-all-read');
    return response.data;
  }
}

export const checklistApi = new ChecklistApi();