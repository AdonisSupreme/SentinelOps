import React, { useMemo, useState } from 'react';
import { format, eachDayOfInterval, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { FaChevronLeft, FaChevronRight, FaUsers, FaClock, FaUserCircle } from 'react-icons/fa';
import { ScheduledShift, Shift } from '../../services/teamApi';
import { UserListItem } from '../../services/userApi';

interface TeamTimelineViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  scheduledShifts: ScheduledShift[];
  shifts: Shift[];
  users: UserListItem[];
  loading?: boolean;
}

interface UserTimeline {
  user: UserListItem;
  shifts: ScheduledShift[];
  totalHours: number;
  coveragePercentage: number;
}

const TeamTimelineView: React.FC<TeamTimelineViewProps> = ({
  currentDate,
  onDateChange,
  scheduledShifts,
  shifts,
  users,
  loading = false
}) => {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

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

  const userTimelines = useMemo(() => {
    return users.map(user => {
      const userShifts = scheduledShifts.filter(shift => shift.user_id === user.id);
      
      // Calculate total hours for the week
      let totalHours = 0;
      userShifts.forEach(shift => {
        const shiftInfo = shiftMap.get(shift.shift_id);
        if (shiftInfo) {
          const start = new Date(`2000-01-01T${shiftInfo.start_time}`);
          const end = new Date(`2000-01-01T${shiftInfo.end_time}`);
          totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      // Calculate coverage percentage (days worked / total days)
      const workedDays = new Set(userShifts.map(s => s.date)).size;
      const coveragePercentage = (workedDays / weekDays.length) * 100;

      return {
        user,
        shifts: userShifts,
        totalHours,
        coveragePercentage
      } as UserTimeline;
    }).sort((a, b) => b.totalHours - a.totalHours); // Sort by hours worked
  }, [users, scheduledShifts, shiftMap, weekDays.length]);

  const getShiftForDay = (userShifts: ScheduledShift[], day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return userShifts.find(shift => shift.date === dayStr);
  };

  const getShiftColor = (shiftId: number) => {
    const colors = [
      'bg-blue-600', 'bg-green-600', 'bg-purple-600', 'bg-orange-600',
      'bg-pink-600', 'bg-indigo-600', 'bg-teal-600', 'bg-red-600'
    ];
    return colors[shiftId % colors.length];
  };

  const handlePreviousWeek = () => {
    onDateChange(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    onDateChange(addWeeks(currentDate, 1));
  };

  if (loading) {
    return (
      <div className="timeline-loading">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-4"></div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="team-timeline-view">
      {/* Timeline Header */}
      <div className="timeline-header">
        <div className="timeline-nav">
          <button
            onClick={handlePreviousWeek}
            className="nav-btn"
            aria-label="Previous week"
          >
            <FaChevronLeft />
          </button>
          <h2 className="timeline-title">
            Team Timeline - {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
          </h2>
          <button
            onClick={handleNextWeek}
            className="nav-btn"
            aria-label="Next week"
          >
            <FaChevronRight />
          </button>
        </div>

        <div className="timeline-stats">
          <div className="stat">
            <FaUsers className="w-4 h-4" />
            <span>{users.length} Team Members</span>
          </div>
          <div className="stat">
            <FaClock className="w-4 h-4" />
            <span>{userTimelines.reduce((sum, t) => sum + t.totalHours, 0).toFixed(1)} Total Hours</span>
          </div>
        </div>
      </div>

      {/* Week Days Header */}
      <div className="timeline-days-header">
        <div className="user-label">Team Member</div>
        {weekDays.map(day => (
          <div key={day.toISOString()} className="day-column">
            <div className="day-name">{format(day, 'EEE')}</div>
            <div className="day-date">{format(day, 'd')}</div>
            {format(day, 'EEE') === 'Sat' || format(day, 'EEE') === 'Sun' ? (
              <div className="weekend-indicator">W</div>
            ) : null}
          </div>
        ))}
      </div>

      {/* User Timelines */}
      <div className="timeline-rows">
        {userTimelines.map(timeline => (
          <div
            key={timeline.user.id}
            className={`timeline-row ${selectedUser === timeline.user.id ? 'selected' : ''}`}
            onClick={() => setSelectedUser(selectedUser === timeline.user.id ? null : timeline.user.id)}
          >
            <div className="user-info">
              <div className="user-avatar">
                <FaUserCircle className="w-8 h-8" />
              </div>
              <div className="user-details">
                <div className="user-name">
                  {timeline.user.first_name} {timeline.user.last_name}
                </div>
                <div className="user-stats">
                  {timeline.totalHours.toFixed(1)}h • {timeline.coveragePercentage.toFixed(0)}% coverage
                </div>
              </div>
            </div>

            <div className="user-shifts">
              {weekDays.map(day => {
                const shift = getShiftForDay(timeline.shifts, day);
                const shiftInfo = shift ? shiftMap.get(shift.shift_id) : null;
                
                return (
                  <div key={day.toISOString()} className="shift-cell">
                    {shift && shiftInfo ? (
                      <div
                        className={`shift-block ${getShiftColor(shift.shift_id)}`}
                        title={`${shiftInfo.name}: ${shiftInfo.start_time} - ${shiftInfo.end_time}`}
                      >
                        <div className="shift-time">{shiftInfo.start_time}</div>
                        <div className="shift-name">{shiftInfo.name.substring(0, 3)}</div>
                      </div>
                    ) : (
                      <div className="empty-shift">
                        {format(day, 'EEE') === 'Sat' || format(day, 'EEE') === 'Sun' ? (
                          <div className="weekend-off">OFF</div>
                        ) : (
                          <div className="unassigned">—</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Selected User Details */}
      {selectedUser && (
        <div className="selected-user-details">
          {(() => {
            const timeline = userTimelines.find(t => t.user.id === selectedUser);
            if (!timeline) return null;
            
            return (
              <div className="user-detail-card">
                <div className="detail-header">
                  <h3>
                    <FaUserCircle className="w-5 h-5" />
                    {timeline.user.first_name} {timeline.user.last_name}
                  </h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="close-btn"
                  >
                    ×
                  </button>
                </div>
                
                <div className="detail-stats">
                  <div className="detail-stat">
                    <div className="stat-label">Total Hours This Week</div>
                    <div className="stat-value">{timeline.totalHours.toFixed(1)} hours</div>
                  </div>
                  <div className="detail-stat">
                    <div className="stat-label">Working Days</div>
                    <div className="stat-value">{new Set(timeline.shifts.map(s => s.date)).size} / {weekDays.length} days</div>
                  </div>
                  <div className="detail-stat">
                    <div className="stat-label">Coverage Rate</div>
                    <div className="stat-value">{timeline.coveragePercentage.toFixed(1)}%</div>
                  </div>
                </div>

                <div className="shift-list">
                  <h4>Shift Schedule</h4>
                  {timeline.shifts.map(shift => {
                    const shiftInfo = shiftMap.get(shift.shift_id);
                    return (
                      <div key={shift.id} className="shift-detail">
                        <div className="shift-date">{format(new Date(shift.date), 'EEEE, MMM d')}</div>
                        <div className="shift-info">
                          <span className={`shift-type ${getShiftColor(shift.shift_id)}`}>
                            {shiftInfo?.name || 'Unknown Shift'}
                          </span>
                          <span className="shift-time">
                            {shiftInfo?.start_time} - {shiftInfo?.end_time}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default TeamTimelineView;
