/**
 * Advanced Shift Scheduling API Service
 */
import api from './api';

export interface ShiftPattern {
  id: string;
  name: string;
  description: string;
  pattern_type: 'FIXED' | 'ROTATING' | 'CUSTOM';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PatternSchedule {
  id: string;
  name: string;
  pattern_type: string;
  metadata: Record<string, unknown>;
  schedule: {
    [day: string]: {
      shift_id?: number;
      shift_name?: string;
      start_time?: string;
      end_time?: string;
      color?: string;
      off_day?: boolean;
    };
  };
}

export interface UserScheduleDay {
  date: string;
  type: 'SHIFT' | 'OFF_DAY' | 'UNSCHEDULED';
  shift_id?: string;
  shift_name?: string;
  start_time?: string;
  end_time?: string;
  color?: string;
  reason?: string;
  status?: string;
}

export interface UserSchedule {
  user_id: string;
  start_date: string;
  end_date: string;
  schedule: UserScheduleDay[];
}

class ShiftSchedulingApi {
  async listShiftPatterns(sectionId?: string): Promise<ShiftPattern[]> {
    const params: Record<string, any> = {};
    if (sectionId) params.section_id = sectionId;
    const response = await api.get<ShiftPattern[]>('/api/v1/checklists/shift-patterns', {
      params,
    });
    return response.data;
  }

  async getPatternDetails(patternId: string): Promise<PatternSchedule> {
    const response = await api.get<PatternSchedule>(
      `/api/v1/checklists/shift-patterns/${patternId}`
    );
    return response.data;
  }

  async bulkAssignShifts(payload: {
    users: string[];
    pattern_id: string;
    start_date: string;
    end_date?: string;
    section_id: string;
  }): Promise<{
    success: boolean;
    assignments_created: number;
    errors: string[];
    message: string;
  }> {
    const response = await api.post<any>(
      '/api/v1/checklists/bulk-assign-shifts',
      payload
    );
    return response.data;
  }

  async registerDaysOff(payload: {
    user_id: string;
    start_date: string;
    end_date: string;
    reason: string;
    approved?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    status: 'APPROVED' | 'PENDING';
  }> {
    const response = await api.post<any>(
      '/api/v1/checklists/days-off',
      payload
    );
    return response.data;
  }

  async setShiftException(payload: {
    user_id: string;
    exception_date: string;
    shift_id?: number;
    is_day_off?: boolean;
    reason?: string;
  }): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post<any>(
      '/api/v1/checklists/shift-exception',
      payload
    );
    return response.data;
  }

  async getUserSchedule(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<UserSchedule> {
    const response = await api.get<UserSchedule>(
      '/api/v1/checklists/my-schedule',
      { params }
    );
    return response.data;
  }
}

export const shiftSchedulingApi = new ShiftSchedulingApi();
