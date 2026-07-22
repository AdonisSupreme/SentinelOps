import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownCircle,
  FiCalendar,
  FiCheckCircle,
  FiCheckSquare,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDatabase,
  FiEye,
  FiFileText,
  FiLayers,
  FiPlay,
  FiRefreshCcw,
  FiShield,
  FiTarget,
  FiToggleLeft,
  FiToggleRight,
  FiUserCheck,
  FiX,
  FiZap,
} from 'react-icons/fi';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import centralizedWebSocketManager from '../services/centralizedWebSocketManager';
import nexusApi, {
  NexusRTGSAssessment,
  NexusRTGSAutoRegenerationAuditEntry,
  NexusRTGSAutoRegenerationPolicy,
  NexusRTGSRegenerationHistoryEntry,
  NexusRTGSSchedule,
  NexusRTGSTransactionCase,
} from '../services/nexusApi';
import trustlinkApi, {
  TrustlinkRunDetail,
  TrustlinkRunListItem,
  TrustlinkStep,
  TrustlinkTodayStatusResponse,
} from '../services/trustlinkApi';
import './TrustlinkOperationsPage.css';

type PipelineStageName = TrustlinkStep['step_name'] | 'DOWNLOAD';
type TrustlinkTab = 'pipeline' | 'history' | 'rtgs';
type TrustlinkWorkspace = 'extraction' | 'rtgs';
type LiveConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';
type RTGSWorkspaceView = 'queue' | 'history' | 'automation';

interface PipelineTimelineItem {
  id: PipelineStageName;
  order: number;
  title: string;
  detail: string;
  status: string;
  statusKey: string;
  tone: string;
  rows: string;
  duration: string;
  meta: string;
}

const PIPELINE_ORDER: PipelineStageName[] = [
  'IDC_EXTRACTION',
  'DIGIPAY_EXTRACTION',
  'TRANSFORMATION',
  'VALIDATION',
  'FILE_SAVE',
  'DOWNLOAD',
];

const TRUSTLINK_STEP_NAMES = PIPELINE_ORDER.filter((name): name is TrustlinkStep['step_name'] => name !== 'DOWNLOAD');

const STEP_COPY: Record<PipelineStageName, { title: string; detail: string }> = {
  IDC_EXTRACTION: {
    title: 'IDC Ingest',
    detail: 'Pull source records and verify batch availability.',
  },
  DIGIPAY_EXTRACTION: {
    title: 'DigiPay Ingest',
    detail: 'Collect downstream payment evidence and row counts.',
  },
  TRANSFORMATION: {
    title: 'Transformation',
    detail: 'Normalize schemas and merge extracted sources.',
  },
  VALIDATION: {
    title: 'Validation',
    detail: 'Check integrity, totals, and reconciliation signals.',
  },
  FILE_SAVE: {
    title: 'File Save',
    detail: 'Persist the export package and publish delivery evidence.',
  },
  DOWNLOAD: {
    title: 'Download',
    detail: 'Expose the generated file for secure operator download.',
  },
};

const FILE_RETENTION_DAYS = 2;

const EXTRACTION_TABS: Array<{ id: Exclude<TrustlinkTab, 'rtgs'>; label: string; icon: React.ReactNode }> = [
  { id: 'pipeline', label: 'Pipeline', icon: <FiLayers /> },
  { id: 'history', label: 'History', icon: <FiFileText /> },
];

const TrustlinkOperationsPreview: React.FC = () => (
  <div className="trustlink-page trustlink-preview-page">
    <section className="trustlink-command-strip trustlink-skel-panel">
      <div className="trustlink-skel-command-copy">
        <div className="trustlink-skel-line trustlink-skel-kicker" />
        <div className="trustlink-skel-line trustlink-skel-title" />
        <div className="trustlink-skel-line trustlink-skel-meta" />
      </div>
      <div className="trustlink-skel-command-brief">
        <div className="trustlink-skel-block trustlink-skel-pill" />
        <div className="trustlink-skel-line trustlink-skel-meta" />
      </div>
    </section>

    <div className="trustlink-workspace-nav trustlink-skel-workspace-nav" aria-hidden="true">
      <div className="trustlink-skel-line trustlink-skel-workspace-label" />
      <div className="trustlink-skel-block trustlink-skel-workspace-tab" />
      <div className="trustlink-skel-block trustlink-skel-workspace-tab" />
    </div>

    <section className="trustlink-layout">
      <div className="trustlink-board-panel trustlink-skel-panel">
        <div className="trustlink-skel-board-head">
          <div>
            <div className="trustlink-skel-line trustlink-skel-kicker" />
            <div className="trustlink-skel-line trustlink-skel-panel-title" />
          </div>
          <div className="trustlink-skel-block trustlink-skel-pill" />
        </div>
        <div className="trustlink-skel-actions">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="trustlink-skel-block trustlink-skel-action" />
          ))}
        </div>
        <div className="trustlink-skel-tabs">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="trustlink-skel-block trustlink-skel-tab" />
          ))}
        </div>
        <div className="trustlink-skel-pipeline">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="trustlink-skel-stage" />
          ))}
        </div>
      </div>

      <aside className="trustlink-side-rail">
        <div className="trustlink-side-card trustlink-skel-panel">
          <div className="trustlink-skel-line trustlink-skel-kicker" />
          <div className="trustlink-skel-line trustlink-skel-panel-title" />
          <div className="trustlink-skel-micro-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="trustlink-skel-field" />
            ))}
          </div>
        </div>
        <div className="trustlink-side-card trustlink-skel-panel">
          <div className="trustlink-skel-line trustlink-skel-kicker" />
          <div className="trustlink-skel-list">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="trustlink-skel-row" />
            ))}
          </div>
        </div>
      </aside>
    </section>
  </div>
);

const formatDuration = (ms?: number | null): string => {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

const formatNumber = (value?: number | null): string => (
  new Intl.NumberFormat().format(value ?? 0)
);

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatRTGSEntryDate = (value?: string | null): string => {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatRunDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatRunType = (value?: string | null): string => (
  (value || 'manual').toLowerCase() === 'scheduled' ? 'Scheduled' : 'Manual'
);

const prettyFileStatus = (status?: string | null): string => {
  if (status === 'available') return 'Available';
  if (status === 'deleted') return 'Deleted';
  return 'Not generated';
};

const normalizeVisualStatus = (status?: string | null): string => {
  const normalized = (status || 'pending').toLowerCase();

  if (normalized === 'success') return 'success';
  if (normalized === 'completed') return 'completed';
  if (normalized === 'exists' || normalized === 'duplicate') return 'warning';
  if (normalized === 'failed') return 'failed';
  if (normalized === 'running') return 'running';
  if (normalized === 'none') return 'neutral';
  return 'pending';
};

const prettyStatus = (status?: string | null): string => {
  const normalized = (status || 'pending').toLowerCase();

  if (normalized === 'success') return 'Successful';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'duplicate') return 'Duplicate';
  if (normalized === 'exists') return 'Already exists';
  if (normalized === 'running') return 'Running';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'none') return 'No run';
  return 'Pending';
};

const isTrustlinkStepName = (value: unknown): value is TrustlinkStep['step_name'] => (
  TRUSTLINK_STEP_NAMES.includes(value as TrustlinkStep['step_name'])
);

const normalizeStepStatusFromPayload = (value: unknown): TrustlinkStep['status'] => {
  const status = String(value || 'pending').toLowerCase();
  if (status === 'running' || status === 'completed' || status === 'failed') return status;
  return 'pending';
};

const asPayloadNumber = (value: unknown): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : 0
);

const asPayloadString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim() ? value : null
);

const getErrorMessage = (error: unknown): string => {
  const candidate = error as {
    message?: string;
    response?: { status?: number; data?: { detail?: string | { message?: string }; message?: string } };
  } | null;
  const detail = candidate?.response?.data?.detail;
  const message = typeof detail === 'string'
    ? detail
    : typeof detail?.message === 'string'
      ? detail.message
      : candidate?.response?.data?.message || candidate?.message || '';

  return message || 'Failed to load TrustLink operations data.';
};

