import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaArrowLeft,
  FaArrowRight,
  FaCalendarAlt,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaMoon,
  FaQuestion,
  FaSignal,
  FaStar,
  FaTasks,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isAfter,
  isSameDay,
  parseISO,
  startOfMonth,
  subDays,
} from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import { useNotifications } from '../contexts/NotificationContext';
import { checklistApi, ChecklistInstance } from '../services/checklistApi';
import { shiftSchedulingApi, UserSchedule, UserScheduleDay } from '../services/shiftSchedulingApi';
import { taskApi, TaskSummary } from '../services/taskApi';
import './UserScheduleDashboard.css';

type ViewMode = 'month' | 'week';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeTime = (value?: string) => {
  if (!value) return 'TBD';
  return value.slice(0, 5);
};

const formatWindow = (day?: UserScheduleDay) => {
  if (!day?.start_time || !day?.end_time) return 'Time pending';
  return `${normalizeTime(day.start_time)} - ${normalizeTime(day.end_time)}`;
};

const dayStatusLabel = (day?: UserScheduleDay) => {
  if (!day || day.type === 'UNSCHEDULED') return 'Open';
  if (day.type === 'OFF_DAY') return 'Recovery';
  return day.status || 'Assigned';
};

const toDateKeyFromIso = (value?: string) => {
  if (!value) return '';
  try {
    return format(parseISO(value), 'yyyy-MM-dd');
  } catch {
    return value.split('T')[0] || '';
  }
};

const formatDeadlineTime = (value?: string) => {
  if (!value) return 'Time pending';
  try {
    return format(parseISO(value), 'HH:mm');
  } catch {
    const parts = value.split('T');
    return parts[1]?.slice(0, 5) || 'Time pending';
  }
};

const resolveChecklistShift = (day?: UserScheduleDay): 'MORNING' | 'AFTERNOON' | 'NIGHT' | null => {
  const candidates = [day?.shift_name, day?.status, day?.reason]
    .filter(Boolean)
    .map((value) => String(value).trim().toUpperCase());

  for (const value of candidates) {
    if (value.includes('MORNING')) return 'MORNING';
    if (value.includes('AFTERNOON')) return 'AFTERNOON';
    if (value.includes('NIGHT')) return 'NIGHT';
  }

  return null;
};

const rankChecklistInstance = (instance: ChecklistInstance) => {
  switch ((instance.status || '').toUpperCase()) {
    case 'IN_PROGRESS':
      return 0;
    case 'OPEN':
      return 1;
    case 'PENDING_REVIEW':
      return 2;
    case 'COMPLETED_WITH_EXCEPTIONS':
      return 3;
    case 'COMPLETED':
      return 4;
    default:
      return 5;
  }
};

const UserScheduleDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  const [schedule, setSchedule] = useState<UserSchedule | null>(null);
  const [deadlineTasks, setDeadlineTasks] = useState<TaskSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [timelineNotice, setTimelineNotice] = useState<{ title: string; message: string } | null>(null);
  const [shiftNavigationPending, setShiftNavigationPending] = useState(false);

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weekStart = subDays(today, today.getDay());
  const weekEnd = addDays(weekStart, 6);
  const displayStart = viewMode === 'month' ? monthStart : weekStart;
  const displayEnd = viewMode === 'month' ? monthEnd : weekEnd;
  const displayStartKey = format(displayStart, 'yyyy-MM-dd');
  const displayEndKey = format(displayEnd, 'yyyy-MM-dd');
  const dateRangeKey = `${displayStartKey}_${displayEndKey}`;
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const hasSchedule = schedule !== null;

  useEffect(() => {
    const loadSchedule = async () => {
      if (!hasSchedule) setLoading(true);
      else setIsRefreshing(true);

      try {
        const results = await Promise.allSettled([
          shiftSchedulingApi.getUserSchedule({
            start_date: displayStartKey,
            end_date: displayEndKey,
          }),
          currentUser?.id
            ? taskApi.listTasks({
                assigned_to: currentUser.id,
                due_after: `${displayStartKey}T00:00:00`,
                due_before: `${displayEndKey}T23:59:59`,
                status: ['ACTIVE', 'IN_PROGRESS', 'ON_HOLD', 'DRAFT'],
                sort: 'due_date',
                order: 'asc',
                limit: 100,
                offset: 0,
              })
            : Promise.resolve({ tasks: [], pagination: { total: 0, limit: 0, offset: 0, has_more: false } }),
        ]);

        const scheduleResult = results[0];
        if (scheduleResult.status !== 'fulfilled') {
          throw scheduleResult.reason;
        }
        setSchedule(scheduleResult.value);

        const tasksResult = results[1];
        if (tasksResult.status === 'fulfilled') {
          setDeadlineTasks((tasksResult.value.tasks || []).filter((task) => Boolean(task.due_date)));
        } else {
          console.warn('Task deadline feed failed; continuing schedule render.', tasksResult.reason);
          setDeadlineTasks([]);
        }
      } catch (err) {
        console.error('Failed to load schedule', err);
        addNotification({
          type: 'error',
          message: 'Failed to load your schedule',
          priority: 'high',
        });
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };

    void loadSchedule();
  }, [addNotification, currentUser?.id, dateRangeKey, displayEndKey, displayStartKey, hasSchedule]);

  const scheduleByDate = useMemo(() => {
    const map = new Map<string, UserScheduleDay>();
    schedule?.schedule.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [schedule]);

  const preferredFocusDate = useMemo(() => {
    const visibleDays = schedule?.schedule ?? [];
    const upcomingShift = visibleDays.find(
      (day) => day.type === 'SHIFT' && (day.date === todayKey || isAfter(parseISO(day.date), parseISO(todayKey)))
    );

    return upcomingShift?.date || visibleDays[0]?.date || todayKey;
  }, [schedule, todayKey]);

  useEffect(() => {
    const selectedIsVisible = selectedDate >= format(displayStart, 'yyyy-MM-dd') && selectedDate <= format(displayEnd, 'yyyy-MM-dd');
    if (!selectedIsVisible || !scheduleByDate.has(selectedDate)) {
      setSelectedDate(preferredFocusDate);
    }
  }, [displayEnd, displayStart, preferredFocusDate, scheduleByDate, selectedDate]);

  const stats = useMemo(() => {
    const base = {
      totalShifts: 0,
      completed: 0,
      upcoming: 0,
      daysOff: 0,
      unscheduled: 0,
    };

    schedule?.schedule.forEach((day) => {
      if (day.type === 'SHIFT') {
        base.totalShifts += 1;
        if (day.date < todayKey) base.completed += 1;
        else base.upcoming += 1;
      } else if (day.type === 'OFF_DAY') {
        base.daysOff += 1;
      } else {
        base.unscheduled += 1;
      }
    });

    return base;
  }, [schedule, todayKey]);

  const nextShift = useMemo(() => {
    return (
      schedule?.schedule.find(
        (day) => day.type === 'SHIFT' && (day.date === todayKey || isAfter(parseISO(day.date), parseISO(todayKey)))
      ) || null
    );
  }, [schedule, todayKey]);

  const upcomingShifts = useMemo(() => {
    return (schedule?.schedule ?? [])
      .filter((day) => day.type === 'SHIFT' && (day.date === todayKey || isAfter(parseISO(day.date), parseISO(todayKey))))
      .sort((left, right) => left.date.localeCompare(right.date))
      .slice(0, 5);
  }, [schedule, todayKey]);

  const operationalPulse = useMemo(() => {
    const scheduledCount = stats.totalShifts + stats.daysOff;
    const totalDays = schedule?.schedule.length || 0;
    if (!totalDays) return 0;
    return Math.round((scheduledCount / totalDays) * 100);
  }, [schedule, stats.daysOff, stats.totalShifts]);

  const focusedDay = scheduleByDate.get(selectedDate);
  const deadlineTasksByDate = useMemo(() => {
    const map = new Map<string, TaskSummary[]>();
    deadlineTasks.forEach((task) => {
      const key = toDateKeyFromIso(task.due_date);
      if (!key) return;
      const existing = map.get(key) || [];
      existing.push(task);
      map.set(key, existing);
    });
    map.forEach((items, key) => {
      map.set(
        key,
        items.slice().sort((left, right) => (left.due_date || '').localeCompare(right.due_date || ''))
      );
    });
    return map;
  }, [deadlineTasks]);
  const focusedDeadlineTasks = deadlineTasksByDate.get(selectedDate) || [];
  const focusedDateLabel = format(parseISO(selectedDate), 'EEEE, MMMM d');
  const userLabel = currentUser?.first_name || currentUser?.username || 'Operator';

  const handleTaskDeadlineOpen = (taskId: string) => {
    navigate(`/tasks?task=${taskId}`);
  };

  const handleShiftTimelineOpen = async () => {
    if (!focusedDay || focusedDay.type !== 'SHIFT') {
      return;
    }

    if (selectedDate > todayKey) {
      setTimelineNotice({
        title: 'Timeline Not Ready Yet',
        message: `The ${focusedDay.shift_name || 'selected'} timeline for ${focusedDateLabel} has not been created yet. Future shifts become available once the day arrives and the checklist instance is initialized.`,
      });
      return;
    }

    try {
      setShiftNavigationPending(true);
      const instances = await checklistApi.getAllInstances(selectedDate, selectedDate);
      const targetShift = resolveChecklistShift(focusedDay);
      const matchingInstances = targetShift
        ? instances.filter((instance) => (instance.shift || '').toUpperCase() === targetShift)
        : instances;
      const targetInstance = matchingInstances
        .slice()
        .sort((left, right) => rankChecklistInstance(left) - rankChecklistInstance(right))[0];

      if (!targetInstance?.id) {
        addNotification({
          type: 'warning',
          message: `No checklist timeline exists yet for ${focusedDateLabel}.`,
          priority: 'medium',
        });
        return;
      }

      navigate(`/checklist/${targetInstance.id}`);
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to open the shift timeline',
        priority: 'high',
      });
    } finally {
      setShiftNavigationPending(false);
    }
  };

  const monthDays = useMemo(() => {
    const firstDayOffset = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const cells: Array<{ date: Date | null; key: string }> = [];

    for (let i = 0; i < firstDayOffset; i += 1) {
      cells.push({ date: null, key: `empty-${i}` });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({
        date: new Date(monthStart.getFullYear(), monthStart.getMonth(), day),
        key: `day-${day}`,
      });
    }

    return cells;
  }, [monthEnd, monthStart]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  }, [weekStart]);

  const renderDayPreview = (dayData?: UserScheduleDay) => {
    if (!dayData || dayData.type === 'UNSCHEDULED') {
      return (
        <>
          <span className="schedule-day-icon neutral">
            <FaQuestion />
          </span>
          <div className="schedule-day-copy">
            <strong>Open</strong>
            <span>No assignment locked</span>
          </div>
        </>
      );
    }

    if (dayData.type === 'OFF_DAY') {
      return (
        <>
          <span className="schedule-day-icon off">
            <FaMoon />
          </span>
          <div className="schedule-day-copy">
            <strong>Recovery</strong>
            <span>{dayData.reason || 'Protected downtime'}</span>
          </div>
        </>
      );
    }

    return (
      <>
        <span className="schedule-day-icon shift">
          <FaClock />
        </span>
        <div className="schedule-day-copy">
          <strong>{dayData.shift_name || 'Shift Assigned'}</strong>
          <span>{formatWindow(dayData)}</span>
        </div>
      </>
    );
  };

  const renderMonthView = () => (
    <div className="schedule-calendar-shell">
      <div className="schedule-calendar-weekdays">
        {weekdayLabels.map((label) => (
          <div key={label} className="schedule-weekday">
            {label}
          </div>
        ))}
      </div>
      <div className="schedule-calendar-grid">
        {monthDays.map((cell) => {
          if (!cell.date) {
            return <div key={cell.key} className="schedule-calendar-cell empty" />;
          }

          const dateKey = format(cell.date, 'yyyy-MM-dd');
          const dayData = scheduleByDate.get(dateKey);
          const deadlineCount = deadlineTasksByDate.get(dateKey)?.length || 0;
          const isCurrentDay = isSameDay(cell.date, today);
          const isSelected = selectedDate === dateKey;
          const isPast = dateKey < todayKey;

          return (
            <button
              key={cell.key}
              type="button"
              className={`schedule-calendar-cell ${isCurrentDay ? 'today' : ''} ${isSelected ? 'selected' : ''} ${isPast ? 'past' : ''} ${dayData?.type?.toLowerCase() || 'unscheduled'}`}
              onClick={() => setSelectedDate(dateKey)}
            >
              <div className="schedule-cell-topline">
                <span className="schedule-cell-date">{format(cell.date, 'd')}</span>
                <div className="schedule-cell-badge-stack">
                  {deadlineCount > 0 ? (
                    <span className="schedule-task-pill">
                      <FaTasks />
                      {deadlineCount}
                    </span>
                  ) : null}
                  <span className={`schedule-cell-badge ${dayStatusLabel(dayData).toLowerCase().replace(/\s+/g, '-')}`}>
                    {isCurrentDay ? 'Today' : dayStatusLabel(dayData)}
                  </span>
                </div>
              </div>
              <div className="schedule-cell-body">{renderDayPreview(dayData)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderWeekView = () => (
    <div className="schedule-agenda-grid">
      {weekDays.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const dayData = scheduleByDate.get(dateKey);
        const deadlineCount = deadlineTasksByDate.get(dateKey)?.length || 0;
        const isCurrentDay = isSameDay(day, today);
        const isSelected = selectedDate === dateKey;

        return (
          <button
            key={dateKey}
            type="button"
            className={`agenda-card ${isCurrentDay ? 'today' : ''} ${isSelected ? 'selected' : ''} ${dayData?.type?.toLowerCase() || 'unscheduled'}`}
            onClick={() => setSelectedDate(dateKey)}
          >
            <div className="agenda-card-head">
              <div>
                <span>{format(day, 'EEE')}</span>
                <h3>{format(day, 'd MMM')}</h3>
              </div>
              <span className="agenda-status">{dayStatusLabel(dayData)}</span>
            </div>
            <div className="agenda-card-body">{renderDayPreview(dayData)}</div>
            {deadlineCount > 0 ? (
              <div className="agenda-deadline-chip">
                <FaTasks />
                <span>{deadlineCount} deadline{deadlineCount === 1 ? '' : 's'}</span>
              </div>
            ) : null}
            {dayData?.type === 'SHIFT' ? (
              <div className="agenda-card-meta">
                <span>{dayData.status || 'Assigned'}</span>
                <span>{formatWindow(dayData)}</span>
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="user-schedule-dashboard">
      <div className="schedule-ambient">
        <div className="schedule-ambient-orb orb-a" />
        <div className="schedule-ambient-orb orb-b" />
        <div className="schedule-ambient-grid" />
      </div>

      <section className="schedule-hero-panel">
        <div className="schedule-hero-copy">
          <div className="schedule-kicker">
            <FaSignal />
            SentinelOS Shift Intelligence
          </div>
          <p>Own your rhythm, every watch, every handoff, every recovery window.</p>
          <p>
            {userLabel}, this is your live operations canvas for scheduled shifts, recovery days, and upcoming assignments across SentinelOS.
          </p>

          <div className="schedule-hero-highlights">
            <div className="hero-chip">
              <FaCalendarAlt />
              <span>{format(displayStart, 'MMM d')} to {format(displayEnd, 'MMM d')}</span>
            </div>
            <div className="hero-chip">
              <FaCheckCircle />
              <span>{stats.upcoming} future assignment{stats.upcoming === 1 ? '' : 's'}</span>
            </div>
          </div>
        </div>

        <div className="schedule-hero-telemetry">
          <div className="schedule-pulse-card">
            <div className="schedule-pulse-ring">
              <div className="schedule-pulse-core">
                <strong>{operationalPulse}%</strong>
                <span>Coverage Pulse</span>
              </div>
            </div>
            <p>How much of this visible window is already defined by active shifts or protected time off.</p>
          </div>

          <div className="schedule-next-card">
            <div className="next-card-head">
              <span>Next mission block</span>
              <FaStar />
            </div>
            {nextShift ? (
              <>
                <strong>{nextShift.shift_name || 'Assigned Shift'}</strong>
                <div>{format(parseISO(nextShift.date), 'EEEE, MMM d')}</div>
                <p>{formatWindow(nextShift)}</p>
              </>
            ) : (
              <>
                <strong>No shift queued</strong>
                <div>Enjoy the breathing room</div>
                <p>Your next assignment will appear here when your manager publishes it.</p>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="schedule-overview-grid">
        <article className="overview-stat-card">
          <span>Total shifts</span>
          <strong>{stats.totalShifts}</strong>
          <small>Visible in this {viewMode === 'month' ? 'month' : 'week'} window</small>
        </article>
        <article className="overview-stat-card emphasis">
          <span>Upcoming</span>
          <strong>{stats.upcoming}</strong>
          <small>Operational commitments ahead</small>
        </article>
        <article className="overview-stat-card">
          <span>Completed</span>
          <strong>{stats.completed}</strong>
          <small>Closed successfully</small>
        </article>
        <article className="overview-stat-card">
          <span>Recovery days</span>
          <strong>{stats.daysOff}</strong>
          <small>Protected time to reset</small>
        </article>
      </section>

      <section className="schedule-workspace">
        <div className="schedule-command-panel">
          <div className="schedule-toolbar">
            <div className="schedule-toggle-group">
              <button
                type="button"
                className={`schedule-toggle ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
              >
                Month Grid
              </button>
              <button
                type="button"
                className={`schedule-toggle ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
              >
                Weekly Agenda
              </button>
            </div>

            <div className="schedule-toolbar-meta">
              <button
                type="button"
                className="schedule-nav-btn"
                onClick={() => setCurrentMonth((value) => addMonths(value, -1))}
                aria-label="Previous month"
                disabled={viewMode === 'week'}
              >
                <FaArrowLeft />
              </button>
              <div className="schedule-toolbar-label">
                <span>Viewing</span>
                <strong>{viewMode === 'month' ? format(currentMonth, 'MMMM yyyy') : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`}</strong>
              </div>
              <button
                type="button"
                className="schedule-nav-btn"
                onClick={() => setCurrentMonth((value) => addMonths(value, 1))}
                aria-label="Next month"
                disabled={viewMode === 'week'}
              >
                <FaArrowRight />
              </button>
            </div>
          </div>

          <div className="schedule-surface">
            {viewMode === 'month' ? renderMonthView() : renderWeekView()}

            {!loading && schedule && schedule.schedule.length === 0 ? (
              <div className="schedule-inline-empty">
                <FaCalendarAlt />
                <div>
                  <strong>No schedule published yet</strong>
                  <span>Your assignment grid will populate here as soon as a manager pushes your next rotation.</span>
                </div>
              </div>
            ) : null}

            {(loading || isRefreshing) ? (
              <div className={`schedule-loading-overlay ${loading ? 'initial' : 'refresh'}`}>
                <div className="schedule-spinner">
                  <div className="spinner-ring" />
                  <div className="spinner-ring inner" />
                </div>
                <div className="schedule-loading-text">
                  {loading ? 'Loading schedule intelligence...' : 'Refreshing live schedule...'}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="schedule-insight-panel">
          <div className="insight-card feature">
            <div className="insight-card-head">
              <span>Focus day</span>
              <strong>{focusedDateLabel}</strong>
            </div>
            <div className={`focus-state ${focusedDay?.type?.toLowerCase() || 'unscheduled'}`}>
              {focusedDay?.type === 'SHIFT' ? (
                <>
                  <div className="focus-title-row">
                    <FaClock />
                    <h3>{focusedDay.shift_name || 'Shift Assigned'}</h3>
                  </div>
                  <p>{formatWindow(focusedDay)}</p>
                  <div className="focus-tags">
                    <span>{focusedDay.status || 'Assigned'}</span>
                    <span>{focusedDay.reason || 'Mission-ready'}</span>
                  </div>
                  <button
                    type="button"
                    className="focus-jump-btn"
                    onClick={handleShiftTimelineOpen}
                    disabled={shiftNavigationPending}
                  >
                    {shiftNavigationPending ? 'Opening timeline...' : 'Open shift timeline'}
                  </button>
                </>
              ) : focusedDay?.type === 'OFF_DAY' ? (
                <>
                  <div className="focus-title-row">
                    <FaMoon />
                    <h3>Recovery Window</h3>
                  </div>
                  <p>{focusedDay.reason || 'Protected downtime for reset and readiness.'}</p>
                  <div className="focus-tags">
                    <span>Off day</span>
                    <span>Recovery protected</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="focus-title-row">
                    <FaQuestion />
                    <h3>Open day</h3>
                  </div>
                  <p>No shift has been pinned to this day yet. Keep an eye on updates from scheduling control.</p>
                  <div className="focus-tags">
                    <span>Unscheduled</span>
                    <span>Awaiting assignment</span>
                  </div>
                </>
              )}
            </div>
            <div className="focus-deadline-block">
              <div className="focus-deadline-head">
                <span>Task deadlines</span>
                <strong>{focusedDeadlineTasks.length}</strong>
              </div>
              {focusedDeadlineTasks.length ? (
                <div className="focus-deadline-list">
                  {focusedDeadlineTasks.slice(0, 4).map((task) => {
                    const overdue = Boolean(task.due_date && parseISO(task.due_date) < new Date());
                    return (
                      <button
                        key={task.id}
                        type="button"
                        className={`focus-deadline-item ${overdue ? 'overdue' : ''}`}
                        onClick={() => handleTaskDeadlineOpen(task.id)}
                      >
                        <div>
                          <strong>{task.title}</strong>
                          <span>{formatDeadlineTime(task.due_date)} · {task.status.replace('_', ' ')}</span>
                        </div>
                        <em>{task.priority}</em>
                      </button>
                    );
                  })}
                  {focusedDeadlineTasks.length > 4 ? (
                    <div className="focus-deadline-more">+{focusedDeadlineTasks.length - 4} more</div>
                  ) : null}
                </div>
              ) : (
                <div className="focus-deadline-empty">
                  <FaExclamationTriangle />
                  <span>No deadlines set for this day.</span>
                </div>
              )}
            </div>
          </div>

          <div className="insight-card">
            <div className="insight-card-head">
              <span>Upcoming lineup</span>
              <strong>{upcomingShifts.length} queued</strong>
            </div>
            <div className="upcoming-shift-list">
              {upcomingShifts.length ? (
                upcomingShifts.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className={`upcoming-shift-item ${selectedDate === day.date ? 'selected' : ''}`}
                    onClick={() => setSelectedDate(day.date)}
                  >
                    <div>
                      <strong>{day.shift_name || 'Shift'}</strong>
                      <span>{format(parseISO(day.date), 'EEE, MMM d')}</span>
                    </div>
                    <em>{formatWindow(day)}</em>
                  </button>
                ))
              ) : (
                <div className="upcoming-empty">No future shifts in this window yet.</div>
              )}
            </div>
          </div>

          <div className="insight-card legend-card">
            <div className="insight-card-head">
              <span>Legend</span>
              <strong>Read at a glance</strong>
            </div>
            <div className="schedule-legend-list">
              <div className="schedule-legend-item">
                <span className="legend-swatch shift" />
                <div>
                  <strong>Shift</strong>
                  <span>Active work block with time window</span>
                </div>
              </div>
              <div className="schedule-legend-item">
                <span className="legend-swatch off" />
                <div>
                  <strong>Recovery</strong>
                  <span>Day off or protected downtime</span>
                </div>
              </div>
              <div className="schedule-legend-item">
                <span className="legend-swatch open" />
                <div>
                  <strong>Open</strong>
                  <span>No assignment published yet</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
      {timelineNotice ? (
        <div className="schedule-modal-overlay" onClick={() => setTimelineNotice(null)}>
          <div
            className="schedule-modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-timeline-notice-title"
          >
            <span className="schedule-modal-kicker">Timeline access</span>
            <h3 id="schedule-timeline-notice-title">{timelineNotice.title}</h3>
            <p>{timelineNotice.message}</p>
            <div className="schedule-modal-actions">
              <button
                type="button"
                className="schedule-modal-btn primary"
                onClick={() => setTimelineNotice(null)}
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <PageGuide guide={pageGuides.userScheduleDashboard} />
    </div>
  );
};

export default UserScheduleDashboard;
