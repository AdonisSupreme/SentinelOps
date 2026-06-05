import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  FaBook,
  FaBroadcastTower,
  FaCalendarAlt,
  FaCheckCircle,
  FaCloudUploadAlt,
  FaCodeBranch,
  FaCommentDots,
  FaCopy,
  FaDatabase,
  FaExclamationTriangle,
  FaKey,
  FaLink,
  FaNetworkWired,
  FaPlug,
  FaPlus,
  FaPlay,
  FaPowerOff,
  FaProjectDiagram,
  FaSearch,
  FaSave,
  FaServer,
  FaShieldAlt,
  FaSignal,
  FaSyncAlt,
  FaTasks,
  FaTimesCircle,
  FaTrashAlt,
  FaStop,
  FaTerminal,
  FaWrench,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useAuth } from '../contexts/AuthContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useNotifications } from '../contexts/NotificationContext';
import {
  formatApplicationDateBucket,
  formatDateTimeInApplicationTimeZone,
  formatRelativeFromNow,
  getApplicationDateBucket,
  parseSentinelTimestamp,
} from '../utils/time';
import nexusMark from '../assets/sentinel-nexus-mark.svg';
import nexusApi, {
  ActionRecommendation,
  BusinessFlow,
  BusinessFlowStep,
  CatalogService,
  ClusterRoutingConfig,
  DatabaseConnectionTestResult,
  DatabaseDependencyProfile,
  DatabaseProfile,
  DependencyCluster,
  DependencyEdge,
  FabricSummary,
  GraphEdge,
  GraphNode,
  IndexedSop,
  ManagedSop,
  NexusAgentTokenGenerateResponse,
  NexusAgentTokenStatus,
  NexusEvidence,
  NexusIncident,
  NexusLightAgentSummary,
  NexusRiskLevel,
  NexusServiceLogTail,
  NexusServiceControlChallenge,
  NexusServiceControlOperation,
  NexusServiceLiveState,
  NexusServiceSignalFeed,
  ProcedureGuidanceResponse,
  RolloverAssessment,
  RolloverChallenge,
  RolloverConnectionProfile,
  RolloverEnvironment,
  RolloverEnvironmentType,
  RolloverExecution,
  RolloverReminder,
  RolloverReplacementRule,
  RootCauseCandidate,
  ServiceEndpointConfig,
  ServiceGraphContext,
  ServiceObservationConfig,
  ServiceTimelineChatMessage,
  ServiceTimelineChatResponse,
} from '../services/nexusApi';
import './NexusPage.css';

const riskRank: Record<NexusRiskLevel, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

const serviceTypeOptions = ['app', 'worker', 'gateway', 'db', 'cache', 'queue', 'auth', 'channel', 'integration', 'infra'];
const dependencyTypeOptions = ['sync_api', 'async_queue', 'db', 'cache', 'infra'];
const databasePlatformOptions = ['', 'postgres', 'oracle', 'mssql', 'mysql', 'db2', 'other'];
const databaseConnectionTypeOptions = ['', 'database', 'service_name', 'sid', 'tns_alias', 'jdbc_url'];
const databaseRoleOptions = ['', 'primary', 'standby', 'replica', 'read_replica', 'oracle_service', 'rac_node', 'listener', 'schema', 'unknown'];
const databaseAccessModeOptions = ['', 'read_only', 'read_write', 'write_heavy', 'admin', 'reporting'];
const criticalityOptions = ['critical', 'high', 'medium', 'low'];
const certificationOptions = ['catalog_only', 'observe_only', 'correlate_ready', 'diagnostics_ready', 'restart_ready'];
const NEXUS_SECTION_ID = '7bd4144d-68d8-4ac3-897d-245941612daf';

type WorkspaceTab = 'incidents' | 'services' | 'agents' | 'databases' | 'rollover' | 'clusters' | 'flows' | 'dependencies' | 'sops' | 'onboarding';
type NexusDetailTab = 'overview' | 'topology' | 'evidence' | 'actions' | 'procedure' | 'outcome';
type IncidentTimelineFilter = 'all' | 'active' | 'last_1h' | 'last_5h' | 'last_12h' | 'last_24h' | string;

const displayRiskLevelForIncident = (incident: NexusIncident): NexusRiskLevel =>
  incident.status === 'AWAITING_VERDICT' ? 'LOW' : incident.risk_level;

const isOperationalImpactActive = (incident: NexusIncident) =>
  !incident.end_time && ['OPEN', 'MONITORING'].includes(incident.status);

const isPendingOperatorVerdict = (incident: NexusIncident) =>
  incident.status === 'AWAITING_VERDICT' || (!!incident.end_time && incident.status !== 'RESOLVED');

const incidentOperationalLabel = (incident: NexusIncident) => {
  if (isOperationalImpactActive(incident)) return 'Active impact';
  if (isPendingOperatorVerdict(incident)) return 'Impact ended, verdict pending';
  if (incident.status === 'RESOLVED') return 'Closed';
  return incident.status.replace(/_/g, ' ');
};

const workspaceLabels: Record<WorkspaceTab, string> = {
  incidents: 'Incidents',
  services: 'Services',
  agents: 'Light Agents',
  databases: 'Databases',
  rollover: 'Rollover',
  clusters: 'Clusters',
  flows: 'Business Flows',
  dependencies: 'Dependencies',
  sops: 'SOPs',
  onboarding: 'Onboarding',
};

const intelligenceLoop = [
  { label: 'Evidence Intake', detail: 'Obtain', signal: 'Network, agents, logs' },
  { label: 'Normalization', detail: 'Scrub', signal: 'Canonical metadata' },
  { label: 'Correlation', detail: 'Explore', signal: 'Graph and timeline' },
  { label: 'Prediction', detail: 'Model', signal: 'Risk and root cause' },
  { label: 'Operator Guidance', detail: 'iNterpret', signal: 'SOP and action path' },
];

const bootPreviewSteps = [
  'Opening SentinelOps database fabric',
  'Mapping service dependencies',
  'Normalizing logs, checks, and topology',
  'Ranking blast radius and root-cause candidates',
  'Preparing operator guidance and safe actions',
];

const NEXUS_BOOT_PREVIEW_MIN_MS = 1000;

const serviceVisuals: Record<string, { label: string; signal: string; icon: React.ReactNode }> = {
  app: { label: 'Application Runtime', signal: 'request fabric', icon: <FaServer /> },
  worker: { label: 'Worker Engine', signal: 'async execution', icon: <FaWrench /> },
  gateway: { label: 'Gateway Edge', signal: 'entry control', icon: <FaBroadcastTower /> },
  db: { label: 'Database Core', signal: 'state authority', icon: <FaDatabase /> },
  cache: { label: 'Cache Layer', signal: 'memory pulse', icon: <FaSignal /> },
  queue: { label: 'Queue Backbone', signal: 'message flow', icon: <FaTasks /> },
  auth: { label: 'Auth Trust Plane', signal: 'identity gate', icon: <FaShieldAlt /> },
  channel: { label: 'Channel Surface', signal: 'user ingress', icon: <FaNetworkWired /> },
  integration: { label: 'Integration Bridge', signal: 'system link', icon: <FaLink /> },
  infra: { label: 'Infrastructure Node', signal: 'host substrate', icon: <FaProjectDiagram /> },
};

interface CopilotTurn {
  id: string;
  question: string;
  response: ProcedureGuidanceResponse;
}

interface ServiceTimelineTurn {
  id: string;
  question: string;
  response: ServiceTimelineChatResponse;
  createdAt: string;
}

type TimelineInferencePhase = 'idle' | 'dispatch' | 'grounding' | 'inference' | 'answer';
type NexusEditorKind = 'service' | 'cluster' | 'flow' | 'edge' | 'sop' | 'rollover';
type NexusEditorDirtyState = Record<NexusEditorKind, boolean>;

const timelineInferenceSteps: Array<{ id: Exclude<TimelineInferencePhase, 'idle'>; label: string; detail: string }> = [
  { id: 'dispatch', label: 'Secure Dispatch', detail: 'Question, service, and chat memory are sealed for Nexus.' },
  { id: 'grounding', label: 'Evidence Grounding', detail: 'Timeline, incident state, graph context, and retained evidence are reconciled.' },
  { id: 'inference', label: 'Nexus Inference', detail: 'The answer is synthesized without borrowing unrelated procedures.' },
  { id: 'answer', label: 'Operator Readout', detail: 'Response is ready for review and follow-up.' },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Unknown';
  return formatDateTimeInApplicationTimeZone(value, value);
};

const formatRelativeMinutes = (value?: string | null) => {
  if (!value) return 'Unknown';
  return formatRelativeFromNow(value, value);
};

const timestampMs = (value?: string | null) => parseSentinelTimestamp(value)?.getTime() ?? 0;

const formatDurationBetween = (start?: string | null, end?: string | null) => {
  const startDate = parseSentinelTimestamp(start);
  if (!startDate) return 'Unknown';
  const endDate = parseSentinelTimestamp(end) || new Date();
  const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const totalMinutes = Math.max(1, Math.round(durationMs / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days ? `${days}d` : '',
    hours ? `${hours}h` : '',
    minutes || (!days && !hours) ? `${minutes}m` : '',
  ].filter(Boolean);
  return parts.slice(0, 2).join(' ');
};

const incidentDurationLabel = (incident: NexusIncident) =>
  `${incident.end_time ? 'Lasted' : 'Running'} ${formatDurationBetween(incident.start_time, incident.end_time)}`;

const scorePercent = (value?: number | null) => `${Math.round((value || 0) * 100)}%`;
const INCIDENT_PAGE_SIZE = 9;
const managedSopSections = ['preconditions', 'symptoms', 'checks', 'verification_steps', 'actions', 'rollback', 'escalation', 'notes'];
const managedSopClassOptions = ['A', 'B', 'C', 'D', 'E', 'F'];
const managedSopSeverityOptions = ['info', 'low', 'medium', 'high', 'critical'];
const managedSopStatusOptions = ['draft', 'needs_review', 'approved', 'deprecated'];

const createCleanEditorDirty = (): NexusEditorDirtyState => ({
  service: false,
  cluster: false,
  flow: false,
  edge: false,
  sop: false,
  rollover: false,
});

const parseListInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const stringifyObject = (value: Record<string, unknown>) => JSON.stringify(value || {}, null, 2);

const splitSectionLines = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const getIncidentActivityDate = (incident: NexusIncident) => parseSentinelTimestamp(incident.end_time || incident.start_time) || new Date(0);

const dateBucketId = (date: Date) => `date:${getApplicationDateBucket(date)}`;

const formatBucketDate = (bucketId: string) => formatApplicationDateBucket(bucketId.replace('date:', ''));

const cleanAiNarrative = (answer: string) =>
  answer
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\n-{3,}\n/g, '\n\n')
    .trim();

const splitAiNarrative = (answer: string) =>
  cleanAiNarrative(answer)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

const createEmptyManagedSop = (): ManagedSop => ({
  sop_id: '',
  title: '',
  class_code: 'A',
  severity: 'medium',
  status: 'draft',
  version: 1,
  owner_team: '',
  services: [],
  environments: [],
  aliases: [],
  tags: [],
  content: managedSopSections.reduce<Record<string, string[]>>((acc, section) => ({ ...acc, [section]: [] }), {}),
  validation: { valid: false, errors: [], warnings: [] },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  updated_by: '',
  metadata: {},
});

