import React, { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isWeekend, addMonths, subMonths } from 'date-fns';
import { FaChevronLeft, FaChevronRight, FaUsers, FaClock, FaExclamationTriangle } from 'react-icons/fa';
import { ScheduledShift, Shift } from '../../services/teamApi';
import { UserListItem } from '../../services/userApi';

interface CalendarGridViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  scheduledShifts: ScheduledShift[];
  shifts: Shift[];
  users: UserListItem[];
  loading?: boolean;
}

interface DayData {
  date: Date;
  shifts: ScheduledShift[];
  coverage: 'full' | 'partial' | 'none';
  isWeekend: boolean;
  isCurrentMonth: boolean;
}

const CalendarGridView: React.FC<CalendarGridViewProps> = ({
  currentDate,
  onDateChange,
  scheduledShifts,
  shifts,
  users,
  loading = false
}) => {
  const userMap = useMemo(() => {
    const map = new Map<string, UserListItem>();
    users.forEach(user => map.set(user.id, user));
    return map;
  }, [users]);

  const shiftMap = useMemo(() => {
    const map = new Map<number, Shift>();
    shifts.forEach(shift => map.set(shift.id, shift));
    return map;
  }, [shifts]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = new Date(monthStart);
    calendarStart.setDate(calendarStart.getDate() - calendarStart.getDay());
    
    const calendarEnd = new Date(monthEnd);
    calendarEnd.setDate(calendarEnd.getDate() + (6 - monthEnd.getDay()));
    
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    
    return days.map(date => {
      const dayShifts = scheduledShifts.filter(shift => 
        format(new Date(shift.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );
      
      // Determine coverage level
      let coverage: 'full' | 'partial' | 'none' = 'none';
      if (dayShifts.length > 0) {
        const uniqueShiftTypes = new Set(dayShifts.map(s => s.shift_id));
        coverage = uniqueShiftTypes.size >= 2 ? 'full' : 'partial';
      }
      
      return {
        date,
        shifts: dayShifts,
        coverage,
        isWeekend: isWeekend(date),
        isCurrentMonth: isSameMonth(date, currentDate)
      } as DayData;
    });
  }, [currentDate, scheduledShifts]);

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const getCoverageColor = (coverage: 'full' | 'partial' | 'none', isWeekend: boolean) => {
    if (coverage === 'none') return isWeekend ? 'bg-gray-800' : 'bg-gray-900';
    if (coverage === 'partial') return isWeekend ? 'bg-orange-900' : 'bg-orange-800';
    return isWeekend ? 'bg-green-900' : 'bg-green-800';
  };

  const getCoverageBorder = (coverage: 'full' | 'partial' | 'none') => {
    if (coverage === 'none') return 'border-gray-700';
    if (coverage === 'partial') return 'border-orange-600';
    return 'border-green-600';
  };

  const handlePreviousMonth = () => {
    onDateChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onDateChange(addMonths(currentDate, 1));
  };

  if (loading) {
    return (
      <div className="calendar-loading">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-4"></div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-grid-view">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            onClick={handlePreviousMonth}
            className="nav-btn"
            aria-label="Previous month"
          >
            <FaChevronLeft />
          </button>
          <h2 className="calendar-title">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button
            onClick={handleNextMonth}
            className="nav-btn"
            aria-label="Next month"
          >
            <FaChevronRight />
          </button>
        </div>
        
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color bg-green-800 border-green-600"></div>
            <span>Full Coverage</span>
          </div>
          <div className="legend-item">
            <div className="legend-color bg-orange-800 border-orange-600"></div>
            <span>Partial Coverage</span>
          </div>
          <div className="legend-item">
            <div className="legend-color bg-gray-900 border-gray-700"></div>
            <span>No Coverage</span>
          </div>
        </div>
      </div>

      {/* Week Days Header */}
      <div className="week-header">
        {weekDays.map(day => (
          <div key={day} className="week-day">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="calendar-grid">
        {calendarDays.map((dayData, index) => (
          <div
            key={index}
            className={`calendar-day ${getCoverageColor(dayData.coverage, dayData.isWeekend)} ${getCoverageBorder(dayData.coverage)} ${!dayData.isCurrentMonth ? 'opacity-50' : ''}`}
          >
            <div className="day-header">
              <span className="day-number">{format(dayData.date, 'd')}</span>
              {dayData.shifts.length > 0 && (
                <div className="day-shifts-count">
                  <FaUsers className="w-3 h-3" />
                  {dayData.shifts.length}
                </div>
              )}
            </div>
            
            {dayData.shifts.length > 0 && (
              <div className="day-shifts">
                {dayData.shifts.slice(0, 3).map((shift, shiftIndex) => {
                  const user = userMap.get(shift.user_id);
                  const shiftInfo = shiftMap.get(shift.shift_id);
                  return (
                    <div
                      key={shiftIndex}
                      className="shift-chip"
                      title={`${user?.first_name} ${user?.last_name} - ${shiftInfo?.name || 'Unknown Shift'}`}
                    >
                      <FaClock className="w-2 h-2" />
                      <span className="truncate">
                        {user?.first_name?.charAt(0)}{user?.last_name?.charAt(0)}
                      </span>
                    </div>
                  );
                })}
                {dayData.shifts.length > 3 && (
                  <div className="more-shifts">
                    +{dayData.shifts.length - 3}
                  </div>
                )}
              </div>
            )}
            
            {dayData.coverage === 'none' && !dayData.isWeekend && (
              <div className="coverage-warning">
                <FaExclamationTriangle className="w-3 h-3 text-red-400" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Coverage Summary */}
      <div className="coverage-summary">
        <h3>Monthly Coverage Summary</h3>
        <div className="summary-stats">
          <div className="stat-item">
            <div className="stat-value">
              {calendarDays.filter(d => d.isCurrentMonth && d.coverage === 'full').length}
            </div>
            <div className="stat-label">Full Coverage Days</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {calendarDays.filter(d => d.isCurrentMonth && d.coverage === 'partial').length}
            </div>
            <div className="stat-label">Partial Coverage Days</div>
          </div>
          <div className="stat-item">
            <div className="stat-value text-red-400">
              {calendarDays.filter(d => d.isCurrentMonth && d.coverage === 'none' && !d.isWeekend).length}
            </div>
            <div className="stat-label">Uncovered Weekdays</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">
              {calendarDays.filter(d => d.isCurrentMonth).reduce((sum, d) => sum + d.shifts.length, 0)}
            </div>
            <div className="stat-label">Total Shifts</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarGridView;
