import React, { useEffect, useState } from 'react';
import {
  FaBolt,
  FaBullseye,
  FaChartLine,
  FaCheckCircle,
  FaClock,
  FaCloudSun,
  FaCrown,
  FaFire,
  FaLink,
  FaMedal,
  FaMoon,
  FaShieldAlt,
  FaStar,
  FaSun,
  FaTrophy,
  FaUsers,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useNotifications } from '../contexts/NotificationContext';
import {
  PerformanceBadge,
  PerformanceCommandResponse,
  PerformanceLeaderboardEntry,
  PerformanceRecentEvent,
  PerformanceTrendPoint,
  PerformanceWindowKey,
  PerformanceWindowSnapshot,
  performanceApi,
} from '../services/performanceApi';
import './PerformancePage.css';

const WINDOW_ORDER: PerformanceWindowKey[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

const WINDOW_BUTTON_LABELS: Record<PerformanceWindowKey, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const BADGE_ICON_MAP: Record<string, React.ReactNode> = {
  flow: <FaChartLine />,
  shield: <FaShieldAlt />,
  bolt: <FaBolt />,
  relay: <FaLink />,
  orbit: <FaFire />,
  moon: <FaMoon />,
  sunrise: <FaSun />,
  sun: <FaCloudSun />,
  allies: <FaUsers />,
  clock: <FaClock />,
  crown: <FaCrown />,
};

function formatPoints(value: number): string {
  return new Intl.NumberFormat('en-US').format(value || 0);
}

function formatRate(value: number): string {
  return `${Math.round(value || 0)}%`;
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} - ${endLabel}`;
}

function formatGeneratedAt(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEventTime(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventLabel(eventType: string): string {
  switch (eventType) {
    case 'TASK':
      return 'Task closed';
    case 'HANDOVER_CREATED':
      return 'Handover logged';
    case 'HANDOVER_RESOLVED':
      return 'Handover resolved';
    default:
      return 'Checklist action';
  }
}

function getBadgeIcon(icon: string): React.ReactNode {
  return BADGE_ICON_MAP[icon] || <FaStar />;
}

function getOrderedBadges(badges: PerformanceBadge[]): PerformanceBadge[] {
  return [...badges].sort((left, right) => {
    if (left.earned !== right.earned) {
      return Number(left.earned) - Number(right.earned);
    }

    if (!left.earned && !right.earned && left.progress !== right.progress) {
      return right.progress - left.progress;
    }

    return left.name.localeCompare(right.name);
  });
}

function getBadgeProgressTone(progress: number): string {
  if (progress >= 90) return 'Almost forged';
  if (progress >= 70) return 'Closing in';
  if (progress >= 45) return 'Building momentum';
  if (progress > 0) return 'Warming up';
  return 'Fresh target';
}

function getNextBadgeTarget(badges: PerformanceBadge[]): PerformanceBadge | null {
  const pendingBadges = badges.filter((badge) => !badge.earned);
  if (pendingBadges.length === 0) {
    return null;
  }

  return [...pendingBadges].sort((left, right) => {
    if (left.progress !== right.progress) {
      return right.progress - left.progress;
    }

    return left.name.localeCompare(right.name);
  })[0];
}

function applyBadgeClaimToCommandData(
  commandData: PerformanceCommandResponse,
  claimedBadge: PerformanceBadge,
  claimedBadgeCount: number
): PerformanceCommandResponse {
  const badges = commandData.badges.map((badge) => (
    badge.key === claimedBadge.key ? claimedBadge : badge
  ));

  return {
    ...commandData,
    badges,
    next_badge: getNextBadgeTarget(badges),
    profile: {
      ...commandData.profile,
      badge_count: claimedBadgeCount,
    },
  };
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`perf-skeleton ${className}`.trim()} aria-hidden="true" />;
}

function PerformanceSkeleton() {
  return (
    <div className="performance-command-page performance-skeleton-page">
      <div className="performance-ambient">
        <div className="performance-orb orb-a" />
        <div className="performance-orb orb-b" />
        <div className="performance-gridlines" />
      </div>

      <section className="performance-hero">
        <div className="hero-copy performance-skeleton-copy">
          <SkeletonBlock className="skeleton-chip" />
          <SkeletonBlock className="skeleton-title" />
          <SkeletonBlock className="skeleton-title short" />
          <SkeletonBlock className="skeleton-line" />
          <div className="hero-tags performance-skeleton-tags">
            <SkeletonBlock className="skeleton-pill" />
            <SkeletonBlock className="skeleton-pill short" />
            <SkeletonBlock className="skeleton-pill medium" />
          </div>
          <div className="window-switcher performance-skeleton-switch">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonBlock key={`skeleton-switch-${index}`} className="skeleton-switch-pill" />
            ))}
          </div>
        </div>

        <div className="hero-identity performance-skeleton-identity">
          <div className="command-orb">
            <div className="command-orb-core">
              <SkeletonBlock className="skeleton-circle-score" />
              <SkeletonBlock className="skeleton-line tiny" />
              <SkeletonBlock className="skeleton-line tiny short" />
            </div>
          </div>
          <div className="identity-card">
            <SkeletonBlock className="skeleton-chip short" />
            <SkeletonBlock className="skeleton-line medium" />
            <div className="identity-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-identity-${index}`}>
                  <SkeletonBlock className="skeleton-caption" />
                  <SkeletonBlock className="skeleton-line tiny" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="window-summary-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`skeleton-window-${index}`} className="summary-window-card">
            <div className="summary-window-top">
              <SkeletonBlock className="skeleton-chip short" />
              <SkeletonBlock className="skeleton-chip compact" />
            </div>
            <SkeletonBlock className="skeleton-number" />
            <SkeletonBlock className="skeleton-line tiny medium" />
            <div className="summary-window-metrics">
              {Array.from({ length: 3 }).map((__, metricIndex) => (
                <div key={`skeleton-window-metric-${index}-${metricIndex}`}>
                  <SkeletonBlock className="skeleton-caption" />
                  <SkeletonBlock className="skeleton-line tiny" />
                </div>
              ))}
            </div>
            <SkeletonBlock className="skeleton-line" />
            <SkeletonBlock className="skeleton-line medium" />
          </article>
        ))}
      </section>

      <section className="signal-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={`skeleton-signal-${index}`} className="signal-card">
            <SkeletonBlock className="skeleton-chip short" />
            <SkeletonBlock className="skeleton-number short" />
            <SkeletonBlock className="skeleton-line tiny medium" />
          </article>
        ))}
      </section>

      <section className="performance-main-grid">
        <div className="performance-primary-column">
          <section className="performance-panel briefing-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <SkeletonBlock className="skeleton-line" />
            <div className="breakdown-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`skeleton-breakdown-${index}`}>
                  <SkeletonBlock className="skeleton-caption" />
                  <SkeletonBlock className="skeleton-line tiny" />
                </article>
              ))}
            </div>
            <div className="briefing-metrics">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-briefing-${index}`}>
                  <SkeletonBlock className="skeleton-caption" />
                  <SkeletonBlock className="skeleton-line tiny" />
                </div>
              ))}
            </div>
          </section>

          <section className="performance-panel trend-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <div className="trend-chart performance-skeleton-trend">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`skeleton-trend-${index}`} className="trend-bar-group">
                  <div className="trend-bar-shell">
                    <SkeletonBlock className="skeleton-trend-grade" />
                    <SkeletonBlock className="skeleton-trend-bar" />
                  </div>
                  <SkeletonBlock className="skeleton-caption medium" />
                  <SkeletonBlock className="skeleton-caption short" />
                </div>
              ))}
            </div>
          </section>

          <section className="performance-panel activity-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <div className="activity-list">
              {Array.from({ length: 3 }).map((_, index) => (
                <article key={`skeleton-activity-${index}`} className="activity-row">
                  <SkeletonBlock className="skeleton-number compact" />
                  <div className="activity-copy">
                    <SkeletonBlock className="skeleton-line medium" />
                    <SkeletonBlock className="skeleton-line" />
                    <SkeletonBlock className="skeleton-line short" />
                  </div>
                  <SkeletonBlock className="skeleton-caption short" />
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="performance-secondary-column">
          <section className="performance-panel leaderboard-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <div className="leaderboard-list">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`skeleton-leader-${index}`} className="leaderboard-row">
                  <SkeletonBlock className="skeleton-rank" />
                  <div className="leaderboard-copy">
                    <SkeletonBlock className="skeleton-line medium" />
                    <SkeletonBlock className="skeleton-line short tiny" />
                  </div>
                  <div className="leaderboard-meta">
                    <SkeletonBlock className="skeleton-line short tiny" />
                    <SkeletonBlock className="skeleton-line tiny" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="performance-panel badge-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <div className="badge-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`skeleton-badge-${index}`} className="badge-card">
                  <SkeletonBlock className="skeleton-badge-icon" />
                  <div className="badge-copy">
                    <SkeletonBlock className="skeleton-line medium" />
                    <SkeletonBlock className="skeleton-line" />
                  </div>
                  <div className="badge-progress">
                    <div className="badge-track"><span style={{ width: '55%' }} /></div>
                    <SkeletonBlock className="skeleton-caption medium" />
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="performance-panel scoring-panel">
            <div className="panel-head">
              <div>
                <SkeletonBlock className="skeleton-chip" />
                <SkeletonBlock className="skeleton-line medium panel-title" />
              </div>
            </div>
            <div className="charter-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`skeleton-charter-${index}`}>
                  <SkeletonBlock className="skeleton-line short" />
                  <SkeletonBlock className="skeleton-line" />
                  <SkeletonBlock className="skeleton-line medium" />
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function WindowSummaryCard({
  snapshot,
  active,
  onClick,
}: {
  snapshot: PerformanceWindowSnapshot;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={`summary-window-card ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="summary-window-top">
        <span>{snapshot.label}</span>
        <strong>{snapshot.tier}</strong>
      </div>
      <div className="summary-window-score">{formatPoints(snapshot.command_points)}</div>
      <div className="summary-window-subtitle">Command points</div>
      <div className="summary-window-metrics">
        <div>
          <small>Grade</small>
          <strong>{snapshot.operational_grade}</strong>
        </div>
        <div>
          <small>Rank</small>
          <strong>#{snapshot.rank}</strong>
        </div>
        <div>
          <small>Rhythm</small>
          <strong>{snapshot.contribution_days}d</strong>
        </div>
      </div>
      <p>{snapshot.summary}</p>
    </button>
  );
}

