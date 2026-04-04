import React, { useEffect, useMemo, useState } from 'react';
import {
  FaBolt,
  FaCalendarAlt,
  FaCheckCircle,
  FaClipboardCheck,
  FaClock,
  FaCrosshairs,
  FaExclamationTriangle,
  FaShieldAlt,
  FaSignal,
  FaSitemap,
  FaUserShield
} from 'react-icons/fa';
import { FaArrowTrendUp } from 'react-icons/fa6';
import { DashboardHeader, ChecklistCard, QuickActions, DashboardSkeleton } from '../components/dashboard';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useAuth } from '../contexts/AuthContext';
import { useChecklist } from '../contexts/checklistContext';
import { checklistApi } from '../services/checklistApi';
import { NetworkService, networkSentinelApi } from '../services/networkSentinelApi';
import './DashboardPage.css';
import '../components/dashboard/DashboardSkeleton.css';

type ShiftName = 'MORNING' | 'AFTERNOON' | 'NIGHT';

const SHIFT_ORDER: ShiftName[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const SHIFT_WINDOWS: Record<ShiftName, string> = {
  MORNING: '07:00 - 15:00',
  AFTERNOON: '15:00 - 23:00',
  NIGHT: '23:00 - 07:00'
};

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { todayInstances, loadTodayInstances, loading } = useChecklist();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [networkServices, setNetworkServices] = useState<NetworkService[]>([]);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (hasInitialized) return;

    const loadDashboardData = async () => {
      await loadTodayInstances();

      try {
        const [dashboardSummary, services] = await Promise.all([
          checklistApi.getDashboardSummary(),
          networkSentinelApi.listServices()
        ]);
        setDashboardData(dashboardSummary);
        setNetworkServices(services);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadDashboardData();
    setHasInitialized(true);

    const interval = setInterval(() => {
      loadDashboardData();
    }, 30000);

    return () => clearInterval(interval);
  }, [hasInitialized, loadTodayInstances]);

  const commandMetrics = useMemo(() => {
    const activeInstances = todayInstances.length;
    const inProgressCount = todayInstances.filter((instance) => instance.status === 'IN_PROGRESS').length;
    const pendingReviewCount = todayInstances.filter((instance) => instance.status === 'PENDING_REVIEW').length;
    const completedCount = todayInstances.filter(
      (instance) => instance.status === 'COMPLETED' || instance.status === 'COMPLETED_WITH_EXCEPTIONS'
    ).length;
    const exceptionCount = todayInstances.filter(
      (instance) =>
        instance.status === 'COMPLETED_WITH_EXCEPTIONS' ||
        instance.status === 'INCOMPLETE' ||
        (instance.exceptions?.length ?? 0) > 0
    ).length;
    const coverageGapCount = todayInstances.filter((instance) => instance.participants.length === 0).length;

    const totalItems = todayInstances.reduce((sum, instance) => sum + instance.items.length, 0);
    const completedItems = todayInstances.reduce(
      (sum, instance) => sum + instance.items.filter((item) => item.status === 'COMPLETED').length,
      0
    );
    const actionedItems = todayInstances.reduce(
      (sum, instance) =>
        sum + instance.items.filter((item) => ['COMPLETED', 'SKIPPED', 'FAILED'].includes(item.status)).length,
      0
    );
    const criticalItems = todayInstances.reduce(
      (sum, instance) =>
        sum +
        instance.items.filter((item) => (item.severity ?? item.template_item?.severity ?? 0) >= 4).length,
      0
    );
    const openCriticalItems = todayInstances.reduce(
      (sum, instance) =>
        sum +
        instance.items.filter((item) => {
          const severity = item.severity ?? item.template_item?.severity ?? 0;
          return severity >= 4 && !['COMPLETED', 'SKIPPED'].includes(item.status);
        }).length,
      0
    );
    const participants = todayInstances.reduce((sum, instance) => sum + instance.participants.length, 0);
    const handoverCount = todayInstances.reduce((sum, instance) => sum + (instance.handover_notes?.length ?? 0), 0);

    const executionRate = totalItems > 0 ? Math.round((actionedItems / totalItems) * 100) : 0;
    const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    const criticalContainment = criticalItems > 0 ? Math.round(((criticalItems - openCriticalItems) / criticalItems) * 100) : 100;

    const postureLabel =
      exceptionCount > 0 || openCriticalItems > 0
        ? 'Elevated'
        : coverageGapCount > 0 || pendingReviewCount > 0
          ? 'Guarded'
          : activeInstances > 0
            ? 'Stable'
            : 'Standby';

    return {
      activeInstances,
      inProgressCount,
      pendingReviewCount,
      completedCount,
      exceptionCount,
      coverageGapCount,
      totalItems,
      completedItems,
      actionedItems,
      criticalItems,
      openCriticalItems,
      participants,
      handoverCount,
      executionRate,
      completionRate,
      criticalContainment,
      postureLabel
    };
  }, [todayInstances]);

  const missionBrief = useMemo(() => {
    if (commandMetrics.activeInstances === 0) {
      return 'No active operations are running right now. Start a checklist to bring the command overview online and establish the day\'s operating picture.';
    }

    if (commandMetrics.exceptionCount > 0 || commandMetrics.openCriticalItems > 0) {
      return `Operational posture needs attention. ${commandMetrics.exceptionCount} active operation${commandMetrics.exceptionCount === 1 ? '' : 's'} report exception pressure, and ${commandMetrics.openCriticalItems} high-severity task${commandMetrics.openCriticalItems === 1 ? '' : 's'} still require resolution.`;
    }

    if (commandMetrics.coverageGapCount > 0 || commandMetrics.pendingReviewCount > 0) {
      return `Operations are progressing, but supervision attention is required. ${commandMetrics.coverageGapCount} shift${commandMetrics.coverageGapCount === 1 ? '' : 's'} still need operator coverage, and ${commandMetrics.pendingReviewCount} checklist${commandMetrics.pendingReviewCount === 1 ? '' : 's'} are waiting for review.`;
    }

    return `The command overview is stable, with ${commandMetrics.executionRate}% of the current operational day\'s tasks already actioned across live checklists.`;
  }, [commandMetrics]);

  const operationalDayLabel = useMemo(() => {
    const rawDate = dashboardData?.operational_day?.checklist_date;
    if (!rawDate || typeof rawDate !== 'string') {
      return 'Operational day';
    }

    const parsed = new Date(`${rawDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return `Operational day ${rawDate}`;
    }

    return `Operational day ${parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`;
  }, [dashboardData]);

  const shiftCards = useMemo(() => {
    return SHIFT_ORDER.map((shift) => {
      const instances = todayInstances.filter((instance) => instance.shift === shift);
      const totalItems = instances.reduce((sum, instance) => sum + instance.items.length, 0);
      const actionedItems = instances.reduce(
        (sum, instance) =>
          sum + instance.items.filter((item) => ['COMPLETED', 'SKIPPED', 'FAILED'].includes(item.status)).length,
        0
      );
      const participants = instances.reduce((sum, instance) => sum + instance.participants.length, 0);
      const exceptions = instances.reduce((sum, instance) => sum + (instance.exceptions?.length ?? 0), 0);
      const readiness = totalItems > 0 ? Math.round((actionedItems / totalItems) * 100) : 0;

      return {
        shift,
        window: SHIFT_WINDOWS[shift],
        operations: instances.length,
        participants,
        exceptions,
        readiness,
        status:
          instances.length === 0
            ? 'No active thread'
            : exceptions > 0
              ? 'Exceptions tracked'
              : readiness >= 80
                ? 'On cadence'
                : 'Building momentum'
      };
    });
  }, [todayInstances]);

  const watchlist = useMemo(() => {
    const operationWatch = todayInstances
      .filter((instance) => instance.participants.length === 0 || (instance.exceptions?.length ?? 0) > 0)
      .slice(0, 4)
      .map((instance) => ({
        id: `ops-${instance.id}`,
        title: `${instance.shift} shift`,
        detail:
          instance.participants.length === 0
            ? 'No operator joined this checklist yet.'
            : `${instance.exceptions.length} exception${instance.exceptions.length === 1 ? '' : 's'} logged on this operation.`,
        tone: instance.participants.length === 0 ? 'warning' : 'critical'
      }));

    const networkWatch = networkServices
      .filter((service) => ['DOWN', 'DEGRADED'].includes(service.status?.overall_status || 'UNKNOWN'))
      .sort((a, b) => {
        const weight = (status?: string) => (status === 'DOWN' ? 2 : status === 'DEGRADED' ? 1 : 0);
        return weight(b.status?.overall_status) - weight(a.status?.overall_status);
      })
      .slice(0, 4)
      .map((service) => {
        const isDown = service.status?.overall_status === 'DOWN';
        return {
          id: `net-${service.id}`,
          title: `${service.name} (${service.status?.overall_status || 'UNKNOWN'})`,
          detail: `${service.address}${service.port ? `:${service.port}` : ''} • state since ${
            service.status?.last_state_change_at ? new Date(service.status.last_state_change_at).toLocaleString() : 'unknown'
          }`,
          tone: isDown ? 'network-down' : 'network-degraded'
        };
      });

    return [...networkWatch, ...operationWatch].slice(0, 8);
  }, [networkServices, todayInstances]);

  const handoverFeed = useMemo(() => {
    return todayInstances
      .filter((instance) => (instance.handover_notes?.length ?? 0) > 0)
      .slice(0, 4)
      .map((instance) => ({
        id: instance.id,
        shift: instance.shift,
        count: instance.handover_notes.length
      }));
  }, [todayInstances]);

  const commandSignals = [
    {
      label: 'Command posture',
      value: commandMetrics.postureLabel,
      meta: `${commandMetrics.activeInstances} live threads`,
      icon: <FaShieldAlt />
    },
    {
      label: 'Execution',
      value: `${commandMetrics.executionRate}%`,
      meta: `${commandMetrics.actionedItems}/${commandMetrics.totalItems} tasks actioned`,
      icon: <FaBolt />
    },
    {
      label: 'Containment',
      value: `${commandMetrics.criticalContainment}%`,
      meta: `${commandMetrics.openCriticalItems} critical tasks open`,
      icon: <FaCrosshairs />
    },
    {
      label: 'Staffed coverage',
      value: `${Math.max(commandMetrics.activeInstances - commandMetrics.coverageGapCount, 0)}/${commandMetrics.activeInstances}`,
      meta: `${commandMetrics.participants} operators on deck`,
      icon: <FaUserShield />
    }
  ];

  const guideItems = [
    {
      title: 'Operational State',
      body: 'Summarizes the current posture of the active operational-day threads by combining exceptions, unresolved critical work, and review pressure.'
    },
    {
      title: 'Shift Radar',
      body: 'Shows each shift window, how many operations are active, how many operators are present, and how far execution has progressed.'
    },
    {
      title: 'Command Threads',
      body: 'Represents the live checklists for the current operational day. Each card shows execution progress, participation, and the current checklist status.'
    },
    {
      title: 'Operational Matrix',
      body: 'Highlights the key metrics that supervisors usually need first: critical queue, review pressure, completed threads, and coverage gaps.'
    }
  ];

  if (loading && !dashboardData) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="sentinel-dashboard sentinel-dashboard-command">
      <DashboardHeader user={user} />

      <section className="command-hero">
        <div className="command-hero-copy">
          <div className="command-hero-topbar">
            <div className="command-kicker">SentinelOps Overview</div>
          </div>
          <h2>Operational command overview</h2>
          <p>{missionBrief}</p>

          <div className="command-signal-grid">
            {commandSignals.map((signal) => (
              <article key={signal.label} className="command-signal-card">
                <div className="command-signal-icon">{signal.icon}</div>
                <div className="command-signal-copy">
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.meta}</small>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="command-hero-aside">
          <div className="command-status-panel">
            <div className="command-status-header">
              <span>Operational state</span>
              <strong>{commandMetrics.postureLabel}</strong>
            </div>

            <div className="command-status-rings">
              <div className="status-ring status-ring-primary">
                <span>{commandMetrics.completionRate}%</span>
                <small>completion</small>
              </div>
              <div className="status-ring">
                <span>{commandMetrics.pendingReviewCount}</span>
                <small>review queue</small>
              </div>
              <div className="status-ring status-ring-alert">
                <span>{commandMetrics.exceptionCount}</span>
                <small>exceptions</small>
              </div>
            </div>

            <div className="command-status-footer">
              <div>
                <span>Unread alerts</span>
                <strong>{dashboardData?.notifications_unread ?? 0}</strong>
              </div>
              <div>
                <span>Handover notes</span>
                <strong>{commandMetrics.handoverCount}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-grid command-grid">
        <div className="dashboard-left command-main">
          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2><FaSitemap /> Shift Radar</h2>
              <span className="section-badge">Current state</span>
            </div>

            <div className="shift-radar-grid">
              {shiftCards.map((shift) => (
                <article key={shift.shift} className="shift-radar-card">
                  <div className="shift-radar-topline">
                    <span>{shift.shift}</span>
                    <small>{shift.window}</small>
                  </div>
                  <strong>{shift.status}</strong>
                  <div className="shift-radar-meter">
                    <div className="shift-radar-fill" style={{ width: `${shift.readiness}%` }} />
                  </div>
                  <div className="shift-radar-stats">
                    <span>{shift.operations} ops</span>
                    <span>{shift.participants} operators</span>
                    <span>{shift.exceptions} exceptions</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2><FaClipboardCheck /> Operational Day Command Threads</h2>
              <span className="section-badge">{operationalDayLabel} • {todayInstances.length} Active</span>
            </div>

            <div className="checklist-grid">
              {todayInstances.length === 0 ? (
                <div className="empty-state command-empty-state">
                  <FaCalendarAlt size={44} />
                  <h3>No active operations in the queue</h3>
                  <p>Start a checklist to establish visibility, ownership, and execution tracking for the current operational day.</p>
                </div>
              ) : (
                todayInstances.map((instance) => <ChecklistCard key={instance.id} instance={instance} />)
              )}
            </div>
          </section>
        </div>

        <div className="dashboard-right command-side">
          <section className="dashboard-section command-panel command-matrix-panel">
            <div className="section-header command-section-header">
              <h2><FaSignal /> Operational Matrix</h2>
            </div>

            <div className="command-matrix">
              <article className="matrix-stat matrix-stat-critical">
                <span>Critical queue</span>
                <strong>{commandMetrics.openCriticalItems}</strong>
                <small>{commandMetrics.criticalItems} high-severity tasks observed</small>
              </article>
              <article className="matrix-stat">
                <span>Review pressure</span>
                <strong>{commandMetrics.pendingReviewCount}</strong>
                <small>checklists waiting for supervisor sign-off</small>
              </article>
              <article className="matrix-stat">
                <span>Completed threads</span>
                <strong>{commandMetrics.completedCount}</strong>
                <small>operations closed or closed with exceptions</small>
              </article>
              <article className="matrix-stat">
                <span>Coverage gaps</span>
                <strong>{commandMetrics.coverageGapCount}</strong>
                <small>active shifts missing operator presence</small>
              </article>
            </div>
          </section>

          <QuickActions />

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
                <h2><FaExclamationTriangle /> Attention Queue</h2>
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

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
                <h2><FaArrowTrendUp /> Handover Summary</h2>
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
        </div>
      </div>

      {showGuide && (
        <div className="dashboard-guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="dashboard-guide-panel" onClick={(event) => event.stopPropagation()}>
            <div className="dashboard-guide-header">
              <div>
                <span className="dashboard-guide-kicker">SentinelOps Guide</span>
                <h3>Understanding the command overview</h3>
              </div>
              <button type="button" className="dashboard-guide-close" onClick={() => setShowGuide(false)}>
                ×
              </button>
            </div>

            <p className="dashboard-guide-intro">
              This view is designed to help operators and supervisors understand the current operational day quickly:
              what is active, what needs attention, and where intervention is most useful.
            </p>

            <div className="dashboard-guide-grid">
              {guideItems.map((item) => (
                <article key={item.title} className="dashboard-guide-card">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="dashboard-guide-footer">
              <div className="guide-footer-card">
                <span>Recommended habit</span>
                <p>Start with Operational State, scan Shift Radar, then open any command thread that shows exceptions or limited coverage.</p>
              </div>
              <div className="guide-footer-card">
                <span>SentinelOps principle</span>
                <p>The dashboard favors awareness over noise: every panel should help the team decide where to act next.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <PageGuide guide={pageGuides.dashboard} />
    </div>
  );
};

export default DashboardPage;
