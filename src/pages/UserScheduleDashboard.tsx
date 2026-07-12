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
import { normalizeShiftCode } from '../utils/shiftUtils';
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

const resolveChecklistShift = (day?: UserScheduleDay): string | null => {
  const shiftName = normalizeShiftCode(day?.shift_name);
  return shiftName || null;
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

const UserScheduleSkeleton: React.FC = () => (
  <div className="user-schedule-dashboard user-schedule-skeleton-page">
    <section className="schedule-command-strip schedule-skel-panel">
      <div className="schedule-skel-command-copy">
        <div className="schedule-skel-line schedule-skel-kicker" />
        <div className="schedule-skel-line schedule-skel-title" />
        <div className="schedule-skel-line schedule-skel-meta" />
      </div>

      <div className="schedule-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="schedule-skel-signal-card">
            <div className="schedule-skel-block schedule-skel-icon" />
            <div className="schedule-skel-signal-copy">
              <div className="schedule-skel-line schedule-skel-label" />
              <div className="schedule-skel-line schedule-skel-value" />
              <div className="schedule-skel-line schedule-skel-meta" />
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="schedule-layout">
      <div className="schedule-command-panel schedule-skel-panel">
        <div className="schedule-skel-board-head">
          <div>
            <div className="schedule-skel-line schedule-skel-kicker" />
            <div className="schedule-skel-line schedule-skel-panel-title" />
          </div>
          <div className="schedule-skel-toggle-pair">
            <div className="schedule-skel-block schedule-skel-toggle" />
            <div className="schedule-skel-block schedule-skel-toggle" />
          </div>
        </div>

        <div className="schedule-skel-ledger">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="schedule-skel-ledger-item">
              <div className="schedule-skel-line schedule-skel-value" />
              <div className="schedule-skel-line schedule-skel-label" />
            </div>
          ))}
        </div>

        <div className="schedule-skeleton-calendar-shell">
          <div className="schedule-skeleton-weekdays">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="schedule-skel-line schedule-skel-weekday" />
            ))}
          </div>
          <div className="schedule-skeleton-grid">
            {Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="schedule-skel-cell">
                <div className="schedule-skel-line schedule-skel-cell-date" />
                <div className="schedule-skel-line schedule-skel-cell-title" />
                <div className="schedule-skel-line schedule-skel-cell-copy" />
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="schedule-insight-panel">
        <article className="insight-card schedule-skel-panel">
          <div className="schedule-skel-line schedule-skel-kicker" />
          <div className="schedule-skel-line schedule-skel-panel-title" />
          <div className="schedule-skel-focus-block" />
          <div className="schedule-skel-list">
            <div className="schedule-skel-row" />
            <div className="schedule-skel-row" />
            <div className="schedule-skel-row" />
          </div>
        </article>

        <article className="insight-card schedule-skel-panel">
          <div className="schedule-skel-line schedule-skel-kicker" />
          <div className="schedule-skel-line schedule-skel-panel-title" />
          <div className="schedule-skel-list">
            <div className="schedule-skel-row" />
            <div className="schedule-skel-row" />
            <div className="schedule-skel-row" />
          </div>
        </article>
      </aside>
    </section>
  </div>
);

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
    const selectedIsVisible = selectedDate >= displayStartKey && selectedDate <= displayEndKey;
    if (!selectedIsVisible || !scheduleByDate.has(selectedDate)) {
      setSelectedDate(preferredFocusDate);
    }
  }, [displayEndKey, displayStartKey, preferredFocusDate, scheduleByDate, selectedDate]);

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
  const visibleRangeLabel = `${format(displayStart, 'MMM d')} - ${format(displayEnd, 'MMM d')}`;
  const visibleDayCount = schedule?.schedule.length || 0;
  const definedDayCount = stats.totalShifts + stats.daysOff;

  const scheduleSignals = useMemo(
    () => [
      {
        label: 'Next shift',
        value: nextShift ? format(parseISO(nextShift.date), 'EEE d MMM') : 'None',
        detail: nextShift ? `${nextShift.shift_name || 'Assigned'} / ${formatWindow(nextShift)}` : 'No shift in this window',
        icon: <FaClock />,
        tone: nextShift ? 'ok' : 'watch',
      },
      {
        label: 'Upcoming',
        value: stats.upcoming,
        detail: `${stats.completed} completed / ${stats.totalShifts} total shifts`,
        icon: <FaCalendarAlt />,
        tone: stats.upcoming ? 'info' : 'watch',
      },
      {
        label: 'Tasks due',
        value: deadlineTasks.length,
        detail: deadlineTasks.length ? 'Deadlines inside this view' : 'No visible task deadlines',
        icon: <FaTasks />,
        tone: deadlineTasks.length ? 'watch' : 'ok',
      },
      {
        label: 'Coverage',
        value: `${operationalPulse}%`,
        detail: `${definedDayCount}/${visibleDayCount} days defined`,
        icon: <FaSignal />,
        tone: operationalPulse >= 80 ? 'ok' : operationalPulse >= 50 ? 'watch' : 'danger',
      },
    ],
    [deadlineTasks.length, definedDayCount, nextShift, operationalPulse, stats.completed, stats.totalShifts, stats.upcoming, visibleDayCount]
  );

  const handleTaskDeadlineOpen = (taskId: string) => {
    navigate(`/tasks?task=${taskId}`);
  };

  const handleShiftTimelineOpen = async () => {
    if (!focusedDay || focusedDay.type !== 'SHIFT') {
      return;
    }

    if (selectedDate > todayKey) {
      setTimelineNotice({
        title: 'Timeline not ready yet',
        message: `The ${focusedDay.shift_name || 'selected'} timeline for ${focusedDateLabel} has not been created yet. Future shifts become available once the day arrives and the checklist instance is initialized.`,
      });
      return;
    }

    try {
      setShiftNavigationPending(true);
      const instances = await checklistApi.getAllInstances(selectedDate, selectedDate);
      const targetShift = resolveChecklistShift(focusedDay);
      const matchingInstances = targetShift
        ? instances.filter((instance) => normalizeShiftCode(instance.shift) === targetShift)
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

  if (loading && !schedule) {
    return <UserScheduleSkeleton />;
  }

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
      <section className="schedule-command-strip">
        <div className="schedule-command-title">
          <span><FaSignal /> User schedule</span>
          <strong>{userLabel}</strong>
          <small>{visibleRangeLabel} / {visibleDayCount} day window</small>
        </div>

        <div className="schedule-signal-grid">
          {scheduleSignals.map((signal) => (
            <article key={signal.label} className={`schedule-signal-card tone-${signal.tone}`}>
              <span className="schedule-signal-icon">{signal.icon}</span>
              <span className="schedule-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.detail}</em>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="schedule-layout">
        <div className="schedule-command-panel">
          <div className="schedule-panel-heading">
            <div className="schedule-panel-title">
              <span><FaCalendarAlt /> Schedule board</span>
              <strong>
                {viewMode === 'month'
                  ? format(currentMonth, 'MMMM yyyy')
                  : `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`}
              </strong>
            </div>

            <div className="schedule-toggle-group">
              <button
                type="button"
                className={`schedule-toggle ${viewMode === 'month' ? 'active' : ''}`}
                onClick={() => setViewMode('month')}
                aria-pressed={viewMode === 'month'}
              >
                Month
              </button>
              <button
                type="button"
                className={`schedule-toggle ${viewMode === 'week' ? 'active' : ''}`}
                onClick={() => setViewMode('week')}
                aria-pressed={viewMode === 'week'}
              >
                Week
              </button>
            </div>
          </div>

          <div className="schedule-toolbar">
            <div className="schedule-window-ledger">
              <span>
                <strong>{stats.totalShifts}</strong>
                <em>shifts</em>
              </span>
              <span>
                <strong>{stats.completed}</strong>
                <em>closed</em>
              </span>
              <span>
                <strong>{stats.daysOff}</strong>
                <em>recovery</em>
              </span>
              <span>
                <strong>{stats.unscheduled}</strong>
                <em>open</em>
              </span>
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
                <strong>{visibleRangeLabel}</strong>
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
                <FaExclamationTriangle />
                <div>
                  <strong>No schedule published yet</strong>
                  <span>Your assignment grid will populate here once scheduling control publishes the rotation.</span>
                </div>
              </div>
            ) : null}

            {isRefreshing ? (
              <div className="schedule-loading-overlay refresh">
                <div className="schedule-refresh-mark" />
                <div className="schedule-loading-text">Refreshing live schedule</div>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="schedule-insight-panel">
          <article className="insight-card feature">
            <div className="insight-card-head">
              <span>Focus day</span>
              <strong>{focusedDateLabel}</strong>
            </div>
            <div className={`focus-state ${focusedDay?.type?.toLowerCase() || 'unscheduled'}`}>
              {focusedDay?.type === 'SHIFT' ? (
                <>
                  <div className="focus-title-row">
                    <FaClock />
                    <h3>{focusedDay.shift_name || 'Shift assigned'}</h3>
                  </div>
                  <p>{formatWindow(focusedDay)}</p>
                  <div className="focus-tags">
                    <span>{focusedDay.status || 'Assigned'}</span>
                    <span>{focusedDay.reason || 'Timeline ready when the shift opens'}</span>
                  </div>
                  <button
                    type="button"
                    className="focus-jump-btn"
                    onClick={handleShiftTimelineOpen}
                    disabled={shiftNavigationPending}
                  >
                    <span>{shiftNavigationPending ? 'Opening timeline' : 'Open shift timeline'}</span>
                    <FaArrowRight />
                  </button>
                </>
              ) : focusedDay?.type === 'OFF_DAY' ? (
                <>
                  <div className="focus-title-row">
                    <FaMoon />
                    <h3>Recovery window</h3>
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
                  <p>No shift has been pinned to this day yet. Watch this panel for schedule updates.</p>
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
                          <span>{formatDeadlineTime(task.due_date)} / {task.status.replace(/_/g, ' ')}</span>
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
                  <FaCheckCircle />
                  <span>No deadlines set for this day.</span>
                </div>
              )}
            </div>
          </article>

          <article className="insight-card">
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
          </article>

          <article className="insight-card legend-card">
            <div className="insight-card-head">
              <span>Read key</span>
              <strong>Schedule states</strong>
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
          </article>
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
