import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaCalendarCheck,
  FaCheck,
  FaClock,
  FaDatabase,
  FaDownload,
  FaExclamationTriangle,
  FaFileCsv,
  FaHistory,
  FaLock,
  FaPlay,
  FaRobot,
  FaShieldAlt,
  FaSyncAlt,
} from 'react-icons/fa';
import { useSearchParams } from 'react-router-dom';
import HoveringQueueWorkspace from '../components/reports/HoveringQueueWorkspace';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { SECTION_MANUAL_ID } from '../content/sentinelManual';
import reportsApi, { CRBArtifact, CRBOverview, CRBReportDefinition, CRBRun } from '../services/reportsApi';
import './ReportsPage.css';

const activeRunStatuses = new Set(['QUEUED', 'RUNNING']);

const crbReportContracts: CRBReportDefinition[] = [
  {
    report_key: 'CONTRACT_DATA',
    label: 'Contract data',
    view_name: 'VW_CONTRACT_DATA',
    field_count: 32,
  },
  {
    report_key: 'INDIVIDUAL_DETAILS',
    label: 'Individual client details',
    view_name: 'LMS_INDCLT_DETAILS',
    field_count: 57,
  },
];

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not generated';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRows = (value?: number | null) => new Intl.NumberFormat().format(value || 0);

