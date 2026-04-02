import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCalendarAlt,
  FaCalendarDay,
  FaCalendarWeek,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFilter,
  FaHourglassHalf,
  FaLayerGroup,
  FaPlayCircle,
  FaSearch,
  FaSignal,
  FaTrash,
} from 'react-icons/fa';
import {
  addDays,
  addWeeks,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';
import { checklistApi } from '../services/checklistApi';
import centralizedWebSocketManager from '../services/centralizedWebSocketManager';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { useChecklist } from '../contexts/checklistContext';
import { ChecklistsSkeleton } from '../components/dashboard';
import { pageGuides } from '../content/pageGuides';
import type { ChecklistInstance, ChecklistInstanceQueryParams } from '../services/checklistApi';
import './ChecklistsPage.css';
import '../components/dashboard/ChecklistsSkeleton.css';

type DateFilterMode = 'all' | 'week' | 'day' | 'range';
const CHECKLIST_INIT_HOUR = 6;

const shiftOrder: Record<string, number> = {
  MORNING: 0,
  AFTERNOON: 1,
  NIGHT: 2,
};

const formatIsoDate = (date: Date) => format(date, 'yyyy-MM-dd');

const formatRangeLabel = (start?: string, end?: string) => {
  if (!start && !end) return 'All recorded time';
  if (start && end && start === end) return format(parseISO(start), 'EEEE, MMM d, yyyy');
  if (start && end) {
    return `${format(parseISO(start), 'MMM d')} - ${format(parseISO(end), 'MMM d, yyyy')}`;
  }
  if (start) return `From ${format(parseISO(start), 'MMM d, yyyy')}`;
  return `Until ${format(parseISO(end!), 'MMM d, yyyy')}`;
};

const ChecklistsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { deleteInstance: deleteChecklistInstance } = useChecklist();

  const [instances, setInstances] = useState<ChecklistInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>('week');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [instancesPerPage] = useState(18);
  const [totalInstances, setTotalInstances] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [todayShiftCoverage, setTodayShiftCoverage] = useState<Record<'MORNING' | 'AFTERNOON' | 'NIGHT', number>>({
    MORNING: 0,
    AFTERNOON: 0,
    NIGHT: 0,
  });
  const [clockTick, setClockTick] = useState(() => new Date());
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => setClockTick(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const canDeleteInstance = (currentUser: typeof user) => {
    if (!currentUser) return false;
    const role = currentUser.role?.toUpperCase?.() || currentUser.role;
    return role === 'ADMIN' || role === 'MANAGER';
  };

  const resolvedWindow = useMemo(() => {
    switch (dateFilterMode) {
      case 'all':
        return { start: undefined, end: undefined, label: 'All recorded time' };
      case 'day': {
        const date = startDate || formatIsoDate(anchorDate);
        return { start: date, end: date, label: formatRangeLabel(date, date) };
      }
      case 'range': {
        const normalizedStart = startDate || undefined;
        const normalizedEnd = endDate || undefined;

        if (normalizedStart && normalizedEnd && normalizedStart > normalizedEnd) {
          return {
            start: normalizedEnd,
            end: normalizedStart,
            label: formatRangeLabel(normalizedEnd, normalizedStart),
          };
        }

        return {
          start: normalizedStart,
          end: normalizedEnd,
          label: formatRangeLabel(normalizedStart, normalizedEnd),
        };
      }
      case 'week':
      default: {
        const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 });
        const start = formatIsoDate(weekStart);
        const end = formatIsoDate(weekEnd);
        return { start, end, label: formatRangeLabel(start, end) };
      }
    }
  }, [anchorDate, dateFilterMode, endDate, startDate]);

  const queryParams = useMemo<ChecklistInstanceQueryParams>(() => {
    const params: ChecklistInstanceQueryParams = {
      page: currentPage,
      limit: instancesPerPage,
      sort_by: 'checklist_date',
      sort_order: 'desc',
    };

    if (resolvedWindow.start) params.start_date = resolvedWindow.start;
    if (resolvedWindow.end) params.end_date = resolvedWindow.end;
    if (shiftFilter !== 'all') params.shift = shiftFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (searchTerm.trim()) params.search = searchTerm.trim();

    return params;
  }, [currentPage, instancesPerPage, resolvedWindow.end, resolvedWindow.start, searchTerm, shiftFilter, statusFilter]);

  const loadInstances = useCallback(async () => {
    if (hasLoadedRef.current) setRefreshing(true);

    try {
      let pageData: ChecklistInstance[] = [];
      let total = 0;
      let pages = 0;
      let next = false;

      try {
        const response = await checklistApi.getInstancesPaginated(queryParams);
        pageData = response.data || [];
        total = response.pagination.total || pageData.length;
        pages = response.pagination.totalPages || 1;
        next = response.pagination.hasNext;
      } catch (paginatedError) {
        const fallback = await checklistApi.getAllInstances(queryParams.start_date, queryParams.end_date, queryParams.shift);
        let filtered = [...fallback];

        if (queryParams.status) {
          filtered = filtered.filter((instance) => instance.status === queryParams.status);
        }

        if (queryParams.search) {
          const term = queryParams.search.toLowerCase();
          filtered = filtered.filter((instance) => {
            const source = [
              instance.template?.name,
              instance.shift,
              instance.status,
              instance.checklist_date,
              instance.id,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            return source.includes(term);
          });
        }

        filtered.sort((left, right) => {
          const dateDiff = new Date(right.checklist_date).getTime() - new Date(left.checklist_date).getTime();
          if (dateDiff !== 0) return dateDiff;
          return (shiftOrder[left.shift] ?? 9) - (shiftOrder[right.shift] ?? 9);
        });

        total = filtered.length;
        pages = Math.max(1, Math.ceil(total / instancesPerPage));
        const pageStart = (currentPage - 1) * instancesPerPage;
        const pageEnd = pageStart + instancesPerPage;
        pageData = filtered.slice(pageStart, pageEnd);
        next = pageEnd < total;
        console.warn('Falling back to non-paginated checklist query', paginatedError);
      }

      setInstances(pageData);
      setTotalInstances(total);
      setTotalPages(Math.max(1, pages));
      setHasNextPage(next);
      setError(null);
      hasLoadedRef.current = true;

      try {
        const todayInstances = await checklistApi.getTodayInstances();
        const coverage = { MORNING: 0, AFTERNOON: 0, NIGHT: 0 };
        todayInstances.forEach((instance) => {
          const shift = instance.shift as 'MORNING' | 'AFTERNOON' | 'NIGHT';
          if (shift in coverage) coverage[shift] += 1;
        });
        setTodayShiftCoverage(coverage);
      } catch (coverageError) {
        console.warn('Failed to fetch today shift coverage', coverageError);
      }
    } catch (err) {
      console.error('Failed to load instances:', err);
      setError('Failed to load checklist instances');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentPage, instancesPerPage, queryParams]);

  useEffect(() => {
    void loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    const unsubscribe = centralizedWebSocketManager.subscribe('checklists', (event: any) => {
      const payload = event?.type === 'CHECKLIST_UPDATE' ? event?.data : event;
      const updateType = payload?.type || event?.type;
      if (!updateType) return;
      const realtimeTypes = new Set([
        'INSTANCE_CREATED',
        'INSTANCE_JOINED',
        'ITEM_UPDATED',
        'SUBITEM_UPDATED',
        'PARTICIPANT_PRESENCE_CHANGED',
      ]);
      if (!realtimeTypes.has(updateType)) return;
      void loadInstances();
    });

    return unsubscribe;
  }, [loadInstances]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearchTerm(searchDraft);
      setCurrentPage(1);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const summary = useMemo(() => {
    const data = {
      total: instances.length,
      completed: 0,
      active: 0,
      open: 0,
      exceptions: 0,
    };

    instances.forEach((instance) => {
      if (instance.status === 'COMPLETED') data.completed += 1;
      else if (instance.status === 'IN_PROGRESS') data.active += 1;
      else if (instance.status === 'OPEN') data.open += 1;
      else if (instance.status === 'COMPLETED_WITH_EXCEPTIONS' || instance.status === 'INCOMPLETE') {
        data.exceptions += 1;
      }
    });

    return data;
  }, [instances]);

  const groupedInstances = useMemo(() => {
    const grouped = new Map<string, ChecklistInstance[]>();

    const sorted = [...instances].sort((left, right) => {
      const dateDiff = new Date(right.checklist_date).getTime() - new Date(left.checklist_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (shiftOrder[left.shift] ?? 9) - (shiftOrder[right.shift] ?? 9);
    });

    sorted.forEach((instance) => {
      const collection = grouped.get(instance.checklist_date) || [];
      collection.push(instance);
      grouped.set(instance.checklist_date, collection);
    });

    return Array.from(grouped.entries());
  }, [instances]);

  const timelinePulse = useMemo(() => {
    if (!totalInstances) return 0;
    const resolved = summary.completed + summary.active;
    return Math.round((resolved / Math.max(summary.total, 1)) * 100);
  }, [summary.active, summary.completed, summary.total, totalInstances]);

  const initializationTelemetry = useMemo(() => {
    const now = clockTick;
    const deadlineToday = new Date(now);
    deadlineToday.setHours(CHECKLIST_INIT_HOUR, 0, 0, 0);
    const previousDeadline = now >= deadlineToday
      ? deadlineToday
      : new Date(deadlineToday.getTime() - 24 * 60 * 60 * 1000);
    const nextDeadline = now >= deadlineToday
      ? new Date(deadlineToday.getTime() + 24 * 60 * 60 * 1000)
      : deadlineToday;
    const cycleMs = nextDeadline.getTime() - previousDeadline.getTime();
    const elapsedMs = now.getTime() - previousDeadline.getTime();
    const progressPct = Math.max(0, Math.min(100, Math.round((elapsedMs / cycleMs) * 100)));
    const msUntil = Math.max(0, nextDeadline.getTime() - now.getTime());
    const hoursUntil = Math.floor(msUntil / 3_600_000);
    const minsUntil = Math.floor((msUntil % 3_600_000) / 60_000);

    const initializedShifts = Object.values(todayShiftCoverage).filter((count) => count > 0).length;
    const readinessPct = Math.round((initializedShifts / 3) * 100);

    return {
      nextDeadline,
      progressPct,
      countdown: `${hoursUntil}h ${minsUntil}m`,
      readinessPct,
      initializedShifts,
    };
  }, [clockTick, todayShiftCoverage]);

  const handleInstanceClick = (instance: ChecklistInstance) => {
    if (instance.id) navigate(`/checklist/${instance.id}`);
  };

  const handleDeleteInstance = async () => {
    if (!deleteId) return;
    try {
      await deleteChecklistInstance(deleteId);
      setInstances((previous) => previous.filter((instance) => instance.id !== deleteId));
      setShowDeleteConfirm(false);
      setDeleteId(null);
      setDeleteError(null);
      setTotalInstances((previous) => Math.max(0, previous - 1));
    } catch (err) {
      setDeleteError('Failed to delete checklist instance');
    }
  };

  const navigateWindow = (direction: 'prev' | 'next') => {
    if (dateFilterMode === 'week') {
      setAnchorDate((value) => (direction === 'prev' ? subWeeks(value, 1) : addWeeks(value, 1)));
    } else if (dateFilterMode === 'day') {
      const nextDate = direction === 'prev' ? subDays(anchorDate, 1) : addDays(anchorDate, 1);
      setAnchorDate(nextDate);
      setStartDate(formatIsoDate(nextDate));
    }
    setCurrentPage(1);
  };

  const handleModeChange = (mode: DateFilterMode) => {
    setDateFilterMode(mode);
    setCurrentPage(1);

    if (mode === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (mode === 'week') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (mode === 'day') {
      setStartDate(formatIsoDate(anchorDate));
      setEndDate('');
    }
  };

  const formatDateLabel = (date: string) => format(parseISO(date), 'EEEE, MMMM d, yyyy');
  const formatShortDate = (date: string) => format(parseISO(date), 'MMM d');

  const formatTime = (dateString?: string | null) => {
    if (!dateString) return '--';
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <FaCheckCircle className="instance-status-icon completed" />;
      case 'IN_PROGRESS':
        return <FaPlayCircle className="instance-status-icon in-progress" />;
      case 'OPEN':
        return <FaHourglassHalf className="instance-status-icon open" />;
      default:
        return <FaExclamationTriangle className="instance-status-icon warning" />;
    }
  };

  const getShiftTone = (shift: string) => {
    switch (shift) {
      case 'MORNING':
        return 'morning';
      case 'AFTERNOON':
        return 'afternoon';
      case 'NIGHT':
        return 'night';
      default:
        return 'neutral';
    }
  };

  const activeModeNeedsNavigation = dateFilterMode === 'week' || dateFilterMode === 'day';
  const rangeDescription =
    dateFilterMode === 'all'
      ? 'Full history loaded without date boundaries.'
      : dateFilterMode === 'range'
        ? 'Define a start and end boundary for a precise operational slice.'
        : 'Move backward or forward through time without losing your filter context.';

  if (loading) {
    return <ChecklistsSkeleton />;
  }

  if (error) {
    return (
      <div className="checklists-page">
        <div className="checklists-state-card error">
          <FaExclamationTriangle />
          <h3>Error Loading Checklists</h3>
          <p>{error}</p>
          <button onClick={() => void loadInstances()} className="checklists-primary-btn">
            Try Again
          </button>
        </div>
        <PageGuide guide={pageGuides.checklists} />
      </div>
    );
  }

  return (
    <div className="checklists-page">
      <div className="checklists-ambient">
        <div className="ambient-orb orb-a" />
        <div className="ambient-orb orb-b" />
        <div className="ambient-grid" />
      </div>

      <section className="checklists-hero">
        <div className="hero-copy">
          <div className="hero-kicker">
            <FaSignal />
            SentinelOS Checklist Timeline
          </div>
          <p>Trace every checklist through time with a sharp timeline, cleaner filters, and reliable date control.</p>
          <p>Command the full checklist history with clean temporal control and sharper operational context.</p>
          <div className="hero-tags">
            <span>{resolvedWindow.label}</span>
            <span>{totalInstances} matched instance{totalInstances === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="hero-pulse-panel">
          <div className="pulse-orb">
            <div className="pulse-core">
              <strong>{timelinePulse}%</strong>
              <span>Resolution</span>
            </div>
          </div>
          <div className="hero-metrics">
            <div className="hero-metric-card">
              <span>Window</span>
              <strong>{dateFilterMode === 'all' ? 'All Time' : dateFilterMode === 'range' ? 'Custom Range' : dateFilterMode === 'day' ? 'Specific Day' : 'Weekly Sweep'}</strong>
              <small>{rangeDescription}</small>
            </div>
            <div className="hero-metric-card">
              <span>Page</span>
              <strong>{currentPage} / {Math.max(totalPages, 1)}</strong>
              <small>{hasNextPage ? 'More records ahead' : 'You are at the latest loaded edge'}</small>
            </div>
          </div>
        </div>
      </section>

      <section className="checklists-summary-grid">
        <article className="summary-card">
          <span>Visible now</span>
          <strong>{summary.total}</strong>
          <small>Instances on this page</small>
        </article>
        <article className="summary-card emphasis">
          <span>Completed</span>
          <strong>{summary.completed}</strong>
          <small>Closed successfully</small>
        </article>
        <article className="summary-card">
          <span>In progress</span>
          <strong>{summary.active}</strong>
          <small>Active operations</small>
        </article>
        <article className="summary-card">
          <span>Exceptions</span>
          <strong>{summary.exceptions}</strong>
          <small>Needs follow-up attention</small>
        </article>
      </section>

      <section className="checklists-init-radar">
        <div className="init-radar-head">
          <div>
            <span>Instance Initialization Cadence</span>
            <h3>Daily 06:00 system-trigger checkpoint</h3>
          </div>
          <div className="init-radar-pill">{initializationTelemetry.readinessPct}% readiness</div>
        </div>
        <div className="init-radar-grid">
          <article className="init-radar-card">
            <span>Next init deadline</span>
            <strong>{initializationTelemetry.nextDeadline.toLocaleString()}</strong>
            <small>{initializationTelemetry.countdown} remaining</small>
          </article>
          <article className="init-radar-card">
            <span>Shift coverage today</span>
            <strong>{initializationTelemetry.initializedShifts}/3 initialized</strong>
            <small>M: {todayShiftCoverage.MORNING} | A: {todayShiftCoverage.AFTERNOON} | N: {todayShiftCoverage.NIGHT}</small>
          </article>
          <article className="init-radar-card wide">
            <span>Cycle progress</span>
            <div className="init-progress-track">
              <span className="init-progress-fill" style={{ width: `${initializationTelemetry.progressPct}%` }} />
            </div>
            <small>{initializationTelemetry.progressPct}% through current 24h initialization cycle</small>
          </article>
        </div>
      </section>

      <section className="checklists-command-deck">
        <div className="command-bar">
          <div className="command-row">
            <label className="search-shell">
              <FaSearch />
              <input
                type="text"
                placeholder="Search checklist name, shift, status, date, or ID..."
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
              />
            </label>

            <div className="filter-shell">
              <FaFilter />
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setCurrentPage(1); }}>
                <option value="all">All Status</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="COMPLETED_WITH_EXCEPTIONS">Completed with Exceptions</option>
                <option value="INCOMPLETE">Incomplete</option>
              </select>
              <select value={shiftFilter} onChange={(event) => { setShiftFilter(event.target.value); setCurrentPage(1); }}>
                <option value="all">All Shifts</option>
                <option value="MORNING">Morning</option>
                <option value="AFTERNOON">Afternoon</option>
                <option value="NIGHT">Night</option>
              </select>
            </div>
          </div>

          <div className="temporal-deck">
            <div className="mode-switch">
              <button type="button" className={`mode-btn ${dateFilterMode === 'all' ? 'active' : ''}`} onClick={() => handleModeChange('all')}>
                <FaLayerGroup />
                All Time
              </button>
              <button type="button" className={`mode-btn ${dateFilterMode === 'week' ? 'active' : ''}`} onClick={() => handleModeChange('week')}>
                <FaCalendarWeek />
                Week
              </button>
              <button type="button" className={`mode-btn ${dateFilterMode === 'day' ? 'active' : ''}`} onClick={() => handleModeChange('day')}>
                <FaCalendarDay />
                Specific Day
              </button>
              <button type="button" className={`mode-btn ${dateFilterMode === 'range' ? 'active' : ''}`} onClick={() => handleModeChange('range')}>
                <FaCalendarAlt />
                Date Range
              </button>
            </div>

            <div className="temporal-panel">
              <div className="temporal-panel-copy">
                <span>Temporal scope</span>
                <strong>{resolvedWindow.label}</strong>
              </div>

              {activeModeNeedsNavigation ? (
                <div className="temporal-nav">
                  <button type="button" className="temporal-nav-btn" onClick={() => navigateWindow('prev')} aria-label="Move backward">
                    <FaArrowLeft />
                  </button>
                  <div className="temporal-nav-label">
                    {dateFilterMode === 'week'
                      ? `${format(startOfWeek(anchorDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(anchorDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                      : format(anchorDate, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <button type="button" className="temporal-nav-btn" onClick={() => navigateWindow('next')} aria-label="Move forward">
                    <FaArrowRight />
                  </button>
                </div>
              ) : null}

              {dateFilterMode === 'range' ? (
                <div className="temporal-range-inputs">
                  <label>
                    <span>Start</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(event) => {
                        setStartDate(event.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </label>
                  <label>
                    <span>End</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(event) => {
                        setEndDate(event.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {dateFilterMode === 'day' ? (
                <div className="temporal-range-inputs specific-day-input">
                  <label>
                    <span>Exact date</span>
                    <input
                      type="date"
                      value={startDate || formatIsoDate(anchorDate)}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setStartDate(nextValue);
                        if (nextValue) setAnchorDate(parseISO(nextValue));
                        setCurrentPage(1);
                      }}
                    />
                  </label>
                </div>
              ) : null}

              {dateFilterMode === 'all' ? (
                <div className="temporal-all-time">
                  <FaCalendarAlt />
                  <span>No start or end delimitation is applied.</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="timeline-shell">
          {refreshing ? (
            <div className="timeline-refresh-badge">Refreshing filtered timeline...</div>
          ) : null}

          {!groupedInstances.length ? (
            <div className="checklists-state-card empty">
              <FaCalendarAlt />
              <h3>No checklists found</h3>
              <p>Adjust the date scope or filters to widen the timeline.</p>
            </div>
          ) : (
            groupedInstances.map(([date, dayInstances]) => {
              const completedCount = dayInstances.filter((instance) => instance.status === 'COMPLETED').length;
              const activeCount = dayInstances.filter((instance) => instance.status === 'IN_PROGRESS').length;
              const openCount = dayInstances.filter((instance) => instance.status === 'OPEN').length;
              const isToday = isSameDay(parseISO(date), new Date());

              return (
                <section key={date} className={`timeline-day-cluster ${isToday ? 'today' : ''}`}>
                  <div className="timeline-day-rail">
                    <div className="day-marker" />
                    <div className="day-copy">
                      <span>{isToday ? 'Today' : formatShortDate(date)}</span>
                      <h2>{formatDateLabel(date)}</h2>
                      <p>{dayInstances.length} checklist instance{dayInstances.length === 1 ? '' : 's'} anchored to this date.</p>
                    </div>
                    <div className="day-badges">
                      <span>{completedCount} completed</span>
                      <span>{activeCount} active</span>
                      <span>{openCount} open</span>
                    </div>
                  </div>

                  <div className="timeline-card-grid">
                    {dayInstances.map((instance) => (
                      <button
                        key={instance.id}
                        type="button"
                        className={`timeline-instance-card ${getShiftTone(instance.shift)} ${instance.status.toLowerCase()}`}
                        onClick={() => handleInstanceClick(instance)}
                      >
                        <div className="instance-card-glow" />
                        <div className="timeline-instance-head">
                          <div>
                            <span className="instance-kicker">{instance.shift} shift</span>
                            <h3>{instance.template?.name || 'Unknown Checklist'}</h3>
                          </div>
                          <div className="instance-status-badge">
                            {getStatusIcon(instance.status)}
                            <span>{instance.status.replaceAll('_', ' ')}</span>
                          </div>
                        </div>

                        <div className="instance-chip-row">
                          <span>{instance.id}</span>
                          <span>{formatDateLabel(instance.checklist_date)}</span>
                        </div>

                        <div className="instance-metrics-grid">
                          <div>
                            <label>Shift window</label>
                            <strong>{formatTime(instance.shift_start)} - {formatTime(instance.shift_end)}</strong>
                          </div>
                          <div>
                            <label>Closed</label>
                            <strong>{instance.closed_at ? formatTime(instance.closed_at) : '--'}</strong>
                          </div>
                        </div>

                        <div className="instance-footer-row">
                          <span className="footer-hint">Open checklist</span>
                          {canDeleteInstance(user) ? (
                            <span
                              className="delete-inline"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteId(instance.id);
                                setShowDeleteConfirm(true);
                              }}
                            >
                              <FaTrash />
                            </span>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              );
            })
          )}

          {totalPages > 1 ? (
            <div className="timeline-pagination">
              <div className="pagination-copy">
                <strong>{totalInstances}</strong>
                <span>total matches across {Math.max(totalPages, 1)} page{totalPages === 1 ? '' : 's'}</span>
              </div>

              <div className="pagination-actions">
                <button type="button" className="pagination-btn" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>
                  <FaArrowLeft />
                  Previous
                </button>

                <div className="pagination-numbers">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
                    let pageNumber = index + 1;
                    if (totalPages > 5) {
                      if (currentPage <= 3) pageNumber = index + 1;
                      else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + index;
                      else pageNumber = currentPage - 2 + index;
                    }

                    return (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`pagination-number ${currentPage === pageNumber ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}
                </div>

                <button type="button" className="pagination-btn" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>
                  Next
                  <FaArrowRight />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showDeleteConfirm ? (
        <div className="checklists-modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="checklists-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete checklist instance?</h3>
            <p>This action is permanent and will remove the instance from the timeline.</p>
            {deleteError ? <div className="modal-error">{deleteError}</div> : null}
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteId(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
              <button type="button" className="modal-btn danger" onClick={() => void handleDeleteInstance()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PageGuide guide={pageGuides.checklists} />
    </div>
  );
};

export default ChecklistsPage;
