import React, { useMemo } from 'react';
import { format, eachDayOfInterval, startOfMonth, endOfMonth, isWeekend } from 'date-fns';
import { 
  FaChartBar, 
  FaUsers, 
  FaClock, 
  FaExclamationTriangle, 
  FaCheckCircle,
  FaChartLine,
  FaUserCheck,
  FaUserTimes
} from 'react-icons/fa';
import { ScheduledShift, Shift } from '../../services/teamApi';
import { UserListItem } from '../../services/userApi';

interface ShiftAnalyticsViewProps {
  currentDate: Date;
  scheduledShifts: ScheduledShift[];
  shifts: Shift[];
  users: UserListItem[];
  loading?: boolean;
}

interface AnalyticsData {
  totalShifts: number;
  totalHours: number;
  coverageGaps: number;
  overstaffedDays: number;
  topPerformers: UserPerformance[];
  coverageIssues: CoverageIssue[];
  shiftTypeDistribution: ShiftTypeStats[];
  weeklyTrends: WeeklyTrend[];
}

interface UserPerformance {
  user: UserListItem;
  shiftsAssigned: number;
  totalHours: number;
  coveragePercentage: number;
  efficiency: number;
}

interface CoverageIssue {
  date: string;
  issue: 'understaffed' | 'overstaffed' | 'no_coverage';
  severity: 'low' | 'medium' | 'high';
  description: string;
}

interface ShiftTypeStats {
  shiftId: number;
  shiftName: string;
  count: number;
  totalHours: number;
  averageCoverage: number;
}

interface WeeklyTrend {
  week: string;
  shifts: number;
  hours: number;
  coverage: number;
}

