import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FaCalendarAlt,
  FaUsers,
  FaPlus,
  FaTrash,
  FaClock,
  FaTimes,
  FaWrench,
  FaTh,
  FaStream,
  FaChartBar,
  FaSync,
  FaFilter
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { shiftSchedulingApi, ShiftPattern } from '../services/shiftSchedulingApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, addMonths, startOfMonth, endOfMonth, parseISO, isWeekend } from 'date-fns';

// Import new view components
import CalendarGridView from '../components/team/CalendarGridView';
import TeamTimelineView from '../components/team/TeamTimelineView';
import ShiftAnalyticsView from '../components/team/ShiftAnalyticsView';

import './RevampedTeamManagementPage.css';

type ViewMode = 'calendar' | 'timeline' | 'analytics';
type ViewPreset = 'tomorrow' | 'weekend' | 'this_month' | 'next_month';

interface TeamData {
  shifts: Shift[];
  scheduledShifts: ScheduledShift[];
  sectionUsers: UserListItem[];
  sections: Section[];
  patterns: ShiftPattern[];
  lastUpdated: Date;
}

const RevampedTeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  // Core state with optimized data management
  const [teamData, setTeamData] = useState<TeamData>({
    shifts: [],
    scheduledShifts: [],
    sectionUsers: [],
    sections: [],
    patterns: [],
    lastUpdated: new Date()
  });
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sectionId, setSectionId] = useState<string>('');

  // Assignment form state
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignForm, setAssignForm] = useState({
    mode: 'single' as 'single' | 'bulk',
    shift_id: 0,
    user_id: '',
    date: '',
    pattern_id: '',
    users: [] as string[],
    start_date: '',
    end_date: '',
  });

  // Days off form state
  const [showDaysOffModal, setShowDaysOffModal] = useState(false);
  const [daysOffForm, setDaysOffForm] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    reason: 'Vacation',
  });

  // Computed values with memoization
  const isAdmin = useMemo(() => (currentUser?.role || '').toLowerCase() === 'admin', [currentUser]);
  const canApproveDaysOff = useMemo(() => {
    const role = (currentUser?.role || '').toLowerCase();
    return role === 'admin' || role === 'manager' || role === 'supervisor';
  }, [currentUser]);
  const userSectionId = useMemo(() => (currentUser as any)?.section_id || '', [currentUser]);
  
  const canManageTeam = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    return r === 'admin' || r === 'supervisor' || r === 'manager';
  }, [currentUser]);

  const effectiveSectionId = useMemo(() => {
    if (isAdmin && sectionId) return sectionId;
    return userSectionId;
  }, [isAdmin, sectionId, userSectionId]);

  const dateRange = useMemo(() => {
    const today = new Date();
    switch (viewPreset) {
      case 'tomorrow':
        return { start: addDays(today, 1), end: addDays(today, 1) };
      case 'weekend':
        const sat = addDays(today, (6 - today.getDay() + 7) % 7);
        const sun = addDays(sat, 1);
        return { start: sat, end: sun };
      case 'this_month':
        return { start: startOfMonth(today), end: endOfMonth(today) };
      case 'next_month':
        const next = addMonths(today, 1);
        return { start: startOfMonth(next), end: endOfMonth(next) };
      default:
        return { start: startOfMonth(today), end: endOfMonth(today) };
    }
  }, [viewPreset]);

  // Optimized data loading with caching
  const loadTeamData = useCallback(async (forceRefresh = false) => {
    if (!canManageTeam) return;
    
    const now = new Date();
    const cacheAge = now.getTime() - teamData.lastUpdated.getTime();
    const isCacheValid = cacheAge < 5 * 60 * 1000; // 5 minutes cache

    if (!forceRefresh && isCacheValid && teamData.shifts.length > 0) {
      return; // Use cached data
    }

    setLoading(true);
    try {
      const [shiftsData, sectionsData, patternsData] = await Promise.all([
        teamApi.listShifts(),
        orgApi.listSections(),
        shiftSchedulingApi.listShiftPatterns(effectiveSectionId),
      ]);

      setTeamData(prev => ({
        ...prev,
        shifts: shiftsData,
        sections: sectionsData,
        patterns: patternsData,
        lastUpdated: now
      }));

      // Auto-set section for non-admins or initialize admin section selection
      if (!sectionId) {
        if (isAdmin && sectionsData.length > 0) {
          setSectionId(sectionsData[0].id);
        } else if (!isAdmin && userSectionId) {
          setSectionId(userSectionId);
        }
      }
    } catch (err) {
      console.error('Failed to load team data', err);
      addNotification({
        type: 'error',
        message: 'Failed to load scheduling data.',
        priority: 'high',
      });
    } finally {
      setLoading(false);
    }
  }, [canManageTeam, effectiveSectionId, teamData.lastUpdated, teamData.shifts.length, sectionId, isAdmin, userSectionId, addNotification]);

  // Load scheduled shifts with optimization
  const loadScheduledShifts = useCallback(async () => {
    if (!canManageTeam || !effectiveSectionId) return;
    
    try {
      const schedData = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId,
      });

      setTeamData(prev => ({
        ...prev,
        scheduledShifts: schedData,
        lastUpdated: new Date()
      }));
    } catch (err) {
      console.error('Failed to load scheduled shifts', err);
      setTeamData(prev => ({ ...prev, scheduledShifts: [] }));
    }
  }, [canManageTeam, effectiveSectionId, dateRange]);

  // Load users with optimization
  const loadUsers = useCallback(async () => {
    if (!effectiveSectionId) return;
    
    try {
      const users = await userApi.listUsersBySection(effectiveSectionId);
      setTeamData(prev => ({
        ...prev,
        sectionUsers: users,
        lastUpdated: new Date()
      }));
    } catch (err) {
      setTeamData(prev => ({ ...prev, sectionUsers: [] }));
    }
  }, [effectiveSectionId]);

  // Refresh all data
  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadTeamData(true),
        loadScheduledShifts(),
        loadUsers()
      ]);
      addNotification({
        type: 'success',
        message: 'Data refreshed successfully',
        priority: 'low'
      });
    } finally {
      setRefreshing(false);
    }
  }, [loadTeamData, loadScheduledShifts, loadUsers, addNotification]);

  // Optimized effects with proper dependencies
  useEffect(() => {
    loadTeamData();
  }, [loadTeamData]);

  useEffect(() => {
    loadScheduledShifts();
  }, [loadScheduledShifts]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Event handlers
  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.pattern_id || assignForm.users.length === 0 || !assignForm.start_date) return;
    
    setAssignSubmitting(true);
    try {
      const result = await shiftSchedulingApi.bulkAssignShifts({
        users: assignForm.users,
        pattern_id: assignForm.pattern_id,
        start_date: assignForm.start_date,
        end_date: assignForm.end_date || undefined,
        section_id: effectiveSectionId,
      });

      if (!result.success) {
        throw new Error(result.errors?.[0] || 'Assignment failed');
      }

      await loadScheduledShifts();
      setShowAssignmentModal(false);
      setAssignForm({
        mode: 'single',
        shift_id: 0,
        user_id: '',
        date: '',
        pattern_id: '',
        users: [],
        start_date: '',
        end_date: '',
      });

      addNotification({
        type: 'success',
        message: result.message,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.message || 'Failed to bulk assign shifts',
        priority: 'high',
      });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await teamApi.deleteScheduledShift(id);
      setTeamData(prev => ({
        ...prev,
        scheduledShifts: prev.scheduledShifts.filter((s) => s.id !== id)
      }));
      addNotification({ type: 'success', message: 'Shift removed', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to remove assignment',
        priority: 'high',
      });
    }
  };

  const handleRegisterDaysOff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!daysOffForm.user_id || !daysOffForm.start_date || !daysOffForm.end_date) return;
    
    setLoading(true);
    try {
      const result = await shiftSchedulingApi.registerDaysOff({
        user_id: daysOffForm.user_id,
        start_date: daysOffForm.start_date,
        end_date: daysOffForm.end_date,
        reason: daysOffForm.reason,
        approved: canApproveDaysOff,
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      setShowDaysOffModal(false);
      setDaysOffForm({
        user_id: '',
        start_date: '',
        end_date: '',
        reason: 'Vacation',
      });

      addNotification({
        type: 'success',
        message: result.message,
        priority: 'medium',
      });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to register days off',
        priority: 'high',
      });
    } finally {
      setLoading(false);
    }
  };

  // Memoized view components
  const currentView = useMemo(() => {
    switch (viewMode) {
      case 'calendar':
        return (
          <CalendarGridView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            scheduledShifts={teamData.scheduledShifts}
            shifts={teamData.shifts}
            users={teamData.sectionUsers}
            loading={loading}
          />
        );
      case 'timeline':
        return (
          <TeamTimelineView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            scheduledShifts={teamData.scheduledShifts}
            shifts={teamData.shifts}
            users={teamData.sectionUsers}
            loading={loading}
          />
        );
      case 'analytics':
        return (
          <ShiftAnalyticsView
            currentDate={currentDate}
            scheduledShifts={teamData.scheduledShifts}
            shifts={teamData.shifts}
            users={teamData.sectionUsers}
            loading={loading}
          />
        );
      default:
        return null;
    }
  }, [viewMode, currentDate, teamData, loading]);

  if (!canManageTeam) {
    return (
      <div className="revamped-team-mgmt-page">
        <div className="access-guard">
          <FaUsers size={48} />
          <h2>Team & Shift Management</h2>
          <p>You need manager or admin rights to manage shift schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="revamped-team-mgmt-page">
      {/* Header */}
      <header className="team-mgmt-header">
        <div className="header-content">
          <div>
            <h1>🚀 Advanced Team Management</h1>
            <p>Intelligent shift scheduling with real-time analytics and insights</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-icon refresh-btn"
              onClick={refreshData}
              disabled={refreshing}
              title="Refresh data"
            >
              <FaSync className={refreshing ? 'spinning' : ''} />
            </button>
            <button
              className="btn-primary-glow"
              onClick={() => {
                setAssignForm(prev => ({
                  ...prev,
                  mode: 'bulk',
                  start_date: format(new Date(), 'yyyy-MM-dd'),
                  users: [],
                  pattern_id: '',
                }));
                setShowAssignmentModal(true);
              }}
              disabled={loading || !effectiveSectionId}
            >
              <FaWrench /> Smart Assign
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowDaysOffModal(true)}
              disabled={loading || !effectiveSectionId}
            >
              <FaCalendarAlt /> Time Off
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setAssignForm(prev => ({
                  ...prev,
                  mode: 'single',
                  date: format(new Date(), 'yyyy-MM-dd')
                }));
                setShowAssignmentModal(true);
              }}
              disabled={loading || teamData.shifts.length === 0 || !effectiveSectionId}
            >
              <FaPlus /> Single Shift
            </button>
          </div>
        </div>
      </header>

      {/* View Controls */}
      <div className="view-controls">
        <div className="view-modes">
          <button
            className={`view-mode-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode('calendar')}
            title="Calendar Grid View"
          >
            <FaTh /> Calendar
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
            title="Team Timeline View"
          >
            <FaStream /> Timeline
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'analytics' ? 'active' : ''}`}
            onClick={() => setViewMode('analytics')}
            title="Analytics View"
          >
            <FaChartBar /> Analytics
          </button>
        </div>

        <div className="view-filters">
          {viewMode !== 'analytics' && (
            <div className="view-presets">
              {(['tomorrow', 'weekend', 'this_month', 'next_month'] as ViewPreset[]).map((preset) => (
                <button
                  key={preset}
                  className={`preset-btn ${viewPreset === preset ? 'active' : ''}`}
                  onClick={() => setViewPreset(preset)}
                >
                  {preset === 'tomorrow' && '📅 Tomorrow'}
                  {preset === 'weekend' && '🏖️ Weekend'}
                  {preset === 'this_month' && '📆 This Month'}
                  {preset === 'next_month' && '📆 Next Month'}
                </button>
              ))}
            </div>
          )}

          {isAdmin && (
            <div className="section-filter">
              <label>Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="section-select"
              >
                <option value="">— All —</option>
                {teamData.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="team-mgmt-content">
        {loading && !teamData.scheduledShifts.length ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Loading team management data...</p>
          </div>
        ) : (
          currentView
        )}
      </div>

      {/* Modals (simplified for brevity - would include full modal components) */}
      {showAssignmentModal && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>🚀 Smart Assignment</h2>
              <button className="btn-close" onClick={() => setShowAssignmentModal(false)}>
                <FaTimes />
              </button>
            </div>
            {/* Assignment form content */}
          </div>
        </div>
      )}

      {showDaysOffModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🏖️ Register Time Off</h2>
              <button className="btn-close" onClick={() => setShowDaysOffModal(false)}>
                <FaTimes />
              </button>
            </div>
            {/* Days off form content */}
          </div>
        </div>
      )}
      <PageGuide guide={pageGuides.revampedTeamManagement} />
    </div>
  );
};

export default RevampedTeamManagementPage;