const getServiceTypeKey = (value?: string | null) => {
  const normalized = (value || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return serviceVisuals[normalized] ? normalized : 'app';
};

const getServiceVisual = (service: CatalogService) => serviceVisuals[getServiceTypeKey(service.service_type)];

const recommendationLabel = (value: ActionRecommendation['action_type']) => {
  switch (value) {
    case 'request_diagnostics':
      return 'Diagnostics';
    case 'create_response_task':
      return 'Task Handoff';
    case 'safe_restart':
      return 'Safe Restart';
    default:
      return value;
  }
};

const createEmptyEndpointConfig = (): ServiceEndpointConfig => ({
  collector_url: '',
  healthcheck_url: '',
  metrics_url: '',
  logs_url: '',
  traces_url: '',
  diagnostics_url: '',
  restart_url: '',
  extraction_url: '',
  formatting_url: '',
  shipping_url: '',
  dashboard_url: '',
});

const createEmptyObservationConfig = (): ServiceObservationConfig => ({
  network_service_id: '',
  agent_id: '',
  systemd_unit: '',
  host_group: '',
  log_selector: '',
  metrics_namespace: '',
  trace_service_name: '',
  preferred_signal_source: '',
  analysis_profile: '',
  analysis_config: {},
});

const createEmptyDatabaseProfile = (): DatabaseProfile => ({
  enabled: false,
  platform: '',
  host: '',
  database_name: '',
  instance_name: '',
  service_name: '',
  username: '',
  jdbc_url: '',
  connection_type: '',
  config_dir: '',
  role: '',
  host_group: '',
  port: null,
  schemas: [],
  connection_pool: '',
  max_pool_size: null,
  replication_group: '',
  failover_group: '',
  read_only: false,
  shared_dependency: false,
  data_classification: '',
  expected_evidence: [],
  safe_diagnostics: [],
  metadata: {},
});

const createEmptyDatabaseAccess = (): DatabaseDependencyProfile => ({
  access_mode: '',
  schema_names: [],
  operation_types: [],
  connection_pool: '',
  max_connections: null,
  statement_timeout_ms: null,
  expected_error_codes: [],
  query_fingerprint_scope: '',
  transactional: true,
  metadata: {},
});

const createEmptyService = (): CatalogService => ({
  service_id: '',
  service_name: '',
  service_type: 'app',
  environment: 'production',
  owner_team: '',
  criticality: 'high',
  description: '',
  is_stateless: true,
  allow_diagnostics: true,
  runbook_slug: '',
  tags: [],
  cluster: '',
  cluster_ids: [],
  restart_policy: {
    allow_restart: false,
    requires_human_approval: true,
    cooldown_minutes: 15,
    allowed_service_types: ['app', 'worker'],
  },
  database_profile: createEmptyDatabaseProfile(),
  endpoint_config: createEmptyEndpointConfig(),
  observation_config: createEmptyObservationConfig(),
  certification: {
    lifecycle_stage: 'catalog_only',
    certified_by: '',
    certified_at: null,
    notes: '',
  },
  metadata: {},
});

const createEmptyClusterRouting = (): ClusterRoutingConfig => ({
  topology_doc_url: '',
  dashboard_url: '',
  collector_url: '',
  extraction_url: '',
  formatting_url: '',
  shipping_url: '',
  diagnostics_url: '',
  restart_url: '',
  query_url: '',
  notes_url: '',
});

const createEmptyCluster = (): DependencyCluster => ({
  cluster_id: '',
  cluster_name: '',
  environment: 'production',
  owner_team: '',
  criticality: 'high',
  description: '',
  service_ids: [],
  entry_services: [],
  routing_config: createEmptyClusterRouting(),
  tags: [],
  metadata: {},
});

const createEmptyBusinessFlow = (): BusinessFlow => ({
  flow_id: '',
  flow_name: '',
  environment: 'production',
  owner_team: '',
  criticality: 'high',
  description: '',
  entry_service_ids: [],
  steps: [],
  success_indicators: [],
  failure_indicators: [],
  tags: [],
  enabled: true,
  correlation_window_minutes: 10,
  metadata: {},
});

const createEmptyEdge = (): DependencyEdge => ({
  edge_id: '',
  cluster_id: '',
  from_service_id: '',
  to_service_id: '',
  dependency_type: 'sync_api',
  dependency_purpose: '',
  dependency_scope: 'global',
  business_flow_ids: [],
  valid_failure_domains: [],
  expected_evidence: [],
  criticality_weight: 0.6,
  timeout_budget_ms: 2500,
  is_hard_dependency: true,
  database_access: createEmptyDatabaseAccess(),
  metadata: {},
});

const rolloverEnvironmentTypes: RolloverEnvironmentType[] = ['uat', 'dr', 'sandbox', 'test', 'production_clone', 'other'];

const createEmptyRolloverConnection = (): RolloverConnectionProfile => ({
  platform: 'oracle',
  source_service_id: '',
  username: '',
  dsn: '',
  jdbc_url: '',
  host: '',
  port: 1521,
  database_name: '',
  instance_name: '',
  sid: '',
  service_name: '',
  schema_name: '',
  connection_type: '',
  config_dir: '',
  password_set: false,
  metadata: {},
});

const defaultUat2RolloverRules = (): RolloverReplacementRule[] => [
  {
    rule_id: 'eftendptm-interface-host',
    table_name: 'EFTENDPTM',
    column_name: 'EFTEP_ENDPT_URL',
    source_value: 'intellectinterfacelv01',
    target_value: 'idcuatapp02',
    description: 'Move EFT endpoint hostnames from live interface host to UAT2 application host.',
    enabled: true,
    sequence: 10,
    metadata: {},
  },
  {
    rule_id: 'eftendptm-http-scheme',
    table_name: 'EFTENDPTM',
    column_name: 'EFTEP_ENDPT_URL',
    source_value: 'https',
    target_value: 'http',
    description: 'Match the current UAT2 non-TLS endpoint scheme.',
    enabled: true,
    sequence: 20,
    metadata: {},
  },
  {
    rule_id: 'eftendptm-lms-ip',
    table_name: 'EFTENDPTM',
    column_name: 'EFTEP_ENDPT_URL',
    source_value: '192.168.1.110',
    target_value: '192.168.4.24',
    description: 'Move EFT LMS endpoint IP from live to UAT2.',
    enabled: true,
    sequence: 30,
    metadata: {},
  },
  {
    rule_id: 'eodsysconfig-eod-ip',
    table_name: 'EODSYSCONFIG',
    column_name: 'EODSYSCNF_EOD_TRIG_END_URL',
    source_value: '192.168.1.110',
    target_value: '192.168.4.24',
    description: 'Move EOD trigger endpoints from live LMS host to UAT2.',
    enabled: true,
    sequence: 40,
    metadata: {},
  },
  {
    rule_id: 'extsyspgms-afcconnect-host',
    table_name: 'EXTSYSPGMS',
    column_name: 'EXTSYSPGMS_URL',
    source_value: 'afcconnect-lbm',
    target_value: 'idcuatapp02',
    description: 'Move external system program hostnames from AFC connect live balancer to UAT2.',
    enabled: true,
    sequence: 50,
    metadata: {},
  },
  {
    rule_id: 'extsyspgms-interface-host',
    table_name: 'EXTSYSPGMS',
    column_name: 'EXTSYSPGMS_URL',
    source_value: 'intellectinterfacelv01',
    target_value: 'idcuatapp02',
    description: 'Move external system program interface hostnames to UAT2.',
    enabled: true,
    sequence: 60,
    metadata: {},
  },
  {
    rule_id: 'extsyspgms-http-scheme',
    table_name: 'EXTSYSPGMS',
    column_name: 'EXTSYSPGMS_URL',
    source_value: 'https',
    target_value: 'http',
    description: 'Match the current UAT2 non-TLS external program scheme.',
    enabled: true,
    sequence: 70,
    metadata: {},
  },
  {
    rule_id: 'procctlopenapi-core-ip',
    table_name: 'PROCCTLOPENAPI',
    column_name: 'OPENAPI_URL',
    source_value: '192.168.1.108',
    target_value: '192.168.4.24',
    description: 'Move OpenAPI core endpoint from live core IP to UAT2.',
    enabled: true,
    sequence: 80,
    metadata: {},
  },
];

const createEmptyRolloverEnvironment = (): RolloverEnvironment => {
  const now = new Date().toISOString();
  return {
    environment_id: 'idcuatapp02',
    environment_name: 'IDC UAT2',
    environment_type: 'uat',
    service_environment: 'uat2',
    owner_team: 'Intellect',
    enabled: true,
    connection: createEmptyRolloverConnection(),
    rules: defaultUat2RolloverRules(),
    notes: 'Seeded from the UAT2 rollover scripts and post-rollover workbook state.',
    created_at: now,
    updated_at: now,
    updated_by: '',
    metadata: {},
  };
};

const cloneRolloverEnvironment = (environment: RolloverEnvironment): RolloverEnvironment => ({
  ...environment,
  connection: {
    ...createEmptyRolloverConnection(),
    ...(environment.connection || {}),
    metadata: { ...(environment.connection?.metadata || {}) },
  },
  rules: (environment.rules || []).map((rule) => ({
    ...rule,
    metadata: { ...(rule.metadata || {}) },
  })),
  metadata: { ...(environment.metadata || {}) },
});

const hasText = (value?: string | null) => Boolean((value || '').trim());

const isDatabaseAwareService = (service: CatalogService) =>
  service.service_type === 'db' || Boolean(service.database_profile?.enabled);

const serviceUsuallyNeedsDatabaseDeclaration = (service: CatalogService) =>
  ['app', 'worker', 'gateway', 'auth', 'channel', 'integration'].includes(service.service_type);

const hasDatabaseAccessDetail = (edge: DependencyEdge) =>
  Boolean(
    hasText(edge.database_access?.access_mode) ||
    hasText(edge.database_access?.connection_pool) ||
    hasText(edge.database_access?.query_fingerprint_scope) ||
    (edge.database_access?.schema_names || []).length ||
    (edge.database_access?.operation_types || []).length ||
    (edge.database_access?.expected_error_codes || []).length ||
    edge.database_access?.max_connections ||
    edge.database_access?.statement_timeout_ms,
  );

const isDatabaseDependency = (edge: DependencyEdge) =>
  edge.dependency_type === 'db' || hasDatabaseAccessDetail(edge);

const databaseLabel = (profile?: DatabaseProfile | null) => {
  if (!profile) return 'Database contract not declared';
  return [profile.platform, profile.database_name || profile.service_name || profile.instance_name]
    .filter(Boolean)
    .join(' / ') || 'Database contract declared';
};

const rolloverConnectionFromDatabaseService = (service: CatalogService): Partial<RolloverConnectionProfile> => {
  const profile = service.database_profile || createEmptyDatabaseProfile();
  return {
    platform: profile.platform || 'oracle',
    source_service_id: service.service_id,
    username: profile.username || '',
    jdbc_url: profile.jdbc_url || '',
    host: profile.host || profile.host_group || '',
    port: profile.port || (profile.platform === 'postgres' || profile.platform === 'postgresql' ? 5432 : 1521),
    database_name: profile.database_name || '',
    instance_name: profile.instance_name || '',
    sid: profile.instance_name || profile.database_name || '',
    service_name: profile.service_name || '',
    schema_name: profile.schemas?.[0] || '',
    connection_type: profile.connection_type || (profile.platform === 'oracle' && profile.instance_name && !profile.service_name ? 'sid' : ''),
    config_dir: profile.config_dir || '',
    metadata: {
      database_service_id: service.service_id,
      database_service_name: service.service_name,
      database_fabric_inherited: true,
    },
  };
};

const cloneService = (service: CatalogService): CatalogService => ({
  ...service,
  tags: [...service.tags],
  cluster_ids: [...service.cluster_ids],
  restart_policy: {
    ...service.restart_policy,
    allowed_service_types: [...service.restart_policy.allowed_service_types],
  },
  database_profile: {
    ...createEmptyDatabaseProfile(),
    ...(service.database_profile || {}),
    schemas: [...(service.database_profile?.schemas || [])],
    expected_evidence: [...(service.database_profile?.expected_evidence || [])],
    safe_diagnostics: [...(service.database_profile?.safe_diagnostics || [])],
    metadata: { ...(service.database_profile?.metadata || {}) },
  },
  endpoint_config: { ...service.endpoint_config },
  observation_config: { ...service.observation_config },
  certification: { ...service.certification },
  metadata: { ...service.metadata },
});

const cloneCluster = (cluster: DependencyCluster): DependencyCluster => ({
  ...cluster,
  service_ids: [...cluster.service_ids],
  entry_services: [...cluster.entry_services],
  routing_config: { ...cluster.routing_config },
  tags: [...cluster.tags],
  metadata: { ...cluster.metadata },
});

const cloneBusinessFlow = (flow: BusinessFlow): BusinessFlow => ({
  ...flow,
  entry_service_ids: [...flow.entry_service_ids],
  steps: flow.steps.map((step) => ({
    ...step,
    expected_signal_sources: [...step.expected_signal_sources],
    failure_domains: [...step.failure_domains],
    metadata: { ...step.metadata },
  })),
  success_indicators: [...flow.success_indicators],
  failure_indicators: [...flow.failure_indicators],
  tags: [...flow.tags],
  metadata: { ...flow.metadata },
});

const cloneEdge = (edge: DependencyEdge): DependencyEdge => ({
  ...edge,
  business_flow_ids: [...(edge.business_flow_ids || [])],
  valid_failure_domains: [...(edge.valid_failure_domains || [])],
  expected_evidence: [...(edge.expected_evidence || [])],
  database_access: {
    ...createEmptyDatabaseAccess(),
    ...(edge.database_access || {}),
    schema_names: [...(edge.database_access?.schema_names || [])],
    operation_types: [...(edge.database_access?.operation_types || [])],
    expected_error_codes: [...(edge.database_access?.expected_error_codes || [])],
    metadata: { ...(edge.database_access?.metadata || {}) },
  },
  metadata: { ...edge.metadata },
});

const cloneManagedSop = (sop: ManagedSop): ManagedSop => ({
  ...sop,
  services: [...sop.services],
  environments: [...sop.environments],
  aliases: [...sop.aliases],
  tags: [...sop.tags],
  content: Object.entries(sop.content || {}).reduce<Record<string, string[]>>(
    (acc, [section, lines]) => ({ ...acc, [section]: [...(lines || [])] }),
    {},
  ),
  validation: {
    ...sop.validation,
    errors: [...(sop.validation?.errors || [])],
    warnings: [...(sop.validation?.warnings || [])],
  },
  metadata: { ...sop.metadata },
});

const managedSopFromIndexed = (sop: IndexedSop, actor: string): ManagedSop => ({
  sop_id: sop.sop_id,
  title: sop.title,
  class_code: sop.class_code,
  severity: sop.severity,
  status: 'needs_review',
  version: sop.version || 1,
  owner_team: sop.owners?.[0] || '',
  services: [...(sop.services || [])],
  environments: [...(sop.environments || [])],
  aliases: [...(sop.aliases || [])],
  tags: ['indexed-corpus', ...(sop.systems || [])].filter(Boolean),
  content: managedSopSections.reduce<Record<string, string[]>>(
    (acc, section) => ({ ...acc, [section]: [...(sop.content?.[section] || [])] }),
    {},
  ),
  validation: {
    valid: false,
    errors: ['Imported from the indexed SOP corpus and pending Nexus governance validation.'],
    warnings: sop.alignment_status?.length
      ? sop.alignment_status.map((status) => `Corpus alignment status: ${status.replace(/_/g, ' ')}.`)
      : ['No corpus alignment status was provided.'],
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  updated_by: actor,
  metadata: {
    adopted_from_indexed_corpus: true,
    source_path: sop.source_path,
    source_directory: sop.source_directory,
    source_format: sop.source_format,
    chunk_count: sop.chunk_count,
    source_sections: sop.source_sections,
  },
});

const parseJsonInput = (value: string, label: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {};
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${label} must be a JSON object.`);
    }
    return parsed as Record<string, unknown>;
  } catch (error: any) {
    throw new Error(error?.message || `${label} is not valid JSON.`);
  }
};

const NexusPage: React.FC = () => {
  const { user } = useAuth();
  const { applicationTimeZone } = useAppConfig();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [incidents, setIncidents] = useState<NexusIncident[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [lightAgents, setLightAgents] = useState<NexusLightAgentSummary[]>([]);
  const [clusters, setClusters] = useState<DependencyCluster[]>([]);
  const [businessFlows, setBusinessFlows] = useState<BusinessFlow[]>([]);
  const [dependencies, setDependencies] = useState<DependencyEdge[]>([]);
  const [managedSops, setManagedSops] = useState<ManagedSop[]>([]);
  const [rolloverEnvironments, setRolloverEnvironments] = useState<RolloverEnvironment[]>([]);
  const [rolloverExecutions, setRolloverExecutions] = useState<RolloverExecution[]>([]);
  const [rolloverReminders, setRolloverReminders] = useState<RolloverReminder[]>([]);
  const [indexedSops, setIndexedSops] = useState<IndexedSop[]>([]);
  const [sopCorpusSummary, setSopCorpusSummary] = useState<{ indexed: number; chunks: number }>({ indexed: 0, chunks: 0 });
  const [fabricSummary, setFabricSummary] = useState<FabricSummary | null>(null);
  const [agentTokenStatus, setAgentTokenStatus] = useState<NexusAgentTokenStatus | null>(null);
  const [generatedAgentToken, setGeneratedAgentToken] = useState<NexusAgentTokenGenerateResponse | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedSopId, setSelectedSopId] = useState<string | null>(null);
  const [timelineServiceId, setTimelineServiceId] = useState<string | null>(null);
  const [servicePanelMode, setServicePanelMode] = useState<'overview' | 'configuration'>('overview');
  const [rolloverPanelMode, setRolloverPanelMode] = useState<'command' | 'configuration' | 'services'>('command');
  const [serviceLiveState, setServiceLiveState] = useState<NexusServiceLiveState | null>(null);
  const [serviceLiveLoading, setServiceLiveLoading] = useState(false);
  const [sourceExplorer, setSourceExplorer] = useState<{ source: string | null } | null>(null);
  const [sourceExplorerData, setSourceExplorerData] = useState<NexusServiceSignalFeed | null>(null);
  const [sourceExplorerLoading, setSourceExplorerLoading] = useState(false);
  const [sourceExplorerError, setSourceExplorerError] = useState<string | null>(null);
  const [logTailOpen, setLogTailOpen] = useState(false);
  const [logTailData, setLogTailData] = useState<NexusServiceLogTail | null>(null);
  const [logTailLoading, setLogTailLoading] = useState(false);
  const [logTailError, setLogTailError] = useState<string | null>(null);
  const [logTailFollowing, setLogTailFollowing] = useState(true);
  const [logTailCursor, setLogTailCursor] = useState<number | null>(null);
  const [serviceControlChallenge, setServiceControlChallenge] = useState<NexusServiceControlChallenge | null>(null);
  const [serviceControlReason, setServiceControlReason] = useState('');
  const [serviceControlCode, setServiceControlCode] = useState('');
  const [serviceControlBusy, setServiceControlBusy] = useState<string | null>(null);
  const [serviceControlError, setServiceControlError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [selectedRolloverEnvironmentId, setSelectedRolloverEnvironmentId] = useState<string | null>(null);
  const [creatingService, setCreatingService] = useState(false);
  const [creatingSop, setCreatingSop] = useState(false);
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [creatingFlow, setCreatingFlow] = useState(false);
  const [creatingEdge, setCreatingEdge] = useState(false);
  const [creatingRolloverEnvironment, setCreatingRolloverEnvironment] = useState(false);
  const [serviceDraft, setServiceDraft] = useState<CatalogService>(createEmptyService);
  const [sopDraft, setSopDraft] = useState<ManagedSop>(createEmptyManagedSop);
  const [clusterDraft, setClusterDraft] = useState<DependencyCluster>(createEmptyCluster);
  const [flowDraft, setFlowDraft] = useState<BusinessFlow>(createEmptyBusinessFlow);
  const [edgeDraft, setEdgeDraft] = useState<DependencyEdge>(createEmptyEdge);
  const [rolloverDraft, setRolloverDraft] = useState<RolloverEnvironment>(createEmptyRolloverEnvironment);
  const [serviceMetadataText, setServiceMetadataText] = useState('{}');
  const [sopMetadataText, setSopMetadataText] = useState('{}');
  const [clusterMetadataText, setClusterMetadataText] = useState('{}');
  const [flowMetadataText, setFlowMetadataText] = useState('{}');
  const [edgeMetadataText, setEdgeMetadataText] = useState('{}');
  const [rolloverMetadataText, setRolloverMetadataText] = useState('{}');
  const [rolloverCredentialPassword, setRolloverCredentialPassword] = useState('');
  const [databaseTestPassword, setDatabaseTestPassword] = useState('');
  const [databaseConnectionTest, setDatabaseConnectionTest] = useState<DatabaseConnectionTestResult | null>(null);
  const [rolloverConnectionTest, setRolloverConnectionTest] = useState<DatabaseConnectionTestResult | null>(null);
  const [rolloverAssessment, setRolloverAssessment] = useState<RolloverAssessment | null>(null);
  const [rolloverChallenge, setRolloverChallenge] = useState<RolloverChallenge | null>(null);
  const [rolloverOtpCode, setRolloverOtpCode] = useState('');
  const [rolloverReason, setRolloverReason] = useState('');
  const [rolloverReminderDateTime, setRolloverReminderDateTime] = useState('');
  const [rolloverReminderRecipients, setRolloverReminderRecipients] = useState('');
  const [rolloverReminderNotes, setRolloverReminderNotes] = useState('');
  const [editorDirty, setEditorDirty] = useState<NexusEditorDirtyState>(createCleanEditorDirty);
  const [graphContext, setGraphContext] = useState<ServiceGraphContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootPreviewVisible, setBootPreviewVisible] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [catalogBusy, setCatalogBusy] = useState<string | null>(null);
  const [agentTokenBusy, setAgentTokenBusy] = useState(false);
  const [incidentPage, setIncidentPage] = useState(1);
  const [incidentTimelineFilter, setIncidentTimelineFilter] = useState<IncidentTimelineFilter>('all');
  const [query, setQuery] = useState('');
  const [verdict, setVerdict] = useState('confirmed');
  const [actualRoot, setActualRoot] = useState('');
  const [verdictNotes, setVerdictNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [copilotBusy, setCopilotBusy] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);
  const [copilotTurns, setCopilotTurns] = useState<CopilotTurn[]>([]);
  const [incidentBrief, setIncidentBrief] = useState<ProcedureGuidanceResponse | null>(null);
  const [incidentBriefBusy, setIncidentBriefBusy] = useState(false);
  const [incidentBriefError, setIncidentBriefError] = useState<string | null>(null);
  const [timelineChatQuestion, setTimelineChatQuestion] = useState('');
  const [timelineChatTurns, setTimelineChatTurns] = useState<ServiceTimelineTurn[]>([]);
  const [timelineChatBusy, setTimelineChatBusy] = useState(false);
  const [timelineChatError, setTimelineChatError] = useState<string | null>(null);
  const [timelineChatOpen, setTimelineChatOpen] = useState(false);
  const [timelinePendingQuestion, setTimelinePendingQuestion] = useState('');
  const [timelineInferencePhase, setTimelineInferencePhase] = useState<TimelineInferencePhase>('idle');
  const [timelineChatSuggestions, setTimelineChatSuggestions] = useState<string[]>([
    'What is the current state?',
    'When was the last incident and how long did it last?',
    'What happened in the last 24 hours?',
    'Which evidence changed before recovery?',
  ]);
  const timelineInferenceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const bootPreviewStartedAtRef = useRef(Date.now());
  const liveRefreshInFlightRef = useRef(false);
  const logTailRefreshInFlightRef = useRef(false);
  const serviceControlAutoSubmitRef = useRef<string | null>(null);
  const editorDirtyRef = useRef<NexusEditorDirtyState>(createCleanEditorDirty());
  const editorHydrationRef = useRef<Record<NexusEditorKind, string | null>>({
    service: null,
    cluster: null,
    flow: null,
    edge: null,
    sop: null,
    rollover: null,
  });

  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const selectedIncidentId = searchParams.get('incident');
  const activeWorkspace = (searchParams.get('workspace') as WorkspaceTab | null) || 'incidents';
  const selectedTabParam = searchParams.get('tab');
  const actor = user?.username || user?.email || 'sentinel-operator';
  const userRole = (user?.role || '').toLowerCase();
  const hasNexusSectionAccess = (user as any)?.section_id === NEXUS_SECTION_ID;
  const canManageNexus = userRole === 'admin';
  const canOperateNexus = ['admin', 'manager', 'supervisor'].includes(userRole);
  const activeDetailTab: NexusDetailTab =
    selectedTabParam === 'topology' ||
      selectedTabParam === 'evidence' ||
      selectedTabParam === 'actions' ||
      selectedTabParam === 'procedure' ||
      selectedTabParam === 'outcome'
      ? selectedTabParam
      : 'overview';

  const serviceMap = useMemo(
    () => services.reduce<Record<string, CatalogService>>((acc, service) => ({ ...acc, [service.service_id]: service }), {}),
    [services],
  );

  const selectedIncident = useMemo(() => {
    const incident = incidents.find((item) => item.incident_id === selectedIncidentId);
    return incident || null;
  }, [incidents, selectedIncidentId]);

  const selectedService = useMemo(
    () => services.find((item) => item.service_id === selectedServiceId) || null,
    [selectedServiceId, services],
  );

  const selectedCluster = useMemo(
    () => clusters.find((item) => item.cluster_id === selectedClusterId) || null,
    [clusters, selectedClusterId],
  );

  const selectedFlow = useMemo(
    () => businessFlows.find((item) => item.flow_id === selectedFlowId) || null,
    [businessFlows, selectedFlowId],
  );

  const selectedEdge = useMemo(
    () => dependencies.find((item) => (item.edge_id || '') === selectedEdgeId) || null,
    [dependencies, selectedEdgeId],
  );

  const selectedSop = useMemo(
    () => managedSops.find((item) => item.sop_id === selectedSopId) || null,
    [managedSops, selectedSopId],
  );

  const selectedRolloverEnvironment = useMemo(
    () => rolloverEnvironments.find((item) => item.environment_id === selectedRolloverEnvironmentId) || null,
    [rolloverEnvironments, selectedRolloverEnvironmentId],
  );

  const managedSopIds = useMemo(() => new Set(managedSops.map((sop) => sop.sop_id)), [managedSops]);

  const rawEvidenceLink = useMemo(() => {
    if (!selectedIncident?.suspected_root_service) {
      return null;
    }
    const mappedService = serviceMap[selectedIncident.suspected_root_service];
    const networkServiceId = mappedService?.observation_config.network_service_id;
    return networkServiceId ? `/network-sentinel?service=${networkServiceId}&tab=evidence` : null;
  }, [selectedIncident?.suspected_root_service, serviceMap]);

  const workspaceLabel = workspaceLabels[activeWorkspace] || 'Incidents';

  const syncHealthLabel = (fabricSummary?.sync_health || 'idle').toUpperCase();
  const lastSyncLabel = formatDateTime(fabricSummary?.last_sync_at);
  const totalServices = fabricSummary?.total_services || services.length;
  const mappedServices = fabricSummary?.mapped_network_services || 0;
  const totalClusters = fabricSummary?.total_clusters || clusters.length;
  const totalFlows = businessFlows.length;
  const timezoneLabel = applicationTimeZone;
  const timelineInferenceActive = timelineChatBusy || timelineInferencePhase !== 'idle';
  const timelineInferenceIndex = timelineInferenceSteps.findIndex((step) => step.id === timelineInferencePhase);
  const nexusLinkedConsoles = [
    {
      to: '/database-stats',
      icon: <FaDatabase />,
      label: 'Stats',
      detail: 'Database telemetry and storage-health signals',
    },
    {
      to: '/network-sentinel',
      icon: <FaNetworkWired />,
      label: 'Network Sentinel',
      detail: 'Service monitoring, anomalies, and evidence traces',
    },
  ];

  const setEditorDirtyFlag = useCallback((kind: NexusEditorKind, dirty: boolean) => {
    if (editorDirtyRef.current[kind] === dirty) {
      return;
    }
    const nextState = { ...editorDirtyRef.current, [kind]: dirty };
    editorDirtyRef.current = nextState;
    setEditorDirty(nextState);
  }, []);

  const markEditorDirty = useCallback((kind: NexusEditorKind) => {
    setEditorDirtyFlag(kind, true);
  }, [setEditorDirtyFlag]);

  const clearEditorDirty = useCallback((kind: NexusEditorKind) => {
    setEditorDirtyFlag(kind, false);
  }, [setEditorDirtyFlag]);

  const resetEditorHydration = useCallback((kind: NexusEditorKind) => {
    editorHydrationRef.current[kind] = null;
    clearEditorDirty(kind);
  }, [clearEditorDirty]);

  const shouldSkipDraftHydration = useCallback(
    (kind: NexusEditorKind, key: string) => editorDirtyRef.current[kind] && editorHydrationRef.current[kind] === key,
    [],
  );

  const markEditorHydrated = useCallback((kind: NexusEditorKind, key: string | null) => {
    editorHydrationRef.current[kind] = key;
    clearEditorDirty(kind);
  }, [clearEditorDirty]);

  const createEditorChangeGuard = useCallback(
    (kind: NexusEditorKind) => (event: React.SyntheticEvent<HTMLElement>) => {
      if (!canManageNexus) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-draft-ignore="true"]')) {
        return;
      }
      markEditorDirty(kind);
    },
    [canManageNexus, markEditorDirty],
  );

  const createEditorClickGuard = useCallback(
    (kind: NexusEditorKind) => (event: React.MouseEvent<HTMLElement>) => {
      if (!canManageNexus) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.closest('.selection-chip, [data-draft-change="true"]')) {
        markEditorDirty(kind);
      }
    },
    [canManageNexus, markEditorDirty],
  );

  const actionDeckCount = useMemo(() => {
    if (!selectedIncident) {
      return 0;
    }
    return selectedIncident.action_executions.length + selectedIncident.diagnostics.length + selectedIncident.linked_tasks.length;
  }, [selectedIncident]);

  const operationalIncidents = useMemo(
    () => incidents.filter((incident) => incident.status !== 'RESOLVED'),
    [incidents],
  );

  const loadWorkspace = useCallback(async (options: { silent?: boolean } = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) {
      setLoading(true);
    }
    try {
      const [
        incidentData,
        serviceData,
        agentData,
        clusterData,
        flowData,
        dependencyData,
        summaryData,
        sopData,
        rolloverData,
        rolloverExecutionData,
        rolloverReminderData,
        indexedSopData,
        tokenStatusData,
      ] = await Promise.all([
        nexusApi.listIncidents(),
        nexusApi.listServices(),
        nexusApi.listLightAgents(),
        nexusApi.listClusters(),
        nexusApi.listBusinessFlows(),
        nexusApi.listDependencies(),
        nexusApi.getFabricSummary(),
        nexusApi.listManagedSops(false),
        nexusApi.listRolloverEnvironments(),
        nexusApi.listRolloverExecutions(),
        nexusApi.listRolloverReminders(),
        nexusApi.listIndexedSops(),
        canManageNexus ? nexusApi.getAgentTokenStatus() : Promise.resolve(null),
      ]);

      const orderedIncidents = [...incidentData].sort((left, right) => {
        const statusRank = (status: string) => (status === 'OPEN' ? 4 : status === 'MONITORING' ? 3 : status === 'AWAITING_VERDICT' ? 2 : 1);
        const statusDelta = statusRank(right.status) - statusRank(left.status);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        const leftRisk = displayRiskLevelForIncident(left);
        const rightRisk = displayRiskLevelForIncident(right);
        if (riskRank[leftRisk] !== riskRank[rightRisk]) {
          return riskRank[rightRisk] - riskRank[leftRisk];
        }
        return timestampMs(right.start_time) - timestampMs(left.start_time);
      });

      const orderedServices = [...serviceData].sort((left, right) =>
        `${left.environment}:${left.service_name}`.localeCompare(`${right.environment}:${right.service_name}`),
      );
      const orderedLightAgents = [...agentData].sort((left, right) =>
        `${left.status}:${left.agent_id}`.localeCompare(`${right.status}:${right.agent_id}`),
      );
      const orderedClusters = [...clusterData].sort((left, right) =>
        `${left.environment}:${left.cluster_name}`.localeCompare(`${right.environment}:${right.cluster_name}`),
      );
      const orderedFlows = [...flowData].sort((left, right) =>
        `${left.environment}:${left.flow_name}`.localeCompare(`${right.environment}:${right.flow_name}`),
      );
      const orderedDependencies = [...dependencyData].sort((left, right) =>
        `${left.cluster_id || ''}:${left.from_service_id}:${left.to_service_id}`.localeCompare(
          `${right.cluster_id || ''}:${right.from_service_id}:${right.to_service_id}`,
        ),
      );
      const orderedSops = [...sopData].sort((left, right) => {
        const statusRank = (status: string) => (status === 'approved' ? 4 : status === 'needs_review' ? 3 : status === 'draft' ? 2 : 1);
        const statusDelta = statusRank(right.status) - statusRank(left.status);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        return timestampMs(right.updated_at) - timestampMs(left.updated_at);
      });
      const orderedIndexedSops = [...indexedSopData.sops].sort((left, right) =>
        `${left.class_code}:${left.sop_id}`.localeCompare(`${right.class_code}:${right.sop_id}`),
      );
      const orderedRolloverEnvironments = [...rolloverData].sort((left, right) =>
        `${left.environment_type}:${left.environment_name}`.localeCompare(`${right.environment_type}:${right.environment_name}`),
      );
      const orderedRolloverExecutions = [...rolloverExecutionData].sort((left, right) =>
        timestampMs(right.requested_at) - timestampMs(left.requested_at),
      );
      const orderedRolloverReminders = [...rolloverReminderData].sort((left, right) =>
        timestampMs(left.scheduled_for) - timestampMs(right.scheduled_for),
      );

      startTransition(() => {
        setIncidents(orderedIncidents);
        setServices(orderedServices);
        setLightAgents(orderedLightAgents);
        setClusters(orderedClusters);
        setBusinessFlows(orderedFlows);
        setDependencies(orderedDependencies);
        setManagedSops(orderedSops);
        setRolloverEnvironments(orderedRolloverEnvironments);
        setRolloverExecutions(orderedRolloverExecutions);
        setRolloverReminders(orderedRolloverReminders);
        setIndexedSops(orderedIndexedSops);
        setSopCorpusSummary(indexedSopData.summary);
        setFabricSummary(summaryData);
        setAgentTokenStatus(tokenStatusData);
      });
      setError(null);
    } catch (err: any) {
      if (!silent) {
        setError(err?.response?.data?.detail || err?.message || 'Sentinel Nexus could not load the live control plane.');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [canManageNexus]);

  const refreshOperationalPulse = useCallback(async () => {
    try {
      const [incidentData, summaryData] = await Promise.all([
        nexusApi.listIncidents(),
        nexusApi.getFabricSummary(),
      ]);
      const orderedIncidents = [...incidentData].sort((left, right) => {
        const statusRank = (status: string) => (status === 'OPEN' ? 4 : status === 'MONITORING' ? 3 : status === 'AWAITING_VERDICT' ? 2 : 1);
        const statusDelta = statusRank(right.status) - statusRank(left.status);
        if (statusDelta !== 0) {
          return statusDelta;
        }
        const leftRisk = displayRiskLevelForIncident(left);
        const rightRisk = displayRiskLevelForIncident(right);
        if (riskRank[leftRisk] !== riskRank[rightRisk]) {
          return riskRank[rightRisk] - riskRank[leftRisk];
        }
        return timestampMs(right.start_time) - timestampMs(left.start_time);
      });
      startTransition(() => {
        setIncidents(orderedIncidents);
        setFabricSummary(summaryData);
      });
    } catch {
      // Keep the last known live state on transient pulse failures.
    }
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }
    if (!hasNexusSectionAccess) {
      setLoading(false);
      setBootPreviewVisible(false);
      return;
    }
    void loadWorkspace();
  }, [hasNexusSectionAccess, loadWorkspace, user]);

  useEffect(() => {
    if (!user || !hasNexusSectionAccess) {
      return undefined;
    }

    const refreshLiveWorkspace = (refresh: () => Promise<void>) => {
      if (document.visibilityState !== 'visible' || liveRefreshInFlightRef.current) {
        return;
      }
      liveRefreshInFlightRef.current = true;
      void refresh().finally(() => {
        liveRefreshInFlightRef.current = false;
      });
    };
    const refreshPulse = () => refreshLiveWorkspace(refreshOperationalPulse);
    const refreshFullWorkspace = () => refreshLiveWorkspace(() => loadWorkspace({ silent: true }));

    const pulseInterval = window.setInterval(refreshPulse, 15000);
    const fullInterval = window.setInterval(refreshFullWorkspace, 60000);
    window.addEventListener('focus', refreshPulse);
    document.addEventListener('visibilitychange', refreshPulse);

    return () => {
      window.clearInterval(pulseInterval);
      window.clearInterval(fullInterval);
      window.removeEventListener('focus', refreshPulse);
      document.removeEventListener('visibilitychange', refreshPulse);
    };
  }, [hasNexusSectionAccess, loadWorkspace, refreshOperationalPulse, user]);

  useEffect(() => {
    if (loading || !bootPreviewVisible) {
      return undefined;
    }

    const elapsed = Date.now() - bootPreviewStartedAtRef.current;
    const remaining = Math.max(NEXUS_BOOT_PREVIEW_MIN_MS - elapsed, 0);
    const timeout = window.setTimeout(() => {
      setBootPreviewVisible(false);
    }, remaining);

    return () => window.clearTimeout(timeout);
  }, [bootPreviewVisible, loading]);

  useEffect(() => {
    if (!selectedIncidentId) {
      return;
    }
    if (incidents.length && !incidents.some((incident) => incident.incident_id === selectedIncidentId)) {
      const nextParams = new URLSearchParams(searchParams.toString());
      nextParams.delete('incident');
      nextParams.delete('tab');
      setSearchParams(nextParams, { replace: true });
    }
  }, [incidents, searchParams, selectedIncidentId, setSearchParams]);

  useEffect(() => {
    if (!selectedIncident?.suspected_root_service) {
      setGraphContext(null);
      return;
    }
    setDetailLoading(true);
    nexusApi
      .getGraphContext(selectedIncident.suspected_root_service)
      .then((context) => setGraphContext(context))
      .catch(() => setGraphContext(null))
      .finally(() => setDetailLoading(false));
  }, [selectedIncident?.suspected_root_service]);

  const refreshServiceLiveState = useCallback((serviceId: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setServiceLiveLoading(true);
    }
    return nexusApi
      .getServiceLiveState(serviceId)
      .then((state) => setServiceLiveState(state))
      .catch(() => setServiceLiveState(null))
      .finally(() => {
        if (!options.silent) {
          setServiceLiveLoading(false);
        }
      });
  }, []);

  const scheduleControlBurstRefresh = useCallback((serviceId: string) => {
    [700, 1800, 3500, 6000, 9000, 13000].forEach((delay) => {
      window.setTimeout(() => {
        void refreshServiceLiveState(serviceId, { silent: true });
      }, delay);
    });
  }, [refreshServiceLiveState]);

  useEffect(() => {
    if (!selectedServiceId || creatingService) {
      setServiceLiveState(null);
      setServiceLiveLoading(false);
      return undefined;
    }
    refreshServiceLiveState(selectedServiceId);
    const interval = window.setInterval(() => refreshServiceLiveState(selectedServiceId, { silent: true }), 10000);
    return () => window.clearInterval(interval);
  }, [creatingService, refreshServiceLiveState, selectedServiceId]);

  useEffect(() => {
    if (creatingService) {
      return;
    }
    if (!selectedServiceId || !services.length) {
      setSelectedServiceId(null);
      setServiceDraft(createEmptyService());
      setServiceMetadataText('{}');
      setDatabaseTestPassword('');
      setDatabaseConnectionTest(null);
      markEditorHydrated('service', null);
      return;
    }
    const nextService = services.find((service) => service.service_id === selectedServiceId);
    if (!nextService) {
      setSelectedServiceId(null);
      setServiceDraft(createEmptyService());
      setServiceMetadataText('{}');
      setDatabaseTestPassword('');
      setDatabaseConnectionTest(null);
      markEditorHydrated('service', null);
      return;
    }
    if (shouldSkipDraftHydration('service', selectedServiceId)) {
      return;
    }
    setServiceDraft(cloneService(nextService));
    setServiceMetadataText(stringifyObject(nextService.metadata));
    setDatabaseTestPassword('');
    setDatabaseConnectionTest(null);
    markEditorHydrated('service', selectedServiceId);
  }, [creatingService, markEditorHydrated, selectedServiceId, services, shouldSkipDraftHydration]);

  useEffect(() => {
    if (creatingCluster) {
      return;
    }
    if (!selectedClusterId || !clusters.length) {
      setSelectedClusterId(null);
      setClusterDraft(createEmptyCluster());
      setClusterMetadataText('{}');
      markEditorHydrated('cluster', null);
      return;
    }
    const nextCluster = clusters.find((cluster) => cluster.cluster_id === selectedClusterId);
    if (!nextCluster) {
      setSelectedClusterId(null);
      setClusterDraft(createEmptyCluster());
      setClusterMetadataText('{}');
      markEditorHydrated('cluster', null);
      return;
    }
    if (shouldSkipDraftHydration('cluster', selectedClusterId)) {
      return;
    }
    setClusterDraft(cloneCluster(nextCluster));
    setClusterMetadataText(stringifyObject(nextCluster.metadata));
    markEditorHydrated('cluster', selectedClusterId);
  }, [clusters, creatingCluster, markEditorHydrated, selectedClusterId, shouldSkipDraftHydration]);

  useEffect(() => {
    if (creatingFlow) {
      return;
    }
    if (!selectedFlowId || !businessFlows.length) {
      setSelectedFlowId(null);
      setFlowDraft(createEmptyBusinessFlow());
      setFlowMetadataText('{}');
      markEditorHydrated('flow', null);
      return;
    }
    const nextFlow = businessFlows.find((flow) => flow.flow_id === selectedFlowId);
    if (!nextFlow) {
      setSelectedFlowId(null);
      setFlowDraft(createEmptyBusinessFlow());
      setFlowMetadataText('{}');
      markEditorHydrated('flow', null);
      return;
    }
    if (shouldSkipDraftHydration('flow', selectedFlowId)) {
      return;
    }
    setFlowDraft(cloneBusinessFlow(nextFlow));
    setFlowMetadataText(stringifyObject(nextFlow.metadata));
    markEditorHydrated('flow', selectedFlowId);
  }, [businessFlows, creatingFlow, markEditorHydrated, selectedFlowId, shouldSkipDraftHydration]);

  useEffect(() => {
    if (creatingEdge) {
      return;
    }
    if (!selectedEdgeId || !dependencies.length) {
      setSelectedEdgeId(null);
      setEdgeDraft(createEmptyEdge());
      setEdgeMetadataText('{}');
      markEditorHydrated('edge', null);
      return;
    }
    const nextEdge = dependencies.find((edge) => (edge.edge_id || '') === selectedEdgeId);
    if (!nextEdge) {
      setSelectedEdgeId(null);
      setEdgeDraft(createEmptyEdge());
      setEdgeMetadataText('{}');
      markEditorHydrated('edge', null);
      return;
    }
    if (shouldSkipDraftHydration('edge', selectedEdgeId)) {
      return;
    }
    setEdgeDraft(cloneEdge(nextEdge));
    setEdgeMetadataText(stringifyObject(nextEdge.metadata));
    markEditorHydrated('edge', selectedEdgeId);
  }, [dependencies, creatingEdge, markEditorHydrated, selectedEdgeId, shouldSkipDraftHydration]);

  useEffect(() => {
    if (creatingSop) {
      return;
    }
    if (!selectedSopId || !managedSops.length) {
      setSelectedSopId(null);
      setSopDraft(createEmptyManagedSop());
      setSopMetadataText('{}');
      markEditorHydrated('sop', null);
      return;
    }
    const nextSop = managedSops.find((sop) => sop.sop_id === selectedSopId);
    if (!nextSop) {
      setSelectedSopId(null);
      setSopDraft(createEmptyManagedSop());
      setSopMetadataText('{}');
      markEditorHydrated('sop', null);
      return;
    }
    if (shouldSkipDraftHydration('sop', selectedSopId)) {
      return;
    }
    setSopDraft(cloneManagedSop(nextSop));
    setSopMetadataText(stringifyObject(nextSop.metadata));
    markEditorHydrated('sop', selectedSopId);
  }, [creatingSop, managedSops, markEditorHydrated, selectedSopId, shouldSkipDraftHydration]);

  useEffect(() => {
    if (creatingRolloverEnvironment) {
      return;
    }
    if (!selectedRolloverEnvironmentId || !rolloverEnvironments.length) {
      setSelectedRolloverEnvironmentId(null);
      setRolloverDraft(createEmptyRolloverEnvironment());
      setRolloverMetadataText('{}');
      setRolloverConnectionTest(null);
      markEditorHydrated('rollover', null);
      return;
    }
    const nextEnvironment = rolloverEnvironments.find((environment) => environment.environment_id === selectedRolloverEnvironmentId);
    if (!nextEnvironment) {
      setSelectedRolloverEnvironmentId(null);
      setRolloverDraft(createEmptyRolloverEnvironment());
      setRolloverMetadataText('{}');
      setRolloverConnectionTest(null);
      markEditorHydrated('rollover', null);
      return;
    }
    if (shouldSkipDraftHydration('rollover', selectedRolloverEnvironmentId)) {
      return;
    }
    setRolloverDraft(cloneRolloverEnvironment(nextEnvironment));
    setRolloverMetadataText(stringifyObject(nextEnvironment.metadata));
    setRolloverCredentialPassword('');
    setRolloverAssessment(null);
    setRolloverConnectionTest(null);
    setRolloverChallenge(null);
    setRolloverOtpCode('');
    markEditorHydrated('rollover', selectedRolloverEnvironmentId);
  }, [
    creatingRolloverEnvironment,
    markEditorHydrated,
    rolloverEnvironments,
    selectedRolloverEnvironmentId,
    shouldSkipDraftHydration,
  ]);

  useEffect(() => {
    setCopilotError(null);
    setCopilotTurns([]);
    setCopilotQuestion('');
    setIncidentBrief(null);
    setIncidentBriefError(null);
  }, [selectedIncident?.incident_id]);

  useEffect(() => {
    setTimelineChatQuestion('');
    setTimelineChatTurns([]);
    setTimelineChatError(null);
    setTimelineChatOpen(false);
    setTimelinePendingQuestion('');
    setTimelineInferencePhase('idle');
    setTimelineChatSuggestions([
      'What is the current state?',
      'When was the last incident and how long did it last?',
      'What happened in the last 24 hours?',
      'Which evidence changed before recovery?',
    ]);
  }, [timelineServiceId]);

  const clearTimelineInferenceTimers = useCallback(() => {
    timelineInferenceTimers.current.forEach((timer) => clearTimeout(timer));
    timelineInferenceTimers.current = [];
  }, []);

  useEffect(() => () => clearTimelineInferenceTimers(), [clearTimelineInferenceTimers]);

  const beginTimelineInference = () => {
    clearTimelineInferenceTimers();
    setTimelineInferencePhase('dispatch');
    timelineInferenceTimers.current = [
      setTimeout(() => setTimelineInferencePhase('grounding'), 420),
      setTimeout(() => setTimelineInferencePhase('inference'), 920),
    ];
  };

  const settleTimelineInference = () => {
    clearTimelineInferenceTimers();
    setTimelineInferencePhase('answer');
    timelineInferenceTimers.current = [
      setTimeout(() => setTimelineInferencePhase('idle'), 900),
    ];
  };

  const filteredIncidents = useMemo(() => {
    if (!deferredQuery) {
      return operationalIncidents;
    }
    return operationalIncidents.filter((incident) =>
      [
        incident.title,
        incident.summary,
        incident.suspected_root_service_name,
        ...incident.affected_services,
        ...incident.cluster_ids,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, operationalIncidents]);

  const incidentTimelineBuckets = useMemo(() => {
    const now = Date.now();
    const withinHours = (incident: NexusIncident, hours: number) => {
      const timestamp = getIncidentActivityDate(incident).getTime();
      return !Number.isNaN(timestamp) && now - timestamp <= hours * 60 * 60 * 1000;
    };
    const activeCount = operationalIncidents.filter((incident) => ['OPEN', 'MONITORING'].includes(incident.status)).length;
    const baseBuckets = [
      { id: 'all' as IncidentTimelineFilter, label: 'All unresolved', count: operationalIncidents.length, hint: 'Current Nexus work queue' },
      { id: 'active' as IncidentTimelineFilter, label: 'Active now', count: activeCount, hint: 'Open or monitoring' },
      { id: 'last_1h' as IncidentTimelineFilter, label: 'Last hour', count: operationalIncidents.filter((incident) => withinHours(incident, 1)).length, hint: 'Freshest movement' },
      { id: 'last_5h' as IncidentTimelineFilter, label: 'Last 5 hours', count: operationalIncidents.filter((incident) => withinHours(incident, 5)).length, hint: 'Current shift pulse' },
      { id: 'last_12h' as IncidentTimelineFilter, label: 'Last 12 hours', count: operationalIncidents.filter((incident) => withinHours(incident, 12)).length, hint: 'Half-day window' },
      { id: 'last_24h' as IncidentTimelineFilter, label: 'Last 24 hours', count: operationalIncidents.filter((incident) => withinHours(incident, 24)).length, hint: 'Operational day' },
    ];

    const dateCounts = operationalIncidents.reduce<Record<string, number>>((acc, incident) => {
      const activityDate = getIncidentActivityDate(incident);
      const timestamp = activityDate.getTime();
      if (Number.isNaN(timestamp) || now - timestamp <= 24 * 60 * 60 * 1000) {
        return acc;
      }
      const bucketId = dateBucketId(activityDate);
      return { ...acc, [bucketId]: (acc[bucketId] || 0) + 1 };
    }, {});
    const dateBuckets = Object.entries(dateCounts)
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([id, count]) => ({
        id,
        label: formatBucketDate(id),
        count,
        hint: 'Awaiting operator closure',
      }));
    return [...baseBuckets, ...dateBuckets];
  }, [operationalIncidents]);

  const timeFilteredIncidents = useMemo(() => {
    if (incidentTimelineFilter === 'all') {
      return filteredIncidents;
    }
    if (incidentTimelineFilter === 'active') {
      return filteredIncidents.filter((incident) => ['OPEN', 'MONITORING'].includes(incident.status));
    }
    if (incidentTimelineFilter.startsWith('date:')) {
      return filteredIncidents.filter((incident) => dateBucketId(getIncidentActivityDate(incident)) === incidentTimelineFilter);
    }
    const hourMap: Record<string, number> = {
      last_1h: 1,
      last_5h: 5,
      last_12h: 12,
      last_24h: 24,
    };
    const hours = hourMap[incidentTimelineFilter];
    if (!hours) {
      return filteredIncidents;
    }
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return filteredIncidents.filter((incident) => {
      const timestamp = getIncidentActivityDate(incident).getTime();
      return !Number.isNaN(timestamp) && timestamp >= cutoff;
    });
  }, [filteredIncidents, incidentTimelineFilter]);

  const incidentTotalPages = Math.max(1, Math.ceil(timeFilteredIncidents.length / INCIDENT_PAGE_SIZE));
  const paginatedIncidents = useMemo(
    () => timeFilteredIncidents.slice((incidentPage - 1) * INCIDENT_PAGE_SIZE, incidentPage * INCIDENT_PAGE_SIZE),
    [incidentPage, timeFilteredIncidents],
  );

  useEffect(() => {
    setIncidentPage(1);
  }, [deferredQuery, incidentTimelineFilter]);

  useEffect(() => {
    if (incidentPage > incidentTotalPages) {
      setIncidentPage(incidentTotalPages);
    }
  }, [incidentPage, incidentTotalPages]);

  const filteredServices = useMemo(() => {
    if (!deferredQuery) {
      return services;
    }
    return services.filter((service) =>
      [
        service.service_id,
        service.service_name,
        service.owner_team,
        service.environment,
        service.criticality,
        service.certification.lifecycle_stage,
        service.observation_config.network_service_id,
        service.database_profile?.platform,
        service.database_profile?.host,
        service.database_profile?.database_name,
        service.database_profile?.service_name,
        service.database_profile?.instance_name,
        service.database_profile?.username,
        service.database_profile?.jdbc_url,
        service.database_profile?.connection_pool,
        ...(service.database_profile?.schemas || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, services]);

  const filteredClusters = useMemo(() => {
    if (!deferredQuery) {
      return clusters;
    }
    return clusters.filter((cluster) =>
      [
        cluster.cluster_id,
        cluster.cluster_name,
        cluster.owner_team,
        cluster.environment,
        cluster.criticality,
        ...cluster.service_ids,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [clusters, deferredQuery]);

  const filteredBusinessFlows = useMemo(() => {
    if (!deferredQuery) {
      return businessFlows;
    }
    return businessFlows.filter((flow) =>
      [
        flow.flow_id,
        flow.flow_name,
        flow.environment,
        flow.owner_team,
        flow.criticality,
        flow.description || '',
        flow.tags.join(' '),
        flow.steps.map((step) => `${step.service_id} ${step.service_role}`).join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [businessFlows, deferredQuery]);

  const filteredDependencies = useMemo(() => {
    if (!deferredQuery) {
      return dependencies;
    }
    return dependencies.filter((edge) =>
      [edge.edge_id, edge.cluster_id, edge.from_service_id, edge.to_service_id, edge.dependency_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [dependencies, deferredQuery]);

  const filteredManagedSops = useMemo(() => {
    if (!deferredQuery) {
      return managedSops;
    }
    return managedSops.filter((sop) =>
      [
        sop.sop_id,
        sop.title,
        sop.class_code,
        sop.severity,
        sop.status,
        sop.owner_team || '',
        ...sop.services,
        ...sop.environments,
        ...sop.aliases,
        ...sop.tags,
        ...Object.values(sop.content || {}).flat(),
      ]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, managedSops]);

  const filteredIndexedSops = useMemo(() => {
    if (!deferredQuery) {
      return indexedSops;
    }
    return indexedSops.filter((sop) =>
      [
        sop.sop_id,
        sop.title,
        sop.class_code,
        sop.severity,
        sop.source_path,
        ...(sop.services || []),
        ...(sop.environments || []),
        ...(sop.aliases || []),
        ...(sop.systems || []),
        ...(sop.owners || []),
        ...(sop.alignment_status || []),
        ...Object.values(sop.content || {}).flat(),
      ]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, indexedSops]);

  const filteredRolloverEnvironments = useMemo(() => {
    if (!deferredQuery) {
      return rolloverEnvironments;
    }
    return rolloverEnvironments.filter((environment) =>
      [
        environment.environment_id,
        environment.environment_name,
        environment.environment_type,
        environment.service_environment || '',
        environment.owner_team || '',
        environment.connection.host || '',
        environment.connection.dsn || '',
        environment.connection.jdbc_url || '',
        environment.connection.database_name || '',
        environment.connection.instance_name || '',
        environment.connection.sid || '',
        environment.connection.service_name || '',
        ...environment.rules.flatMap((rule) => [
          rule.rule_id,
          rule.table_name,
          rule.column_name,
          rule.source_value,
          rule.target_value,
          rule.description || '',
        ]),
      ]
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [deferredQuery, rolloverEnvironments]);

  const databaseServices = useMemo(
    () => services.filter(isDatabaseAwareService),
    [services],
  );

  const oracleDatabaseServices = useMemo(
    () => databaseServices.filter((service) => (service.database_profile?.platform || service.service_type).toLowerCase().includes('oracle')),
    [databaseServices],
  );

  const rolloverLinkedServices = useMemo(() => {
    const serviceEnvironment = (rolloverDraft.service_environment || selectedRolloverEnvironment?.service_environment || '').trim().toLowerCase();
    if (!serviceEnvironment) {
      return [];
    }
    return services.filter((service) => service.environment.toLowerCase() === serviceEnvironment);
  }, [rolloverDraft.service_environment, selectedRolloverEnvironment?.service_environment, services]);

  const selectedRolloverExecutions = useMemo(
    () => rolloverExecutions.filter((execution) => execution.environment_id === (selectedRolloverEnvironmentId || rolloverDraft.environment_id)),
    [rolloverDraft.environment_id, rolloverExecutions, selectedRolloverEnvironmentId],
  );

  const selectedRolloverReminders = useMemo(
    () => rolloverReminders.filter((reminder) => reminder.environment_id === (selectedRolloverEnvironmentId || rolloverDraft.environment_id)),
    [rolloverDraft.environment_id, rolloverReminders, selectedRolloverEnvironmentId],
  );

  const databaseDependencyEdges = useMemo(
    () => dependencies.filter(isDatabaseDependency),
    [dependencies],
  );

  const servicesMissingDatabaseDeclaration = useMemo(
    () =>
      services.filter((service) => {
        if (!serviceUsuallyNeedsDatabaseDeclaration(service)) {
          return false;
        }
        const hasOutgoingDatabaseEdge = dependencies.some(
          (edge) => edge.from_service_id === service.service_id && isDatabaseDependency(edge),
        );
        return !isDatabaseAwareService(service) && !hasOutgoingDatabaseEdge;
      }),
    [dependencies, services],
  );

  const incompleteDatabaseContracts = useMemo(
    () =>
      databaseServices.filter((service) => {
        const profile = service.database_profile;
        return !profile || !hasText(profile.platform) || !hasText(profile.database_name || profile.service_name || profile.instance_name);
      }),
    [databaseServices],
  );

  const filteredDatabaseServices = useMemo(() => {
    if (!deferredQuery) {
      return databaseServices;
    }
    return databaseServices.filter((service) =>
      [
        service.service_id,
        service.service_name,
        service.owner_team,
        service.environment,
        service.service_type,
        service.database_profile?.platform,
        service.database_profile?.host,
        service.database_profile?.database_name,
        service.database_profile?.service_name,
        service.database_profile?.instance_name,
        service.database_profile?.username,
        service.database_profile?.jdbc_url,
        service.database_profile?.role,
        service.database_profile?.connection_pool,
        ...(service.database_profile?.schemas || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [databaseServices, deferredQuery]);

  const filteredDatabaseDependencies = useMemo(() => {
    if (!deferredQuery) {
      return databaseDependencyEdges;
    }
    return databaseDependencyEdges.filter((edge) =>
      [
        edge.edge_id,
        edge.cluster_id,
        edge.from_service_id,
        edge.to_service_id,
        edge.dependency_purpose,
        edge.database_access?.access_mode,
        edge.database_access?.connection_pool,
        edge.database_access?.query_fingerprint_scope,
        ...(edge.database_access?.schema_names || []),
        ...(edge.database_access?.operation_types || []),
        ...(edge.database_access?.expected_error_codes || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(deferredQuery),
    );
  }, [databaseDependencyEdges, deferredQuery]);

  const databaseReadinessPercent = useMemo(() => {
    const completeSignals = databaseServices.length + databaseDependencyEdges.length;
    const gaps = servicesMissingDatabaseDeclaration.length + incompleteDatabaseContracts.length;
    const total = completeSignals + gaps;
    return total ? Math.round((completeSignals / total) * 100) : 0;
  }, [
    databaseDependencyEdges.length,
    databaseServices.length,
    incompleteDatabaseContracts.length,
    servicesMissingDatabaseDeclaration.length,
  ]);

  const suggestedCopilotQuestions = useMemo(() => {
    if (!selectedIncident) {
      return [];
    }
    const rootService = selectedIncident.suspected_root_service_name || 'the suspected root service';
    return [
      `What should I verify first before taking action on ${rootService}?`,
      `Which SOP-backed checks apply before approving a restart for ${rootService}?`,
      `How should I validate recovery for ${selectedIncident.title}?`,
    ];
  }, [selectedIncident]);

  const detailTabs = useMemo(
    () => [
      { id: 'overview' as const, label: 'Overview', icon: <FaShieldAlt />, count: selectedIncident?.affected_services.length || 0 },
      { id: 'topology' as const, label: 'Topology', icon: <FaNetworkWired />, count: graphContext?.nodes.length || 0 },
      { id: 'evidence' as const, label: 'Evidence', icon: <FaSignal />, count: selectedIncident?.evidence_timeline.length || 0 },
      { id: 'actions' as const, label: 'Actions', icon: <FaWrench />, count: actionDeckCount },
      { id: 'procedure' as const, label: 'SOP Copilot', icon: <FaCommentDots />, count: copilotTurns.length },
      { id: 'outcome' as const, label: 'Outcome', icon: <FaCheckCircle />, count: selectedIncident?.verdict ? 1 : 0 },
    ],
    [actionDeckCount, copilotTurns.length, graphContext?.nodes.length, selectedIncident],
  );

  const workspaceTabs = useMemo(
    () => [
      { id: 'incidents' as const, label: 'Incidents', icon: <FaBroadcastTower />, count: operationalIncidents.length },
      { id: 'services' as const, label: 'Services', icon: <FaServer />, count: services.length },
      { id: 'agents' as const, label: 'Agents', icon: <FaPlug />, count: lightAgents.length },
      { id: 'databases' as const, label: 'Databases', icon: <FaDatabase />, count: databaseServices.length },
      { id: 'rollover' as const, label: 'Rollover', icon: <FaSyncAlt />, count: rolloverEnvironments.length },
      { id: 'clusters' as const, label: 'Clusters', icon: <FaProjectDiagram />, count: clusters.length },
      { id: 'flows' as const, label: 'Flows', icon: <FaLink />, count: businessFlows.length },
      { id: 'dependencies' as const, label: 'Dependencies', icon: <FaCodeBranch />, count: dependencies.length },
      { id: 'sops' as const, label: 'SOPs', icon: <FaBook />, count: sopCorpusSummary.indexed || indexedSops.length },
      { id: 'onboarding' as const, label: 'Onboarding', icon: <FaCloudUploadAlt />, count: fabricSummary?.restart_ready_services || 0 },
    ],
    [
      businessFlows.length,
      clusters.length,
      databaseServices.length,
      dependencies.length,
      fabricSummary?.restart_ready_services,
      indexedSops.length,
      lightAgents.length,
      sopCorpusSummary.indexed,
      operationalIncidents.length,
      rolloverEnvironments.length,
      services.length,
    ],
  );

  const onboardingReadiness = useMemo(() => {
    const service = selectedService || services[0];
    if (!service) {
      return [];
    }
    const clusterCoverage = service.cluster_ids.length > 0;
    const dependencyCoverage = dependencies.some(
      (edge) => edge.from_service_id === service.service_id || edge.to_service_id === service.service_id,
    );
    const flowCoverage = businessFlows.some(
      (flow) =>
        flow.entry_service_ids.includes(service.service_id) ||
        flow.steps.some((step) => step.service_id === service.service_id),
    );
    const outgoingDatabaseEdges = dependencies.filter(
      (edge) => edge.from_service_id === service.service_id && isDatabaseDependency(edge),
    );
    const databaseCoverage =
      !serviceUsuallyNeedsDatabaseDeclaration(service) ||
      isDatabaseAwareService(service) ||
      outgoingDatabaseEdges.length > 0;
    return [
      {
        label: 'Network Sentinel mapping',
        ready: Boolean(service.observation_config.network_service_id),
        detail: service.observation_config.network_service_id || 'Map the live network service UUID.',
      },
      {
        label: 'Light agent identity',
        ready: Boolean(service.observation_config.agent_id || service.observation_config.systemd_unit),
        detail: service.observation_config.agent_id || service.observation_config.systemd_unit || 'Define agent_id or systemd unit.',
      },
      {
        label: 'Health and collector endpoints',
        ready: Boolean(service.endpoint_config.healthcheck_url && service.endpoint_config.collector_url),
        detail: service.endpoint_config.healthcheck_url || service.endpoint_config.collector_url || 'Add collector_url and healthcheck_url.',
      },
      {
        label: 'Logs, metrics, and traces contract',
        ready: Boolean(
          service.endpoint_config.logs_url &&
          service.endpoint_config.metrics_url &&
          service.endpoint_config.traces_url &&
          service.observation_config.log_selector,
        ),
        detail: service.observation_config.log_selector || 'Define log selector and telemetry endpoints.',
      },
      {
        label: 'Cluster membership',
        ready: clusterCoverage,
        detail: clusterCoverage ? service.cluster_ids.join(', ') : 'Attach this service to at least one dependency cluster.',
      },
      {
        label: 'Business flow placement',
        ready: flowCoverage,
        detail: flowCoverage ? 'Service participates in a business flow.' : 'Add this service to the access, transaction, or channel flow it belongs to.',
      },
      {
        label: 'Typed dependency edges',
        ready: dependencyCoverage,
        detail: dependencyCoverage ? 'Dependency edges declared.' : 'Declare upstream/downstream dependencies.',
      },
      {
        label: 'Database dependency contract',
        ready: databaseCoverage,
        detail: databaseCoverage
          ? isDatabaseAwareService(service)
            ? databaseLabel(service.database_profile)
            : `${outgoingDatabaseEdges.length} database edge(s) declared.`
          : 'Declare the backing database service/profile or add an app-to-database dependency edge.',
      },
      {
        label: 'Diagnostics contract',
        ready: Boolean(
          service.allow_diagnostics &&
          (service.endpoint_config.diagnostics_url ||
            service.certification.lifecycle_stage === 'diagnostics_ready' ||
            service.certification.lifecycle_stage === 'restart_ready'),
        ),
        detail: service.endpoint_config.diagnostics_url || 'Set diagnostics_url before diagnostics_ready certification.',
      },
      {
        label: 'Restart guardrails',
        ready: Boolean(
          service.is_stateless &&
          service.restart_policy.allow_restart &&
          service.endpoint_config.restart_url &&
          service.certification.lifecycle_stage === 'restart_ready',
        ),
        detail: service.endpoint_config.restart_url || 'Restart remains blocked until stateless policy and restart_url are set.',
      },
    ];
  }, [businessFlows, dependencies, selectedService, services]);

  const selectedServiceIncidents = useMemo(() => {
    if (!selectedService) return [];
    return incidents
      .filter((incident) =>
        incident.affected_services.includes(selectedService.service_id) ||
        incident.suspected_root_service === selectedService.service_id ||
        incident.root_cause_candidates.some((candidate) => candidate.service_id === selectedService.service_id),
      )
      .sort((left, right) => timestampMs(right.start_time) - timestampMs(left.start_time));
  }, [incidents, selectedService]);

  const timelineService = useMemo(
    () => services.find((item) => item.service_id === timelineServiceId) || null,
    [services, timelineServiceId],
  );

  const timelineIncidents = useMemo(() => {
    if (!timelineService) return [];
    return incidents
      .filter((incident) =>
        incident.affected_services.includes(timelineService.service_id) ||
        incident.suspected_root_service === timelineService.service_id ||
        incident.root_cause_candidates.some((candidate) => candidate.service_id === timelineService.service_id),
      )
      .sort((left, right) => timestampMs(right.start_time) - timestampMs(left.start_time));
  }, [incidents, timelineService]);

  const timelineImpactActiveCount = useMemo(
    () => timelineIncidents.filter(isOperationalImpactActive).length,
    [timelineIncidents],
  );

  const timelineVerdictPendingCount = useMemo(
    () => timelineIncidents.filter(isPendingOperatorVerdict).length,
    [timelineIncidents],
  );

  const selectedServiceEvidence = useMemo(() => {
    if (!selectedService) return [];
    return selectedServiceIncidents
      .flatMap((incident) => incident.evidence_timeline)
      .filter((evidence) => evidence.service_id === selectedService.service_id)
      .sort((left, right) => timestampMs(right.timestamp) - timestampMs(left.timestamp));
  }, [selectedService, selectedServiceIncidents]);

  const selectedServiceDependencies = useMemo(() => {
    if (!selectedService) return { upstream: [] as DependencyEdge[], downstream: [] as DependencyEdge[] };
    return {
      upstream: dependencies.filter((edge) => edge.from_service_id === selectedService.service_id),
      downstream: dependencies.filter((edge) => edge.to_service_id === selectedService.service_id),
    };
  }, [dependencies, selectedService]);

  const selectedServiceFlows = useMemo(() => {
    if (!selectedService) return [];
    return businessFlows.filter((flow) =>
      flow.entry_service_ids.includes(selectedService.service_id) ||
      flow.steps.some((step) => step.service_id === selectedService.service_id),
    );
  }, [businessFlows, selectedService]);

  const selectedServiceSignalStatus = useMemo(() => {
    if (!selectedService) return { label: 'Unselected', tone: 'idle', detail: 'Choose a service to inspect.' };
    const activeIncident = selectedServiceIncidents.find(isOperationalImpactActive);
    if (activeIncident) {
      const activeRisk = displayRiskLevelForIncident(activeIncident);
      return {
        label: activeRisk,
        tone: activeRisk.toLowerCase(),
        detail: `${activeIncident.title} is currently influencing this service.`,
      };
    }
    const pendingIncident = selectedServiceIncidents.find(isPendingOperatorVerdict);
    if (pendingIncident) {
      return {
        label: 'Pending verdict',
        tone: 'low',
        detail: 'Operational impact has ended, but Nexus is waiting for the operator verdict to close the learning loop.',
      };
    }
    if (selectedServiceEvidence.length) {
      return {
        label: 'Observed',
        tone: 'observed',
        detail: `Last evidence ${formatRelativeMinutes(selectedServiceEvidence[0].timestamp)}.`,
      };
    }
    return {
      label: 'Quiet',
      tone: 'quiet',
      detail: 'No active Nexus incident evidence is attached to this service.',
    };
  }, [selectedService, selectedServiceEvidence, selectedServiceIncidents]);

  const servicesByStage = useMemo(() => {
    const grouped = certificationOptions.reduce<Record<string, CatalogService[]>>((acc, stage) => {
      acc[stage] = [];
      return acc;
    }, {});
    for (const service of services) {
      grouped[service.certification.lifecycle_stage].push(service);
    }
    return grouped;
  }, [services]);

  const setWorkspaceTab = (workspace: WorkspaceTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('workspace', workspace);
    setSearchParams(nextParams, { replace: true });
  };

  const selectIncident = (incident: NexusIncident) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('incident', incident.incident_id);
    setSearchParams(nextParams, { replace: true });
  };

  const selectDetailTab = (tab: NexusDetailTab) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('tab', tab);
    setSearchParams(nextParams, { replace: true });
  };

  const closeIncidentModal = () => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('incident');
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  };

  const openIncidentServiceControl = () => {
    if (!selectedIncident) {
      return;
    }
    const serviceId = selectedIncident.suspected_root_service || selectedIncident.affected_services[0] || null;
    if (!serviceId || !serviceMap[serviceId]) {
      addNotification({
        type: 'warning',
        message: 'Nexus could not map this incident to a service control contract.',
        priority: 'high',
      });
      return;
    }
    resetEditorHydration('service');
    setCreatingService(false);
    setSelectedServiceId(serviceId);
    setTimelineServiceId(serviceId);
    setServicePanelMode('overview');
    setServiceLiveState(null);
    setServiceControlError(null);
    setServiceControlChallenge(null);
    setServiceControlCode('');
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set('workspace', 'services');
    nextParams.delete('incident');
    nextParams.delete('tab');
    setSearchParams(nextParams, { replace: true });
  };

  const closeServiceModal = () => {
    resetEditorHydration('service');
    setCreatingService(false);
    setSelectedServiceId(null);
    setTimelineServiceId(null);
    setServicePanelMode('overview');
    setServiceLiveState(null);
    setServiceDraft(createEmptyService());
    setServiceMetadataText('{}');
    setDatabaseTestPassword('');
    setDatabaseConnectionTest(null);
  };

  const closeRolloverModal = () => {
    resetEditorHydration('rollover');
    setCreatingRolloverEnvironment(false);
    setSelectedRolloverEnvironmentId(null);
    setRolloverPanelMode('command');
    setRolloverDraft(createEmptyRolloverEnvironment());
    setRolloverMetadataText('{}');
    setRolloverCredentialPassword('');
    setRolloverAssessment(null);
    setRolloverConnectionTest(null);
    setRolloverChallenge(null);
    setRolloverOtpCode('');
  };

  const closeClusterModal = () => {
    resetEditorHydration('cluster');
    setCreatingCluster(false);
    setSelectedClusterId(null);
    setClusterDraft(createEmptyCluster());
    setClusterMetadataText('{}');
  };

  const closeFlowModal = () => {
    resetEditorHydration('flow');
    setCreatingFlow(false);
    setSelectedFlowId(null);
    setFlowDraft(createEmptyBusinessFlow());
    setFlowMetadataText('{}');
  };

  const closeDependencyModal = () => {
    resetEditorHydration('edge');
    setCreatingEdge(false);
    setSelectedEdgeId(null);
    setEdgeDraft(createEmptyEdge());
    setEdgeMetadataText('{}');
  };

  const closeSopModal = () => {
    resetEditorHydration('sop');
    setCreatingSop(false);
    setSelectedSopId(null);
    setSopDraft(createEmptyManagedSop());
    setSopMetadataText('{}');
  };

  const notifyAdminOnly = () => {
    addNotification({
      type: 'warning',
      message: 'Only SentinelOps administrators can modify the Nexus catalog and control-plane configuration.',
      priority: 'medium',
    });
  };

  const refreshEverything = async () => {
    await loadWorkspace();
  };

  const syncNetworkSentinel = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setSyncBusy(true);
    try {
      const summary = await nexusApi.syncNetworkSentinel(true);
      await loadWorkspace();
      addNotification({
        type: 'success',
        message: summary.sync_message || 'Network Sentinel synchronization completed.',
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Network Sentinel synchronization failed.',
        priority: 'high',
      });
    } finally {
      setSyncBusy(false);
    }
  };

  const copyAgentToken = async (token?: string | null) => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      addNotification({
        type: 'success',
        message: 'Nexus light-agent token copied. Paste it into the agent environment as NEXUS_AGENT_API_TOKEN.',
        priority: 'medium',
      });
    } catch {
      window.prompt('Copy the Nexus light-agent token now. It will not be shown again.', token);
    }
  };

  const generateAgentToken = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    const hasExistingToken = Boolean(agentTokenStatus?.configured);
    const rotate = hasExistingToken
      ? window.confirm(
        'A Nexus light-agent token already exists. Generate a new token and rotate the active credential now? Choose Cancel to keep the old token.',
      )
      : false;
    if (hasExistingToken && !rotate) {
      addNotification({
        type: 'info',
        message: 'Existing Nexus light-agent token kept. No agent credential changed.',
        priority: 'medium',
      });
      return;
    }

    setAgentTokenBusy(true);
    try {
      const result = await nexusApi.generateAgentToken(rotate);
      setGeneratedAgentToken(result);
      setAgentTokenStatus(result);
      addNotification({
        type: 'success',
        message: result.rotated ? 'Nexus light-agent token rotated.' : 'Nexus light-agent token generated.',
        priority: 'high',
      });
      await copyAgentToken(result.token);
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Nexus light-agent token generation failed.',
        priority: 'high',
      });
    } finally {
      setAgentTokenBusy(false);
    }
  };

  const runAction = async (actionKey: string, work: () => Promise<void>) => {
    setActionBusy(actionKey);
    try {
      await work();
      await loadWorkspace();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Sentinel Nexus could not complete that action.',
        priority: 'high',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const buildCopilotQuery = (question: string) => {
    if (!selectedIncident) {
      return question;
    }
    const priorTurns = copilotTurns.slice(-2);
    const conversationContext = priorTurns.length
      ? priorTurns
        .map(
          (turn, index) =>
            `Prior turn ${index + 1} operator question: ${turn.question}\nPrior turn ${index + 1} SOP answer: ${turn.response.answer}`,
        )
        .join('\n\n')
      : '';

    return [
      `Incident: ${selectedIncident.title}`,
      `Summary: ${selectedIncident.summary}`,
      `Risk level: ${displayRiskLevelForIncident(selectedIncident)}`,
      `Failure domain: ${selectedIncident.failure_domain}`,
      `Business flow: ${selectedIncident.primary_business_flow_name || selectedIncident.primary_business_flow_id || 'unassigned'}`,
      `Probable root cause: ${selectedIncident.suspected_root_service_name || 'pending'}`,
      `Affected services: ${selectedIncident.affected_services.join(', ')}`,
      `Clusters: ${selectedIncident.cluster_ids.join(', ') || 'unassigned'}`,
      conversationContext,
      `Current operator question: ${question}`,
    ]
      .filter(Boolean)
      .join('\n\n');
  };

  const buildIncidentBriefQuery = () => {
    if (!selectedIncident) {
      return '';
    }
    const candidates = selectedIncident.root_cause_candidates
      .slice(0, 4)
      .map(
        (candidate, index) =>
          `${index + 1}. ${candidate.service_name} (${scorePercent(candidate.confidence)} confidence): ${candidate.explanation}`,
      )
      .join('\n');
    const evidence = selectedIncident.evidence_timeline
      .slice(0, 8)
      .map(
        (item, index) =>
          `${index + 1}. ${formatDateTime(item.timestamp)} ${item.service_name} ${item.evidence_class}: ${item.summary}`,
      )
      .join('\n');
    const recommendations = selectedIncident.recommendations
      .map(
        (recommendation, index) =>
          `${index + 1}. ${recommendationLabel(recommendation.action_type)} (${recommendation.status}, eligible=${recommendation.eligible}): ${recommendation.justification}`,
      )
      .join('\n');

    return [
      'You are Sentinel Nexus iNterpret mode. Read this incident for the operator in plain operational language.',
      'The operator should not have to manually analyze the incident after reading this. Explain what happened, what Nexus knows, what Nexus only infers, why the current root candidate fits or does not fit, what uncertainty remains, and the safest next move.',
      'Use a normal descriptive message with short paragraphs and compact bullets only where they help. Do not produce a generic report template.',
      'Strict SOP rule: only use SOP evidence if it explicitly matches this incident service, affected system, business flow, environment, or failure domain. If the matched SOPs are weak or unrelated, say Nexus does not have enough SOP-backed guidance for this incident and continue with Nexus evidence only. Never borrow an IDC, DR, database, or service-control SOP for a Mobile Banking/USSD incident unless the incident facts explicitly include that dependency as the failing party.',
      `Incident: ${selectedIncident.title}`,
      `Status: ${selectedIncident.status}`,
      `Risk: ${displayRiskLevelForIncident(selectedIncident)} (${scorePercent(selectedIncident.risk_score)} score)`,
      `Started: ${formatDateTime(selectedIncident.start_time)}`,
      `Duration: ${incidentDurationLabel(selectedIncident)}`,
      `Failure domain: ${selectedIncident.failure_domain}`,
      `Business flow: ${selectedIncident.primary_business_flow_name || selectedIncident.primary_business_flow_id || 'unassigned'}`,
      `Affected services: ${selectedIncident.affected_services.join(', ')}`,
      `Blast radius: ${selectedIncident.blast_radius.join(', ') || 'none declared'}`,
      `Root candidates:\n${candidates || 'No root-cause candidates yet.'}`,
      `Evidence:\n${evidence || 'No evidence timeline yet.'}`,
      `Recommendations:\n${recommendations || 'No action recommendations yet.'}`,
      `Verdict state: ${selectedIncident.verdict ? 'operator verdict recorded' : 'awaiting operator verdict for learning'}`,
    ].join('\n\n');
  };

  const generateIncidentBrief = async () => {
    if (!selectedIncident) {
      return;
    }
    setIncidentBriefBusy(true);
    setIncidentBriefError(null);
    try {
      const response = await nexusApi.askProcedureGuidance({
        query: buildIncidentBriefQuery(),
        scope: 'nexus_incident_interpretation',
        trace: true,
        user_context: {
          user_id: (user as any)?.id || null,
          username: user?.username || user?.email || actor,
          role: (user as any)?.role || null,
          shift: (user as any)?.shift || null,
          department: (user as any)?.department || null,
        },
        system_context: {
          environment: serviceMap[selectedIncident.suspected_root_service || '']?.environment || null,
          affected_systems: selectedIncident.affected_services,
          urgency: displayRiskLevelForIncident(selectedIncident),
          incident_id: selectedIncident.incident_id,
        },
      });
      setIncidentBrief(response);
    } catch (err: any) {
      setIncidentBriefError(err?.response?.data?.detail || err?.message || 'AI incident brief could not be generated right now.');
    } finally {
      setIncidentBriefBusy(false);
    }
  };

  const askCopilot = async () => {
    if (!selectedIncident || !copilotQuestion.trim()) {
      return;
    }
    setCopilotBusy(true);
    setCopilotError(null);
    try {
      const response = await nexusApi.askProcedureGuidance({
        query: buildCopilotQuery(copilotQuestion.trim()),
        user_context: {
          user_id: (user as any)?.id || null,
          username: user?.username || user?.email || actor,
          role: (user as any)?.role || null,
          shift: (user as any)?.shift || null,
          department: (user as any)?.department || null,
        },
        system_context: {
          environment: serviceMap[selectedIncident.suspected_root_service || '']?.environment || null,
          affected_systems: selectedIncident.affected_services,
          urgency: displayRiskLevelForIncident(selectedIncident),
          incident_id: selectedIncident.incident_id,
        },
      });
      setCopilotTurns((current) => [
        ...current,
        {
          id: response.trace_id,
          question: copilotQuestion.trim(),
          response,
        },
      ]);
      setCopilotQuestion('');
    } catch (err: any) {
      setCopilotError(err?.response?.data?.detail || err?.message || 'SOP copilot could not answer right now.');
    } finally {
      setCopilotBusy(false);
    }
  };

  const askServiceTimeline = async (questionOverride?: string) => {
    const question = (questionOverride || timelineChatQuestion).trim();
    if (!timelineService || !question) {
      return;
    }
    setTimelineChatBusy(true);
    setTimelineChatError(null);
    setTimelinePendingQuestion(question);
    beginTimelineInference();
    let completed = false;
    try {
      const history: ServiceTimelineChatMessage[] = timelineChatTurns.slice(-6).flatMap((turn) => [
        { role: 'operator' as const, content: turn.question, created_at: turn.createdAt },
        { role: 'nexus' as const, content: turn.response.answer, created_at: turn.createdAt },
      ]);
      const response = await nexusApi.askServiceTimeline(
        timelineService.service_id,
        question,
        history,
        applicationTimeZone,
      );
      setTimelineChatTurns((current) => [
        ...current,
        {
          id: response.trace_id,
          question,
          response,
          createdAt: new Date().toISOString(),
        },
      ]);
      setTimelineChatSuggestions(response.suggestions?.length ? response.suggestions : timelineChatSuggestions);
      setTimelineChatQuestion('');
      completed = true;
    } catch (err: any) {
      setTimelineChatError(err?.response?.data?.detail || err?.message || 'Nexus could not answer this service timeline question right now.');
    } finally {
      setTimelineChatBusy(false);
      setTimelinePendingQuestion('');
      if (completed) {
        settleTimelineInference();
      } else {
        clearTimelineInferenceTimers();
        setTimelineInferencePhase('idle');
      }
    }
  };

  const requestDiagnostics = async () => {
    if (!selectedIncident) {
      return;
    }
    await runAction('diagnostics', async () => {
      const bundle = await nexusApi.requestDiagnostics(selectedIncident.incident_id, actor);
      addNotification({
        type: 'success',
        message: `Diagnostics bundle ${bundle.bundle_id} prepared for ${selectedIncident.suspected_root_service_name || 'the focused service'}.`,
        priority: 'medium',
      });
    });
  };

  const createTask = async () => {
    if (!selectedIncident) {
      return;
    }
    await runAction('task', async () => {
      const task = await nexusApi.createTaskHandoff(selectedIncident.incident_id, actor);
      addNotification({
        type: 'success',
        message: `Nexus task handoff ${task.task_id} created for ${selectedIncident.title}.`,
        priority: 'medium',
      });
    });
  };

  const requestSelectedServiceDiagnostics = async () => {
    if (!selectedService) return;
    await runAction('service-diagnostics', async () => {
      const bundle = await nexusApi.requestServiceDiagnostics(selectedService.service_id, actor, 'Service command-center diagnostics requested by operator.');
      addNotification({
        type: bundle.dispatch_status?.startsWith('sent') ? 'success' : 'warning',
        message: `Diagnostics bundle ${bundle.bundle_id} ${bundle.dispatch_status || 'prepared'} for ${selectedService.service_name}.`,
        priority: 'medium',
      });
      await refreshServiceLiveState(selectedService.service_id, { silent: true });
    });
  };

  const openServiceSignalExplorer = async (source: string | null = null) => {
    if (!selectedService) return;
    setSourceExplorer({ source });
    setSourceExplorerLoading(true);
    setSourceExplorerError(null);
    try {
      const feed = await nexusApi.getServiceSignals(selectedService.service_id, { source, limit: 180, sinceHours: 24 });
      setSourceExplorerData(feed);
    } catch (err: any) {
      setSourceExplorerError(err?.response?.data?.detail || err?.message || 'Nexus could not load this signal source.');
    } finally {
      setSourceExplorerLoading(false);
    }
  };

  const refreshServiceSignalExplorer = async () => {
    if (!selectedService || !sourceExplorer) return;
    await openServiceSignalExplorer(sourceExplorer.source);
  };

  const normalizeLogTail = useCallback((tail: NexusServiceLogTail): NexusServiceLogTail => ({
    ...tail,
    lines: [...(tail.lines || [])].sort((left, right) => {
      const rightTime = timestampMs(right.timestamp);
      const leftTime = timestampMs(left.timestamp);
      if (rightTime !== leftTime) return rightTime - leftTime;
      return Number(right.index || 0) - Number(left.index || 0);
    }),
  }), []);

  const mergeLogTailWindow = useCallback((
    current: NexusServiceLogTail | null,
    incoming: NexusServiceLogTail,
    reset: boolean,
  ): NexusServiceLogTail => {
    const normalizedIncoming = normalizeLogTail(incoming);
    if (reset || !current || incoming.rotated || String(incoming.tail_mode || '').startsWith('snapshot')) {
      return { ...normalizedIncoming, lines: normalizedIncoming.lines.slice(0, 220) };
    }
    const seen = new Set<string>();
    const merged = [...normalizedIncoming.lines, ...(current.lines || [])].filter((line) => {
      const key = `${line.index}:${line.timestamp || ''}:${line.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      ...normalizedIncoming,
      lines: merged.slice(0, 220),
    };
  }, [normalizeLogTail]);

  const fetchServiceLogTail = useCallback(async ({ reset = false, follow = false }: { reset?: boolean; follow?: boolean } = {}) => {
    if (!selectedService) return;
    if (logTailRefreshInFlightRef.current) return;
    logTailRefreshInFlightRef.current = true;
    if (reset) {
      setLogTailLoading(true);
    }
    setLogTailError(null);
    try {
      const tail = await nexusApi.getServiceLogTail(selectedService.service_id, follow ? 80 : 140, follow ? logTailCursor : null);
      setLogTailData((current) => mergeLogTailWindow(current, tail, reset));
      setLogTailCursor(Number.isFinite(Number(tail.cursor ?? tail.file_size)) ? Number(tail.cursor ?? tail.file_size) : null);
    } catch (err: any) {
      setLogTailError(err?.response?.data?.detail || err?.message || 'Nexus could not load the live log tail.');
    } finally {
      logTailRefreshInFlightRef.current = false;
      if (reset) {
        setLogTailLoading(false);
      }
    }
  }, [logTailCursor, mergeLogTailWindow, selectedService]);

  const openServiceLogTail = async () => {
    if (!selectedService) return;
    setLogTailOpen(true);
    setLogTailFollowing(true);
    setLogTailCursor(null);
    setLogTailData(null);
    await fetchServiceLogTail({ reset: true });
  };

  const refreshServiceLogTail = async () => {
    setLogTailCursor(null);
    await fetchServiceLogTail({ reset: true });
  };

  useEffect(() => {
    if (!logTailOpen || !logTailFollowing || !selectedServiceId) {
      return undefined;
    }
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchServiceLogTail({ follow: true });
    }, 2500);
    return () => window.clearInterval(interval);
  }, [fetchServiceLogTail, logTailFollowing, logTailOpen, selectedServiceId]);

  const openServiceControlGate = async (operation: NexusServiceControlOperation) => {
    if (!selectedService) return;
    setServiceControlCode('');
    serviceControlAutoSubmitRef.current = null;
    setServiceControlError(null);
    setServiceControlBusy(operation);
    try {
      const challenge = await nexusApi.requestServiceControlChallenge(
        selectedService.service_id,
        operation,
        serviceControlReason || `Planned ${operation} requested from Sentinel Nexus command center.`,
      );
      setServiceControlChallenge(challenge);
      addNotification({
        type: 'success',
        message: `Nexus sent a one-time ${operation.toUpperCase()} verification code to ${challenge.email}.`,
        priority: 'high',
      });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || `Nexus could not open the ${operation} control gate.`;
      setServiceControlError(detail);
      addNotification({ type: 'error', message: detail, priority: 'high' });
    } finally {
      setServiceControlBusy(null);
    }
  };

  const handleServiceControlCodeChange = (value: string) => {
    const sanitized = value.replace(/\D/g, '').slice(0, 6);
    if (sanitized.length < 6) {
      serviceControlAutoSubmitRef.current = null;
    }
    setServiceControlError(null);
    setServiceControlCode(sanitized);
  };

  const executeServiceControl = useCallback(async () => {
    if (!selectedService || !serviceControlChallenge) return;
    setServiceControlBusy(`execute-${serviceControlChallenge.operation}`);
    setServiceControlError(null);
    try {
      const execution = await nexusApi.executeServiceControl(
        selectedService.service_id,
        serviceControlChallenge.operation,
        serviceControlChallenge.challenge_id,
        serviceControlCode,
        serviceControlReason || `OTP-approved ${serviceControlChallenge.operation} from Sentinel Nexus command center.`,
      );
      const primaryExecutionMessage =
        execution.result_summary ||
        `${serviceControlChallenge.operation.toUpperCase()} moved to ${execution.status.toLowerCase()} for ${selectedService.service_name}.`;
      const extraReasons = execution.status === 'BLOCKED'
        ? (execution.blocked_reasons || []).filter((reason) => reason && !primaryExecutionMessage.includes(reason))
        : [];
      const executionDetail = [primaryExecutionMessage, ...extraReasons].filter(Boolean).join(' ');
      addNotification({
        type: execution.status === 'BLOCKED' ? 'warning' : 'success',
        message: executionDetail,
        priority: 'high',
      });
      if (execution.status === 'BLOCKED') {
        setServiceControlError(executionDetail);
      }
      setServiceControlChallenge(null);
      setServiceControlCode('');
      setServiceControlReason('');
      scheduleControlBurstRefresh(selectedService.service_id);
      await loadWorkspace();
      await refreshServiceLiveState(selectedService.service_id, { silent: true });
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Nexus could not verify or execute the service control request.';
      setServiceControlError(detail);
      addNotification({ type: 'error', message: detail, priority: 'high' });
    } finally {
      setServiceControlBusy(null);
    }
  }, [
    addNotification,
    loadWorkspace,
    refreshServiceLiveState,
    scheduleControlBurstRefresh,
    selectedService,
    serviceControlChallenge,
    serviceControlCode,
    serviceControlReason,
  ]);

  useEffect(() => {
    serviceControlAutoSubmitRef.current = null;
  }, [serviceControlChallenge?.challenge_id]);

  useEffect(() => {
    if (!selectedService || !serviceControlChallenge || serviceControlCode.length !== 6 || serviceControlBusy) {
      return;
    }
    const submitKey = `${serviceControlChallenge.challenge_id}:${serviceControlCode}`;
    if (serviceControlAutoSubmitRef.current === submitKey) {
      return;
    }
    serviceControlAutoSubmitRef.current = submitKey;
    void executeServiceControl();
  }, [executeServiceControl, selectedService, serviceControlChallenge, serviceControlCode, serviceControlBusy]);

  const submitVerdict = async () => {
    if (!selectedIncident) {
      return;
    }
    await runAction('verdict', async () => {
      await nexusApi.recordVerdict(selectedIncident.incident_id, actor, verdict, actualRoot || undefined, verdictNotes || undefined);
      addNotification({
        type: 'success',
        message: 'Incident verdict recorded successfully.',
        priority: 'medium',
      });
      setVerdictNotes('');
    });
  };

  const startNewService = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('service');
    setCreatingService(true);
    setSelectedServiceId(null);
    setServicePanelMode('configuration');
    setServiceLiveState(null);
    setServiceDraft(createEmptyService());
    setServiceMetadataText('{}');
    setDatabaseTestPassword('');
    setDatabaseConnectionTest(null);
  };

  const startNewDatabaseService = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('service');
    const draft = createEmptyService();
    setCreatingService(true);
    setSelectedServiceId(null);
    setServicePanelMode('configuration');
    setServiceLiveState(null);
    setServiceDraft({
      ...draft,
      service_type: 'db',
      is_stateless: false,
      restart_policy: {
        ...draft.restart_policy,
        allow_restart: false,
        allowed_service_types: [],
      },
      database_profile: {
        ...createEmptyDatabaseProfile(),
        enabled: true,
        shared_dependency: true,
        role: 'primary',
        expected_evidence: [
          'connection_state',
          'active_sessions',
          'connection_pool_usage',
          'lock_waits',
          'db_error_code',
          'replication_lag',
          'tablespace_pressure',
        ],
        safe_diagnostics: [
          'connectivity',
          'sessions',
          'locks',
          'blocking_sessions',
          'slow_queries',
          'replication_lag',
          'tablespace_usage',
        ],
      },
    });
    setServiceMetadataText('{}');
    setDatabaseTestPassword('');
    setDatabaseConnectionTest(null);
    setWorkspaceTab('services');
  };

  const startNewCluster = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('cluster');
    setCreatingCluster(true);
    setSelectedClusterId(null);
    setClusterDraft(createEmptyCluster());
    setClusterMetadataText('{}');
  };

  const startNewFlow = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('flow');
    setCreatingFlow(true);
    setSelectedFlowId(null);
    setFlowDraft(createEmptyBusinessFlow());
    setFlowMetadataText('{}');
  };

  const startNewDependency = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('edge');
    setCreatingEdge(true);
    setSelectedEdgeId(null);
    setEdgeDraft(createEmptyEdge());
    setEdgeMetadataText('{}');
  };

  const startNewSop = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('sop');
    setCreatingSop(true);
    setSelectedSopId(null);
    setSopDraft({
      ...createEmptyManagedSop(),
      updated_by: actor,
      environments: ['production'],
      content: {
        ...createEmptyManagedSop().content,
        preconditions: ['Confirm the service, business flow, environment, and dependency scope before action.'],
        checks: ['Review Nexus evidence, logs, graph context, and current service/runtime health.'],
        verification_steps: ['Confirm the user-facing function recovers and dependent services stabilize.'],
      },
    });
    setSopMetadataText('{}');
  };

  const adoptIndexedSop = (sop: IndexedSop) => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('sop');
    const draft = managedSopFromIndexed(sop, actor);
    setCreatingSop(true);
    setSelectedSopId(null);
    setSopDraft(draft);
    setSopMetadataText(stringifyObject(draft.metadata));
  };

  const startNewDatabaseDependency = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('edge');
    setCreatingEdge(true);
    setSelectedEdgeId(null);
    setEdgeDraft({
      ...createEmptyEdge(),
      dependency_type: 'db',
      dependency_purpose: 'database_access',
      valid_failure_domains: ['database', 'dependency', 'service_runtime'],
      expected_evidence: [
        'db_error_code',
        'connection_pool_usage',
        'active_sessions',
        'lock_waits',
        'slow_queries',
        'replication_lag',
        'tablespace_pressure',
      ],
      database_access: {
        ...createEmptyDatabaseAccess(),
        transactional: true,
      },
    });
    setEdgeMetadataText('{}');
    setWorkspaceTab('dependencies');
  };

  const startNewRolloverEnvironment = () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    resetEditorHydration('rollover');
    setCreatingRolloverEnvironment(true);
    setSelectedRolloverEnvironmentId(null);
    const draft = createEmptyRolloverEnvironment();
    setRolloverDraft(draft);
    setRolloverMetadataText(stringifyObject(draft.metadata));
    setRolloverCredentialPassword('');
    setRolloverAssessment(null);
    setRolloverConnectionTest(null);
    setRolloverChallenge(null);
    setRolloverOtpCode('');
    setRolloverPanelMode('configuration');
    setWorkspaceTab('rollover');
  };

  const saveRolloverEnvironment = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('rollover-save');
    try {
      const payload: RolloverEnvironment = {
        ...rolloverDraft,
        environment_id: rolloverDraft.environment_id.trim(),
        environment_name: rolloverDraft.environment_name.trim(),
        service_environment: rolloverDraft.service_environment?.trim() || null,
        owner_team: rolloverDraft.owner_team?.trim() || '',
        connection: {
          ...createEmptyRolloverConnection(),
          ...(rolloverDraft.connection || {}),
          platform: rolloverDraft.connection.platform?.trim() || 'oracle',
          source_service_id: rolloverDraft.connection.source_service_id?.trim() || '',
          username: rolloverDraft.connection.username.trim(),
          dsn: rolloverDraft.connection.dsn?.trim() || '',
          jdbc_url: rolloverDraft.connection.jdbc_url?.trim() || '',
          host: rolloverDraft.connection.host?.trim() || '',
          database_name: rolloverDraft.connection.database_name?.trim() || '',
          instance_name: rolloverDraft.connection.instance_name?.trim() || '',
          sid: rolloverDraft.connection.sid?.trim() || '',
          service_name: rolloverDraft.connection.service_name?.trim() || '',
          schema_name: rolloverDraft.connection.schema_name?.trim() || '',
          connection_type: rolloverDraft.connection.connection_type?.trim() || '',
          config_dir: rolloverDraft.connection.config_dir?.trim() || '',
          port: Number(rolloverDraft.connection.port || 1521),
          metadata: rolloverDraft.connection.metadata || {},
        },
        rules: rolloverDraft.rules
          .map((rule, index) => ({
            ...rule,
            rule_id: rule.rule_id.trim() || `rollover-rule-${index + 1}`,
            table_name: rule.table_name.trim().toUpperCase(),
            column_name: rule.column_name.trim().toUpperCase(),
            source_value: rule.source_value.trim(),
            target_value: rule.target_value.trim(),
            description: rule.description?.trim() || '',
            sequence: Number(rule.sequence || (index + 1) * 10),
            metadata: rule.metadata || {},
          }))
          .sort((left, right) => left.sequence - right.sequence),
        notes: rolloverDraft.notes?.trim() || '',
        updated_by: actor,
        metadata: parseJsonInput(rolloverMetadataText, 'Rollover metadata'),
      };
      if (!payload.environment_id || !payload.environment_name) {
        throw new Error('Environment ID and name are required.');
      }
      if (!payload.rules.length) {
        throw new Error('At least one rollover rule is required.');
      }
      if (payload.rules.some((rule) => rule.enabled && (!rule.table_name || !rule.column_name || !rule.source_value || !rule.target_value))) {
        throw new Error('Every enabled rollover rule needs a table, column, source value, and target value.');
      }
      const saved = await nexusApi.upsertRolloverEnvironment({
        ...payload,
        credential_password: rolloverCredentialPassword.trim() || null,
      });
      markEditorHydrated('rollover', saved.environment_id);
      await loadWorkspace();
      setCreatingRolloverEnvironment(false);
      setSelectedRolloverEnvironmentId(saved.environment_id);
      setRolloverPanelMode('command');
      setRolloverCredentialPassword('');
      addNotification({
        type: 'success',
        message: `${saved.environment_name} rollover profile was saved.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover environment could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteRolloverEnvironment = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedRolloverEnvironment?.environment_id || !window.confirm(`Delete rollover profile ${selectedRolloverEnvironment.environment_name}?`)) {
      return;
    }
    setCatalogBusy('rollover-delete');
    try {
      await nexusApi.deleteRolloverEnvironment(selectedRolloverEnvironment.environment_id);
      resetEditorHydration('rollover');
      await loadWorkspace();
      setCreatingRolloverEnvironment(false);
      setSelectedRolloverEnvironmentId(null);
      setRolloverPanelMode('command');
      addNotification({ type: 'success', message: `${selectedRolloverEnvironment.environment_name} rollover profile was removed.`, priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover profile deletion failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const assessRolloverEnvironment = async () => {
    const environmentId = rolloverDraft.environment_id.trim();
    if (!environmentId) {
      addNotification({ type: 'warning', message: 'Save or select a rollover environment before assessment.', priority: 'medium' });
      return;
    }
    setCatalogBusy('rollover-assess');
    try {
      const assessment = await nexusApi.assessRolloverEnvironment(environmentId, actor, rolloverCredentialPassword.trim() || undefined);
      setRolloverAssessment(assessment);
      addNotification({
        type: assessment.status === 'aligned' ? 'success' : assessment.status === 'requires_rollover' ? 'warning' : 'info',
        message: assessment.message || `Rollover assessment finished with status ${assessment.status}.`,
        priority: assessment.status === 'requires_rollover' ? 'high' : 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover assessment failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const testRolloverConnection = async () => {
    const environmentId = rolloverDraft.environment_id.trim();
    if (!environmentId || creatingRolloverEnvironment) {
      addNotification({ type: 'warning', message: 'Save or select a rollover environment before testing the connection.', priority: 'medium' });
      return;
    }
    setCatalogBusy('rollover-test-connection');
    try {
      const result = await nexusApi.testRolloverConnection(
        environmentId,
        actor,
        rolloverCredentialPassword.trim() || undefined,
        rolloverDraft.connection,
      );
      setRolloverConnectionTest(result);
      addNotification({
        type: result.connected ? 'success' : 'error',
        message: result.message,
        priority: result.connected ? 'medium' : 'high',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover connection test failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const requestRolloverChallenge = async () => {
    if (!canOperateNexus) {
      addNotification({ type: 'warning', message: 'Your role does not allow Nexus rollover execution.', priority: 'medium' });
      return;
    }
    const environmentId = rolloverDraft.environment_id.trim();
    if (!environmentId) return;
    setCatalogBusy('rollover-challenge');
    try {
      const challenge = await nexusApi.requestRolloverChallenge(environmentId, rolloverReason || 'Operator-approved environment rollover.');
      setRolloverChallenge(challenge);
      setRolloverOtpCode('');
      addNotification({
        type: 'success',
        message: `Nexus sent a rollover verification code to ${challenge.email}.`,
        priority: 'high',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Nexus could not open the rollover OTP gate.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const executeRollover = async () => {
    if (!rolloverChallenge) {
      return;
    }
    setCatalogBusy('rollover-execute');
    try {
      const execution = await nexusApi.executeRollover(
        rolloverChallenge.environment_id,
        rolloverChallenge.challenge_id,
        rolloverOtpCode,
        rolloverReason || 'OTP-approved environment rollover from Sentinel Nexus.',
      );
      setRolloverChallenge(null);
      setRolloverOtpCode('');
      setRolloverAssessment(execution.post_assessment || execution.pre_assessment || rolloverAssessment);
      await loadWorkspace({ silent: true });
      addNotification({
        type: execution.status === 'COMPLETED' || execution.status === 'NOOP' ? 'success' : 'warning',
        message: execution.result_summary || `Rollover execution finished with status ${execution.status}.`,
        priority: execution.status === 'COMPLETED' ? 'high' : 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Nexus could not verify or execute the rollover request.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const scheduleRolloverReminder = async () => {
    const environmentId = rolloverDraft.environment_id.trim();
    if (!environmentId || !rolloverReminderDateTime) {
      addNotification({ type: 'warning', message: 'Choose an environment and reminder time first.', priority: 'medium' });
      return;
    }
    setCatalogBusy('rollover-reminder');
    try {
      const scheduledFor = new Date(rolloverReminderDateTime);
      if (Number.isNaN(scheduledFor.getTime())) {
        throw new Error('Reminder time is not valid.');
      }
      const reminder = await nexusApi.scheduleRolloverReminder(environmentId, {
        scheduled_for: scheduledFor.toISOString(),
        timezone: applicationTimeZone,
        notify_recipients: parseListInput(rolloverReminderRecipients),
        notes: rolloverReminderNotes || null,
      });
      setRolloverReminderDateTime('');
      setRolloverReminderRecipients('');
      setRolloverReminderNotes('');
      await loadWorkspace({ silent: true });
      addNotification({
        type: 'success',
        message: `${reminder.environment_name} rollover reminder was scheduled. Nexus will not execute rollover automatically.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover reminder could not be scheduled.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const cancelRolloverReminder = async (reminderId: string) => {
    setCatalogBusy(`rollover-reminder-${reminderId}`);
    try {
      await nexusApi.cancelRolloverReminder(reminderId);
      await loadWorkspace({ silent: true });
      addNotification({ type: 'success', message: 'Rollover reminder was cancelled.', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Rollover reminder could not be cancelled.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const addRolloverRule = () => {
    const nextSequence = Math.max(0, ...rolloverDraft.rules.map((rule) => Number(rule.sequence || 0))) + 10;
    setRolloverDraft((current) => ({
      ...current,
      rules: [
        ...current.rules,
        {
          rule_id: `rollover-rule-${nextSequence}`,
          table_name: '',
          column_name: '',
          source_value: '',
          target_value: '',
          description: '',
          enabled: true,
          sequence: nextSequence,
          metadata: {},
        },
      ],
    }));
    markEditorDirty('rollover');
  };

  const removeRolloverRule = (ruleId: string) => {
    setRolloverDraft((current) => ({
      ...current,
      rules: current.rules.filter((rule) => rule.rule_id !== ruleId),
    }));
    markEditorDirty('rollover');
  };

  const openLinkedServiceContract = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setServicePanelMode('overview');
    setWorkspaceTab('services');
  };

  const saveManagedSop = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('sop-save');
    try {
      const payload: ManagedSop = {
        ...sopDraft,
        sop_id: sopDraft.sop_id.trim(),
        title: sopDraft.title.trim(),
        class_code: sopDraft.class_code.trim().toUpperCase(),
        severity: sopDraft.severity.toLowerCase(),
        owner_team: sopDraft.owner_team?.trim() || '',
        updated_by: actor,
        services: sopDraft.services.map((item) => item.trim()).filter(Boolean),
        environments: sopDraft.environments.map((item) => item.trim()).filter(Boolean),
        aliases: sopDraft.aliases.map((item) => item.trim()).filter(Boolean),
        tags: sopDraft.tags.map((item) => item.trim()).filter(Boolean),
        content: Object.entries(sopDraft.content || {}).reduce<Record<string, string[]>>(
          (acc, [section, lines]) => ({ ...acc, [section]: (lines || []).map((line) => line.trim()).filter(Boolean) }),
          {},
        ),
        metadata: parseJsonInput(sopMetadataText, 'SOP metadata'),
      };
      if (!payload.sop_id || !payload.title) {
        throw new Error('SOP ID and title are required.');
      }
      const saved = await nexusApi.upsertManagedSop(payload);
      markEditorHydrated('sop', saved.sop_id);
      await loadWorkspace();
      setCreatingSop(false);
      setSelectedSopId(saved.sop_id);
      addNotification({
        type: saved.validation.valid ? 'success' : 'warning',
        message: saved.validation.valid
          ? `${saved.title} is saved and validation-ready for SOP Copilot retrieval.`
          : `${saved.title} was saved with ${saved.validation.errors.length} validation issue(s).`,
        priority: saved.validation.valid ? 'medium' : 'high',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'SOP could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const validateManagedSop = async (approveIfValid = false) => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!sopDraft.sop_id.trim()) {
      addNotification({ type: 'warning', message: 'Save the SOP with a stable SOP ID before validation.', priority: 'medium' });
      return;
    }
    setCatalogBusy(approveIfValid ? 'sop-approve' : 'sop-validate');
    try {
      const validated = await nexusApi.validateManagedSop(sopDraft.sop_id.trim(), actor, approveIfValid);
      markEditorHydrated('sop', validated.sop_id);
      await loadWorkspace();
      setSelectedSopId(validated.sop_id);
      addNotification({
        type: validated.validation.valid ? 'success' : 'warning',
        message: validated.validation.valid
          ? `${validated.title} passed validation${approveIfValid ? ' and is approved.' : '.'}`
          : `${validated.title} still has ${validated.validation.errors.length} validation issue(s).`,
        priority: validated.validation.valid ? 'medium' : 'high',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'SOP validation failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteManagedSop = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedSop?.sop_id || !window.confirm(`Deprecate SOP ${selectedSop.title}?`)) {
      return;
    }
    setCatalogBusy('sop-delete');
    try {
      await nexusApi.deleteManagedSop(selectedSop.sop_id);
      resetEditorHydration('sop');
      await loadWorkspace();
      setCreatingSop(false);
      setSelectedSopId(null);
      addNotification({
        type: 'success',
        message: `${selectedSop.title} was deprecated from Nexus SOP governance.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'SOP deprecation failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const saveService = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('service-save');
    try {
      const payload: CatalogService = {
        ...serviceDraft,
        service_id: serviceDraft.service_id.trim(),
        service_name: serviceDraft.service_name.trim(),
        owner_team: serviceDraft.owner_team.trim(),
        description: serviceDraft.description?.trim() || '',
        runbook_slug: serviceDraft.runbook_slug?.trim() || '',
        cluster: serviceDraft.cluster?.trim() || serviceDraft.cluster_ids[0] || '',
        database_profile: {
          ...createEmptyDatabaseProfile(),
          ...(serviceDraft.database_profile || {}),
          enabled: serviceDraft.database_profile?.enabled || serviceDraft.service_type === 'db',
          platform: serviceDraft.database_profile?.platform?.trim() || '',
          host: serviceDraft.database_profile?.host?.trim() || '',
          database_name: serviceDraft.database_profile?.database_name?.trim() || '',
          instance_name: serviceDraft.database_profile?.instance_name?.trim() || '',
          service_name: serviceDraft.database_profile?.service_name?.trim() || '',
          username: serviceDraft.database_profile?.username?.trim() || '',
          jdbc_url: serviceDraft.database_profile?.jdbc_url?.trim() || '',
          connection_type: serviceDraft.database_profile?.connection_type?.trim() || '',
          config_dir: serviceDraft.database_profile?.config_dir?.trim() || '',
          role: serviceDraft.database_profile?.role?.trim() || '',
          host_group: serviceDraft.database_profile?.host_group?.trim() || '',
          connection_pool: serviceDraft.database_profile?.connection_pool?.trim() || '',
          replication_group: serviceDraft.database_profile?.replication_group?.trim() || '',
          failover_group: serviceDraft.database_profile?.failover_group?.trim() || '',
          data_classification: serviceDraft.database_profile?.data_classification?.trim() || '',
          schemas: serviceDraft.database_profile?.schemas || [],
          expected_evidence: serviceDraft.database_profile?.expected_evidence || [],
          safe_diagnostics: serviceDraft.database_profile?.safe_diagnostics || [],
          metadata: serviceDraft.database_profile?.metadata || {},
        },
        metadata: parseJsonInput(serviceMetadataText, 'Service metadata'),
      };
      if (!payload.service_id || !payload.service_name) {
        throw new Error('Service ID and service name are required.');
      }
      const saved = await nexusApi.upsertService(payload);
      markEditorHydrated('service', saved.service_id);
      await loadWorkspace();
      setCreatingService(false);
      setSelectedServiceId(saved.service_id);
      setServicePanelMode('overview');
      addNotification({
        type: 'success',
        message: `${saved.service_name} is now wired into the Nexus catalog.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.message || err?.response?.data?.detail || 'Service configuration could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const testDatabaseFabricConnection = async () => {
    const serviceId = selectedServiceId || serviceDraft.service_id.trim();
    if (!serviceId || creatingService || !selectedServiceId) {
      addNotification({ type: 'warning', message: 'Save or select the database service contract before testing the connection.', priority: 'medium' });
      return;
    }
    setCatalogBusy('database-test-connection');
    try {
      const result = await nexusApi.testDatabaseFabricConnection(
        serviceId,
        actor,
        databaseTestPassword.trim() || undefined,
        serviceDraft.database_profile || createEmptyDatabaseProfile(),
      );
      setDatabaseConnectionTest(result);
      addNotification({
        type: result.connected ? 'success' : 'error',
        message: result.message,
        priority: result.connected ? 'medium' : 'high',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Database Fabric connection test failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteService = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedService?.service_id || !window.confirm(`Delete service ${selectedService.service_name}?`)) {
      return;
    }
    setCatalogBusy('service-delete');
    try {
      await nexusApi.deleteService(selectedService.service_id);
      resetEditorHydration('service');
      await loadWorkspace();
      setCreatingService(false);
      setSelectedServiceId(null);
      addNotification({
        type: 'success',
        message: `${selectedService.service_name} was removed from the Nexus catalog.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Service deletion failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const saveCluster = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('cluster-save');
    try {
      const payload: DependencyCluster = {
        ...clusterDraft,
        cluster_id: clusterDraft.cluster_id.trim(),
        cluster_name: clusterDraft.cluster_name.trim(),
        owner_team: clusterDraft.owner_team.trim(),
        description: clusterDraft.description?.trim() || '',
        metadata: parseJsonInput(clusterMetadataText, 'Cluster metadata'),
      };
      if (!payload.cluster_id || !payload.cluster_name) {
        throw new Error('Cluster ID and cluster name are required.');
      }
      const saved = await nexusApi.upsertCluster(payload);
      markEditorHydrated('cluster', saved.cluster_id);
      await loadWorkspace();
      setCreatingCluster(false);
      setSelectedClusterId(saved.cluster_id);
      addNotification({
        type: 'success',
        message: `${saved.cluster_name} is now part of the dependency fabric.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.message || err?.response?.data?.detail || 'Cluster configuration could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteCluster = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedCluster?.cluster_id || !window.confirm(`Delete cluster ${selectedCluster.cluster_name}?`)) {
      return;
    }
    setCatalogBusy('cluster-delete');
    try {
      await nexusApi.deleteCluster(selectedCluster.cluster_id);
      resetEditorHydration('cluster');
      await loadWorkspace();
      setCreatingCluster(false);
      setSelectedClusterId(null);
      addNotification({
        type: 'success',
        message: `${selectedCluster.cluster_name} was removed from Nexus.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Cluster deletion failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const saveBusinessFlow = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('flow-save');
    try {
      const payload: BusinessFlow = {
        ...flowDraft,
        flow_id: flowDraft.flow_id.trim(),
        flow_name: flowDraft.flow_name.trim(),
        owner_team: flowDraft.owner_team.trim(),
        description: flowDraft.description?.trim() || '',
        steps: flowDraft.steps
          .map((step, index) => ({
            ...step,
            step_id: step.step_id || `${flowDraft.flow_id.trim()}:${step.step_order || index + 1}:${step.service_id}`,
            step_order: step.step_order || index + 1,
          }))
          .sort((left, right) => left.step_order - right.step_order),
        metadata: parseJsonInput(flowMetadataText, 'Business flow metadata'),
      };
      if (!payload.flow_id || !payload.flow_name) {
        throw new Error('Flow ID and flow name are required.');
      }
      if (!payload.steps.length) {
        throw new Error('At least one flow step is required.');
      }
      const saved = await nexusApi.upsertBusinessFlow(payload);
      markEditorHydrated('flow', saved.flow_id);
      await loadWorkspace();
      setCreatingFlow(false);
      setSelectedFlowId(saved.flow_id);
      addNotification({
        type: 'success',
        message: `${saved.flow_name} is now available for flow-scoped correlation.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.message || err?.response?.data?.detail || 'Business flow could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteBusinessFlow = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedFlow?.flow_id || !window.confirm(`Delete business flow ${selectedFlow.flow_name}?`)) {
      return;
    }
    setCatalogBusy('flow-delete');
    try {
      await nexusApi.deleteBusinessFlow(selectedFlow.flow_id);
      resetEditorHydration('flow');
      await loadWorkspace();
      setCreatingFlow(false);
      setSelectedFlowId(null);
      addNotification({
        type: 'success',
        message: `${selectedFlow.flow_name} was removed from flow-aware correlation.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Business flow deletion failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const saveDependency = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    setCatalogBusy('dependency-save');
    try {
      const payload: DependencyEdge = {
        ...edgeDraft,
        edge_id: edgeDraft.edge_id?.trim() || '',
        cluster_id: edgeDraft.cluster_id?.trim() || '',
        from_service_id: edgeDraft.from_service_id.trim(),
        to_service_id: edgeDraft.to_service_id.trim(),
        dependency_purpose: edgeDraft.dependency_purpose?.trim() || '',
        dependency_scope: edgeDraft.dependency_scope || 'global',
        business_flow_ids: edgeDraft.business_flow_ids || [],
        valid_failure_domains: edgeDraft.valid_failure_domains || [],
        expected_evidence: edgeDraft.expected_evidence || [],
        database_access: {
          ...createEmptyDatabaseAccess(),
          ...(edgeDraft.database_access || {}),
          access_mode: edgeDraft.database_access?.access_mode?.trim() || '',
          schema_names: edgeDraft.database_access?.schema_names || [],
          operation_types: edgeDraft.database_access?.operation_types || [],
          connection_pool: edgeDraft.database_access?.connection_pool?.trim() || '',
          max_connections: edgeDraft.database_access?.max_connections || null,
          statement_timeout_ms: edgeDraft.database_access?.statement_timeout_ms || null,
          expected_error_codes: edgeDraft.database_access?.expected_error_codes || [],
          query_fingerprint_scope: edgeDraft.database_access?.query_fingerprint_scope?.trim() || '',
          transactional: edgeDraft.database_access?.transactional ?? true,
          metadata: edgeDraft.database_access?.metadata || {},
        },
        metadata: parseJsonInput(edgeMetadataText, 'Dependency metadata'),
      };
      if (!payload.from_service_id || !payload.to_service_id) {
        throw new Error('Dependency endpoints are required.');
      }
      const saved = await nexusApi.upsertDependency(payload);
      markEditorHydrated('edge', saved.edge_id || null);
      await loadWorkspace();
      setCreatingEdge(false);
      setSelectedEdgeId(saved.edge_id || null);
      addNotification({
        type: 'success',
        message: `Dependency ${saved.from_service_id} -> ${saved.to_service_id} has been saved.`,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.message || err?.response?.data?.detail || 'Dependency configuration could not be saved.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const deleteDependency = async () => {
    if (!canManageNexus) {
      notifyAdminOnly();
      return;
    }
    if (!selectedEdge?.edge_id || !window.confirm(`Delete dependency ${selectedEdge.from_service_id} -> ${selectedEdge.to_service_id}?`)) {
      return;
    }
    setCatalogBusy('dependency-delete');
    try {
      await nexusApi.deleteDependency(selectedEdge.edge_id);
      resetEditorHydration('edge');
      await loadWorkspace();
      setCreatingEdge(false);
      setSelectedEdgeId(null);
      addNotification({
        type: 'success',
        message: 'Dependency edge removed from Nexus.',
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err?.response?.data?.detail || err?.message || 'Dependency deletion failed.',
        priority: 'high',
      });
    } finally {
      setCatalogBusy(null);
    }
  };

  const renderOverviewTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-grid">
        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Root Cause Ranking</h3>
            <span>{selectedIncident.root_cause_candidates.length}</span>
          </div>
          <div className="candidate-list">
            {selectedIncident.root_cause_candidates.map((candidate: RootCauseCandidate) => (
              <div key={candidate.service_id} className="candidate-card">
                <div className="candidate-head">
                  <strong>{candidate.service_name}</strong>
                  <span>{scorePercent(candidate.confidence)}</span>
                </div>
                <div className="candidate-metrics">
                  <span>Score {scorePercent(candidate.score)}</span>
                  <span>Diversity {scorePercent(candidate.evidence_diversity)}</span>
                  <span>Upstream fit {scorePercent(candidate.upstream_explanation)}</span>
                  <span>Flow fit {scorePercent(candidate.flow_fit)}</span>
                  <span>Vantage {scorePercent(candidate.vantage_consistency)}</span>
                  <span>DB fit {scorePercent(candidate.database_fit)}</span>
                </div>
                <p>{candidate.explanation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Operational Snapshot</h3>
            <span>{selectedIncident.status.replace(/_/g, ' ')}</span>
          </div>
          <div className="context-stack">
            <div className="context-section">
              <label>Affected Services</label>
              <div className="context-pill-row">
                {selectedIncident.affected_services.map((serviceId) => (
                  <span key={serviceId} className="soft-pill">{serviceId}</span>
                ))}
              </div>
            </div>
            <div className="context-section">
              <label>Blast Radius</label>
              <div className="context-pill-row">
                {selectedIncident.blast_radius.map((serviceId) => (
                  <span key={serviceId} className="soft-pill">{serviceId}</span>
                ))}
              </div>
            </div>
            <div className="context-section">
              <label>Fabric Context</label>
              <div className="context-pill-row">
                <span className={`risk-pill risk-${displayRiskLevelForIncident(selectedIncident).toLowerCase()}`}>{displayRiskLevelForIncident(selectedIncident)}</span>
                <span className="soft-pill">{selectedIncident.failure_domain}</span>
                {selectedIncident.primary_business_flow_name ? (
                  <span className="soft-pill">{selectedIncident.primary_business_flow_name}</span>
                ) : null}
                {selectedIncident.cluster_ids.map((clusterId) => (
                  <span key={clusterId} className="soft-pill">{clusterId}</span>
                ))}
                {selectedIncident.vantage_points.map((vantage) => (
                  <span key={vantage} className="soft-pill">{vantage}</span>
                ))}
                {selectedIncident.data_sources.map((source) => (
                  <span key={source} className="soft-pill">{source}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="nexus-panel nexus-shell ai-brief-panel">
          <div className="panel-head">
            <div>
              <h3>Nexus AI Brief</h3>
              <p>Ask Nexus to read the incident fabric for you: what matters, what is uncertain, and the safest move now.</p>
            </div>
            <button type="button" className="secondary-action" onClick={() => void generateIncidentBrief()} disabled={incidentBriefBusy}>
              <FaCommentDots /> {incidentBriefBusy ? 'Generating...' : incidentBrief ? 'Refresh Brief' : 'Generate Brief'}
            </button>
          </div>
          {incidentBriefError ? <div className="nexus-banner error">{incidentBriefError}</div> : null}
          {incidentBrief ? (
            <div className="ai-brief-body">
              <div className="ai-brief-command">
                <div className="ai-brief-orb" aria-hidden="true">
                  <span />
                  <span />
                  <FaCommentDots />
                </div>
                <div className='fine-div'>
                  <span className="panel-kicker">iNterpret Mode</span>
                  <h4>Incident Intelligence Brief</h4>
                  <p>
                    Confidence {scorePercent(incidentBrief.confidence)} | {incidentBrief.retrieved_sops.length} SOP references |
                    trace {incidentBrief.trace_id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div className="ai-brief-narrative">
                {splitAiNarrative(incidentBrief.answer).map((paragraph, index) => (
                  <p key={`incident-brief-paragraph-${index}`}>{paragraph}</p>
                ))}
              </div>
              {incidentBrief.warnings.length ? (
                <div className="copilot-warning-list">
                  {incidentBrief.warnings.map((warning) => (
                    <div key={warning} className="nexus-banner warning">{warning}</div>
                  ))}
                </div>
              ) : null}
              <div className="management-card-meta">
                <span>{incidentBrief.retrieved_sops.length} SOP references</span>
                <span>{incidentBrief.citations.length} citations</span>
                <span>trace {incidentBrief.trace_id.slice(0, 8)}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state compact">
              Ask Nexus to craft a command-ready brief when the case needs a sharper read: what is known, what is inferred,
              what to be careful with, and what the operator should validate next.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderTopologyTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-grid">
        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Service Graph</h3>
            <span>{graphContext?.nodes.length || 0} nodes</span>
          </div>
          {detailLoading ? <div className="empty-state">Refreshing graph context...</div> : null}
          {!detailLoading && graphContext ? (
            <>
              <div className="graph-node-list">
                {graphContext.nodes.map((node: GraphNode) => (
                  <div key={node.service_id} className={`graph-node ${node.affected ? 'affected' : ''} ${node.suspected_root ? 'root' : ''}`}>
                    <strong>{node.service_name}</strong>
                    <span>{node.service_type} | {node.criticality} | {node.environment}</span>
                  </div>
                ))}
              </div>
              <div className="graph-edge-list">
                {graphContext.edges.map((edge: GraphEdge) => (
                  <div key={`${edge.from_service_id}-${edge.to_service_id}-${edge.dependency_type}`} className={`graph-edge ${edge.highlighted ? 'highlighted' : ''}`}>
                    <span>{edge.from_service_id}</span>
                    <em>{edge.dependency_type}</em>
                    <span>{edge.to_service_id}</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Dependency Context</h3>
            <span>{selectedIncident.blast_radius.length} in radius</span>
          </div>
          <div className="context-stack">
            <div className="context-section">
              <label>Blast Radius</label>
              <div className="context-pill-row">
                {selectedIncident.blast_radius.map((serviceId) => (
                  <span key={serviceId} className="soft-pill">{serviceId}</span>
                ))}
              </div>
            </div>
            <div className="context-section">
              <label>Clusters</label>
              <div className="context-pill-row">
                {selectedIncident.cluster_ids.length ? (
                  selectedIncident.cluster_ids.map((clusterId) => (
                    <span key={clusterId} className="soft-pill">{clusterId}</span>
                  ))
                ) : (
                  <span className="context-empty">No dependency clusters linked yet.</span>
                )}
              </div>
            </div>
            <div className="context-section">
              <label>Dependents</label>
              <div className="context-pill-row">
                {graphContext?.dependents.length ? (
                  graphContext.dependents.map((serviceId) => (
                    <span key={serviceId} className="soft-pill">{serviceId}</span>
                  ))
                ) : (
                  <span className="context-empty">No direct dependents loaded.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEvidenceTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-grid">
        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Log Signatures</h3>
            <span>{selectedIncident.log_signatures.length}</span>
          </div>
          <div className="signature-list">
            {selectedIncident.log_signatures.map((signature) => (
              <div key={signature.signature_id} className="signature-card">
                <div className="signature-head">
                  <strong>{signature.signature_family.replace(/_/g, ' ')}</strong>
                  <span>{signature.count} hits</span>
                </div>
                <div className="signature-meta">
                  <span>{signature.error_class}</span>
                  <span>{formatDateTime(signature.last_seen_at)}</span>
                </div>
                <code>{signature.samples[0] || 'No sample available.'}</code>
              </div>
            ))}
            {!selectedIncident.log_signatures.length ? <div className="empty-state">No structured log signatures are attached to this incident yet.</div> : null}
          </div>
        </div>

        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Evidence Timeline</h3>
            <span>{selectedIncident.evidence_timeline.length}</span>
          </div>
          <div className="timeline-list">
            {selectedIncident.evidence_timeline.map((evidence: NexusEvidence) => (
              <div key={evidence.evidence_id} className={`timeline-entry severity-${evidence.severity.toLowerCase()}`}>
                <div className="timeline-head">
                  <strong>{evidence.service_name}</strong>
                  <span>{formatDateTime(evidence.timestamp)}</span>
                </div>
                <div className="timeline-meta">
                  <span>{evidence.evidence_class}</span>
                  <span>{evidence.source}</span>
                  {evidence.signature_family ? <span>{evidence.signature_family}</span> : null}
                </div>
                <p>{evidence.summary}</p>
                {evidence.raw_excerpt ? <code>{evidence.raw_excerpt}</code> : null}
                {evidence.provenance_url ? (
                  <Link className="inline-link" to={evidence.provenance_url}>
                    <FaLink /> Open provenance
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderActionsTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-grid">
        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Recommendations</h3>
            <span>{selectedIncident.recommendations.length}</span>
          </div>
          <div className="recommendation-list">
            {selectedIncident.recommendations.map((recommendation) => (
              <div key={recommendation.recommendation_id} className="recommendation-card">
                <div className="recommendation-head">
                  <strong>{recommendationLabel(recommendation.action_type)}</strong>
                  <span>{scorePercent(recommendation.confidence)}</span>
                </div>
                <p>{recommendation.justification}</p>
                {!recommendation.eligible && recommendation.blocked_reasons.length ? (
                  <ul className="blocked-reasons">
                    {recommendation.blocked_reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="nexus-panel nexus-shell">
          <div className="panel-head">
            <h3>Action Deck</h3>
            <span>{actionDeckCount}</span>
          </div>
          <div className="action-deck-list">
            {selectedIncident.diagnostics.map((bundle) => (
              <div key={bundle.bundle_id} className="deck-card">
                <strong>Diagnostics {bundle.bundle_id}</strong>
                <span>{bundle.status}</span>
                <p>{bundle.dispatch_status || bundle.commands.map((command) => command.command_id).join(', ')}</p>
              </div>
            ))}
            {selectedIncident.action_executions.map((execution) => (
              <div key={execution.action_execution_id} className="deck-card">
                <strong>Restart {execution.status}</strong>
                <span>{formatDateTime(execution.requested_at)}</span>
                <p>{execution.result_summary || execution.justification}</p>
              </div>
            ))}
            {selectedIncident.linked_tasks.map((task) => (
              <div key={task.task_id} className="deck-card">
                <strong>{task.title}</strong>
                <span>{formatDateTime(task.created_at)}</span>
                <p>{task.description}</p>
                <Link className="inline-link" to={task.route_hint}>
                  <FaTasks /> Open task
                </Link>
              </div>
            ))}
            {!selectedIncident.diagnostics.length && !selectedIncident.action_executions.length && !selectedIncident.linked_tasks.length ? (
              <div className="empty-state">No diagnostics, restart actions, or task handoffs have been recorded for this incident yet.</div>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderProcedureTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-panel nexus-shell">
        <div className="panel-head">
          <div>
            <h3>SOP Copilot</h3>
            <p>Ask grounded procedure questions about this incident and get SOP-backed guidance with warnings, citations, and next steps.</p>
          </div>
          <Link className="secondary-action" to="/manual">
            <FaBook /> Open Manual
          </Link>
        </div>

        <div className="copilot-suggestion-row">
          {suggestedCopilotQuestions.map((question) => (
            <button key={question} type="button" className="copilot-chip" onClick={() => setCopilotQuestion(question)}>
              {question}
            </button>
          ))}
        </div>

        <div className="copilot-composer">
          <textarea
            value={copilotQuestion}
            onChange={(event) => setCopilotQuestion(event.target.value)}
            placeholder="Ask what to verify first, which SOP checks apply, how to validate recovery, or what to escalate."
          />
          <button type="button" className="primary-action" onClick={() => void askCopilot()} disabled={copilotBusy || !copilotQuestion.trim()}>
            <FaCommentDots /> {copilotBusy ? 'Asking...' : 'Ask SOP Copilot'}
          </button>
        </div>

        {copilotError ? <div className="nexus-banner error">{copilotError}</div> : null}

        <div className="copilot-turns">
          {!copilotTurns.length ? (
            <div className="empty-state">No SOP guidance has been requested for this incident yet.</div>
          ) : null}
          {copilotTurns.map((turn) => (
            <div key={turn.id} className="copilot-turn">
              <div className="copilot-question">
                <span>Operator</span>
                <strong>{turn.question}</strong>
              </div>
              <div className="copilot-answer">
                <div className="copilot-answer-head">
                  <span>SOP Copilot</span>
                  <strong>{scorePercent(turn.response.confidence)} confidence</strong>
                </div>
                <p>{turn.response.answer}</p>

                {turn.response.warnings.length ? (
                  <div className="copilot-warning-list">
                    {turn.response.warnings.map((warning) => (
                      <div key={warning} className="nexus-banner warning">{warning}</div>
                    ))}
                  </div>
                ) : null}

                {turn.response.recommended_next_steps.length ? (
                  <div className="copilot-section">
                    <label>Recommended next steps</label>
                    <ul className="blocked-reasons">
                      {turn.response.recommended_next_steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {turn.response.citations.length ? (
                  <div className="copilot-section">
                    <label>Citations</label>
                    <div className="copilot-citation-list">
                      {turn.response.citations.map((citation) => (
                        <div key={`${citation.sop_id}-${citation.section}-${citation.excerpt}`} className="copilot-citation">
                          <strong>{citation.title}</strong>
                          <span>{citation.sop_id} | {citation.section} | {scorePercent(citation.score)}</span>
                          <p>{citation.excerpt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderOutcomeTab = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-panel nexus-shell">
        <div className="panel-head">
          <h3>Operator Verdict</h3>
          <span>{selectedIncident.verdict ? 'Recorded' : 'Pending'}</span>
        </div>
        {selectedIncident.verdict ? (
          <div className="verdict-card fine-div">
            <strong>{selectedIncident.verdict.details?.verdict || 'Verdict recorded'}</strong>
            <span>{formatDateTime(selectedIncident.verdict.created_at)} by {selectedIncident.verdict.created_by}</span>
            <p>{selectedIncident.verdict.details?.notes || 'No additional verdict notes were captured.'}</p>
          </div>
        ) : null}
        <div className="verdict-form">
          <select value={verdict} onChange={(event) => setVerdict(event.target.value)}>
            <option value="confirmed">Confirmed root cause</option>
            <option value="false_positive">False positive</option>
            <option value="duplicate">Duplicate incident</option>
            <option value="useful_early_warning">Useful early warning</option>
            <option value="wrong_root_cause">Wrong root cause</option>
          </select>
          <input
            value={actualRoot}
            onChange={(event) => setActualRoot(event.target.value)}
            placeholder="Actual root service ID (optional)"
          />
          <textarea
            value={verdictNotes}
            onChange={(event) => setVerdictNotes(event.target.value)}
            placeholder="Record outcome notes, operator corrections, or follow-up context..."
          />
          <button type="button" className="primary-action" onClick={() => void submitVerdict()} disabled={actionBusy === 'verdict'}>
            <FaCheckCircle /> {actionBusy === 'verdict' ? 'Saving...' : 'Record Verdict'}
          </button>
        </div>
      </div>
    );
  };

  const renderIncidentCommandModal = () => {
    if (!selectedIncident) return null;
    return (
      <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-incident-modal-title">
        <section className="nexus-modal nexus-incident-modal">
          <button type="button" className="nexus-modal-close" onClick={closeIncidentModal} aria-label="Close incident detail">
            <FaTimesCircle />
          </button>
          <div className="nexus-panel nexus-shell nexus-summary-panel">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Incident Command View</span>
                <h2 id="nexus-incident-modal-title">{selectedIncident.title}</h2>
                <p>{selectedIncident.summary}</p>
              </div>
              <div className="summary-badges">
                <span className={`risk-pill risk-${displayRiskLevelForIncident(selectedIncident).toLowerCase()}`}>{displayRiskLevelForIncident(selectedIncident)}</span>
                <span className="soft-pill">{selectedIncident.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="summary-grid">
              <div className="summary-tile">
                <label>Probable Root Cause</label>
                <strong>{selectedIncident.suspected_root_service_name || 'Pending'}</strong>
                <small>{scorePercent(selectedIncident.predicted_confidence)} confidence</small>
              </div>
              <div className="summary-tile">
                <label>Blast Radius</label>
                <strong>{selectedIncident.blast_radius.length}</strong>
                <small>{selectedIncident.blast_radius.join(', ') || 'No downstream radius yet'}</small>
              </div>
              <div className="summary-tile">
                <label>Business Impact</label>
                <strong>{scorePercent(selectedIncident.business_impact_score)}</strong>
                <small>{selectedIncident.affected_services.join(', ')}</small>
              </div>
              <div className="summary-tile">
                <label>Start Time</label>
                <strong>{formatDateTime(selectedIncident.start_time)}</strong>
                <small>{formatRelativeMinutes(selectedIncident.start_time)}</small>
              </div>
              <div className="summary-tile">
                <label>Incident Duration</label>
                <strong>{formatDurationBetween(selectedIncident.start_time, selectedIncident.end_time)}</strong>
                <small>{selectedIncident.end_time ? `Ended ${formatDateTime(selectedIncident.end_time)}` : 'Still being monitored'}</small>
              </div>
              <div className="summary-tile">
                <label>Learning State</label>
                <strong>{selectedIncident.verdict ? 'Learned' : 'Awaiting Verdict'}</strong>
                <small>{selectedIncident.verdict ? selectedIncident.verdict.details?.verdict || 'Operator verdict recorded' : 'Operator outcome will tune Nexus confidence'}</small>
              </div>
            </div>

            <div className="action-row">
              <button type="button" onClick={() => void requestDiagnostics()} disabled={actionBusy === 'diagnostics'}>
                <FaWrench /> {actionBusy === 'diagnostics' ? 'Preparing...' : 'Request Diagnostics'}
              </button>
              <button type="button" onClick={() => void createTask()} disabled={actionBusy === 'task'}>
                <FaTasks /> {actionBusy === 'task' ? 'Creating...' : 'Create Response Task'}
              </button>
              <button
                type="button"
                className="approve"
                onClick={openIncidentServiceControl}
                disabled={!selectedIncident.suspected_root_service && !selectedIncident.affected_services.length}
                title="Open the OTP-gated Service Control Gate for START, STOP, and RESTART."
              >
                <FaShieldAlt /> Service Control
              </button>
            </div>

            {rawEvidenceLink ? (
              <Link className="inline-link large" to={rawEvidenceLink}>
                <FaNetworkWired /> Open raw Network Sentinel evidence
              </Link>
            ) : (
              <div className="nexus-banner warning">
                <strong>Raw evidence deep link is not mapped yet.</strong>
                <span>Attach a `network_service_id` in the service catalog to open the live Network Sentinel record directly.</span>
              </div>
            )}

            <div className="nexus-banner warning">
              <strong>Restart execution is only available inside the Service Control Gate.</strong>
              <span>Use Service Control to open the live operations cockpit and run OTP-gated START, STOP, or RESTART with current runtime evidence.</span>
            </div>
          </div>

          <div className="nexus-tabs-shell nexus-shell">
            <div className="nexus-tablist" role="tablist" aria-label="Sentinel Nexus detail sections">
              {detailTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeDetailTab === tab.id}
                  className={`nexus-tab ${activeDetailTab === tab.id ? 'active' : ''}`}
                  onClick={() => selectDetailTab(tab.id)}
                >
                  <span className="nexus-tab-label">{tab.icon}{tab.label}</span>
                  <span className="nexus-tab-count">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {activeDetailTab === 'topology'
            ? renderTopologyTab()
            : activeDetailTab === 'evidence'
              ? renderEvidenceTab()
              : activeDetailTab === 'actions'
                ? renderActionsTab()
                : activeDetailTab === 'procedure'
                  ? renderProcedureTab()
                  : activeDetailTab === 'outcome'
                    ? renderOutcomeTab()
                    : renderOverviewTab()}
        </section>
      </div>
    );
  };

  const renderIncidentWorkspace = () => (
    <div className="nexus-card-workspace">
      <section className="nexus-panel nexus-shell nexus-deck-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Incident Intelligence Deck</span>
            <h2>Current and Unresolved Incidents</h2>
            <p>Active cases stay severity-ranked. Restored cases remain here as low-risk operator-verdict work until closure.</p>
          </div>
          <span className="soft-pill">{timeFilteredIncidents.length} visible</span>
        </div>
        <div className="incident-timeline-rail" aria-label="Incident timeline filters">
          {incidentTimelineBuckets.map((bucket) => (
            <button
              key={bucket.id}
              type="button"
              className={`incident-timeline-chip ${incidentTimelineFilter === bucket.id ? 'active' : ''}`}
              onClick={() => setIncidentTimelineFilter(bucket.id)}
            >
              <span className="timeline-dot" />
              <strong>{bucket.label}</strong>
              <small>{bucket.hint}</small>
              <em>{bucket.count}</em>
            </button>
          ))}
        </div>
        <div className="incident-card-grid">
          {loading ? <div className="empty-state">Loading incident intelligence deck...</div> : null}
          {!loading && !timeFilteredIncidents.length ? (
            <div className="incident-empty-state">
              <div className="incident-empty-visual" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <div>
                <span className="panel-kicker">Fabric Clear</span>
                <h3>{operationalIncidents.length ? 'No incidents match this timeline view' : 'No current or unresolved incidents'}</h3>
                <p>
                  Nexus will keep restored cases visible as low-risk operator-verdict work. Once every case is closed,
                  this deck becomes the calm-state command surface.
                </p>
              </div>
            </div>
          ) : null}
          {paginatedIncidents.map((incident) => (
            <button
              key={incident.incident_id}
              type="button"
              className={`incident-card incident-card--preview risk-${displayRiskLevelForIncident(incident).toLowerCase()}`}
              onClick={() => selectIncident(incident)}
            >
              <div className={`incident-visual risk-${displayRiskLevelForIncident(incident).toLowerCase()}`} aria-hidden="true">
                <span className="visual-orbit orbit-one" />
                <span className="visual-orbit orbit-two" />
                <span className="visual-core" />
                <span className="visual-pulse" />
              </div>
              <div className="incident-card-head">
                <strong>{incident.title}</strong>
                <span className={`risk-pill risk-${displayRiskLevelForIncident(incident).toLowerCase()}`}>{displayRiskLevelForIncident(incident)}</span>
              </div>
              <p>{incident.summary}</p>
              <div className="incident-card-meta">
                <span>{incident.status.replace(/_/g, ' ')}</span>
                <span>{incident.suspected_root_service_name || 'Root pending'}</span>
                <span>{scorePercent(incident.predicted_confidence)} confidence</span>
                <span>{formatRelativeMinutes(incident.start_time)}</span>
                <span>{incidentDurationLabel(incident)}</span>
                <span>{incident.evidence_timeline.length} evidence</span>
              </div>
            </button>
          ))}
        </div>
        {timeFilteredIncidents.length > INCIDENT_PAGE_SIZE ? (
          <div className="incident-pagination" aria-label="Incident pagination">
            <button type="button" disabled={incidentPage <= 1} onClick={() => setIncidentPage((page) => Math.max(1, page - 1))}>
              Previous
            </button>
            <span>
              Page {incidentPage} of {incidentTotalPages}
            </span>
            <button
              type="button"
              disabled={incidentPage >= incidentTotalPages}
              onClick={() => setIncidentPage((page) => Math.min(incidentTotalPages, page + 1))}
            >
              Next
            </button>
          </div>
        ) : null}
      </section>

      {selectedIncident ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-incident-modal-title">
          <section className="nexus-modal nexus-incident-modal">
            <button type="button" className="nexus-modal-close" onClick={closeIncidentModal} aria-label="Close incident detail">
              <FaTimesCircle />
            </button>
            <div className="nexus-panel nexus-shell nexus-summary-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Incident Command View</span>
                  <h2 id="nexus-incident-modal-title">{selectedIncident.title}</h2>
                  <p>{selectedIncident.summary}</p>
                </div>
                <div className="summary-badges">
                  <span className={`risk-pill risk-${displayRiskLevelForIncident(selectedIncident).toLowerCase()}`}>{displayRiskLevelForIncident(selectedIncident)}</span>
                  <span className="soft-pill">{selectedIncident.status.replace(/_/g, ' ')}</span>
                </div>
              </div>

              <div className="summary-grid">
                <div className="summary-tile">
                  <label>Probable Root Cause</label>
                  <strong>{selectedIncident.suspected_root_service_name || 'Pending'}</strong>
                  <small>{scorePercent(selectedIncident.predicted_confidence)} confidence</small>
                </div>
                <div className="summary-tile">
                  <label>Blast Radius</label>
                  <strong>{selectedIncident.blast_radius.length}</strong>
                  <small>{selectedIncident.blast_radius.join(', ') || 'No downstream radius yet'}</small>
                </div>
                <div className="summary-tile">
                  <label>Business Impact</label>
                  <strong>{scorePercent(selectedIncident.business_impact_score)}</strong>
                  <small>{selectedIncident.affected_services.join(', ')}</small>
                </div>
                <div className="summary-tile">
                  <label>Start Time</label>
                  <strong>{formatDateTime(selectedIncident.start_time)}</strong>
                  <small>{formatRelativeMinutes(selectedIncident.start_time)}</small>
                </div>
                <div className="summary-tile">
                  <label>Incident Duration</label>
                  <strong>{formatDurationBetween(selectedIncident.start_time, selectedIncident.end_time)}</strong>
                  <small>{selectedIncident.end_time ? `Ended ${formatDateTime(selectedIncident.end_time)}` : 'Still being monitored'}</small>
                </div>
                <div className="summary-tile">
                  <label>Learning State</label>
                  <strong>{selectedIncident.verdict ? 'Learned' : 'Awaiting Verdict'}</strong>
                  <small>{selectedIncident.verdict ? selectedIncident.verdict.details?.verdict || 'Operator verdict recorded' : 'Operator outcome will tune Nexus confidence'}</small>
                </div>
              </div>

              <div className="action-row">
                <button type="button" onClick={() => void requestDiagnostics()} disabled={actionBusy === 'diagnostics'}>
                  <FaWrench /> {actionBusy === 'diagnostics' ? 'Preparing...' : 'Request Diagnostics'}
                </button>
                <button type="button" onClick={() => void createTask()} disabled={actionBusy === 'task'}>
                  <FaTasks /> {actionBusy === 'task' ? 'Creating...' : 'Create Response Task'}
                </button>
                <button
                  type="button"
                  className="approve"
                  onClick={openIncidentServiceControl}
                  disabled={!selectedIncident.suspected_root_service && !selectedIncident.affected_services.length}
                  title="Open the OTP-gated Service Control Gate for START, STOP, and RESTART."
                >
                  <FaShieldAlt /> Service Control
                </button>
              </div>

              {rawEvidenceLink ? (
                <Link className="inline-link large" to={rawEvidenceLink}>
                  <FaNetworkWired /> Open raw Network Sentinel evidence
                </Link>
              ) : (
                <div className="nexus-banner warning">
                  <strong>Raw evidence deep link is not mapped yet.</strong>
                  <span>Attach a `network_service_id` in the service catalog to open the live Network Sentinel record directly.</span>
                </div>
              )}

              <div className="nexus-banner warning">
                <strong>Restart execution is only available inside the Service Control Gate.</strong>
                <span>Use Service Control to open the live operations cockpit and run OTP-gated START, STOP, or RESTART with current runtime evidence.</span>
              </div>
            </div>

            <div className="nexus-tabs-shell nexus-shell">
              <div className="nexus-tablist" role="tablist" aria-label="Sentinel Nexus detail sections">
                {detailTabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeDetailTab === tab.id}
                    className={`nexus-tab ${activeDetailTab === tab.id ? 'active' : ''}`}
                    onClick={() => selectDetailTab(tab.id)}
                  >
                    <span className="nexus-tab-label">{tab.icon}{tab.label}</span>
                    <span className="nexus-tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {activeDetailTab === 'topology'
              ? renderTopologyTab()
              : activeDetailTab === 'evidence'
                ? renderEvidenceTab()
                : activeDetailTab === 'actions'
                  ? renderActionsTab()
                  : activeDetailTab === 'procedure'
                    ? renderProcedureTab()
                    : activeDetailTab === 'outcome'
                      ? renderOutcomeTab()
                      : renderOverviewTab()}
          </section>
        </div>
      ) : null}
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const sourceExplorerModal = (() => {
    if (!sourceExplorer || !selectedService) return null;
    const feed = sourceExplorerData;
    const activeSource = sourceExplorer.source || 'all sources';
    return (
      <div className="nexus-modal-backdrop nexus-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label="Nexus source explorer">
        <section className="nexus-modal nexus-fullscreen-modal nexus-source-modal nexus-shell">
          <button type="button" className="nexus-modal-close" onClick={() => setSourceExplorer(null)} aria-label="Close source explorer">
            <FaTimesCircle />
          </button>
          <div className="nexus-drilldown-hero">
            <div>
              <span className="panel-kicker"><FaSignal />Source Explorer</span>
              <h2>{selectedService.service_name}</h2>
              <p>Full recent evidence stream for {activeSource}. The cockpit stays light; this lane opens the investigation window only when needed.</p>
            </div>
            <div className="nexus-drilldown-actions">
              <button type="button" className="secondary-action" onClick={() => void refreshServiceSignalExplorer()} disabled={sourceExplorerLoading}>
                <FaSyncAlt /> {sourceExplorerLoading ? 'Refreshing...' : 'Refresh signals'}
              </button>
              <button type="button" className="secondary-action" onClick={() => void openServiceLogTail()} disabled={logTailLoading}>
                <FaTerminal /> Live log tail
              </button>
            </div>
          </div>

          <div className="source-filter-rail">
            <button type="button" className={!sourceExplorer.source ? 'active' : ''} onClick={() => void openServiceSignalExplorer(null)}>
              All sources <strong>{Object.values(feed?.source_counts || {}).reduce((total, count) => total + Number(count), 0)}</strong>
            </button>
            {Object.entries(feed?.source_counts || serviceLiveState?.signals.source_counts || {}).map(([source, count]) => (
              <button key={source} type="button" className={sourceExplorer.source === source ? 'active' : ''} onClick={() => void openServiceSignalExplorer(source)}>
                {source} <strong>{count}</strong>
              </button>
            ))}
          </div>

          {sourceExplorerError ? <div className="nexus-banner error">{sourceExplorerError}</div> : null}
          <div className="source-insight-grid">
            <div>
              <label>Window</label>
              <strong>{feed ? `${feed.since_hours}h` : 'Loading'}</strong>
              <small>{feed ? `${feed.returned}/${feed.total} returned` : 'Nexus is loading the source window.'}</small>
            </div>
            <div>
              <label>Severity Mix</label>
              <strong>{Object.entries(feed?.severity_counts || {}).map(([key, value]) => `${key}:${value}`).join(' | ') || 'No counts'}</strong>
              <small>Counted inside the selected evidence window.</small>
            </div>
            <div>
              <label>Layers</label>
              <strong>{Object.keys(feed?.layer_counts || {}).length}</strong>
              <small>{Object.entries(feed?.layer_counts || {}).slice(0, 3).map(([key, value]) => `${key}:${value}`).join(' | ') || 'No layer data yet'}</small>
            </div>
          </div>

          <div className="source-evidence-table">
            {(feed?.signals || []).map((signal) => (
              <article key={signal.signal_id} className={`source-evidence-row severity-${signal.severity.toLowerCase()}`}>
                <div>
                  <span>{formatDateTime(signal.timestamp)}</span>
                  <strong>{signal.source}</strong>
                  <small>{signal.observation_layer || signal.vantage_point || 'unknown layer'}</small>
                </div>
                <p>{signal.message}</p>
                <footer>
                  <span>{signal.failure_domain_hint || 'domain unknown'}</span>
                  <span>{signal.signature_family || signal.signal_type}</span>
                </footer>
              </article>
            ))}
            {sourceExplorerLoading ? <div className="empty-state compact">Loading Nexus evidence stream...</div> : null}
            {!sourceExplorerLoading && !feed?.signals.length ? <div className="empty-state compact">No signals matched this source window.</div> : null}
          </div>
        </section>
      </div>
    );
  })();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const logTailModal = (() => {
    if (!logTailOpen || !selectedService) return null;
    const tail = logTailData;
    return (
      <div className="nexus-modal-backdrop nexus-fullscreen-backdrop" role="dialog" aria-modal="true" aria-label="Nexus live log tail">
        <section className="nexus-modal nexus-fullscreen-modal nexus-log-tail-modal nexus-shell">
          <button type="button" className="nexus-modal-close" onClick={() => setLogTailOpen(false)} aria-label="Close live log tail">
            <FaTimesCircle />
          </button>
          <div className="nexus-drilldown-hero log-tail">
            <div className='fine-div'>
              <span className="panel-kicker"><FaTerminal />Live Log Tail</span>
              <h2>{selectedService.service_name}</h2>
              <p>{tail?.log_path || selectedService.endpoint_config.logs_url || 'No log path reported yet.'}</p>
            </div>
            <div className="nexus-drilldown-actions">
              <button type="button" className={`secondary-action ${logTailFollowing ? 'active' : ''}`} onClick={() => setLogTailFollowing((value) => !value)}>
                <FaBroadcastTower /> {logTailFollowing ? 'Following live' : 'Follow paused'}
              </button>
              <button type="button" className="secondary-action" onClick={() => void refreshServiceLogTail()} disabled={logTailLoading}>
                <FaSyncAlt /> {logTailLoading ? 'Refreshing...' : 'Refresh tail'}
              </button>
            </div>
          </div>
          {logTailError ? <div className="nexus-banner error">{logTailError}</div> : null}
          {tail && !tail.available ? <div className="nexus-banner warning">{tail.reason || 'Live log tail is not available.'}</div> : null}
          <div className="log-tail-meta">
            <span>{tail ? formatRelativeMinutes(tail.generated_at) : 'Loading'}</span>
            <span>{tail?.lines.length || 0} event(s)</span>
            <span>{tail?.line_grouping === 'timestamp_event' ? 'timestamp grouped' : 'raw line mode'}</span>
            <span>{tail?.tail_mode ? String(tail.tail_mode).replace(/_/g, ' ') : 'latest first'}</span>
            <span>{tail?.bytes_read ? `${tail.bytes_read} bytes read` : 'bounded read'}</span>
            <span>{tail?.truncated ? 'window truncated' : 'full window'}</span>
          </div>
          <div className="log-tail-console">
            {(tail?.lines || []).map((line) => (
              <div key={`${line.index}-${line.message}`} className={`log-tail-row severity-${String(line.severity || 'info').toLowerCase()}`}>
                <span className="log-tail-timestamp">{line.timestamp || `#${line.index}`}</span>
                <strong>{line.level || 'LOG'}</strong>
                <code>{line.message}</code>
                {Number(line.physical_line_count || 0) > 1 ? (
                  <em>{line.physical_line_count} physical lines</em>
                ) : null}
              </div>
            ))}
            {logTailLoading ? <div className="empty-state compact">Reading bounded log tail from the light agent...</div> : null}
            {!logTailLoading && tail?.available && !tail.lines.length ? <div className="empty-state compact">The selected log window is empty.</div> : null}
          </div>
        </section>
      </div>
    );
  })();

  const renderServiceLiveDashboard = () => {
    if (!selectedService) {
      return (
        <div className="service-live-cockpit editor-scroll">
          <div className="empty-state">Save the service first, then Nexus can show live telemetry for it.</div>
        </div>
      );
    }

    const live = serviceLiveState;
    const agentSignal = live?.agent.latest_signal;
    const networkSignal = live?.network.latest_signal;
    const host = live?.agent.host || {};
    const memory = (host.memory as Record<string, unknown> | undefined) || {};
    const disk = (host.disk as Record<string, unknown> | undefined) || {};
    const rootDisk = (disk.root as Record<string, unknown> | undefined) || {};
    const logDisk = (disk.log_filesystem as Record<string, unknown> | undefined) || {};
    const pressure = live?.agent.resource_pressure || {};
    const logWindow = live?.agent.log_window || {};
    const healthcheck = live?.agent.healthcheck || {};
    const heartbeat = live?.agent.heartbeat || {};
    const heartbeatTime = typeof heartbeat.timestamp === 'string' ? heartbeat.timestamp : null;
    const processRows = live?.agent.processes || [];
    const collectorMode = String(pressure.collector_mode || agentSignal?.attributes?.collector_mode || 'unknown');
    const networkDurationSeconds = Number(live?.network.problem_duration_seconds || 0);
    const networkDuration = networkDurationSeconds
      ? formatDurationBetween(new Date(Date.now() - networkDurationSeconds * 1000).toISOString(), new Date().toISOString())
      : null;
    const displayValue = (value: unknown, fallback = 'Unknown') => (value === null || value === undefined || value === '' ? fallback : String(value));
    const displayPercent = (value: unknown) => (value === null || value === undefined || value === '' ? 'Unknown' : `${String(value)}%`);
    const displayLogOwner = (owner: unknown) => {
      if (!owner) return '';
      if (typeof owner !== 'object') return String(owner);
      const payload = owner as Record<string, unknown>;
      if (payload.missing) return 'log path not readable';
      const identity = payload.uid != null || payload.gid != null ? `uid ${displayValue(payload.uid, '?')} / gid ${displayValue(payload.gid, '?')}` : '';
      const mode = payload.mode ? `mode ${String(payload.mode)}` : '';
      const size = payload.size != null ? `${displayValue(payload.size)} bytes` : '';
      return [identity, mode, size].filter(Boolean).join(' | ');
    };
    const highLoad = pressure.high_load === true;
    const healthOk = healthcheck.ok === true ? 'Passing' : healthcheck.ok === false ? 'Failing' : 'Not configured';
    const logOwnerLabel = displayLogOwner(logWindow.owner);
    const controlReadiness = live?.control?.readiness || {};
    const operationConfig: Array<{ operation: NexusServiceControlOperation; label: string; icon: React.ReactNode; tone: string }> = [
      { operation: 'start', label: 'Start', icon: <FaPlay />, tone: 'start' },
      { operation: 'stop', label: 'Stop', icon: <FaStop />, tone: 'stop' },
      { operation: 'restart', label: 'Restart', icon: <FaPowerOff />, tone: 'restart' },
    ];
    const restartReadiness = controlReadiness.restart;
    const restartBlockers = restartReadiness?.blocked_reasons || [];
    const diagnosticRows = live?.diagnostics?.latest || [];
    const actionRows = live?.actions?.latest || [];
    const runtimeState = String(live?.agent.runtime_state || '').toLowerCase();
    const processCount = Number(live?.agent.process_count ?? 0);
    const serviceIsRunning = runtimeState === 'running' || processCount > 0 || ['up', 'healthy', 'running', 'ok'].includes(String(live?.agent.status || '').toLowerCase());
    const serviceIsStopped = runtimeState === 'stopped' || (processCount === 0 && !!live?.agent.latest_signal);
    const activeControlAction = actionRows.find((action) => ['MONITORING', 'APPROVED', 'REQUESTED'].includes(String(action.status || '').toUpperCase()));
    const runtimeControlReason = (operation: NexusServiceControlOperation) => {
      if (activeControlAction) return `${String(activeControlAction.action_type || 'control').replace(/_/g, ' ')} is still being verified by Nexus.`;
      if (operation === 'start' && serviceIsRunning) return 'Service is already running according to the latest light-agent process check.';
      if ((operation === 'stop' || operation === 'restart') && serviceIsStopped) return 'Service is already stopped according to the latest light-agent process check.';
      return '';
    };
    const latestDiagnostic =
      diagnosticRows.find((bundle) => Array.isArray(bundle.command_results) && bundle.command_results.length > 0) ||
      diagnosticRows[0] ||
      null;
    const diagnosticResults = latestDiagnostic?.command_results || [];
    const hasDiagnosticPayload = diagnosticResults.length > 0;
    const asRecord = (value: unknown): Record<string, unknown> => (
      value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
    );
    const asNumber = (value: unknown): number | null => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    };
    const commandStatus = (result: Record<string, unknown>) => String(result.status || 'UNKNOWN').toUpperCase();
    const commandById = (commandId: string) =>
      diagnosticResults.find((result) => String(result.command_id || '') === commandId);
    const completedDiagnosticCount = diagnosticResults.filter((result) => commandStatus(result) === 'COMPLETED').length;
    const failedDiagnosticCount = diagnosticResults.filter((result) => commandStatus(result) === 'FAILED').length;
    const skippedDiagnosticCount = diagnosticResults.filter((result) => commandStatus(result) === 'SKIPPED').length;
    const diagnosticInsights: Array<{ key: string; label: string; value: string; detail: string; tone?: string }> = [];
    const memoryResult = commandById('memory_summary');
    const memoryOutput = asRecord(memoryResult?.output);
    const diagnosticMemoryUsed = asNumber(memoryOutput.used_percent);
    const liveMemoryUsed = asNumber(memory.used_percent);
    if (diagnosticMemoryUsed !== null && (liveMemoryUsed === null || Math.abs(diagnosticMemoryUsed - liveMemoryUsed) >= 1)) {
      const available = memoryOutput.available_mb != null ? `${displayValue(memoryOutput.available_mb)} MB available` : 'agent diagnostic memory sample';
      diagnosticInsights.push({
        key: 'memory-delta',
        label: 'Memory delta',
        value: `${diagnosticMemoryUsed}%`,
        detail: available,
        tone: diagnosticMemoryUsed >= 85 ? 'warn' : 'clear',
      });
    }
    const diskResult = commandById('disk_summary');
    const diskOutput = asRecord(diskResult?.output);
    const diagnosticLogDisk = asRecord(diskOutput.log_filesystem);
    const diagnosticRootDisk = asRecord(diskOutput.root);
    const diagnosticDiskUsed = asNumber(diagnosticLogDisk.used_percent) ?? asNumber(diagnosticRootDisk.used_percent);
    const liveDiskUsed = asNumber(logDisk.used_percent) ?? asNumber(rootDisk.used_percent);
    if (diagnosticDiskUsed !== null && (liveDiskUsed === null || Math.abs(diagnosticDiskUsed - liveDiskUsed) >= 1)) {
      diagnosticInsights.push({
        key: 'disk-delta',
        label: 'Filesystem delta',
        value: `${diagnosticDiskUsed}%`,
        detail: diagnosticLogDisk.mountpoint ? `log volume ${displayValue(diagnosticLogDisk.mountpoint)}` : 'diagnostic filesystem sample',
        tone: diagnosticDiskUsed >= 80 ? 'warn' : 'clear',
      });
    }
    const socketResult = commandById('socket_summary');
    const socketStdout = typeof socketResult?.stdout === 'string' ? socketResult.stdout : '';
    const listeningSockets = socketStdout.split(/\r?\n/).filter((line) => line.includes('LISTEN')).length;
    if (commandStatus(asRecord(socketResult)) === 'FAILED') {
      diagnosticInsights.push({
        key: 'socket-failed',
        label: 'Socket probe',
        value: 'failed',
        detail: String(socketResult?.stderr || 'ss command did not complete'),
        tone: 'warn',
      });
    } else if (listeningSockets > 0) {
      diagnosticInsights.push({
        key: 'socket-listeners',
        label: 'Host listeners',
        value: String(listeningSockets),
        detail: 'allowlisted socket sweep completed',
        tone: 'clear',
      });
    }
    diagnosticResults
      .filter((result) => commandStatus(result) === 'FAILED')
      .filter((result) => String(result.command_id || '') !== 'socket_summary')
      .slice(0, 2)
      .forEach((result) => {
        diagnosticInsights.push({
          key: `failed-${String(result.command_id || diagnosticInsights.length)}`,
          label: String(result.command_id || 'Diagnostic check').replace(/_/g, ' '),
          value: 'failed',
          detail: String(result.stderr || result.reason || 'command returned a non-zero result'),
          tone: 'warn',
        });
      });

    return (
      <div className="service-live-cockpit editor-scroll">
        <section className={`service-live-hero tone-${live?.status.tone || selectedServiceSignalStatus.tone}`}>
          <div className='my-div'>
            <span className="panel-kicker">Live Service Cockpit</span>
            <h3>{live?.status.label || selectedServiceSignalStatus.label}</h3>
            <p>{live?.status.detail || selectedServiceSignalStatus.detail}</p>
          </div>
          <div className="service-live-hero-badges">
            <span>{serviceLiveLoading ? 'Refreshing telemetry' : 'Live refresh'}</span>
            <strong>{live ? formatRelativeMinutes(live.generated_at) : 'Awaiting live state'}</strong>
          </div>
        </section>

        <div className="service-live-grid">
          <div className="service-live-tile emphasis">
            <label>Runtime Agent</label>
            <strong>{runtimeState && runtimeState !== 'unknown' ? runtimeState : live?.agent.status || (agentSignal ? agentSignal.severity : 'No signal')}</strong>
            <small>{agentSignal?.message || 'No light-agent runtime signal has arrived yet.'}</small>
          </div>
          <div className="service-live-tile">
            <label>Process Count</label>
            <strong>{live?.agent.process_count ?? 'Unknown'}</strong>
            <small>{selectedService.metadata?.process_match ? `match: ${String(selectedService.metadata.process_match)}` : selectedService.observation_config.agent_id || 'agent not mapped'}</small>
          </div>
          <div className="service-live-tile">
            <label>Network Sentinel</label>
            <strong>{live?.network.status || 'Unmapped'}</strong>
            <small>{networkSignal?.message || 'External reachability has not reported for this service.'}</small>
          </div>
          <div className="service-live-tile">
            <label>Incident Pressure</label>
            <strong>{live?.status.active_incidents ?? selectedServiceIncidents.filter(isOperationalImpactActive).length}</strong>
            <small>{live?.status.awaiting_verdict || 0} awaiting verdict</small>
          </div>
          <div className="service-live-tile">
            <label>Host Load</label>
            <strong>{displayValue(host.load_per_core)}</strong>
            <small>{highLoad ? 'High load guard active' : `collector ${collectorMode}`}</small>
          </div>
          <div className="service-live-tile">
            <label>Memory</label>
            <strong>{displayPercent(memory.used_percent)}</strong>
            <small>{memory.available_mb != null ? `${displayValue(memory.available_mb)} MB available` : 'Agent memory snapshot pending'}</small>
          </div>
          <div className="service-live-tile">
            <label>Log Filesystem</label>
            <strong>{logDisk.used_percent != null ? displayPercent(logDisk.used_percent) : rootDisk.used_percent != null ? displayPercent(rootDisk.used_percent) : 'Unknown'}</strong>
            <small>{logOwnerLabel || selectedService.endpoint_config.logs_url || 'log path not configured'}</small>
          </div>
          <div className="service-live-tile">
            <label>Heartbeat</label>
            <strong>{heartbeatTime ? formatRelativeMinutes(heartbeatTime) : 'No heartbeat'}</strong>
            <small>{live?.agent.configured_agent_id || selectedService.observation_config.agent_id || 'agent id not configured'}</small>
          </div>
          <div className="service-live-tile">
            <label>Healthcheck</label>
            <strong>{healthOk}</strong>
            <small>{healthcheck.status_code ? `HTTP ${displayValue(healthcheck.status_code)}` : selectedService.endpoint_config.healthcheck_url || 'local agent process/log checks are primary'}</small>
          </div>
        </div>

        <section className={`service-live-panel service-control-panel ${restartReadiness?.ready ? 'ready' : 'blocked'}`}>
          <div className="section-title-row">
            <div>
              <h3>Service Control Gate</h3>
              <p>OTP-gated START, STOP, and RESTART for services certified at restart_ready.</p>
            </div>
            <span>{restartReadiness?.ready ? 'restart-ready' : 'gated'}</span>
          </div>
          <div className="service-control-readiness">
            <div>
              <strong>{serviceDraft.certification.lifecycle_stage.replace(/_/g, ' ')}</strong>
              <small>Certification stage keeps every previous capability and adds the next gate.</small>
            </div>
            <div>
              <strong>{restartReadiness?.control_url || '/control' || 'No control URL'}</strong>
              <small>Use the light-agent `/control` endpoint for start and stop.</small>
            </div>
            <div>
              <strong>{selectedService.restart_policy.allowed_service_types.join(', ') || 'No policy types'}</strong>
              <small>For this service, `channel` must be included before restart_ready can execute.</small>
            </div>
          </div>
          {restartBlockers.length ? (
            <div className="service-control-blockers">
              {restartBlockers.slice(0, 4).map((reason) => <span key={reason}>{reason}</span>)}
            </div>
          ) : (
            <div className="service-control-clearance">All control gates are green. Nexus will still require an email OTP before execution.</div>
          )}
          {actionRows[0] ? (
            <div className={`service-control-last tone-${String(actionRows[0].status || '').toLowerCase()}`}>
              <strong>{String(actionRows[0].action_type || 'service control').replace(/_/g, ' ')}: {String(actionRows[0].status || 'unknown').replace(/_/g, ' ')}</strong>
              <span>{actionRows[0].result_summary || actionRows[0].blocked_reasons?.[0] || 'Nexus is tracking the latest control action.'}</span>
            </div>
          ) : null}
          <label className="service-control-reason">
            <span>Operator reason / procedure reference</span>
            <input
              value={serviceControlReason}
              onChange={(event) => setServiceControlReason(event.target.value)}
              placeholder="e.g. ATE validation controlled restart after diagnostics"
              disabled={!canOperateNexus}
            />
          </label>
          <div className="service-control-actions">
            {operationConfig.map((item) => {
              const readiness = controlReadiness[item.operation];
              const runtimeReason = runtimeControlReason(item.operation);
              const disabled = !canOperateNexus || serviceControlBusy !== null || !readiness?.ready || Boolean(runtimeReason);
              return (
                <button
                  key={item.operation}
                  type="button"
                  className={`service-control-button tone-${item.tone}`}
                  disabled={disabled}
                  onClick={() => void openServiceControlGate(item.operation)}
                  title={runtimeReason || readiness?.blocked_reasons?.join(' ') || `Send OTP and ${item.label.toLowerCase()} ${selectedService.service_name}`}
                >
                  {item.icon}
                  {serviceControlBusy === item.operation ? 'Sending OTP...' : item.label}
                </button>
              );
            })}
            <button type="button" className="secondary-action" onClick={() => void requestSelectedServiceDiagnostics()} disabled={!canOperateNexus || actionBusy === 'service-diagnostics'}>
              <FaWrench /> {actionBusy === 'service-diagnostics' ? 'Requesting...' : 'Request Diagnostics'}
            </button>
          </div>
          {serviceControlError ? <div className="nexus-banner error">{serviceControlError}</div> : null}
        </section>

        <section className="service-live-panel service-diagnostics-panel">
          <div className="section-title-row">
            <div>
              <h3>Diagnostic Intelligence</h3>
              <p>Only the latest agent findings that add signal beyond the live cockpit.</p>
            </div>
            <span>{latestDiagnostic ? formatRelativeMinutes(latestDiagnostic.requested_at) : 'not run'}</span>
          </div>
          {latestDiagnostic && hasDiagnosticPayload ? (
            <div className="diagnostic-focus-strip">
              <div>
                <strong>{latestDiagnostic.status === 'COMPLETED' ? 'Latest sweep complete' : latestDiagnostic.status.replace(/_/g, ' ')}</strong>
                <small>
                  {completedDiagnosticCount} clear
                  {failedDiagnosticCount ? ` | ${failedDiagnosticCount} failed` : ''}
                  {skippedDiagnosticCount ? ` | ${skippedDiagnosticCount} skipped by config` : ''}
                  {actionRows.length ? ` | ${actionRows.length} recent control action${actionRows.length === 1 ? '' : 's'}` : ''}
                </small>
              </div>
              <span>{latestDiagnostic.dispatch_status || 'agent callback captured'}</span>
            </div>
          ) : latestDiagnostic ? (
            <div className="diagnostic-focus-strip pending">
              <div>
                <strong>Diagnostic result pending</strong>
                <small>{latestDiagnostic.dispatch_status || 'Nexus has not received an agent result payload yet.'}</small>
              </div>
              <span>{latestDiagnostic.status}</span>
            </div>
          ) : null}
          {latestDiagnostic && hasDiagnosticPayload && diagnosticInsights.length ? (
            <div className="diagnostic-insight-grid">
              {diagnosticInsights.slice(0, 4).map((insight) => (
                <div key={insight.key} className={`diagnostic-insight-card tone-${insight.tone || 'neutral'}`}>
                  <label>{insight.label}</label>
                  <strong>{insight.value}</strong>
                  <small>{insight.detail}</small>
                </div>
              ))}
            </div>
          ) : latestDiagnostic && hasDiagnosticPayload ? (
            <div className="diagnostic-no-drift">
              <strong>No diagnostic drift detected.</strong>
              <span>The latest agent sweep does not contradict the live runtime, memory, filesystem, or heartbeat view.</span>
            </div>
          ) : latestDiagnostic ? (
            <div className="diagnostic-no-drift pending">
              <strong>Awaiting usable diagnostics.</strong>
              <span>Latest request has no command results yet, so Nexus is keeping the Live Cockpit as the source of truth.</span>
            </div>
          ) : (
            <div className="diagnostic-no-drift pending">
              <strong>No diagnostic sweep yet.</strong>
              <span>Run Request Diagnostics when you need a service-local evidence bundle before certification or restart testing.</span>
            </div>
          )}
        </section>

        <div className="service-live-dual">
          <section className="service-live-panel">
            <div className="section-title-row">
              <div>
                <h3>Signal Sources</h3>
                <p>Preview only. Open a source to inspect the full recent signal window.</p>
              </div>
              <div className="section-action-row">
                <button type="button" className="mini-action" onClick={() => void openServiceSignalExplorer(null)}>
                  <FaSignal /> Open sources
                </button>
                <button type="button" className="mini-action" onClick={() => void openServiceLogTail()}>
                  <FaTerminal /> Log tail
                </button>
                <span>{live?.signals.recent_total || 0} recent</span>
              </div>
            </div>
            <div className="service-signal-chips">
              {Object.entries(live?.signals.source_counts || {}).map(([source, count]) => (
                <button key={source} type="button" onClick={() => void openServiceSignalExplorer(source)}>
                  {source}: {count}
                </button>
              ))}
              {!Object.keys(live?.signals.source_counts || {}).length ? <span>No recent source counts yet</span> : null}
            </div>
            <div className="service-signal-feed">
              {(live?.signals.latest || []).slice(0, 6).map((signal) => (
                <div key={signal.signal_id} className={`service-signal-row severity-${signal.severity.toLowerCase()}`}>
                  <span>{formatDateTime(signal.timestamp)}</span>
                  <strong>{signal.source}</strong>
                  <small>{signal.message}</small>
                </div>
              ))}
              {!live?.signals.latest?.length ? <div className="empty-state compact">No live evidence has reached Nexus for this service yet.</div> : null}
            </div>
          </section>

          <section className="service-live-panel">
            <div className="section-title-row">
              <h3>Dependency Effects</h3>
              <span>{selectedServiceDependencies.upstream.length}/{selectedServiceDependencies.downstream.length}</span>
            </div>
            <div className="service-dependency-map">
              <div>
                <label>Uses</label>
                {(live?.dependencies.outgoing || selectedServiceDependencies.upstream).slice(0, 6).map((edge: any) => (
                  <span key={edge.edge_id || edge.to_service_id}>{edge.to_service_id || edge.to_service?.service_id} | {edge.dependency_type}</span>
                ))}
                {!selectedServiceDependencies.upstream.length ? <small>No outgoing dependencies declared.</small> : null}
              </div>
              <div>
                <label>Feeds</label>
                {(live?.dependencies.incoming || selectedServiceDependencies.downstream).slice(0, 6).map((edge: any) => (
                  <span key={edge.edge_id || edge.from_service_id}>{edge.from_service_id || edge.from_service?.service_id} | {edge.dependency_type}</span>
                ))}
                {!selectedServiceDependencies.downstream.length ? <small>No incoming dependents declared.</small> : null}
              </div>
            </div>
            {networkDuration ? (
              <div className="service-live-warning">
                Network Sentinel has held a problem state for roughly {networkDuration}; Nexus treats it as durable evidence once it crosses the persistence threshold.
              </div>
            ) : null}
          </section>
        </div>

        {processRows.length ? (
          <section className="service-live-panel">
            <div className="section-title-row">
              <h3>Runtime Processes</h3>
              <span>{processRows.length} visible</span>
            </div>
            <div className="process-strip">
              {processRows.map((process: Record<string, unknown>) => (
                <div key={String(process.pid || process.cmdline)} className="process-pill">
                  <strong>PID {String(process.pid || 'unknown')}</strong>
                  <span>{process.vm_rss_mb != null ? `${process.vm_rss_mb} MB RSS` : 'memory unknown'}</span>
                  <small>{String(process.cmdline || '').slice(0, 140)}</small>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  };

  const renderRolloverWorkspace = () => {
    const assessmentStatus = rolloverAssessment?.status || 'not_assessed';
    const activeRules = rolloverDraft.rules.filter((rule) => rule.enabled);
    const credentialReady = rolloverDraft.connection.password_set || Boolean(rolloverCredentialPassword);
    const latestExecution = selectedRolloverExecutions[0];
    const commandDisabled = !rolloverDraft.environment_id.trim() || catalogBusy === 'rollover-challenge';
    const executeDisabled = !canOperateNexus || commandDisabled || creatingRolloverEnvironment;
    const modalTitle = creatingRolloverEnvironment ? 'New Rollover Contract' : rolloverDraft.environment_name || 'Environment Rollover';

    return (
      <div className="management-layout management-card-workspace rollover-workspace">
        <aside className="nexus-panel nexus-shell management-list-panel rollover-profile-panel">
          <div className="panel-head">
            <div>
              <h2>Rollover Contracts</h2>
              <p>Open an environment, assess drift, then execute ROLLOVER only through the OTP gate.</p>
            </div>
            {canManageNexus ? (
              <button type="button" className="secondary-action" onClick={startNewRolloverEnvironment}>
                <FaPlus /> New
              </button>
            ) : (
              <span className="readonly-pill">Operator view</span>
            )}
          </div>
          <div className="management-list rollover-profile-list">
            {filteredRolloverEnvironments.map((environment) => {
              const enabledRules = environment.rules.filter((rule) => rule.enabled);
              return (
                <button
                  key={environment.environment_id}
                  type="button"
                  className={`management-card rollover-profile-card ${selectedRolloverEnvironmentId === environment.environment_id ? 'selected' : ''}`}
                  onClick={() => {
                    setCreatingRolloverEnvironment(false);
                    setSelectedRolloverEnvironmentId(environment.environment_id);
                    setRolloverPanelMode('command');
                  }}
                >
                  <div className="rollover-profile-map" aria-hidden="true">
                    <span>LIVE</span>
                    <FaSyncAlt />
                    <strong>{environment.environment_name.slice(0, 18) || environment.environment_id}</strong>
                  </div>
                  <div className="management-card-head">
                    <strong>{environment.environment_name}</strong>
                    <span className={`status-pill ${environment.enabled ? 'ready' : 'blocked'}`}>{environment.enabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                  <p>{environment.environment_id} | {environment.environment_type.replace(/_/g, ' ')} | {environment.service_environment || 'no service map'}</p>
                  <div className="management-card-meta">
                    <span>{enabledRules.length} rollover rules</span>
                    <span>{environment.connection.host || environment.connection.dsn || 'Oracle target pending'}</span>
                    <span>{environment.connection.password_set ? 'credential stored' : 'credential missing'}</span>
                  </div>
                </button>
              );
            })}
            {!filteredRolloverEnvironments.length ? (
              <div className="empty-state">
                <FaSyncAlt />
                <span>No rollover contracts match this view.</span>
              </div>
            ) : null}
          </div>
        </aside>

        {selectedRolloverEnvironmentId || creatingRolloverEnvironment ? (
          <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-rollover-modal-title">
          <section
            className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal rollover-management-modal ${canManageNexus ? '' : 'readonly'}`}
            onChangeCapture={createEditorChangeGuard('rollover')}
            onClickCapture={createEditorClickGuard('rollover')}
          >
            <button type="button" className="nexus-modal-close" onClick={closeRolloverModal} aria-label="Close rollover contract">
              <FaTimesCircle />
            </button>
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Environment Rollover Contract</span>
                <h2 id="nexus-rollover-modal-title">{modalTitle}</h2>
                <p>
                  Assessment is read-only. ROLLOVER sends OTP only when the operator chooses Execute ROLLOVER, and database changes wait for code confirmation.
                </p>
              </div>
              <div className="management-actions">
                {!canManageNexus ? <span className="readonly-pill">Read only</span> : null}
                {editorDirty.rollover ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                {canManageNexus ? (
                  rolloverPanelMode === 'configuration' || creatingRolloverEnvironment ? (
                    <>
                      {!creatingRolloverEnvironment ? (
                        <button type="button" className="secondary-action" onClick={() => setRolloverPanelMode('command')}>
                          <FaSignal /> Command
                        </button>
                      ) : null}
                      <button type="button" className="primary-action" onClick={() => void saveRolloverEnvironment()} disabled={catalogBusy === 'rollover-save'}>
                        <FaSave /> {catalogBusy === 'rollover-save' ? 'Saving...' : 'Save Contract'}
                      </button>
                      {!creatingRolloverEnvironment && selectedRolloverEnvironment ? (
                        <button type="button" className="secondary-action danger" onClick={() => void deleteRolloverEnvironment()} disabled={catalogBusy === 'rollover-delete'}>
                          <FaTrashAlt /> {catalogBusy === 'rollover-delete' ? 'Deleting...' : 'Delete'}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <button type="button" className="primary-action" onClick={() => setRolloverPanelMode('configuration')}>
                      <FaWrench /> Configure Contract
                    </button>
                  )
                ) : null}
              </div>
            </div>

            {!creatingRolloverEnvironment ? (
              <div className="service-modal-tabs rollover-modal-tabs" role="tablist" aria-label="Rollover sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={rolloverPanelMode === 'command'}
                  className={rolloverPanelMode === 'command' ? 'active' : ''}
                  onClick={() => setRolloverPanelMode('command')}
                >
                  <FaShieldAlt /> Rollover Command
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rolloverPanelMode === 'configuration'}
                  className={rolloverPanelMode === 'configuration' ? 'active' : ''}
                  onClick={() => setRolloverPanelMode('configuration')}
                >
                  <FaWrench /> Contract Configuration
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={rolloverPanelMode === 'services'}
                  className={rolloverPanelMode === 'services' ? 'active' : ''}
                  onClick={() => setRolloverPanelMode('services')}
                >
                  <FaLink /> Services & Windows
                </button>
              </div>
            ) : null}

            {rolloverPanelMode === 'command' && !creatingRolloverEnvironment ? (
              <div className="editor-scroll rollover-command-center">
                <section className="rollover-command-hero">
                  <div className={`rollover-current-state state-${assessmentStatus}`}>
                    <span>Current State</span>
                    <strong>{assessmentStatus.replace(/_/g, ' ')}</strong>
                    <small>{rolloverAssessment?.message || 'No assessment has been run in this session.'}</small>
                  </div>
                  <div className="rollover-guardrail-copy">
                    <span>Execution Guardrail</span>
                    <strong>Assess first. ROLLOVER second.</strong>
                    <small>Assessment never sends OTP. Execute ROLLOVER opens the OTP gate, then the modal confirmation performs the database update.</small>
                  </div>
                </section>

                <section className="rollover-command-grid">
                  <div className="rollover-command-panel">
                    <div className="section-title-row">
                      <div>
                        <h3>Assessment</h3>
                        <p>Read Oracle configuration and compare live markers with this environment contract.</p>
                      </div>
                      <span>{activeRules.length} rules</span>
                    </div>
                    <div className="rollover-command-facts">
                      <div>
                        <label>Oracle Target</label>
                        <strong>{rolloverDraft.connection.host || rolloverDraft.connection.dsn || 'Not configured'}</strong>
                        <small>{rolloverDraft.connection.service_name || rolloverDraft.connection.schema_name || rolloverDraft.connection.username || 'Connection identity pending'}</small>
                      </div>
                      <div>
                        <label>Credential</label>
                        <strong>{credentialReady ? 'Ready' : 'Needed'}</strong>
                        <small>{rolloverDraft.connection.username || 'No Oracle username'}</small>
                      </div>
                    </div>
                    <button type="button" className="service-control-button tone-start rollover-command-button" onClick={() => void assessRolloverEnvironment()} disabled={catalogBusy === 'rollover-assess' || !rolloverDraft.environment_id.trim()}>
                      <FaSearch /> {catalogBusy === 'rollover-assess' ? 'Assessing...' : 'Assess Environment'}
                    </button>
                  </div>

                  <div className="rollover-command-panel execution">
                    <div className="section-title-row">
                      <div>
                        <h3>ROLLOVER Execution</h3>
                        <p>This is the only path that sends OTP. No schedule or assessment can execute rollover.</p>
                      </div>
                      <span>OTP gated</span>
                    </div>
                    <label className="service-control-reason">
                      <span>Operator reason / change reference</span>
                      <input value={rolloverReason} onChange={(event) => setRolloverReason(event.target.value)} placeholder="e.g. UAT2 refresh after live clone" disabled={!canOperateNexus} />
                    </label>
                    <button
                      type="button"
                      className="service-control-button tone-restart rollover-command-button"
                      onClick={requestRolloverChallenge}
                      disabled={executeDisabled}
                      title={!canOperateNexus ? 'Your role cannot execute rollover.' : 'Nexus sends OTP for this ROLLOVER request, then waits for confirmation.'}
                    >
                      <FaShieldAlt /> {catalogBusy === 'rollover-challenge' ? 'Opening ROLLOVER OTP gate...' : 'Execute ROLLOVER'}
                    </button>
                    <small className="rollover-execution-note">The OTP email is sent only after this ROLLOVER execution request. The database update still requires the OTP modal confirmation.</small>
                  </div>
                </section>

                {rolloverAssessment ? (
                  <section className="rollover-command-panel assessment-results">
                    <div className={`nexus-banner ${rolloverAssessment.status === 'requires_rollover' ? 'warning' : rolloverAssessment.status === 'error' ? 'error' : 'success'}`}>
                      {rolloverAssessment.message || rolloverAssessment.status}
                    </div>
                    <div className="rollover-rule-results">
                      {rolloverAssessment.rule_results.map((result) => (
                        <div key={result.rule_id} className={`rollover-result-card result-${result.status}`}>
                          <div>
                            <strong>{result.rule_id}</strong>
                            <span>{result.table_name}.{result.column_name}</span>
                          </div>
                          <div className="rollover-result-counts">
                            <span>source {result.source_matches}</span>
                            <span>target {result.target_matches}</span>
                            {result.rows_affected ? <span>updated {result.rows_affected}</span> : null}
                          </div>
                          {result.generated_sql ? <code>{result.generated_sql}</code> : null}
                          {result.sample_values.length ? <small>{result.sample_values.slice(0, 3).join(' | ')}</small> : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : (
                  <section className="rollover-command-panel assessment-empty">
                    <FaDatabase />
                    <div>
                      <strong>No assessment result yet.</strong>
                      <span>Run Assess Environment to see whether this schema is already aligned or requires ROLLOVER.</span>
                    </div>
                  </section>
                )}

                {latestExecution ? (
                  <section className={`rollover-execution-focus status-${latestExecution.status.toLowerCase()}`}>
                    <div>
                      <span>Latest ROLLOVER execution</span>
                      <strong>{latestExecution.status.replace(/_/g, ' ')}</strong>
                      <small>{formatDateTimeInApplicationTimeZone(latestExecution.requested_at)} by {latestExecution.requested_by}</small>
                    </div>
                    <p>{latestExecution.result_summary || latestExecution.blocked_reasons[0] || 'Execution retained for audit.'}</p>
                  </section>
                ) : null}
              </div>
            ) : rolloverPanelMode === 'services' && !creatingRolloverEnvironment ? (
              <div className="editor-scroll rollover-services-window">
                <section className="form-section">
                  <div className="section-title-row">
                    <div>
                      <h3>Linked Service Contracts</h3>
                      <p>Services appear here when their Nexus environment matches this rollover contract.</p>
                    </div>
                    <span>{rolloverDraft.service_environment || 'unmapped'}</span>
                  </div>
                  <div className="rollover-service-grid">
                    {rolloverLinkedServices.map((service) => (
                      <div key={service.service_id} className="route-card rollover-service-card">
                        <div className="route-card-head">
                          <strong>{service.service_name}</strong>
                          <span>{service.certification.lifecycle_stage.replace(/_/g, ' ')}</span>
                        </div>
                        <p>{service.service_id} | {service.service_type} | {service.criticality}</p>
                        <button type="button" className="secondary-action compact" onClick={() => openLinkedServiceContract(service.service_id)}>
                          <FaWrench /> Open Contract
                        </button>
                      </div>
                    ))}
                    {!rolloverLinkedServices.length ? <div className="empty-state compact">No services match this rollover environment yet.</div> : null}
                  </div>
                </section>

                <section className="form-section">
                  <div className="section-title-row">
                    <div>
                      <h3>Reminder Windows</h3>
                      <p>Reminder-only planning windows. Nexus records the date and notifies; it does not execute ROLLOVER from this schedule.</p>
                    </div>
                    <span>reminder only</span>
                  </div>
                  <div className="field-grid">
                    <label>
                      <span>Scheduled For</span>
                      <input type="datetime-local" value={rolloverReminderDateTime} onChange={(event) => setRolloverReminderDateTime(event.target.value)} />
                    </label>
                    <label>
                      <span>Notify Recipients</span>
                      <input value={rolloverReminderRecipients} onChange={(event) => setRolloverReminderRecipients(event.target.value)} placeholder="email1, email2" />
                    </label>
                    <label className="field-span">
                      <span>Notes</span>
                      <input value={rolloverReminderNotes} onChange={(event) => setRolloverReminderNotes(event.target.value)} />
                    </label>
                  </div>
                  <button type="button" className="secondary-action compact" onClick={() => void scheduleRolloverReminder()} disabled={catalogBusy === 'rollover-reminder'}>
                    <FaCalendarAlt /> {catalogBusy === 'rollover-reminder' ? 'Scheduling...' : 'Schedule Reminder'}
                  </button>
                  <div className="rollover-reminder-list">
                    {selectedRolloverReminders.map((reminder) => (
                      <div key={reminder.reminder_id} className="rollover-reminder-row">
                        <div>
                          <strong>{formatDateTimeInApplicationTimeZone(reminder.scheduled_for)}</strong>
                          <span>{reminder.notes || 'Rollover reminder'} | {reminder.status}</span>
                        </div>
                        {reminder.status === 'scheduled' ? (
                          <button type="button" className="danger-action compact" onClick={() => void cancelRolloverReminder(reminder.reminder_id)}>
                            <FaTimesCircle /> Cancel
                          </button>
                        ) : null}
                      </div>
                    ))}
                    {!selectedRolloverReminders.length ? <div className="empty-state compact">No reminder windows for this rollover contract.</div> : null}
                  </div>
                </section>

                <section className="form-section">
                  <h3>ROLLOVER History</h3>
                  <div className="rollover-execution-list">
                    {selectedRolloverExecutions.slice(0, 8).map((execution) => (
                      <div key={execution.execution_id} className={`rollover-execution-row status-${execution.status.toLowerCase()}`}>
                        <div>
                          <strong>{execution.status.replace(/_/g, ' ')}</strong>
                          <span>{formatDateTimeInApplicationTimeZone(execution.requested_at)} by {execution.requested_by}</span>
                        </div>
                        <small>{execution.result_summary || execution.blocked_reasons[0] || 'Execution retained for audit.'}</small>
                      </div>
                    ))}
                    {!selectedRolloverExecutions.length ? <div className="empty-state compact">No rollover executions recorded for this environment.</div> : null}
                  </div>
                </section>
              </div>
            ) : (
              <div className="editor-scroll rollover-configuration-scroll">
              <div className="form-section">
                <h3>Environment Identity</h3>
                <div className="field-grid">
                  <label>
                    <span>Environment ID</span>
                    <input value={rolloverDraft.environment_id} onChange={(event) => setRolloverDraft((current) => ({ ...current, environment_id: event.target.value }))} />
                  </label>
                  <label>
                    <span>Name</span>
                    <input value={rolloverDraft.environment_name} onChange={(event) => setRolloverDraft((current) => ({ ...current, environment_name: event.target.value }))} />
                  </label>
                  <label>
                    <span>Type</span>
                    <select value={rolloverDraft.environment_type} onChange={(event) => setRolloverDraft((current) => ({ ...current, environment_type: event.target.value as RolloverEnvironmentType }))}>
                      {rolloverEnvironmentTypes.map((type) => <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Service Environment</span>
                    <input value={rolloverDraft.service_environment || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, service_environment: event.target.value }))} />
                  </label>
                  <label>
                    <span>Owner Team</span>
                    <input value={rolloverDraft.owner_team || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, owner_team: event.target.value }))} />
                  </label>
                  <label className={`checkbox-field ${rolloverDraft.enabled ? 'checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={rolloverDraft.enabled}
                      onChange={(event) => setRolloverDraft((current) => ({ ...current, enabled: event.target.checked }))}
                    />
                    <span>Enabled</span>
                    <small>Allow assessment and OTP-gated execution</small>
                  </label>
                </div>
                <label className="field-span">
                  <span>Notes</span>
                  <textarea value={rolloverDraft.notes || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, notes: event.target.value }))} />
                </label>
              </div>

              <div className="form-section">
                <h3>Oracle Connection</h3>
                <p className="form-helper">Matches DataGrip properties: Host, Port, SID/Database, Service, or JDBC URL. Nexus can inherit these from Database Fabric.</p>
                <div className="field-grid">
                  <label>
                    <span>Database Fabric Profile</span>
                    <select
                      value={rolloverDraft.connection.source_service_id || ''}
                      onChange={(event) => {
                        const selected = oracleDatabaseServices.find((service) => service.service_id === event.target.value);
                        setRolloverDraft((current) => ({
                          ...current,
                          connection: {
                            ...current.connection,
                            ...(selected ? rolloverConnectionFromDatabaseService(selected) : { source_service_id: '' }),
                          },
                        }));
                      }}
                    >
                      <option value="">Manual DataGrip-style connection</option>
                      {oracleDatabaseServices.map((service) => (
                        <option key={service.service_id} value={service.service_id}>
                          {service.service_name} ({databaseLabel(service.database_profile)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Connection Type</span>
                    <select value={rolloverDraft.connection.connection_type || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, connection_type: event.target.value } }))}>
                      {databaseConnectionTypeOptions.map((item) => <option key={item || 'blank'} value={item}>{item || 'DataGrip default'}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Username</span>
                    <input value={rolloverDraft.connection.username} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, username: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Password</span>
                    <input type="password" value={rolloverCredentialPassword} onChange={(event) => setRolloverCredentialPassword(event.target.value)} placeholder={rolloverDraft.connection.password_set ? 'Stored credential retained' : 'Required before execution'} />
                  </label>
                  <label>
                    <span>JDBC URL</span>
                    <input value={rolloverDraft.connection.jdbc_url || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, jdbc_url: event.target.value } }))} placeholder="jdbc:oracle:thin:@host:1521:SID" />
                  </label>
                  <label>
                    <span>TNS Alias / DSN</span>
                    <input value={rolloverDraft.connection.dsn || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, dsn: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Host</span>
                    <input value={rolloverDraft.connection.host || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, host: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Port</span>
                    <input type="number" value={rolloverDraft.connection.port || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, port: Number(event.target.value || 1521) } }))} />
                  </label>
                  <label>
                    <span>Database / SID</span>
                    <input value={rolloverDraft.connection.database_name || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, database_name: event.target.value, sid: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Instance / SID</span>
                    <input value={rolloverDraft.connection.instance_name || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, instance_name: event.target.value, sid: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Service Name</span>
                    <input value={rolloverDraft.connection.service_name || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, service_name: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Schema</span>
                    <input value={rolloverDraft.connection.schema_name || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, schema_name: event.target.value } }))} />
                  </label>
                  <label>
                    <span>Oracle Config Directory</span>
                    <input value={rolloverDraft.connection.config_dir || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, connection: { ...current.connection, config_dir: event.target.value } }))} placeholder="Folder containing tnsnames.ora" />
                  </label>
                  <div className="field-span connection-test-panel">
                    <div>
                      <strong>Connection proof</strong>
                      <span>Tests the current Oracle fields with the stored credential or the password typed above. It does not assess or rollover.</span>
                    </div>
                    <button type="button" className="secondary-action" onClick={() => void testRolloverConnection()} disabled={catalogBusy === 'rollover-test-connection' || creatingRolloverEnvironment}>
                      <FaPlug /> {catalogBusy === 'rollover-test-connection' ? 'Testing...' : 'Test Connection'}
                    </button>
                    {rolloverConnectionTest ? (
                      <div className={`nexus-banner compact ${rolloverConnectionTest.connected ? 'success' : 'error'}`}>
                        <strong>{rolloverConnectionTest.connected ? 'Oracle login verified' : 'Oracle login failed'}</strong>
                        <span>{rolloverConnectionTest.message}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="form-section">
                <div className="panel-head compact">
                  <div>
                    <h3>Rollover Rules</h3>
                    <p>Each enabled rule is assessed with count checks, then executed as a bound Oracle REPLACE update after OTP.</p>
                  </div>
                  {canManageNexus ? (
                    <button type="button" className="secondary-action compact" onClick={addRolloverRule}>
                      <FaPlus /> Rule
                    </button>
                  ) : null}
                </div>
                <div className="rollover-rule-list">
                  {rolloverDraft.rules.map((rule, index) => (
                    <div key={`${rule.rule_id}-${index}`} className="rollover-rule-card">
                      <div className="rollover-rule-head">
                        <strong>{rule.rule_id || `Rule ${index + 1}`}</strong>
                        <label className={`checkbox-field compact ${rule.enabled ? 'checked' : ''}`}>
                          <input
                            type="checkbox"
                            checked={rule.enabled}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setRolloverDraft((current) => ({
                                ...current,
                                rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, enabled: checked } : item),
                              }));
                            }}
                          />
                          <span>Enabled</span>
                        </label>
                      </div>
                      <div className="field-grid">
                        <label>
                          <span>Rule ID</span>
                          <input value={rule.rule_id} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, rule_id: event.target.value } : item) }))} />
                        </label>
                        <label>
                          <span>Sequence</span>
                          <input type="number" value={rule.sequence} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, sequence: Number(event.target.value || 0) } : item) }))} />
                        </label>
                        <label>
                          <span>Table</span>
                          <input value={rule.table_name} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, table_name: event.target.value } : item) }))} />
                        </label>
                        <label>
                          <span>Column</span>
                          <input value={rule.column_name} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, column_name: event.target.value } : item) }))} />
                        </label>
                        <label>
                          <span>Source Value</span>
                          <input value={rule.source_value} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, source_value: event.target.value } : item) }))} />
                        </label>
                        <label>
                          <span>Target Value</span>
                          <input value={rule.target_value} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, target_value: event.target.value } : item) }))} />
                        </label>
                      </div>
                      <label className="field-span">
                        <span>Description</span>
                        <input value={rule.description || ''} onChange={(event) => setRolloverDraft((current) => ({ ...current, rules: current.rules.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item) }))} />
                      </label>
                      {canManageNexus ? (
                        <button type="button" className="danger-action compact" onClick={() => removeRolloverRule(rule.rule_id)}>
                          <FaTrashAlt /> Remove
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-section">
                <h3>Metadata</h3>
                <textarea value={rolloverMetadataText} onChange={(event) => setRolloverMetadataText(event.target.value)} />
              </div>

              {canManageNexus ? (
                <div className="service-control-actions">
                  <button type="button" className="primary-action" onClick={() => void saveRolloverEnvironment()} disabled={catalogBusy === 'rollover-save'}>
                    <FaSave /> {catalogBusy === 'rollover-save' ? 'Saving...' : 'Save Contract'}
                  </button>
                  {!creatingRolloverEnvironment && selectedRolloverEnvironment ? (
                    <button type="button" className="danger-action" onClick={() => void deleteRolloverEnvironment()} disabled={catalogBusy === 'rollover-delete'}>
                      <FaTrashAlt /> Delete
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
            )}
          </section>
          </div>
        ) : null}
      </div>
    );
  };

  const renderServicesWorkspace = () => (
    <div className="management-layout management-card-workspace">
      <aside className="management-list-panel nexus-panel nexus-shell">
        <div className="panel-head">
          <div>
            <h2>Service Catalog</h2>
            <p>Canonical service contracts, telemetry mappings, restart guardrails, and URL endpoints.</p>
          </div>
          {canManageNexus ? (
            <button type="button" className="secondary-action" onClick={startNewService}>
              <FaPlus /> New
            </button>
          ) : (
            <span className="readonly-pill">Operator view</span>
          )}
        </div>
        <div className="management-list">
          {filteredServices.map((service) => {
            const serviceTypeKey = getServiceTypeKey(service.service_type);
            const visual = getServiceVisual(service);

            return (
              <button
                key={service.service_id}
                type="button"
                className={`management-card service-card service-type-${serviceTypeKey} ${service.database_profile?.enabled ? 'db-aware' : ''} ${selectedServiceId === service.service_id ? 'selected' : ''}`}
                onClick={() => {
                  setCreatingService(false);
                  setSelectedServiceId(service.service_id);
                  setServicePanelMode('overview');
                }}
              >
                <div className="service-type-thumbnail" aria-hidden="true">
                  <div className="service-thumb-grid" />
                  <div className="service-thumb-rings">
                    <span />
                    <span />
                  </div>
                  <div className="service-thumb-flow">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="service-thumb-core">{visual.icon}</div>
                  <div className="service-thumb-caption">
                    <span>{visual.label}</span>
                    <strong>{visual.signal}</strong>
                  </div>
                </div>
                <div className="management-card-head">
                  <strong>{service.service_name}</strong>
                  <span className="soft-pill">{service.certification.lifecycle_stage.replace(/_/g, ' ')}</span>
                </div>
                <p>{service.service_id} | {service.environment} | {service.service_type}</p>
                <div className="management-card-meta">
                  <span>{service.owner_team}</span>
                  <span>{service.criticality}</span>
                  <span>{service.observation_config.network_service_id ? 'mapped' : 'unmapped'}</span>
                  {service.database_profile?.enabled ? <span>{service.database_profile.platform || 'database'}</span> : null}
                </div>
                <div className="service-card-orbit" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
              </button>
            );
          })}
          {!filteredServices.length ? <div className="empty-state">No services match this view yet.</div> : null}
        </div>
      </aside>

      {selectedServiceId || creatingService ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-service-modal-title">
          <section
            className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal ${canManageNexus ? '' : 'readonly'}`}
            onChangeCapture={createEditorChangeGuard('service')}
            onClickCapture={createEditorClickGuard('service')}
          >
            <button type="button" className="nexus-modal-close" onClick={closeServiceModal} aria-label="Close service detail">
              <FaTimesCircle />
            </button>
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Service Contract</span>
                <h2 id="nexus-service-modal-title">{selectedServiceId ? serviceDraft.service_name || serviceDraft.service_id : 'New catalog service'}</h2>
                <p>{canManageNexus ? 'Configure the stable service identity, telemetry bindings, certification stage, and execution endpoints for Nexus.' : 'View service state, graph placement, telemetry contracts, active incident history, and readiness without modifying the catalog.'}</p>
              </div>
              <div className="management-actions">
                {editorDirty.service ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                {canManageNexus ? (
                  <>
                    {servicePanelMode === 'overview' && !creatingService ? (
                      <button type="button" className="primary-action" onClick={() => setServicePanelMode('configuration')}>
                        <FaWrench /> Configure Contract
                      </button>
                    ) : (
                      <>
                        <button type="button" className="secondary-action" onClick={() => setServicePanelMode('overview')} disabled={creatingService}>
                          <FaSignal /> Live Dashboard
                        </button>
                        <button type="button" className="primary-action" onClick={() => void saveService()} disabled={catalogBusy === 'service-save'}>
                          <FaCheckCircle /> {catalogBusy === 'service-save' ? 'Saving...' : 'Save Service'}
                        </button>
                        <button type="button" className="secondary-action danger" onClick={() => void deleteService()} disabled={!selectedServiceId || catalogBusy === 'service-delete'}>
                          <FaTrashAlt /> {catalogBusy === 'service-delete' ? 'Deleting...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <span className="readonly-pill">Admin required to modify</span>
                )}
              </div>
            </div>

            {selectedService ? (
              <div className="service-intelligence-strip">
                <div className={`service-state-orb tone-${selectedServiceSignalStatus.tone}`}>
                  <span>{selectedServiceSignalStatus.label}</span>
                  <small>{selectedServiceSignalStatus.detail}</small>
                </div>
                <button
                  type="button"
                  className="summary-tile service-incident-preview"
                  onClick={() => selectedServiceIncidents.length && setTimelineServiceId(selectedService.service_id)}
                  disabled={!selectedServiceIncidents.length}
                >
                  <label>Active / Historical Incidents</label>
                  <strong>{selectedServiceIncidents.length}</strong>
                  <small>{selectedServiceIncidents[0]?.title || 'No incident history attached yet'}</small>
                </button>
                <div className="summary-tile">
                  <label>Recent Evidence</label>
                  <strong>{selectedServiceEvidence.length}</strong>
                  <small>{selectedServiceEvidence[0]?.summary || 'No service evidence captured yet'}</small>
                </div>
                <div className="summary-tile">
                  <label>Graph Position</label>
                  <strong>{selectedServiceDependencies.upstream.length}/{selectedServiceDependencies.downstream.length}</strong>
                  <small>outgoing / incoming dependencies</small>
                </div>
                <div className="summary-tile">
                  <label>Business Flows</label>
                  <strong>{selectedServiceFlows.length}</strong>
                  <small>{selectedServiceFlows.map((flow) => flow.flow_name).join(', ') || 'No flow placement yet'}</small>
                </div>
              </div>
            ) : null}

            {!creatingService ? (
              <div className="service-modal-tabs" role="tablist" aria-label="Service view sections">
                <button
                  type="button"
                  role="tab"
                  aria-selected={servicePanelMode === 'overview'}
                  className={servicePanelMode === 'overview' ? 'active' : ''}
                  onClick={() => setServicePanelMode('overview')}
                >
                  <FaSignal /> Live Operations
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={servicePanelMode === 'configuration'}
                  className={servicePanelMode === 'configuration' ? 'active' : ''}
                  onClick={() => setServicePanelMode('configuration')}
                >
                  <FaWrench /> Contract Configuration
                </button>
              </div>
            ) : null}

            {servicePanelMode === 'overview' && !creatingService ? renderServiceLiveDashboard() : (
            <div className="editor-scroll">
              <div className="form-grid">
                <section className="form-section">
                  <h3>Identity</h3>
                  <div className="field-grid">
                    <label>
                      <span>Service ID</span>
                      <input value={serviceDraft.service_id} onChange={(event) => setServiceDraft((current) => ({ ...current, service_id: event.target.value }))} />
                    </label>
                    <label>
                      <span>Service Name</span>
                      <input value={serviceDraft.service_name} onChange={(event) => setServiceDraft((current) => ({ ...current, service_name: event.target.value }))} />
                    </label>
                    <label>
                      <span>Service Type</span>
                      <select value={serviceDraft.service_type} onChange={(event) => setServiceDraft((current) => ({ ...current, service_type: event.target.value }))}>
                        {serviceTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Environment</span>
                      <input value={serviceDraft.environment} onChange={(event) => setServiceDraft((current) => ({ ...current, environment: event.target.value }))} />
                    </label>
                    <label>
                      <span>Owner Team</span>
                      <input value={serviceDraft.owner_team} onChange={(event) => setServiceDraft((current) => ({ ...current, owner_team: event.target.value }))} />
                    </label>
                    <label>
                      <span>Criticality</span>
                      <select value={serviceDraft.criticality} onChange={(event) => setServiceDraft((current) => ({ ...current, criticality: event.target.value }))}>
                        {criticalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Description</span>
                    <textarea value={serviceDraft.description || ''} onChange={(event) => setServiceDraft((current) => ({ ...current, description: event.target.value }))} />
                  </label>
                  <div className="field-grid">
                    <label>
                      <span>Runbook Slug</span>
                      <input value={serviceDraft.runbook_slug || ''} onChange={(event) => setServiceDraft((current) => ({ ...current, runbook_slug: event.target.value }))} />
                    </label>
                    <label>
                      <span>Tags</span>
                      <input
                        value={serviceDraft.tags.join(', ')}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, tags: parseListInput(event.target.value) }))}
                        placeholder="idc, auth, critical-path"
                      />
                    </label>
                  </div>
                </section>

                <section className="form-section">
                  <h3>Certification & Policy</h3>
                  <div className="field-grid">
                    <label>
                      <span>Lifecycle Stage</span>
                      <select
                        value={serviceDraft.certification.lifecycle_stage}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            certification: { ...current.certification, lifecycle_stage: event.target.value as any },
                          }))
                        }
                      >
                        {certificationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Certified By</span>
                      <input
                        value={serviceDraft.certification.certified_by || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            certification: { ...current.certification, certified_by: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Primary Cluster</span>
                      <select
                        value={serviceDraft.cluster || ''}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, cluster: event.target.value }))}
                      >
                        <option value="">Unassigned</option>
                        {clusters.map((cluster) => <option key={cluster.cluster_id} value={cluster.cluster_id}>{cluster.cluster_name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Cluster Membership</span>
                      <input
                        value={serviceDraft.cluster_ids.join(', ')}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, cluster_ids: parseListInput(event.target.value) }))}
                        placeholder="idc-auth, auth-platform"
                      />
                    </label>
                  </div>
                  <div className="field-grid checkbox-grid">
                    <label className={`checkbox-field ${serviceDraft.is_stateless ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.is_stateless}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, is_stateless: event.target.checked }))}
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Stateless service</strong>
                        <small>: Allows Nexus to consider guarded restart policies when confidence is high.</small>
                      </span>
                    </label>
                    <label className={`checkbox-field ${serviceDraft.allow_diagnostics ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.allow_diagnostics}
                        onChange={(event) => setServiceDraft((current) => ({ ...current, allow_diagnostics: event.target.checked }))}
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Diagnostics allowed</strong>
                        <small>: Enables evidence bundles and remote inspection for this service contract.</small>
                      </span>
                    </label>
                    <label className={`checkbox-field ${serviceDraft.restart_policy.allow_restart ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.restart_policy.allow_restart}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            restart_policy: { ...current.restart_policy, allow_restart: event.target.checked },
                          }))
                        }
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Restart allowed</strong>
                        <small>: Marks the service as eligible for human-approved safe restart orchestration.</small>
                      </span>
                    </label>
                    <label className={`checkbox-field ${serviceDraft.restart_policy.requires_human_approval ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.restart_policy.requires_human_approval}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            restart_policy: { ...current.restart_policy, requires_human_approval: event.target.checked },
                          }))
                        }
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Human approval required</strong>
                        <small>: Keeps action execution gated behind explicit operator approval in Nexus.</small>
                      </span>
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      <span>Restart Cooldown (minutes)</span>
                      <input
                        type="number"
                        value={serviceDraft.restart_policy.cooldown_minutes}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            restart_policy: {
                              ...current.restart_policy,
                              cooldown_minutes: Number(event.target.value || 0),
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Allowed Restart Types</span>
                      <input
                        value={serviceDraft.restart_policy.allowed_service_types.join(', ')}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            restart_policy: {
                              ...current.restart_policy,
                              allowed_service_types: parseListInput(event.target.value),
                            },
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Certification Notes</span>
                    <textarea
                      value={serviceDraft.certification.notes || ''}
                      onChange={(event) =>
                        setServiceDraft((current) => ({
                          ...current,
                          certification: { ...current.certification, notes: event.target.value },
                        }))
                      }
                    />
                  </label>
                </section>

                <section className="form-section">
                  <h3>Database Contract</h3>
                  <p className="form-helper">Declare the backing data store or mark this service as a database. Nexus uses this to separate app failure from DB, pool, listener, lock, session, storage, and replication pressure.</p>
                  <div className="field-grid checkbox-grid">
                    <label className={`checkbox-field ${serviceDraft.database_profile?.enabled ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.database_profile?.enabled || serviceDraft.service_type === 'db'}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              enabled: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Database-aware service</strong>
                        <small>: Enable for database services and apps where DB evidence must influence correlation.</small>
                      </span>
                    </label>
                    <label className={`checkbox-field ${serviceDraft.database_profile?.shared_dependency ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.database_profile?.shared_dependency || false}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              shared_dependency: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Shared dependency</strong>
                        <small>: Mark core databases that can explain many downstream service symptoms.</small>
                      </span>
                    </label>
                    <label className={`checkbox-field ${serviceDraft.database_profile?.read_only ? 'checked' : ''}`}>
                      <input
                        type="checkbox"
                        checked={serviceDraft.database_profile?.read_only || false}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              read_only: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span className="checkbox-mark" aria-hidden="true" />
                      <span className="checkbox-copy">
                        <strong>Read only</strong>
                        <small>: Use for reporting databases, replicas, or read-only standby paths.</small>
                      </span>
                    </label>
                  </div>
                  <div className="field-grid">
                    <label>
                      <span>Platform</span>
                      <select
                        value={serviceDraft.database_profile?.platform || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              platform: event.target.value,
                            },
                          }))
                        }
                      >
                        {databasePlatformOptions.map((item) => <option key={item || 'blank'} value={item}>{item || 'Select platform'}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Connection Type</span>
                      <select
                        value={serviceDraft.database_profile?.connection_type || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              connection_type: event.target.value,
                            },
                          }))
                        }
                      >
                        {databaseConnectionTypeOptions.map((item) => <option key={item || 'blank'} value={item}>{item || 'DataGrip default'}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>DB Role</span>
                      <select
                        value={serviceDraft.database_profile?.role || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              role: event.target.value,
                            },
                          }))
                        }
                      >
                        {databaseRoleOptions.map((item) => <option key={item || 'blank'} value={item}>{item || 'Select role'}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Host</span>
                      <input
                        value={serviceDraft.database_profile?.host || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              host: event.target.value,
                            },
                          }))
                        }
                        placeholder="Same host field shown in DataGrip"
                      />
                    </label>
                    <label>
                      <span>Database Name</span>
                      <input
                        value={serviceDraft.database_profile?.database_name || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              database_name: event.target.value,
                            },
                          }))
                        }
                        placeholder="IDCDB, lmsdb, postgres..."
                      />
                    </label>
                    <label>
                      <span>Instance / SID</span>
                      <input
                        value={serviceDraft.database_profile?.instance_name || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              instance_name: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>DB Service Name</span>
                      <input
                        value={serviceDraft.database_profile?.service_name || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              service_name: event.target.value,
                            },
                          }))
                        }
                        placeholder="Oracle service, PostgreSQL database, listener alias..."
                      />
                    </label>
                    <label>
                      <span>Username</span>
                      <input
                        value={serviceDraft.database_profile?.username || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              username: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <div className="field-span connection-test-panel">
                      <div>
                        <strong>Database connection proof</strong>
                        <span>Uses the current Oracle/PostgreSQL contract and a one-time password. The password is not stored in Database Fabric.</span>
                      </div>
                      <div className="connection-test-actions">
                        <label>
                          <span>One-time test password</span>
                          <input
                            type="password"
                            value={databaseTestPassword}
                            onChange={(event) => setDatabaseTestPassword(event.target.value)}
                            placeholder="Used only for this connection test"
                          />
                        </label>
                        <button
                          type="button"
                          className="secondary-action"
                          onClick={() => void testDatabaseFabricConnection()}
                          disabled={catalogBusy === 'database-test-connection' || creatingService || !selectedServiceId}
                        >
                          <FaPlug /> {catalogBusy === 'database-test-connection' ? 'Testing...' : 'Test Connection'}
                        </button>
                      </div>
                      {databaseConnectionTest ? (
                        <div className={`nexus-banner compact ${databaseConnectionTest.connected ? 'success' : 'error'}`}>
                          <strong>{databaseConnectionTest.connected ? 'Database login verified' : 'Database login failed'}</strong>
                          <span>{databaseConnectionTest.message}</span>
                          {databaseConnectionTest.latency_ms != null ? <small>{databaseConnectionTest.driver || 'driver'} responded in {databaseConnectionTest.latency_ms} ms.</small> : null}
                        </div>
                      ) : null}
                    </div>
                    <label>
                      <span>Host Group</span>
                      <input
                        value={serviceDraft.database_profile?.host_group || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              host_group: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Port</span>
                      <input
                        type="number"
                        value={serviceDraft.database_profile?.port || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              port: event.target.value ? Number(event.target.value) : null,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Connection Pool</span>
                      <input
                        value={serviceDraft.database_profile?.connection_pool || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              connection_pool: event.target.value,
                            },
                          }))
                        }
                        placeholder="Hikari, UCP, JBoss datasource..."
                      />
                    </label>
                    <label className="field-span">
                      <span>JDBC URL</span>
                      <input
                        value={serviceDraft.database_profile?.jdbc_url || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              jdbc_url: event.target.value,
                            },
                          }))
                        }
                        placeholder="jdbc:oracle:thin:@host:1521:SID or jdbc:postgresql://host:5432/database"
                      />
                    </label>
                    <label>
                      <span>Oracle Config Directory</span>
                      <input
                        value={serviceDraft.database_profile?.config_dir || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              config_dir: event.target.value,
                            },
                          }))
                        }
                        placeholder="Optional folder containing tnsnames.ora"
                      />
                    </label>
                    <label>
                      <span>Max Pool Size</span>
                      <input
                        type="number"
                        value={serviceDraft.database_profile?.max_pool_size || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              max_pool_size: event.target.value ? Number(event.target.value) : null,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Replication Group</span>
                      <input
                        value={serviceDraft.database_profile?.replication_group || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              replication_group: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Failover Group</span>
                      <input
                        value={serviceDraft.database_profile?.failover_group || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              failover_group: event.target.value,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Data Classification</span>
                      <input
                        value={serviceDraft.database_profile?.data_classification || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            database_profile: {
                              ...createEmptyDatabaseProfile(),
                              ...(current.database_profile || {}),
                              data_classification: event.target.value,
                            },
                          }))
                        }
                        placeholder="core-banking, customer, cards, reporting..."
                      />
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Schemas</span>
                    <input
                      value={(serviceDraft.database_profile?.schemas || []).join(', ')}
                      onChange={(event) =>
                        setServiceDraft((current) => ({
                          ...current,
                          database_profile: {
                            ...createEmptyDatabaseProfile(),
                            ...(current.database_profile || {}),
                            schemas: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="IDC_OWNER, LMS_OWNER, public..."
                    />
                  </label>
                  <label className="field-span">
                    <span>Expected DB Evidence</span>
                    <input
                      value={(serviceDraft.database_profile?.expected_evidence || []).join(', ')}
                      onChange={(event) =>
                        setServiceDraft((current) => ({
                          ...current,
                          database_profile: {
                            ...createEmptyDatabaseProfile(),
                            ...(current.database_profile || {}),
                            expected_evidence: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="connection_state, active_sessions, lock_waits, db_error_code, replication_lag..."
                    />
                  </label>
                  <label className="field-span">
                    <span>Safe DB Diagnostics</span>
                    <input
                      value={(serviceDraft.database_profile?.safe_diagnostics || []).join(', ')}
                      onChange={(event) =>
                        setServiceDraft((current) => ({
                          ...current,
                          database_profile: {
                            ...createEmptyDatabaseProfile(),
                            ...(current.database_profile || {}),
                            safe_diagnostics: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="connectivity_check, session_summary, lock_summary, tablespace_summary..."
                    />
                  </label>
                </section>
              </div>

              <div className="form-grid">
                <section className="form-section">
                  <h3>Observation Mapping</h3>
                  <div className="field-grid">
                    <label>
                      <span>Network Service UUID</span>
                      <input
                        value={serviceDraft.observation_config.network_service_id || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, network_service_id: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Agent ID</span>
                      <input
                        value={serviceDraft.observation_config.agent_id || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, agent_id: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Systemd Unit</span>
                      <input
                        value={serviceDraft.observation_config.systemd_unit || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, systemd_unit: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Host Group</span>
                      <input
                        value={serviceDraft.observation_config.host_group || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, host_group: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Log Selector</span>
                      <input
                        value={serviceDraft.observation_config.log_selector || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, log_selector: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Metrics Namespace</span>
                      <input
                        value={serviceDraft.observation_config.metrics_namespace || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, metrics_namespace: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Trace Service Name</span>
                      <input
                        value={serviceDraft.observation_config.trace_service_name || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, trace_service_name: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Preferred Signal Source</span>
                      <input
                        value={serviceDraft.observation_config.preferred_signal_source || ''}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            observation_config: { ...current.observation_config, preferred_signal_source: event.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>
                </section>

                <section className="form-section">
                  <h3>Execution & Shipping URLs</h3>
                  <div className="nexus-command-preset">
                    <label>
                      <span>Agent Command Base URL</span>
                      <input
                        value={String(serviceDraft.metadata?.command_base_url || '')}
                        onChange={(event) =>
                          setServiceDraft((current) => ({
                            ...current,
                            metadata: { ...current.metadata, command_base_url: event.target.value },
                          }))
                        }
                        placeholder="http://<agent-host-ip>:8765"
                      />
                    </label>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        const base = String(serviceDraft.metadata?.command_base_url || '').trim().replace(/\/$/, '');
                        if (!base) {
                          addNotification({ type: 'warning', message: 'Enter the agent command base URL first.', priority: 'medium' });
                          return;
                        }
                        setServiceDraft((current) => ({
                          ...current,
                          endpoint_config: {
                            ...current.endpoint_config,
                            diagnostics_url: `${base}/diagnostics`,
                            restart_url: `${base}/control`,
                          },
                          restart_policy: {
                            ...current.restart_policy,
                            allowed_service_types: Array.from(new Set([...current.restart_policy.allowed_service_types, current.service_type])),
                          },
                        }));
                        addNotification({ type: 'success', message: 'Nexus command endpoints staged for diagnostics and service control.', priority: 'medium' });
                      }}
                    >
                      <FaShieldAlt /> Apply Control Endpoints
                    </button>
                  </div>
                  <p className="form-helper">For restart-ready services, use the light-agent command server base URL. Nexus will derive `/diagnostics` and `/control`, keep service-type policy aligned, and still require OTP approval before execution.</p>
                  <div className="field-grid">
                    {([
                      ['collector_url', 'Collector URL'],
                      ['healthcheck_url', 'Healthcheck URL'],
                      ['metrics_url', 'Metrics URL'],
                      ['logs_url', 'Logs URL'],
                      ['traces_url', 'Traces URL'],
                      ['diagnostics_url', 'Diagnostics URL'],
                      ['restart_url', 'Restart URL'],
                      ['extraction_url', 'Extraction URL'],
                      ['formatting_url', 'Formatting URL'],
                      ['shipping_url', 'Shipping URL'],
                      ['dashboard_url', 'Dashboard URL'],
                    ] as Array<[keyof ServiceEndpointConfig, string]>).map(([field, label]) => (
                      <label key={field}>
                        <span>{label}</span>
                        <input
                          value={(serviceDraft.endpoint_config[field] as string) || ''}
                          onChange={(event) =>
                            setServiceDraft((current) => ({
                              ...current,
                              endpoint_config: { ...current.endpoint_config, [field]: event.target.value },
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <label className="field-span">
                    <span>Metadata (JSON)</span>
                    <textarea value={serviceMetadataText} onChange={(event) => setServiceMetadataText(event.target.value)} />
                  </label>
                </section>
              </div>
            </div>
            )}
          </section>
        </div>
      ) : null}

      {serviceControlChallenge && selectedService ? (
        <div className="nexus-modal-backdrop service-control-otp-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-service-control-title">
          <section className="nexus-modal nexus-service-control-modal nexus-shell">
            <button
              type="button"
              className="nexus-modal-close"
              onClick={() => {
                setServiceControlChallenge(null);
                setServiceControlCode('');
              }}
              aria-label="Close service control verification"
            >
              <FaTimesCircle />
            </button>
            <div className="service-control-otp-hero">
              <div className="ai-brief-orb" aria-hidden="true">
                <span />
                <span />
                <FaKey />
              </div>
              <div className='my-div'>
                <span className="panel-kicker">Nexus Control Verification</span>
                <h2 id="nexus-service-control-title">{serviceControlChallenge.operation.toUpperCase()} {selectedService.service_name}</h2>
                <p>
                  Nexus sent a one-time verification code to {serviceControlChallenge.email}. Enter it here to dispatch the certified light-agent control command.
                </p>
              </div>
            </div>
            <div className="service-control-otp-grid">
              <div>
                <label>
                  <span>One-time code</span>
                  <input
                    value={serviceControlCode}
                    onChange={(event) => handleServiceControlCodeChange(event.target.value)}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </label>
                <small>
                  Expires {formatRelativeMinutes(serviceControlChallenge.expires_at)}. Nexus verifies automatically when six digits are entered.
                </small>
              </div>
              <div className="service-control-otp-summary">
                <span>Service</span>
                <strong>{serviceControlChallenge.service_id}</strong>
                <span>Action</span>
                <strong>{serviceControlChallenge.operation.toUpperCase()}</strong>
              </div>
            </div>
            {serviceControlError ? <div className="nexus-banner error">{serviceControlError}</div> : null}
            <div className="service-control-otp-actions">
              <button type="button" className="secondary-action" onClick={() => setServiceControlChallenge(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={serviceControlCode.length < 6 || Boolean(serviceControlBusy)}
                onClick={() => void executeServiceControl()}
              >
                <FaShieldAlt /> {serviceControlBusy?.startsWith('execute') ? 'Verifying...' : `Verify ${serviceControlChallenge.operation.toUpperCase()}`}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {rolloverChallenge ? (
        <div className="nexus-modal-backdrop service-control-otp-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-rollover-control-title">
          <section className="nexus-modal nexus-service-control-modal nexus-shell">
            <button
              type="button"
              className="nexus-modal-close"
              onClick={() => {
                setRolloverChallenge(null);
                setRolloverOtpCode('');
              }}
              aria-label="Close rollover verification"
            >
              <FaTimesCircle />
            </button>
            <div className="service-control-otp-hero">
              <div className="ai-brief-orb" aria-hidden="true">
                <span />
                <span />
                <FaKey />
              </div>
              <div className='my-div'>
                <span className="panel-kicker">Nexus Rollover Verification</span>
                <h2 id="nexus-rollover-control-title">ROLLOVER {rolloverChallenge.environment_name}</h2>
                <p>
                  Nexus sent a one-time verification code to {rolloverChallenge.email}. Enter it here to run the OTP-approved Oracle configuration rollover.
                </p>
              </div>
            </div>
            <div className="service-control-otp-grid">
              <div>
                <label>
                  <span>One-time code</span>
                  <input
                    value={rolloverOtpCode}
                    onChange={(event) => setRolloverOtpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    inputMode="numeric"
                    autoFocus
                  />
                </label>
                <small>Expires {formatRelativeMinutes(rolloverChallenge.expires_at)}. Codes are single-use and bound to this environment.</small>
              </div>
              <div className="service-control-otp-summary">
                <span>Environment</span>
                <strong>{rolloverChallenge.environment_id}</strong>
                <span>Action</span>
                <strong>ROLLOVER</strong>
              </div>
            </div>
            <div className="service-control-otp-actions">
              <button type="button" className="secondary-action" onClick={() => setRolloverChallenge(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary-action"
                disabled={rolloverOtpCode.length < 6 || catalogBusy === 'rollover-execute'}
                onClick={() => void executeRollover()}
              >
                <FaShieldAlt /> {catalogBusy === 'rollover-execute' ? 'Verifying...' : 'Confirm ROLLOVER'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {timelineService ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-service-timeline-title">
          <section className="nexus-modal nexus-service-timeline-modal nexus-shell">
            <button type="button" className="nexus-modal-close" onClick={() => setTimelineServiceId(null)} aria-label="Close service incident timeline">
              <FaTimesCircle />
            </button>
            <div className="panel-head timeline-hero-head">
              <div>
                <span className="panel-kicker">Service Incident Timeline</span>
                <h2 id="nexus-service-timeline-title">{timelineService.service_name}</h2>
                <p>
                  Every correlated incident Nexus has retained for this service, from active impact through operator
                  verdict. Select a case to open the full Incident Command View.
                </p>
              </div>
              <div className="summary-badges">
                <span className="soft-pill">{timelineImpactActiveCount} active impact</span>
                <span className="soft-pill">{timelineVerdictPendingCount} awaiting verdict</span>
                <span className="soft-pill">{timelineIncidents.length} total</span>
                <button type="button" className="secondary-action compact-action" onClick={() => setTimelineChatOpen(true)}>
                  <FaCommentDots /> Timeline Copilot
                </button>
              </div>
            </div>
            <div className="service-timeline-console">
              <div className="service-timeline-rail">
                {timelineIncidents.map((incident) => (
                  <button
                    key={incident.incident_id}
                    type="button"
                    className={`service-timeline-card risk-${displayRiskLevelForIncident(incident).toLowerCase()}`}
                    onClick={() => {
                      selectIncident(incident);
                    }}
                  >
                    <span className="timeline-node" aria-hidden="true" />
                    <div>
                      <div className="timeline-card-head">
                        <strong>{incident.title}</strong>
                        <span>{incidentOperationalLabel(incident)}</span>
                      </div>
                      <p>{incident.summary}</p>
                      <div className="timeline-meta">
                        <span>{formatDateTime(incident.start_time)}</span>
                        <span>{incident.end_time ? `Ended ${formatDateTime(incident.end_time)}` : 'Still active'}</span>
                        <span>{incidentDurationLabel(incident)}</span>
                        <span>{displayRiskLevelForIncident(incident)}</span>
                        <span>{incident.failure_domain}</span>
                      </div>
                    </div>
                  </button>
                ))}
                {!timelineIncidents.length ? (
                  <div className="empty-state">No retained incident timeline exists for this service yet.</div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {timelineService && timelineChatOpen ? (
        <div className="nexus-modal-backdrop nexus-copilot-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-timeline-copilot-title">
          <section className="nexus-modal nexus-timeline-copilot-modal nexus-shell">
            <button type="button" className="nexus-modal-close" onClick={() => setTimelineChatOpen(false)} aria-label="Close timeline copilot">
              <FaTimesCircle />
            </button>
            <div className="timeline-copilot-hero">
              <div className="ai-brief-orb" aria-hidden="true">
                <span />
                <span />
                <FaCommentDots />
              </div>
              <div className='fine-div'>
                <span className="panel-kicker">Timeline Copilot</span>
                <h2 id="nexus-timeline-copilot-title">Ask {timelineService.service_name} history</h2>
                <p>
                  Nexus reasons from the {timelineService.service_name} timeline, graph context, evidence, and chat memory.
                </p>
              </div>
              <div className="timeline-copilot-presence">
                <span className='ready-or-not'>{timelineInferenceActive ? 'Live inference' : 'Ready'}</span>
                <strong>{timelineChatTurns.length} turns</strong>
              </div>
            </div>
            {timelineInferenceActive ? (
              <div className="timeline-inference-pipeline" aria-live="polite">
                {timelineInferenceSteps.map((step, index) => {
                  const completed = timelineInferenceIndex >= 0 && index < timelineInferenceIndex;
                  const active = step.id === timelineInferencePhase;
                  return (
                    <div
                      key={step.id}
                      className={`timeline-inference-step${active ? ' active' : ''}${completed ? ' complete' : ''}`}
                    >
                      <span className="timeline-inference-node" />
                      <div>
                        <strong>{step.label}</strong>
                        <small>{step.detail}</small>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <div className="timeline-chat-suggestion-panel">
              <div>
                <span className="panel-kicker">Quick Intelligence Paths</span>
              </div>
              <div className="timeline-chat-suggestions">
                {timelineChatSuggestions.map((suggestion, index) => (
                  <button key={suggestion} type="button" onClick={() => void askServiceTimeline(suggestion)} disabled={timelineChatBusy}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{suggestion}</strong>
                  </button>
                ))}
              </div>
            </div>
            <div className="timeline-chat-history">
              {!timelineChatTurns.length ? (
                <div className="empty-state compact">
                  Start with a natural question. Nexus remembers this conversation and keeps each answer grounded in this
                  service timeline.
                </div>
              ) : null}
              {timelineChatTurns.map((turn) => (
                <div key={turn.id} className="timeline-chat-turn">
                  <div className="timeline-chat-question">
                    <span>Operator</span>
                    <strong>{turn.question}</strong>
                  </div>
                  <div className="timeline-chat-answer">
                    <div className="copilot-answer-head">
                      <span>{turn.response.llm_used ? 'Nexus AI' : 'Nexus Grounded'}</span>
                      <strong>{scorePercent(turn.response.confidence)}</strong>
                    </div>
                    <div className="timeline-chat-answer-prose">
                      {splitAiNarrative(turn.response.answer).map((paragraph, index) => (
                        <p key={`${turn.id}-answer-${index}`}>{paragraph}</p>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {timelineChatBusy && timelinePendingQuestion ? (
                <div className="timeline-chat-turn timeline-chat-turn-live">
                  <div className="timeline-chat-question">
                    <span>Operator</span>
                    <strong>{timelinePendingQuestion}</strong>
                  </div>
                  <div className="timeline-chat-answer live">
                    <div className="copilot-answer-head">
                      <span>Nexus AI</span>
                      <strong>{timelineInferenceSteps.find((step) => step.id === timelineInferencePhase)?.label || 'Preparing'}</strong>
                    </div>
                    <div className="timeline-live-message">
                      <span className="timeline-live-orb" />
                      <p>
                        Nexus is grounding the question against {timelineService.service_name}, retained incidents, recovery state,
                        evidence, and chat memory before it answers.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {timelineChatError ? <div className="nexus-banner error">{timelineChatError}</div> : null}
            <div className="timeline-chat-composer">
              <textarea
                value={timelineChatQuestion}
                onChange={(event) => setTimelineChatQuestion(event.target.value)}
                placeholder="Ask: current state, last incident duration, what happened between 08:00 and 12:00, or what changed before recovery..."
              />
              <button type="button" className="primary-action" onClick={() => void askServiceTimeline()} disabled={timelineChatBusy || !timelineChatQuestion.trim()}>
                <FaCommentDots /> {timelineChatBusy ? 'Grounding...' : 'Ask Timeline'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  const renderClustersWorkspace = () => (
    <div className="management-layout management-card-workspace">
      <aside className="management-list-panel nexus-panel nexus-shell">
        <div className="panel-head">
          <div>
            <h2>Dependency Clusters</h2>
            <p>Business-aligned clusters with collector, extractor, formatter, and guarded orchestration URLs.</p>
          </div>
          {canManageNexus ? (
            <button type="button" className="secondary-action" onClick={startNewCluster}>
              <FaPlus /> New
            </button>
          ) : (
            <span className="readonly-pill">Operator view</span>
          )}
        </div>
        <div className="management-list">
          {filteredClusters.map((cluster) => (
            <button
              key={cluster.cluster_id}
              type="button"
              className={`management-card ${selectedClusterId === cluster.cluster_id ? 'selected' : ''}`}
              onClick={() => {
                setCreatingCluster(false);
                setSelectedClusterId(cluster.cluster_id);
              }}
            >
              <div className="management-card-head">
                <strong>{cluster.cluster_name}</strong>
                <span className="soft-pill">{cluster.service_ids.length} services</span>
              </div>
              <p>{cluster.cluster_id} | {cluster.environment}</p>
              <div className="management-card-meta">
                <span>{cluster.owner_team}</span>
                <span>{cluster.criticality}</span>
                <span>{cluster.entry_services.length} entries</span>
              </div>
            </button>
          ))}
          {!filteredClusters.length ? <div className="empty-state">No clusters match the current view.</div> : null}
        </div>
      </aside>

      {selectedClusterId || creatingCluster ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-cluster-modal-title">
          <section
            className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal ${canManageNexus ? '' : 'readonly'}`}
            onChangeCapture={createEditorChangeGuard('cluster')}
            onClickCapture={createEditorClickGuard('cluster')}
          >
            <button type="button" className="nexus-modal-close" onClick={closeClusterModal} aria-label="Close cluster detail">
              <FaTimesCircle />
            </button>
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Cluster Fabric</span>
                <h2 id="nexus-cluster-modal-title">{selectedClusterId ? clusterDraft.cluster_name || clusterDraft.cluster_id : 'New dependency cluster'}</h2>
                <p>Group services into operational clusters and centralize routing URLs for extraction, formatting, shipping, diagnostics, and restart.</p>
              </div>
              <div className="management-actions">
                {editorDirty.cluster ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                {canManageNexus ? (
                  <>
                    <button type="button" className="primary-action" onClick={() => void saveCluster()} disabled={catalogBusy === 'cluster-save'}>
                      <FaCheckCircle /> {catalogBusy === 'cluster-save' ? 'Saving...' : 'Save Cluster'}
                    </button>
                    <button type="button" className="secondary-action danger" onClick={() => void deleteCluster()} disabled={!selectedClusterId || catalogBusy === 'cluster-delete'}>
                      <FaTrashAlt /> {catalogBusy === 'cluster-delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <span className="readonly-pill">Admin required to modify</span>
                )}
              </div>
            </div>

            <div className="editor-scroll">
              <div className="form-grid">
                <section className="form-section">
                  <h3>Cluster Identity</h3>
                  <div className="field-grid">
                    <label>
                      <span>Cluster ID</span>
                      <input value={clusterDraft.cluster_id} onChange={(event) => setClusterDraft((current) => ({ ...current, cluster_id: event.target.value }))} />
                    </label>
                    <label>
                      <span>Cluster Name</span>
                      <input value={clusterDraft.cluster_name} onChange={(event) => setClusterDraft((current) => ({ ...current, cluster_name: event.target.value }))} />
                    </label>
                    <label>
                      <span>Environment</span>
                      <input value={clusterDraft.environment} onChange={(event) => setClusterDraft((current) => ({ ...current, environment: event.target.value }))} />
                    </label>
                    <label>
                      <span>Owner Team</span>
                      <input value={clusterDraft.owner_team} onChange={(event) => setClusterDraft((current) => ({ ...current, owner_team: event.target.value }))} />
                    </label>
                    <label>
                      <span>Criticality</span>
                      <select value={clusterDraft.criticality} onChange={(event) => setClusterDraft((current) => ({ ...current, criticality: event.target.value }))}>
                        {criticalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Tags</span>
                      <input value={clusterDraft.tags.join(', ')} onChange={(event) => setClusterDraft((current) => ({ ...current, tags: parseListInput(event.target.value) }))} />
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Description</span>
                    <textarea value={clusterDraft.description || ''} onChange={(event) => setClusterDraft((current) => ({ ...current, description: event.target.value }))} />
                  </label>
                </section>

                <section className="form-section">
                  <h3>Membership</h3>
                  <label className="field-span">
                    <span>Services in Cluster</span>
                    <div className="selection-chip-grid">
                      {services.map((service) => {
                        const active = clusterDraft.service_ids.includes(service.service_id);
                        return (
                          <button
                            key={service.service_id}
                            type="button"
                            className={`selection-chip ${active ? 'active' : ''}`}
                            onClick={() =>
                              setClusterDraft((current) => ({
                                ...current,
                                service_ids: active
                                  ? current.service_ids.filter((item) => item !== service.service_id)
                                  : [...current.service_ids, service.service_id].sort(),
                                entry_services: active
                                  ? current.entry_services.filter((item) => item !== service.service_id)
                                  : current.entry_services,
                              }))
                            }
                          >
                            {service.service_id}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                  <label className="field-span">
                    <span>Entry Services</span>
                    <div className="selection-chip-grid">
                      {clusterDraft.service_ids.map((serviceId) => {
                        const active = clusterDraft.entry_services.includes(serviceId);
                        return (
                          <button
                            key={serviceId}
                            type="button"
                            className={`selection-chip ${active ? 'active' : ''}`}
                            onClick={() =>
                              setClusterDraft((current) => ({
                                ...current,
                                entry_services: active
                                  ? current.entry_services.filter((item) => item !== serviceId)
                                  : [...current.entry_services, serviceId].sort(),
                              }))
                            }
                          >
                            {serviceId}
                          </button>
                        );
                      })}
                      {!clusterDraft.service_ids.length ? <span className="context-empty">Pick cluster members first.</span> : null}
                    </div>
                  </label>
                </section>
              </div>

              <section className="form-section">
                <h3>Cluster Routing URLs</h3>
                <div className="field-grid">
                  {([
                    ['topology_doc_url', 'Topology Doc URL'],
                    ['dashboard_url', 'Cluster Dashboard'],
                    ['collector_url', 'Collector URL'],
                    ['extraction_url', 'Extraction URL'],
                    ['formatting_url', 'Formatting URL'],
                    ['shipping_url', 'Shipping URL'],
                    ['diagnostics_url', 'Diagnostics URL'],
                    ['restart_url', 'Restart URL'],
                    ['query_url', 'Query URL'],
                    ['notes_url', 'Notes URL'],
                  ] as Array<[keyof ClusterRoutingConfig, string]>).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <input
                        value={(clusterDraft.routing_config[field] as string) || ''}
                        onChange={(event) =>
                          setClusterDraft((current) => ({
                            ...current,
                            routing_config: { ...current.routing_config, [field]: event.target.value },
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="field-span">
                  <span>Metadata (JSON)</span>
                  <textarea value={clusterMetadataText} onChange={(event) => setClusterMetadataText(event.target.value)} />
                </label>
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  const renderBusinessFlowsWorkspace = () => {
    const updateStep = (index: number, patch: Partial<BusinessFlowStep>) => {
      setFlowDraft((current) => ({
        ...current,
        steps: current.steps.map((step, itemIndex) => (itemIndex === index ? { ...step, ...patch } : step)),
      }));
    };

    const addStep = () => {
      const fallbackService = services[0]?.service_id || '';
      setFlowDraft((current) => ({
        ...current,
        steps: [
          ...current.steps,
          {
            step_id: '',
            step_order: current.steps.length + 1,
            service_id: fallbackService,
            service_role: 'dependency',
            required: true,
            expected_signal_sources: ['agent', 'loki'],
            failure_domains: ['service_runtime'],
            metadata: {},
          },
        ],
      }));
    };

    const removeStep = (index: number) => {
      setFlowDraft((current) => ({
        ...current,
        steps: current.steps.filter((_, itemIndex) => itemIndex !== index),
      }));
    };

    return (
      <div className="management-layout management-card-workspace">
        <aside className="management-list-panel nexus-panel nexus-shell">
          <div className="panel-head">
            <div>
              <h2>Business Flows</h2>
              <p>Scope dependencies to real operational journeys like IDC access, IDC transactions, and Postilion card authorization.</p>
            </div>
            {canManageNexus ? (
              <button type="button" className="secondary-action" onClick={startNewFlow}>
                <FaPlus /> New
              </button>
            ) : (
              <span className="readonly-pill">Operator view</span>
            )}
          </div>
          <div className="management-list">
            {filteredBusinessFlows.map((flow) => (
              <button
                key={flow.flow_id}
                type="button"
                className={`management-card ${selectedFlowId === flow.flow_id ? 'selected' : ''}`}
                onClick={() => {
                  setCreatingFlow(false);
                  setSelectedFlowId(flow.flow_id);
                }}
              >
                <div className="management-card-head">
                  <strong>{flow.flow_name}</strong>
                  <span className="soft-pill">{flow.steps.length} steps</span>
                </div>
                <p>{flow.flow_id} | {flow.environment}</p>
                <div className="management-card-meta">
                  <span>{flow.owner_team}</span>
                  <span>{flow.criticality}</span>
                  <span>{flow.enabled ? 'enabled' : 'disabled'}</span>
                </div>
              </button>
            ))}
            {!filteredBusinessFlows.length ? <div className="empty-state">No business flows match the current view.</div> : null}
          </div>
        </aside>

        {selectedFlowId || creatingFlow ? (
          <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-flow-modal-title">
            <section
              className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal ${canManageNexus ? '' : 'readonly'}`}
              onChangeCapture={createEditorChangeGuard('flow')}
              onClickCapture={createEditorClickGuard('flow')}
            >
              <button type="button" className="nexus-modal-close" onClick={closeFlowModal} aria-label="Close business flow detail">
                <FaTimesCircle />
              </button>
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Flow-Aware Correlation</span>
                  <h2 id="nexus-flow-modal-title">{selectedFlowId ? flowDraft.flow_name || flowDraft.flow_id : 'New business flow'}</h2>
                  <p>Teach Nexus when a dependency is valid, what evidence to expect, and which failure domain it belongs to.</p>
                </div>
                <div className="management-actions">
                  {editorDirty.flow ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                  {canManageNexus ? (
                    <>
                      <button type="button" className="primary-action" onClick={() => void saveBusinessFlow()} disabled={catalogBusy === 'flow-save'}>
                        <FaCheckCircle /> {catalogBusy === 'flow-save' ? 'Saving...' : 'Save Flow'}
                      </button>
                      <button type="button" className="secondary-action danger" onClick={() => void deleteBusinessFlow()} disabled={!selectedFlowId || catalogBusy === 'flow-delete'}>
                        <FaTrashAlt /> {catalogBusy === 'flow-delete' ? 'Deleting...' : 'Delete'}
                      </button>
                    </>
                  ) : (
                    <span className="readonly-pill">Admin required to modify</span>
                  )}
                </div>
              </div>

              <div className="editor-scroll">
                <div className="form-grid">
                  <section className="form-section">
                    <h3>Flow Identity</h3>
                    <div className="field-grid">
                      <label>
                        <span>Flow ID</span>
                        <input value={flowDraft.flow_id} onChange={(event) => setFlowDraft((current) => ({ ...current, flow_id: event.target.value }))} />
                      </label>
                      <label>
                        <span>Flow Name</span>
                        <input value={flowDraft.flow_name} onChange={(event) => setFlowDraft((current) => ({ ...current, flow_name: event.target.value }))} />
                      </label>
                      <label>
                        <span>Environment</span>
                        <input value={flowDraft.environment} onChange={(event) => setFlowDraft((current) => ({ ...current, environment: event.target.value }))} />
                      </label>
                      <label>
                        <span>Owner Team</span>
                        <input value={flowDraft.owner_team} onChange={(event) => setFlowDraft((current) => ({ ...current, owner_team: event.target.value }))} />
                      </label>
                      <label>
                        <span>Criticality</span>
                        <select value={flowDraft.criticality} onChange={(event) => setFlowDraft((current) => ({ ...current, criticality: event.target.value }))}>
                          {criticalityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                      </label>
                      <label>
                        <span>Correlation Window</span>
                        <input
                          type="number"
                          min={1}
                          value={flowDraft.correlation_window_minutes}
                          onChange={(event) => setFlowDraft((current) => ({ ...current, correlation_window_minutes: Number(event.target.value) || 10 }))}
                        />
                      </label>
                    </div>
                    <label className="field-span">
                      <span>Description</span>
                      <textarea value={flowDraft.description || ''} onChange={(event) => setFlowDraft((current) => ({ ...current, description: event.target.value }))} />
                    </label>
                  </section>

                  <section className="form-section">
                    <h3>Entry Services</h3>
                    <div className="selection-chip-grid">
                      {services.map((service) => {
                        const active = flowDraft.entry_service_ids.includes(service.service_id);
                        return (
                          <button
                            key={service.service_id}
                            type="button"
                            className={`selection-chip ${active ? 'active' : ''}`}
                            onClick={() =>
                              setFlowDraft((current) => ({
                                ...current,
                                entry_service_ids: active
                                  ? current.entry_service_ids.filter((item) => item !== service.service_id)
                                  : [...current.entry_service_ids, service.service_id].sort(),
                              }))
                            }
                          >
                            {service.service_id}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="form-section field-span">
                    <div className="panel-head compact">
                      <h3>Flow Steps</h3>
                      <button type="button" className="secondary-action" data-draft-change="true" onClick={addStep}>
                        <FaPlus /> Add Step
                      </button>
                    </div>
                    <div className="route-matrix">
                      {flowDraft.steps.map((step, index) => (
                        <div key={`${step.service_id}-${index}`} className="route-card">
                          <div className="field-grid">
                            <label>
                              <span>Order</span>
                              <input type="number" min={1} value={step.step_order} onChange={(event) => updateStep(index, { step_order: Number(event.target.value) || index + 1 })} />
                            </label>
                            <label>
                              <span>Service</span>
                              <select value={step.service_id} onChange={(event) => updateStep(index, { service_id: event.target.value })}>
                                {services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_name}</option>)}
                              </select>
                            </label>
                            <label>
                              <span>Role</span>
                              <input value={step.service_role} onChange={(event) => updateStep(index, { service_role: event.target.value })} />
                            </label>
                            <label>
                              <span>Required</span>
                              <select value={String(step.required)} onChange={(event) => updateStep(index, { required: event.target.value === 'true' })}>
                                <option value="true">Required</option>
                                <option value="false">Optional</option>
                              </select>
                            </label>
                          </div>
                          <label className="field-span">
                            <span>Expected Signal Sources</span>
                            <input value={step.expected_signal_sources.join(', ')} onChange={(event) => updateStep(index, { expected_signal_sources: parseListInput(event.target.value) })} />
                          </label>
                          <label className="field-span">
                            <span>Failure Domains</span>
                            <input value={step.failure_domains.join(', ')} onChange={(event) => updateStep(index, { failure_domains: parseListInput(event.target.value) })} />
                          </label>
                          <button type="button" className="secondary-action danger" data-draft-change="true" onClick={() => removeStep(index)}>
                            <FaTrashAlt /> Remove Step
                          </button>
                        </div>
                      ))}
                      {!flowDraft.steps.length ? <div className="empty-state">Add at least one step to make this flow usable for correlation.</div> : null}
                    </div>
                  </section>

                  <section className="form-section">
                    <h3>Signals and Metadata</h3>
                    <label className="field-span">
                      <span>Success Indicators</span>
                      <input value={flowDraft.success_indicators.join(', ')} onChange={(event) => setFlowDraft((current) => ({ ...current, success_indicators: parseListInput(event.target.value) }))} />
                    </label>
                    <label className="field-span">
                      <span>Failure Indicators</span>
                      <input value={flowDraft.failure_indicators.join(', ')} onChange={(event) => setFlowDraft((current) => ({ ...current, failure_indicators: parseListInput(event.target.value) }))} />
                    </label>
                    <label className="field-span">
                      <span>Tags</span>
                      <input value={flowDraft.tags.join(', ')} onChange={(event) => setFlowDraft((current) => ({ ...current, tags: parseListInput(event.target.value) }))} />
                    </label>
                    <label className="field-span">
                      <span>Metadata JSON</span>
                      <textarea value={flowMetadataText} onChange={(event) => setFlowMetadataText(event.target.value)} />
                    </label>
                  </section>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  };

  const renderDependenciesWorkspace = () => (
    <div className="management-layout management-card-workspace">
      <aside className="management-list-panel nexus-panel nexus-shell">
        <div className="panel-head">
          <div>
            <h2>Dependency Edges</h2>
            <p>Directional typed edges that give Nexus its correlation and blast-radius reasoning.</p>
          </div>
          {canManageNexus ? (
            <button type="button" className="secondary-action" onClick={startNewDependency}>
              <FaPlus /> New
            </button>
          ) : (
            <span className="readonly-pill">Operator view</span>
          )}
        </div>
        <div className="management-list">
          {filteredDependencies.map((edge) => (
            <button
              key={edge.edge_id || `${edge.from_service_id}-${edge.to_service_id}-${edge.dependency_type}`}
              type="button"
              className={`management-card ${selectedEdgeId === (edge.edge_id || '') ? 'selected' : ''}`}
              onClick={() => {
                setCreatingEdge(false);
                setSelectedEdgeId(edge.edge_id || '');
              }}
            >
              <div className="management-card-head">
                <strong>{edge.from_service_id} -&gt; {edge.to_service_id}</strong>
                <span className="soft-pill">{edge.dependency_type}</span>
              </div>
              <p>{edge.cluster_id || 'global'} | {edge.dependency_scope || 'global'} | weight {edge.criticality_weight}</p>
              <div className="management-card-meta">
                <span>{edge.is_hard_dependency ? 'hard' : 'soft'}</span>
                <span>{edge.timeout_budget_ms || 'n/a'} ms</span>
                <span>{edge.business_flow_ids?.length || 0} flows</span>
              </div>
            </button>
          ))}
          {!filteredDependencies.length ? <div className="empty-state">No dependency edges match the current view.</div> : null}
        </div>
      </aside>

      {selectedEdgeId || creatingEdge ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-dependency-modal-title">
          <section
            className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal ${canManageNexus ? '' : 'readonly'}`}
            onChangeCapture={createEditorChangeGuard('edge')}
            onClickCapture={createEditorClickGuard('edge')}
          >
            <button type="button" className="nexus-modal-close" onClick={closeDependencyModal} aria-label="Close dependency detail">
              <FaTimesCircle />
            </button>
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Dependency Contract</span>
                <h2 id="nexus-dependency-modal-title">{selectedEdgeId ? `${edgeDraft.from_service_id} -> ${edgeDraft.to_service_id}` : 'New dependency edge'}</h2>
                <p>Declare typed directional edges for each cluster so Nexus can explain failures instead of just grouping alerts.</p>
              </div>
              <div className="management-actions">
                {editorDirty.edge ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                {canManageNexus ? (
                  <>
                    <button type="button" className="primary-action" onClick={() => void saveDependency()} disabled={catalogBusy === 'dependency-save'}>
                      <FaCheckCircle /> {catalogBusy === 'dependency-save' ? 'Saving...' : 'Save Edge'}
                    </button>
                    <button type="button" className="secondary-action danger" onClick={() => void deleteDependency()} disabled={!selectedEdgeId || catalogBusy === 'dependency-delete'}>
                      <FaTrashAlt /> {catalogBusy === 'dependency-delete' ? 'Deleting...' : 'Delete'}
                    </button>
                  </>
                ) : (
                  <span className="readonly-pill">Admin required to modify</span>
                )}
              </div>
            </div>

            <div className="editor-scroll">
              <div className="form-grid">
                <section className="form-section">
                  <h3>Endpoints</h3>
                  <div className="field-grid">
                    <label>
                      <span>Edge ID</span>
                      <input value={edgeDraft.edge_id || ''} onChange={(event) => setEdgeDraft((current) => ({ ...current, edge_id: event.target.value }))} placeholder="Leave blank to auto-generate" />
                    </label>
                    <label>
                      <span>Cluster</span>
                      <select value={edgeDraft.cluster_id || ''} onChange={(event) => setEdgeDraft((current) => ({ ...current, cluster_id: event.target.value }))}>
                        <option value="">Global</option>
                        {clusters.map((cluster) => <option key={cluster.cluster_id} value={cluster.cluster_id}>{cluster.cluster_name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>From Service</span>
                      <select value={edgeDraft.from_service_id} onChange={(event) => setEdgeDraft((current) => ({ ...current, from_service_id: event.target.value }))}>
                        <option value="">Select source</option>
                        {services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_id}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>To Service</span>
                      <select value={edgeDraft.to_service_id} onChange={(event) => setEdgeDraft((current) => ({ ...current, to_service_id: event.target.value }))}>
                        <option value="">Select dependency</option>
                        {services.map((service) => <option key={service.service_id} value={service.service_id}>{service.service_id}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Dependency Type</span>
                      <select value={edgeDraft.dependency_type} onChange={(event) => setEdgeDraft((current) => ({ ...current, dependency_type: event.target.value }))}>
                        {dependencyTypeOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Purpose</span>
                      <input value={edgeDraft.dependency_purpose || ''} onChange={(event) => setEdgeDraft((current) => ({ ...current, dependency_purpose: event.target.value }))} placeholder="authentication_access, transaction_processing..." />
                    </label>
                    <label>
                      <span>Scope</span>
                      <select value={edgeDraft.dependency_scope || 'global'} onChange={(event) => setEdgeDraft((current) => ({ ...current, dependency_scope: event.target.value }))}>
                        <option value="global">Global</option>
                        <option value="flow_scoped">Flow scoped</option>
                        <option value="observed">Observed</option>
                        <option value="operator_validated">Operator validated</option>
                      </select>
                    </label>
                    <label>
                      <span>Criticality Weight</span>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={edgeDraft.criticality_weight}
                        onChange={(event) => setEdgeDraft((current) => ({ ...current, criticality_weight: Number(event.target.value || 0) }))}
                      />
                    </label>
                    <label>
                      <span>Timeout Budget (ms)</span>
                      <input
                        type="number"
                        min="0"
                        value={edgeDraft.timeout_budget_ms || 0}
                        onChange={(event) => setEdgeDraft((current) => ({ ...current, timeout_budget_ms: Number(event.target.value || 0) }))}
                      />
                    </label>
                    <label className="checkbox-field inline-checkbox">
                      <input
                        type="checkbox"
                        checked={edgeDraft.is_hard_dependency}
                        onChange={(event) => setEdgeDraft((current) => ({ ...current, is_hard_dependency: event.target.checked }))}
                      />
                      <span>Hard dependency</span>
                    </label>
                  </div>
                </section>

                <section className="form-section">
                  <h3>Flow Scope</h3>
                  <label className="field-span">
                    <span>Business Flows</span>
                    <div className="selection-chip-grid">
                      {businessFlows.map((flow) => {
                        const active = (edgeDraft.business_flow_ids || []).includes(flow.flow_id);
                        return (
                          <button
                            key={flow.flow_id}
                            type="button"
                            className={`selection-chip ${active ? 'active' : ''}`}
                            onClick={() =>
                              setEdgeDraft((current) => ({
                                ...current,
                                business_flow_ids: active
                                  ? (current.business_flow_ids || []).filter((item) => item !== flow.flow_id)
                                  : [...(current.business_flow_ids || []), flow.flow_id].sort(),
                              }))
                            }
                          >
                            {flow.flow_name}
                          </button>
                        );
                      })}
                    </div>
                  </label>
                  <label className="field-span">
                    <span>Valid Failure Domains</span>
                    <input value={(edgeDraft.valid_failure_domains || []).join(', ')} onChange={(event) => setEdgeDraft((current) => ({ ...current, valid_failure_domains: parseListInput(event.target.value) }))} />
                  </label>
                  <label className="field-span">
                    <span>Expected Evidence</span>
                    <input value={(edgeDraft.expected_evidence || []).join(', ')} onChange={(event) => setEdgeDraft((current) => ({ ...current, expected_evidence: parseListInput(event.target.value) }))} />
                  </label>
                </section>

                <section className="form-section">
                  <h3>Database Access</h3>
                  <p className="form-helper">Use this for app-to-database edges. It tells Nexus which schema, pool, access mode, timeout, and DB error patterns prove the database is part of the failure path.</p>
                  <div className="field-grid">
                    <label>
                      <span>Access Mode</span>
                      <select
                        value={edgeDraft.database_access?.access_mode || ''}
                        onChange={(event) =>
                          setEdgeDraft((current) => ({
                            ...current,
                            database_access: {
                              ...createEmptyDatabaseAccess(),
                              ...(current.database_access || {}),
                              access_mode: event.target.value,
                            },
                          }))
                        }
                      >
                        {databaseAccessModeOptions.map((item) => <option key={item || 'blank'} value={item}>{item || 'Select access mode'}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Connection Pool</span>
                      <input
                        value={edgeDraft.database_access?.connection_pool || ''}
                        onChange={(event) =>
                          setEdgeDraft((current) => ({
                            ...current,
                            database_access: {
                              ...createEmptyDatabaseAccess(),
                              ...(current.database_access || {}),
                              connection_pool: event.target.value,
                            },
                          }))
                        }
                        placeholder="IDC_DS, HikariPool-1, UCP..."
                      />
                    </label>
                    <label>
                      <span>Max Connections</span>
                      <input
                        type="number"
                        value={edgeDraft.database_access?.max_connections || ''}
                        onChange={(event) =>
                          setEdgeDraft((current) => ({
                            ...current,
                            database_access: {
                              ...createEmptyDatabaseAccess(),
                              ...(current.database_access || {}),
                              max_connections: event.target.value ? Number(event.target.value) : null,
                            },
                          }))
                        }
                      />
                    </label>
                    <label>
                      <span>Statement Timeout (ms)</span>
                      <input
                        type="number"
                        value={edgeDraft.database_access?.statement_timeout_ms || ''}
                        onChange={(event) =>
                          setEdgeDraft((current) => ({
                            ...current,
                            database_access: {
                              ...createEmptyDatabaseAccess(),
                              ...(current.database_access || {}),
                              statement_timeout_ms: event.target.value ? Number(event.target.value) : null,
                            },
                          }))
                        }
                      />
                    </label>
                    <label className="checkbox-field inline-checkbox">
                      <input
                        type="checkbox"
                        checked={edgeDraft.database_access?.transactional ?? true}
                        onChange={(event) =>
                          setEdgeDraft((current) => ({
                            ...current,
                            database_access: {
                              ...createEmptyDatabaseAccess(),
                              ...(current.database_access || {}),
                              transactional: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span>Transactional path</span>
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Schema Names</span>
                    <input
                      value={(edgeDraft.database_access?.schema_names || []).join(', ')}
                      onChange={(event) =>
                        setEdgeDraft((current) => ({
                          ...current,
                          database_access: {
                            ...createEmptyDatabaseAccess(),
                            ...(current.database_access || {}),
                            schema_names: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="IDC_OWNER, LMS_OWNER, public..."
                    />
                  </label>
                  <label className="field-span">
                    <span>Operation Types</span>
                    <input
                      value={(edgeDraft.database_access?.operation_types || []).join(', ')}
                      onChange={(event) =>
                        setEdgeDraft((current) => ({
                          ...current,
                          database_access: {
                            ...createEmptyDatabaseAccess(),
                            ...(current.database_access || {}),
                            operation_types: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="connect, read, write, auth_lookup, transaction_post..."
                    />
                  </label>
                  <label className="field-span">
                    <span>Expected DB Error Codes</span>
                    <input
                      value={(edgeDraft.database_access?.expected_error_codes || []).join(', ')}
                      onChange={(event) =>
                        setEdgeDraft((current) => ({
                          ...current,
                          database_access: {
                            ...createEmptyDatabaseAccess(),
                            ...(current.database_access || {}),
                            expected_error_codes: parseListInput(event.target.value),
                          },
                        }))
                      }
                      placeholder="SQLSTATE, 57P01, ORA-00060, ORA-12514, TNS-12541..."
                    />
                  </label>
                  <label className="field-span">
                    <span>Query Fingerprint Scope</span>
                    <input
                      value={edgeDraft.database_access?.query_fingerprint_scope || ''}
                      onChange={(event) =>
                        setEdgeDraft((current) => ({
                          ...current,
                          database_access: {
                            ...createEmptyDatabaseAccess(),
                            ...(current.database_access || {}),
                            query_fingerprint_scope: event.target.value,
                          },
                        }))
                      }
                      placeholder="login queries, transaction posting, reporting reads..."
                    />
                  </label>
                </section>

                <section className="form-section">
                  <h3>Edge Metadata</h3>
                  <label className="field-span">
                    <span>Metadata (JSON)</span>
                    <textarea value={edgeMetadataText} onChange={(event) => setEdgeMetadataText(event.target.value)} />
                  </label>
                  <div className="context-stack compact">
                    <div className="context-section">
                      <label>Why this edge matters</label>
                      <div className="context-pill-row">
                        <span className="soft-pill">Correlation</span>
                        <span className="soft-pill">Blast radius</span>
                        <span className="soft-pill">Restart guardrails</span>
                        <span className="soft-pill">Root-cause ranking</span>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  const renderSopsWorkspace = () => (
    <div className="nexus-stack management-card-workspace sop-governance-workspace">
      <section className="nexus-panel nexus-shell sop-command-panel">
        <div className="panel-head">
          <div>
            <span className="panel-kicker"><FaBook />SOP Governance</span>
            <h2>Procedure Intelligence Registry</h2>
            <p>
              Author managed SOPs, inspect the indexed Copilot corpus, and reconcile procedure sources before operators
              depend on them for incident decisions.
            </p>
          </div>
          {canManageNexus ? (
            <button type="button" className="secondary-action" onClick={startNewSop}>
              <FaPlus /> New
            </button>
          ) : (
            <span className="readonly-pill">Operator view</span>
          )}
        </div>

        <div className="sop-control-strip">
          <div>
            <strong>{managedSops.filter((sop) => sop.status === 'approved').length}</strong>
            <span>Approved managed</span>
          </div>
          <div>
            <strong>{indexedSops.length}</strong>
            <span>Indexed corpus</span>
          </div>
          <div>
            <strong>{sopCorpusSummary.chunks}</strong>
            <span>Retrieval chunks</span>
          </div>
          <div>
            <strong>{filteredIndexedSops.filter((sop) => !managedSopIds.has(sop.sop_id)).length}</strong>
            <span>Needs adoption</span>
          </div>
        </div>

        <div className="sop-planes-grid">
          <section className="sop-plane">
            <div className="panel-head compact">
              <div>
                <h3>Managed Registry</h3>
                <p>Database-owned SOPs that can be edited, validated, approved, deprecated, and re-indexed by Nexus.</p>
              </div>
              <span className="soft-pill">{filteredManagedSops.length} shown</span>
            </div>
            <div className="management-list sop-card-list">
              {filteredManagedSops.map((sop) => (
                <button
                  key={sop.sop_id}
                  type="button"
                  className={`management-card sop-card ${selectedSopId === sop.sop_id ? 'selected' : ''} sop-status-${sop.status}`}
                  onClick={() => {
                    setCreatingSop(false);
                    setSelectedSopId(sop.sop_id);
                  }}
                >
                  <div className="sop-card-visual" aria-hidden="true">
                    <span className="sop-beam" />
                    <span className="sop-core"><FaBook /></span>
                    <span className={`sop-validation-light ${sop.validation?.valid ? 'valid' : 'invalid'}`} />
                  </div>
                  <div className="management-card-head">
                    <strong>{sop.title}</strong>
                    <span className="soft-pill">{sop.status.replace(/_/g, ' ')}</span>
                  </div>
                  <p>{sop.sop_id} | class {sop.class_code} | {sop.severity}</p>
                  <div className="management-card-meta">
                    <span>{sop.owner_team || 'owner unset'}</span>
                    <span>{sop.services.length} services</span>
                    <span>{Object.values(sop.content || {}).filter((lines) => lines?.length).length} sections</span>
                    <span>{sop.validation?.valid ? 'validated' : `${sop.validation?.errors?.length || 0} errors`}</span>
                  </div>
                </button>
              ))}
              {!filteredManagedSops.length ? (
                <div className="empty-state">
                  No managed SOPs match this view. Add real procedures only when they are owned, validated, and safe for operators.
                </div>
              ) : null}
            </div>
          </section>

          <section className="sop-plane">
            <div className="panel-head compact">
              <div>
                <h3>Indexed Copilot Corpus</h3>
                <p>These are the SOPs the RAG/LLM retrieval layer can currently surface in incident Copilot answers.</p>
              </div>
              <span className="soft-pill">{filteredIndexedSops.length} shown</span>
            </div>
            <div className="management-list sop-card-list indexed-sop-list">
              {filteredIndexedSops.map((sop) => {
                const adopted = managedSopIds.has(sop.sop_id) || sop.managed;
                return (
                  <article key={sop.sop_id} className={`management-card sop-card indexed-sop-card ${adopted ? 'adopted' : ''}`}>
                    <div className="sop-card-visual" aria-hidden="true">
                      <span className="sop-beam" />
                      <span className="sop-core"><FaBook /></span>
                      <span className={`sop-validation-light ${adopted ? 'valid' : 'invalid'}`} />
                    </div>
                    <div className="management-card-head">
                      <strong>{sop.title}</strong>
                      <span className="soft-pill">{adopted ? 'managed' : 'indexed only'}</span>
                    </div>
                    <p>{sop.sop_id} | class {sop.class_code} | {sop.severity} | {sop.chunk_count} chunks</p>
                    <div className="management-card-meta">
                      <span>{sop.alignment_status.join(', ') || 'alignment unset'}</span>
                      <span>{sop.source_sections.length} sections</span>
                      <span>{sop.services.length || sop.systems.length} scoped systems</span>
                    </div>
                    <code className="sop-source-path">{sop.source_path}</code>
                    <div className="database-card-actions">
                      {canManageNexus && !adopted ? (
                        <button type="button" className="secondary-action" onClick={() => adoptIndexedSop(sop)}>
                          <FaPlus /> Adopt into registry
                        </button>
                      ) : null}
                      {adopted ? <span className="readonly-pill">Governed</span> : null}
                    </div>
                  </article>
                );
              })}
              {!filteredIndexedSops.length ? (
                <div className="empty-state">
                  No indexed SOPs match this search. If Copilot has no corpus, run the AI service knowledge ingest/reindex path.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      {selectedSopId || creatingSop ? (
        <div className="nexus-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="nexus-sop-modal-title">
          <section
            className={`management-editor nexus-panel nexus-shell nexus-modal nexus-management-modal sop-management-modal ${canManageNexus ? '' : 'readonly'}`}
            onChangeCapture={createEditorChangeGuard('sop')}
            onClickCapture={createEditorClickGuard('sop')}
          >
            <button type="button" className="nexus-modal-close" onClick={closeSopModal} aria-label="Close SOP detail">
              <FaTimesCircle />
            </button>
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Governed SOP Contract</span>
                <h2 id="nexus-sop-modal-title">{selectedSopId ? sopDraft.title || sopDraft.sop_id : 'New Nexus SOP'}</h2>
                <p>
                  SOPs in this registry are indexed into the Nexus reasoning layer. Keep them operational, scoped,
                  validated, and explicit about what an operator should verify before action.
                </p>
              </div>
              <div className="management-actions">
                {editorDirty.sop ? <span className="draft-guard-pill">Draft protected from live refresh</span> : null}
                {canManageNexus ? (
                  <>
                    <button type="button" className="primary-action" onClick={() => void saveManagedSop()} disabled={catalogBusy === 'sop-save'}>
                      <FaCheckCircle /> {catalogBusy === 'sop-save' ? 'Saving...' : 'Save SOP'}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => void validateManagedSop(false)} disabled={!sopDraft.sop_id || catalogBusy === 'sop-validate'}>
                      <FaShieldAlt /> {catalogBusy === 'sop-validate' ? 'Validating...' : 'Validate'}
                    </button>
                    <button type="button" className="secondary-action" onClick={() => void validateManagedSop(true)} disabled={!sopDraft.sop_id || catalogBusy === 'sop-approve'}>
                      <FaCheckCircle /> {catalogBusy === 'sop-approve' ? 'Approving...' : 'Validate + Approve'}
                    </button>
                    <button type="button" className="secondary-action danger" onClick={() => void deleteManagedSop()} disabled={!selectedSopId || catalogBusy === 'sop-delete'}>
                      <FaTrashAlt /> {catalogBusy === 'sop-delete' ? 'Deprecating...' : 'Deprecate'}
                    </button>
                  </>
                ) : (
                  <span className="readonly-pill">Admin required to modify</span>
                )}
              </div>
            </div>

            <div className={`sop-validation-panel ${sopDraft.validation?.valid ? 'valid' : 'invalid'}`}>
              <div>
                <strong>{sopDraft.validation?.valid ? 'Validation passed' : 'Validation required'}</strong>
                <span>
                  {sopDraft.validation?.checked_at
                    ? `Checked ${formatDateTime(sopDraft.validation.checked_at)} by ${sopDraft.validation.checked_by || 'Nexus'}`
                    : 'Run validation before approval so Copilot only retrieves safe, scoped guidance.'}
                </span>
              </div>
              <div className="sop-validation-counts">
                <span>{sopDraft.validation?.errors?.length || 0} errors</span>
                <span>{sopDraft.validation?.warnings?.length || 0} warnings</span>
              </div>
            </div>

            <div className="editor-scroll">
              <div className="form-grid">
                <section className="form-section">
                  <h3>Identity and Scope</h3>
                  <div className="field-grid">
                    <label>
                      <span>SOP ID</span>
                      <input value={sopDraft.sop_id} onChange={(event) => setSopDraft((current) => ({ ...current, sop_id: event.target.value }))} placeholder="MB-USSD-TUNNEL-CHECK" />
                    </label>
                    <label>
                      <span>Title</span>
                      <input value={sopDraft.title} onChange={(event) => setSopDraft((current) => ({ ...current, title: event.target.value }))} />
                    </label>
                    <label>
                      <span>Class</span>
                      <select value={sopDraft.class_code} onChange={(event) => setSopDraft((current) => ({ ...current, class_code: event.target.value }))}>
                        {managedSopClassOptions.map((item) => <option key={item} value={item}>Class {item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Severity</span>
                      <select value={sopDraft.severity} onChange={(event) => setSopDraft((current) => ({ ...current, severity: event.target.value }))}>
                        {managedSopSeverityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Status</span>
                      <select value={sopDraft.status} onChange={(event) => setSopDraft((current) => ({ ...current, status: event.target.value as ManagedSop['status'] }))}>
                        {managedSopStatusOptions.map((item) => <option key={item} value={item}>{item.replace(/_/g, ' ')}</option>)}
                      </select>
                    </label>
                    <label>
                      <span>Version</span>
                      <input type="number" min="1" value={sopDraft.version} onChange={(event) => setSopDraft((current) => ({ ...current, version: Number(event.target.value || 1) }))} />
                    </label>
                    <label>
                      <span>Owner Team</span>
                      <input value={sopDraft.owner_team || ''} onChange={(event) => setSopDraft((current) => ({ ...current, owner_team: event.target.value }))} />
                    </label>
                    <label>
                      <span>Environments</span>
                      <input value={sopDraft.environments.join(', ')} onChange={(event) => setSopDraft((current) => ({ ...current, environments: parseListInput(event.target.value) }))} />
                    </label>
                  </div>
                  <label className="field-span">
                    <span>Service Scope</span>
                    <input value={sopDraft.services.join(', ')} onChange={(event) => setSopDraft((current) => ({ ...current, services: parseListInput(event.target.value) }))} placeholder="txn-mobile-ussd, txn-integration-idc, idc-core" />
                  </label>
                  <label className="field-span">
                    <span>Aliases</span>
                    <input value={sopDraft.aliases.join(', ')} onChange={(event) => setSopDraft((current) => ({ ...current, aliases: parseListInput(event.target.value) }))} />
                  </label>
                  <label className="field-span">
                    <span>Tags</span>
                    <input value={sopDraft.tags.join(', ')} onChange={(event) => setSopDraft((current) => ({ ...current, tags: parseListInput(event.target.value) }))} placeholder="ussd, tunnel, restart-gated" />
                  </label>
                </section>

                <section className="form-section">
                  <h3>Validation Findings</h3>
                  <div className="sop-finding-list">
                    {sopDraft.validation?.errors?.map((item) => <div key={item} className="nexus-banner error"><span>{item}</span></div>)}
                    {sopDraft.validation?.warnings?.map((item) => <div key={item} className="nexus-banner warning"><span>{item}</span></div>)}
                    {!sopDraft.validation?.errors?.length && !sopDraft.validation?.warnings?.length ? (
                      <div className="nexus-banner success">
                        <strong>No validation findings loaded.</strong>
                        <span>Save and validate this SOP to produce governance findings.</span>
                      </div>
                    ) : null}
                  </div>
                  <label className="field-span">
                    <span>Metadata (JSON)</span>
                    <textarea value={sopMetadataText} onChange={(event) => setSopMetadataText(event.target.value)} />
                  </label>
                </section>

                <section className="form-section sop-section-editor">
                  <h3>Procedure Sections</h3>
                  <p className="form-helper">One instruction per line. Nexus uses these sections for retrieval, guardrails, and operator-facing explanation.</p>
                  {managedSopSections.map((section) => (
                    <label key={section} className="field-span">
                      <span>{section.replace(/_/g, ' ')}</span>
                      <textarea
                        value={(sopDraft.content?.[section] || []).join('\n')}
                        onChange={(event) =>
                          setSopDraft((current) => ({
                            ...current,
                            content: {
                              ...(current.content || {}),
                              [section]: splitSectionLines(event.target.value),
                            },
                          }))
                        }
                        placeholder={`Add ${section.replace(/_/g, ' ')} guidance...`}
                      />
                    </label>
                  ))}
                </section>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );

  const renderDatabasesWorkspace = () => (
    <div className="nexus-stack database-workspace">
      <section className="nexus-panel nexus-shell database-fabric-hero">
        <div className="panel-head">
          <div>
            <span className="panel-kicker"><FaDatabase />Database Fabric</span>
            <h2>Database-aware service intelligence</h2>
            <p>
              Nexus separates application symptoms from data-store pressure by modeling Oracle, PostgreSQL, and other
              backing databases as explicit services, evidence sources, and dependency edges.
            </p>
          </div>
          <div className="management-actions">
            {canManageNexus ? (
              <>
                <button type="button" className="primary-action" onClick={startNewDatabaseService}>
                  <FaPlus /> New DB Service
                </button>
                <button type="button" className="secondary-action" onClick={startNewDatabaseDependency}>
                  <FaCodeBranch /> New DB Edge
                </button>
              </>
            ) : (
              <span className="readonly-pill">Operator view</span>
            )}
          </div>
        </div>
        <div className="summary-grid summary-grid-compact">
          <div className="summary-tile">
            <label>Database Contracts</label>
            <strong>{databaseServices.length}</strong>
            <small>Services marked db-aware or service_type=db</small>
          </div>
          <div className="summary-tile">
            <label>DB Dependency Edges</label>
            <strong>{databaseDependencyEdges.length}</strong>
            <small>App-to-database paths Nexus can reason about</small>
          </div>
          <div className="summary-tile">
            <label>Declaration Gaps</label>
            <strong>{servicesMissingDatabaseDeclaration.length}</strong>
            <small>App/channel/integration services still missing DB truth</small>
          </div>
          <div className="summary-tile">
            <label>DB Readiness</label>
            <strong>{databaseReadinessPercent}%</strong>
            <small>{incompleteDatabaseContracts.length} incomplete database contract(s)</small>
          </div>
        </div>
        <div className={`nexus-banner ${servicesMissingDatabaseDeclaration.length || incompleteDatabaseContracts.length ? 'warning' : 'success'}`}>
          <strong>{servicesMissingDatabaseDeclaration.length || incompleteDatabaseContracts.length ? 'Database graph needs attention' : 'Database graph is declared'}</strong>
          <span>
            Add every shared database as a db service, then connect each app to its backing data store with a typed db
            edge. This is what lets Nexus blame pool exhaustion, locks, listener failures, replication lag, or storage
            pressure instead of blindly blaming the application.
          </span>
        </div>
      </section>

      <div className="nexus-grid database-workspace-grid">
        <section className="nexus-panel nexus-shell">
          <div className="panel-head">
            <div>
              <h2>Database Contracts</h2>
              <p>Production database services and app-level database profiles stored in the SentinelOps database.</p>
            </div>
            <span>{filteredDatabaseServices.length} shown</span>
          </div>
          <div className="database-card-list">
            {filteredDatabaseServices.map((service) => {
              const profile = service.database_profile || createEmptyDatabaseProfile();
              const incomplete = incompleteDatabaseContracts.some((item) => item.service_id === service.service_id);
              return (
                <article key={service.service_id} className={`database-contract-card ${incomplete ? 'incomplete' : ''}`}>
                  <div className="database-card-head">
                    <div>
                      <strong>{service.service_name || service.service_id}</strong>
                      <span>{service.service_id} | {service.environment}</span>
                    </div>
                    <span className={`soft-pill ${incomplete ? '' : 'soft-pill-ready'}`}>{incomplete ? 'Incomplete' : 'Ready'}</span>
                  </div>
                  <div className="route-card-grid">
                    <span>Platform</span>
                    <code>{profile.platform || 'not set'}</code>
                    <span>Database</span>
                    <code>{profile.database_name || profile.service_name || profile.instance_name || 'not set'}</code>
                    <span>Role</span>
                    <code>{profile.role || 'not set'}</code>
                    <span>Connection pool</span>
                    <code>{profile.connection_pool || 'not set'}</code>
                    <span>Schemas</span>
                    <code>{profile.schemas?.length ? profile.schemas.join(', ') : 'not set'}</code>
                    <span>Safe diagnostics</span>
                    <code>{profile.safe_diagnostics?.length ? profile.safe_diagnostics.join(', ') : 'not set'}</code>
                  </div>
                  <div className="database-card-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setCreatingService(false);
                        setSelectedServiceId(service.service_id);
                        setWorkspaceTab('services');
                      }}
                    >
                      <FaServer /> Edit Service
                    </button>
                  </div>
                </article>
              );
            })}
            {!filteredDatabaseServices.length ? (
              <div className="empty-state">
                No database contracts are visible yet. Create the real Oracle/Postgres service first, or enable the
                Database Contract section on the application service that owns the data path.
              </div>
            ) : null}
          </div>
        </section>

        <section className="nexus-panel nexus-shell">
          <div className="panel-head">
            <div>
              <h2>App-to-Database Edges</h2>
              <p>These edges tell Nexus exactly which database can explain each service failure path.</p>
            </div>
            <span>{filteredDatabaseDependencies.length} shown</span>
          </div>
          <div className="database-card-list">
            {filteredDatabaseDependencies.map((edge) => {
              const fromService = serviceMap[edge.from_service_id];
              const toService = serviceMap[edge.to_service_id];
              const access = edge.database_access || createEmptyDatabaseAccess();
              const hasDetail = hasDatabaseAccessDetail(edge);
              return (
                <article key={edge.edge_id || `${edge.from_service_id}-${edge.to_service_id}`} className={`database-contract-card ${hasDetail ? '' : 'incomplete'}`}>
                  <div className="database-card-head">
                    <div>
                      <strong>{fromService?.service_name || edge.from_service_id} {'->'} {toService?.service_name || edge.to_service_id}</strong>
                      <span>{edge.cluster_id || 'global'} | {edge.dependency_scope || 'global'} | {edge.dependency_purpose || 'database_access'}</span>
                    </div>
                    <span className={`soft-pill ${hasDetail ? 'soft-pill-ready' : ''}`}>{hasDetail ? 'Modeled' : 'Needs access detail'}</span>
                  </div>
                  <div className="route-card-grid">
                    <span>Access mode</span>
                    <code>{access.access_mode || 'not set'}</code>
                    <span>Connection pool</span>
                    <code>{access.connection_pool || 'not set'}</code>
                    <span>Schemas</span>
                    <code>{access.schema_names?.length ? access.schema_names.join(', ') : 'not set'}</code>
                    <span>Operations</span>
                    <code>{access.operation_types?.length ? access.operation_types.join(', ') : 'not set'}</code>
                    <span>Error codes</span>
                    <code>{access.expected_error_codes?.length ? access.expected_error_codes.join(', ') : 'not set'}</code>
                    <span>Timeout</span>
                    <code>{access.statement_timeout_ms ? `${access.statement_timeout_ms} ms` : `${edge.timeout_budget_ms || 'not set'} ms edge budget`}</code>
                  </div>
                  <div className="database-card-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => {
                        setCreatingEdge(false);
                        setSelectedEdgeId(edge.edge_id || '');
                        setWorkspaceTab('dependencies');
                      }}
                    >
                      <FaCodeBranch /> Edit Edge
                    </button>
                  </div>
                </article>
              );
            })}
            {!filteredDatabaseDependencies.length ? (
              <div className="empty-state">
                No database edges exist yet. Add a db edge from each application, channel, auth layer, or integration
                service to the database service it actually depends on.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="nexus-panel nexus-shell">
        <div className="panel-head">
          <div>
            <h2>Database Configuration Rules</h2>
            <p>Operators should use this as the minimum production contract before trusting DB-aware correlation.</p>
          </div>
          <span>Nexus DB truth model</span>
        </div>
        <div className="database-rule-grid">
          <div className="database-rule-card">
            <strong>1. Model real data stores</strong>
            <p>Add shared Oracle/PostgreSQL databases as db services. Do not hide them inside app metadata when they can cause blast radius.</p>
          </div>
          <div className="database-rule-card">
            <strong>2. Connect apps with db edges</strong>
            <p>Use dependency_type=db and declare schema, pool, access mode, operation type, timeout, and expected SQL/ORA/TNS/JDBC codes.</p>
          </div>
          <div className="database-rule-card">
            <strong>3. Keep diagnostics read-only</strong>
            <p>Database agents should report connectivity, sessions, locks, blocking, lag, storage, slow queries, and recent error codes only.</p>
          </div>
          <div className="database-rule-card">
            <strong>4. Never restart databases from V1</strong>
            <p>Databases, queues, caches, shared auth tiers, failover paths, and config changes remain blocked from safe restart automation.</p>
          </div>
        </div>
      </section>

      {servicesMissingDatabaseDeclaration.length ? (
        <section className="nexus-panel nexus-shell">
          <div className="panel-head">
            <div>
              <h2>Services Missing Database Truth</h2>
              <p>These service types usually need a database contract or an explicit db dependency edge.</p>
            </div>
            <span>{servicesMissingDatabaseDeclaration.length} gaps</span>
          </div>
          <div className="stage-card-list database-gap-list">
            {servicesMissingDatabaseDeclaration.map((service) => (
              <button
                key={service.service_id}
                type="button"
                className="stage-card"
                onClick={() => {
                  setCreatingService(false);
                  setSelectedServiceId(service.service_id);
                  setWorkspaceTab('services');
                }}
              >
                {service.service_name || service.service_id}
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const agentsWorkspace = (() => {
    const onlineAgents = lightAgents.filter((agent) => agent.status === 'online').length;
    const watchedServices = lightAgents.reduce((total, agent) => total + Number(agent.configured_service_count || 0), 0);
    const displayMetric = (value: unknown, fallback = 'Unknown') => (value === null || value === undefined || value === '' ? fallback : String(value));
    return (
      <div className="agents-workspace">
        <section className="nexus-panel nexus-shell agents-command-hero">
          <div className='fine-div'>
            <span className="panel-kicker"><FaPlug />Nexus Light Agents</span>
            <h2>Runtime edge fleet</h2>
            <p>
              Actual Nexus Light processes that have checked in from watched hosts. Each card represents one deployed agent,
              with host health, exposed command endpoints, capabilities, and the services that agent currently watches.
            </p>
          </div>
          <div className="agents-hero-metrics">
            <span><strong>{onlineAgents}</strong> online</span>
            <span><strong>{lightAgents.length}</strong> deployed</span>
            <span><strong>{watchedServices}</strong> service watches</span>
          </div>
        </section>

        <div className="agent-fleet-grid">
          {lightAgents.map((agent) => {
            const memory = (agent.host?.memory as Record<string, unknown> | undefined) || {};
            const pressure = agent.resource_pressure || {};
            const commandServer = agent.command_server || {};
            return (
              <article key={agent.agent_id} className={`agent-fleet-card status-${agent.status}`}>
                <div className="agent-card-head">
                  <div className='fine-div'>
                    <span className="panel-kicker">{agent.environment || 'environment unknown'}</span>
                    <h3>{agent.agent_id}</h3>
                    <p>{agent.host_id || agent.instance_id || 'Host identity pending'}</p>
                  </div>
                  <strong>{agent.status.replace(/_/g, ' ')}</strong>
                </div>
                <div className="agent-metric-grid">
                  <div>
                    <label>Last seen</label>
                    <strong>{agent.last_seen_at ? formatRelativeMinutes(agent.last_seen_at) : 'Never'}</strong>
                    <small>{agent.version || 'version pending'}</small>
                  </div>
                  <div>
                    <label>Memory</label>
                    <strong>{memory.used_percent != null ? `${displayMetric(memory.used_percent)}%` : 'Unknown'}</strong>
                    <small>{memory.available_mb != null ? `${displayMetric(memory.available_mb)} MB available` : 'host snapshot pending'}</small>
                  </div>
                  <div>
                    <label>Collector</label>
                    <strong>{displayMetric(pressure.collector_mode, 'unknown')}</strong>
                    <small>{pressure.high_load ? 'high-load guard active' : 'normal guard posture'}</small>
                  </div>
                  <div>
                    <label>Command Server</label>
                    <strong>{commandServer.enabled ? 'enabled' : 'disabled'}</strong>
                    <small>{displayMetric(commandServer.public_base_url || commandServer.port, 'no command URL')}</small>
                  </div>
                </div>
                <div className="agent-capability-strip">
                  {(agent.capabilities || []).slice(0, 8).map((capability) => <span key={capability}>{capability.replace(/_/g, ' ')}</span>)}
                  {!agent.capabilities?.length ? <span>No capabilities reported yet</span> : null}
                </div>
                <div className="agent-service-list">
                  <div className="section-title-row">
                    <h4>Watched Services</h4>
                    <span>{agent.reporting_service_count}/{agent.configured_service_count} heartbeat-backed</span>
                  </div>
                  {agent.services.map((service) => {
                    const serviceId = String(service.service_id || '');
                    return (
                      <button
                        key={serviceId}
                        type="button"
                        className={`agent-service-row ${service.has_heartbeat ? 'reporting' : 'missing'}`}
                        onClick={() => {
                          setSelectedServiceId(serviceId);
                          setServicePanelMode('overview');
                          setWorkspaceTab('services');
                        }}
                      >
                        <span>{String(service.service_name || serviceId)}</span>
                        <strong>{String(service.lifecycle_stage || 'uncertified').replace(/_/g, ' ')}</strong>
                        <small>{service.has_heartbeat ? 'heartbeat live' : 'awaiting heartbeat'}</small>
                      </button>
                    );
                  })}
                  {!agent.services.length ? <div className="empty-state compact">This agent has not reported watched services yet.</div> : null}
                </div>
              </article>
            );
          })}
          {!lightAgents.length ? (
            <div className="nexus-panel nexus-shell empty-state">
              No Nexus Light agents have checked in yet. Generate a token, configure an agent, and wait for the first heartbeat.
            </div>
          ) : null}
        </div>
      </div>
    );
  })();

  const renderOnboardingWorkspace = () => {
    const focusService = selectedService || services[0] || null;
    return (
      <div className="nexus-stack">
        {canManageNexus ? (
          <section className="nexus-panel nexus-shell agent-token-console">
            <div className="panel-head">
              <div>
                <span className="panel-kicker"><FaKey />Agent Trust Gate</span>
                <h2>Nexus light-agent token</h2>
                <p>
                  Generate the credential used by ATE/test light agents to send heartbeats, runtime probes,
                  diagnostics results, and guarded command callbacks into Nexus Core.
                </p>
              </div>
              <div className="management-actions">
                <button type="button" className="primary-action" onClick={() => void generateAgentToken()} disabled={agentTokenBusy}>
                  <FaKey /> {agentTokenBusy ? 'Generating...' : agentTokenStatus?.configured ? 'Rotate Token' : 'Generate Token'}
                </button>
                {generatedAgentToken?.token ? (
                  <button type="button" className="secondary-action" onClick={() => void copyAgentToken(generatedAgentToken.token)}>
                    <FaCopy /> Copy Token
                  </button>
                ) : null}
              </div>
            </div>
            <div className="agent-token-grid">
              <div className={`agent-token-card ${agentTokenStatus?.configured ? 'ready' : 'pending'}`}>
                <span>Status</span>
                <strong>{agentTokenStatus?.configured ? 'Configured' : 'Not configured'}</strong>
                <small>{agentTokenStatus?.source || 'unknown'} credential source</small>
              </div>
              <div className="agent-token-card">
                <span>Token hint</span>
                <strong>{agentTokenStatus?.token_prefix || 'No token issued'}</strong>
                <small>{agentTokenStatus?.token_id ? `id ${agentTokenStatus.token_id}` : 'Generated token appears once only.'}</small>
              </div>
              <div className="agent-token-card">
                <span>Last used</span>
                <strong>{agentTokenStatus?.last_used_at ? formatDateTime(agentTokenStatus.last_used_at) : 'Never'}</strong>
                <small>{agentTokenStatus?.usage_count || 0} authenticated agent call(s)</small>
              </div>
            </div>
            {agentTokenStatus?.warning ? (
              <div className="nexus-banner warning agent-token-warning">
                <FaExclamationTriangle />
                <span>{agentTokenStatus.warning}</span>
              </div>
            ) : null}
            {generatedAgentToken?.token ? (
              <div className="agent-token-secret">
                <div>
                  <strong>One-time token</strong>
                  <span>Use this as <code>NEXUS_AGENT_API_TOKEN</code> on the ATE light-agent host. Nexus cannot reveal it again.</span>
                </div>
                <code>{generatedAgentToken.token}</code>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="nexus-grid">
          <div className="nexus-panel nexus-shell">
            <div className="panel-head">
              <h2>Fabric Readiness</h2>
              <span>{fabricSummary?.sync_health || 'idle'}</span>
            </div>
            <div className="summary-grid summary-grid-compact">
              <div className="summary-tile">
                <label>Cataloged Services</label>
                <strong>{fabricSummary?.total_services || 0}</strong>
                <small>Shared SentinelOps DB records</small>
              </div>
              <div className="summary-tile">
                <label>Network Mapped</label>
                <strong>{fabricSummary?.mapped_network_services || 0}</strong>
                <small>Ready for live bootstrap sync</small>
              </div>
              <div className="summary-tile">
                <label>Diagnostics Ready</label>
                <strong>{fabricSummary?.diagnostics_ready_services || 0}</strong>
                <small>Service contracts meet diagnostics stage</small>
              </div>
              <div className="summary-tile">
                <label>Restart Ready</label>
                <strong>{fabricSummary?.restart_ready_services || 0}</strong>
                <small>Human-approved safe restart only</small>
              </div>
            </div>
            <div className={`nexus-banner ${fabricSummary?.sync_health === 'error' ? 'error' : 'warning'}`}>
              <strong>Sync state</strong>
              <span>{fabricSummary?.sync_message || 'No sync summary is available yet.'}</span>
            </div>
          </div>

          <div className="nexus-panel nexus-shell">
            <div className="panel-head">
              <h2>Light Analysis Contract</h2>
              <span>{focusService?.service_name || 'No service selected'}</span>
            </div>
            {focusService ? (
              <div className="checklist-list">
                {onboardingReadiness.map((item) => (
                  <div key={item.label} className={`checklist-card ${item.ready ? 'ready' : 'pending'}`}>
                    <div className="checklist-head">
                      <strong>{item.label}</strong>
                      <span className={`soft-pill ${item.ready ? 'soft-pill-ready' : ''}`}>{item.ready ? 'Ready' : 'Needed'}</span>
                    </div>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Create or select a service to see the onboarding contract.</div>
            )}
          </div>
        </div>

        <div className="nexus-grid">
          <div className="nexus-panel nexus-shell">
            <div className="panel-head">
              <h2>Certification Lanes</h2>
              <span>{services.length} services</span>
            </div>
            <div className="stage-grid">
              {certificationOptions.map((stage) => (
                <div key={stage} className="stage-column">
                  <div className="stage-head">
                    <strong>{stage.replace(/_/g, ' ')}</strong>
                    <span>{servicesByStage[stage]?.length || 0}</span>
                  </div>
                  <div className="stage-card-list">
                    {(servicesByStage[stage] || []).map((service) => (
                      <button
                        key={service.service_id}
                        type="button"
                        className="stage-card"
                        onClick={() => {
                          setCreatingService(false);
                          setSelectedServiceId(service.service_id);
                          setWorkspaceTab('services');
                        }}
                      >
                        {service.service_name}
                      </button>
                    ))}
                    {!servicesByStage[stage]?.length ? <span className="context-empty">No services yet.</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="nexus-panel nexus-shell">
            <div className="panel-head">
              <h2>Cluster Routing Inventory</h2>
              <span>{clusters.length} clusters</span>
            </div>
            <div className="route-matrix">
              {clusters.map((cluster) => (
                <div key={cluster.cluster_id} className="route-card">
                  <div className="route-card-head">
                    <strong>{cluster.cluster_name}</strong>
                    <span>{cluster.cluster_id}</span>
                  </div>
                  <div className="route-card-grid">
                    <span>Collector</span>
                    <code>{cluster.routing_config.collector_url || 'not set'}</code>
                    <span>Extractor</span>
                    <code>{cluster.routing_config.extraction_url || 'not set'}</code>
                    <span>Formatter</span>
                    <code>{cluster.routing_config.formatting_url || 'not set'}</code>
                    <span>Shipper</span>
                    <code>{cluster.routing_config.shipping_url || 'not set'}</code>
                    <span>Diagnostics</span>
                    <code>{cluster.routing_config.diagnostics_url || 'not set'}</code>
                    <span>Restart</span>
                    <code>{cluster.routing_config.restart_url || 'not set'}</code>
                  </div>
                </div>
              ))}
              {!clusters.length ? <div className="empty-state">Add a cluster to start routing extraction and shipping services.</div> : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderNexusBootPreview = () => (
    <section className="nexus-boot-preview nexus-shell" aria-live="polite" aria-label="Sentinel Nexus loading preview">
      <div className="boot-preview-copy">
        <div className="boot-logo-stage">
          <img src={nexusMark} alt="Sentinel Nexus logo" />
          <span className="boot-logo-ring ring-one" />
          <span className="boot-logo-ring ring-two" />
        </div>
        <span className="panel-kicker"><FaShieldAlt />Nexus fabric initializing</span>
        <h2>Nexus</h2>
        <p>
          Sentinel Nexus is hydrating the service graph, loading incident state from Postgres, aligning Network Sentinel evidence,
          and preparing the operator workspace.
        </p>
        <div className="boot-progress-track">
          <span />
        </div>
        <div className="boot-step-list">
          {bootPreviewSteps.map((step, index) => (
            <div key={step} className="boot-step">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="boot-preview-console">
        <div className="boot-console-orbit" aria-hidden="true">
          <span className="orbit-node node-idc">USSD</span>
          <span className="orbit-node node-arx">IDC</span>
          <span className="orbit-node node-log">LOG</span>
          <span className="orbit-node node-risk">RISK</span>
          <span className="orbit-link link-one" />
          <span className="orbit-link link-two" />
          <span className="orbit-link link-three" />
          <div className="orbit-core">
            <img src={nexusMark} alt="" aria-hidden="true" />
            <strong>Nexus Core</strong>
            <small>Correlation engine</small>
          </div>
        </div>
        <div className="boot-signal-grid">
          <div>
            <span>Signals</span>
            <strong>metrics / logs / traces</strong>
          </div>
          <div>
            <span>Graph</span>
            <strong>dependencies + blast radius</strong>
          </div>
          <div>
            <span>Guardrails</span>
            <strong>human-approved actions</strong>
          </div>
        </div>
      </div>
    </section>
  );

  if (user && !hasNexusSectionAccess) {
    return (
      <div className="nexus-page nexus-page--restricted">
        <div className="nexus-page-ambient" aria-hidden="true">
          <div className="nexus-ambient-grid" />
          <div className="nexus-ambient-orb orb-primary" />
          <div className="nexus-ambient-orb orb-secondary" />
        </div>
        <div className="nexus-surface" />
        <section className="nexus-shell nexus-access-denied">
          <div className="nexus-logo-showcase">
            <img src={nexusMark} alt="Sentinel Nexus logo" />
          </div>
          <span className="panel-kicker"><FaShieldAlt />Restricted Intelligence Fabric</span>
          <h1>Sentinel Nexus is limited to the authorized SentinelOps section.</h1>
          <p>
            Your account can continue using the rest of SentinelOps, but Nexus incident intelligence, service-fabric views,
            and action controls are available only to section {NEXUS_SECTION_ID}.
          </p>
        </section>
      </div>
    );
  }

  if (bootPreviewVisible) {
    return (
      <div className="nexus-page nexus-page--booting">
        <div className="nexus-page-ambient" aria-hidden="true">
          <div className="nexus-ambient-grid" />
          <div className="nexus-ambient-orb orb-primary" />
          <div className="nexus-ambient-orb orb-secondary" />
          <div className="nexus-ambient-orb orb-tertiary" />
        </div>
        <div className="nexus-surface" />
        {renderNexusBootPreview()}
      </div>
    );
  }

  return (
    <div className="nexus-page">
      <div className="nexus-page-ambient" aria-hidden="true">
        <div className="nexus-ambient-grid" />
        <div className="nexus-ambient-orb orb-primary" />
        <div className="nexus-ambient-orb orb-secondary" />
        <div className="nexus-ambient-orb orb-tertiary" />
      </div>
      <div className="nexus-surface" />
      <section className="nexus-hero nexus-shell">
        <div className="nexus-hero-copy">
          <div className="nexus-hero-hero-container">
            <div className="nexus-logo-container">
              <div className="nexus-logo-showcase">
                <img src={nexusMark} alt="Sentinel Nexus logo" />
              </div>
              <div className="nexus-eyebrow"><FaBroadcastTower />Sentinel Nexus</div>
            </div>
            <div className="nex-brow">
              <h1>Incident intelligence and service-fabric control</h1>
            </div>
          </div>
          <p>
            Correlate failures, manage dependency clusters, certify service contracts, and wire light extraction, formatting, shipping,
            diagnostics, and guarded restart endpoints directly from the shared SentinelOps data plane.
          </p>
          <div className="nexus-hero-chip-row">
            <span className="hero-chip">Workspace {workspaceLabel}</span>
            <span className={`hero-chip status-${(fabricSummary?.sync_health || 'idle').toLowerCase()}`}>Sync {syncHealthLabel}</span>
            <span className="hero-chip">{mappedServices}/{Math.max(totalServices, 1)} mapped</span>
            <span className="hero-chip">{totalClusters} dependency clusters</span>
            <span className="hero-chip">{totalFlows} business flows</span>
            <span className="hero-chip">{databaseServices.length} database contracts</span>
            <span className="hero-chip">Time {timezoneLabel}</span>
          </div>
          <div className="nexus-hero-actions">
            <button type="button" className="primary-action" onClick={() => void refreshEverything()} disabled={loading}>
              <FaSyncAlt /> {loading ? 'Refreshing...' : 'Refresh Nexus'}
            </button>
            {canManageNexus ? (
              <button type="button" className="secondary-action" onClick={() => void syncNetworkSentinel()} disabled={syncBusy}>
                <FaNetworkWired /> {syncBusy ? 'Syncing...' : 'Sync Network Sentinel'}
              </button>
            ) : null}
            <button type="button" className="secondary-action" onClick={() => setWorkspaceTab('services')}>
              <FaServer /> Open Catalog
            </button>
            <button type="button" className="secondary-action" onClick={() => setWorkspaceTab('databases')}>
              <FaDatabase /> Database Fabric
            </button>
          </div>
        </div>

        <div className="nexus-hero-aside">
          <div className="nexus-command-panel">
            <div className="nexus-command-head">
              <div className='my-pic'>
                <span className="panel-kicker"><FaDatabase />Fabric Pulse </span>
                <h3>SentinelOps intelligence fabric</h3>
              </div>
              <span className={`sync-pill sync-${(fabricSummary?.sync_health || 'idle').toLowerCase()}`}>{syncHealthLabel}</span>
            </div>
            <div className="nexus-command-stream">
              <div className="command-stream-item">
                <span>Last sync</span>
                <strong>{lastSyncLabel}</strong>
              </div>
              <div className="command-stream-item">
                <span>Diagnostics lane</span>
                <strong>{fabricSummary?.diagnostics_ready_services || 0} ready</strong>
              </div>
              <div className="command-stream-item">
                <span>Task Center handoff</span>
                <strong>Live</strong>
              </div>
            </div>
            <div className="nexus-operating-loop" aria-label="Nexus OSEMN operating loop">
              {intelligenceLoop.map((stage, index) => (
                <div key={stage.label} className="operating-loop-step">
                  <span className="loop-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{stage.label}</strong>
                    <small>{stage.detail} - {stage.signal}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nexus-linked-consoles nexus-shell" aria-label="Linked Sentinel Nexus consoles">
        <div className="nexus-linked-copy">
          <span>Linked consoles</span>
          <strong>Telemetry and monitoring now launch from Nexus</strong>
        </div>
        <div className="nexus-linked-grid">
          {nexusLinkedConsoles.map((consoleLink) => (
            <Link key={consoleLink.to} to={consoleLink.to} className="nexus-linked-card">
              <span className="nexus-linked-icon">{consoleLink.icon}</span>
              <span>
                <strong>{consoleLink.label}</strong>
                <small>{consoleLink.detail}</small>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="nexus-toolbar nexus-shell">
        <label className="nexus-search">
          <FaSearch />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incidents, services, clusters, flows, or dependencies..." />
        </label>
        <div className="nexus-toolbar-copy">
          <span className="toolbar-pill"><FaSignal /> Graph-aware correlation</span>
          <span className="toolbar-pill"><FaDatabase /> SentinelOps DB control plane</span>
          <span className="toolbar-pill"><FaLink /> Catalog-driven extraction and restart lanes</span>
        </div>
      </section>

      <div className="nexus-tabs-shell nexus-shell workspace-tabs-shell">
        <div className="nexus-tablist" role="tablist" aria-label="Sentinel Nexus workspaces">
          {workspaceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeWorkspace === tab.id}
              className={`nexus-tab ${activeWorkspace === tab.id ? 'active' : ''}`}
              onClick={() => setWorkspaceTab(tab.id)}
            >
              <span className="nexus-tab-label">{tab.icon}{tab.label}</span>
              <span className="nexus-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="nexus-shell nexus-banner error">{error}</div> : null}

      {activeWorkspace === 'incidents'
        ? renderIncidentWorkspace()
        : activeWorkspace === 'services'
          ? renderServicesWorkspace()
          : activeWorkspace === 'agents'
            ? agentsWorkspace
            : activeWorkspace === 'databases'
              ? renderDatabasesWorkspace()
              : activeWorkspace === 'rollover'
                ? renderRolloverWorkspace()
                : activeWorkspace === 'clusters'
                  ? renderClustersWorkspace()
                  : activeWorkspace === 'flows'
                    ? renderBusinessFlowsWorkspace()
                    : activeWorkspace === 'dependencies'
                      ? renderDependenciesWorkspace()
                      : activeWorkspace === 'sops'
                        ? renderSopsWorkspace()
                        : renderOnboardingWorkspace()}

      {activeWorkspace !== 'incidents' ? renderIncidentCommandModal() : null}
      {sourceExplorerModal}
      {logTailModal}

      <PageGuide guide={pageGuides.nexus} />
    </div>
  );
};

export default NexusPage;