const formatBytes = (value?: number | null) => {
  const bytes = Number(value || 0);
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const readError = (error: unknown) => {
  const candidate = error as { response?: { data?: { detail?: string } }; message?: string };
  return candidate?.response?.data?.detail || candidate?.message || 'CRB reporting is temporarily unavailable.';
};

const runLabel = (run?: CRBRun | null) => {
  if (!run) return 'Awaiting first extraction';
  if (run.status === 'COMPLETED') return 'Delivery ready';
  if (run.status === 'PARTIAL') return 'Partial delivery';
  if (run.status === 'FAILED') return 'Extraction stopped';
  if (run.status === 'RUNNING') return 'Extracting from LMS';
  return 'Queued for extraction';
};

const ReportsSkeleton: React.FC = () => (
  <div className="reports-skeleton" aria-label="Loading reporting workspace">
    <span className="reports-skeleton-head" />
    <span className="reports-skeleton-rail" />
    <div><span /><span /></div>
    <aside><span /><span /><span /><span /></aside>
  </div>
);

const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const [overview, setOverview] = useState<CRBOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hoverRefreshNonce, setHoverRefreshNonce] = useState(0);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const canExtract = ['admin', 'manager', 'supervisor'].includes(role);
  const canManageHoveringPasswords = ['admin', 'manager', 'user'].includes(role);
  const hasAccess = user?.section_id === SECTION_MANUAL_ID;
  const workspace = searchParams.get('workspace') === 'hovering' ? 'hovering' : 'crb';

  const openWorkspace = (next: 'crb' | 'hovering') => {
    const params = new URLSearchParams(searchParams);
    if (next === 'crb') params.delete('workspace');
    else params.set('workspace', next);
    setSearchParams(params);
    setError(null);
  };

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await reportsApi.getCrbOverview();
      setOverview(payload);
      setError(null);
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess || workspace !== 'crb') {
      setLoading(false);
      return;
    }
    void load();
  }, [hasAccess, load, workspace]);

  useEffect(() => {
    if (workspace !== 'crb' || !overview?.latest_run || !activeRunStatuses.has(overview.latest_run.status)) return undefined;
    const timer = window.setInterval(() => void load(true), 3000);
    return () => window.clearInterval(timer);
  }, [load, overview?.latest_run, workspace]);

  const artifacts = useMemo(() => {
    const indexed = new Map(overview?.current_artifacts.map((item) => [item.report_key, item]) || []);
    const contracts = overview?.reports?.length ? overview.reports : crbReportContracts;
    return contracts.map((report) => ({ report, artifact: indexed.get(report.report_key) || null }));
  }, [overview]);

  const startExtraction = async () => {
    setExtracting(true);
    try {
      await reportsApi.startCrbExtraction();
      addNotification({ type: 'success', message: 'CRB extraction entered the Nexus run queue.', priority: 'medium' });
      await load(true);
    } catch (extractError) {
      const message = readError(extractError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setExtracting(false);
    }
  };

  const download = async (artifact: CRBArtifact) => {
    setDownloading(artifact.artifact_id);
    try {
      await reportsApi.downloadCrbArtifact(artifact);
      addNotification({ type: 'success', message: `${artifact.filename} download started.`, priority: 'medium' });
    } catch (downloadError) {
      const message = readError(downloadError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setDownloading(null);
    }
  };

  if (!hasAccess) {
    return (
      <div className="reports-page">
        <section className="reports-access-denied">
          <FaShieldAlt />
          <small>Restricted reporting authority</small>
          <h1>Reporting custody is outside your current operating scope.</h1>
          <p>This workspace contains controlled LMS extracts and operational loan-queue evidence for authorized custodians.</p>
        </section>
      </div>
    );
  }

  const latest = overview?.latest_run;
  const running = Boolean(latest && activeRunStatuses.has(latest.status));

  return (
    <main className="reports-page">
      <header className="reports-command-header">
        <div className="reports-command-copy">
          <span><FaShieldAlt /> SentinelOps reporting custody</span>
          <h1>{workspace === 'crb' ? 'Regulatory delivery' : 'Loan queue command'}</h1>
          <p>{workspace === 'crb'
            ? 'Extract the approved CRB views from LMS, hold today’s sealed pair, and keep the delivery history accountable.'
            : 'Observe loan-ledger hovering as it moves, inspect the bounded queue, and carry stale installment dates safely into today.'}</p>
        </div>
        <div className="reports-command-posture">
          <span>
            <small>{workspace === 'crb' ? 'Daily command' : 'Bot window'}</small>
            <strong>{workspace === 'crb' ? overview?.schedule_time || '07:15' : '03:00–15:00'}</strong>
            <em>{workspace === 'crb' ? overview?.timezone || 'Africa/Harare' : 'Active-rate clock'}</em>
          </span>
          <span>
            <small>{workspace === 'crb' ? 'Retention boundary' : 'Date boundary'}</small>
            <strong>Midnight</strong>
            <em>{workspace === 'crb' ? 'Today’s files only' : 'Admin-controlled repair'}</em>
          </span>
          <button
            type="button"
            onClick={() => workspace === 'crb' ? void load() : setHoverRefreshNonce((value) => value + 1)}
            title="Refresh reporting workspace"
          ><FaSyncAlt /></button>
        </div>
      </header>

      <nav className="reports-workspace-rail" aria-label="Reporting workspaces">
        <span>Workspaces</span>
        <button type="button" className={workspace === 'crb' ? 'active' : ''} aria-current={workspace === 'crb' ? 'page' : undefined} onClick={() => openWorkspace('crb')}>
          <b>01</b><FaFileCsv /><span><strong>CRB extracts</strong><small>LMS regulatory delivery</small></span>
        </button>
        <button type="button" className={workspace === 'hovering' ? 'active' : ''} aria-current={workspace === 'hovering' ? 'page' : undefined} onClick={() => openWorkspace('hovering')}>
          <b>02</b><FaRobot /><span><strong>Hovering queue</strong><small>Loan ledger movement</small></span>
        </button>
      </nav>

      {workspace === 'crb' && error ? (
        <div className="reports-error">
          <FaExclamationTriangle />
          <span><strong>Reporting control interrupted</strong><small>{error}</small></span>
          <button type="button" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      {workspace === 'hovering' ? (
        <HoveringQueueWorkspace isAdmin={isAdmin} canOperate={hasAccess} canManagePasswords={canManageHoveringPasswords} refreshNonce={hoverRefreshNonce} />
      ) : loading ? (
        <ReportsSkeleton />
      ) : (
      <section className="reports-workspace">
        <div className="reports-delivery-board">
          <header className="reports-board-head">
            <div>
              <span>CRB delivery line</span>
              <h2>{runLabel(latest)}</h2>
              <p>
                {latest
                  ? `${latest.trigger === 'SCHEDULED' ? 'Scheduled' : 'Operator'} run / ${formatDateTime(latest.started_at || latest.created_at)}`
                  : 'No extraction has entered custody for this environment.'}
              </p>
            </div>
            <button
              type="button"
              className="reports-extract-command"
              onClick={() => void startExtraction()}
              disabled={!canExtract || extracting || running || !overview?.oracle_configured}
              title={!canExtract ? 'Your role does not allow manual extraction' : !overview?.oracle_configured ? 'Configure the read-only LMS Oracle identity first' : 'Extract both approved CRB views'}
            >
              {running || extracting ? <FaSyncAlt className="spin" /> : <FaPlay />}
              {running ? 'Extraction running' : extracting ? 'Queueing...' : 'Extract both views'}
            </button>
          </header>

          {!overview?.oracle_configured ? (
            <div className="reports-setup-required">
              <FaLock />
              <span>
                <strong>LMS read identity is not configured</strong>
                <small>Set the LMS_ORACLE_* variables on Nexus. The workspace never requires a write-capable LMS account.</small>
              </span>
            </div>
          ) : null}

          {running ? (
            <div className="reports-run-progress">
              <div><span className="pulse" /><strong>Reading LMS</strong><small>{latest?.current_report || 'Opening extraction session'}</small></div>
              {(overview?.reports?.length ? overview.reports : crbReportContracts).map((report, index) => {
                const complete = overview?.current_artifacts.some((artifact) => artifact.report_key === report.report_key && artifact.run_id === latest?.run_id) || false;
                const active = latest?.current_report === report.view_name;
                return (
                  <span key={report.report_key} className={complete ? 'complete' : active ? 'active' : ''}>
                    <b>{complete ? <FaCheck /> : index + 1}</b><em>{report.view_name}</em>
                  </span>
                );
              })}
            </div>
          ) : null}

          <div className="reports-pair" aria-label="Current CRB report pair">
            {artifacts.map(({ report, artifact }, index) => (
              <ReportArtifact
                key={report.report_key}
                report={report}
                artifact={artifact}
                order={index + 1}
                downloading={downloading === artifact?.artifact_id}
                onDownload={download}
              />
            ))}
          </div>

          <footer className="reports-boundary-line">
            <FaCalendarCheck />
            <span><strong>Next scheduled extraction</strong><small>{formatDateTime(overview?.next_schedule_at)}</small></span>
            <span><strong>File boundary</strong><small>Current pair expires at local midnight</small></span>
          </footer>
        </div>

        <aside className="reports-run-ledger">
          <header><span><FaHistory /> Run custody</span><strong>{overview?.runs.length || 0}</strong></header>
          <div className="reports-run-list">
            {overview?.runs.map((run) => (
              <article key={run.run_id} className={`status-${run.status.toLowerCase()}`}>
                <span className="reports-run-marker" />
                <div>
                  <small>{run.trigger === 'SCHEDULED' ? 'Scheduled' : 'Manual'} / {run.requested_by}</small>
                  <strong>{run.status === 'COMPLETED' ? 'Pair delivered' : runLabel(run)}</strong>
                  <time>{formatDateTime(run.completed_at || run.started_at || run.created_at)}</time>
                  {run.error_message ? <p>{run.error_message}</p> : null}
                </div>
              </article>
            ))}
            {!overview?.runs.length ? <p className="reports-empty-ledger">The first extraction will begin this timeline.</p> : null}
          </div>
        </aside>
      </section>
      )}
    </main>
  );
};

const ReportArtifact: React.FC<{
  report: CRBReportDefinition;
  artifact: CRBArtifact | null;
  order: number;
  downloading: boolean;
  onDownload: (artifact: CRBArtifact) => Promise<void>;
}> = ({ report, artifact, order, downloading, onDownload }) => (
  <article className={`reports-artifact ${artifact ? 'ready' : 'empty'}`}>
    <header>
      <span className="reports-artifact-index">0{order}</span>
      <span className="reports-artifact-icon"><FaDatabase /></span>
      <div><small>{report.view_name}</small><h3>{report.label}</h3></div>
      <em>{artifact ? 'Ready' : 'Awaiting extract'}</em>
    </header>
    <div className="reports-artifact-contract">
      <span><small>Source contract</small><strong>{report.field_count} approved columns</strong></span>
      <FaFileCsv />
    </div>
    {artifact ? (
      <div className="reports-artifact-result">
        <span><small>File</small><strong>{artifact.filename}</strong></span>
        <span><small>Rows</small><strong>{formatRows(artifact.row_count)}</strong></span>
        <span><small>Size</small><strong>{formatBytes(artifact.byte_size)}</strong></span>
        <span><small>Generated</small><strong>{formatDateTime(artifact.generated_at)}</strong></span>
      </div>
    ) : (
      <div className="reports-artifact-waiting"><FaClock /><span>No current-day file is held for this view.</span></div>
    )}
    <button type="button" disabled={!artifact || downloading} onClick={() => artifact && void onDownload(artifact)}>
      <FaDownload /> {downloading ? 'Preparing...' : `Download ${report.view_name}`}
    </button>
  </article>
);

export default ReportsPage;
