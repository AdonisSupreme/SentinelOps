import axios from 'axios';
import { NEXUS_API_BASE_URL } from '../config/env';
import { createOperationUuid } from '../utils/operationId';

export type ClearingBatchStatus =
  | 'IMPORTED'
  | 'RECONCILING'
  | 'RECONCILED'
  | 'HAS_EXCEPTIONS'
  | 'READY_FOR_APPROVAL'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'EXECUTION_READY'
  | 'EXECUTING'
  | 'COMPLETED'
  | 'ROLLED_BACK'
  | 'BLOCKED'
  | 'FAILED'
  | 'COMMIT_UNCERTAIN';

export type ClearingReconciliationState =
  | 'NOT_RECONCILED'
  | 'STALE'
  | 'EXCLUDED'
  | 'READY'
  | 'READY_WITH_RESIDUAL'
  | 'SAFE_EXTRA_QUEUE'
  | 'SPECIAL_REVIEW'
  | 'NO_LONGER_OUTSTANDING'
  | 'BLOCKED';

export interface ClearingOverview {
  open_batches: number;
  awaiting_approval: number;
  ready_to_execute: number;
  last_activity_at?: string | null;
  latest_batch?: ClearingBatchSummary | null;
  writes_enabled: boolean;
  production_writes_enabled: boolean;
  environment: string;
  operating_window: {
    timezone: string;
    local_time: string;
    blocked: boolean;
    batch_threshold: number;
    window: string;
    message: string;
  };
  specific_record_policy: ClearingSpecificRecordPolicy;
}

export interface ClearingSelectionResult {
  batch_id: string;
  fingerprint?: string;
  selected?: boolean;
  selected_fingerprints?: string[];
  selected_count: number;
  window_limited: boolean;
  selection_limit?: number | null;
}

export interface ClearingSpecificRecordPolicy {
  policy_key: 'specific-record-clearing';
  enabled: boolean;
  updated_by: string;
  updated_at: string;
  is_admin: boolean;
  can_specific_record_clear: boolean;
}

export interface ClearingBatchSummary {
  batch_id: string;
  batch_name: string;
  finance_reference: string;
  source_filename: string;
  source_sha256: string;
  source_kind: 'FINANCE_IMPORT' | 'IDENTITY_IMPORT' | 'ACCOUNT_EXPLORER';
  status: ClearingBatchStatus;
  transaction_count: number;
  debit_account_count: number;
  total_amount: string;
  total_charge: string;
  total_debit: string;
  selected_count: number;
  reconciliation_summary: Record<string, number | string>;
  payload_hash?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  submitted_by?: string | null;
  submitted_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
}

export interface ClearingMappingEvidence {
  external_account: string;
  matches: string[];
  internal_account?: string | null;
  locator_type?: 'ACNTS_ACCOUNT' | 'ASIBGPQNP_RRN';
}

export interface ClearingBalanceResolution {
  state: 'SAFE' | 'ZERO' | 'NOT_REQUIRED' | 'SPECIAL_REVIEW' | 'BLOCKED';
  column: 'ACNTBAL_AC_UNAUTH_DB_SUM' | 'ACNTBAL_AC_DB_QUEUE_AMT' | null;
  row_id?: string | null;
  internal_account?: string | null;
  currency?: string | null;
  current?: string | null;
  delta: string;
  after?: string | null;
  residual?: boolean;
  physical_row_count?: number;
  candidate_count?: number;
  message: string;
}

export type ClearingOperationMode =
  | 'QUEUE_EXACT'
  | 'QUEUE_PARTIAL'
  | 'BALANCE_ALL'
  | 'QUEUE_ROW_ONLY'
  | 'QUEUE_AMOUNT_RESET';

export interface ClearingQueueMatch {
  row_id: string;
  internal_account: string;
  entry_date: string;
  rrn: string;
  stan: string;
  amount: string;
  charge: string;
  processing_fee: string;
  card_billing_fee: string;
  currency: string;
  transaction_currency?: string;
  account_currency?: string;
  destination_internal_account?: string;
  branch_code?: string | number | null;
  serial_number?: string | number | null;
  debit_credit_flag?: string;
  processing_code?: string;
  message_type?: string;
  terminal_id?: string;
  channel_id?: string;
  narration?: string;
}

