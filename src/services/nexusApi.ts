import axios from 'axios';
import { NEXUS_API_BASE_URL } from '../config/env';

export type NexusSeverity = 'INFO' | 'WARN' | 'CRITICAL';
export type NexusRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NexusIncidentStatus = 'OPEN' | 'MONITORING' | 'AWAITING_VERDICT' | 'RESOLVED';
export type NexusRecommendationType = 'request_diagnostics' | 'create_response_task' | 'safe_restart';
export type NexusRecommendationStatus = 'recommended' | 'requested' | 'approved' | 'rejected' | 'blocked' | 'completed';
export type NexusActionStatus =
  | 'READY'
  | 'REQUESTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'BLOCKED'
  | 'MONITORING'
  | 'EFFECTIVE'
  | 'INEFFECTIVE'
  | 'ROLLED_BACK_NOT_SUPPORTED';
export type NexusDiagnosticStatus = 'READY' | 'IN_PROGRESS' | 'COMPLETED';
export type NexusCertificationStage =
  | 'catalog_only'
  | 'observe_only'
  | 'correlate_ready'
  | 'diagnostics_ready'
  | 'restart_ready';
export type NexusSyncHealth = 'idle' | 'success' | 'warning' | 'error';
export type ManagedSopStatus = 'draft' | 'needs_review' | 'approved' | 'deprecated';
export type NexusRTGSAgeLane = '0_24H' | '24_48H' | '48_72H' | '72_96H' | 'OVER_96H';
export type NexusRTGSFileState =
  | 'FOUND_ACTIVE'
  | 'FOUND_BACKUP_PRIMARY'
  | 'FOUND_BACKUP_SECONDARY'
  | 'FOUND_BOTH_MATCH'
  | 'CONFLICT'
  | 'ABSENT'
  | 'AGENT_UNREACHABLE'
  | 'CHECK_INCOMPLETE';

export interface NexusRTGSFileEvidence {
  peer_id: string;
  peer_role: string;
  location: 'ACTIVE' | 'BACKUP_PRIMARY' | 'BACKUP_SECONDARY';
  state: string;
  file_name?: string | null;
  file_path?: string | null;
  size_bytes?: number | null;
  modified_at?: string | null;
  sha256?: string | null;
  inspected_at: string;
  message?: string | null;
}

export interface NexusRTGSTransactionCase {
  transaction_id: string;
  status: string;
  entry_date: string;
  age_hours: number;
  age_lane: NexusRTGSAgeLane;
  branch_code?: string | null;
  entry_sequence?: string | null;
  message_type: string;
  queue_instance_ids: string[];
  file_state: NexusRTGSFileState;
  recommendation: string;
  files: NexusRTGSFileEvidence[];
  settlement_note: string;
  warnings: string[];
  assessed_at: string;
}

export interface NexusRTGSAssessment {
  assessment_id: string;
  trigger: 'scheduled' | 'manual';
  assessed_at: string;
  transaction_count: number;
  cases: NexusRTGSTransactionCase[];
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  message?: string | null;
}

export interface NexusRTGSSchedule {
  schedule_id: string;
  label: string;
  local_time: string;
  timezone: string;
  enabled: boolean;
  last_triggered_at?: string | null;
  created_by: string;
}

export interface NexusRTGSActionResult {
  action_id: string;
  action: 'copy' | 'regenerate';
  status: 'REQUESTED' | 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'NOOP';
  requested_by: string;
  transaction_id: string;
  message: string;
  evidence: NexusRTGSFileEvidence[];
  verification: Record<string, unknown>;
  created_at: string;
}

export interface RestartPolicy {
  allow_restart: boolean;
  requires_human_approval: boolean;
  cooldown_minutes: number;
  allowed_service_types: string[];
}

export interface DatabaseProfile {
  enabled: boolean;
  platform?: string | null;
  host?: string | null;
  database_name?: string | null;
  instance_name?: string | null;
  service_name?: string | null;
  username?: string | null;
  jdbc_url?: string | null;
  connection_type?: string | null;
  config_dir?: string | null;
  role?: string | null;
  host_group?: string | null;
  port?: number | null;
  schemas: string[];
  connection_pool?: string | null;
  max_pool_size?: number | null;
  replication_group?: string | null;
  failover_group?: string | null;
  read_only: boolean;
  shared_dependency: boolean;
  data_classification?: string | null;
  expected_evidence: string[];
  safe_diagnostics: string[];
  metadata: Record<string, unknown>;
}

export interface DatabaseDependencyProfile {
  access_mode?: string | null;
  schema_names: string[];
  operation_types: string[];
  connection_pool?: string | null;
  max_connections?: number | null;
  statement_timeout_ms?: number | null;
  expected_error_codes: string[];
  query_fingerprint_scope?: string | null;
  transactional: boolean;
  metadata: Record<string, unknown>;
}

