import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownCircle,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiEye,
  FiFileText,
  FiLayers,
  FiPlay,
  FiRefreshCcw,
  FiShield,
  FiTarget,
  FiX,
  FiZap,
} from 'react-icons/fi';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import centralizedWebSocketManager from '../services/centralizedWebSocketManager';
import trustlinkApi, {
  TrustlinkRunDetail,
  TrustlinkRunListItem,
  TrustlinkStep,
  TrustlinkTodayStatusResponse,
} from '../services/trustlinkApi';
import './TrustlinkOperationsPage.css';

type PipelineStageName = TrustlinkStep['step_name'] | 'DOWNLOAD';
type TrustlinkTab = 'pipeline' | 'today' | 'evidence' | 'history';
type LiveConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'offline';

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

const TRUSTLINK_DEADLINE_HOUR = 7;
const FILE_RETENTION_DAYS = 2;

const TABS: Array<{ id: TrustlinkTab; label: string; icon: React.ReactNode }> = [
  { id: 'pipeline', label: 'Pipeline', icon: <FiLayers /> },
  { id: 'today', label: "Today's Run", icon: <FiActivity /> },
  { id: 'evidence', label: 'Evidence', icon: <FiShield /> },
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
      <div className="trustlink-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="trustlink-skel-signal-card">
            <div className="trustlink-skel-block trustlink-skel-icon" />
            <div className="trustlink-skel-signal-copy">
              <div className="trustlink-skel-line trustlink-skel-label" />
              <div className="trustlink-skel-line trustlink-skel-value" />
              <div className="trustlink-skel-line trustlink-skel-meta" />
            </div>
          </article>
        ))}
      </div>
    </section>

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
  const message = typeof error === 'object' && error !== null && 'response' in error
    ? String((error as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.detail
      || (error as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.message
      || '')
    : '';

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

const TrustlinkOperationsPage: React.FC = () => {
  const [nowTick, setNowTick] = useState(() => new Date());
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

  const displayRun = selectedRun || todayStatus?.run || null;
  const selectedRunId = displayRun?.id || null;

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

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

  const totalRows = displayRun?.total_rows ?? 0;
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

  const scheduleTelemetry = useMemo(() => {
    const now = nowTick;
    const deadlineToday = new Date(now);
    deadlineToday.setHours(TRUSTLINK_DEADLINE_HOUR, 0, 0, 0);
    const previousDeadline = now >= deadlineToday
      ? deadlineToday
      : new Date(deadlineToday.getTime() - 24 * 60 * 60 * 1000);
    const nextDeadline = now >= deadlineToday
      ? new Date(deadlineToday.getTime() + 24 * 60 * 60 * 1000)
      : deadlineToday;

    const cycleMs = nextDeadline.getTime() - previousDeadline.getTime();
    const elapsed = now.getTime() - previousDeadline.getTime();
    const cycleProgress = Math.max(0, Math.min(100, Math.round((elapsed / cycleMs) * 100)));

    const msUntilNext = Math.max(0, nextDeadline.getTime() - now.getTime());
    const hoursUntil = Math.floor(msUntilNext / 3_600_000);
    const minsUntil = Math.floor((msUntilNext % 3_600_000) / 60_000);

    return {
      nextDeadline,
      previousDeadline,
      cycleProgress,
      countdown: `${hoursUntil}h ${minsUntil}m`,
    };
  }, [nowTick]);

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

  const pipelineTone = completionCount === PIPELINE_ORDER.length
    ? 'success'
    : currentStatusTone === 'failed'
      ? 'failed'
      : currentStatusTone === 'running'
        ? 'running'
        : 'warning';
  const exportTone = displayRun?.file_present
    ? 'success'
    : displayRun?.file_status === 'deleted'
      ? 'warning'
      : currentStatusTone === 'failed'
        ? 'failed'
        : 'pending';
  const trustlinkSignals = [
    {
      label: 'Pipeline',
      value: `${completionCount}/${PIPELINE_ORDER.length}`,
      helper: currentStatus === 'none' ? 'No run selected' : prettyStatus(currentStatus),
      icon: <FiTarget />,
      tone: pipelineTone,
    },
    {
      label: 'Rows',
      value: formatNumber(totalRows),
      helper: `${formatNumber(displayRun?.idc_rows)} IDC / ${formatNumber(displayRun?.digipay_rows)} DigiPay`,
      icon: <FiDatabase />,
      tone: totalRows > 0 ? 'success' : 'pending',
    },
    {
      label: 'Export',
      value: displayRun?.file_present ? 'Ready' : prettyFileStatus(displayRun?.file_status),
      helper: displayRun?.file_name || 'No export file',
      icon: <FiFileText />,
      tone: exportTone,
    },
    {
      label: 'Realtime',
      value: liveConnectionState,
      helper: refreshing ? 'Synchronizing live state' : liveLabel,
      icon: <FiZap />,
      tone: liveTone,
    },
  ];
  const recentRuns = runs.slice(0, 5);

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

  const selectRun = async (runId: string, nextTab?: TrustlinkTab) => {
    setActionLoading(true);
    setActionLabel('Loading run intelligence');
    setError(null);

    try {
      await loadRun(runId);
      if (nextTab) setActiveTab(nextTab);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
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

  if (initialLoading) {
    return <TrustlinkOperationsPreview />;
  }

  const inspectorTimeline = buildPipelineTimeline(inspectorRun, inspectorSteps, inspectorRun?.file_present);

  return (
    <div className="trustlink-page">
      <section className="trustlink-command-strip">
        <div className="trustlink-command-title">
          <span>
            <FiShield />
            TrustLink command
          </span>
          <strong>{prettyStatus(currentStatus)}</strong>
          <small>
            {displayRun
              ? `${formatRunDate(displayRun.run_date)} / ${formatRunType(displayRun.run_type)} / ${formatDuration(totalDuration)}`
              : 'Extraction console ready'}
          </small>
        </div>

        <div className="trustlink-signal-grid">
          {trustlinkSignals.map((signal) => (
            <article key={signal.label} className={`trustlink-signal-card tone-${signal.tone}`}>
              <span className="trustlink-signal-icon">{signal.icon}</span>
              <div className="trustlink-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.helper}</em>
              </div>
            </article>
          ))}
        </div>
      </section>

      {error && (
        <div className="trustlink-error">
          <FiAlertTriangle />
          <span>{error}</span>
        </div>
      )}

      <section className="trustlink-layout">
        <div className="trustlink-board-panel">
          <div className="trustlink-panel-head">
            <div>
              <span className="trustlink-panel-kicker">
                <FiLayers />
                Extraction board
              </span>
              <h2>Daily TrustLink run control</h2>
              <p>Run, verify, export, and inspect the account delivery path from source extraction to file evidence.</p>
            </div>
            <div className="trustlink-panel-meta">
              <span className={`trustlink-status-pill tone-${liveTone}`}>
                {liveLabel}
              </span>
              {actionLoading && actionLabel && <span className="action-label">{actionLabel}</span>}
            </div>
          </div>

          <div className="trustlink-command-actions">
            <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}>
              <FiPlay />
              Run Extraction
            </button>
            <button className="trustlink-btn secondary" onClick={() => void hydrate()} disabled={actionLoading}>
              <FiRefreshCcw />
              Refresh
            </button>
            {displayRun?.file_present && displayRun.id && (
              <button className="trustlink-btn ghost" onClick={() => void handleDownload(displayRun.id, displayRun.file_name)} disabled={actionLoading}>
                <FiArrowDownCircle />
                Download Export
              </button>
            )}
            <button className="trustlink-btn danger" onClick={() => setShowOverwriteWarning(true)} disabled={actionLoading}>
              <FiZap />
              Overwrite
            </button>
          </div>

          {!hasRunData ? (
            <section className="trustlink-empty-state">
              <span className="trustlink-empty-icon"><FiDatabase /></span>
              <h2>No TrustLink run is available yet</h2>
              <p>The command surface is ready, but no extraction run has been returned by the active backend yet.</p>
              <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}>
                <FiPlay />
                Trigger First Run
              </button>
            </section>
          ) : (
            <section className="trustlink-tabs-shell">
              <div className="trustlink-tabs" role="tablist" aria-label="TrustLink operations sections">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    className={`trustlink-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === 'pipeline' && (
                <div className="trustlink-tab-panel trustlink-pipeline-panel">
                  <article className="trustlink-card trustlink-card-wide">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Pipeline visualization</span>
                        <h2>Extraction path</h2>
                      </div>
                      <span className="trustlink-chip">
                        {completionCount} of {PIPELINE_ORDER.length} stages complete
                      </span>
                    </div>
                    {renderPipelineNodes(timeline)}
                  </article>

                  <article className="trustlink-card">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Live signal</span>
                        <h2>Run posture</h2>
                      </div>
                      <span className={`trustlink-status-pill tone-${currentStatusTone}`}>
                        {prettyStatus(currentStatus)}
                      </span>
                    </div>
                    <div className="trustlink-run-lattice">
                      {renderDataPoint('Selected run', displayRun?.id || '-')}
                      {renderDataPoint('Rows processed', formatNumber(displayRun?.total_rows))}
                      {renderDataPoint('Delivery duration', formatDuration(getRunDurationMs(displayRun)))}
                      {renderDataPoint('Completed', formatDateTime(displayRun?.completed_at))}
                    </div>
                  </article>
                </div>
              )}

              {activeTab === 'today' && (
                <div className="trustlink-tab-panel trustlink-today-panel">
                  <article className="trustlink-card trustlink-schedule-radar">
                    <div className="schedule-radar-head">
                      <div>
                        <span className="trustlink-card-kicker">Delivery cadence</span>
                        <h2>Daily 07:00 command deadline</h2>
                      </div>
                      <span className={`trustlink-status-pill tone-${deadlineReadiness.tone}`}>
                        {deadlineReadiness.label}
                      </span>
                    </div>

                    <div className="schedule-radar-grid">
                      <article className="schedule-radar-tile">
                        <span>Next deadline</span>
                        <strong>{formatDateTime(scheduleTelemetry.nextDeadline.toISOString())}</strong>
                        <small>{scheduleTelemetry.countdown} remaining</small>
                      </article>
                      <article className="schedule-radar-tile">
                        <span>Cadence cycle</span>
                        <strong>{scheduleTelemetry.cycleProgress}%</strong>
                        <small>From last 07:00 checkpoint</small>
                      </article>
                      <article className="schedule-radar-tile progress">
                        <span>Deadline progress</span>
                        <div className="schedule-progress-track">
                          <span className="schedule-progress-fill" style={{ width: `${scheduleTelemetry.cycleProgress}%` }} />
                        </div>
                        <small>{formatDateTime(scheduleTelemetry.previousDeadline.toISOString())} to {formatDateTime(scheduleTelemetry.nextDeadline.toISOString())}</small>
                      </article>
                    </div>
                  </article>

                  <article className="trustlink-card">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Today</span>
                        <h2>Current run</h2>
                      </div>
                      <span className={`trustlink-status-pill tone-${currentStatusTone}`}>
                        {prettyStatus(todayStatus?.run?.status || todayStatus?.status)}
                      </span>
                    </div>

                    <div className="trustlink-data-grid">
                      {renderDataPoint('Run ID', todayStatus?.run?.id || '-', true)}
                      {renderDataPoint('Run Date', formatRunDate(todayStatus?.run?.run_date))}
                      {renderDataPoint('Run Type', formatRunType(todayStatus?.run?.run_type))}
                      {renderDataPoint('Triggered By', todayStatus?.run?.triggered_by_display || '-')}
                      {renderDataPoint('Started', formatDateTime(todayStatus?.run?.started_at))}
                      {renderDataPoint('Completed', formatDateTime(todayStatus?.run?.completed_at))}
                      {renderDataPoint('Delivery Duration', formatDuration(getRunDurationMs(todayStatus?.run)))}
                      {renderDataPoint('File Presence', prettyFileStatus(todayStatus?.run?.file_status))}
                    </div>
                  </article>
                </div>
              )}

              {activeTab === 'evidence' && (
                <div className="trustlink-tab-panel trustlink-evidence-panel">
                  <article className="trustlink-card trustlink-card-wide">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Evidence</span>
                        <h2>Selected run packet</h2>
                      </div>
                      {displayRun && (
                        <button
                          type="button"
                          className="trustlink-inline-btn"
                          onClick={() => void openRunInspector(displayRun.id)}
                        >
                          <FiEye /> Inspect run
                        </button>
                      )}
                    </div>

                    <div className="trustlink-data-grid evidence-grid">
                      {renderDataPoint('Total Rows', formatNumber(displayRun?.total_rows))}
                      {renderDataPoint('IDC Rows', formatNumber(displayRun?.idc_rows))}
                      {renderDataPoint('DigiPay Rows', formatNumber(displayRun?.digipay_rows))}
                      {renderDataPoint('Delivery Duration', formatDuration(getRunDurationMs(displayRun)))}
                      {renderDataPoint('Extract Time', formatDuration(displayRun?.extract_duration_ms))}
                      {renderDataPoint('Transform Time', formatDuration(displayRun?.transform_duration_ms))}
                      {renderDataPoint('Validation Time', formatDuration(displayRun?.validation_duration_ms))}
                      {renderDataPoint('Triggered By', displayRun?.triggered_by_display || '-', true)}
                      {renderDataPoint('Export File', displayRun?.file_name || 'No file recorded', true)}
                      {renderDataPoint('File Status', prettyFileStatus(displayRun?.file_status))}
                      {renderDataPoint('Run Type', formatRunType(displayRun?.run_type))}
                      {renderDataPoint('Integrity Hash', displayRun?.file_hash || '-', true)}
                      {renderDataPoint('Error Surface', displayRun?.error_message || 'No run error captured', true)}
                    </div>
                  </article>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="trustlink-tab-panel">
                  <section className="trustlink-history">
                    <div className="trustlink-card-header">
                      <div>
                        <span className="trustlink-card-kicker">Run history</span>
                        <h2>Audit trail</h2>
                      </div>
                      <span className="trustlink-chip">{runs.length} recorded runs</span>
                    </div>

                    <div className="trustlink-history-list">
                      {runs.map((run) => {
                        const tone = normalizeVisualStatus(run.status);
                        const isSelected = displayRun?.id === run.id;

                        return (
                          <article
                            key={run.id}
                            className={`trustlink-history-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => void selectRun(run.id, 'evidence')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                void selectRun(run.id, 'evidence');
                              }
                            }}
                          >
                            <div className="history-item-topline">
                              <div>
                                <h3>{formatRunDate(run.run_date)}</h3>
                                <p>{run.id}</p>
                              </div>
                              <span className={`trustlink-status-pill tone-${tone}`}>{prettyStatus(run.status)}</span>
                            </div>

                            <div className="history-item-metrics">
                              <span>{formatRunType(run.run_type)}</span>
                              <span>{formatNumber(run.total_rows)} rows</span>
                              <span>{formatDuration(getRunDurationMs(run))}</span>
                              <span>{run.triggered_by_display || 'Unknown trigger'}</span>
                              <span>{prettyFileStatus(run.file_status)}</span>
                              <span>{formatDateTime(run.completed_at || run.started_at)}</span>
                            </div>

                            <div className="history-item-actions">
                              <button
                                className="trustlink-inline-btn"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openRunInspector(run.id);
                                }}
                                disabled={inspectorLoading}
                              >
                                <FiEye /> Inspect run
                              </button>
                              {run.file_present && (
                                <button
                                  className="trustlink-inline-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDownload(run.id, run.file_name);
                                  }}
                                >
                                  <FiArrowDownCircle /> Download
                                </button>
                              )}
                              {canDeleteRunFile(run, runs) && (
                                <button
                                  className="trustlink-inline-btn danger"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setPendingFileDeleteRun(run);
                                  }}
                                >
                                  Delete file
                                </button>
                              )}
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

        <aside className="trustlink-side-rail">
          <article className="trustlink-side-card cadence-card">
            <div className="trustlink-panel-head compact">
              <div>
                <span className="trustlink-panel-kicker">
                  <FiClock />
                  Cadence
                </span>
                <h3>07:00 delivery window</h3>
              </div>
              <span className={`trustlink-status-pill tone-${deadlineReadiness.tone}`}>
                {deadlineReadiness.label}
              </span>
            </div>
            <div className="trustlink-cadence-readout">
              <strong>{scheduleTelemetry.countdown}</strong>
              <span>to next command deadline</span>
            </div>
            <div className="schedule-progress-track">
              <span className="schedule-progress-fill" style={{ width: `${scheduleTelemetry.cycleProgress}%` }} />
            </div>
            <div className="trustlink-mini-grid">
              {renderDataPoint('Next', formatDateTime(scheduleTelemetry.nextDeadline.toISOString()))}
              {renderDataPoint('Cycle', `${scheduleTelemetry.cycleProgress}%`)}
            </div>
          </article>

          <article className="trustlink-side-card">
            <div className="trustlink-panel-head compact">
              <div>
                <span className="trustlink-panel-kicker">
                  <FiShield />
                  Run packet
                </span>
                <h3>Selected evidence</h3>
              </div>
              <span className={`trustlink-status-pill tone-${currentStatusTone}`}>
                {prettyStatus(currentStatus)}
              </span>
            </div>
            <div className="trustlink-mini-grid">
              {renderDataPoint('Rows', formatNumber(displayRun?.total_rows))}
              {renderDataPoint('IDC', formatNumber(displayRun?.idc_rows))}
              {renderDataPoint('DigiPay', formatNumber(displayRun?.digipay_rows))}
              {renderDataPoint('Duration', formatDuration(getRunDurationMs(displayRun)))}
            </div>
            <div className="trustlink-file-line">
              <FiFileText />
              <span>{displayRun?.file_name || 'No export file recorded'}</span>
            </div>
            {displayRun && (
              <button type="button" className="trustlink-inline-btn full" onClick={() => void openRunInspector(displayRun.id)}>
                <FiEye />
                Inspect selected run
              </button>
            )}
          </article>

          <article className="trustlink-side-card">
            <div className="trustlink-panel-head compact">
              <div>
                <span className="trustlink-panel-kicker">
                  <FiFileText />
                  History pulse
                </span>
                <h3>Recent runs</h3>
              </div>
              <span className="trustlink-chip">{runs.length}</span>
            </div>
            <div className="trustlink-rail-list">
              {recentRuns.map((run) => {
                const tone = normalizeVisualStatus(run.status);
                return (
                  <button
                    key={run.id}
                    type="button"
                    className={`trustlink-rail-run ${displayRun?.id === run.id ? 'selected' : ''}`}
                    onClick={() => void selectRun(run.id, 'evidence')}
                  >
                    <span>
                      <strong>{formatRunDate(run.run_date)}</strong>
                      <em>{formatNumber(run.total_rows)} rows / {formatDuration(getRunDurationMs(run))}</em>
                    </span>
                    <small className={`trustlink-status-pill tone-${tone}`}>{prettyStatus(run.status)}</small>
                  </button>
                );
              })}
              {!recentRuns.length && <div className="trustlink-rail-empty">Run history will appear here.</div>}
            </div>
          </article>
        </aside>
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
