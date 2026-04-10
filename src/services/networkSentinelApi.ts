import api from './api';

export type NetworkStatus = 'UNKNOWN' | 'UP' | 'DEGRADED' | 'DOWN';
export type NetworkEventSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface NetworkStatusSnapshot {
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
}

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
  created_at: string | null;
  updated_at: string | null;
  status?: NetworkStatusSnapshot | null;
}

export interface NetworkServiceCard extends NetworkService {
  active_outage?: {
    started_at: string;
    cause?: string | null;
    duration_seconds: number;
  } | null;
  metrics: {
    uptime_percent_24h: number | null;
    total_samples_24h: number;
    up_samples_24h: number;
    degraded_samples_24h: number;
    down_samples_24h: number;
    avg_icmp_latency_ms_24h: number | null;
    avg_tcp_latency_ms_24h: number | null;
  };
}

export interface NetworkOutage {
  id: string;
  service_id: string;
  service_name?: string | null;
  service_address?: string | null;
  service_port?: number | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  cause: string;
  details?: Record<string, unknown> | null;
}

export interface NetworkEvent {
  id: string;
  service_id: string | null;
  service_name?: string | null;
  service_address?: string | null;
  service_port?: number | null;
  category: string;
  event_type: string;
  severity: NetworkEventSeverity;
  title: string;
  summary?: string | null;
  details?: Record<string, unknown> | null;
  created_at: string | null;
}

export interface NetworkSample {
  timestamp: string | null;
  overall_status: NetworkStatus;
  icmp_up: boolean | null;
  icmp_bytes: number | null;
  icmp_latency_ms: number | null;
  icmp_ttl: number | null;
  tcp_up: boolean | null;
  tcp_latency_ms: number | null;
  reason?: string | null;
  consecutive_failures: number;
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

export interface NetworkEngineHealth {
  online: boolean;
  reason?: string | null;
  started_at?: string | null;
  last_reconcile_at?: string | null;
  last_housekeeping_at?: string | null;
  last_housekeeping_summary?: Record<string, number> | null;
  last_error?: string | null;
  active_service_workers?: number;
  checker_runtime?: {
    platform: string;
    ping_executable: string;
  };
  retention?: {
    raw_history_days: number;
    sample_history_days: number;
    event_history_days: number;
    outage_history_days: number;
    sample_interval_seconds: number;
  };
}

export interface NetworkCommandCenterOverview {
  total_services: number;
  enabled_services: number;
  up_services: number;
  degraded_services: number;
  down_services: number;
  unknown_services: number;
  impaired_services: number;
  active_incidents: number;
  fleet_pulse: number;
  average_interval_seconds: number | null;
  recent_event_count: number;
}

export interface NetworkRetentionPolicy {
  raw_history_days: number;
  sample_history_days: number;
  event_history_days: number;
  outage_history_days: number;
  sample_interval_seconds?: number;
}

export interface NetworkCommandCenterResponse {
  engine: NetworkEngineHealth;
  overview: NetworkCommandCenterOverview;
  retention: NetworkRetentionPolicy;
  services: NetworkServiceCard[];
  active_outages: NetworkOutage[];
  recent_events: NetworkEvent[];
}

export interface NetworkInvestigationResponse {
  service: NetworkServiceCard;
  metrics: {
    availability_percent_24h: number | null;
    total_samples_24h: number;
    degraded_samples_24h: number;
    down_samples_24h: number;
    avg_icmp_latency_ms_24h: number | null;
    avg_tcp_latency_ms_24h: number | null;
    outage_count_diagnostic_window: number;
  };
  samples: NetworkSample[];
  events: NetworkEvent[];
  outages: NetworkOutage[];
  raw_rows: ServiceHistoryRow[];
  retention: NetworkRetentionPolicy;
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
    const response = await api.get<NetworkEngineHealth>('/api/v1/network-sentinel/health');
    return response.data;
  },

  async getCommandCenter() {
    const response = await api.get<NetworkCommandCenterResponse>('/api/v1/network-sentinel/command-center');
    return response.data;
  },

  async getServiceInvestigation(
    serviceId: string,
    params?: Record<string, string | number | boolean | undefined>
  ) {
    const response = await api.get<NetworkInvestigationResponse>(
      `/api/v1/network-sentinel/services/${serviceId}/investigation`,
      { params }
    );
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
    const matchedName = contentDisposition?.match(/filename=\"?([^\"]+)\"?/i)?.[1];
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