function LeaderboardPanel({ entries }: { entries: PerformanceLeaderboardEntry[] }) {
  return (
    <section className="performance-panel leaderboard-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Command Ladder</span>
          <h2><FaTrophy /> Visible Leaderboard</h2>
        </div>
      </div>
      <div className="leaderboard-list">
        {entries.map((entry) => (
          <div key={entry.user_id} className={`leaderboard-row ${entry.is_current_user ? 'current-user' : ''}`}>
            <div className="leaderboard-rank">{entry.rank}</div>
            <div className="leaderboard-copy">
              <strong>{entry.display_name}{entry.is_current_user ? ' (You)' : ''}</strong>
              <span>{entry.section_name || 'SentinelOps'} - {entry.tier} tier</span>
            </div>
            <div className="leaderboard-meta">
              <small>{entry.clean_checklists} clean runs - {entry.tasks_completed} tasks</small>
              <strong>{formatPoints(entry.command_points)}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function BadgePanel({
  badges,
  nextBadge,
  claimingBadgeKey,
  onClaim,
}: {
  badges: PerformanceBadge[];
  nextBadge?: PerformanceBadge | null;
  claimingBadgeKey: string | null;
  onClaim: (badgeKey: string) => void;
}) {
  const orderedBadges = getOrderedBadges(badges);
  const claimableBadges = orderedBadges.filter((badge) => badge.claimable);
  const queueBadges = orderedBadges.filter((badge) => !badge.claimable && !badge.claimed);
  const claimedBadges = orderedBadges.filter((badge) => badge.claimed);
  const focusClaimBadge = claimableBadges[0] || null;
  const readyQueue = focusClaimBadge
    ? claimableBadges.filter((badge) => badge.key !== focusClaimBadge.key)
    : claimableBadges;
  const focusProgressBadge = !focusClaimBadge ? (queueBadges[0] || nextBadge || null) : null;

  return (
    <section id="badge-forge" className="performance-panel badge-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Badge Forge</span>
          <h2><FaMedal /> Yearly Badges</h2>
        </div>
        <div className="badge-panel-summary">
          <div>
            <small>Claimed</small>
            <strong>{claimedBadges.length}/{badges.length}</strong>
          </div>
          <div>
            <small>Ready</small>
            <strong>{claimableBadges.length}</strong>
          </div>
          <div>
            <small>In queue</small>
            <strong>{queueBadges.length}</strong>
          </div>
        </div>
      </div>

      {focusClaimBadge ? (
        <article className={`badge-focus-card theme-${focusClaimBadge.theme} claim-ready`}>
          <div className="badge-focus-top">
            <div className="badge-icon badge-focus-icon">{getBadgeIcon(focusClaimBadge.icon)}</div>
            <div className="badge-focus-copy">
              <span className="badge-status-chip">Ready to claim</span>
              <strong>{focusClaimBadge.name}</strong>
              <p>{focusClaimBadge.description}</p>
            </div>
            <div className="badge-focus-progress">
              <strong>Ready</strong>
              <small>Unlock achieved</small>
            </div>
          </div>
          <div className="badge-progress">
            <div className="badge-track">
              <span style={{ width: '100%' }} />
            </div>
          </div>
          <div className="badge-focus-notes">
            <span>{focusClaimBadge.target}</span>
            <p>{focusClaimBadge.hint}</p>
          </div>
          <div className="badge-focus-actions">
            <button
              type="button"
              className="badge-claim-button"
              onClick={() => onClaim(focusClaimBadge.key)}
              disabled={claimingBadgeKey === focusClaimBadge.key}
            >
              {claimingBadgeKey === focusClaimBadge.key ? 'Claiming...' : 'Claim badge'}
            </button>
            <small>Claimed badges move into your forge archive below.</small>
          </div>
        </article>
      ) : focusProgressBadge ? (
        <article className={`badge-focus-card theme-${focusProgressBadge.theme}`}>
          <div className="badge-focus-top">
            <div className="badge-icon badge-focus-icon">{getBadgeIcon(focusProgressBadge.icon)}</div>
            <div className="badge-focus-copy">
              <span className="badge-status-chip">{getBadgeProgressTone(focusProgressBadge.progress)}</span>
              <strong>{focusProgressBadge.name}</strong>
              <p>{focusProgressBadge.description}</p>
            </div>
            <div className="badge-focus-progress">
              <strong>{Math.round(focusProgressBadge.progress)}%</strong>
              <small>Closest unlock</small>
            </div>
          </div>
          <div className="badge-progress">
            <div className="badge-track">
              <span style={{ width: `${Math.max(6, focusProgressBadge.progress)}%` }} />
            </div>
          </div>
          <div className="badge-focus-notes">
            <span>{focusProgressBadge.target}</span>
            <p>{focusProgressBadge.hint}</p>
          </div>
        </article>
      ) : (
        <div className="badge-forge-complete">
          <strong>Every yearly badge is already claimed.</strong>
          <p>The forge is fully stocked, so this panel can stay quiet while the command score keeps moving.</p>
        </div>
      )}

      {readyQueue.length > 0 && (
        <div className="badge-section">
          <div className="badge-section-head">
            <span>Ready to claim</span>
            <small>{readyQueue.length} more unlocked badges</small>
          </div>
          <div className="badge-ready-grid">
            {readyQueue.map((badge) => (
              <article key={badge.key} className={`badge-ready-card theme-${badge.theme}`}>
                <div className="badge-icon">{getBadgeIcon(badge.icon)}</div>
                <div className="badge-ready-copy">
                  <strong>{badge.name}</strong>
                  <p>Unlock achieved. Claim it to pin it into your forge.</p>
                </div>
                <button
                  type="button"
                  className="badge-claim-button compact"
                  onClick={() => onClaim(badge.key)}
                  disabled={claimingBadgeKey === badge.key}
                >
                  {claimingBadgeKey === badge.key ? 'Claiming...' : 'Claim'}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}

      {queueBadges.length > 0 && (
        <div className="badge-section">
          <div className="badge-section-head">
            <span>Unlock queue</span>
            <small>Nearest unlocks first</small>
          </div>
          <div className="badge-queue">
            {queueBadges.map((badge) => (
              <article key={badge.key} className={`badge-queue-card theme-${badge.theme}`}>
                <div className="badge-icon">{getBadgeIcon(badge.icon)}</div>
                <div className="badge-queue-copy">
                  <strong>{badge.name}</strong>
                  <p>{badge.hint}</p>
                </div>
                <div className="badge-queue-progress">
                  <strong>{Math.round(badge.progress)}%</strong>
                  <small>{getBadgeProgressTone(badge.progress)}</small>
                </div>
                <div className="badge-progress">
                  <div className="badge-track compact">
                    <span style={{ width: `${Math.max(6, badge.progress)}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {claimedBadges.length > 0 && (
        <div className="badge-section">
          <div className="badge-section-head">
            <span>Forged</span>
            <small>{claimedBadges.length} claimed badges</small>
          </div>
          <div className="badge-earned-grid">
            {claimedBadges.map((badge) => (
              <article key={badge.key} className={`badge-earned-card theme-${badge.theme}`}>
                <div className="badge-icon">{getBadgeIcon(badge.icon)}</div>
                <div className="badge-earned-copy">
                  <strong>{badge.name}</strong>
                  <small>Claimed</small>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ActivityPanel({ events }: { events: PerformanceRecentEvent[] }) {
  return (
    <section className="performance-panel activity-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Operational Feed</span>
          <h2><FaFire /> Recent Wins</h2>
        </div>
      </div>
      <div className="activity-list">
        {events.length === 0 ? (
          <div className="empty-state">Fresh activity will appear here as the window fills with real execution.</div>
        ) : (
          events.map((event) => (
            <article key={event.id} className="activity-row">
              <div className="activity-points">+{event.points}</div>
              <div className="activity-copy">
                <strong>{getEventLabel(event.event_type)}</strong>
                <span>{event.title}</span>
                <p>{event.detail}</p>
              </div>
              <time>{formatEventTime(event.occurred_at)}</time>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function TrendPanel({ trend }: { trend: PerformanceTrendPoint[] }) {
  const maxPoints = Math.max(...trend.map((point) => point.command_points), 1);
  return (
    <section className="performance-panel trend-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Trendline</span>
          <h2><FaChartLine /> Command Momentum</h2>
        </div>
      </div>
      <div className="trend-chart">
        {trend.map((point) => {
          const height = Math.max(10, Math.round((point.command_points / maxPoints) * 100));
          return (
            <div key={`${point.label}-${point.period_start}`} className="trend-bar-group">
              <div className="trend-bar-shell">
                <div className="trend-grade-badge">{point.operational_grade}</div>
                <div className="trend-bar" style={{ height: `${height}%` }} />
              </div>
              <strong>{point.label}</strong>
              <span>{formatPoints(point.command_points)} pts</span>
              <small>{point.tasks_completed} tasks - {point.checklist_items_completed} checks</small>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScoringPanel({ snapshot }: { snapshot: PerformanceWindowSnapshot }) {
  return (
    <section className="performance-panel scoring-panel">
      <div className="panel-head">
        <div>
          <span className="panel-kicker">Scoring Charter</span>
          <h2><FaBullseye /> Why the score is fair</h2>
        </div>
      </div>
      <div className="charter-grid">
        <article>
          <strong>Execution</strong>
          <p>Checklist item work, subitem throughput, and task closures create the raw command point engine.</p>
        </article>
        <article>
          <strong>Reliability</strong>
          <p>On-time task delivery, timed starts, clean runs, staffed shifts, and sustained streaks keep output from being hollow.</p>
        </article>
        <article>
          <strong>Collaboration</strong>
          <p>Shared checklist execution, collaborative tasks, and handover motion raise the score when operators actively help each other move the shift.</p>
        </article>
        <article>
          <strong>Quality Control</strong>
          <p>Critical actions add weight, while overdue backlog and repeated lateness deductions stop sloppy volume from dominating the board.</p>
        </article>
      </div>
      <div className="charter-summary">
        <span>Active window</span>
        <strong>{snapshot.label}</strong>
        <p>{snapshot.summary}</p>
      </div>
    </section>
  );
}

const PerformancePage: React.FC = () => {
  const { addNotification } = useNotifications();
  const [focusWindow, setFocusWindow] = useState<PerformanceWindowKey>('monthly');
  const [commandData, setCommandData] = useState<PerformanceCommandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingBadgeKey, setClaimingBadgeKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCommandDeck() {
      setLoading(true);
      setError(null);
      try {
        const response = await performanceApi.getPerformanceCommand(focusWindow);
        if (!cancelled) {
          setCommandData(response);
        }
      } catch (loadError) {
        console.error('Failed to load performance command deck:', loadError);
        if (!cancelled) {
          setError('Performance intelligence is temporarily unavailable.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadCommandDeck();
    return () => {
      cancelled = true;
    };
  }, [focusWindow]);

  const activeWindow = commandData?.active_window;
  const windows = commandData?.windows;

  const handleBadgeClaim = async (badgeKey: string) => {
    setClaimingBadgeKey(badgeKey);
    try {
      const response = await performanceApi.claimPerformanceBadge(badgeKey);
      setCommandData((current) => (
        current ? applyBadgeClaimToCommandData(current, response.badge, response.claimed_badge_count) : current
      ));
      addNotification({
        type: 'success',
        title: 'Badge claimed',
        message: `${response.badge.name} is now locked into your forge.`,
        priority: 'medium',
      });
    } catch (claimError) {
      console.error('Failed to claim performance badge:', claimError);
      const message = (claimError as any)?.response?.data?.detail || 'The badge could not be claimed right now.';
      addNotification({
        type: 'error',
        title: 'Claim failed',
        message,
        priority: 'high',
      });
    } finally {
      setClaimingBadgeKey(null);
    }
  };

  if (loading && !commandData) {
    return <PerformanceSkeleton />;
  }

  if (error || !commandData || !activeWindow || !windows) {
    return (
      <div className="performance-command-page loading-state">
        <div className="performance-loading-card error-state">
          <FaBolt />
          <strong>{error || 'Performance intelligence is unavailable.'}</strong>
          <span>Retry the page once the backend finishes loading the command data.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="performance-command-page">
      <div className="performance-ambient">
        <div className="performance-orb orb-a" />
        <div className="performance-orb orb-b" />
        <div className="performance-gridlines" />
      </div>

      <section className="performance-hero">
        <div className="hero-copy">
          <span className="hero-kicker">Performance Intelligence</span>
          <p>
            This command deck blends checklist execution, task closure, collaboration, handovers, and rhythm into
            one fair performance signal. The goal is not noise. It is trustworthy momentum.
          </p>
          <div className="hero-tags">
            <span>{commandData.scope_label}</span>
            <span>Updated {formatGeneratedAt(commandData.generated_at)}</span>
            <span>{commandData.profile.badge_count} badges claimed</span>
          </div>
          <div className="window-switcher">
            {WINDOW_ORDER.map((windowKey) => (
              <button
                key={windowKey}
                type="button"
                className={focusWindow === windowKey ? 'active' : ''}
                onClick={() => setFocusWindow(windowKey)}
              >
                {WINDOW_BUTTON_LABELS[windowKey]}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-identity">
          <div className="command-orb">
            <div className="command-orb-core">
              <small>{activeWindow.tier}</small>
              <strong>{formatPoints(activeWindow.command_points)}</strong>
              <span>Command Points</span>
            </div>
          </div>
          <div className="identity-card">
            <span>{commandData.profile.display_name}</span>
            <strong>Grade {activeWindow.operational_grade}</strong>
            <p>{formatDateRange(activeWindow.start_date, activeWindow.end_date)}</p>
            <div className="identity-grid">
              <div><small>Rank</small><strong>#{activeWindow.rank}</strong></div>
              <div><small>Streak</small><strong>{activeWindow.current_streak}d</strong></div>
              <div><small>Clean Runs</small><strong>{activeWindow.clean_checklists}</strong></div>
              <div><small>Tasks</small><strong>{activeWindow.tasks_completed}</strong></div>
            </div>
          </div>
        </div>
      </section>

      <section className="window-summary-grid">
        {WINDOW_ORDER.map((windowKey) => (
          <WindowSummaryCard
            key={windowKey}
            snapshot={windows[windowKey]}
            active={focusWindow === windowKey}
            onClick={() => setFocusWindow(windowKey)}
          />
        ))}
      </section>

      <section className="signal-strip">
        <article className="signal-card"><span>Task On-Time</span><strong>{formatRate(activeWindow.task_on_time_rate)}</strong></article>
        <article className="signal-card"><span>Checklist Quality</span><strong>{formatRate(activeWindow.checklist_quality_rate)}</strong></article>
        <article className="signal-card"><span>Shift Adherence</span><strong>{formatRate(activeWindow.shift_adherence_rate)}</strong></article>
        <article className="signal-card"><span>Consistency</span><strong>{formatRate(activeWindow.consistency_rate)}</strong></article>
      </section>

      <section className="performance-main-grid">
        <div className="performance-primary-column">
          <section className="performance-panel briefing-panel">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Operational Briefing</span>
                <h2><FaCheckCircle /> {activeWindow.label}</h2>
              </div>
            </div>
            <p className="briefing-summary">{activeWindow.summary}</p>
            <div className="breakdown-grid">
              <article><span>Execution</span><strong>{formatPoints(activeWindow.breakdown.execution_points)}</strong></article>
              <article><span>Reliability</span><strong>{formatPoints(activeWindow.breakdown.reliability_points)}</strong></article>
              <article><span>Collaboration</span><strong>{formatPoints(activeWindow.breakdown.collaboration_points)}</strong></article>
              <article><span>Quality</span><strong>{formatPoints(activeWindow.breakdown.quality_points)}</strong></article>
            </div>
            <div className="briefing-metrics">
              <div><small>Checklist actions</small><strong>{activeWindow.items_completed}</strong></div>
              <div><small>Critical actions</small><strong>{activeWindow.critical_items_completed + activeWindow.critical_tasks_completed}</strong></div>
              <div><small>Handovers moved</small><strong>{activeWindow.handovers_created + activeWindow.handovers_resolved}</strong></div>
              <div><small>Overdue load</small><strong>{activeWindow.overdue_open_tasks}</strong></div>
            </div>
          </section>

          <TrendPanel trend={commandData.trend} />
          <ActivityPanel events={commandData.recent_events} />
          <ScoringPanel snapshot={activeWindow} />
        </div>

        <div className="performance-secondary-column">
          <LeaderboardPanel entries={commandData.leaderboard} />
          <BadgePanel
            badges={commandData.badges}
            nextBadge={commandData.next_badge}
            claimingBadgeKey={claimingBadgeKey}
            onClaim={handleBadgeClaim}
          />
        </div>
      </section>

      <PageGuide guide={pageGuides.performance} />
    </div>
  );
};

export default PerformancePage;
