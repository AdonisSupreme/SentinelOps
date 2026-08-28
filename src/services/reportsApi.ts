import axios from 'axios';
import { NEXUS_API_BASE_URL } from '../config/env';

export type CRBRunStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
export type CRBArtifactStatus = 'GENERATED' | 'REPLACED' | 'PURGED' | 'FAILED';

export interface CRBReportDefinition {
  report_key: 'CONTRACT_DATA' | 'INDIVIDUAL_DETAILS';
  label: string;
  view_name: string;
  field_count: number;
}

export interface CRBArtifact {
  artifact_id: string;
  run_id: string;
  report_key: CRBReportDefinition['report_key'];
  view_name: string;
  filename: string;
  status: CRBArtifactStatus;
  row_count: number;
  byte_size: number;
  sha256?: string | null;
  generated_at?: string | null;
  purged_at?: string | null;
  error_message?: string | null;
}

export interface CRBRun {
  run_id: string;
  run_day: string;
  trigger: 'SCHEDULED' | 'MANUAL';
  status: CRBRunStatus;
  requested_by: string;
  current_report?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  error_message?: string | null;
  created_at: string;
  artifacts?: CRBArtifact[];
}

export interface CRBOverview {
  business_day: string;
  schedule_time: string;
  timezone: string;
  next_schedule_at: string;
  oracle_configured: boolean;
  retention: 'CURRENT_DAY';
  latest_run?: CRBRun | null;
  current_artifacts: CRBArtifact[];
  runs: CRBRun[];
  reports: CRBReportDefinition[];
}

export type HoveringPosture = 'CLEAR' | 'MOVING' | 'STALLED' | 'OBSERVING' | 'PAUSED';
export type HoveringQueueStatus = 'PENDING' | 'AWAITING_AUTHORIZATION' | 'FAILED' | 'AUTHORIZED';

export interface HoveringCounts {
  created_count: number;
  pending_count: number;
  overdue_count: number;
  due_today_count: number;
  future_count: number;
  latest_queue_update?: string | null;
  latest_created_at?: string | null;
  oldest_pending_created?: string | null;
}

export interface HoveringMovement {
  posture: HoveringPosture;
  rate_per_hour: number;
  arrival_rate_per_hour: number;
  net_rate_per_hour: number;
  processed_count: number;
  arrived_count: number;
  net_change: number;
  last_movement_at?: string | null;
  observed_active_minutes: number;
  window_open: boolean;
  window_progress: number;
  active_hours_to_clear?: number | null;
}

export interface HoveringPolicy {
  policy_key: string;
  enabled: boolean;
  updated_by: string;
  updated_at: string;
  last_run_day?: string | null;
  last_run_at?: string | null;
  last_updated_count: number;
  last_run_status: 'NEVER' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  last_error?: string | null;
}

export interface HoveringDateAction {
  action_id: string;
  trigger: 'MANUAL' | 'SCHEDULED';
  actor: string;
  requested_ids: string[];
  updated_count: number;
  status: 'COMPLETED' | 'FAILED';
  error_message?: string | null;
  created_at: string;
}

export interface HoveringPolicyAudit {
  audit_id: string;
  previous_enabled: boolean;
  enabled: boolean;
  changed_by: string;
  changed_at: string;
}

export interface HoveringOverview {
  configured: boolean;
  source_error?: string | null;
  refreshed_at: string;
  timezone: string;
  credit_account: string;
  queue_type: string;
  window: {
    start: string;
    end: string;
    weekday_end: string;
    weekend_end: string;
    mode: 'WEEKDAY' | 'WEEKEND';
    next_start_at: string;
  };
  policy: HoveringPolicy;
  counts?: HoveringCounts | null;
  movement?: HoveringMovement | null;
  date_actions: HoveringDateAction[];
  policy_audit: HoveringPolicyAudit[];
}

