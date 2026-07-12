import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaBolt,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardCheck,
  FaClock,
  FaCrosshairs,
  FaDatabase,
  FaExclamationTriangle,
  FaLink,
  FaProjectDiagram,
  FaServer,
  FaShieldAlt,
  FaSignal,
  FaTasks,
  FaUserShield,
} from 'react-icons/fa';
import { FaArrowTrendUp } from 'react-icons/fa6';
import { DashboardHeader, ChecklistCard, QuickActions, DashboardSkeleton } from '../components/dashboard';
import type { QuickActionSignal } from '../components/dashboard/QuickActions';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useAuth } from '../contexts/AuthContext';
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { dashboardApi, DashboardSummary as DatabaseDashboardSummary } from '../services/dashboardApi';
import { OperationalDashboardSummary } from '../services/checklistApi';
import nexusApi, { FabricSummary, NexusLightAgentSummary } from '../services/nexusApi';
import { NetworkCommandCenterResponse, networkSentinelApi } from '../services/networkSentinelApi';
import taskApi from '../services/taskApi';
import trustlinkApi, { TrustlinkTodayStatusResponse } from '../services/trustlinkApi';
import './DashboardPage.css';
import '../components/dashboard/DashboardSkeleton.css';

type ShiftName = string;
type SignalTone = 'ok' | 'watch' | 'danger' | 'neutral';
type OpsSource = 'tasks' | 'trustlink' | 'database' | 'nexusFabric' | 'nexusAgents' | 'network';

interface TaskSignalSummary {
  total_tasks: number;
  active_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number | null;
  critical_tasks: number;
  source: 'team' | 'mine';
}

interface OpsData {
  taskSignal: TaskSignalSummary | null;
  trustlinkToday: TrustlinkTodayStatusResponse | null;
  databaseStats: DatabaseDashboardSummary | null;
  nexusFabric: FabricSummary | null;
  nexusAgents: NexusLightAgentSummary[];
  networkCenter: NetworkCommandCenterResponse | null;
  errors: Partial<Record<OpsSource, string>>;
  loading: boolean;
  lastUpdated: Date | null;
}

interface CommandSignal {
  id: string;
  label: string;
  value: string;
  meta: string;
  to: string;
  tone: SignalTone;
  icon: React.ReactNode;
}

