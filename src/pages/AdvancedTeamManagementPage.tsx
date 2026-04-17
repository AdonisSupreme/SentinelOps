import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaChartLine,
  FaClock,
  FaEdit,
  FaLayerGroup,
  FaPlus,
  FaRobot,
  FaTimes,
  FaTrash,
  FaUserClock,
  FaUsers,
  FaWrench,
} from 'react-icons/fa';
import { addDays, addMonths, endOfMonth, format, isWeekend, parseISO, startOfMonth } from 'date-fns';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import { useNotifications } from '../contexts/NotificationContext';
import { orgApi, Section } from '../services/orgApi';
import { shiftSchedulingApi, PatternDayConfig, PatternSchedule, ShiftPattern } from '../services/shiftSchedulingApi';
import { teamApi, ScheduledShift, Shift } from '../services/teamApi';
import { userApi, UserListItem } from '../services/userApi';
import './AdvancedTeamManagementPage.css';

type ViewPreset = 'tomorrow' | 'weekend' | 'this_month' | 'next_month';

const PRESET_LABELS: Record<ViewPreset, string> = {
  tomorrow: 'Tomorrow',
  weekend: 'Weekend',
  this_month: 'This Month',
  next_month: 'Next Month',
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultScheduleDays = (): PatternDayConfig[] =>
  DAY_LABELS.map((_, day_of_week) => ({
    day_of_week,
    shift_id: null,
    is_off_day: true,
  }));

const AdvancedTeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [sectionUsers, setSectionUsers] = useState<UserListItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<PatternSchedule | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [sectionId, setSectionId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(18);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'bulk'>('bulk');
  const [assignForm, setAssignForm] = useState({
    shift_id: 0,
    user_id: '',
    date: '',
    pattern_id: '',
    users: [] as string[],
    start_date: '',
    end_date: '',
  });
  const [showDaysOffModal, setShowDaysOffModal] = useState(false);
  const [daysOffSubmitting, setDaysOffSubmitting] = useState(false);
  const [daysOffForm, setDaysOffForm] = useState({
    user_id: '',
    start_date: '',
    end_date: '',
    reason: 'Vacation',
  });
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [patternSubmitting, setPatternSubmitting] = useState(false);
  const [patternForm, setPatternForm] = useState({
    id: '',
    name: '',
    description: '',
    pattern_type: 'CUSTOM' as 'FIXED' | 'ROTATING' | 'CUSTOM',
    schedule_days: defaultScheduleDays(),
  });

  const role = (currentUser?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const canApproveDaysOff = role === 'admin' || role === 'manager' || role === 'supervisor';
  const canManageTeam = role === 'admin' || role === 'supervisor' || role === 'manager';
  const userSectionId = (currentUser as any)?.section_id || '';

  const effectiveSectionId = useMemo(() => (isAdmin && sectionId ? sectionId : userSectionId), [isAdmin, sectionId, userSectionId]);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (viewPreset === 'tomorrow') return { start: addDays(today, 1), end: addDays(today, 1) };
    if (viewPreset === 'weekend') {
      const saturday = addDays(today, (6 - today.getDay() + 7) % 7);
      return { start: saturday, end: addDays(saturday, 1) };
    }
    if (viewPreset === 'next_month') {
      const nextMonth = addMonths(today, 1);
      return { start: startOfMonth(nextMonth), end: endOfMonth(nextMonth) };
    }
    return { start: startOfMonth(today), end: endOfMonth(today) };
  }, [viewPreset]);

  const loadScheduledShifts = async (mode: 'skeleton' | 'refresh' = 'refresh') => {
    if (!canManageTeam || !effectiveSectionId) return;
    if (mode === 'skeleton') setScheduleLoading(true);
    else setScheduleRefreshing(true);
    try {
      const data = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId,
      });
      setScheduledShifts(data);
    } finally {
      setScheduleLoading(false);
      setScheduleRefreshing(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!canManageTeam) return;
      try {
        const [shiftData, sectionData] = await Promise.all([teamApi.listShifts(), orgApi.listSections()]);
        setShifts(shiftData);
        setSections(sectionData);
        const nextSection = isAdmin ? sectionData[0]?.id || '' : userSectionId;
        if (nextSection) {
          setSectionId((previous) => previous || nextSection);
        }
      } catch (err) {
        console.error('Failed to load team data', err);
        addNotification({ type: 'error', message: 'Failed to load scheduling intelligence.', priority: 'high' });
      } finally {
        setBootstrapping(false);
      }
    };
    void load();
  }, [addNotification, canManageTeam, isAdmin, userSectionId]);

  useEffect(() => {
    const loadUsers = async () => {
      if (!effectiveSectionId) return setSectionUsers([]);
      try {
        setSectionUsers(await userApi.listUsersBySection(effectiveSectionId));
      } catch {
        setSectionUsers([]);
      }
    };
    void loadUsers();
  }, [effectiveSectionId]);

  const loadPatterns = async (targetSectionId: string) => {
    if (!targetSectionId) {
      setPatterns([]);
      return;
    }
    try {
      setPatterns(await shiftSchedulingApi.listShiftPatterns(targetSectionId));
    } catch (err) {
      console.error('Failed to load patterns', err);
      setPatterns([]);
    }
  };

  useEffect(() => {
    void loadPatterns(effectiveSectionId);
  }, [effectiveSectionId]);

  useEffect(() => {
    const loadSchedule = async () => {
      if (!canManageTeam || !effectiveSectionId) return setScheduledShifts([]);
      try {
        await loadScheduledShifts(scheduledShifts.length ? 'refresh' : 'skeleton');
      } catch {
        setScheduledShifts([]);
      }
    };
    void loadSchedule();
  }, [canManageTeam, effectiveSectionId, dateRange]);

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSectionId, viewPreset, pageSize]);

  useEffect(() => {
    const loadPatternDetails = async () => {
      if (!assignForm.pattern_id) return setSelectedPattern(null);
      try {
        setSelectedPattern(await shiftSchedulingApi.getPatternDetails(assignForm.pattern_id));
      } catch {
        setSelectedPattern(null);
      }
    };
    void loadPatternDetails();
  }, [assignForm.pattern_id]);

  const userMap = useMemo(() => new Map(sectionUsers.map((member) => [member.id, member])), [sectionUsers]);
  const shiftMap = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);
  const activeSection = useMemo(() => sections.find((section) => section.id === effectiveSectionId) || null, [effectiveSectionId, sections]);
  const shiftIds = useMemo(() => new Set(shifts.map((shift) => shift.id)), [shifts]);

  const sortedAssignments = useMemo(
    () =>
      scheduledShifts.slice().sort((left, right) => {
        const dateCompare = left.date.localeCompare(right.date);
        if (dateCompare !== 0) return dateCompare;
        const leftShift = shiftMap.get(left.shift_id)?.start_time || '';
        const rightShift = shiftMap.get(right.shift_id)?.start_time || '';
        return leftShift.localeCompare(rightShift);
      }),
    [scheduledShifts, shiftMap]
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedAssignments.length / pageSize)), [pageSize, sortedAssignments.length]);

  const pagedAssignments = useMemo(() => {
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    return sortedAssignments.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedAssignments, totalPages]);

  const scheduledByDate = useMemo(() => {
    const grouped = new Map<string, ScheduledShift[]>();
    pagedAssignments.forEach((item) => {
      grouped.set(item.date, [...(grouped.get(item.date) || []), item]);
    });
    return Array.from(grouped.entries()).map(([date, entries]) => ({ date, entries }));
  }, [pagedAssignments]);

  const assignedUserCount = useMemo(() => new Set(scheduledShifts.map((item) => item.user_id)).size, [scheduledShifts]);
  const coveragePercent = useMemo(() => (!sectionUsers.length ? 0 : Math.round((assignedUserCount / sectionUsers.length) * 100)), [assignedUserCount, sectionUsers.length]);
  const weekendAssignments = useMemo(() => scheduledShifts.filter((item) => isWeekend(parseISO(item.date))).length, [scheduledShifts]);
  const busiestDay = useMemo(() => (scheduledByDate.length ? scheduledByDate.reduce((best, current) => current.entries.length > best.entries.length ? current : best) : null), [scheduledByDate]);
  const shiftAnalytics = useMemo(() => {
    const counts = new Map<number, number>();
    scheduledShifts.forEach((item) => counts.set(item.shift_id, (counts.get(item.shift_id) || 0) + 1));
    return Array.from(counts.entries()).map(([id, total]) => ({ shift: shiftMap.get(id), total })).sort((a, b) => b.total - a.total);
  }, [scheduledShifts, shiftMap]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetAssignmentForm = () => {
    setAssignForm({ shift_id: 0, user_id: '', date: '', pattern_id: '', users: [], start_date: '', end_date: '' });
    setSelectedPattern(null);
  };

  const openBulkAssignment = () => {
    setAssignmentMode('bulk');
    resetAssignmentForm();
    setAssignForm((previous) => ({ ...previous, start_date: format(new Date(), 'yyyy-MM-dd') }));
    setShowAssignmentModal(true);
  };

  const openSingleAssignment = () => {
    setAssignmentMode('single');
    resetAssignmentForm();
    setAssignForm((previous) => ({ ...previous, date: format(new Date(), 'yyyy-MM-dd') }));
    setShowAssignmentModal(true);
  };

  const openCreatePattern = () => {
    setPatternForm({
      id: '',
      name: '',
      description: '',
      pattern_type: 'CUSTOM',
      schedule_days: defaultScheduleDays(),
    });
    setShowPatternModal(true);
  };

  const openEditPattern = async (pattern: ShiftPattern) => {
    try {
      const details = await shiftSchedulingApi.getPatternDetails(pattern.id);
      const scheduleDays = defaultScheduleDays();
      scheduleDays.forEach((day) => {
        const key = DAY_LABELS[day.day_of_week];
        const config = details.schedule?.[key];
        if (config?.off_day) {
          day.is_off_day = true;
          day.shift_id = null;
        } else if (config?.shift_id) {
          day.is_off_day = false;
          day.shift_id = config.shift_id;
        }
      });
      setPatternForm({
        id: pattern.id,
        name: pattern.name || '',
        description: pattern.description || '',
        pattern_type: (pattern.pattern_type || 'CUSTOM') as 'FIXED' | 'ROTATING' | 'CUSTOM',
        schedule_days: scheduleDays,
      });
      setShowPatternModal(true);
    } catch {
      addNotification({ type: 'error', message: 'Failed to load pattern details.', priority: 'high' });
    }
  };

  const updatePatternDay = (dayOfWeek: number, changes: Partial<PatternDayConfig>) => {
    setPatternForm((previous) => ({
      ...previous,
      schedule_days: previous.schedule_days.map((day) => {
        if (day.day_of_week !== dayOfWeek) return day;
        const merged = { ...day, ...changes };
        if (merged.is_off_day) merged.shift_id = null;
        return merged;
      }),
    }));
  };

  const handleSavePattern = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patternForm.name || !effectiveSectionId) return;
    setPatternSubmitting(true);
    try {
      const normalizedScheduleDays = patternForm.schedule_days.map((day) => ({
        day_of_week: day.day_of_week,
        is_off_day: Boolean(day.is_off_day),
        shift_id: day.is_off_day || day.shift_id == null ? null : Number(day.shift_id),
      }));

      const missingShiftDays = normalizedScheduleDays.filter((day) => !day.is_off_day && day.shift_id == null);
      if (missingShiftDays.length) {
        throw new Error(`Select a shift for: ${missingShiftDays.map((day) => DAY_LABELS[day.day_of_week]).join(', ')}`);
      }

      const invalidShiftDays = normalizedScheduleDays.filter((day) => day.shift_id != null && !shiftIds.has(day.shift_id));
      if (invalidShiftDays.length) {
        throw new Error(`One or more selected shifts are no longer available: ${invalidShiftDays.map((day) => DAY_LABELS[day.day_of_week]).join(', ')}`);
      }

      const payload = {
        name: patternForm.name.trim(),
        description: patternForm.description.trim(),
        pattern_type: patternForm.pattern_type,
        schedule_days: normalizedScheduleDays,
        section_id: effectiveSectionId,
      };

      if (patternForm.id) {
        await shiftSchedulingApi.updateShiftPattern(patternForm.id, payload);
        addNotification({ type: 'success', message: 'Shift pattern updated.', priority: 'medium' });
      } else {
        await shiftSchedulingApi.createShiftPattern(payload);
        addNotification({ type: 'success', message: 'Shift pattern created.', priority: 'medium' });
      }

      await loadPatterns(effectiveSectionId);
      setShowPatternModal(false);
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to save pattern',
        priority: 'high',
      });
    } finally {
      setPatternSubmitting(false);
    }
  };

  const handleDeletePattern = async (patternId: string) => {
    if (!window.confirm('Delete this shift pattern? Existing assignments will remain, but this pattern will no longer be reusable.')) {
      return;
    }
    try {
      await shiftSchedulingApi.deleteShiftPattern(patternId);
      await loadPatterns(effectiveSectionId);
      if (assignForm.pattern_id === patternId) {
        setAssignForm((previous) => ({ ...previous, pattern_id: '' }));
        setSelectedPattern(null);
      }
      addNotification({ type: 'success', message: 'Shift pattern deleted.', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to delete pattern',
        priority: 'high',
      });
    }
  };

  const handleBulkAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignForm.pattern_id || !assignForm.users.length || !assignForm.start_date || !effectiveSectionId) return;
    setAssignSubmitting(true);
    try {
      const result = await shiftSchedulingApi.bulkAssignShifts({
        users: assignForm.users,
        pattern_id: assignForm.pattern_id,
        start_date: assignForm.start_date,
        end_date: assignForm.end_date || undefined,
        section_id: effectiveSectionId,
      });
      if (!result.success) throw new Error(result.errors?.[0] || result.message || 'Bulk assignment failed');
      await loadScheduledShifts();
      setShowAssignmentModal(false);
      resetAssignmentForm();
      addNotification({ type: 'success', message: result.message, priority: 'medium' });
    } catch (err: any) {
      addNotification({ type: 'error', message: err.message || 'Failed to bulk assign shifts', priority: 'high' });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleSingleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!assignForm.shift_id || !assignForm.user_id || !assignForm.date) return;
    setAssignSubmitting(true);
    try {
      await teamApi.createScheduledShift({ shift_id: assignForm.shift_id, user_id: assignForm.user_id, date: assignForm.date, status: 'scheduled' });
      await loadScheduledShifts();
      setShowAssignmentModal(false);
      resetAssignmentForm();
      addNotification({ type: 'success', message: 'Single shift assignment created.', priority: 'medium' });
    } catch (err: any) {
      addNotification({ type: 'error', message: err.response?.data?.detail || err.message || 'Failed to assign shift', priority: 'high' });
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleRegisterDaysOff = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!daysOffForm.user_id || !daysOffForm.start_date || !daysOffForm.end_date) return;
    setDaysOffSubmitting(true);
    try {
      const result = await shiftSchedulingApi.registerDaysOff({
        user_id: daysOffForm.user_id,
        start_date: daysOffForm.start_date,
        end_date: daysOffForm.end_date,
        reason: daysOffForm.reason,
        approved: canApproveDaysOff,
      });
      if (!result.success) throw new Error(result.message);
      setShowDaysOffModal(false);
      setDaysOffForm({ user_id: '', start_date: '', end_date: '', reason: 'Vacation' });
      addNotification({ type: 'success', message: result.message, priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to register time off',
        priority: 'high',
      });
    } finally {
      setDaysOffSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await teamApi.deleteScheduledShift(id);
      setScheduledShifts((previous) => previous.filter((item) => item.id !== id));
      addNotification({ type: 'success', message: 'Shift assignment removed.', priority: 'medium' });
    } catch (err: any) {
      addNotification({ type: 'error', message: err.response?.data?.detail || 'Failed to remove assignment', priority: 'high' });
    }
  };

  if (!canManageTeam) {
    return (
      <div className="advanced-team-mgmt-page">
        <div className="team-page-ambient"><div className="team-ambient-orb orb-one" /><div className="team-ambient-orb orb-two" /></div>
        <div className="access-guard glass-panel">
          <FaUsers />
          <h2>Team Command Access Required</h2>
          <p>You need manager or admin rights to orchestrate schedules, patterns, and staffing exceptions.</p>
        </div>
      </div>
    );
  }

  if (bootstrapping) {
    return (
      <div className="advanced-team-mgmt-page">
        <div className="team-page-ambient">
          <div className="team-ambient-orb orb-one" />
          <div className="team-ambient-orb orb-two" />
          <div className="team-ambient-grid" />
        </div>
        <section className="team-skeleton-hero glass-panel">
          <div className="skeleton-bar skeleton-kicker" />
          <div className="skeleton-bar skeleton-title" />
          <div className="skeleton-bar skeleton-copy" />
          <div className="skeleton-bar skeleton-copy short" />
        </section>
        <section className="team-skeleton-metrics">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="team-skeleton-card glass-panel">
              <div className="skeleton-bar skeleton-label" />
              <div className="skeleton-bar skeleton-value" />
              <div className="skeleton-bar skeleton-footnote" />
            </div>
          ))}
        </section>
        <section className="team-skeleton-layout">
          <div className="team-skeleton-card glass-panel large">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton-assignment-row" />
            ))}
          </div>
          <div className="team-skeleton-stack">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="team-skeleton-card glass-panel" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="advanced-team-mgmt-page">
      <div className="team-page-ambient">
        <div className="team-ambient-orb orb-one" />
        <div className="team-ambient-orb orb-two" />
        <div className="team-ambient-grid" />
      </div>

      <section className="team-hero glass-panel">
        <div className="hero-copy">
          <div className="hero-kicker"><FaLayerGroup /> SentinelOps Workforce Command</div>
          <p>Move beyond static staffing tables with schedule intelligence, section-level focus, pattern automation, and fast exception handling for real-world operations.</p>
          <div className="hero-actions">
            <button className="btn-primary-glow" onClick={openBulkAssignment} disabled={!effectiveSectionId}><FaRobot /> Smart Assign</button>
            <button className="btn-secondary" onClick={() => setShowDaysOffModal(true)} disabled={!effectiveSectionId}><FaUserClock /> Time Off</button>
            <button className="btn-secondary" onClick={openSingleAssignment} disabled={!effectiveSectionId || !shifts.length}><FaPlus /> Single Shift</button>
          </div>
        </div>
        <div className="hero-pulse-panel">
          <div className="pulse-orb"><div className="pulse-core"><strong>{coveragePercent}%</strong><span>Coverage</span></div></div>
          <div className="pulse-meta">
            <div className="pulse-card"><span>Section Focus</span><strong>{activeSection?.section_name || 'Unassigned'}</strong><small>{PRESET_LABELS[viewPreset]} window</small></div>
            <div className="pulse-card"><span>Assignments</span><strong>{scheduledShifts.length}</strong><small>{assignedUserCount} people engaged</small></div>
          </div>
        </div>
      </section>

      <section className="team-metrics-grid">
        <article className="metric-card glass-panel"><span>Roster Strength</span><strong>{sectionUsers.length}</strong><small>Section team members available</small></article>
        <article className="metric-card glass-panel"><span>Pattern Library</span><strong>{patterns.length}</strong><small>Reusable schedule blueprints</small></article>
        <article className="metric-card glass-panel"><span>Weekend Load</span><strong>{weekendAssignments}</strong><small>Assignments on weekend coverage</small></article>
        <article className="metric-card glass-panel"><span>Busiest Day</span><strong>{busiestDay ? format(parseISO(busiestDay.date), 'MMM d') : '--'}</strong><small>{busiestDay ? `${busiestDay.entries.length} scheduled shifts` : 'No assignments yet'}</small></article>
      </section>

      <section className="team-toolbar glass-panel">
        <div className="toolbar-block">
          <span className="toolbar-label">View Window</span>
          <div className="view-presets">
            {(Object.keys(PRESET_LABELS) as ViewPreset[]).map((preset) => (
              <button key={preset} className={`preset-btn ${viewPreset === preset ? 'active' : ''}`} onClick={() => setViewPreset(preset)}>
                {PRESET_LABELS[preset]}
              </button>
            ))}
          </div>
        </div>
        <div className="toolbar-block compact"><span className="toolbar-label">Window Span</span><strong>{format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d')}</strong></div>
        {isAdmin ? (
          <div className="toolbar-block compact">
            <span className="toolbar-label">Section Scope</span>
            <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="section-select">
              <option value="">Select section</option>
              {sections.map((section) => <option key={section.id} value={section.id}>{section.section_name}</option>)}
            </select>
          </div>
        ) : null}
      </section>

      <section className="team-command-layout">
        <div className="schedule-command glass-panel">
          <div className="panel-head">
            <div><span className="panel-kicker"><FaCalendarAlt /> Schedule Stream</span><h2>Live assignment board</h2></div>
            <div className="panel-meta">
              <span>{scheduledShifts.length} assignments</span>
              <span>{shiftAnalytics.length} shift types active</span>
              <span>{scheduleRefreshing ? 'Refreshing...' : `Page ${Math.min(currentPage, totalPages)} of ${totalPages}`}</span>
            </div>
          </div>
          {scheduleLoading ? (
            <div className="schedule-skeleton-stack">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="schedule-skeleton-cluster">
                  <div className="skeleton-bar skeleton-day-head" />
                  <div className="schedule-skeleton-grid">
                    {Array.from({ length: 3 }).map((__, nestedIndex) => (
                      <div key={nestedIndex} className="schedule-skeleton-card" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !scheduledByDate.length ? (
            <div className="schedule-state empty"><FaCalendarAlt /><h3>No schedule published for this window</h3><p>Start with Smart Assign for pattern rollout or create a single shift assignment.</p></div>
          ) : (
            <>
            <div className={`schedule-day-stack ${scheduleRefreshing ? 'refreshing' : ''}`}>
              {scheduledByDate.map((group) => (
                <article key={group.date} className={`day-cluster ${isWeekend(parseISO(group.date)) ? 'weekend' : ''}`}>
                  <div className="day-cluster-head"><div><span className="day-label">{format(parseISO(group.date), 'EEEE')}</span><h3>{format(parseISO(group.date), 'MMM d, yyyy')}</h3></div><strong>{group.entries.length} assignments</strong></div>
                  <div className="assignment-grid">
                    {group.entries.map((scheduled) => {
                      const shift = shiftMap.get(scheduled.shift_id);
                      const member = userMap.get(scheduled.user_id);
                      return (
                        <div key={scheduled.id} className="assignment-card">
                          <div className="assignment-card-head">
                            <span className="shift-chip" style={shift?.color ? { borderColor: shift.color, color: shift.color } : undefined}>{shift?.name || `Shift #${scheduled.shift_id}`}</span>
                            <button className="btn-icon danger" onClick={() => handleDelete(scheduled.id)} title="Remove assignment"><FaTrash /></button>
                          </div>
                          <strong>{member ? `${member.first_name} ${member.last_name}` : scheduled.user_id}</strong>
                          <div className="assignment-meta"><span><FaClock /> {shift ? `${shift.start_time} - ${shift.end_time}` : 'Time not available'}</span><span>{scheduled.status || 'scheduled'}</span></div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
            <div className="schedule-pagination">
              <div className="pagination-summary">
                <strong>{sortedAssignments.length}</strong>
                <span>
                  Showing {(Math.min(currentPage, totalPages) - 1) * pageSize + 1}-{Math.min(Math.min(currentPage, totalPages) * pageSize, sortedAssignments.length)} of {sortedAssignments.length}
                </span>
              </div>
              <div className="pagination-controls">
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="pagination-select">
                  <option value={12}>12 / page</option>
                  <option value={18}>18 / page</option>
                  <option value={24}>24 / page</option>
                </select>
                <button className="btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                  Previous
                </button>
                <button className="btn-secondary" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>
                  Next
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        <aside className="team-insights">
          <div className="insight-panel glass-panel">
            <div className="panel-head compact"><div><span className="panel-kicker"><FaUsers /> Team Pulse</span><h3>Roster preview</h3></div></div>
            <div className="roster-list">
              {sectionUsers.slice(0, 6).map((member) => (
                <div key={member.id} className="roster-item">
                  <div className="avatar-badge">{(member.first_name?.[0] || 'U') + (member.last_name?.[0] || '')}</div>
                  <div><strong>{member.first_name} {member.last_name}</strong><span>{member.role || 'team member'}</span></div>
                </div>
              ))}
              {!sectionUsers.length ? <p className="insight-empty">No team members loaded for this section.</p> : null}
            </div>
          </div>

          <div className="insight-panel glass-panel">
            <div className="panel-head compact"><div><span className="panel-kicker"><FaChartLine /> Shift Mix</span><h3>Distribution</h3></div></div>
            <div className="analytics-list">
              {shiftAnalytics.slice(0, 5).map(({ shift, total }) => (
                <div key={shift?.id || total} className="analytics-item"><div><strong>{shift?.name || 'Unknown shift'}</strong><span>{shift ? `${shift.start_time} - ${shift.end_time}` : 'Missing shift metadata'}</span></div><em>{total}</em></div>
              ))}
              {!shiftAnalytics.length ? <p className="insight-empty">Assignments will surface shift distribution here.</p> : null}
            </div>
          </div>

          <div className="insight-panel glass-panel">
            <div className="panel-head compact">
              <div><span className="panel-kicker"><FaWrench /> Pattern Deck</span><h3>Available smart patterns</h3></div>
              <button className="btn-secondary" type="button" onClick={openCreatePattern} disabled={!effectiveSectionId}>
                <FaPlus /> New Pattern
              </button>
            </div>
            <div className="pattern-list">
              {patterns.slice(0, 5).map((pattern) => (
                <div key={pattern.id} className={`pattern-list-item ${assignForm.pattern_id === pattern.id ? 'active' : ''}`}>
                  <button
                    type="button"
                    className="pattern-list-trigger"
                    onClick={() => {
                      setAssignmentMode('bulk');
                      setShowAssignmentModal(true);
                      setAssignForm((previous) => ({
                        ...previous,
                        pattern_id: pattern.id,
                        start_date: previous.start_date || format(new Date(), 'yyyy-MM-dd'),
                      }));
                    }}
                  >
                    <div><strong>{pattern.name}</strong><span>{pattern.pattern_type}</span></div>
                  </button>
                  <div className="pattern-actions">
                    <button type="button" className="btn-icon" onClick={() => openEditPattern(pattern)} title="Edit pattern">
                      <FaEdit />
                    </button>
                    <button type="button" className="btn-icon danger" onClick={() => handleDeletePattern(pattern.id)} title="Delete pattern">
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
              {!patterns.length ? <p className="insight-empty">No shift patterns configured for this section yet.</p> : null}
            </div>
          </div>
        </aside>
      </section>

      {showAssignmentModal ? (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <div><span className="panel-kicker">{assignmentMode === 'bulk' ? 'Smart Assignment' : 'Single Assignment'}</span><h2>{assignmentMode === 'bulk' ? 'Pattern-driven team rollout' : 'Precision single-shift placement'}</h2></div>
              <button className="btn-close" onClick={() => setShowAssignmentModal(false)}><FaTimes /></button>
            </div>
            <div className="modal-mode-switch">
              <button className={assignmentMode === 'bulk' ? 'active' : ''} onClick={openBulkAssignment} type="button">Bulk Pattern</button>
              <button className={assignmentMode === 'single' ? 'active' : ''} onClick={openSingleAssignment} type="button">Single Shift</button>
            </div>
            <form onSubmit={assignmentMode === 'bulk' ? handleBulkAssign : handleSingleAssign} className="assignment-form">
              {assignmentMode === 'bulk' ? (
                <>
                  <div className="form-group">
                    <label>Pattern</label>
                    <select value={assignForm.pattern_id} onChange={(event) => setAssignForm((previous) => ({ ...previous, pattern_id: event.target.value }))} className="form-select" required>
                      <option value="">Select a shift pattern</option>
                      {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} ({pattern.pattern_type})</option>)}
                    </select>
                  </div>
                  {selectedPattern ? (
                    <div className="pattern-preview">
                      <h4>Pattern Schedule Preview</h4>
                      <div className="pattern-days">
                        {Object.entries(selectedPattern.schedule || {}).map(([day, config]) => (
                          <div key={day} className="pattern-day">
                            <strong>{day}</strong>
                            {config.off_day ? <span className="off-day-badge">Off Day</span> : <span className="shift-badge" style={config.color ? { borderColor: config.color, color: config.color } : undefined}>{config.shift_name || 'Shift'}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="form-row">
                    <div className="form-group"><label>Start Date</label><input type="date" value={assignForm.start_date} onChange={(event) => setAssignForm((previous) => ({ ...previous, start_date: event.target.value }))} className="form-input" required /></div>
                    <div className="form-group"><label>End Date</label><input type="date" value={assignForm.end_date} onChange={(event) => setAssignForm((previous) => ({ ...previous, end_date: event.target.value }))} className="form-input" /></div>
                  </div>
                  <div className="form-group">
                    <label>Assign team members</label>
                    <div className="user-selector">
                      {sectionUsers.map((member) => (
                        <label key={member.id} className="user-checkbox">
                          <input type="checkbox" checked={assignForm.users.includes(member.id)} onChange={(event) => setAssignForm((previous) => ({ ...previous, users: event.target.checked ? [...previous.users, member.id] : previous.users.filter((id) => id !== member.id) }))} />
                          <span>{member.first_name} {member.last_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group"><label>Date</label><input type="date" value={assignForm.date} onChange={(event) => setAssignForm((previous) => ({ ...previous, date: event.target.value }))} className="form-input" required /></div>
                    <div className="form-group">
                      <label>Shift</label>
                      <select value={assignForm.shift_id || ''} onChange={(event) => setAssignForm((previous) => ({ ...previous, shift_id: Number(event.target.value) }))} className="form-select" required>
                        <option value="">Select shift</option>
                        {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.start_time} - {shift.end_time})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Team member</label>
                    <select value={assignForm.user_id} onChange={(event) => setAssignForm((previous) => ({ ...previous, user_id: event.target.value }))} className="form-select" required>
                      <option value="">Select team member</option>
                      {sectionUsers.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAssignmentModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-glow" disabled={assignSubmitting}>{assignSubmitting ? 'Applying...' : assignmentMode === 'bulk' ? `Assign ${assignForm.users.length || 0} Members` : 'Create Assignment'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPatternModal ? (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <div>
                <span className="panel-kicker">Pattern Management</span>
                <h2>{patternForm.id ? 'Edit shift pattern' : 'Create shift pattern'}</h2>
              </div>
              <button className="btn-close" onClick={() => setShowPatternModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleSavePattern} className="assignment-form">
              <div className="form-row">
                <div className="form-group">
                  <label>Pattern name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={patternForm.name}
                    onChange={(event) => setPatternForm((previous) => ({ ...previous, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Pattern type</label>
                  <select
                    className="form-select"
                    value={patternForm.pattern_type}
                    onChange={(event) => setPatternForm((previous) => ({ ...previous, pattern_type: event.target.value as 'FIXED' | 'ROTATING' | 'CUSTOM' }))}
                  >
                    <option value="FIXED">FIXED</option>
                    <option value="ROTATING">ROTATING</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <input
                  type="text"
                  className="form-input"
                  value={patternForm.description}
                  onChange={(event) => setPatternForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Optional details for planners"
                />
              </div>
              <div className="pattern-editor-grid">
                {patternForm.schedule_days.map((day) => (
                  <div key={day.day_of_week} className="pattern-editor-day">
                    <strong>{DAY_LABELS[day.day_of_week]}</strong>
                    <label className="user-checkbox">
                      <input
                        type="checkbox"
                        checked={day.is_off_day}
                        onChange={(event) => updatePatternDay(day.day_of_week, { is_off_day: event.target.checked })}
                      />
                      <span>Off day</span>
                    </label>
                    <select
                      className="form-select"
                      value={day.shift_id || ''}
                      disabled={day.is_off_day}
                      onChange={(event) => updatePatternDay(day.day_of_week, { shift_id: event.target.value ? Number(event.target.value) : null })}
                    >
                      <option value="">Select shift</option>
                      {shifts.map((shift) => (
                        <option key={shift.id} value={shift.id}>
                          {shift.name} ({shift.start_time} - {shift.end_time})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowPatternModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-glow" disabled={patternSubmitting}>
                  {patternSubmitting ? 'Saving...' : patternForm.id ? 'Update Pattern' : 'Create Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showDaysOffModal ? (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <div><span className="panel-kicker">Time Off Control</span><h2>Register staffing exceptions</h2></div>
              <button className="btn-close" onClick={() => setShowDaysOffModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleRegisterDaysOff} className="simple-form">
              <div className="form-group">
                <label>Team member</label>
                <select value={daysOffForm.user_id} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, user_id: event.target.value }))} className="form-select" required>
                  <option value="">Select team member</option>
                  {sectionUsers.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Start Date</label><input type="date" value={daysOffForm.start_date} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, start_date: event.target.value }))} className="form-input" required /></div>
                <div className="form-group"><label>End Date</label><input type="date" value={daysOffForm.end_date} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, end_date: event.target.value }))} className="form-input" required /></div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select value={daysOffForm.reason} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, reason: event.target.value }))} className="form-select">
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDaysOffModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary-glow" disabled={daysOffSubmitting}>{daysOffSubmitting ? 'Registering...' : 'Register Time Off'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      <PageGuide guide={pageGuides.advancedTeamManagement} />
    </div>
  );
};

export default AdvancedTeamManagementPage;
