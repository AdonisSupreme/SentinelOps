import api from './api';

export type NetworkStatus = 'UNKNOWN' | 'UP' | 'DEGRADED' | 'DOWN';

export interface NetworkService {
  id: string;
  name: string;
  address: string;
  port: number | null;
  enabled: boolean;
  check_icmp: boolean;
  check_tcp: boolean;
  timeout_ms: number;
  interval_seconds: number;
  environment?: string | null;
  group_name?: string | null;
  owner_team?: string | null;
  tags: string[];
  color?: string | null;
  icon?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  status?: {
    last_checked_at: string | null;
    icmp_up: boolean | null;
    icmp_bytes: number | null;
    icmp_latency_ms: number | null;
    icmp_ttl: number | null;
    tcp_up: boolean | null;
    tcp_latency_ms: number | null;
    overall_status: NetworkStatus;
    reason: string | null;
    consecutive_failures: number;
    last_state_change_at: string | null;
  } | null;
}

export interface NetworkOutage {
  id: string;
  service_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  cause: string;
  details?: Record<string, unknown> | null;
}

export interface ServiceHistoryRow {
  timestamp: string;
  kind: 'UP' | 'DOWN' | 'DEGRADED' | 'OUTAGE_DETECTED' | 'RECOVERED' | 'OTHER';
  bytes?: string;
  icmp_latency?: string;
  ttl?: string;
  tcp_latency?: string;
  duration_seconds?: number;
  file?: string;
  raw: string;
}

export interface ServiceHistoryResponse {
  service_id: string;
  count: number;
  rows: ServiceHistoryRow[];
}

export const networkSentinelApi = {
  async createService(payload: Record<string, unknown>) {
    const response = await api.post('/api/v1/network-sentinel/services', payload);
    return response.data;
  },

  async listServices(params?: Record<string, string | number | boolean | undefined>) {
    const response = await api.get<NetworkService[]>('/api/v1/network-sentinel/services', { params });
    return response.data;
  },

  async health() {
    const response = await api.get('/api/v1/network-sentinel/health');
    return response.data;
  },

  async checkNow(serviceId: string) {
    const response = await api.post(`/api/v1/network-sentinel/services/${serviceId}/check-now`);
    return response.data;
  },

  async setEnabled(serviceId: string, enabled: boolean) {
    const response = await api.post(`/api/v1/network-sentinel/services/${serviceId}/enable`, undefined, {
      params: { enabled },
    });
    return response.data;
  },

  async updateService(serviceId: string, payload: Record<string, unknown>) {
    const response = await api.patch(`/api/v1/network-sentinel/services/${serviceId}`, payload);
    return response.data;
  },

  async deleteService(serviceId: string) {
    const response = await api.delete(`/api/v1/network-sentinel/services/${serviceId}`);
    return response.data;
  },

  async getOutages(params?: Record<string, string | number | boolean | undefined>) {
    const response = await api.get<NetworkOutage[]>('/api/v1/network-sentinel/outages', { params });
    return response.data;
  },

  async getHistory(
    serviceId: string,
    params?: Record<string, string | number | boolean | undefined>
  ) {
    const response = await api.get<ServiceHistoryResponse>(
      `/api/v1/network-sentinel/history/${serviceId}`,
      { params }
    );
    return response.data;
  },

  historyCsvUrl(serviceId: string, startAt?: string, endAt?: string) {
    const base = (api.defaults.baseURL || '').replace(/\/$/, '');
    const qs = new URLSearchParams({ format: 'csv' });
    if (startAt) qs.set('start_at', startAt);
    if (endAt) qs.set('end_at', endAt);
    return `${base}/api/v1/network-sentinel/history/${serviceId}?${qs.toString()}`;
  },

  async downloadHistoryCsv(serviceId: string, startAt?: string, endAt?: string) {
    const params: Record<string, string> = { format: 'csv' };
    if (startAt) params.start_at = startAt;
    if (endAt) params.end_at = endAt;

    const response = await api.get(`/api/v1/network-sentinel/history/${serviceId}`, {
      params,
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const fallbackName = `history_${serviceId}.csv`;
    const contentDisposition = response.headers?.['content-disposition'] as string | undefined;
    const matchedName = contentDisposition?.match(/filename="?([^"]+)"?/i)?.[1];
    const filename = matchedName || fallbackName;

    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  },
};

