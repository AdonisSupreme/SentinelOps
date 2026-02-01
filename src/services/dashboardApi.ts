// src/services/dashboardApi.ts
import api from './api';

export interface WeeklyStats {
  growth: number[];
  total: number[];
  labels: string[];
  updated_at?: string;
  version?: number;
}

export interface PredictionStats {
  daysRemaining: number;
  dailyGrowthRateGb: number;
  currentUsedGb: number;
  totalCapacityGb: number;
  predictedFullDate: string;
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  updated_at?: string;
  version?: number;
}

export interface DerivedMetrics {
  usage_percentage: number;
  remaining_capacity_gb: number;
  average_daily_growth: number;
}

export interface DashboardSummary {
  weekly_growth: WeeklyStats;
  prediction: PredictionStats;
  derived_metrics: DerivedMetrics;
  timestamp: string;
}

export interface DashboardStatsResponse {
  success: boolean;
  data: {
    weekly_growth: WeeklyStats;
    prediction: PredictionStats;
    derived_metrics: DerivedMetrics;
    timestamp: string;
  };
  timestamp: string;
}

export interface WeeklyStatsResponse {
  success: boolean;
  data: WeeklyStats;
  timestamp: string;
}

export interface PredictionStatsResponse {
  success: boolean;
  data: PredictionStats;
  timestamp: string;
}

export interface DashboardHealth {
  success: boolean;
  sources: {
    weekly: boolean;
    prediction: boolean;
  };
  last_updated: string;
}

export const dashboardApi = {
  // Get complete dashboard summary
  async getDashboardStats(): Promise<DashboardSummary> {
    const response = await api.get<DashboardStatsResponse>('/api/v1/dashboard/stats');
    return response.data.data;
  },

  // Get weekly growth stats only
  async getWeeklyStats(): Promise<WeeklyStats> {
    const response = await api.get<WeeklyStatsResponse>('/api/v1/dashboard/weekly');
    return response.data.data;
  },

  // Get prediction stats only
  async getPredictionStats(): Promise<PredictionStats> {
    const response = await api.get<PredictionStatsResponse>('/api/v1/dashboard/prediction');
    return response.data.data;
  },

  // Get dashboard health/sources status
  async getDashboardHealth(): Promise<DashboardHealth> {
    const response = await api.get<DashboardHealth>('/api/v1/dashboard/health');
    return response.data;
  },

  // Manually trigger sync
  async syncDashboardData(): Promise<{ success: boolean; message: string }> {
    const response = await api.post('/api/v1/dashboard/sync');
    return response.data;
  }
};
