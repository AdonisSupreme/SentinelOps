/**
 * Team Management API: Shifts and Scheduled Shifts
 */
import api from './api';

export interface Shift {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  timezone: string;
  color: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ScheduledShift {
  id: string;
  shift_id: number;
  user_id: string;
  date: string;
  start_ts: string | null;
  end_ts: string | null;
  assigned_by: string | null;
  status: string;
}

class TeamApi {
  async listShifts(): Promise<Shift[]> {
    const response = await api.get<Shift[]>('/api/v1/checklists/shifts');
    return response.data;
  }

  async listScheduledShifts(params?: {
    start_date?: string;
    end_date?: string;
    section_id?: string;
  }): Promise<ScheduledShift[]> {
    const response = await api.get<ScheduledShift[]>('/api/v1/checklists/scheduled-shifts', {
      params,
    });
    return response.data;
  }

  async createScheduledShift(payload: {
    shift_id: number;
    user_id: string;
    date: string;
    start_ts?: string;
    end_ts?: string;
    status?: string;
  }): Promise<{ id: string }> {
    const response = await api.post<{ id: string }>('/api/v1/checklists/scheduled-shifts', payload);
    return response.data;
  }

  async deleteScheduledShift(id: string): Promise<{ deleted: boolean }> {
    const response = await api.delete<{ deleted: boolean }>(`/api/v1/checklists/scheduled-shifts/${id}`);
    return response.data;
  }
}

export const teamApi = new TeamApi();