export interface ClearingReconciliationEvidence {
  fingerprint: string;
  state: ClearingReconciliationState;
  explanation: string;
  blockers: string[];
  warnings: string[];
  from_mapping: ClearingMappingEvidence;
  destination_context?: string | null;
  currency: string;
  clear_amount: string;
  operation_mode: ClearingOperationMode;
  debit_resolution: ClearingBalanceResolution;
  queue_match?: ClearingQueueMatch | null;
  delete_queue: boolean;
  extra_queue_count: number;
}

export interface ClearingTransaction {
  fingerprint: string;
  batch_id: string;
  source_row: number;
  entry_date: string;
  from_account: string;
  source_internal_account?: string | null;
  to_account?: string;
  currency?: string | null;
  rrn: string;
  stan: string;
  amount: string;
  charge: string;
  clear_amount?: string | null;
  operation_mode: ClearingOperationMode;
  queue_row_id?: string | null;
  narration: string;
  selected: boolean;
  custody_state?: 'PENDING' | 'SEALED' | 'COMMITTED' | 'ROLLED_BACK';
  committed_execution_id?: string | null;
  committed_at?: string | null;
  reconciliation_state: ClearingReconciliationState;
  reconciliation_payload: ClearingReconciliationEvidence | Record<string, never>;
  created_at: string;
  updated_at: string;
}

export interface ClearingApproval {
  approval_id: string;
  batch_id: string;
  payload_hash: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submitted_by: string;
  submitted_at: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note: string;
}

export interface ClearingBatch extends ClearingBatchSummary {
  transactions: ClearingTransaction[];
  approvals: ClearingApproval[];
  latest_reconciliation?: {
    reconciliation_id: string;
    status: string;
    requested_by: string;
    started_at: string;
    completed_at?: string | null;
    summary: Record<string, number | string>;
    error_message?: string | null;
  } | null;
  approved_payload?: ClearingExecutionPreview | null;
  command_scope?: {
    limit: number;
    armed: number;
    committed: number;
    remaining: number;
    complete: boolean;
  };
}

export interface ClearingBalanceMutation {
  role: 'DEBIT' | 'QUEUE';
  external_account: string;
  internal_account: string;
  currency: string;
  row_id: string;
  column: string;
  before: string;
  delta: string;
  after: string;
}

export interface ClearingQueueDeletion {
  fingerprint: string;
  row_id: string;
  internal_account: string;
  entry_date: string;
  rrn: string;
  stan: string;
  amount: string;
  charge: string;
}

export interface ClearingExecutionPreview {
  batch_id: string;
  reconciliation_id?: string | null;
  status: ClearingBatchStatus;
  finance_reference: string;
  change_reference: string;
  submission_note: string;
  source_sha256: string;
  payload_hash: string;
  submitted_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  transactions: Array<{
    fingerprint: string;
    source_row: number;
    entry_date: string;
    from_account: string;
    to_account: string;
    currency: string;
    rrn: string;
    stan: string;
    amount: string;
    charge: string;
    clear_amount: string;
    operation_mode: ClearingOperationMode;
    classification: ClearingReconciliationState;
  }>;
  balance_mutations: ClearingBalanceMutation[];
  queue_deletions: ClearingQueueDeletion[];
}

export interface ClearingExecution {
  execution_id: string;
  batch_id: string;
  idempotency_key: string;
  payload_hash: string;
  status:
    | 'CREATED'
    | 'PREPARING'
    | 'LOCKING'
    | 'REVALIDATING'
    | 'EXECUTING'
    | 'POST_VALIDATING'
    | 'COMMITTED'
    | 'BLOCKED'
    | 'ROLLED_BACK'
    | 'FAILED'
    | 'COMMIT_UNCERTAIN'
    | 'ROLLBACK_REQUIRED';
  requested_by: string;
  reason: string;
  error_message?: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  rollback_requested_by?: string | null;
  rollback_reason?: string | null;
  rolled_back_at?: string | null;
  approved_payload?: ClearingExecutionPreview;
  oracle_evidence?: Record<string, unknown>;
  items?: Array<{
    fingerprint: string;
    status: string;
    before_evidence: Record<string, unknown>;
    after_evidence: Record<string, unknown>;
    error_message?: string | null;
  }>;
}

