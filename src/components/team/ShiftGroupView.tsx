import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, addMonths, subMonths } from 'date-fns';
import { FaChevronLeft, FaChevronRight, FaUsers, FaClock, FaExclamationTriangle, FaCheckCircle, FaUser, FaCalendarAlt } from 'react-icons/fa';
import { Shift, ScheduledShift } from '../../services/teamApi';
import { UserListItem } from '../../services/userApi';

interface ShiftGroupViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  scheduledShifts: ScheduledShift[];
  shifts: Shift[];
  users: UserListItem[];
  loading?: boolean;
}

interface GroupedShift {
  shift: Shift;
  date: Date;
  assignedUsers: UserListItem[];
  scheduledShifts: ScheduledShift[];
  coverageStatus: 'full' | 'partial' | 'none';
  requiredStaff: number;
  actualStaff: number;
}

interface DayData {
  date: Date;
  shiftGroups: GroupedShift[];
  totalCoverage: number;
  isWeekend: boolean;
}

const ShiftGroupView: React.FC<ShiftGroupViewProps> = ({
  currentDate,
  onDateChange,
  scheduledShifts,
  shifts,
  users,
  loading
}) => {
  const [selectedShift, setSelectedShift] = useState<GroupedShift | null>(null);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Group shifts by date and shift type
  const groupedData = useMemo(() => {
    if (!shifts.length || !scheduledShifts.length || !users.length) {
      return [];
    }

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return daysInMonth.map(date => {
      const dayScheduledShifts = scheduledShifts.filter(shift => 
        format(new Date(shift.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
      );

      const shiftGroups: GroupedShift[] = shifts.map(shift => {
        const shiftAssignments = dayScheduledShifts.filter(scheduled => 
          scheduled.shift_id === shift.id
        );

        const assignedUsers = shiftAssignments
          .map(assignment => users.find(user => user.id === assignment.user_id))
          .filter(Boolean) as UserListItem[];

        const requiredStaff = (shift.metadata as any)?.required_staff || 1;
        const actualStaff = assignedUsers.length;
        const coverageStatus = actualStaff >= requiredStaff ? 'full' : 
                              actualStaff > 0 ? 'partial' : 'none';

        return {
          shift,
          date,
          assignedUsers,
          scheduledShifts: shiftAssignments,
          coverageStatus,
          requiredStaff,
          actualStaff
        };
      });

      const totalCoverage = shiftGroups.reduce((sum, group) => 
        sum + (group.coverageStatus === 'full' ? 1 : 0), 0
      );

      return {
        date,
        shiftGroups,
        totalCoverage,
        isWeekend: isWeekend(date)
      };
    });
  }, [currentDate, scheduledShifts, shifts, users]);

  const toggleDayExpansion = (dateKey: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey);
      } else {
        newSet.add(dateKey);
      }
      return newSet;
    });
  };

  const getCoverageColor = (status: 'full' | 'partial' | 'none') => {
    switch (status) {
      case 'full': return 'var(--success)';
      case 'partial': return 'var(--warning)';
      case 'none': return 'var(--error)';
    }
  };

  const getCoverageIcon = (status: 'full' | 'partial' | 'none') => {
    switch (status) {
      case 'full': return <FaCheckCircle />;
      case 'partial': return <FaExclamationTriangle />;
      case 'none': return <FaExclamationTriangle />;
    }
  };

  if (loading) {
    return (
      <div className="shift-group-view loading">
        <div className="loading-spinner"></div>
        <p>Loading shift schedule...</p>
      </div>
    );
  }

  return (
    <div className="shift-group-view">
      {/* Header */}
      <div className="shift-group-header">
        <div className="month-navigation">
          <button 
            className="nav-btn"
            onClick={() => onDateChange(subMonths(currentDate, 1))}
            aria-label="Previous month"
          >
            <FaChevronLeft />
          </button>
          <h2 className="month-title">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <button 
            className="nav-btn"
            onClick={() => onDateChange(addMonths(currentDate, 1))}
            aria-label="Next month"
          >
            <FaChevronRight />
          </button>
        </div>

        <div className="coverage-summary">
          <div className="summary-item">
            <FaCalendarAlt />
            <span>{groupedData.length} days</span>
          </div>
          <div className="summary-item">
            <FaCheckCircle style={{ color: 'var(--success)' }} />
            <span>{groupedData.reduce((sum, day) => sum + day.totalCoverage, 0)} fully covered</span>
          </div>
          <div className="summary-item">
            <FaExclamationTriangle style={{ color: 'var(--warning)' }} />
            <span>{groupedData.reduce((sum, day) => sum + day.shiftGroups.filter(g => g.coverageStatus === 'partial').length, 0)} partial</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="shift-grid">
        {groupedData.map((dayData) => {
          const dateKey = format(dayData.date, 'yyyy-MM-dd');
          const isExpanded = expandedDays.has(dateKey);
          const hasIssues = dayData.shiftGroups.some(g => g.coverageStatus !== 'full');

          return (
            <div 
              key={dateKey}
              className={`day-card ${dayData.isWeekend ? 'weekend' : ''} ${hasIssues ? 'has-issues' : ''}`}
            >
              <div 
                className="day-header"
                onClick={() => toggleDayExpansion(dateKey)}
              >
                <div className="day-info">
                  <span className="day-number">{format(dayData.date, 'd')}</span>
                  <span className="day-name">{format(dayData.date, 'EEE')}</span>
                </div>
                <div className="day-status">
                  <div className="coverage-indicator">
                    {dayData.totalCoverage}/{dayData.shiftGroups.length}
                  </div>
                  {hasIssues && <FaExclamationTriangle className="warning-icon" />}
                </div>
              </div>

              {isExpanded && (
                <div className="day-shifts">
                  {dayData.shiftGroups.map((group) => (
                    <div 
                      key={`${group.shift.id}-${dateKey}`}
                      className="shift-group"
                      onClick={() => setSelectedShift(group)}
                    >
                      <div className="shift-info">
                        <div className="shift-time">
                          <FaClock />
                          <span>{group.shift.start_time} - {group.shift.end_time}</span>
                        </div>
                        <div className="shift-name">{group.shift.name}</div>
                      </div>
                      
                      <div className="coverage-status">
                        {getCoverageIcon(group.coverageStatus)}
                        <span className="coverage-text">
                          {group.actualStaff}/{group.requiredStaff}
                        </span>
                      </div>

                      <div className="assigned-users">
                        {group.assignedUsers.length > 0 ? (
                          <div className="user-avatars">
                            {group.assignedUsers.slice(0, 3).map((user, idx) => (
                              <div 
                                key={user.id}
                                className="user-avatar"
                                title={`${user.first_name} ${user.last_name}`}
                              >
                                {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                              </div>
                            ))}
                            {group.assignedUsers.length > 3 && (
                              <div className="more-users">
                                +{group.assignedUsers.length - 3}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="no-assignment">
                            <FaUser />
                            <span>Unassigned</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Shift Detail Modal */}
      {selectedShift && (
        <div className="modal-overlay" onClick={() => setSelectedShift(null)}>
          <div className="shift-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {selectedShift.shift.name} - {format(selectedShift.date, 'MMM d, yyyy')}
              </h3>
              <button 
                className="close-btn"
                onClick={() => setSelectedShift(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-content">
              <div className="shift-details">
                <div className="detail-row">
                  <span className="label">Time:</span>
                  <span>{selectedShift.shift.start_time} - {selectedShift.shift.end_time}</span>
                </div>
                <div className="detail-row">
                  <span className="label">Coverage:</span>
                  <span className={`coverage-badge ${selectedShift.coverageStatus}`}>
                    {selectedShift.actualStaff}/{selectedShift.requiredStaff} staff
                  </span>
                </div>
              </div>

              <div className="assigned-staff">
                <h4>Assigned Staff ({selectedShift.assignedUsers.length})</h4>
                {selectedShift.assignedUsers.length > 0 ? (
                  <div className="staff-list">
                    {selectedShift.assignedUsers.map((user) => (
                      <div key={user.id} className="staff-item">
                        <div className="staff-avatar">
                          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
                        </div>
                        <div className="staff-info">
                          <div className="staff-name">
                            {user.first_name} {user.last_name}
                          </div>
                          <div className="staff-role">{user.role}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-staff">
                    <FaUser />
                    <span>No staff assigned to this shift</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShiftGroupView;