export interface ServiceEndpointConfig {
  collector_url?: string | null;
  healthcheck_url?: string | null;
  metrics_url?: string | null;
  logs_url?: string | null;
  traces_url?: string | null;
  diagnostics_url?: string | null;
  restart_url?: string | null;
  extraction_url?: string | null;
  formatting_url?: string | null;
  shipping_url?: string | null;
  dashboard_url?: string | null;
}

export interface ServiceObservationConfig {
  network_service_id?: string | null;
  agent_id?: string | null;
  systemd_unit?: string | null;
  host_group?: string | null;
  log_selector?: string | null;
  metrics_namespace?: string | null;
  trace_service_name?: string | null;
  preferred_signal_source?: string | null;
  analysis_profile?: string | null;
  analysis_config?: Record<string, unknown>;
}

export interface ServiceCertification {
  lifecycle_stage: NexusCertificationStage;
  certified_by?: string | null;
  certified_at?: string | null;
  notes?: string | null;
}

export interface ClusterRoutingConfig {
  topology_doc_url?: string | null;
  dashboard_url?: string | null;
  collector_url?: string | null;
  extraction_url?: string | null;
  formatting_url?: string | null;
  shipping_url?: string | null;
  diagnostics_url?: string | null;
  restart_url?: string | null;
  query_url?: string | null;
  notes_url?: string | null;
}

export interface CatalogService {
  service_uuid?: string | null;
  service_id: string;
  service_name: string;
  service_type: string;
  environment: string;
  owner_team: string;
  criticality: string;
  description?: string | null;
  is_stateless: boolean;
  allow_diagnostics: boolean;
  runbook_slug?: string | null;
  tags: string[];
  cluster?: string | null;
  cluster_ids: string[];
  restart_policy: RestartPolicy;
  database_profile: DatabaseProfile;
  endpoint_config: ServiceEndpointConfig;
  observation_config: ServiceObservationConfig;
  certification: ServiceCertification;
  metadata: Record<string, unknown>;
}

