import api from './api';

export interface TrustlinkRunListItem {
  id: string;
  run_date: string;
  run_type: 'manual' | 'scheduled';
  status: 'pending' | 'running' | 'success' | 'failed' | 'duplicate';
  started_at?: string | null;
  completed_at?: string | null;
  total_rows: number;
  total_duration_ms?: number;
  file_path?: string | null;
  error_message?: string | null;
}

export interface TrustlinkRunDetail extends TrustlinkRunListItem {
  triggered_by?: string | null;
  file_hash?: string | null;
  integrity_report_path?: string | null;
  idc_rows: number;
  digipay_rows: number;
  extract_duration_ms: number;
  transform_duration_ms: number;
  validation_duration_ms: number;
  total_duration_ms: number;
  created_at?: string | null;
}

export interface TrustlinkStep {
  id: number;
  run_id: string;
  step_name: 'IDC_EXTRACTION' | 'DIGIPAY_EXTRACTION' | 'TRANSFORMATION' | 'VALIDATION' | 'FILE_SAVE';
  status: 'pending' | 'running' | 'completed' | 'failed';
  row_count: number;
  duration_ms: number;
  metadata: Record<string, unknown>;
  started_at?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
}

export interface TrustlinkRunStartResponse {
  status: 'scheduled' | 'exists' | 'failed';
  run_id?: string | null;
  run_type?: 'manual' | 'scheduled';
  triggered_by?: string | null;
  file_path?: string | null;
  options?: Array<'download' | 'overwrite'>;
  detail?: string | null;
}

export interface TrustlinkTodayStatusResponse {
  status: 'none' | 'exists' | 'running';
  run?: TrustlinkRunDetail | null;
  has_file: boolean;
  options: Array<'download' | 'overwrite'>;
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' ? value as UnknownRecord : {}
);

const asString = (value: unknown, fallback = ''): string => (
  typeof value === 'string' ? value : fallback
);

const asNullableString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value : null
);

const asNumber = (value: unknown, fallback = 0): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const normalizeRunStatus = (value: unknown): TrustlinkRunListItem['status'] => {
  const status = asString(value, 'pending').toLowerCase();

  if (status === 'completed') return 'success';
  if (status === 'exists') return 'duplicate';
  if (status === 'running' || status === 'success' || status === 'failed' || status === 'duplicate') {
    return status;
  }
  return 'pending';
};

const normalizeStepStatus = (value: unknown): TrustlinkStep['status'] => {
  const status = asString(value, 'pending').toLowerCase();

  if (status === 'success') return 'completed';
  if (status === 'running' || status === 'completed' || status === 'failed') {
    return status;
  }
  return 'pending';
};

const normalizeRunType = (value: unknown): TrustlinkRunListItem['run_type'] => (
  asString(value).toLowerCase() === 'scheduled' ? 'scheduled' : 'manual'
);

const normalizeOptions = (value: unknown): Array<'download' | 'overwrite'> => {
  if (!Array.isArray(value)) return [];

  return value.filter((option): option is 'download' | 'overwrite' => (
    option === 'download' || option === 'overwrite'
  ));
};

const normalizeRunListItem = (value: unknown): TrustlinkRunListItem => {
  const item = asRecord(value);

  return {
    id: asString(item.id),
    run_date: asString(item.run_date),
    run_type: normalizeRunType(item.run_type),
    status: normalizeRunStatus(item.status),
    started_at: asNullableString(item.started_at),
    completed_at: asNullableString(item.completed_at),
    total_rows: asNumber(item.total_rows),
    total_duration_ms: asNumber(item.total_duration_ms),
    file_path: asNullableString(item.file_path),
    error_message: asNullableString(item.error_message),
  };
};

