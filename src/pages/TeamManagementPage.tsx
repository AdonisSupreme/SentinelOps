import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaUsers,
  FaPlus,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaCheckCircle,
  FaTimesCircle,
  FaQuestion,
  FaExclamationTriangle,
  FaUserPlus
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import './UserScheduleDashboard.css';

type ViewPreset = 'tomorrow' | 'weekend' | 'this_month' | 'next_month';

interface TeamDayData {
  date: string;
  shifts: ScheduledShift[];
  assignedUsers: UserListItem[];
  coverageStatus: 'full' | 'partial' | 'none';
  totalRequired: number;
  totalAssigned: number;
}

const TeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [sectionUsers, setSectionUsers] = useState<UserListItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sectionId, setSectionId] = useState<string>('');

  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const displayStart = viewMode === 'month' ? monthStart : today;
  const displayEnd = viewMode === 'month' ? monthEnd : addDays(today, 7);

  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin';
  const userSectionId = (currentUser as any)?.section_id || '';

  const effectiveSectionId = useMemo(() => {
    if (isAdmin && sectionId) return sectionId;
    return userSectionId;
  }, [isAdmin, sectionId, userSectionId]);

  const dateRange = useMemo(() => {
    const today = new Date();
    switch (viewPreset) {
      case 'tomorrow':
        return {
          start: addDays(today, 1),
          end: addDays(today, 1),
        };
      case 'weekend':
        const sat = addDays(today, (6 - today.getDay() + 7) % 7);
        const sun = addDays(sat, 1);
        return { start: sat, end: sun };
      case 'this_month':
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
        };
      case 'next_month':
        const next = addMonths(today, 1);
        return {
          start: startOfMonth(next),
          end: endOfMonth(next),
        };
      default:
        return {
          start: startOfMonth(today),
          end: endOfMonth(today),
        };
    }
  }, [viewPreset]);

  // Memoize date strings to prevent unnecessary useEffect reruns
  const dateRangeKey = useMemo(
    () => `${format(displayStart, 'yyyy-MM-dd')}_${format(displayEnd, 'yyyy-MM-dd')}_${effectiveSectionId}`,
    [displayStart, displayEnd, effectiveSectionId]
  );

  const canManageTeam = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    return r === 'admin' || r === 'supervisor' || r === 'manager';
  }, [currentUser]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [shiftsData, sectionsData, usersData] = await Promise.all([
          teamApi.listShifts(),
          orgApi.listSections(),
          userApi.listUsersBySection(effectiveSectionId)
        ]);
        
        setShifts(shiftsData);
        setSections(sectionsData);
        setSectionUsers(usersData);
        
        // Set default section if not provided
        if (!sectionId) {
          if (isAdmin && sectionsData.length > 0) {
            setSectionId(sectionsData[0].id);
          } else if (!isAdmin && userSectionId) {
            setSectionId(userSectionId);
          }
        }
      } catch (err) {
        console.error('Failed to load initial data', err);
        addNotification({
          type: 'error',
          message: 'Failed to load team data',
          priority: 'high',
        });
      }
    };
    
    loadInitialData();
  }, [currentUser, effectiveSectionId, addNotification]);

  // Load scheduled shifts
  useEffect(() => {
    const loadSchedule = async () => {
      if (!effectiveSectionId) return;
      
      if (!scheduledShifts.length) setLoading(true);
      else setIsRefreshing(true);
      
      try {
        const scheduleData = await teamApi.listScheduledShifts({
          start_date: format(displayStart, 'yyyy-MM-dd'),
          end_date: format(displayEnd, 'yyyy-MM-dd'),
          section_id: effectiveSectionId,
        });
        setScheduledShifts(scheduleData);
      } catch (err) {
        console.error('Failed to load schedule', err);
        addNotification({
          type: 'error',
          message: 'Failed to load team schedule',
          priority: 'high',
        });
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    };
    
    loadSchedule();
  }, [dateRangeKey]);

  // Process schedule data by date
  const scheduleByDate = useMemo(() => {
    const map = new Map<string, TeamDayData>();
    
    // Initialize all dates in range
    let current = displayStart;
    while (current <= displayEnd) {
      const dateStr = format(current, 'yyyy-MM-dd');
      map.set(dateStr, {
        date: dateStr,
        shifts: [],
        assignedUsers: [],
        coverageStatus: 'none',
        totalRequired: 0,
        totalAssigned: 0
      });
      current = addDays(current, 1);
    }
    
    // Process scheduled shifts
    scheduledShifts.forEach((scheduledShift) => {
      const dateStr = scheduledShift.date;
      const dayData = map.get(dateStr);
      if (dayData) {
        dayData.shifts.push(scheduledShift);
        
        const user = sectionUsers.find(u => u.id === scheduledShift.user_id);
        if (user && !dayData.assignedUsers.find(u => u.id === user.id)) {
          dayData.assignedUsers.push(user);
        }
      }
    });
    
    // Calculate coverage status
    map.forEach((dayData) => {
      const shiftIdsArray = Array.from(new Set(dayData.shifts.map(s => s.shift_id)));
      dayData.totalRequired = shiftIdsArray.length * 1; // Assume 1 person per shift
      dayData.totalAssigned = dayData.assignedUsers.length;
      
      if (dayData.totalAssigned >= dayData.totalRequired) {
        dayData.coverageStatus = 'full';
      } else if (dayData.totalAssigned > 0) {
        dayData.coverageStatus = 'partial';
      } else {
        dayData.coverageStatus = 'none';
      }
    });
    
    return map;
  }, [scheduledShifts, sectionUsers, displayStart, displayEnd]);

  const stats = useMemo(() => {
    let totalShifts = 0;
    let fullyCovered = 0;
    let partiallyCovered = 0;
    let uncovered = 0;
    
    scheduleByDate.forEach((dayData) => {
      totalShifts += dayData.shifts.length;
      if (dayData.coverageStatus === 'full') fullyCovered++;
      else if (dayData.coverageStatus === 'partial') partiallyCovered++;
      else uncovered++;
    });
    
    return {
      total_shifts: totalShifts,
      fully_covered: fullyCovered,
      partially_covered: partiallyCovered,
      uncovered: uncovered
    };
  }, [scheduleByDate]);

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

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayData = scheduleByDate.get(dateStr);
      const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
      const isPast = date < today;

      let dayClass = 'calendar-day';
      if (isToday) dayClass += ' today';
      if (isPast) dayClass += ' past';

      days.push(
        <div key={dateStr} className={dayClass}>
          <div className="day-number">{day}</div>
          <div className="day-content">
            {!dayData || dayData.coverageStatus === 'none' ? (
              <div className="unscheduled" title="No coverage">
                <FaExclamationTriangle size={14} />
              </div>
            ) : dayData.coverageStatus === 'partial' ? (
              <div className="off-day" title={`Partial coverage: ${dayData.totalAssigned}/${dayData.totalRequired}`}>
                <FaUserPlus size={14} />
              </div>
            ) : (
              <div className="shift" title={`Full coverage: ${dayData.totalAssigned} staff`}>
                <span className="shift-name">{dayData.totalAssigned}</span>
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
            {!dayData || dayData.coverageStatus === 'none' ? (
              <div className="unscheduled-card">
                <FaExclamationTriangle size={18} />
                <span>No coverage</span>
              </div>
            ) : dayData.coverageStatus === 'partial' ? (
              <div className="off-day-card">
                <FaUserPlus size={18} />
                <span>Partial Coverage</span>
                <small>{dayData.totalAssigned}/{dayData.totalRequired} staff</small>
              </div>
            ) : (
              <div className="shift-card">
                <div className="shift-header">
                  <FaUsers size={16} />
                  <strong>Full Coverage</strong>
                </div>
                <div className="shift-time">
                  {dayData.totalAssigned} staff assigned
                </div>
                <div className="shift-status">
                  <FaCheckCircle size={12} />
                  Fully Covered
                </div>
              </div>
            )}
          </div>
        </div>
      );

      current = addDays(current, 1);
    }

    return days;
  };

  if (!canManageTeam) {
    return (
      <div className="user-schedule-dashboard">
        <div className="empty-inline">
          <FaUsers size={32} />
          <div>
            <strong>Access Denied</strong>
            <div>You need manager or admin rights to view team schedules.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="user-schedule-dashboard">
      <header className="schedule-header">
        <div className="header-title">
          <h1>👥 Team Schedule</h1>
          <p>View team shift coverage and assignments</p>
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
          <div className="stat-icon completed">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.fully_covered}</div>
            <div className="stat-label">Fully Covered</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon upcoming">
            <FaUserPlus />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.partially_covered}</div>
            <div className="stat-label">Partial Coverage</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon days-off">
            <FaExclamationTriangle />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.uncovered}</div>
            <div className="stat-label">No Coverage</div>
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

      <div className="usd-schedule-content">
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
              <div className="legend-item"><span className="shift-dot"></span> Full Coverage</div>
              <div className="legend-item"><span className="off-dot"></span> Partial Coverage</div>
              <div className="legend-item"><span className="unscheduled-dot"></span> No Coverage</div>
            </div>
          </>
        ) : (
          <div className="week-view">{renderWeekView()}</div>
        )}

        {!loading && scheduledShifts.length === 0 && (
          <div className="empty-inline">
            <FaCalendarAlt size={28} />
            <div>
              <strong>No schedule data</strong>
              <div>Team schedule will appear here once shifts are assigned.</div>
            </div>
          </div>
        )}

        {(loading || isRefreshing) && (
          <div className={`loading-overlay ${loading ? 'initial' : 'refresh'}`}>
            <div className="futuristic-spinner">
              <div className="ring"></div>
              <div className="ring ring--small"></div>
            </div>
            <div className="loading-text">{loading ? '⏳ Loading team schedule...' : '⟳ Syncing...'}</div>
          </div>
        )}
      </div>
      <PageGuide guide={pageGuides.teamManagement} />
    </div>
  );
};

export default TeamManagementPage;