export interface DependencyCluster {
  cluster_id: string;
  cluster_name: string;
  environment: string;
  owner_team: string;
  criticality: string;
  description?: string | null;
  service_ids: string[];
  entry_services: string[];
  routing_config: ClusterRoutingConfig;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface DependencyEdge {
  edge_id?: string | null;
  cluster_id?: string | null;
  from_service_id: string;
  to_service_id: string;
  dependency_type: string;
  dependency_purpose?: string | null;
  dependency_scope?: string;
  business_flow_ids?: string[];
  valid_failure_domains?: string[];
  expected_evidence?: string[];
  criticality_weight: number;
  timeout_budget_ms?: number | null;
  is_hard_dependency: boolean;
  database_access: DatabaseDependencyProfile;
  metadata: Record<string, unknown>;
}

export interface BusinessFlowStep {
  step_id?: string | null;
  step_order: number;
  service_id: string;
  service_role: string;
  required: boolean;
  expected_signal_sources: string[];
  failure_domains: string[];
  metadata: Record<string, unknown>;
}

export interface BusinessFlow {
  flow_id: string;
  flow_name: string;
  environment: string;
  owner_team: string;
  criticality: string;
  description?: string | null;
  entry_service_ids: string[];
  steps: BusinessFlowStep[];
  success_indicators: string[];
  failure_indicators: string[];
  tags: string[];
  enabled: boolean;
  correlation_window_minutes: number;
  metadata: Record<string, unknown>;
}

export interface FabricSummary {
  total_services: number;
  total_clusters: number;
  total_edges: number;
  mapped_network_services: number;
  diagnostics_ready_services: number;
  restart_ready_services: number;
  active_incidents: number;
  last_sync_at?: string | null;
  sync_health: NexusSyncHealth;
  sync_message?: string | null;
}

export interface LogSignature {
  signature_id: string;
  service_id: string;
  signature_family: string;
  error_class: string;
  exception_name?: string | null;
  timeout_type?: string | null;
  oom_flag: boolean;
  db_error_code?: string | null;
  first_seen_at: string;
  last_seen_at: string;
  count: number;
  samples: string[];
}

export interface NexusEvidence {
  evidence_id: string;
  signal_id: string;
  service_id: string;
  service_name: string;
  timestamp: string;
  evidence_class: string;
  severity: NexusSeverity;
  source: string;
  summary: string;
  raw_excerpt?: string | null;
  signature_family?: string | null;
  vantage_point?: string | null;
  observation_layer?: string | null;
  failure_domain_hint?: string | null;
  business_flow_id?: string | null;
  provenance_url?: string | null;
}

export interface RootCauseCandidate {
  service_id: string;
  service_name: string;
  score: number;
  confidence: number;
  explanation: string;
  evidence_diversity: number;
  upstream_explanation: number;
  change_proximity: number;
  flow_fit: number;
  vantage_consistency: number;
  database_fit: number;
  failure_domain?: string | null;
}

export interface ActionRecommendation {
  recommendation_id: string;
  action_type: NexusRecommendationType;
  target_service_id: string;
  target_service_name: string;
  confidence: number;
  risk: NexusRiskLevel;
  justification: string;
  requires_human_approval: boolean;
  eligible: boolean;
  blocked_reasons: string[];
  status: NexusRecommendationStatus;
}

export interface DiagnosticCommand {
  command_id: string;
  label: string;
  service_type_scope: string[];
  requires_root: boolean;
  execution_hint: string;
}

export interface DiagnosticBundle {
  bundle_id: string;
  incident_id?: string | null;
  service_id: string;
  requested_at: string;
  requested_by: string;
  status: NexusDiagnosticStatus;
  commands: DiagnosticCommand[];
  evidence_snapshot: NexusEvidence[];
  notes?: string | null;
  diagnostics_url?: string | null;
  dispatch_status?: string | null;
  command_results?: Array<Record<string, unknown>>;
}

export interface RestartExecution {
  action_execution_id: string;
  incident_id?: string | null;
  service_id: string;
  action_type: string;
  requested_at: string;
  requested_by: string;
  approved_by?: string | null;
  status: NexusActionStatus;
  justification: string;
  precheck_evidence: NexusEvidence[];
  blocked_reasons: string[];
  result_summary?: string | null;
  monitoring_until?: string | null;
  completed_at?: string | null;
  executor_url?: string | null;
  remote_execution_id?: string | null;
  metadata?: Record<string, unknown>;
}

export interface IncidentVerdict {
  feedback_id: string;
  incident_id: string;
  feedback_type: string;
  created_at: string;
  created_by: string;
  details: {
    verdict?: string;
    actual_root_service_id?: string | null;
    notes?: string | null;
    [key: string]: unknown;
  };
}

export interface TaskHandoff {
  task_id: string;
  incident_id: string;
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  route_hint: string;
  status: string;
  tags: string[];
  external_task_id?: string | null;
  assigned_to?: string | null;
  task_status?: string | null;
}

export interface NexusIncident {
  incident_id: string;
  incident_key: string;
  title: string;
  status: NexusIncidentStatus;
  start_time: string;
  end_time?: string | null;
  summary: string;
  risk_level: NexusRiskLevel;
  risk_score: number;
  business_impact_score: number;
  affected_services: string[];
  suspected_root_service?: string | null;
  suspected_root_service_name?: string | null;
  predicted_confidence: number;
  blast_radius: string[];
  cluster_ids: string[];
  business_flow_ids: string[];
  primary_business_flow_id?: string | null;
  primary_business_flow_name?: string | null;
  failure_domain: string;
  vantage_points: string[];
  data_sources: string[];
  correlation_version: string;
  root_cause_candidates: RootCauseCandidate[];
  recommendations: ActionRecommendation[];
  evidence_timeline: NexusEvidence[];
  log_signatures: LogSignature[];
  linked_tasks: TaskHandoff[];
  diagnostics: DiagnosticBundle[];
  action_executions: RestartExecution[];
  verdict?: IncidentVerdict | null;
}

export interface GraphNode {
  service_id: string;
  service_name: string;
  service_type: string;
  criticality: string;
  environment: string;
  affected: boolean;
  suspected_root: boolean;
}

export interface GraphEdge {
  edge_id?: string | null;
  cluster_id?: string | null;
  from_service_id: string;
  to_service_id: string;
  dependency_type: string;
  highlighted: boolean;
}

export interface ServiceGraphContext {
  focus_service_id: string;
  focus_service_name: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  dependents: string[];
  dependencies: string[];
  cluster_ids: string[];
}

export interface NexusLiveSignalDigest {
  signal_id: string;
  signal_type: string;
  severity: NexusSeverity;
  timestamp: string;
  source: string;
  message: string;
  vantage_point?: string | null;
  observation_layer?: string | null;
  failure_domain_hint?: string | null;
  business_flow_id?: string | null;
  signature_family?: string | null;
  attributes: Record<string, unknown>;
}

export interface NexusServiceLiveState {
  service_id: string;
  generated_at: string;
  status: {
    label: string;
    tone: string;
    detail: string;
    active_incidents: number;
    awaiting_verdict: number;
    latest_incident_id?: string | null;
  };
  agent: {
    configured_agent_id?: string | null;
    heartbeat?: Record<string, unknown> | null;
    latest_signal?: NexusLiveSignalDigest | null;
    status?: string | null;
    runtime_state?: 'running' | 'stopped' | 'unknown' | string | null;
    process_count: number;
    processes: Array<Record<string, unknown>>;
    healthcheck: Record<string, unknown>;
    host: Record<string, unknown>;
    resource_pressure: Record<string, unknown>;
    service_profile?: Record<string, unknown> | null;
    log_window?: Record<string, unknown> | null;
  };
  network: {
    network_service_id?: string | null;
    latest_signal?: NexusLiveSignalDigest | null;
    status?: string | null;
    problem_eligible: boolean;
    problem_duration_seconds?: number | null;
  };
  signals: {
    recent_total: number;
    latest: NexusLiveSignalDigest[];
    source_counts: Record<string, number>;
    severity_counts: Record<string, number>;
    vantage_counts: Record<string, number>;
  };
  dependencies: {
    outgoing: Array<Record<string, unknown>>;
    incoming: Array<Record<string, unknown>>;
  };
  diagnostics?: {
    recent_total: number;
    in_progress: number;
    completed: number;
    latest: DiagnosticBundle[];
  };
  actions?: {
    recent_total: number;
    latest: RestartExecution[];
  };
  control?: {
    certification_capabilities: Record<string, boolean>;
    readiness: Record<string, {
      ready: boolean;
      operation: string;
      control_url?: string | null;
      blocked_reasons: string[];
      service_type: string;
      lifecycle_stage: NexusCertificationStage;
      capabilities: Record<string, boolean>;
      requires_otp: boolean;
      requires_human_approval: boolean;
      cooldown_minutes: number;
    }>;
  };
}

export interface NexusServiceSignalFeed {
  service_id: string;
  service_name: string;
  generated_at: string;
  source?: string | null;
  since_hours: number;
  limit: number;
  total: number;
  returned: number;
  source_counts: Record<string, number>;
  severity_counts: Record<string, number>;
  layer_counts: Record<string, number>;
  signals: NexusLiveSignalDigest[];
}

export interface NexusLogTailLine {
  index: number;
  message: string;
  raw?: string;
  header?: string | null;
  body?: string | null;
  timestamp?: string | null;
  level?: string | null;
  severity?: NexusSeverity | string | null;
  physical_line_count?: number;
  continuation_count?: number;
}

export interface NexusServiceLogTail {
  service_id: string;
  service_name: string;
  generated_at: string;
  available: boolean;
  reason?: string | null;
  log_path?: string | null;
  owner?: Record<string, unknown>;
  file_size?: number;
  cursor?: number;
  tail_mode?: 'snapshot' | 'snapshot_rotated' | 'delta' | 'delta_truncated' | string;
  bytes_read?: number;
  max_lines?: number;
  new_line_count?: number;
  physical_line_count?: number;
  event_count?: number;
  line_grouping?: string;
  newest_first?: boolean;
  rotated?: boolean;
  truncated?: boolean;
  lines: NexusLogTailLine[];
}

export interface NexusLightAgentSummary {
  agent_id: string;
  status: 'online' | 'stale' | 'not_seen' | string;
  last_seen_at?: string | null;
  last_seen_age_seconds?: number | null;
  environment?: string | null;
  platform?: string | null;
  version?: string | null;
  host_id?: string | null;
  instance_id?: string | null;
  cluster?: string | null;
  capabilities: string[];
  heartbeat_count: number;
  configured_service_count: number;
  reporting_service_count: number;
  missing_service_ids: string[];
  unexpected_service_ids: string[];
  host: Record<string, unknown>;
  resource_pressure: Record<string, unknown>;
  command_server: Record<string, unknown>;
  services: Array<Record<string, unknown>>;
}

export type NexusServiceControlOperation = 'start' | 'stop' | 'restart';
export type RolloverEnvironmentType = 'uat' | 'dr' | 'sandbox' | 'test' | 'production_clone' | 'other';
export type RolloverAssessmentStatus = 'unknown' | 'aligned' | 'requires_rollover' | 'drift' | 'error';
export type RolloverRuleStatus = 'aligned' | 'requires_change' | 'no_match' | 'skipped' | 'error';
export type RolloverExecutionStatus = 'PENDING' | 'APPROVED' | 'COMPLETED' | 'BLOCKED' | 'FAILED' | 'NOOP';
export type RolloverReminderStatus = 'scheduled' | 'cancelled' | 'notified';

export interface NexusServiceControlChallenge {
  challenge_id: string;
  service_id: string;
  service_name: string;
  operation: NexusServiceControlOperation;
  email: string;
  expires_at: string;
  readiness: Record<string, unknown>;
  message: string;
}

export interface RolloverConnectionProfile {
  platform?: string | null;
  source_service_id?: string | null;
  username: string;
  dsn?: string | null;
  jdbc_url?: string | null;
  host?: string | null;
  port?: number | null;
  database_name?: string | null;
  instance_name?: string | null;
  sid?: string | null;
  service_name?: string | null;
  schema_name?: string | null;
  connection_type?: string | null;
  config_dir?: string | null;
  password_set: boolean;
  metadata: Record<string, unknown>;
}

export interface RolloverReplacementRule {
  rule_id: string;
  table_name: string;
  column_name: string;
  source_value: string;
  target_value: string;
  description?: string | null;
  enabled: boolean;
  sequence: number;
  metadata: Record<string, unknown>;
}

export interface RolloverEnvironment {
  environment_id: string;
  environment_name: string;
  environment_type: RolloverEnvironmentType;
  service_environment?: string | null;
  owner_team?: string | null;
  enabled: boolean;
  connection: RolloverConnectionProfile;
  rules: RolloverReplacementRule[];
  notes?: string | null;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  metadata: Record<string, unknown>;
}

export interface RolloverEnvironmentPayload extends RolloverEnvironment {
  credential_password?: string | null;
}

export interface RolloverRuleAssessment {
  rule_id: string;
  table_name: string;
  column_name: string;
  source_value: string;
  target_value: string;
  status: RolloverRuleStatus;
  source_matches: number;
  target_matches: number;
  rows_affected: number;
  sample_values: string[];
  generated_sql?: string | null;
  message?: string | null;
}

export interface RolloverAssessment {
  assessment_id: string;
  environment_id: string;
  environment_name: string;
  status: RolloverAssessmentStatus;
  assessed_at: string;
  assessed_by?: string | null;
  connected: boolean;
  rules_checked: number;
  rules_requiring_change: number;
  rules_aligned: number;
  rules_with_no_match: number;
  rule_results: RolloverRuleAssessment[];
  message?: string | null;
  metadata: Record<string, unknown>;
}

export interface DatabaseConnectionTestResult {
  test_id: string;
  scope: 'database_fabric' | 'rollover';
  target_id: string;
  target_name: string;
  platform: string;
  status: 'success' | 'failed';
  connected: boolean;
  tested_at: string;
  tested_by?: string | null;
  latency_ms?: number | null;
  driver?: string | null;
  connection_type?: string | null;
  message: string;
  metadata: Record<string, unknown>;
}

export interface RolloverChallenge {
  challenge_id: string;
  environment_id: string;
  environment_name: string;
  email: string;
  expires_at: string;
  readiness: Record<string, unknown>;
  message: string;
}

export interface RolloverExecution {
  execution_id: string;
  environment_id: string;
  environment_name: string;
  status: RolloverExecutionStatus;
  requested_at: string;
  requested_by: string;
  approved_by?: string | null;
  reason?: string | null;
  pre_assessment?: RolloverAssessment | null;
  post_assessment?: RolloverAssessment | null;
  rule_results: RolloverRuleAssessment[];
  committed: boolean;
  completed_at?: string | null;
  blocked_reasons: string[];
  result_summary?: string | null;
  metadata: Record<string, unknown>;
}

export interface RolloverReminder {
  reminder_id: string;
  environment_id: string;
  environment_name: string;
  scheduled_for: string;
  timezone: string;
  status: RolloverReminderStatus;
  notify_recipients: string[];
  notes?: string | null;
  created_at: string;
  created_by: string;
  metadata: Record<string, unknown>;
}

export interface ProcedureCitation {
  sop_id: string;
  title: string;
  section: string;
  excerpt: string;
  score: number;
  source_path: string;
}

export interface ProcedureEvidence {
  sop_id: string;
  title: string;
  class_code: string;
  score: number;
  sections: string[];
  excerpts: string[];
  alignment_status: string;
}

export interface ProcedureGuidanceResponse {
  answer: string;
  confidence: number;
  citations: ProcedureCitation[];
  recommended_next_steps: string[];
  retrieved_sops: ProcedureEvidence[];
  warnings: string[];
  trace_id: string;
  trace?: Record<string, unknown> | null;
}

export interface ProcedureGuidanceRequest {
  query: string;
  user_context?: {
    user_id?: string | null;
    username?: string | null;
    role?: string | null;
    shift?: string | null;
    department?: string | null;
  };
  system_context?: {
    environment?: string | null;
    affected_systems?: string[];
    urgency?: string | null;
    incident_id?: string | null;
  };
  scope?: string;
  stream?: boolean;
  trace?: boolean;
}

export interface ManagedSopValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  checked_at?: string | null;
  checked_by?: string | null;
}