const normalizeRunDetail = (value: unknown): TrustlinkRunDetail => {
  const detail = asRecord(value);
  const item = normalizeRunListItem(detail);

  return {
    ...item,
    triggered_by: asNullableString(detail.triggered_by),
    file_hash: asNullableString(detail.file_hash),
    integrity_report_path: asNullableString(detail.integrity_report_path),
    idc_rows: asNumber(detail.idc_rows),
    digipay_rows: asNumber(detail.digipay_rows),
    extract_duration_ms: asNumber(detail.extract_duration_ms),
    transform_duration_ms: asNumber(detail.transform_duration_ms),
    validation_duration_ms: asNumber(detail.validation_duration_ms),
    total_duration_ms: asNumber(detail.total_duration_ms),
    created_at: asNullableString(detail.created_at),
  };
};

const normalizeStep = (value: unknown): TrustlinkStep => {
  const step = asRecord(value);

  return {
    id: asNumber(step.id),
    run_id: asString(step.run_id),
    step_name: asString(step.step_name, 'VALIDATION') as TrustlinkStep['step_name'],
    status: normalizeStepStatus(step.status),
    row_count: asNumber(step.row_count),
    duration_ms: asNumber(step.duration_ms),
    metadata: asRecord(step.metadata),
    started_at: asNullableString(step.started_at),
    completed_at: asNullableString(step.completed_at),
    created_at: asNullableString(step.created_at),
  };
};

const normalizeTodayStatus = (value: unknown): TrustlinkTodayStatusResponse => {
  const payload = asRecord(value);
  const status = asString(payload.status, 'none').toLowerCase();

  return {
    status: status === 'running' || status === 'exists' ? status : 'none',
    run: payload.run ? normalizeRunDetail(payload.run) : null,
    has_file: Boolean(payload.has_file),
    options: normalizeOptions(payload.options),
  };
};

const normalizeStartResponse = (value: unknown): TrustlinkRunStartResponse => {
  const payload = asRecord(value);
  const status = asString(payload.status, 'failed').toLowerCase();

  return {
    status: status === 'scheduled' || status === 'exists' ? status : 'failed',
    run_id: asNullableString(payload.run_id),
    run_type: normalizeRunType(payload.run_type),
    triggered_by: asNullableString(payload.triggered_by),
    file_path: asNullableString(payload.file_path),
    options: normalizeOptions(payload.options),
    detail: asNullableString(payload.detail),
  };
};

export const trustlinkApi = {
  async listRuns(limit = 50, offset = 0): Promise<TrustlinkRunListItem[]> {
    const response = await api.get('/api/v1/trustlink/runs', {
      params: { limit, offset },
    });
    return Array.isArray(response.data) ? response.data.map(normalizeRunListItem) : [];
  },

  async runNow(force = false): Promise<TrustlinkRunStartResponse> {
    const response = await api.post('/api/v1/trustlink/run', {
      run_type: 'manual',
      force,
    });
    return normalizeStartResponse(response.data);
  },

  async overwriteRun(): Promise<TrustlinkRunStartResponse> {
    const response = await api.post('/api/v1/trustlink/run/overwrite');
    return normalizeStartResponse(response.data);
  },

  async getRunDetails(runId: string): Promise<TrustlinkRunDetail> {
    const response = await api.get(`/api/v1/trustlink/runs/${runId}`);
    return normalizeRunDetail(response.data);
  },

  async getRunSteps(runId: string): Promise<TrustlinkStep[]> {
    const response = await api.get(`/api/v1/trustlink/runs/${runId}/steps`);
    return Array.isArray(response.data) ? response.data.map(normalizeStep) : [];
  },

  async getTodayStatus(): Promise<TrustlinkTodayStatusResponse> {
    const response = await api.get('/api/v1/trustlink/runs/today');
    return normalizeTodayStatus(response.data);
  },

  async downloadRunFile(runId: string): Promise<void> {
    const response = await api.get(`/api/v1/trustlink/download/${runId}`, {
      responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/octet-stream' });
    const fallbackName = `STPLINK_AGRI_ACC_${runId}`;
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

  getDownloadUrl(runId: string): string {
    const base = (api.defaults.baseURL || '').replace(/\/$/, '');
    return `${base}/api/v1/trustlink/download/${runId}`;
  },
};

export default trustlinkApi;
