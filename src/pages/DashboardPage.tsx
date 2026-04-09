import React, { useMemo, useState } from 'react';
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
import { useDashboardSnapshot } from '../hooks/useDashboardSnapshot';
import { OperationalDashboardSummary } from '../services/checklistApi';
import './DashboardPage.css';
import '../components/dashboard/DashboardSkeleton.css';

type ShiftName = 'MORNING' | 'AFTERNOON' | 'NIGHT';

const SHIFT_ORDER: ShiftName[] = ['MORNING', 'AFTERNOON', 'NIGHT'];
const SHIFT_WINDOWS: Record<ShiftName, string> = {
  MORNING: '07:00 - 15:00',
  AFTERNOON: '15:00 - 23:00',
  NIGHT: '23:00 - 07:00'
};

const EMPTY_DASHBOARD_SNAPSHOT: OperationalDashboardSummary = {
  operational_day: {
    checklist_date: '',
    window_start: '',
    window_end: '',
    timezone: '',
    boundary_time: ''
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
    posture_label: 'Standby'
  },
  shift_cards: SHIFT_ORDER.map((shift) => ({
    shift,
    window: SHIFT_WINDOWS[shift],
    operations: 0,
    participants: 0,
    exceptions: 0,
    readiness: 0,
    status: 'No active thread'
  })),
  checklist_threads: [],
  attention_queue: [],
  handover_feed: [],
  notifications_unread: 0,
  generated_at: ''
};

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

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { snapshot, loading, refresh } = useDashboardSnapshot();
  const [showGuide, setShowGuide] = useState(false);

  const dashboardSnapshot = snapshot ?? EMPTY_DASHBOARD_SNAPSHOT;
  const commandMetrics = dashboardSnapshot.command_metrics;
  const checklistThreads = dashboardSnapshot.checklist_threads;
  const shiftCards = dashboardSnapshot.shift_cards;
  const watchlist = dashboardSnapshot.attention_queue;
  const handoverFeed = dashboardSnapshot.handover_feed;

  const missionBrief = useMemo(() => {
    if (commandMetrics.active_instances === 0) {
      return 'No active operations are running right now. Start a checklist to bring the command overview online and establish the day\'s operating picture.';
    }

    if (commandMetrics.exception_count > 0 || commandMetrics.open_critical_items > 0) {
      return `Operational posture needs attention. ${commandMetrics.exception_count} active operation${commandMetrics.exception_count === 1 ? '' : 's'} report exception pressure, and ${commandMetrics.open_critical_items} high-severity task${commandMetrics.open_critical_items === 1 ? '' : 's'} still require resolution.`;
    }

    if (commandMetrics.coverage_gap_count > 0 || commandMetrics.pending_review_count > 0) {
      return `Operations are progressing, but supervision attention is required. ${commandMetrics.coverage_gap_count} shift${commandMetrics.coverage_gap_count === 1 ? '' : 's'} still need operator coverage, and ${commandMetrics.pending_review_count} checklist${commandMetrics.pending_review_count === 1 ? '' : 's'} are waiting for review.`;
    }

    return `The command overview is stable, with ${commandMetrics.execution_rate}% of the current operational day's tasks already actioned across live checklists.`;
  }, [commandMetrics]);

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
      day: 'numeric'
    })}`;
  }, [dashboardSnapshot.operational_day.checklist_date]);

  const commandSignals = useMemo(
    () => [
      {
        label: 'Command posture',
        value: commandMetrics.posture_label,
        meta: `${commandMetrics.active_instances} live threads`,
        icon: <FaShieldAlt />
      },
      {
        label: 'Execution',
        value: `${commandMetrics.execution_rate}%`,
        meta: `${commandMetrics.actioned_items}/${commandMetrics.total_items} tasks actioned`,
        icon: <FaBolt />
      },
      {
        label: 'Containment',
        value: `${commandMetrics.critical_containment}%`,
        meta: `${commandMetrics.open_critical_items} critical tasks open`,
        icon: <FaCrosshairs />
      },
      {
        label: 'Staffed coverage',
        value: `${Math.max(commandMetrics.active_instances - commandMetrics.coverage_gap_count, 0)}/${commandMetrics.active_instances}`,
        meta: `${commandMetrics.participants} operators on deck`,
        icon: <FaUserShield />
      }
    ],
    [commandMetrics]
  );

  if (loading && !snapshot) {
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
              <strong>{commandMetrics.posture_label}</strong>
            </div>

            <div className="command-status-rings">
              <div className="status-ring status-ring-primary">
                <span>{commandMetrics.completion_rate}%</span>
                <small>completion</small>
              </div>
              <div className="status-ring">
                <span>{commandMetrics.pending_review_count}</span>
                <small>review queue</small>
              </div>
              <div className="status-ring status-ring-alert">
                <span>{commandMetrics.exception_count}</span>
                <small>exceptions</small>
              </div>
            </div>

            <div className="command-status-footer">
              <div>
                <span>Unread alerts</span>
                <strong>{dashboardSnapshot.notifications_unread}</strong>
              </div>
              <div>
                <span>Handover notes</span>
                <strong>{commandMetrics.handover_count}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="dashboard-grid command-grid">
        <div className="dashboard-left command-main">
          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaSitemap /> Shift Radar
              </h2>
              <span className="section-badge">Current state</span>
            </div>

            <div className="shift-radar-grid">
              {shiftCards.map((shiftCard) => (
                <article key={shiftCard.shift} className="shift-radar-card">
                  <div className="shift-radar-topline">
                    <span>{shiftCard.shift}</span>
                    <small>{shiftCard.window}</small>
                  </div>
                  <strong>{shiftCard.status}</strong>
                  <div className="shift-radar-meter">
                    <div className="shift-radar-fill" style={{ width: `${shiftCard.readiness}%` }} />
                  </div>
                  <div className="shift-radar-stats">
                    <span>{shiftCard.operations} ops</span>
                    <span>{shiftCard.participants} operators</span>
                    <span>{shiftCard.exceptions} exceptions</span>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-section command-panel">
            <div className="section-header command-section-header">
              <h2>
                <FaClipboardCheck /> Operational Day Command Threads
              </h2>
              <span className="section-badge">
                {operationalDayLabel} | {checklistThreads.length} Active
              </span>
            </div>

            <div className="checklist-grid">
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
        </div>

        <div className="dashboard-right command-side">
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
                <small>{commandMetrics.critical_items} high-severity tasks observed</small>
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

          <QuickActions
            onRefresh={async () => {
              await refresh({ background: true });
            }}
            existingThreads={checklistThreads}
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
                x
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