export interface ManagedSop {
  sop_id: string;
  title: string;
  class_code: string;
  severity: string;
  status: ManagedSopStatus;
  version: number;
  owner_team?: string | null;
  services: string[];
  environments: string[];
  aliases: string[];
  tags: string[];
  content: Record<string, string[]>;
  validation: ManagedSopValidation;
  created_at: string;
  updated_at: string;
  updated_by?: string | null;
  metadata: Record<string, unknown>;
}

export interface IndexedSop {
  sop_id: string;
  title: string;
  class_code: string;
  severity: string;
  version: number;
  services: string[];
  environments: string[];
  aliases: string[];
  systems: string[];
  owners: string[];
  source_sections: string[];
  content: Record<string, string[]>;
  alignment_status: string[];
  last_verified_at?: string | null;
  source_path: string;
  source_directory?: string | null;
  source_format?: string | null;
  chunk_count: number;
  managed: boolean;
}

export interface IndexedSopResponse {
  sops: IndexedSop[];
  summary: {
    indexed: number;
    chunks: number;
  };
}

export interface ServiceTimelineChatMessage {
  role: 'operator' | 'nexus';
  content: string;
  created_at?: string | null;
}

export interface ServiceTimelineChatResponse {
  answer: string;
  confidence: number;
  trace_id: string;
  llm_used: boolean;
  suggestions: string[];
  facts: Record<string, unknown>;
}

