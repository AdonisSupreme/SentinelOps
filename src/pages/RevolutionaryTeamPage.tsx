import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  FaUsers,
  FaPlus,
  FaTrash,
  FaCalendarAlt,
  FaWrench,
  FaSync,
  FaChartBar,
  FaThLarge,
  FaList,
  FaCog,
  FaBell,
  FaSearch,
  FaFilter
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { shiftSchedulingApi, ShiftPattern } from '../services/shiftSchedulingApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, addMonths, startOfMonth, endOfMonth } from 'date-fns';

// Import the new grouped view
import ShiftGroupView from '../components/team/ShiftGroupView';
import './components/team/ShiftGroupView.css';

type ViewMode = 'grouped' | 'list' | 'analytics';

interface TeamData {
  shifts: Shift[];
  scheduledShifts: ScheduledShift[];
  sectionUsers: UserListItem[];
  sections: Section[];
  patterns: ShiftPattern[];
  lastUpdated: Date;
}

const RevolutionaryTeamPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  // Core state with aggressive caching
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
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [sectionId, setSectionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Memoized permissions
  const isAdmin = useMemo(() => (currentUser?.role || '').toLowerCase() === 'admin', [currentUser]);
  const userSectionId = useMemo(() => (currentUser as any)?.section_id || '', [currentUser]);
  const canManageTeam = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    return r === 'admin' || r === 'supervisor' || r === 'manager';
  }, [currentUser]);

  const effectiveSectionId = useMemo(() => {
    if (isAdmin && sectionId) return sectionId;
    return userSectionId;
  }, [isAdmin, sectionId, userSectionId]);

  // Aggressive caching with longer duration
  const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
  const isDataFresh = useMemo(() => {
    const now = new Date();
    return (now.getTime() - teamData.lastUpdated.getTime()) < CACHE_DURATION;
  }, [teamData.lastUpdated]);

  // Optimized data loading with minimal re-renders
  const loadTeamData = useCallback(async (forceRefresh = false) => {
    if (!canManageTeam) return;
    
    // Use cached data if fresh and not forcing refresh
    if (!forceRefresh && isDataFresh && teamData.shifts.length > 0) {
      return;
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
        lastUpdated: new Date()
      }));

      // Auto-set section for non-admins
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
  }, [canManageTeam, effectiveSectionId, isDataFresh, teamData.shifts.length, sectionId, isAdmin, userSectionId, addNotification]);

  // Load scheduled shifts only when needed
  const loadScheduledShifts = useCallback(async () => {
    if (!canManageTeam || !effectiveSectionId) return;
    
    try {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      
      const schedData = await teamApi.listScheduledShifts({
        start_date: format(monthStart, 'yyyy-MM-dd'),
        end_date: format(monthEnd, 'yyyy-MM-dd'),
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
  }, [canManageTeam, effectiveSectionId, currentDate]);

  // Load users only when needed
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

  // Smart refresh with debouncing
  const refreshData = useCallback(async () => {
    if (refreshing) return;
    
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
  }, [refreshing, loadTeamData, loadScheduledShifts, loadUsers, addNotification]);

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

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!searchQuery) return teamData;
    
    const query = searchQuery.toLowerCase();
    return {
      ...teamData,
      scheduledShifts: teamData.scheduledShifts.filter(shift => 
        shift.user_id.toLowerCase().includes(query) ||
        shift.status.toLowerCase().includes(query)
      ),
      sectionUsers: teamData.sectionUsers.filter(user =>
        user.first_name.toLowerCase().includes(query) ||
        user.last_name.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query)
      )
    };
  }, [teamData, searchQuery]);

  // Render current view
  const renderCurrentView = useMemo(() => {
    switch (viewMode) {
      case 'grouped':
        return (
          <ShiftGroupView
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            scheduledShifts={filteredData.scheduledShifts}
            shifts={filteredData.shifts}
            users={filteredData.sectionUsers}
            loading={loading}
          />
        );
      case 'list':
        // TODO: Implement list view
        return (
          <div className="list-view-placeholder">
            <h3>List View Coming Soon</h3>
            <p>Detailed list view of all shifts and assignments</p>
          </div>
        );
      case 'analytics':
        // TODO: Implement analytics view
        return (
          <div className="analytics-view-placeholder">
            <h3>Analytics View Coming Soon</h3>
            <p>Comprehensive analytics and insights</p>
          </div>
        );
      default:
        return null;
    }
  }, [viewMode, currentDate, filteredData, loading]);

  if (!canManageTeam) {
    return (
      <div className="revolutionary-team-page">
        <div className="access-guard">
          <FaUsers size={48} />
          <h2>Team Management</h2>
          <p>You need manager or admin rights to access team management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="revolutionary-team-page">
      {/* Modern Header */}
      <header className="team-header">
        <div className="header-left">
          <div className="title-section">
            <h1>🚀 Team Management</h1>
            <p>Intelligent shift scheduling and team coordination</p>
          </div>
          
          {/* Search Bar */}
          <div className="search-container">
            <FaSearch className="search-icon" />
            <input
              type="text"
              placeholder="Search users, shifts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>

        <div className="header-right">
          {/* View Mode Selector */}
          <div className="view-selector">
            <button
              className={`view-btn ${viewMode === 'grouped' ? 'active' : ''}`}
              onClick={() => setViewMode('grouped')}
              title="Grouped Calendar View"
            >
              <FaThLarge />
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <FaList />
            </button>
            <button
              className={`view-btn ${viewMode === 'analytics' ? 'active' : ''}`}
              onClick={() => setViewMode('analytics')}
              title="Analytics View"
            >
              <FaChartBar />
            </button>
          </div>

          {/* Action Buttons */}
          <div className="action-buttons">
            <button
              className="btn-icon"
              onClick={refreshData}
              disabled={refreshing}
              title="Refresh data"
            >
              <FaSync className={refreshing ? 'spinning' : ''} />
            </button>
            
            {isAdmin && (
              <div className="section-selector">
                <FaFilter className="filter-icon" />
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  className="section-select"
                >
                  <option value="">All Sections</option>
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
      </header>

      {/* Main Content */}
      <main className="team-content">
        {renderCurrentView}
      </main>

      {/* Floating Action Button */}
      <div className="fab-container">
        <button className="fab" title="Quick Actions">
          <FaPlus />
        </button>
      </div>
    </div>
  );
};

export default RevolutionaryTeamPage;