const ShiftAnalyticsView: React.FC<ShiftAnalyticsViewProps> = ({
  currentDate,
  scheduledShifts,
  shifts,
  users,
  loading = false
}) => {
  const analytics = useMemo(() => {
    if (!scheduledShifts.length || !shifts.length || !users.length) {
      return {
        totalShifts: 0,
        totalHours: 0,
        coverageGaps: 0,
        overstaffedDays: 0,
        topPerformers: [],
        coverageIssues: [],
        shiftTypeDistribution: [],
        weeklyTrends: []
      } as AnalyticsData;
    }

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

    const shiftMap = new Map<number, Shift>();
    shifts.forEach(shift => shiftMap.set(shift.id, shift));

    const userMap = new Map<string, UserListItem>();
    users.forEach(user => userMap.set(user.id, user));

    // Calculate basic stats
    const totalShifts = scheduledShifts.length;
    let totalHours = 0;

    scheduledShifts.forEach(scheduledShift => {
      const shift = shiftMap.get(scheduledShift.shift_id);
      if (shift) {
        const start = new Date(`2000-01-01T${shift.start_time}`);
        const end = new Date(`2000-01-01T${shift.end_time}`);
        totalHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      }
    });

    // Analyze coverage by day
    const coverageIssues: CoverageIssue[] = [];
    let coverageGaps = 0;
    let overstaffedDays = 0;

    monthDays.forEach(day => {
      if (isWeekend(day)) return; // Skip weekends

      const dayStr = format(day, 'yyyy-MM-dd');
      const dayShifts = scheduledShifts.filter(s => s.date === dayStr);
      const uniqueShiftTypes = new Set(dayShifts.map(s => s.shift_id));

      if (dayShifts.length === 0) {
        coverageIssues.push({
          date: dayStr,
          issue: 'no_coverage',
          severity: 'high',
          description: 'No shifts assigned for this day'
        });
        coverageGaps++;
      } else if (uniqueShiftTypes.size === 1 && dayShifts.length < 2) {
        coverageIssues.push({
          date: dayStr,
          issue: 'understaffed',
          severity: 'medium',
          description: 'Insufficient shift coverage'
        });
        coverageGaps++;
      } else if (dayShifts.length > 6) {
        coverageIssues.push({
          date: dayStr,
          issue: 'overstaffed',
          severity: 'low',
          description: 'Potentially overstaffed'
        });
        overstaffedDays++;
      }
    });

    // User performance analysis
    const userPerformance = users.map(user => {
      const userShifts = scheduledShifts.filter(s => s.user_id === user.id);
      let userHours = 0;

      userShifts.forEach(scheduledShift => {
        const shift = shiftMap.get(scheduledShift.shift_id);
        if (shift) {
          const start = new Date(`2000-01-01T${shift.start_time}`);
          const end = new Date(`2000-01-01T${shift.end_time}`);
          userHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const workedDays = new Set(userShifts.map(s => s.date)).size;
      const totalWorkDays = monthDays.filter(d => !isWeekend(d)).length;
      const coveragePercentage = (workedDays / totalWorkDays) * 100;
      
      // Efficiency based on hours per shift (ideal range: 6-10 hours per shift)
      const avgHoursPerShift = userShifts.length > 0 ? userHours / userShifts.length : 0;
      let efficiency = 100;
      if (avgHoursPerShift < 4) efficiency = 70;
      else if (avgHoursPerShift > 12) efficiency = 75;
      else if (avgHoursPerShift >= 6 && avgHoursPerShift <= 10) efficiency = 95;

      return {
        user,
        shiftsAssigned: userShifts.length,
        totalHours: userHours,
        coveragePercentage,
        efficiency
      } as UserPerformance;
    }).sort((a, b) => b.efficiency - a.efficiency);

    // Shift type distribution
    const shiftTypeStats = shifts.map(shift => {
      const shiftAssignments = scheduledShifts.filter(s => s.shift_id === shift.id);
      let shiftHours = 0;

      shiftAssignments.forEach(scheduledShift => {
        const start = new Date(`2000-01-01T${shift.start_time}`);
        const end = new Date(`2000-01-01T${shift.end_time}`);
        shiftHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      });

      // Average coverage based on how many days this shift type is assigned
      const assignedDays = new Set(shiftAssignments.map(s => s.date)).size;
      const totalWorkDays = monthDays.filter(d => !isWeekend(d)).length;
      const averageCoverage = (assignedDays / totalWorkDays) * 100;

      return {
        shiftId: shift.id,
        shiftName: shift.name,
        count: shiftAssignments.length,
        totalHours: shiftHours,
        averageCoverage
      } as ShiftTypeStats;
    }).sort((a, b) => b.count - a.count);

    // Weekly trends (simplified - using 4 weeks of the month)
    const weeklyTrends: WeeklyTrend[] = [];
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(monthStart);
      weekStart.setDate(monthStart.getDate() + (week * 7));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const weekShifts = scheduledShifts.filter(s => {
        const shiftDate = new Date(s.date);
        return shiftDate >= weekStart && shiftDate <= weekEnd;
      });

      let weekHours = 0;
      weekShifts.forEach(scheduledShift => {
        const shift = shiftMap.get(scheduledShift.shift_id);
        if (shift) {
          const start = new Date(`2000-01-01T${shift.start_time}`);
          const end = new Date(`2000-01-01T${shift.end_time}`);
          weekHours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        }
      });

      const weekWorkDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
        .filter(d => !isWeekend(d)).length;
      const coveredDays = new Set(weekShifts.map(s => s.date)).size;
      const weekCoverage = weekWorkDays > 0 ? (coveredDays / weekWorkDays) * 100 : 0;

      weeklyTrends.push({
        week: `Week ${week + 1}`,
        shifts: weekShifts.length,
        hours: weekHours,
        coverage: weekCoverage
      });
    }

    return {
      totalShifts,
      totalHours,
      coverageGaps,
      overstaffedDays,
      topPerformers: userPerformance.slice(0, 5),
      coverageIssues: coverageIssues.slice(0, 10),
      shiftTypeDistribution: shiftTypeStats,
      weeklyTrends
    } as AnalyticsData;
  }, [currentDate, scheduledShifts, shifts, users]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-700 rounded mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shift-analytics-view">
      {/* Header */}
      <div className="analytics-header">
        <h2>
          <FaChartBar className="w-6 h-6" />
          Shift Analytics - {format(currentDate, 'MMMM yyyy')}
        </h2>
        <p>Comprehensive insights into team performance and shift coverage</p>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card primary">
          <div className="metric-icon">
            <FaClock className="w-8 h-8" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analytics.totalShifts}</div>
            <div className="metric-label">Total Shifts</div>
          </div>
        </div>

        <div className="metric-card success">
          <div className="metric-icon">
            <FaUsers className="w-8 h-8" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analytics.totalHours.toFixed(0)}</div>
            <div className="metric-label">Total Hours</div>
          </div>
        </div>

        <div className="metric-card warning">
          <div className="metric-icon">
            <FaExclamationTriangle className="w-8 h-8" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analytics.coverageGaps}</div>
            <div className="metric-label">Coverage Gaps</div>
          </div>
        </div>

        <div className="metric-card info">
          <div className="metric-icon">
            <FaChartLine className="w-8 h-8" />
          </div>
          <div className="metric-content">
            <div className="metric-value">{analytics.overstaffedDays}</div>
            <div className="metric-label">Overstaffed Days</div>
          </div>
        </div>
      </div>

      <div className="analytics-content">
        {/* Top Performers */}
        <div className="analytics-section">
          <h3>
            <FaUserCheck className="w-5 h-5" />
            Top Performers
          </h3>
          <div className="performers-list">
            {analytics.topPerformers.map((performer, index) => (
              <div key={performer.user.id} className="performer-card">
                <div className="performer-rank">#{index + 1}</div>
                <div className="performer-info">
                  <div className="performer-name">
                    {performer.user.first_name} {performer.user.last_name}
                  </div>
                  <div className="performer-stats">
                    <span>{performer.shiftsAssigned} shifts</span>
                    <span>•</span>
                    <span>{performer.totalHours.toFixed(1)}h</span>
                    <span>•</span>
                    <span>{performer.coveragePercentage.toFixed(0)}% coverage</span>
                  </div>
                </div>
                <div className="performer-efficiency">
                  <div className="efficiency-score">{performer.efficiency}%</div>
                  <div className="efficiency-bar">
                    <div 
                      className="efficiency-fill"
                      style={{ width: `${performer.efficiency}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage Issues */}
        <div className="analytics-section">
          <h3>
            <FaExclamationTriangle className="w-5 h-5" />
            Coverage Issues
          </h3>
          <div className="issues-list">
            {analytics.coverageIssues.length > 0 ? (
              analytics.coverageIssues.map((issue, index) => (
                <div key={index} className={`issue-card ${issue.severity}`}>
                  <div className="issue-date">
                    {format(new Date(issue.date), 'MMM d, yyyy')}
                  </div>
                  <div className="issue-details">
                    <div className="issue-type">{issue.issue.replace('_', ' ')}</div>
                    <div className="issue-description">{issue.description}</div>
                  </div>
                  <div className={`issue-severity ${issue.severity}`}>
                    {issue.severity}
                  </div>
                </div>
              ))
            ) : (
              <div className="no-issues">
                <FaCheckCircle className="w-8 h-8 text-green-500" />
                <p>No coverage issues detected this month!</p>
              </div>
            )}
          </div>
        </div>

        {/* Shift Type Distribution */}
        <div className="analytics-section">
          <h3>
            <FaChartBar className="w-5 h-5" />
            Shift Type Distribution
          </h3>
          <div className="shift-distribution">
            {analytics.shiftTypeDistribution.map(shiftType => (
              <div key={shiftType.shiftId} className="shift-type-card">
                <div className="shift-type-header">
                  <div className="shift-type-name">{shiftType.shiftName}</div>
                  <div className="shift-type-count">{shiftType.count} shifts</div>
                </div>
                <div className="shift-type-stats">
                  <div className="stat">
                    <span className="stat-label">Hours:</span>
                    <span className="stat-value">{shiftType.totalHours.toFixed(1)}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Coverage:</span>
                    <span className="stat-value">{shiftType.averageCoverage.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="coverage-bar">
                  <div 
                    className="coverage-fill"
                    style={{ width: `${shiftType.averageCoverage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weekly Trends */}
        <div className="analytics-section full-width">
          <h3>
            <FaChartLine className="w-5 h-5" />
            Weekly Trends
          </h3>
          <div className="trends-chart">
            {analytics.weeklyTrends.map((trend, index) => (
              <div key={index} className="trend-bar">
                <div className="trend-label">{trend.week}</div>
                <div className="trend-metrics">
                  <div className="trend-metric">
                    <div className="metric-bar">
                      <div 
                        className="metric-fill shifts"
                        style={{ height: `${Math.min((trend.shifts / 20) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="metric-value">{trend.shifts}</div>
                    <div className="metric-label">shifts</div>
                  </div>
                  <div className="trend-metric">
                    <div className="metric-bar">
                      <div 
                        className="metric-fill hours"
                        style={{ height: `${Math.min((trend.hours / 200) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <div className="metric-value">{trend.hours.toFixed(0)}</div>
                    <div className="metric-label">hours</div>
                  </div>
                  <div className="trend-metric">
                    <div className="metric-bar">
                      <div 
                        className="metric-fill coverage"
                        style={{ height: `${trend.coverage}%` }}
                      ></div>
                    </div>
                    <div className="metric-value">{trend.coverage.toFixed(0)}%</div>
                    <div className="metric-label">coverage</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShiftAnalyticsView;