export interface NexusAgentTokenStatus {
  configured: boolean;
  source: string;
  token_id?: string | null;
  token_prefix?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  last_used_at?: string | null;
  usage_count: number;
  warning?: string | null;
}

export interface NexusAgentTokenGenerateResponse extends NexusAgentTokenStatus {
  token: string;
  rotated: boolean;
}

const nexusApiClient = axios.create({
  baseURL: NEXUS_API_BASE_URL,
});

let nexusUnauthorizedDispatched = false;

nexusApiClient.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    nexusUnauthorizedDispatched = false;
  } else {
    delete config.headers.Authorization;
  }
  return config;
});

nexusApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('token');
      if (token && !nexusUnauthorizedDispatched) {
        nexusUnauthorizedDispatched = true;
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('unauthorized'));
      }
    }
    return Promise.reject(error);
  },
);

class NexusApi {
  async getLatestRTGSAssessment() {
    const response = await nexusApiClient.get<{ assessment: NexusRTGSAssessment | null }>('/api/v1/nexus/trustlink/rtgs/latest');
    return response.data.assessment;
  }

  async assessRTGSTransactions(requestedBy?: string) {
    const response = await nexusApiClient.post<NexusRTGSAssessment>('/api/v1/nexus/trustlink/rtgs/assess', {
      requested_by: requestedBy || null,
    });
    return response.data;
  }

