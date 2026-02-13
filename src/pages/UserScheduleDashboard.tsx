import React, { useEffect, useState, useMemo } from 'react';
import {
  FaCalendarAlt,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaQuestion,
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { shiftSchedulingApi, UserSchedule, UserScheduleDay } from '../services/shiftSchedulingApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import './UserScheduleDashboard.css';

const UserScheduleDashboard: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  const [schedule, setSchedule] = useState<UserSchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const displayStart = viewMode === 'month' ? monthStart : today;
  const displayEnd = viewMode === 'month' ? monthEnd : addDays(today, 7);

  // Memoize date strings to prevent unnecessary useEffect reruns
  const dateRangeKey = useMemo(
    () => `${format(displayStart, 'yyyy-MM-dd')}_${format(displayEnd, 'yyyy-MM-dd')}`,
    [displayStart, displayEnd]
  );

  useEffect(() => {
    const loadSchedule = async () => {
      // Keep large loading only for first load; subsequent reloads are 'refreshing'
      if (!schedule) setLoading(true);
      else setIsRefreshing(true);
      try {
        const scheduleData = await shiftSchedulingApi.getUserSchedule({
          start_date: format(displayStart, 'yyyy-MM-dd'),
          end_date: format(displayEnd, 'yyyy-MM-dd'),
        });
        setSchedule(scheduleData);
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
  }, [dateRangeKey]);

  const scheduleByDate = useMemo(() => {
    if (!schedule) return new Map();
    const map = new Map<string, UserScheduleDay>();
    schedule.schedule.forEach((day) => {
      map.set(day.date, day);
    });
    return map;
  }, [schedule]);

  const stats = useMemo(() => {
    if (!schedule) return { total_shifts: 0, completed: 0, upcoming: 0, days_off: 0 };
    const stats = {
      total_shifts: 0,
      completed: 0,
      upcoming: 0,
      days_off: 0,
    };
    schedule.schedule.forEach((day) => {
      if (day.type === 'OFF_DAY') {
        stats.days_off++;
      } else if (day.type === 'SHIFT') {
        stats.total_shifts++;
        const dayDate = parseISO(day.date);
        if (dayDate < today) {
          stats.completed++;
        } else {
          stats.upcoming++;
        }
      }
    });
    return stats;
  }, [schedule, today]);

  const renderCalendarDays = () => {
    if (viewMode !== 'month') return null;

    const days: React.ReactNode[] = [];
    const firstDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      days.push(
        <div key={`empty-${i}`} className="calendar-day empty"></div>
      );
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = scheduleByDate.get(dateStr);
      const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isPast = date < today;

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (isPast && dayData?.type !== 'OFF_DAY') dayClass += ' past';

      days.push(
        <div key={dateStr} className={dayClass}>
          <div className="day-number">{day}</div>
          <div className="day-content">
            {!dayData || dayData.type === 'UNSCHEDULED' ? (
              <div className="unscheduled">
                <FaQuestion size={14} />
              </div>
            ) : dayData.type === 'OFF_DAY' ? (
              <div className="off-day" title={dayData.reason || 'Off'}>
                <FaTimesCircle size={14} />
              </div>
            ) : (
              <div className="shift" title={dayData.shift_name}>
                <span className="shift-name">{dayData.shift_name?.substring(0, 1)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  const renderWeekView = () => {
    if (viewMode !== 'week') return null;

    const days: React.ReactNode[] = [];
    let current = displayStart;

    while (current <= displayEnd) {
      const dateStr = format(current, 'yyyy-MM-dd');
      const dayData = scheduleByDate.get(dateStr);
      const isToday = format(current, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const dayName = format(current, 'EEE, MMM d');

      let rowClass = 'week-day-row';
      if (isToday) rowClass += ' today';

      days.push(
        <div key={dateStr} className={rowClass}>
          <div className="week-day-header">{dayName}</div>
          <div className="week-day-content">
            {!dayData || dayData.type === 'UNSCHEDULED' ? (
              <div className="unscheduled-card">
                <FaQuestion size={18} />
                <span>No shift assigned</span>
              </div>
            ) : dayData.type === 'OFF_DAY' ? (
              <div className="off-day-card">
                <FaTimesCircle size={18} />
                <span>Day Off</span>
                {dayData.reason && <small>{dayData.reason}</small>}
              </div>
            ) : (
              <div className="shift-card">
                <div className="shift-header">
                  <FaClock size={16} />
                  <strong>{dayData.shift_name}</strong>
                </div>
                <div className="shift-time">
                  {dayData.start_time} – {dayData.end_time}
                </div>
                {dayData.status && (
                  <div className={`shift-status ${dayData.status.toLowerCase()}`}>
                    <FaCheckCircle size={12} />
                    {dayData.status}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );

      current = addDays(current, 1);
    }

    return days;
  };

  return (
    <div className="user-schedule-dashboard">
      <header className="schedule-header">
        <div className="header-title">
          <h1>📅 My Schedule</h1>
          <p>View your assigned shifts and days off</p>
        </div>
      </header>

      <div className="schedule-stats">
        <div className="stat-card">
          <div className="stat-icon shifts">
            <FaClock />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.total_shifts}</div>
            <div className="stat-label">Total Shifts</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon upcoming">
            <FaCalendarAlt />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.upcoming}</div>
            <div className="stat-label">Upcoming</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon completed">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.completed}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon days-off">
            <FaTimesCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.days_off}</div>
            <div className="stat-label">Days Off</div>
          </div>
        </div>
      </div>

      <div className="schedule-controls">
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
            onClick={() => setViewMode('month')}
          >
            📆 Month
          </button>
          <button
            className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >
            📋 Week
          </button>
        </div>
        {viewMode === 'month' && (
          <div className="month-controls">
            <button className="nav-btn" onClick={() => setCurrentMonth(addDays(currentMonth, -30))}>
              ← Prev
            </button>
            <span className="current-month">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button className="nav-btn" onClick={() => setCurrentMonth(addDays(currentMonth, 30))}>
              Next →
            </button>
          </div>
        )}
      </div>

      <div className="schedule-content">
        {/* Always render calendar structure to avoid flicker; show empty cells if no data */}
        {viewMode === 'month' ? (
          <>
            <div className="calendar-weekdays">
              <div className="weekday">Sun</div>
              <div className="weekday">Mon</div>
              <div className="weekday">Tue</div>
              <div className="weekday">Wed</div>
              <div className="weekday">Thu</div>
              <div className="weekday">Fri</div>
              <div className="weekday">Sat</div>
            </div>
            <div className="calendar-grid">
              {renderCalendarDays()}
            </div>
            <div className="calendar-legend">
              <div className="legend-item"><span className="shift-dot"></span> Shift</div>
              <div className="legend-item"><span className="off-dot"></span> Day Off</div>
              <div className="legend-item"><span className="unscheduled-dot"></span> Unscheduled</div>
            </div>
          </>
        ) : (
          <div className="week-view">{renderWeekView()}</div>
        )}

        {/* If no schedule at all (first load completed with empty), show a gentle empty-state banner inside content */}
        {!loading && schedule && schedule.schedule.length === 0 && (
          <div className="empty-inline">
            <FaCalendarAlt size={28} />
            <div>
              <strong>No schedule yet</strong>
              <div>Your schedule will appear here once assigned by your manager.</div>
            </div>
          </div>
        )}

        {/* Loading overlays: large for initial load, subtle for refreshes */}
        {(loading || isRefreshing) && (
          <div className={`loading-overlay ${loading ? 'initial' : 'refresh'}`}>
            <div className="futuristic-spinner">
              <div className="ring"></div>
              <div className="ring ring--small"></div>
            </div>
            <div className="loading-text">{loading ? '⏳ Loading your schedule...' : '⟳ Syncing...'}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserScheduleDashboard;