export interface ClearingAuditEvent {
  audit_id: string;
  event_type: string;
  actor: string;
  actor_role?: string | null;
  batch_id?: string | null;
  reconciliation_id?: string | null;
  execution_id?: string | null;
  fingerprint?: string | null;
  occurred_at: string;
  details: Record<string, unknown>;
}

export interface ClearingAuditEvidence {
  event: ClearingAuditEvent;
  batch?: ClearingBatch | null;
  sealed_intent?: ClearingExecutionPreview | null;
  approvals: ClearingApproval[];
  reconciliation?: Record<string, unknown> | null;
  snapshots: Array<Record<string, any>>;
  execution?: ClearingExecution | null;
}

export interface ClearingAccountView {
  external_account: string;
  batch_id?: string | null;
  source: 'BATCH_SNAPSHOT' | 'LIVE_ORACLE';
  lookup_mode?: 'ACCOUNT' | 'RRN';
  lookup_value?: string;
  transactions: ClearingTransaction[];
  snapshot?: {
    snapshot_id?: string | null;
    internal_account?: string | null;
    internal_accounts?: string[];
    external_accounts?: string[];
    matched_queue_count?: number;
    account_role: 'DEBIT' | 'LIVE';
    mapping_count: number;
    balance_rows: Array<Record<string, string | number | boolean | null>>;
    queue_rows: Array<Record<string, string | number | boolean | null>>;
    account_profiles?: Array<Record<string, string | number | boolean | null>>;
    resolution: Record<string, ClearingBalanceResolution>;
    summary?: {
      physical_row_count: number;
      queue_row_count: number;
      unauthorized_debit_total: string;
      queued_amount_total: string;
      queued_fee_total: string;
      physical_queue_amount_total: string;
      orphaned_queue_amount_total: string;
      currencies: string[];
    };
    captured_at: string;
    source?: 'BATCH_SNAPSHOT' | 'LIVE_ORACLE';
  } | null;
}

const client = axios.create({ baseURL: NEXUS_API_BASE_URL });

client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

class ClearingApi {
  async overview() {
    const response = await client.get<ClearingOverview>('/api/v1/nexus/clearing/overview');
    return response.data;
  }

  async listBatches(limit = 50) {
    const response = await client.get<{ batches: ClearingBatchSummary[] }>('/api/v1/nexus/clearing/batches', {
      params: { limit },
    });
    return response.data.batches;
  }

  async getBatch(batchId: string) {
    const response = await client.get<ClearingBatch>(`/api/v1/nexus/clearing/batches/${batchId}`);
    return response.data;
  }

  async deleteBatch(batchId: string) {
    await client.delete(`/api/v1/nexus/clearing/batches/${batchId}`);
  }

  async importBatch(payload: {
    batch_name: string;
    finance_reference: string;
    filename: string;
    content_base64: string;
    identity_kind: 'ACCOUNT' | 'RRN';
  }) {
    const response = await client.post<ClearingBatch>('/api/v1/nexus/clearing/batches/import', payload);
    return response.data;
  }

  async setTransactionSelection(batchId: string, fingerprint: string, selected: boolean) {
    const response = await client.patch<ClearingSelectionResult>(
      `/api/v1/nexus/clearing/batches/${batchId}/transactions/${fingerprint}`,
      { selected },
    );
    return response.data;
  }

  async setBatchSelection(batchId: string, action: 'ARM_WINDOW' | 'DISARM_ALL') {
    const response = await client.put<ClearingSelectionResult>(
      `/api/v1/nexus/clearing/batches/${batchId}/selection`,
      { action },
    );
    return response.data;
  }

  async reconcile(batchId: string) {
    const response = await client.post<ClearingBatch>(`/api/v1/nexus/clearing/batches/${batchId}/reconcile`);
    return response.data;
  }

  async submit(batchId: string, changeReference: string, note: string) {
    const response = await client.post<ClearingBatch>(`/api/v1/nexus/clearing/batches/${batchId}/submit`, {
      change_reference: changeReference,
      note,
    });
    return response.data;
  }