export interface HoveringRecord {
  id: string;
  amount?: number | null;
  beneficiary?: string | null;
  credit_account?: string | null;
  currency?: string | null;
  debit_account?: string | null;
  description?: string | null;
  reference?: string | null;
  status?: HoveringQueueStatus | null;
  type?: string | null;
  external_reference?: string | null;
  created?: string | null;
  branch?: string | null;
  extended_type?: string | null;
  updated?: string | null;
  installment_date?: string | null;
}

export interface HoveringRecordPage {
  items: HoveringRecord[];
  page: number;
  page_size: number;
  total: number;
  pages: number;
}

export interface HoveringRecordFilters {
  page?: number;
  page_size?: number;
  status?: HoveringQueueStatus;
  lookup?: string;
  created_from?: string;
  created_to?: string;
}

export interface HoveringRobotSetting {
  id: string;
  key: string;
  created?: string | null;
  updated?: string | null;
  credential_configured: boolean;
}

export interface HoveringGeneralConfiguration {
  id: string;
  key: string;
  value: string;
  created?: string | null;
  updated?: string | null;
}

export interface HoveringSettingAction {
  action_id: string;
  setting_key: string;
  setting_kind: 'ROBOT_PASSWORD' | 'GENERAL_CONFIGURATION';
  actor: string;
  status: 'COMPLETED' | 'FAILED';
  error_message?: string | null;
  created_at: string;
}

export interface HoveringSettingsOverview {
  configured: boolean;
  encryption_configured: boolean;
  configuration_access: boolean;
  robots: HoveringRobotSetting[];
  configurations: HoveringGeneralConfiguration[];
  recent_actions: HoveringSettingAction[];
}

const client = axios.create({ baseURL: NEXUS_API_BASE_URL });

client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

class ReportsApi {
  async getCrbOverview() {
    const response = await client.get<CRBOverview>('/api/v1/nexus/reports/crb/overview');
    return response.data;
  }

  async startCrbExtraction() {
    const response = await client.post<CRBRun>('/api/v1/nexus/reports/crb/extractions');
    return response.data;
  }

  async getCrbRun(runId: string) {
    const response = await client.get<CRBRun>(`/api/v1/nexus/reports/crb/runs/${encodeURIComponent(runId)}`);
    return response.data;
  }

  async downloadCrbArtifact(artifact: CRBArtifact) {
    const response = await client.get<Blob>(
      `/api/v1/nexus/reports/crb/artifacts/${encodeURIComponent(artifact.artifact_id)}/download`,
      { responseType: 'blob' },
    );
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = artifact.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async getHoveringOverview() {
    const response = await client.get<HoveringOverview>('/api/v1/nexus/reports/hovering/overview');
    return response.data;
  }

  async getHoveringRecords(filters: HoveringRecordFilters = {}) {
    const response = await client.get<HoveringRecordPage>('/api/v1/nexus/reports/hovering/records', {
      params: filters,
    });
    return response.data;
  }

  async resolveHoveringDates(recordIds?: string[]) {
    const response = await client.post<HoveringDateAction>('/api/v1/nexus/reports/hovering/dates/resolve', {
      record_ids: recordIds?.length ? recordIds : null,
    });
    return response.data;
  }

  async setHoveringPolicy(enabled: boolean) {
    const response = await client.put<HoveringPolicy>('/api/v1/nexus/reports/hovering/policy', { enabled });
    return response.data;
  }

  async getHoveringSettings() {
    const response = await client.get<HoveringSettingsOverview>('/api/v1/nexus/reports/hovering/settings');
    return response.data;
  }

  async rotateHoveringRobotPassword(key: string, password: string) {
    const response = await client.put<HoveringRobotSetting & { custody_recorded: boolean }>(
      `/api/v1/nexus/reports/hovering/settings/robots/${encodeURIComponent(key)}/password`,
      { password },
    );
    return response.data;
  }

  async updateHoveringConfiguration(key: string, value: string) {
    const response = await client.put<HoveringGeneralConfiguration & { custody_recorded: boolean }>(
      `/api/v1/nexus/reports/hovering/settings/configurations/${encodeURIComponent(key)}`,
      { value },
    );
    return response.data;
  }
}

export const reportsApi = new ReportsApi();
export default reportsApi;