  async listRTGSSchedules() {
    const response = await nexusApiClient.get<{ schedules: NexusRTGSSchedule[] }>('/api/v1/nexus/trustlink/rtgs/schedules');
    return response.data.schedules;
  }

  async createRTGSSchedule(payload: { label: string; local_time: string; timezone: string; enabled: boolean }) {
    const response = await nexusApiClient.post<NexusRTGSSchedule>('/api/v1/nexus/trustlink/rtgs/schedules', payload);
    return response.data;
  }

  async updateRTGSSchedule(scheduleId: string, payload: { label: string; local_time: string; timezone: string; enabled: boolean }) {
    const response = await nexusApiClient.put<NexusRTGSSchedule>(`/api/v1/nexus/trustlink/rtgs/schedules/${scheduleId}`, payload);
    return response.data;
  }

  async deleteRTGSSchedule(scheduleId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/trustlink/rtgs/schedules/${scheduleId}`);
  }

  async executeRTGSAction(payload: {
    transaction_ids: string[];
    action: 'copy' | 'regenerate';
    reason: string;
    idempotency_key?: string | null;
    confirm_over_96h?: boolean;
  }) {
    const response = await nexusApiClient.post<{ results: NexusRTGSActionResult[] }>('/api/v1/nexus/trustlink/rtgs/actions', payload);
    return response.data.results;
  }

  async listIncidents() {
    const response = await nexusApiClient.get<{ incidents: NexusIncident[] }>('/api/v1/nexus/incidents');
    return response.data.incidents;
  }

  async getIncident(incidentId: string) {
    const response = await nexusApiClient.get<NexusIncident>(`/api/v1/nexus/incidents/${incidentId}`);
    return response.data;
  }

  async getGraphContext(serviceId: string) {
    const response = await nexusApiClient.get<ServiceGraphContext>(`/api/v1/nexus/services/${serviceId}/graph-context`);
    return response.data;
  }

  async getServiceLiveState(serviceId: string) {
    const response = await nexusApiClient.get<NexusServiceLiveState>(`/api/v1/nexus/services/${serviceId}/live-state`);
    return response.data;
  }

  async getServiceSignals(serviceId: string, params?: { source?: string | null; limit?: number; sinceHours?: number }) {
    const response = await nexusApiClient.get<NexusServiceSignalFeed>(`/api/v1/nexus/services/${serviceId}/signals`, {
      params: {
        source: params?.source || undefined,
        limit: params?.limit,
        since_hours: params?.sinceHours,
      },
    });
    return response.data;
  }

  async getServiceLogTail(serviceId: string, lines = 120, cursor?: number | null) {
    const response = await nexusApiClient.get<NexusServiceLogTail>(`/api/v1/nexus/services/${serviceId}/log-tail`, {
      params: { lines, cursor: cursor ?? undefined },
    });
    return response.data;
  }

  async listLightAgents() {
    const response = await nexusApiClient.get<{ agents: NexusLightAgentSummary[] }>('/api/v1/nexus/agents');
    return response.data.agents;
  }

  async askServiceTimeline(serviceId: string, question: string, history: ServiceTimelineChatMessage[], timezone?: string) {
    const response = await nexusApiClient.post<ServiceTimelineChatResponse>(`/api/v1/nexus/services/${serviceId}/timeline-chat`, {
      question,
      history,
      timezone,
    });
    return response.data;
  }

  async getFabricSummary() {
    const response = await nexusApiClient.get<FabricSummary>('/api/v1/nexus/fabric-summary');
    return response.data;
  }

  async getAgentTokenStatus() {
    const response = await nexusApiClient.get<NexusAgentTokenStatus>('/api/v1/nexus/agents/token');
    return response.data;
  }

  async generateAgentToken(rotate = false) {
    const response = await nexusApiClient.post<NexusAgentTokenGenerateResponse>('/api/v1/nexus/agents/token', { rotate });
    return response.data;
  }

  async syncNetworkSentinel(force = false) {
    const response = await nexusApiClient.post<FabricSummary>('/api/v1/nexus/sync/network-sentinel', { force });
    return response.data;
  }

  async listServices() {
    const response = await nexusApiClient.get<{ services: CatalogService[] }>('/api/v1/nexus/catalog/services');
    return response.data.services;
  }

  async upsertService(payload: CatalogService) {
    const response = await nexusApiClient.post<CatalogService>('/api/v1/nexus/catalog/services', payload);
    return response.data;
  }

  async deleteService(serviceId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/catalog/services/${serviceId}`);
  }

  async testDatabaseFabricConnection(serviceId: string, requestedBy: string, credentialPassword?: string, databaseProfile?: DatabaseProfile) {
    const response = await nexusApiClient.post<DatabaseConnectionTestResult>(`/api/v1/nexus/catalog/services/${serviceId}/database/test-connection`, {
      requested_by: requestedBy,
      credential_password: credentialPassword || null,
      database_profile: databaseProfile || null,
    });
    return response.data;
  }

  async listClusters() {
    const response = await nexusApiClient.get<{ clusters: DependencyCluster[] }>('/api/v1/nexus/catalog/clusters');
    return response.data.clusters;
  }

  async upsertCluster(payload: DependencyCluster) {
    const response = await nexusApiClient.post<DependencyCluster>('/api/v1/nexus/catalog/clusters', payload);
    return response.data;
  }

  async deleteCluster(clusterId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/catalog/clusters/${clusterId}`);
  }

  async listBusinessFlows() {
    const response = await nexusApiClient.get<{ business_flows: BusinessFlow[] }>('/api/v1/nexus/catalog/business-flows');
    return response.data.business_flows;
  }

  async upsertBusinessFlow(payload: BusinessFlow) {
    const response = await nexusApiClient.post<BusinessFlow>('/api/v1/nexus/catalog/business-flows', payload);
    return response.data;
  }

  async deleteBusinessFlow(flowId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/catalog/business-flows/${flowId}`);
  }

  async listDependencies() {
    const response = await nexusApiClient.get<{ dependencies: DependencyEdge[] }>('/api/v1/nexus/catalog/dependencies');
    return response.data.dependencies;
  }

  async upsertDependency(payload: DependencyEdge) {
    const response = await nexusApiClient.post<DependencyEdge>('/api/v1/nexus/catalog/dependencies', payload);
    return response.data;
  }

  async deleteDependency(edgeId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/catalog/dependencies/${edgeId}`);
  }

  async listRolloverEnvironments() {
    const response = await nexusApiClient.get<{ environments: RolloverEnvironment[] }>('/api/v1/nexus/rollover/environments');
    return response.data.environments;
  }

  async upsertRolloverEnvironment(payload: RolloverEnvironmentPayload) {
    const response = await nexusApiClient.post<RolloverEnvironment>('/api/v1/nexus/rollover/environments', payload);
    return response.data;
  }

  async deleteRolloverEnvironment(environmentId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/rollover/environments/${environmentId}`);
  }

  async getRolloverEnvironmentServices(environmentId: string) {
    const response = await nexusApiClient.get<{ services: CatalogService[] }>(`/api/v1/nexus/rollover/environments/${environmentId}/services`);
    return response.data.services;
  }

  async assessRolloverEnvironment(environmentId: string, requestedBy: string, credentialPassword?: string) {
    const response = await nexusApiClient.post<RolloverAssessment>(`/api/v1/nexus/rollover/environments/${environmentId}/assess`, {
      requested_by: requestedBy,
      credential_password: credentialPassword || null,
    });
    return response.data;
  }

  async testRolloverConnection(environmentId: string, requestedBy: string, credentialPassword?: string, rolloverConnection?: RolloverConnectionProfile) {
    const response = await nexusApiClient.post<DatabaseConnectionTestResult>(`/api/v1/nexus/rollover/environments/${environmentId}/test-connection`, {
      requested_by: requestedBy,
      credential_password: credentialPassword || null,
      rollover_connection: rolloverConnection || null,
    });
    return response.data;
  }

  async requestRolloverChallenge(environmentId: string, reason?: string) {
    const response = await nexusApiClient.post<RolloverChallenge>(`/api/v1/nexus/rollover/environments/${environmentId}/challenge`, {
      reason,
    });
    return response.data;
  }

  async executeRollover(environmentId: string, challengeId: string, otpCode: string, reason?: string) {
    const response = await nexusApiClient.post<RolloverExecution>(`/api/v1/nexus/rollover/environments/${environmentId}/execute`, {
      challenge_id: challengeId,
      otp_code: otpCode,
      reason,
    });
    return response.data;
  }

  async listRolloverExecutions(environmentId?: string | null) {
    const response = await nexusApiClient.get<{ executions: RolloverExecution[] }>('/api/v1/nexus/rollover/executions', {
      params: environmentId ? { environment_id: environmentId } : undefined,
    });
    return response.data.executions;
  }

  async listRolloverReminders(environmentId?: string | null) {
    const response = await nexusApiClient.get<{ reminders: RolloverReminder[] }>('/api/v1/nexus/rollover/reminders', {
      params: environmentId ? { environment_id: environmentId } : undefined,
    });
    return response.data.reminders;
  }

  async scheduleRolloverReminder(environmentId: string, payload: {
    scheduled_for: string;
    timezone: string;
    notify_recipients?: string[];
    notes?: string | null;
  }) {
    const response = await nexusApiClient.post<RolloverReminder>(`/api/v1/nexus/rollover/environments/${environmentId}/reminders`, payload);
    return response.data;
  }

  async cancelRolloverReminder(reminderId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/rollover/reminders/${reminderId}`);
  }

  async requestDiagnostics(incidentId: string, requestedBy: string, notes?: string) {
    const response = await nexusApiClient.post<DiagnosticBundle>(`/api/v1/nexus/incidents/${incidentId}/diagnostics`, {
      requested_by: requestedBy,
      notes,
    });
    return response.data;
  }

  async requestServiceDiagnostics(serviceId: string, requestedBy: string, notes?: string) {
    const response = await nexusApiClient.post<DiagnosticBundle>(`/api/v1/nexus/services/${serviceId}/diagnostics`, {
      requested_by: requestedBy,
      notes,
    });
    return response.data;
  }

  async requestServiceControlChallenge(serviceId: string, operation: NexusServiceControlOperation, reason?: string) {
    const response = await nexusApiClient.post<NexusServiceControlChallenge>(`/api/v1/nexus/services/${serviceId}/control/challenge`, {
      operation,
      reason,
    });
    return response.data;
  }

  async executeServiceControl(serviceId: string, operation: NexusServiceControlOperation, challengeId: string, otpCode: string, reason?: string) {
    const response = await nexusApiClient.post<RestartExecution>(`/api/v1/nexus/services/${serviceId}/control/execute`, {
      operation,
      challenge_id: challengeId,
      otp_code: otpCode,
      reason,
    });
    return response.data;
  }

  async createTaskHandoff(incidentId: string, requestedBy: string, notes?: string, assignee?: string, dueAt?: string | null) {
    const response = await nexusApiClient.post<TaskHandoff>(`/api/v1/nexus/incidents/${incidentId}/tasks`, {
      requested_by: requestedBy,
      notes,
      assignee: assignee || null,
      due_at: dueAt || null,
    });
    return response.data;
  }

  async recordVerdict(incidentId: string, requestedBy: string, verdict: string, actualRootServiceId?: string, notes?: string) {
    const response = await nexusApiClient.post<IncidentVerdict>(`/api/v1/nexus/incidents/${incidentId}/verdict`, {
      requested_by: requestedBy,
      verdict,
      actual_root_service_id: actualRootServiceId || null,
      notes,
    });
    return response.data;
  }

  async createChangeEvent(payload: {
    service_id: string;
    change_type: string;
    source: string;
    summary: string;
    metadata?: Record<string, unknown>;
    timestamp?: string | null;
  }) {
    const response = await nexusApiClient.post('/api/v1/nexus/change-events', payload);
    return response.data;
  }

  async askProcedureGuidance(requestBody: ProcedureGuidanceRequest) {
    const response = await nexusApiClient.post<ProcedureGuidanceResponse>('/api/v1/query', {
      scope: 'incident_response',
      stream: false,
      trace: false,
      ...requestBody,
    });
    return response.data;
  }

  async listManagedSops(includeDeprecated = false) {
    const response = await nexusApiClient.get<{ sops: ManagedSop[] }>('/api/v1/nexus/sops', {
      params: { include_deprecated: includeDeprecated },
    });
    return response.data.sops;
  }

  async listIndexedSops() {
    const response = await nexusApiClient.get<IndexedSopResponse>('/api/v1/nexus/sops/indexed');
    return response.data;
  }

  async upsertManagedSop(payload: ManagedSop) {
    const response = await nexusApiClient.post<ManagedSop>('/api/v1/nexus/sops', payload);
    return response.data;
  }

  async validateManagedSop(sopId: string, requestedBy: string, approveIfValid = false) {
    const response = await nexusApiClient.post<ManagedSop>(`/api/v1/nexus/sops/${sopId}/validate`, {
      requested_by: requestedBy,
      approve_if_valid: approveIfValid,
    });
    return response.data;
  }

  async deleteManagedSop(sopId: string) {
    await nexusApiClient.delete(`/api/v1/nexus/sops/${sopId}`);
  }
}

export const nexusApi = new NexusApi();
export default nexusApi;