const SHIFT_ORDER: ShiftName[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const SHIFT_WINDOWS: Record<string, string> = {
  MORNING: '07:00 - 15:00',
  AFTERNOON: '15:00 - 23:00',
  NIGHT: '23:00 - 07:00',
};

const EMPTY_DASHBOARD_SNAPSHOT: OperationalDashboardSummary = {
  operational_day: {
    checklist_date: '',
    window_start: '',
    window_end: '',
    timezone: '',
    boundary_time: '',
  },
  command_metrics: {
    active_instances: 0,
    in_progress_count: 0,
    pending_review_count: 0,
    completed_count: 0,
    exception_count: 0,
    coverage_gap_count: 0,
    total_items: 0,
    completed_items: 0,
    actioned_items: 0,
    critical_items: 0,
    open_critical_items: 0,
    participants: 0,
    handover_count: 0,
    execution_rate: 0,
    completion_rate: 0,
    critical_containment: 100,
    posture_label: 'Standby',
  },
  shift_cards: SHIFT_ORDER.map((shift) => ({
    shift,
    window: SHIFT_WINDOWS[shift],
    operations: 0,
    participants: 0,
    exceptions: 0,
    readiness: 0,
    status: 'No active thread',
  })),
  checklist_threads: [],
  attention_queue: [],
  handover_feed: [],
  notifications_unread: 0,
  generated_at: '',
};

const initialOpsData = (): OpsData => ({
  taskSignal: null,
  trustlinkToday: null,
  databaseStats: null,
  nexusFabric: null,
  nexusAgents: [],
  networkCenter: null,
  errors: {},
  loading: true,
  lastUpdated: null,
});

const integerFormatter = new Intl.NumberFormat();

const safeNumber = (value: unknown, fallback = 0): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const formatInteger = (value?: number | null): string => integerFormatter.format(Math.max(0, Math.round(value ?? 0)));

const formatPercent = (value?: number | null): string => (
  typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value)}%` : '--'
);

const getErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    const detail = response?.data?.detail || response?.data?.message;
    if (detail) return detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Source unavailable';
};

const readSettled = <T,>(
  result: PromiseSettledResult<T>,
  source: OpsSource,
  previous: T,
  errors: Partial<Record<OpsSource, string>>,
): T => {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  errors[source] = getErrorMessage(result.reason);
  return previous;
};

const taskSignalFromAnalytics = (analytics: any): TaskSignalSummary => {
  const statusCounts = analytics?.tasks_by_status || {};
  const priorityCounts = analytics?.tasks_by_priority || {};
  const activeTasks = safeNumber(analytics?.active_tasks ?? statusCounts.ACTIVE ?? statusCounts.active);
  const onHoldTasks = safeNumber(statusCounts.ON_HOLD ?? statusCounts.on_hold);

  return {
    total_tasks: safeNumber(analytics?.total_tasks),
    active_tasks: activeTasks + onHoldTasks,
    in_progress_tasks: safeNumber(analytics?.in_progress_tasks ?? statusCounts.IN_PROGRESS ?? statusCounts.in_progress),
    overdue_tasks: safeNumber(analytics?.overdue_tasks),
    completion_rate: typeof analytics?.completion_rate === 'number' ? analytics.completion_rate : null,
    critical_tasks: safeNumber(priorityCounts.CRITICAL ?? priorityCounts.critical),
    source: 'team',
  };
};

const loadTaskSignal = async (): Promise<TaskSignalSummary> => {
  try {
    return taskSignalFromAnalytics(await taskApi.getTaskAnalytics());
  } catch {
    const [openTasks, inProgressTasks, overdueTasks] = await Promise.all([
      taskApi.getMyTasks({ status: ['ACTIVE', 'IN_PROGRESS', 'ON_HOLD'], limit: 1, offset: 0 }),
      taskApi.getMyTasks({ status: ['IN_PROGRESS'], limit: 1, offset: 0 }),
      taskApi.getMyTasks({ is_overdue: true, limit: 1, offset: 0 }),
    ]);
    const openTotal = safeNumber(openTasks.pagination?.total, openTasks.tasks?.length || 0);
    const inProgressTotal = safeNumber(inProgressTasks.pagination?.total, inProgressTasks.tasks?.length || 0);

    return {
      total_tasks: openTotal,
      active_tasks: Math.max(openTotal - inProgressTotal, 0),
      in_progress_tasks: inProgressTotal,
      overdue_tasks: safeNumber(overdueTasks.pagination?.total, overdueTasks.tasks?.length || 0),
      completion_rate: null,
      critical_tasks: 0,
      source: 'mine',
    };
  }
};

const prettyTrustlinkStatus = (status?: string | null): string => {
  switch ((status || 'none').toLowerCase()) {
    case 'success':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'failed':
      return 'Failed';
    case 'exists':
    case 'duplicate':
      return 'Exists';
    case 'pending':
      return 'Pending';
    default:
      return 'No run';
  }
};

const toneFromTrustlinkStatus = (status?: string | null): SignalTone => {
  switch ((status || '').toLowerCase()) {
    case 'failed':
      return 'danger';
    case 'running':
    case 'pending':
      return 'watch';
    case 'success':
    case 'exists':
    case 'duplicate':
      return 'ok';
    default:
      return 'neutral';
  }
};

const toneFromDatabaseStatus = (status?: string | null): SignalTone => {
  if (status === 'CRITICAL') return 'danger';
  if (status === 'WARNING') return 'watch';
  if (status === 'HEALTHY') return 'ok';
  return 'neutral';
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { snapshot, loading, refresh, error } = useDashboardSnapshot();
  const [opsData, setOpsData] = useState<OpsData>(() => initialOpsData());

  const loadOpsData = useCallback(async (background = false) => {
    if (!background) {
      setOpsData((current) => ({ ...current, loading: true }));
    }

    const [
      taskResult,
      trustlinkResult,
      databaseResult,
      nexusFabricResult,
      nexusAgentsResult,
      networkResult,
    ] = await Promise.allSettled([
      loadTaskSignal(),
      trustlinkApi.getTodayStatus(),
      dashboardApi.getDashboardStats(),
      nexusApi.getFabricSummary(),
      nexusApi.listLightAgents(),
      networkSentinelApi.getCommandCenter(),
    ]);

    setOpsData((current) => {
      const errors: Partial<Record<OpsSource, string>> = {};
      return {
        taskSignal: readSettled(taskResult, 'tasks', current.taskSignal, errors),
        trustlinkToday: readSettled(trustlinkResult, 'trustlink', current.trustlinkToday, errors),
        databaseStats: readSettled(databaseResult, 'database', current.databaseStats, errors),
        nexusFabric: readSettled(nexusFabricResult, 'nexusFabric', current.nexusFabric, errors),
        nexusAgents: readSettled(nexusAgentsResult, 'nexusAgents', current.nexusAgents, errors),
        networkCenter: readSettled(networkResult, 'network', current.networkCenter, errors),
        errors,
        loading: false,
        lastUpdated: new Date(),
      };
    });
  }, []);

  useEffect(() => {
    void loadOpsData(false);
    const interval = window.setInterval(() => {
      void loadOpsData(true);
    }, 45000);

    return () => window.clearInterval(interval);
  }, [loadOpsData]);

  const refreshEverything = useCallback(async () => {
    await Promise.all([
      refresh({ background: true }),
      loadOpsData(true),
    ]);
  }, [loadOpsData, refresh]);

  const dashboardSnapshot = snapshot ?? EMPTY_DASHBOARD_SNAPSHOT;
  const commandMetrics = dashboardSnapshot.command_metrics;
  const checklistThreads = dashboardSnapshot.checklist_threads;
  const watchlist = dashboardSnapshot.attention_queue;
  const handoverFeed = dashboardSnapshot.handover_feed;
  const trustlinkRun = opsData.trustlinkToday?.run ?? null;
  const trustlinkStatus = trustlinkRun?.status || opsData.trustlinkToday?.status || 'none';
  const networkOverview = opsData.networkCenter?.overview;
  const databasePrediction = opsData.databaseStats?.prediction;
  const databaseMetrics = opsData.databaseStats?.derived_metrics;
  const databaseStatus = databasePrediction?.status;
  const activeNexusAgents = opsData.nexusAgents.filter((agent) => agent.status === 'online').length;
  const staleNexusAgents = opsData.nexusAgents.filter((agent) => agent.status === 'stale').length;
  const taskOpenLoad = (opsData.taskSignal?.active_tasks || 0) + (opsData.taskSignal?.in_progress_tasks || 0);
  const networkImpaired = networkOverview?.impaired_services ?? 0;
  const nexusActiveIncidents = opsData.nexusFabric?.active_incidents ?? 0;
  const unavailableSources = Object.keys(opsData.errors).length;

  const operationalDayLabel = useMemo(() => {
    const rawDate = dashboardSnapshot.operational_day.checklist_date;
    if (!rawDate) {
      return 'Operational day';
    }

    const parsed = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return `Operational day ${rawDate}`;
    }

    return `Operational day ${parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })}`;
  }, [dashboardSnapshot.operational_day.checklist_date]);

  const lastUpdatedLabel = useMemo(() => {
    if (opsData.lastUpdated) {
      return opsData.lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (dashboardSnapshot.generated_at) {
      const generated = new Date(dashboardSnapshot.generated_at);
      if (!Number.isNaN(generated.getTime())) {
        return generated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    }
    return 'pending';
  }, [dashboardSnapshot.generated_at, opsData.lastUpdated]);

  const commandSignals = useMemo<CommandSignal[]>(() => [
    {
      id: 'action-load',
      label: 'Action load',
      value: formatInteger(taskOpenLoad + commandMetrics.open_critical_items),
      meta: `${formatInteger(opsData.taskSignal?.overdue_tasks)} overdue tasks / ${formatInteger(commandMetrics.open_critical_items)} checklist critical`,
      to: '/tasks',
      tone: opsData.taskSignal?.overdue_tasks || commandMetrics.open_critical_items ? 'danger' : 'ok',
      icon: <FaTasks />,
    },
    {
      id: 'fabric',
      label: 'Nexus + Network',
      value: formatInteger(networkImpaired + nexusActiveIncidents),
      meta: `${formatInteger(networkImpaired)} impaired monitors / ${formatInteger(nexusActiveIncidents)} Nexus incidents`,
      to: '/nexus',
      tone: networkImpaired + nexusActiveIncidents > 0 ? 'watch' : 'ok',
      icon: <FaProjectDiagram />,
    },
    {
      id: 'database',
      label: 'Database runway',
      value: databasePrediction ? `${formatInteger(databasePrediction.daysRemaining)}d` : '--',
      meta: databasePrediction
        ? `${databasePrediction.status} / ${formatPercent(databaseMetrics?.usage_percentage)} used`
        : 'Telemetry source pending',
      to: '/database-stats',
      tone: toneFromDatabaseStatus(databaseStatus),
      icon: <FaDatabase />,
    },
    {
      id: 'trustlink',
      label: 'TrustLink run',
      value: prettyTrustlinkStatus(trustlinkStatus),
      meta: trustlinkRun
        ? `${formatInteger(trustlinkRun.total_rows)} rows / ${trustlinkRun.file_present ? 'file ready' : 'no file'}`
        : 'No current run loaded',
      to: '/trustlink',
      tone: toneFromTrustlinkStatus(trustlinkStatus),
      icon: <FaLink />,
    },
  ], [
    commandMetrics.open_critical_items,
    databaseMetrics?.usage_percentage,
    databasePrediction,
    databaseStatus,
    networkImpaired,
    nexusActiveIncidents,
    opsData.taskSignal,
    taskOpenLoad,
    trustlinkRun,
    trustlinkStatus,
  ]);

  const operatorSignals = useMemo<QuickActionSignal[]>(() => [
    {
      id: 'tasks',
      label: opsData.taskSignal?.source === 'mine' ? 'My task queue' : 'Task queue',
      value: formatInteger(taskOpenLoad),
      detail: `${formatInteger(opsData.taskSignal?.overdue_tasks)} overdue / ${formatPercent(opsData.taskSignal?.completion_rate)} closure`,
      to: '/tasks',
      tone: opsData.taskSignal?.overdue_tasks ? 'danger' : taskOpenLoad ? 'watch' : 'ok',
      icon: <FaTasks />,
    },
    {
      id: 'trustlink',
      label: 'TrustLink',
      value: prettyTrustlinkStatus(trustlinkStatus),
      detail: trustlinkRun ? `${formatInteger(trustlinkRun.total_rows)} rows processed today` : 'Open run console',
      to: '/trustlink',
      tone: toneFromTrustlinkStatus(trustlinkStatus),
      icon: <FaLink />,
    },
    {
      id: 'database',
      label: 'Database',
      value: databasePrediction ? `${formatInteger(databasePrediction.daysRemaining)}d` : '--',
      detail: databasePrediction
        ? `${databasePrediction.status} runway / ${formatPercent(databaseMetrics?.usage_percentage)} used`
        : 'Capacity telemetry pending',
      to: '/database-stats',
      tone: toneFromDatabaseStatus(databaseStatus),
      icon: <FaDatabase />,
    },
    {
      id: 'fabric',
      label: 'Nexus fabric',
      value: formatInteger(networkImpaired + nexusActiveIncidents),
      detail: `${formatInteger(activeNexusAgents)}/${formatInteger(opsData.nexusAgents.length)} agents online / ${formatInteger(networkOverview?.fleet_pulse)}% pulse`,
      to: '/nexus',
      tone: networkImpaired + nexusActiveIncidents > 0 || staleNexusAgents > 0 ? 'watch' : 'ok',
      icon: <FaProjectDiagram />,
    },
  ], [
    activeNexusAgents,
    databaseMetrics?.usage_percentage,
    databasePrediction,
    databaseStatus,
    networkImpaired,
    networkOverview?.fleet_pulse,
    nexusActiveIncidents,
    opsData.nexusAgents.length,
    opsData.taskSignal,
    staleNexusAgents,
    taskOpenLoad,
    trustlinkRun,
    trustlinkStatus,
  ]);

  const fabricRows = useMemo(() => [
    {
      label: 'Network pulse',
      value: formatPercent(networkOverview?.fleet_pulse),
      detail: `${formatInteger(networkOverview?.enabled_services)} of ${formatInteger(networkOverview?.total_services)} monitors enabled`,
    },
    {
      label: 'Impaired services',
      value: formatInteger(networkOverview?.impaired_services),
      detail: `${formatInteger(networkOverview?.down_services)} down / ${formatInteger(networkOverview?.degraded_services)} degraded`,
    },
    {
      label: 'Nexus incidents',
      value: formatInteger(opsData.nexusFabric?.active_incidents),
      detail: `${formatInteger(opsData.nexusFabric?.diagnostics_ready_services)} diagnostics-ready services`,
    },
    {
      label: 'Light agents',
      value: `${formatInteger(activeNexusAgents)}/${formatInteger(opsData.nexusAgents.length)}`,
      detail: staleNexusAgents ? `${formatInteger(staleNexusAgents)} stale agent heartbeat(s)` : 'Agent heartbeat lane nominal',
    },
  ], [activeNexusAgents, networkOverview, opsData.nexusAgents.length, opsData.nexusFabric, staleNexusAgents]);

  if (loading && !snapshot) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="sentinel-dashboard sentinel-dashboard-command">
      <DashboardHeader user={user} />

      {(error || unavailableSources > 0) && (
        <section className="dashboard-source-banner">
          <FaExclamationTriangle />
          <div>
            <strong>{error ? 'Dashboard snapshot interrupted' : `${unavailableSources} secondary source${unavailableSources === 1 ? '' : 's'} pending`}</strong>
            <span>{error || 'The dashboard is keeping the last known values while those consoles reconnect.'}</span>
          </div>
          <button type="button" onClick={() => void refreshEverything()}>
            Refresh
          </button>
        </section>
      )}

      <section className="ops-command-strip">
        <div className="ops-command-title">
          <span><FaShieldAlt /> Live command board</span>
          <strong>{commandMetrics.posture_label}</strong>
          <small>{operationalDayLabel} / refreshed {lastUpdatedLabel}</small>
        </div>

        <div className="ops-signal-grid">
          {commandSignals.map((signal) => (
            <Link key={signal.id} to={signal.to} className={`ops-signal-card tone-${signal.tone}`}>
              <span className="ops-signal-icon">{signal.icon}</span>
              <span className="ops-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.meta}</em>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="dashboard-grid command-grid">
        <div className="dashboard-left command-main">
          <section className="dashboard-section command-panel command-panel-threads">
            <div className="section-header command-section-header">
              <h2>
                <FaClipboardCheck /> Operational Day Threads
              </h2>
              <span className="section-badge">
                {checklistThreads.length} active / {formatInteger(commandMetrics.execution_rate)}% actioned
              </span>
            </div>

            <div className="checklist-grid my-check-grid">
              {checklistThreads.length === 0 ? (
                <div className="empty-state command-empty-state">
                  <FaCalendarAlt size={44} />
                  <h3>No active operations in the queue</h3>
                  <p>Start a checklist to establish visibility, ownership, and execution tracking for the current operational day.</p>
                </div>
              ) : (
                checklistThreads.map((thread) => <ChecklistCard key={thread.id} thread={thread} />)
              )}
            </div>
          </section>

          <section className="dashboard-section command-panel command-matrix-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaSignal /> Operational Matrix
              </h2>
            </div>

            <div className="command-matrix">
              <article className="matrix-stat matrix-stat-critical">
                <span>Critical queue</span>
                <strong>{commandMetrics.open_critical_items}</strong>
                <small>{commandMetrics.critical_items} high-severity checklist tasks observed</small>
              </article>
              <article className="matrix-stat">
                <span>Review pressure</span>
                <strong>{commandMetrics.pending_review_count}</strong>
                <small>checklists waiting for supervisor sign-off</small>
              </article>
              <article className="matrix-stat">
                <span>Completed threads</span>
                <strong>{commandMetrics.completed_count}</strong>
                <small>operations closed or closed with exceptions</small>
              </article>
              <article className="matrix-stat">
                <span>Coverage gaps</span>
                <strong>{commandMetrics.coverage_gap_count}</strong>
                <small>active shifts missing operator presence</small>
              </article>
            </div>
          </section>

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaArrowTrendUp /> Handover Summary
              </h2>
            </div>

            <div className="handover-feed">
              {handoverFeed.length === 0 ? (
                <div className="handover-empty">
                  <FaClock />
                  <p>No handover notes are waiting in the queue.</p>
                </div>
              ) : (
                handoverFeed.map((item) => (
                  <article key={item.id} className="handover-item">
                    <div>
                      <span>{item.shift} shift</span>
                      <strong>{item.count} note{item.count === 1 ? '' : 's'}</strong>
                    </div>
                    <small>Prepared for the next operating team.</small>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="dashboard-section command-panel command-stance-panel">
            <div className="stance-row">
              <FaBolt />
              <span>Execution</span>
              <strong>{formatPercent(commandMetrics.execution_rate)}</strong>
            </div>
            <div className="stance-row">
              <FaCrosshairs />
              <span>Containment</span>
              <strong>{formatPercent(commandMetrics.critical_containment)}</strong>
            </div>
            <div className="stance-row">
              <FaUserShield />
              <span>Staffed</span>
              <strong>{formatInteger(Math.max(commandMetrics.active_instances - commandMetrics.coverage_gap_count, 0))}/{formatInteger(commandMetrics.active_instances)}</strong>
            </div>
          </section>
        </div>

        <div className="dashboard-right command-side">
          <QuickActions
            onRefresh={refreshEverything}
            existingThreads={checklistThreads}
            signals={operatorSignals}
          />

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaExclamationTriangle /> Attention Queue
              </h2>
            </div>

            <div className="watchlist">
              {watchlist.length === 0 ? (
                <div className="watchlist-empty">
                  <FaCheckCircle />
                  <div>
                    <strong>No immediate attention items</strong>
                    <p>Coverage, participation, and exception handling are currently under control.</p>
                  </div>
                </div>
              ) : (
                watchlist.map((item) => (
                  <article key={item.id} className={`watchlist-item watchlist-${item.tone}`}>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="dashboard-section command-panel fabric-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaServer /> Sentinel Fabric
              </h2>
              <span className="section-badge">Network + Nexus</span>
            </div>

            <div className="fabric-lanes">
              {fabricRows.map((row) => (
                <article key={row.label} className="fabric-lane">
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  <small>{row.detail}</small>
                </article>
              ))}
            </div>
          </section>
          
        </div>
      </div>

      <PageGuide guide={pageGuides.dashboard} />
    </div>
  );
};

export default DashboardPage;
