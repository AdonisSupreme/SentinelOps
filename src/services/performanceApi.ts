import api from './api';

export type PerformanceWindowKey = 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface PerformanceBreakdown {
  execution_points: number;
  reliability_points: number;
  collaboration_points: number;
  quality_points: number;
}

export interface PerformanceWindowSnapshot {
  key: PerformanceWindowKey;
  label: string;
  start_date: string;
  end_date: string;
  command_points: number;
  operational_grade: number;
  tier: string;
  rank: number;
  total_users: number;
  contribution_days: number;
  current_streak: number;
  longest_streak: number;
  items_completed: number;
  critical_items_completed: number;
  checklists_joined: number;
  clean_checklists: number;
  tasks_completed: number;
  tasks_completed_on_time: number;
  critical_tasks_completed: number;
  high_tasks_completed: number;
  collaborative_tasks_completed: number;
  handovers_created: number;
  handovers_resolved: number;
  overdue_open_tasks: number;
  task_on_time_rate: number;
  checklist_quality_rate: number;
  shift_adherence_rate: number;
  consistency_rate: number;
  summary: string;
  breakdown: PerformanceBreakdown;
}

export interface PerformanceProfile {
  user_id: string;
  username: string;
  display_name: string;
  section_name?: string | null;
  badge_count: number;
}

export interface PerformanceLeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  section_name?: string | null;
  command_points: number;
  operational_grade: number;
  rank: number;
  current_streak: number;
  tasks_completed: number;
  clean_checklists: number;
  tier: string;
  is_current_user: boolean;
}

export interface PerformanceBadge {
  key: string;
  name: string;
  icon: string;
  theme: string;
  description: string;
  hint: string;
  earned: boolean;
  claimed: boolean;
  claimable: boolean;
  progress: number;
  target: string;
  claimed_at?: string | null;
}

export interface PerformanceBadgeClaimResponse {
  badge: PerformanceBadge;
  claimed_badge_count: number;
}

export interface PerformanceTrendPoint {
  label: string;
  period_start: string;
  period_end: string;
  command_points: number;
  operational_grade: number;
  tasks_completed: number;
  checklist_items_completed: number;
  handovers_resolved: number;
}

export interface PerformanceRecentEvent {
  id: string;
  event_type: string;
  title: string;
  detail: string;
  occurred_at: string;
  points: number;
}

export interface PerformanceCommandResponse {
  generated_at: string;
  focus_window: PerformanceWindowKey;
  scope_label: string;
  profile: PerformanceProfile;
  windows: Record<PerformanceWindowKey, PerformanceWindowSnapshot>;
  active_window: PerformanceWindowSnapshot;
  leaderboard: PerformanceLeaderboardEntry[];
  badges: PerformanceBadge[];
  next_badge?: PerformanceBadge | null;
  trend: PerformanceTrendPoint[];
  recent_events: PerformanceRecentEvent[];
}

export const performanceApi = {
  async getPerformanceCommand(
    focusWindow: PerformanceWindowKey = 'monthly'
  ): Promise<PerformanceCommandResponse> {
    const response = await api.get<PerformanceCommandResponse>('/api/v1/gamification/performance/command', {
      params: { focus_window: focusWindow },
    });
    return response.data;
  },

  async claimPerformanceBadge(badgeKey: string): Promise<PerformanceBadgeClaimResponse> {
    const response = await api.post<PerformanceBadgeClaimResponse>(
      `/api/v1/gamification/performance/badges/${badgeKey}/claim`
    );
    return response.data;
  },
};