  async decideApproval(batchId: string, approve: boolean, note: string) {
    const response = await client.post<ClearingBatch | ClearingExecution>(`/api/v1/nexus/clearing/batches/${batchId}/approval`, {
      approve,
      note,
      idempotency_key: approve ? `approval:${batchId}:${createOperationUuid()}` : undefined,
    });
    return response.data;
  }

  async getSpecificRecordPolicy() {
    const response = await client.get<ClearingSpecificRecordPolicy>('/api/v1/nexus/clearing/policy/specific-record');
    return response.data;
  }

  async setSpecificRecordPolicy(enabled: boolean) {
    const response = await client.patch<ClearingSpecificRecordPolicy>(
      '/api/v1/nexus/clearing/policy/specific-record',
      { enabled },
    );
    return response.data;
  }

  async getExecutionPreview(batchId: string) {
    const response = await client.get<ClearingExecutionPreview>(
      `/api/v1/nexus/clearing/batches/${batchId}/execution-preview`,
    );
    return response.data;
  }

  async listExecutions(limit = 100) {
    const response = await client.get<{ executions: ClearingExecution[] }>('/api/v1/nexus/clearing/executions', {
      params: { limit },
    });
    return response.data.executions;
  }

  async rollback(executionId: string, reason: string) {
    const response = await client.post<ClearingExecution>(
      `/api/v1/nexus/clearing/executions/${executionId}/rollback`,
      { reason },
    );
    return response.data;
  }

  async getAccount(batchId: string, externalAccount: string) {
    const response = await client.get<ClearingAccountView>(
      `/api/v1/nexus/clearing/batches/${batchId}/accounts/${externalAccount}`,
    );
    return response.data;
  }

  async inspectLiveAccount(externalAccount: string) {
    const response = await client.get<ClearingAccountView>(
      `/api/v1/nexus/clearing/accounts/${encodeURIComponent(externalAccount)}`,
    );
    return response.data;
  }

  async inspectLiveRrn(rrn: string) {
    const response = await client.get<ClearingAccountView>(
      `/api/v1/nexus/clearing/rrns/${encodeURIComponent(rrn)}`,
    );
    return response.data;
  }

  async createAccountBatch(externalAccount: string, payload: {
    balance_row_id: string;
    currency: string;
    mode: 'QUEUE_TRANSACTION' | 'ALL_UNAUTHORIZED_DEBITS' | 'QUEUE_ROW_ONLY' | 'QUEUE_AMOUNT_RESET';
    queue_row_id?: string | null;
    queue_row_ids?: string[];
    clear_amount?: string | null;
    change_reference: string;
    note: string;
  }) {
    const response = await client.post<ClearingBatch>(
      `/api/v1/nexus/clearing/accounts/${encodeURIComponent(externalAccount)}/batches`,
      payload,
    );
    return response.data;
  }

  async createRrnBatch(rrn: string, payload: {
    balance_row_id: string;
    currency: string;
    mode: 'QUEUE_TRANSACTION' | 'ALL_UNAUTHORIZED_DEBITS' | 'QUEUE_ROW_ONLY' | 'QUEUE_AMOUNT_RESET';
    queue_row_id?: string | null;
    queue_row_ids?: string[];
    clear_amount?: string | null;
    change_reference: string;
    note: string;
  }) {
    const response = await client.post<ClearingBatch>(
      `/api/v1/nexus/clearing/rrns/${encodeURIComponent(rrn)}/batches`,
      payload,
    );
    return response.data;
  }

  async listAudit(batchId?: string | null, limit = 150, search?: string) {
    const response = await client.get<{ events: ClearingAuditEvent[] }>('/api/v1/nexus/clearing/audit', {
      params: { batch_id: batchId || undefined, limit, search: search?.trim() || undefined },
    });
    return response.data.events;
  }

  async getAuditEvidence(auditId: string) {
    const response = await client.get<ClearingAuditEvidence>(
      `/api/v1/nexus/clearing/audit/${encodeURIComponent(auditId)}/evidence`,
    );
    return response.data;
  }
}

export const clearingApi = new ClearingApi();
export default clearingApi;