const durationFromTimestamps = (startedAt?: string | null, completedAt?: string | null): number => {
  if (!startedAt || !completedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return end - start;
};

const getRunDurationMs = (
  run?: Pick<TrustlinkRunListItem, 'total_duration_ms' | 'started_at' | 'completed_at'> | null,
): number => {
  if (!run) return 0;
  if (typeof run.total_duration_ms === 'number' && run.total_duration_ms > 0) {
    return run.total_duration_ms;
  }
  return durationFromTimestamps(run.started_at, run.completed_at);
};

const daysOld = (runDate?: string | null): number => {
  if (!runDate) return 0;
  const run = new Date(`${runDate}T00:00:00`);
  if (Number.isNaN(run.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - run.getTime()) / 86_400_000);
};

const canDeleteRunFile = (run: TrustlinkRunListItem, runs: TrustlinkRunListItem[]): boolean => (
  Boolean(run.file_present)
  && run.file_status === 'available'
  && daysOld(run.run_date) >= FILE_RETENTION_DAYS
  && runs.some((candidate) => (
    candidate.id !== run.id
    && Boolean(candidate.file_present)
    && candidate.file_status === 'available'
    && candidate.run_date > run.run_date
  ))
);

const buildPipelineTimeline = (
  run: TrustlinkRunDetail | null,
  runSteps: TrustlinkStep[],
  hasCurrentFile?: boolean,
): PipelineTimelineItem[] => {
  const mapped = new Map<TrustlinkStep['step_name'], TrustlinkStep>();
  for (const step of runSteps) mapped.set(step.step_name, step);

  return PIPELINE_ORDER.map((name, index) => {
    if (name === 'DOWNLOAD') {
      const hasDownload = Boolean(run?.file_present || hasCurrentFile);
      const saveStepStatus = mapped.get('FILE_SAVE')?.status;
      const downloadStatus = hasDownload
        ? 'completed'
        : run?.status === 'failed'
          ? 'failed'
          : (run?.status === 'running' || saveStepStatus === 'running')
            ? 'running'
            : 'pending';

      return {
        id: name,
        order: index + 1,
        title: STEP_COPY[name].title,
        detail: STEP_COPY[name].detail,
        status: prettyStatus(downloadStatus),
        statusKey: downloadStatus,
        tone: normalizeVisualStatus(downloadStatus),
        rows: hasDownload ? formatNumber(run?.total_rows) : '-',
        duration: '-',
        meta: hasDownload ? formatDateTime(run?.completed_at) : '-',
      };
    }

    const step = mapped.get(name);
    const status = step?.status || 'pending';

    return {
      id: name,
      order: index + 1,
      title: STEP_COPY[name].title,
      detail: STEP_COPY[name].detail,
      status: prettyStatus(status),
      statusKey: status,
      tone: normalizeVisualStatus(status),
      rows: formatNumber(step?.row_count ?? 0),
      duration: formatDuration(step?.duration_ms),
      meta: formatDateTime(step?.completed_at || step?.started_at),
    };
  });
};

const RTGS_LANES = ['0_24H', '24_48H', '48_72H', '72_96H', 'OVER_96H'] as const;
type RTGSLane = typeof RTGS_LANES[number];
const RTGS_LANE_PAGE_SIZE = 12;
const RTGS_DAY_NAV_PAGE_SIZE = 8;
const RTGS_ACTION_BATCH_SIZE = 100;

const RTGS_LANE_LABELS: Record<RTGSLane, string> = {
  '0_24H': '0-24 hours',
  '24_48H': '24-48 hours',
  '48_72H': '48-72 hours',
  '72_96H': '72-96 hours',
  OVER_96H: 'Older than 96 hours',
};

const rtgsCaseTone = (item: NexusRTGSTransactionCase): string => {
  if (!item.regeneration_ready) return 'warning';
  if (item.age_lane === 'OVER_96H') return 'failed';
  return 'success';
};

const rtgsRecommendationLabel = (item: NexusRTGSTransactionCase): string => (
  item.regeneration_ready ? 'Ready for regeneration' : 'Queue context missing'
);

const rtgsDayKey = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Harare',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

const formatRTGSDayLabel = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: 'Africa/Harare',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const rtgsHistoryTone = (status: NexusRTGSRegenerationHistoryEntry['status']): string => {
  if (status === 'COMPLETED' || status === 'NOOP') return 'success';
  if (status === 'FAILED') return 'failed';
  return 'warning';
};

const chunkRTGSIds = (ids: string[]): string[][] => {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += RTGS_ACTION_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + RTGS_ACTION_BATCH_SIZE));
  }
  return chunks;
};

const TrustlinkOperationsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TrustlinkTab>('pipeline');
  const [liveConnectionState, setLiveConnectionState] = useState<LiveConnectionState>('connecting');
  const [todayStatus, setTodayStatus] = useState<TrustlinkTodayStatusResponse | null>(null);
  const [runs, setRuns] = useState<TrustlinkRunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<TrustlinkRunDetail | null>(null);
  const [steps, setSteps] = useState<TrustlinkStep[]>([]);
  const [inspectorRun, setInspectorRun] = useState<TrustlinkRunDetail | null>(null);
  const [inspectorSteps, setInspectorSteps] = useState<TrustlinkStep[]>([]);
  const [inspectorLoading, setInspectorLoading] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingFileDeleteRun, setPendingFileDeleteRun] = useState<TrustlinkRunListItem | null>(null);
  const [rtgsAssessment, setRtgsAssessment] = useState<NexusRTGSAssessment | null>(null);
  const [rtgsLoading, setRtgsLoading] = useState(false);
  const [rtgsActionLoading, setRtgsActionLoading] = useState(false);
  const [selectedRTGSIds, setSelectedRTGSIds] = useState<string[]>([]);
  const [rtgsReason, setRtgsReason] = useState('');
  const [rtgsActionMessage, setRtgsActionMessage] = useState<string | null>(null);
  const [rtgsSchedules, setRtgsSchedules] = useState<NexusRTGSSchedule[]>([]);
  const [scheduleInterval, setScheduleInterval] = useState<30 | 60>(30);
  const [selectedRTGSLane, setSelectedRTGSLane] = useState<RTGSLane>('OVER_96H');
  const [rtgsLanePage, setRtgsLanePage] = useState(1);
  const [selectedRTGSDay, setSelectedRTGSDay] = useState<string | null>(null);
  const [rtgsDayIndexPage, setRtgsDayIndexPage] = useState(1);
  const [rtgsWorkspaceView, setRtgsWorkspaceView] = useState<RTGSWorkspaceView>('queue');
  const [rtgsHistory, setRtgsHistory] = useState<NexusRTGSRegenerationHistoryEntry[]>([]);
  const [rtgsAutoPolicy, setRtgsAutoPolicy] = useState<NexusRTGSAutoRegenerationPolicy | null>(null);
  const [rtgsAutoAudit, setRtgsAutoAudit] = useState<NexusRTGSAutoRegenerationAuditEntry[]>([]);
  const [rtgsControlLoading, setRtgsControlLoading] = useState(false);
  const [rtgsControlError, setRtgsControlError] = useState<string | null>(null);

  const displayRun = selectedRun || todayStatus?.run || null;
  const selectedRunId = displayRun?.id || null;
  const activeWorkspace: TrustlinkWorkspace = activeTab === 'rtgs' ? 'rtgs' : 'extraction';

  const loadRTGSControlData = useCallback(async (): Promise<void> => {
    const [historyResult, policyResult, auditResult] = await Promise.allSettled([
      nexusApi.listRTGSRegenerationHistory(150),
      nexusApi.getRTGSAutoRegenerationPolicy(),
      nexusApi.listRTGSAutoRegenerationAudit(100),
    ]);
    if (historyResult.status === 'fulfilled') setRtgsHistory(historyResult.value);
    if (policyResult.status === 'fulfilled') setRtgsAutoPolicy(policyResult.value);
    if (auditResult.status === 'fulfilled') setRtgsAutoAudit(auditResult.value);
    if (policyResult.status === 'rejected') setRtgsAutoPolicy(null);
    const failure = [historyResult, policyResult, auditResult].find((result) => result.status === 'rejected');
    setRtgsControlError(failure?.status === 'rejected' ? getErrorMessage(failure.reason) : null);
  }, []);

  const loadRTGS = useCallback(async (manual = false) => {
    setRtgsLoading(true);
    setRtgsActionMessage(null);
    let assessmentLoaded = false;
    let loadMessage: string | null = null;
    try {
      try {
        const assessment = manual
          ? await nexusApi.assessRTGSTransactions()
          : await nexusApi.getLatestRTGSAssessment();
        setRtgsAssessment(assessment);
        assessmentLoaded = true;
      } catch (e) {
        const status = typeof e === 'object' && e !== null && 'response' in e
          ? (e as { response?: { status?: number } }).response?.status
          : undefined;
        loadMessage = status === 404
          ? 'The active Nexus runtime does not expose the RTGS assessment route yet. Redeploy the Nexus API, then refresh this surface.'
          : getErrorMessage(e);
      }

      try {
        const schedules = await nexusApi.listRTGSSchedules();
        setRtgsSchedules(schedules);
        if (schedules[0]?.interval_minutes === 30 || schedules[0]?.interval_minutes === 60) {
          setScheduleInterval(schedules[0].interval_minutes);
        }
      } catch (e) {
        if (!assessmentLoaded && !loadMessage) {
          const status = typeof e === 'object' && e !== null && 'response' in e
            ? (e as { response?: { status?: number } }).response?.status
            : undefined;
          loadMessage = status === 404
            ? 'The active Nexus runtime has not registered RTGS recovery routes. Redeploy the Nexus API, then refresh.'
            : getErrorMessage(e);
        }
      }
      await loadRTGSControlData();
      setSelectedRTGSIds([]);
      if (loadMessage) setRtgsActionMessage(loadMessage);
    } finally {
      setRtgsLoading(false);
    }
  }, [loadRTGSControlData]);

  useEffect(() => {
    if (activeTab === 'rtgs' && !rtgsAssessment) void loadRTGS();
  }, [activeTab, loadRTGS, rtgsAssessment]);

  useEffect(() => {
    if (!rtgsAssessment) return;

    setSelectedRTGSLane((current) => (
      rtgsAssessment.cases.some((item) => item.age_lane === current)
        ? current
        : RTGS_LANES.find((lane) => rtgsAssessment.cases.some((item) => item.age_lane === lane)) || 'OVER_96H'
    ));
    setRtgsLanePage(1);
    setRtgsDayIndexPage(1);
  }, [rtgsAssessment]);

  const loadRun = useCallback(async (runId: string) => {
    const [detail, runSteps] = await Promise.all([
      trustlinkApi.getRunDetails(runId),
      trustlinkApi.getRunSteps(runId),
    ]);
    setSelectedRun(detail);
    setSteps(runSteps);
    return { detail, runSteps };
  }, []);

  const hydrate = useCallback(async (opts?: { initial?: boolean; silent?: boolean }) => {
    const isInitial = Boolean(opts?.initial);
    const isSilent = Boolean(opts?.silent);

    if (isInitial) setInitialLoading(true);
    if (!isInitial && !isSilent) setRefreshing(true);
    if (!isSilent) setError(null);

    try {
      const [today, history] = await Promise.all([
        trustlinkApi.getTodayStatus(),
        trustlinkApi.listRuns(50, 0),
      ]);

      setTodayStatus(today);
      setRuns(history);

      const runId = today.run?.id || history[0]?.id;
      if (runId) {
        await loadRun(runId);
      } else {
        setSelectedRun(null);
        setSteps([]);
      }
    } catch (e) {
      setError(getErrorMessage(e));
      setSelectedRun(null);
      setSteps([]);
      setRuns([]);
    } finally {
      if (isInitial) setInitialLoading(false);
      if (!isInitial) setRefreshing(false);
    }
  }, [loadRun]);

  useEffect(() => {
    void hydrate({ initial: true });
  }, [hydrate]);

  useEffect(() => {
    const unsubscribe = centralizedWebSocketManager.subscribe('checklists', (event: any) => {
      if (event?.type === 'connected' || event?.type === 'CONNECTION_ESTABLISHED') {
        setLiveConnectionState('connected');
        return;
      }
      if (event?.type === 'reconnecting') {
        setLiveConnectionState('reconnecting');
        return;
      }
      if (
        event?.type === 'disconnected'
        || event?.type === 'error'
        || event?.type === 'auth_error'
        || event?.type === 'reconnect_failed'
      ) {
        setLiveConnectionState('offline');
        return;
      }

      const payload = event?.type === 'CHECKLIST_UPDATE' ? event?.data : event;
      if (payload?.type !== 'trustlink_update') return;

      const eventRunId: string | undefined = payload?.run_id;
      if (!eventRunId) return;

      setLiveConnectionState('connected');

      const eventStep = payload?.step;
      if (isTrustlinkStepName(eventStep)) {
        setSteps((previousSteps) => {
          const nextStep: TrustlinkStep = {
            id: asPayloadNumber(payload.step_id),
            run_id: eventRunId,
            step_name: eventStep,
            status: normalizeStepStatusFromPayload(payload.step_status || payload.status),
            row_count: asPayloadNumber(payload.row_count),
            duration_ms: asPayloadNumber(payload.duration_ms),
            metadata: {},
            started_at: asPayloadString(payload.started_at),
            completed_at: asPayloadString(payload.completed_at),
            created_at: null,
          };
          const existingIndex = previousSteps.findIndex((step) => step.step_name === eventStep);
          if (existingIndex < 0) {
            return [...previousSteps, nextStep].sort(
              (left, right) => TRUSTLINK_STEP_NAMES.indexOf(left.step_name) - TRUSTLINK_STEP_NAMES.indexOf(right.step_name),
            );
          }

          const mergedSteps = [...previousSteps];
          mergedSteps[existingIndex] = {
            ...mergedSteps[existingIndex],
            ...nextStep,
            id: nextStep.id || mergedSteps[existingIndex].id,
            row_count: nextStep.row_count || mergedSteps[existingIndex].row_count,
            duration_ms: nextStep.duration_ms || mergedSteps[existingIndex].duration_ms,
            started_at: nextStep.started_at || mergedSteps[existingIndex].started_at,
            completed_at: nextStep.completed_at || mergedSteps[existingIndex].completed_at,
          };
          return mergedSteps;
        });
      }

      if (payload?.event === 'run' || payload?.run_status) {
        const runPatch = {
          status: String(payload.run_status || payload.status || 'running') as TrustlinkRunDetail['status'],
          total_rows: asPayloadNumber(payload.total_rows),
          total_duration_ms: asPayloadNumber(payload.total_duration_ms),
          file_present: Boolean(payload.file_present),
          file_status: String(payload.file_status || 'not_generated') as TrustlinkRunDetail['file_status'],
          completed_at: asPayloadString(payload.completed_at),
        };

        setSelectedRun((currentRun) => (
          currentRun?.id === eventRunId
            ? {
              ...currentRun,
              ...runPatch,
              total_rows: runPatch.total_rows || currentRun.total_rows,
              total_duration_ms: runPatch.total_duration_ms || currentRun.total_duration_ms,
              completed_at: runPatch.completed_at || currentRun.completed_at,
            }
            : currentRun
        ));
        setTodayStatus((currentToday) => (
          currentToday?.run?.id === eventRunId
            ? {
              ...currentToday,
              has_file: runPatch.file_present || currentToday.has_file,
              run: {
                ...currentToday.run,
                ...runPatch,
                total_rows: runPatch.total_rows || currentToday.run.total_rows,
                total_duration_ms: runPatch.total_duration_ms || currentToday.run.total_duration_ms,
                completed_at: runPatch.completed_at || currentToday.run.completed_at,
              },
            }
            : currentToday
        ));
        setRuns((currentRuns) => currentRuns.map((run) => (
          run.id === eventRunId
            ? {
              ...run,
              ...runPatch,
              total_rows: runPatch.total_rows || run.total_rows,
              total_duration_ms: runPatch.total_duration_ms || run.total_duration_ms,
              completed_at: runPatch.completed_at || run.completed_at,
            }
            : run
        )));
      }

      setRefreshing(true);
      void (async () => {
        try {
          const [today, history] = await Promise.all([
            trustlinkApi.getTodayStatus(),
            trustlinkApi.listRuns(50, 0),
          ]);
          setTodayStatus(today);
          setRuns(history);

          if (!selectedRunId || selectedRunId === eventRunId || today.run?.id === eventRunId) {
            await loadRun(eventRunId);
          }
        } catch {
          // Ignore transient websocket refresh errors.
        } finally {
          setRefreshing(false);
        }
      })();
    });

    return unsubscribe;
  }, [loadRun, selectedRunId]);

  const timeline = useMemo(
    () => buildPipelineTimeline(displayRun, steps, todayStatus?.has_file),
    [displayRun, steps, todayStatus?.has_file],
  );

  const completionCount = useMemo(
    () => timeline.filter((item) => item.statusKey === 'completed').length,
    [timeline],
  );

  const totalDuration = getRunDurationMs(displayRun);
  const currentStatus = displayRun?.status || todayStatus?.status || 'none';
  const currentStatusTone = normalizeVisualStatus(currentStatus);
  const hasRunData = Boolean(todayStatus?.run || runs.length || selectedRun);
  const liveTone = liveConnectionState === 'connected'
    ? 'success'
    : liveConnectionState === 'reconnecting'
      ? 'warning'
      : liveConnectionState === 'offline'
        ? 'failed'
        : 'running';
  const liveLabel = liveConnectionState === 'connected'
    ? 'Realtime connected'
    : liveConnectionState === 'reconnecting'
      ? 'Realtime reconnecting'
      : liveConnectionState === 'offline'
        ? 'Realtime offline'
        : 'Realtime connecting';

  const deadlineReadiness = useMemo(() => {
    const run = todayStatus?.run;
    if (!run) {
      return { label: 'Awaiting run', tone: 'warning' as const };
    }
    if (run.status === 'running') {
      return { label: 'Extraction active', tone: 'running' as const };
    }
    if (run.status === 'failed') {
      return { label: 'Missed / failed', tone: 'failed' as const };
    }
    if (run.completed_at) {
      return { label: 'Delivered', tone: 'success' as const };
    }
    return { label: prettyStatus(run.status), tone: 'warning' as const };
  }, [todayStatus]);

  const handleRunNow = async () => {
    setActionLoading(true);
    setActionLabel('Scheduling extraction run');
    setError(null);

    try {
      const result = await trustlinkApi.runNow(false);
      if (result.status === 'exists') {
        setError('A TrustLink export already exists for today. Download it or run an overwrite extraction.');
      }
      await hydrate({ silent: true });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
    }
  };

  const handleOverwrite = async () => {
    setActionLoading(true);
    setActionLabel('Scheduling overwrite extraction');
    setError(null);

    try {
      await trustlinkApi.overwriteRun();
      await hydrate({ silent: true });
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
    }
  };

  const confirmOverwrite = async () => {
    setShowOverwriteWarning(false);
    await handleOverwrite();
  };

  const handleDownload = async (runId: string, preferredFilename?: string | null) => {
    setActionLoading(true);
    setActionLabel('Preparing export download');
    setError(null);

    try {
      await trustlinkApi.downloadRunFile(runId, preferredFilename);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
    }
  };

  const handleDeleteFile = async (runId: string) => {
    setActionLoading(true);
    setActionLabel('Removing saved export file');
    setError(null);

    try {
      const result = await trustlinkApi.deleteRunFile(runId);
      await hydrate({ silent: true });
      if (selectedRunId === runId) {
        setError(result.detail);
      }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
    }
  };

  const confirmDeleteFile = async () => {
    if (!pendingFileDeleteRun) return;
    const runId = pendingFileDeleteRun.id;
    setPendingFileDeleteRun(null);
    await handleDeleteFile(runId);
  };

  const handleRTGSAction = async () => {
    if (!selectedRTGSIds.length) {
      setRtgsActionMessage('Select at least one transaction before requesting an action.');
      return;
    }
    if (rtgsReason.trim().length < 8) {
      setRtgsActionMessage('Add an operator reason or change reference before requesting an action.');
      return;
    }
    setRtgsActionLoading(true);
    setRtgsActionMessage(null);
    try {
      const requestId = Date.now();
      const batches = chunkRTGSIds(selectedRTGSIds);
      const results = [];
      for (let index = 0; index < batches.length; index += 1) {
        const transactionIds = batches[index];
        const batchResults = await nexusApi.executeRTGSAction({
          transaction_ids: transactionIds,
          reason: rtgsReason.trim(),
          idempotency_key: `rtgs-regenerate-${requestId}-${index + 1}`,
          confirm_over_96h: transactionIds.some((id) => rtgsAssessment?.cases.find((item) => item.transaction_id === id)?.age_lane === 'OVER_96H'),
        });
        results.push(...batchResults);
      }
      const completed = results.filter((item) => item.status === 'COMPLETED').length;
      setRtgsActionMessage(`${completed} of ${results.length} regeneration request(s) completed. Re-run the database assessment to refresh queue state.`);
      setSelectedRTGSIds([]);
      await loadRTGSControlData();
    } catch (e) {
      setRtgsActionMessage(getErrorMessage(e));
    } finally {
      setRtgsActionLoading(false);
    }
  };

  const handleToggleAutoRegeneration = async () => {
    if (!isAdmin || !rtgsAutoPolicy) return;
    setRtgsControlLoading(true);
    setRtgsActionMessage(null);
    try {
      const updated = await nexusApi.updateRTGSAutoRegenerationPolicy(!rtgsAutoPolicy.enabled);
      setRtgsAutoPolicy(updated);
      await loadRTGSControlData();
      setRtgsActionMessage(`Automatic five-day regeneration is now ${updated.enabled ? 'on' : 'off'}.`);
    } catch (e) {
      setRtgsActionMessage(getErrorMessage(e));
    } finally {
      setRtgsControlLoading(false);
    }
  };

  const handleSetRTGSCadence = async (intervalMinutes: 30 | 60) => {
    const schedule = rtgsSchedules[0];
    setScheduleInterval(intervalMinutes);
    if (!schedule) {
      setRtgsActionMessage('RTGS cadence is ready to display, but the active Nexus runtime has not returned its schedule configuration.');
      return;
    }
    try {
      const updated = await nexusApi.updateRTGSSchedule(schedule.schedule_id, {
        label: schedule.label,
        interval_minutes: intervalMinutes,
        enabled: schedule.enabled,
      });
      setRtgsSchedules((current) => current.map((item) => item.schedule_id === updated.schedule_id ? updated : item));
      setRtgsActionMessage(`RTGS assessment cadence set to every ${intervalMinutes === 30 ? '30 minutes' : 'hour'}.`);
    } catch (e) {
      setRtgsActionMessage(getErrorMessage(e));
    }
  };

  const openRunInspector = async (runId: string) => {
    setShowInspector(true);
    setInspectorLoading(true);
    setError(null);

    try {
      const { detail, runSteps } = await loadRun(runId);
      setInspectorRun(detail);
      setInspectorSteps(runSteps);
    } catch (e) {
      setShowInspector(false);
      setError(getErrorMessage(e));
    } finally {
      setInspectorLoading(false);
    }
  };

  const closeInspector = () => {
    setShowInspector(false);
    setInspectorRun(null);
    setInspectorSteps([]);
  };

  const renderDataPoint = (label: string, value: React.ReactNode, wide = false) => (
    <div className={`trustlink-data-point ${wide ? 'trustlink-data-point-wide' : ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );

  const selectRTGSLane = (lane: RTGSLane) => {
    setSelectedRTGSLane(lane);
    setRtgsLanePage(1);
    setRtgsDayIndexPage(1);
    setSelectedRTGSDay(null);
  };

  const toggleRTGSCase = (item: NexusRTGSTransactionCase) => {
    if (!item.regeneration_ready) return;
    setSelectedRTGSIds((current) => (
      current.includes(item.transaction_id)
        ? current.filter((id) => id !== item.transaction_id)
        : [...current, item.transaction_id]
    ));
  };

  const toggleRTGSGroup = (items: NexusRTGSTransactionCase[]) => {
    const eligibleIds = items.filter((item) => item.regeneration_ready).map((item) => item.transaction_id);
    if (!eligibleIds.length) return;
    setSelectedRTGSIds((current) => {
      const allSelected = eligibleIds.every((id) => current.includes(id));
      if (allSelected) return current.filter((id) => !eligibleIds.includes(id));
      return Array.from(new Set([...current, ...eligibleIds]));
    });
  };

  const isRTGSGroupSelected = (items: NexusRTGSTransactionCase[]) => {
    const eligibleIds = items.filter((item) => item.regeneration_ready).map((item) => item.transaction_id);
    return Boolean(eligibleIds.length) && eligibleIds.every((id) => selectedRTGSIds.includes(id));
  };

  const renderRTGSLaneRail = (cases: NexusRTGSTransactionCase[]) => (
    <aside className="trustlink-side-rail rtgs-side-rail">
      <article className="trustlink-side-card rtgs-lane-nav-card">
        <div className="trustlink-panel-head compact">
          <div>
            <span className="trustlink-panel-kicker"><FiActivity /> Recovery lanes</span>
            <h3>Open a transaction lane</h3>
          </div>
          <span className="trustlink-chip">RTGS</span>
        </div>
        <p className="trustlink-side-copy">Choose the age range to load into the recovery workspace.</p>
        <nav className="rtgs-lane-nav" aria-label="RTGS transaction age lanes">
          {RTGS_LANES.map((lane, index) => {
            const count = cases.filter((item) => item.age_lane === lane).length;
            const selected = selectedRTGSLane === lane;
            return (
              <button
                key={lane}
                type="button"
                className={`rtgs-lane-nav-item ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                onClick={() => selectRTGSLane(lane)}
              >
                <span className="rtgs-lane-nav-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="rtgs-lane-nav-copy">
                  <small>Age lane</small>
                  <strong>{RTGS_LANE_LABELS[lane]}</strong>
                </span>
                <span className="rtgs-lane-nav-count">{count}</span>
              </button>
            );
          })}
        </nav>
      </article>

      <article className="trustlink-side-card rtgs-side-note">
        <span className="trustlink-panel-kicker"><FiTarget /> Workspace focus</span>
        <h3>{RTGS_LANE_LABELS[selectedRTGSLane]}</h3>
        <p className="trustlink-side-copy">The selected lane is open in the main workspace. Use the guarded action rail there when a recovery request is justified.</p>
      </article>
    </aside>
  );

  const renderRTGSCaseCard = (item: NexusRTGSTransactionCase) => {
    const checked = selectedRTGSIds.includes(item.transaction_id);
    const selectable = item.regeneration_ready;
    return (
      <article
        className={`rtgs-case-card tone-${rtgsCaseTone(item)} ${checked ? 'selected' : ''} ${selectable ? 'selectable' : 'disabled'}`}
        key={item.transaction_id}
        role="checkbox"
        aria-checked={checked}
        aria-disabled={!selectable}
        tabIndex={selectable ? 0 : -1}
        onClick={() => toggleRTGSCase(item)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggleRTGSCase(item);
          }
        }}
      >
        <div className="rtgs-case-topline">
          <span className={`rtgs-case-select ${checked ? 'checked' : ''}`} aria-hidden="true"><span /></span>
          <strong>{item.transaction_id}</strong>
          <span className={`rtgs-age-badge ${checked ? 'selected-state' : ''}`}>
            {checked ? <FiCheckCircle /> : <FiClock />}
            {checked ? `Selected / ${item.age_hours.toFixed(1)}h` : `${item.age_hours.toFixed(1)}h`}
          </span>
        </div>
        <div className="rtgs-case-main">
          <div className="rtgs-case-status">
            <span className={`rtgs-case-state tone-${rtgsCaseTone(item)}`}>{rtgsRecommendationLabel(item)}</span>
            <span className="rtgs-case-recommendation">{item.status}</span>
          </div>
          <time className="rtgs-case-date" dateTime={item.entry_date}><FiCalendar /> {formatRTGSEntryDate(item.entry_date)}</time>
          <div className="rtgs-case-facts">
            <span><small>Branch</small><strong>{item.branch_code || 'Unknown'}</strong></span>
            <span><small>Sequence</small><strong>{item.entry_sequence || 'Unknown'}</strong></span>
          </div>
          {item.warnings[0] && <em className="rtgs-case-note">{item.warnings[0]}</em>}
        </div>
      </article>
    );
  };

  const renderRTGSHistory = () => (
    <section className="trustlink-card rtgs-ledger-panel">
      <div className="rtgs-section-heading">
        <div>
          <span className="trustlink-card-kicker"><FiFileText /> Regeneration ledger</span>
          <h2>What changed, when, and by whom</h2>
          <p>Manual and automatic regenerations share one immutable operating record.</p>
        </div>
        <button className="trustlink-inline-btn" type="button" onClick={() => void loadRTGSControlData()}>
          <FiRefreshCcw /> Refresh
        </button>
      </div>
      {rtgsHistory.length ? (
        <div className="rtgs-ledger-list">
          {rtgsHistory.map((entry) => (
            <article className={`rtgs-ledger-row tone-${rtgsHistoryTone(entry.status)}`} key={entry.action_id}>
              <div className="rtgs-ledger-mark"><FiRefreshCcw /></div>
              <div className="rtgs-ledger-copy">
                <div><strong>{entry.transaction_id}</strong><span>{entry.mode === 'automatic' ? 'Automatic' : 'Operator'}</span></div>
                <p>{entry.message}</p>
                <small>{entry.reason}</small>
              </div>
              <div className="rtgs-ledger-meta">
                <span className={`trustlink-status-pill tone-${rtgsHistoryTone(entry.status)}`}>{entry.status}</span>
                <strong>{entry.requested_by}</strong>
                <time dateTime={entry.created_at}>{formatRTGSEntryDate(entry.created_at)}</time>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rtgs-ledger-empty"><FiFileText /><strong>No regeneration has been recorded.</strong><span>The first manual or automatic action will appear here.</span></div>
      )}
    </section>
  );

  const renderRTGSAutomation = () => (
    <div className="rtgs-automation-layout">
      <section className={`trustlink-card rtgs-auto-policy ${rtgsAutoPolicy?.enabled ? 'enabled' : 'disabled'}`}>
        <div className="rtgs-section-heading">
          <div>
            <span className="trustlink-card-kicker"><FiZap /> Automatic regeneration</span>
            <h2>Five-day recovery window</h2>
            <p>After each scheduled Oracle assessment, eligible IN_TRANSIT records from the latest five days use the same guarded regeneration path.</p>
          </div>
          {rtgsAutoPolicy ? (
            <button
              type="button"
              className={`rtgs-policy-switch ${rtgsAutoPolicy.enabled ? 'on' : ''}`}
              role="switch"
              aria-checked={rtgsAutoPolicy.enabled}
              onClick={() => void handleToggleAutoRegeneration()}
              disabled={!isAdmin || rtgsControlLoading}
              title={isAdmin ? 'Toggle automatic regeneration' : 'Only an administrator can change this policy'}
            >
              {rtgsAutoPolicy.enabled ? <FiToggleRight /> : <FiToggleLeft />}
              <span>{rtgsAutoPolicy.enabled ? 'On' : 'Off'}</span>
            </button>
          ) : (
            <span className="rtgs-policy-setup-state"><FiAlertTriangle /> Setup required</span>
          )}
        </div>
        {!rtgsAutoPolicy && (
          <div className="rtgs-policy-storage-alert">
            <FiDatabase />
            <div>
              <strong>Automation storage is not initialized</strong>
              <span>Apply <code>2026_07_add_nexus_rtgs_auto_regeneration.sql</code>, restart Nexus, then refresh this workspace.</span>
              {rtgsControlError && <small>{rtgsControlError}</small>}
            </div>
          </div>
        )}
        <div className="rtgs-five-day-window" aria-label="Latest five-day automatic regeneration window">
          {[4, 3, 2, 1, 0].map((daysAgo) => (
            <span key={daysAgo} className={daysAgo === 0 ? 'today' : ''}>
              <small>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</small>
              <i />
            </span>
          ))}
        </div>
        {rtgsAutoPolicy && <div className="rtgs-policy-foot">
          <span><FiShield /> Policy last changed by <strong>{rtgsAutoPolicy.updated_by || 'system'}</strong></span>
          <span>
            {rtgsAutoPolicy.last_run_at
              ? `Last cycle ${formatRTGSEntryDate(rtgsAutoPolicy.last_run_at)}: ${rtgsAutoPolicy.last_completed_count} completed of ${rtgsAutoPolicy.last_attempted_count} attempted.`
              : 'No automatic cycle has run yet.'}
          </span>
        </div>}
        {rtgsAutoPolicy && !isAdmin && <div className="rtgs-policy-readonly"><FiUserCheck /> Administrator control. This policy is read-only for your role.</div>}
      </section>

      <section className="trustlink-card rtgs-toggle-audit">
        <div className="rtgs-section-heading compact">
          <div>
            <span className="trustlink-card-kicker"><FiUserCheck /> Toggle audit</span>
            <h2>Policy custody</h2>
          </div>
        </div>
        {rtgsAutoAudit.length ? (
          <div className="rtgs-audit-list">
            {rtgsAutoAudit.map((entry) => (
              <article key={entry.audit_id}>
                <span className={`rtgs-audit-state ${entry.enabled ? 'enabled' : 'disabled'}`}>{entry.enabled ? 'Enabled' : 'Disabled'}</span>
                <div><strong>{entry.changed_by}</strong><time dateTime={entry.changed_at}>{formatRTGSEntryDate(entry.changed_at)}</time></div>
              </article>
            ))}
          </div>
        ) : rtgsAutoPolicy ? (
          <div className="rtgs-ledger-empty compact"><FiUserCheck /><strong>No toggle changes recorded.</strong></div>
        ) : (
          <div className="rtgs-ledger-empty compact"><FiDatabase /><strong>Audit storage is awaiting initialization.</strong></div>
        )}
      </section>
    </div>
  );

  const renderRTGSPanel = () => {
    const cases = rtgsAssessment?.cases || [];
    const selectedLaneCases = cases.filter((item) => item.age_lane === selectedRTGSLane);
    const olderDayMap = new Map<string, NexusRTGSTransactionCase[]>();
    if (selectedRTGSLane === 'OVER_96H') {
      selectedLaneCases.forEach((item) => {
        const key = rtgsDayKey(item.entry_date);
        olderDayMap.set(key, [...(olderDayMap.get(key) || []), item]);
      });
    }
    const olderDayGroups = Array.from(olderDayMap.entries())
      .map(([key, dayCases]) => ({ key, cases: dayCases, entryDate: dayCases[0]?.entry_date || key }))
      .sort((left, right) => new Date(right.entryDate).getTime() - new Date(left.entryDate).getTime());
    const activeDayKey = selectedRTGSDay && olderDayMap.has(selectedRTGSDay)
      ? selectedRTGSDay
      : olderDayGroups[0]?.key || null;
    const activeDayGroup = olderDayGroups.find((group) => group.key === activeDayKey);
    const scopedLaneCases = selectedRTGSLane === 'OVER_96H' ? activeDayGroup?.cases || [] : selectedLaneCases;
    const totalLanePages = Math.max(1, Math.ceil(scopedLaneCases.length / RTGS_LANE_PAGE_SIZE));
    const currentLanePage = Math.min(rtgsLanePage, totalLanePages);
    const visibleLaneCases = scopedLaneCases.slice(
      (currentLanePage - 1) * RTGS_LANE_PAGE_SIZE,
      currentLanePage * RTGS_LANE_PAGE_SIZE,
    );
    const totalDayPages = Math.max(1, Math.ceil(olderDayGroups.length / RTGS_DAY_NAV_PAGE_SIZE));
    const currentDayPage = Math.min(rtgsDayIndexPage, totalDayPages);
    const visibleDayGroups = olderDayGroups.slice(
      (currentDayPage - 1) * RTGS_DAY_NAV_PAGE_SIZE,
      currentDayPage * RTGS_DAY_NAV_PAGE_SIZE,
    );
    return (
      <div className="trustlink-tab-panel trustlink-rtgs-panel">
        <article className="trustlink-card rtgs-command-card">
          <div className="trustlink-card-header">
            <div>
              <span className="trustlink-card-kicker"><FiShield /> Payments recovery</span>
              <h2>RTGS in-transit control</h2>
              <p>Read the Oracle queue, isolate transactions still in transit, and regenerate only after an authenticated operator decision.</p>
            </div>
            <div className="rtgs-command-actions">
              <button className="trustlink-btn primary" type="button" onClick={() => void loadRTGS(true)} disabled={rtgsLoading}>
                <FiRefreshCcw /> {rtgsLoading ? 'Assessing' : 'Assess now'}
              </button>
            </div>
          </div>

          {rtgsAssessment && (
            <div className="rtgs-posture-grid">
              <article className="rtgs-posture database">
                <span>Database read</span>
                <strong>Complete</strong>
                <small>{rtgsAssessment.transaction_count} IN_TRANSIT records found</small>
              </article>
              <article className="rtgs-posture assessed">
                <span>Regeneration gate</span>
                <strong>Oracle package</strong>
                <small>Revalidates the transaction before mutation</small>
              </article>
            </div>
          )}
          <div className="rtgs-cadence-strip">
            <div>
              <span className="trustlink-card-kicker">Periodic assessment</span>
              <strong>Check RTGS every</strong>
              <small>Read-only checks keep the recovery queue current without fixed time checkpoints.</small>
            </div>
            <div className="rtgs-cadence-options" role="group" aria-label="RTGS assessment cadence">
              {([30, 60] as const).map((interval) => (
                <button
                  key={interval}
                  type="button"
                  className={scheduleInterval === interval ? 'active' : ''}
                  onClick={() => void handleSetRTGSCadence(interval)}
                >
                  {interval === 30 ? '30 minutes' : '1 hour'}
                </button>
              ))}
            </div>
          </div>
          {rtgsActionMessage && <div className="trustlink-error rtgs-feedback"><FiAlertTriangle /><span>{rtgsActionMessage}</span></div>}
        </article>

        <nav className="rtgs-workspace-switch" aria-label="RTGS recovery workspace">
          {([
            ['queue', 'Recovery queue', <FiLayers />],
            ['history', 'Regeneration history', <FiFileText />],
            ['automation', 'Automation & audit', <FiZap />],
          ] as Array<[RTGSWorkspaceView, string, React.ReactNode]>).map(([view, label, icon]) => (
            <button key={view} type="button" className={rtgsWorkspaceView === view ? 'active' : ''} onClick={() => setRtgsWorkspaceView(view)}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>

        {rtgsWorkspaceView === 'queue' && !rtgsAssessment && !rtgsLoading && (
          <article className="trustlink-empty-state rtgs-empty-state">
            <span className="trustlink-empty-icon"><FiTarget /></span>
            <h2>RTGS evidence is waiting for its first read</h2>
            <p>{rtgsActionMessage || 'The read-only Oracle assessment will list every current IN_TRANSIT transaction newest first.'}</p>
            <button className="trustlink-btn primary" type="button" onClick={() => void loadRTGS(true)}><FiPlay /> Start assessment</button>
          </article>
        )}

        {rtgsWorkspaceView === 'queue' && rtgsAssessment && (
          <>
            <article className="trustlink-card rtgs-interpretation">
              <span className="trustlink-card-kicker">Assessment interpretation</span>
              <p>{rtgsAssessment.interpretation || rtgsAssessment.message}</p>
            </article>
            <section className="rtgs-action-rail">
              <div>
                <span className="trustlink-card-kicker">Regeneration gate</span>
                <strong>{selectedRTGSIds.length ? `${selectedRTGSIds.length} selected` : 'Select transactions below'}</strong>
              </div>
              <input value={rtgsReason} onChange={(event) => setRtgsReason(event.target.value)} placeholder="Reason or change reference" aria-label="RTGS action reason" />
              <button className="trustlink-btn primary" type="button" onClick={() => void handleRTGSAction()} disabled={rtgsActionLoading || !selectedRTGSIds.length}>
                <FiRefreshCcw /> {rtgsActionLoading ? 'Regenerating' : 'Regenerate selected'}
              </button>
            </section>

            <div className="rtgs-lane-grid">
              <section className={`rtgs-lane rtgs-lane-${selectedRTGSLane.toLowerCase()}`}>
                    <div className="rtgs-lane-heading">
                      <div><span className="trustlink-card-kicker">Selected age lane</span><h3>{RTGS_LANE_LABELS[selectedRTGSLane]}</h3></div>
                      <div className="rtgs-lane-heading-actions">
                        <button type="button" className="rtgs-select-all-btn" onClick={() => toggleRTGSGroup(selectedLaneCases)} disabled={!selectedLaneCases.some((item) => item.regeneration_ready)}>
                          <FiCheckSquare /> {isRTGSGroupSelected(selectedLaneCases) ? 'Clear lane' : 'Select lane'}
                        </button>
                        <span className="rtgs-lane-total">{selectedLaneCases.length}</span>
                      </div>
                    </div>
                    {selectedLaneCases.length ? (
                      <>
                      {selectedRTGSLane === 'OVER_96H' && (
                        <div className="rtgs-day-index">
                          <div className="rtgs-day-index-heading">
                            <div><span className="trustlink-card-kicker">Daily bands</span><strong>Open one operating day</strong></div>
                            {totalDayPages > 1 && <span>{currentDayPage} / {totalDayPages}</span>}
                          </div>
                          <div className="rtgs-day-bands">
                            {visibleDayGroups.map((group) => (
                              <button
                                key={group.key}
                                type="button"
                                className={activeDayKey === group.key ? 'active' : ''}
                                onClick={() => { setSelectedRTGSDay(group.key); setRtgsLanePage(1); }}
                              >
                                <FiCalendar />
                                <span><strong>{formatRTGSDayLabel(group.entryDate)}</strong><small>{group.cases.length} transaction{group.cases.length === 1 ? '' : 's'}</small></span>
                              </button>
                            ))}
                          </div>
                          {totalDayPages > 1 && (
                            <div className="rtgs-day-pager">
                              <button type="button" onClick={() => {
                                const page = Math.max(1, currentDayPage - 1);
                                setRtgsDayIndexPage(page);
                                setSelectedRTGSDay(olderDayGroups[(page - 1) * RTGS_DAY_NAV_PAGE_SIZE]?.key || null);
                                setRtgsLanePage(1);
                              }} disabled={currentDayPage === 1}><FiChevronLeft /> Newer dates</button>
                              <button type="button" onClick={() => {
                                const page = Math.min(totalDayPages, currentDayPage + 1);
                                setRtgsDayIndexPage(page);
                                setSelectedRTGSDay(olderDayGroups[(page - 1) * RTGS_DAY_NAV_PAGE_SIZE]?.key || null);
                                setRtgsLanePage(1);
                              }} disabled={currentDayPage === totalDayPages}>Older dates <FiChevronRight /></button>
                            </div>
                          )}
                        </div>
                      )}
                      {activeDayGroup && (
                        <div className="rtgs-day-group-heading">
                          <div><span>Open date</span><strong>{formatRTGSDayLabel(activeDayGroup.entryDate)}</strong></div>
                          <button type="button" className="rtgs-select-all-btn" onClick={() => toggleRTGSGroup(activeDayGroup.cases)} disabled={!activeDayGroup.cases.some((item) => item.regeneration_ready)}>
                            <FiCheckSquare /> {isRTGSGroupSelected(activeDayGroup.cases) ? 'Clear day' : 'Select day'}
                          </button>
                        </div>
                      )}
                      <div className="rtgs-case-list">
                        {visibleLaneCases.map(renderRTGSCaseCard)}
                      </div>
                      <div className="rtgs-lane-pagination">
                        <span>
                          Showing {(currentLanePage - 1) * RTGS_LANE_PAGE_SIZE + 1}-{Math.min(currentLanePage * RTGS_LANE_PAGE_SIZE, scopedLaneCases.length)} of {scopedLaneCases.length}
                        </span>
                        <div>
                          <button type="button" className="trustlink-inline-btn" onClick={() => setRtgsLanePage((page) => Math.max(1, page - 1))} disabled={currentLanePage === 1}>
                            <FiChevronLeft /> Previous
                          </button>
                          <strong>Page {currentLanePage} / {totalLanePages}</strong>
                          <button type="button" className="trustlink-inline-btn" onClick={() => setRtgsLanePage((page) => Math.min(totalLanePages, page + 1))} disabled={currentLanePage === totalLanePages}>
                            Next <FiChevronRight />
                          </button>
                        </div>
                      </div>
                      </>
                    ) : (
                      <div className="rtgs-lane-empty">No transactions in this age range.</div>
                    )}
                  </section>
            </div>
          </>
        )}
        {rtgsWorkspaceView === 'history' && renderRTGSHistory()}
        {rtgsWorkspaceView === 'automation' && renderRTGSAutomation()}
      </div>
    );
  };

  const renderPipelineNodes = (items: PipelineTimelineItem[]) => (
    <div className="trustlink-pipeline-map">
      {items.map((item) => (
        <article key={item.id} className={`trustlink-pipeline-node tone-${item.tone}`}>
          <span className="pipeline-node-index">{item.order}</span>
          <div>
            <h3>{item.title}</h3>
            <p>{item.detail}</p>
          </div>
          <span className={`trustlink-status-pill tone-${item.tone}`}>{item.status}</span>
          <div className="pipeline-node-metrics">
            <span>{item.rows} rows</span>
            <span>{item.duration}</span>
            <span>{item.meta}</span>
          </div>
        </article>
      ))}
    </div>
  );

  const renderProgressStages = (items: PipelineTimelineItem[]) => (
    <div className="trustlink-progress-stages">
      {items.map((item) => {
        const progress = item.statusKey === 'completed'
          ? 100
          : item.statusKey === 'running'
            ? 58
            : item.statusKey === 'failed'
              ? 100
              : 0;
        return (
          <article key={item.id} className={`trustlink-progress-stage tone-${item.tone}`}>
            <div className="trustlink-progress-stage-head">
              <span className="pipeline-node-index">{item.order}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.status}</small>
              </div>
              <span className="trustlink-progress-percent">{progress}%</span>
            </div>
            <div className="trustlink-progress-track" aria-label={`${item.title} progress`}>
              <span className="trustlink-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>{item.statusKey === 'running' ? 'Processing current source data...' : item.statusKey === 'completed' ? 'Stage evidence recorded.' : item.statusKey === 'failed' ? 'Stage requires operator review.' : 'Waiting for the previous stage.'}</p>
          </article>
        );
      })}
    </div>
  );

  if (initialLoading) {
    return <TrustlinkOperationsPreview />;
  }

  const inspectorTimeline = buildPipelineTimeline(inspectorRun, inspectorSteps, inspectorRun?.file_present);
  const rtgsStatus = rtgsLoading ? 'assessing' : rtgsAssessment?.status || 'awaiting read';
  const rtgsStatusTone = rtgsLoading ? 'running' : normalizeVisualStatus(rtgsAssessment?.status || 'pending');

  return (
    <div className="trustlink-page">
      <section className={`trustlink-command-strip workspace-${activeWorkspace}`}>
        <div className="trustlink-command-title">
          <span>
            <FiShield />
            TrustLink operations
          </span>
          <strong>{activeWorkspace === 'extraction' ? 'Account delivery' : 'RTGS recovery'}</strong>
          <small>
            {activeWorkspace === 'extraction'
              ? displayRun
                ? `${formatRunDate(displayRun.run_date)} / ${formatRunType(displayRun.run_type)} / ${formatDuration(totalDuration)}`
                : 'Extraction console ready'
              : rtgsAssessment
                ? `${rtgsAssessment.transaction_count} current IN_TRANSIT records / assessed ${formatRTGSEntryDate(rtgsAssessment.assessed_at)}`
                : 'Oracle assessment ready'}
          </small>
        </div>
        <div className="trustlink-command-brief">
          <span className={`trustlink-status-pill tone-${activeWorkspace === 'extraction' ? currentStatusTone : rtgsStatusTone}`}>
            {activeWorkspace === 'extraction' ? prettyStatus(currentStatus) : prettyStatus(rtgsStatus)}
          </span>
          <small>{activeWorkspace === 'extraction' ? `${liveLabel}${refreshing ? ' / syncing' : ''}` : `Assessment every ${scheduleInterval} minutes`}</small>
        </div>
      </section>

      <nav className="trustlink-workspace-nav" aria-label="TrustLink workspaces">
        <span className="trustlink-workspace-label">Workspaces</span>
        <button
          type="button"
          className={activeWorkspace === 'extraction' ? 'active' : ''}
          aria-current={activeWorkspace === 'extraction' ? 'page' : undefined}
          onClick={() => setActiveTab('pipeline')}
        >
          <small>01</small>
          <FiLayers />
          <strong>Account extraction</strong>
        </button>
        <button
          type="button"
          className={activeWorkspace === 'rtgs' ? 'active' : ''}
          aria-current={activeWorkspace === 'rtgs' ? 'page' : undefined}
          onClick={() => setActiveTab('rtgs')}
        >
          <small>02</small>
          <FiShield />
          <strong>RTGS recovery</strong>
        </button>
        <span className="trustlink-workspace-rule" aria-hidden="true" />
      </nav>

      {error && (
        <div className="trustlink-error">
          <FiAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      <section className={`trustlink-layout workspace-${activeWorkspace} ${activeTab === 'history' ? 'full-width' : ''}`}>
        {activeWorkspace === 'extraction' ? (
          <div className="trustlink-board-panel">
            <div className="trustlink-panel-head">
              <div>
                <span className="trustlink-panel-kicker"><FiLayers /> Extraction board</span>
                <h2>Daily TrustLink run control</h2>
                <p>Run and verify the account delivery path. Detailed evidence opens only inside run inspection.</p>
              </div>
              <div className="trustlink-panel-meta">
                <span className={`trustlink-status-pill tone-${liveTone}`}>{liveLabel}</span>
                {actionLoading && actionLabel && <span className="action-label">{actionLabel}</span>}
              </div>
            </div>

            <div className="trustlink-command-actions">
              <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}><FiPlay /> Run Extraction</button>
              <button className="trustlink-btn secondary" onClick={() => void hydrate()} disabled={actionLoading}><FiRefreshCcw /> Refresh</button>
              {displayRun?.file_present && displayRun.id && (
                <button className="trustlink-btn ghost" onClick={() => void handleDownload(displayRun.id, displayRun.file_name)} disabled={actionLoading}><FiArrowDownCircle /> Download Export</button>
              )}
              <button className="trustlink-btn danger" onClick={() => setShowOverwriteWarning(true)} disabled={actionLoading}><FiZap /> Overwrite</button>
            </div>

            {!hasRunData ? (
              <section className="trustlink-empty-state">
                <span className="trustlink-empty-icon"><FiDatabase /></span>
                <h2>No TrustLink run is available yet</h2>
                <p>The account delivery surface is ready for its first extraction.</p>
                <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}><FiPlay /> Trigger First Run</button>
              </section>
            ) : (
              <section className="trustlink-tabs-shell">
                <div className="trustlink-tabs extraction-tabs" role="tablist" aria-label="Account extraction sections">
                  {EXTRACTION_TABS.map((tab) => (
                    <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={`trustlink-tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                      {tab.icon}<span>{tab.label}</span>
                    </button>
                  ))}
                </div>

                {activeTab === 'pipeline' && (
                  <div className="trustlink-tab-panel trustlink-pipeline-panel">
                    <article className="trustlink-card trustlink-card-wide extraction-live-card">
                      <div className="trustlink-card-header">
                        <div><span className="trustlink-card-kicker">Live extraction</span><h2>Account delivery pipeline</h2></div>
                        <span className="trustlink-chip">{completionCount} of {PIPELINE_ORDER.length} stages</span>
                      </div>
                      <div className={`trustlink-today-marker tone-${deadlineReadiness.tone}`}>
                        <span><FiActivity /> Today</span>
                        <strong>{deadlineReadiness.label}</strong>
                        <small>{todayStatus?.run?.completed_at ? `Delivered ${formatDateTime(todayStatus.run.completed_at)}` : todayStatus?.run ? 'Current run is in the delivery path' : 'No extraction has started today'}</small>
                      </div>
                      {renderProgressStages(timeline)}
                    </article>

                    <article className="trustlink-card latest-run-card">
                      <div className="trustlink-card-header">
                        <div><span className="trustlink-card-kicker">Latest run</span><h2>{displayRun ? formatRunDate(displayRun.run_date) : 'No run selected'}</h2></div>
                        <span className={`trustlink-status-pill tone-${currentStatusTone}`}>{prettyStatus(currentStatus)}</span>
                      </div>
                      <div className="trustlink-latest-run-brief">
                        <p>{displayRun?.completed_at ? `Delivered ${formatDateTime(displayRun.completed_at)}.` : 'The latest run is still moving through the delivery path.'}</p>
                        <span>{prettyFileStatus(displayRun?.file_status)}</span>
                      </div>
                      <div className="trustlink-card-actions">
                        {displayRun && <button type="button" className="trustlink-inline-btn" onClick={() => void openRunInspector(displayRun.id)}><FiEye /> Inspect run</button>}
                        {displayRun?.file_present && <button type="button" className="trustlink-inline-btn" onClick={() => void handleDownload(displayRun.id, displayRun.file_name)}><FiArrowDownCircle /> Download</button>}
                      </div>
                    </article>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="trustlink-tab-panel">
                    <section className="trustlink-history">
                      <div className="trustlink-card-header">
                        <div><span className="trustlink-card-kicker">Run history</span><h2>Delivery record</h2></div>
                        <span className="trustlink-chip">Latest first</span>
                      </div>
                      <div className="trustlink-history-list">
                        {runs.map((run) => {
                          const tone = normalizeVisualStatus(run.status);
                          const isSelected = displayRun?.id === run.id;
                          return (
                            <article
                              key={run.id}
                              className={`trustlink-history-item ${isSelected ? 'selected' : ''}`}
                              onClick={() => void openRunInspector(run.id)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault();
                                  void openRunInspector(run.id);
                                }
                              }}
                            >
                              <div className="history-item-topline">
                                <div><h3>{formatRunDate(run.run_date)}</h3><p>{run.id}</p></div>
                                <span className={`trustlink-status-pill tone-${tone}`}>{prettyStatus(run.status)}</span>
                              </div>
                              <div className="history-item-metrics compact">
                                <span>{formatRunType(run.run_type)}</span>
                                <span>{prettyFileStatus(run.file_status)}</span>
                                <span>{formatDateTime(run.completed_at || run.started_at)}</span>
                              </div>
                              <div className="history-item-actions">
                                <button className="trustlink-inline-btn" onClick={(event) => { event.stopPropagation(); void openRunInspector(run.id); }} disabled={inspectorLoading}><FiEye /> Inspect run</button>
                                {run.file_present && <button className="trustlink-inline-btn" onClick={(event) => { event.stopPropagation(); void handleDownload(run.id, run.file_name); }}><FiArrowDownCircle /> Download</button>}
                                {canDeleteRunFile(run, runs) && <button className="trustlink-inline-btn danger" onClick={(event) => { event.stopPropagation(); setPendingFileDeleteRun(run); }}>Delete file</button>}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  </div>
                )}
              </section>
            )}
          </div>
        ) : (
          <div className="trustlink-rtgs-workspace">{renderRTGSPanel()}</div>
        )}

        {activeWorkspace === 'rtgs' ? renderRTGSLaneRail(rtgsAssessment?.cases || []) : activeTab === 'pipeline' ? (
          <aside className="trustlink-side-rail extraction-side-rail">
            <article className="trustlink-side-card cadence-card">
              <div className="trustlink-panel-head compact">
                <div><span className="trustlink-panel-kicker"><FiActivity /> Today</span><h3>{todayStatus?.run ? formatRunDate(todayStatus.run.run_date) : 'Awaiting delivery'}</h3></div>
                <span className={`trustlink-status-pill tone-${deadlineReadiness.tone}`}>{deadlineReadiness.label}</span>
              </div>
              <p className="trustlink-side-copy">Today&apos;s state stays visible here. Run evidence and diagnostic timings remain in inspection.</p>
              <div className="trustlink-file-line"><FiFileText /><span>{displayRun?.file_present ? displayRun.file_name || 'Export available' : 'No export file recorded'}</span></div>
              {displayRun && <button type="button" className="trustlink-inline-btn full" onClick={() => void openRunInspector(displayRun.id)}><FiEye /> Inspect latest run</button>}
            </article>
          </aside>
        ) : null}
      </section>

      <PageGuide guide={pageGuides.trustlinkOperations} />

      {showInspector && (
        <div className="trustlink-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trustlink-inspector-title">
          <div className="trustlink-modal inspector">
            <div className="trustlink-modal-header inspector-header">
              <span className="trustlink-modal-icon">
                <FiEye />
              </span>
              <div>
                <span className="trustlink-card-kicker">Run Inspector</span>
                <h3 id="trustlink-inspector-title">{inspectorRun ? formatRunDate(inspectorRun.run_date) : 'Loading run'}</h3>
              </div>
              <button type="button" className="trustlink-icon-btn" onClick={closeInspector} aria-label="Close inspector">
                <FiX />
              </button>
            </div>

            {inspectorLoading ? (
              <div className="trustlink-inspector-loading">
                <div className="skeleton skeleton-row" />
                <div className="skeleton skeleton-stack" />
                <div className="skeleton skeleton-stack" />
              </div>
            ) : inspectorRun ? (
              <>
                <div className="trustlink-inspector-summary">
                  <article>
                    <span>Status</span>
                    <strong>{prettyStatus(inspectorRun.status)}</strong>
                  </article>
                  <article>
                    <span>Rows</span>
                    <strong>{formatNumber(inspectorRun.total_rows)}</strong>
                  </article>
                  <article>
                    <span>Delivery duration</span>
                    <strong>{formatDuration(getRunDurationMs(inspectorRun))}</strong>
                  </article>
                  <article>
                    <span>File</span>
                    <strong>{prettyFileStatus(inspectorRun.file_status)}</strong>
                  </article>
                </div>

                <div className="trustlink-inspector-grid">
                  <section className="trustlink-inspector-section">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Pipeline Trace</span>
                        <h4>Step ledger</h4>
                      </div>
                    </div>
                    {renderPipelineNodes(inspectorTimeline)}
                  </section>

                  <section className="trustlink-inspector-section">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Evidence Details</span>
                        <h4>Run metadata</h4>
                      </div>
                    </div>
                    <div className="trustlink-data-grid">
                      {renderDataPoint('Run ID', inspectorRun.id, true)}
                      {renderDataPoint('Started', formatDateTime(inspectorRun.started_at))}
                      {renderDataPoint('Completed', formatDateTime(inspectorRun.completed_at))}
                      {renderDataPoint('IDC Rows', formatNumber(inspectorRun.idc_rows))}
                      {renderDataPoint('DigiPay Rows', formatNumber(inspectorRun.digipay_rows))}
                      {renderDataPoint('Export File', inspectorRun.file_name || 'No file recorded', true)}
                      {renderDataPoint('Integrity Hash', inspectorRun.file_hash || '-', true)}
                    </div>
                  </section>
                </div>

                <div className="trustlink-modal-footer">
                  {inspectorRun.file_present && (
                    <button className="trustlink-btn ghost" onClick={() => void handleDownload(inspectorRun.id, inspectorRun.file_name)} disabled={actionLoading}>
                      <FiArrowDownCircle />
                      Download Export
                    </button>
                  )}
                  <button className="trustlink-btn secondary" onClick={closeInspector}>
                    Close
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {showOverwriteWarning && (
        <div className="trustlink-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trustlink-overwrite-title">
          <div className="trustlink-modal warning">
            <div className="trustlink-modal-header">
              <span className="trustlink-modal-icon">
                <FiAlertTriangle />
              </span>
              <div>
                <span className="trustlink-card-kicker">Critical Command</span>
                <h3 id="trustlink-overwrite-title">Overwrite today&apos;s extraction?</h3>
              </div>
            </div>

            <p className="trustlink-modal-copy">
              You are about to replace today&apos;s TrustLink extraction with a fresh run. This command preserves the audit row,
              clears the previous pipeline steps, removes the currently saved export file, and regenerates today&apos;s output from source systems.
            </p>

            <div className="trustlink-warning-grid">
              <article className="trustlink-warning-card">
                <span><FiArrowDownCircle /> Export impact</span>
                <strong>The current saved file will be removed and replaced by the new extraction output.</strong>
              </article>
              <article className="trustlink-warning-card">
                <span><FiRefreshCcw /> Pipeline impact</span>
                <strong>Today&apos;s step history will reset for the rerun and live status will reflect the new execution path.</strong>
              </article>
              <article className="trustlink-warning-card">
                <span><FiCheckCircle /> Audit impact</span>
                <strong>The run record remains tracked, but its file evidence and step results are refreshed with the new extraction.</strong>
              </article>
            </div>

            <div className="trustlink-modal-footer">
              <button className="trustlink-btn secondary" onClick={() => setShowOverwriteWarning(false)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="trustlink-btn danger" onClick={() => void confirmOverwrite()} disabled={actionLoading}>
                <FiZap />
                Confirm Overwrite
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingFileDeleteRun && (
        <div className="trustlink-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trustlink-delete-file-title">
          <div className="trustlink-modal warning delete-file">
            <div className="trustlink-modal-header">
              <span className="trustlink-modal-icon">
                <FiAlertTriangle />
              </span>
              <div>
                <span className="trustlink-card-kicker">File Deletion Warning</span>
                <h3 id="trustlink-delete-file-title">Delete saved TrustLink export?</h3>
              </div>
            </div>

            <p className="trustlink-modal-copy">
              You are about to permanently remove the saved export file for this run from server storage. The TrustLink audit run,
              timings, row counts, trigger details, and notification history will remain intact, but the file will no longer be downloadable.
            </p>

            <div className="trustlink-warning-grid">
              <article className="trustlink-warning-card">
                <span><FiArrowDownCircle /> File impact</span>
                <strong>{pendingFileDeleteRun.file_name || 'The saved export'} will be removed from the TrustLink storage directory.</strong>
              </article>
              <article className="trustlink-warning-card">
                <span><FiShield /> Audit impact</span>
                <strong>The run record remains visible with its metadata, but file presence will update to Deleted.</strong>
              </article>
              <article className="trustlink-warning-card">
                <span><FiClock /> Safety gate</span>
                <strong>Deletion is allowed only when this file is at least two days old and a newer export exists.</strong>
              </article>
            </div>

            <div className="trustlink-modal-footer">
              <button className="trustlink-btn secondary" onClick={() => setPendingFileDeleteRun(null)} disabled={actionLoading}>
                Cancel
              </button>
              <button className="trustlink-btn danger" onClick={() => void confirmDeleteFile()} disabled={actionLoading}>
                <FiAlertTriangle />
                Confirm File Deletion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrustlinkOperationsPage;
