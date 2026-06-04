import api from './api';

export interface ApplicationTimezoneSetting {
  timezone: string;
  default_timezone: string;
  recommended_timezones: string[];
  updated_by?: string | null;
  updated_at?: string | null;
  server_utc?: string | null;
  server_local?: string | null;
}

export const appSettingsApi = {
  async getTimezone() {
    const response = await api.get<ApplicationTimezoneSetting>('/api/v1/app-settings/timezone');
    return response.data;
  },

  async updateTimezone(timezone: string) {
    const response = await api.put<ApplicationTimezoneSetting>('/api/v1/app-settings/timezone', { timezone });
    return response.data;
  },
};

export default appSettingsApi;
