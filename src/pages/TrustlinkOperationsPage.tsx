import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiArrowDownCircle,
  FiCheckCircle,
  FiClock,
  FiDatabase,
  FiPlay,
  FiRefreshCcw,
  FiShield,
  FiTarget,
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

const PIPELINE_ORDER: PipelineStageName[] = [
  'IDC_EXTRACTION',
  'DIGIPAY_EXTRACTION',
  'TRANSFORMATION',
  'VALIDATION',
  'FILE_SAVE',
  'DOWNLOAD',
];

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

const formatDuration = (ms?: number | null): string => {
  if (!ms || ms <= 0) return '-';
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
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
  const date = new Date(value);
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

const getErrorMessage = (error: unknown): string => {
  const message = typeof error === 'object' && error !== null && 'response' in error
    ? String((error as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.detail
      || (error as { response?: { data?: { detail?: string; message?: string } } }).response?.data?.message
      || '')
    : '';

  if (message) return message;
  return 'Failed to load TrustLink operations data.';
};

const TRUSTLINK_DEADLINE_HOUR = 7;

const TrustlinkOperationsPage: React.FC = () => {
  const [nowTick, setNowTick] = useState(() => new Date());
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionLabel, setActionLabel] = useState<string | null>(null);
  const [todayStatus, setTodayStatus] = useState<TrustlinkTodayStatusResponse | null>(null);
  const [runs, setRuns] = useState<TrustlinkRunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<TrustlinkRunDetail | null>(null);
  const [steps, setSteps] = useState<TrustlinkStep[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [pendingFileDeleteRun, setPendingFileDeleteRun] = useState<TrustlinkRunListItem | null>(null);

  const selectedRunId = selectedRun?.id || todayStatus?.run?.id || null;

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
      const payload = event?.type === 'CHECKLIST_UPDATE' ? event?.data : event;
      if (payload?.type !== 'trustlink_update') return;

      const eventRunId: string | undefined = payload?.run_id;
      if (!eventRunId) return;

      if (!selectedRunId || selectedRunId === eventRunId) {
        void (async () => {
          try {
            const [today, history] = await Promise.all([
              trustlinkApi.getTodayStatus(),
              trustlinkApi.listRuns(50, 0),
            ]);
            setTodayStatus(today);
            setRuns(history);
            await loadRun(eventRunId);
          } catch {
            // Ignore transient websocket refresh errors
          }
        })();
      }
    });

    return unsubscribe;
  }, [loadRun, selectedRunId]);

  const stepMap = useMemo(() => {
    const mapped = new Map<TrustlinkStep['step_name'], TrustlinkStep>();
    for (const step of steps) mapped.set(step.step_name, step);
    return mapped;
  }, [steps]);

  const completionCount = useMemo(() => (
    PIPELINE_ORDER.filter((name) => {
      if (name === 'DOWNLOAD') {
        return Boolean(selectedRun?.file_path || todayStatus?.has_file);
      }
      const status = stepMap.get(name)?.status;
      return status === 'completed';
    }).length
  ), [stepMap, selectedRun?.file_path, todayStatus?.has_file]);

  const totalRows = selectedRun?.total_rows ?? todayStatus?.run?.total_rows ?? 0;
  const totalDuration = selectedRun?.total_duration_ms ?? todayStatus?.run?.total_duration_ms ?? 0;
  const currentStatus = selectedRun?.status || todayStatus?.run?.status || todayStatus?.status || 'none';
  const currentStatusTone = normalizeVisualStatus(currentStatus);
  const hasRunData = Boolean(todayStatus?.run || runs.length || selectedRun);

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

  const heroMetrics = [
    {
      label: 'Pipeline Completion',
      value: `${completionCount}/${PIPELINE_ORDER.length}`,
      helper: 'Stages sealed',
      icon: <FiTarget />,
    },
    {
      label: 'Rows Processed',
      value: formatNumber(totalRows),
      helper: 'Current evidence set',
      icon: <FiDatabase />,
    },
    {
      label: 'Delivery Duration',
      value: formatDuration(totalDuration),
      helper: 'End-to-end execution',
      icon: <FiClock />,
    },
    {
      label: 'Export Readiness',
      value: todayStatus?.has_file ? 'Ready' : 'Awaiting file',
      helper: todayStatus?.has_file ? 'Download available' : 'File save pending',
      icon: <FiShield />,
    },
  ];

  const timeline = PIPELINE_ORDER.map((name, index) => {
    if (name === 'DOWNLOAD') {
      const hasDownload = Boolean(selectedRun?.file_present || todayStatus?.run?.file_present || todayStatus?.has_file);
      const saveStepStatus = stepMap.get('FILE_SAVE')?.status;
      const downloadStatus = hasDownload
        ? 'completed'
        : currentStatus === 'failed'
          ? 'failed'
          : (currentStatus === 'running' || saveStepStatus === 'running')
            ? 'running'
            : 'pending';
      const tone = normalizeVisualStatus(downloadStatus);

      return {
        id: name,
        order: index + 1,
        title: STEP_COPY[name].title,
        detail: STEP_COPY[name].detail,
        status: prettyStatus(downloadStatus),
        tone,
        rows: hasDownload ? formatNumber(totalRows) : '-',
        duration: '-',
        meta: hasDownload ? formatDateTime(selectedRun?.completed_at || todayStatus?.run?.completed_at) : '-',
      };
    }

    const step = stepMap.get(name);
    const tone = normalizeVisualStatus(step?.status);

    return {
      id: name,
      order: index + 1,
      title: STEP_COPY[name].title,
      detail: STEP_COPY[name].detail,
      status: prettyStatus(step?.status),
      tone,
      rows: formatNumber(step?.row_count ?? 0),
      duration: formatDuration(step?.duration_ms),
      meta: formatDateTime(step?.completed_at || step?.started_at),
    };
  });

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

  const selectRun = async (runId: string) => {
    setActionLoading(true);
    setActionLabel('Loading run intelligence');
    setError(null);

    try {
      await loadRun(runId);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setActionLoading(false);
      setActionLabel(null);
    }
  };

  if (initialLoading) {
    return (
      <div className="trustlink-page trustlink-page-loading">
        <section className="trustlink-hero trustlink-hero-loading">
          <div className="skeleton skeleton-badge" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
          <div className="trustlink-hero-metrics">
            <div className="skeleton skeleton-hero-card" />
            <div className="skeleton skeleton-hero-card" />
            <div className="skeleton skeleton-hero-card" />
            <div className="skeleton skeleton-hero-card" />
          </div>
        </section>

        <section className="trustlink-command-bar">
          <div className="skeleton skeleton-btn" />
          <div className="skeleton skeleton-btn" />
          <div className="skeleton skeleton-btn" />
        </section>

        <section className="trustlink-main-grid">
          <article className="trustlink-card trustlink-card-tall">
            <div className="skeleton skeleton-card-title" />
            <div className="skeleton skeleton-stack" />
            <div className="skeleton skeleton-stack" />
            <div className="skeleton skeleton-stack" />
          </article>
          <article className="trustlink-card">
            <div className="skeleton skeleton-card-title" />
            <div className="skeleton skeleton-metric" />
            <div className="skeleton skeleton-metric" />
            <div className="skeleton skeleton-metric" />
          </article>
          <article className="trustlink-card">
            <div className="skeleton skeleton-card-title" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row" />
          </article>
        </section>
      </div>
    );
  }

  return (
    <div className="trustlink-page">
      <section className="trustlink-hero">
        <div className="trustlink-hero-copy">
          <span className={`trustlink-eyebrow tone-${currentStatusTone}`}>
            <FiActivity />
            TrustLink Command Surface
          </span>
          <p>
            A rebuilt TrustLink operations view with sharper telemetry, stronger evidence framing,
            and cleaner backend alignment for the daily 07:00 delivery path.
          </p>

          <div className="trustlink-status-strip">
            <span className={`status-dot ${refreshing ? 'active' : ''}`} />
            <span>{refreshing ? 'Synchronizing live state' : 'Live telemetry connected'}</span>
            <span className={`trustlink-status-pill tone-${currentStatusTone}`}>
              {prettyStatus(currentStatus)}
            </span>
            {actionLoading && actionLabel && <span className="action-label">{actionLabel}</span>}
          </div>
        </div>

        <div className="trustlink-hero-metrics">
          {heroMetrics.map((metric) => (
            <article key={metric.label} className="trustlink-hero-card">
              <span className="hero-card-icon">{metric.icon}</span>
              <span className="hero-card-label">{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
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

      <section className="trustlink-command-bar">
        <div className="trustlink-command-group">
          <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}>
            <FiPlay />
            Run Extraction
          </button>
          <button className="trustlink-btn secondary" onClick={() => void hydrate()} disabled={actionLoading}>
            <FiRefreshCcw />
            Refresh Live Data
          </button>
          {todayStatus?.run?.file_present && todayStatus.run?.id && (
            <button className="trustlink-btn ghost" onClick={() => void handleDownload(todayStatus.run!.id, todayStatus.run?.file_name)} disabled={actionLoading}>
              <FiArrowDownCircle />
              Download Export
            </button>
          )}
        </div>

        <button className="trustlink-btn danger" onClick={() => setShowOverwriteWarning(true)} disabled={actionLoading}>
          <FiZap />
          Overwrite and Re-Extract
        </button>
      </section>

      <section className="trustlink-schedule-radar">
        <div className="schedule-radar-head">
          <div>
            <span className="trustlink-card-kicker">Delivery Cadence</span>
            <h3>Daily 07:00 command deadline</h3>
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
      </section>

      {!hasRunData ? (
        <section className="trustlink-empty-state">
          <div className="trustlink-empty-orb" />
          <h2>No TrustLink run is available yet</h2>
          <p>
            The UI is ready, but the backend has not returned a run for today. This usually means the
            extraction service has not executed yet, or the active backend does not expose the TrustLink routes.
          </p>
          <button className="trustlink-btn primary" onClick={handleRunNow} disabled={actionLoading}>
            <FiPlay />
            Trigger First Run
          </button>
        </section>
      ) : (
        <>
          <section className="trustlink-main-grid">
            <article className="trustlink-card trustlink-card-tall">
              <div className="trustlink-card-header">
                <div>
                  <span className="trustlink-card-kicker">Pipeline</span>
                </div>
                <span className="trustlink-chip">
                  {completionCount} of {PIPELINE_ORDER.length} stages complete
                </span>
              </div>

              <div className="trustlink-timeline">
                {timeline.map((item) => (
                  <div key={item.id} className={`trustlink-timeline-item tone-${item.tone}`}>
                    <div className="timeline-rail">
                      <span className="timeline-node">{item.order}</span>
                    </div>
                    <div className="timeline-body">
                      <div className="timeline-topline">
                        <div>
                          <h3>{item.title}</h3>
                          <p>{item.detail}</p>
                        </div>
                        <span className={`trustlink-status-pill tone-${item.tone}`}>{item.status}</span>
                      </div>
                      <div className="timeline-stats">
                        <span>{item.rows} rows</span>
                        <span>{item.duration}</span>
                        <span>{item.meta}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="trustlink-card">
              <div className="trustlink-card-header">
                <div>
                  <span className="trustlink-card-kicker">Today</span>
                </div>
                <span className={`trustlink-status-pill tone-${currentStatusTone}`}>
                  {prettyStatus(todayStatus?.run?.status || todayStatus?.status)}
                </span>
              </div>

              <div className="trustlink-data-grid">
                <div className="trustlink-data-point">
                  <span>Run ID</span>
                  <strong>{todayStatus?.run?.id || '-'}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Run Date</span>
                  <strong>{formatRunDate(todayStatus?.run?.run_date)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Run Type</span>
                  <strong>{formatRunType(todayStatus?.run?.run_type)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Triggered By</span>
                  <strong>{todayStatus?.run?.triggered_by_display || '-'}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Started</span>
                  <strong>{formatDateTime(todayStatus?.run?.started_at)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Completed</span>
                  <strong>{formatDateTime(todayStatus?.run?.completed_at)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>File Presence</span>
                  <strong>{prettyFileStatus(todayStatus?.run?.file_status)}</strong>
                </div>
              </div>
            </article>

            <article className="trustlink-card">
              <div className="trustlink-card-header">
                <div>
                  <span className="trustlink-card-kicker">Evidence</span>
                </div>
                <span className="trustlink-chip subtle">Selected run</span>
              </div>

              <div className="trustlink-data-grid">
                <div className="trustlink-data-point">
                  <span>Total Rows</span>
                  <strong>{formatNumber(selectedRun?.total_rows)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>IDC Rows</span>
                  <strong>{formatNumber(selectedRun?.idc_rows)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>DigiPay Rows</span>
                  <strong>{formatNumber(selectedRun?.digipay_rows)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Extract Time</span>
                  <strong>{formatDuration(selectedRun?.extract_duration_ms)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Transform Time</span>
                  <strong>{formatDuration(selectedRun?.transform_duration_ms)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Validation Time</span>
                  <strong>{formatDuration(selectedRun?.validation_duration_ms)}</strong>
                </div>
                <div className="trustlink-data-point trustlink-data-point-wide">
                  <span>Triggered By</span>
                  <strong>{selectedRun?.triggered_by_display || '-'}</strong>
                </div>
                <div className="trustlink-data-point trustlink-data-point-wide">
                  <span>Export File</span>
                  <strong>{selectedRun?.file_name || 'No file recorded'}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>File Status</span>
                  <strong>{prettyFileStatus(selectedRun?.file_status)}</strong>
                </div>
                <div className="trustlink-data-point">
                  <span>Run Type</span>
                  <strong>{formatRunType(selectedRun?.run_type)}</strong>
                </div>
                <div className="trustlink-data-point trustlink-data-point-wide">
                  <span>Integrity Hash</span>
                  <strong>{selectedRun?.file_hash || '-'}</strong>
                </div>
                <div className="trustlink-data-point trustlink-data-point-wide">
                  <span>Error Surface</span>
                  <strong>{selectedRun?.error_message || 'No run error captured'}</strong>
                </div>
              </div>
            </article>
          </section>

          <section className="trustlink-history">
            <div className="trustlink-card-header">
              <div>
                <span className="trustlink-card-kicker">Run History</span>
              </div>
              <span className="trustlink-chip">{runs.length} recorded runs</span>
            </div>

            <div className="trustlink-history-list">
              {runs.map((run) => {
                const tone = normalizeVisualStatus(run.status);
                const isSelected = selectedRun?.id === run.id;

                return (
                  <article
                    key={run.id}
                    className={`trustlink-history-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => void selectRun(run.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        void selectRun(run.id);
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
                      <span>{formatDuration(run.total_duration_ms)}</span>
                      <span>{run.triggered_by_display || 'Unknown trigger'}</span>
                      <span>{prettyFileStatus(run.file_status)}</span>
                      <span>{formatDateTime(run.completed_at || run.started_at)}</span>
                    </div>

                    <div className="history-item-actions">
                      <button
                        className="trustlink-inline-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          void selectRun(run.id);
                        }}
                        disabled={actionLoading}
                      >
                        Inspect run
                      </button>
                      {run.file_present && (
                        <button
                          className="trustlink-inline-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDownload(run.id, run.file_name);
                          }}
                        >
                          Download
                        </button>
                      )}
                      {run.file_status === 'available' && run.run_date < new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10) && (
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
            <PageGuide guide={pageGuides.trustlinkOperations} />
          </section>
        </>
      )}
      
      {showOverwriteWarning && (
        <div className="trustlink-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="trustlink-overwrite-title">
          <div className="trustlink-modal warning">
            <div className="trustlink-modal-glow" aria-hidden="true" />
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
            <div className="trustlink-modal-glow" aria-hidden="true" />
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
                <span><FiClock /> Recovery impact</span>
                <strong>To restore a downloadable file, you would need to run a fresh extraction or overwrite for the relevant date.</strong>
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
