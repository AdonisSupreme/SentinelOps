import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

type ViewPreset = 'today' | 'tomorrow' | 'weekend' | 'this_month' | 'next_month' | 'custom';

const PRESET_LABELS: Record<ViewPreset, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  weekend: 'Weekend',
  this_month: 'This Month',
  next_month: 'Next Month',
  custom: 'Custom dates',
};

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultScheduleDays = (): PatternDayConfig[] =>
  DAY_LABELS.map((_, day_of_week) => ({
    day_of_week,
    shift_id: null,
    is_off_day: true,
  }));

const TeamManagementPreview: React.FC = () => (
  <div className="advanced-team-mgmt-page team-preview-page">
    <section className="team-command-strip team-skel-panel">
      <div className="team-skel-command-copy">
        <div className="team-skel-line team-skel-kicker" />
        <div className="team-skel-line team-skel-title" />
        <div className="team-skel-line team-skel-meta" />
      </div>
      <div className="team-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="team-skel-signal-card">
            <div className="team-skel-block team-skel-icon" />
            <div className="team-skel-signal-copy">
              <div className="team-skel-line team-skel-label" />
              <div className="team-skel-line team-skel-value" />
              <div className="team-skel-line team-skel-meta" />
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="team-command-layout">
      <div className="team-board-panel team-skel-panel">
        <div className="team-skel-board-head">
          <div>
            <div className="team-skel-line team-skel-kicker" />
            <div className="team-skel-line team-skel-panel-title" />
          </div>
          <div className="team-skel-action-row">
            <div className="team-skel-block team-skel-action" />
            <div className="team-skel-block team-skel-action" />
          </div>
        </div>
        <div className="team-skel-control-grid">
          <div className="team-skel-control" />
          <div className="team-skel-control" />
          <div className="team-skel-control" />
        </div>
        <div className="schedule-skeleton-stack">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="schedule-skeleton-cluster">
              <div className="team-skel-line skeleton-day-head" />
              <div className="schedule-skeleton-grid">
                {Array.from({ length: 3 }).map((__, nestedIndex) => (
                  <div key={nestedIndex} className="schedule-skeleton-card" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="team-insights">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="insight-panel team-skel-panel">
            <div className="team-skel-line team-skel-kicker" />
            <div className="team-skel-line team-skel-panel-title" />
            <div className="team-skel-list">
              <div className="team-skel-row" />
              <div className="team-skel-row" />
              <div className="team-skel-row" />
            </div>
          </article>
        ))}
      </aside>
    </section>
  </div>
);

const AdvancedTeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [sectionUsers, setSectionUsers] = useState<UserListItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsError, setPatternsError] = useState('');
  const patternRequest = useRef(0);
  const scheduleRequest = useRef(0);
  const [scheduleError, setScheduleError] = useState('');
  const [memberFilter, setMemberFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');
  const [customDates, setCustomDates] = useState({ start: format(new Date(), 'yyyy-MM-dd'), end: format(new Date(), 'yyyy-MM-dd') });
  const [appliedDates, setAppliedDates] = useState(customDates);
  const [selectedPattern, setSelectedPattern] = useState<PatternSchedule | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState('');
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleRefreshing, setScheduleRefreshing] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [sectionId, setSectionId] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(18);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const assignmentDialog = useRef<HTMLDivElement>(null);
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
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftSubmitting, setShiftSubmitting] = useState(false);
  const [resumePatternAfterShift, setResumePatternAfterShift] = useState(false);
  const [shiftForm, setShiftForm] = useState({
    id: null as number | null,
    name: '',
    start_time: '07:00',
    end_time: '15:00',
    timezone: 'Africa/Johannesburg',
    color: '#2563eb',
  });
  const [patternForm, setPatternForm] = useState({
    id: '',
    name: '',
    description: '',
    pattern_type: 'CUSTOM' as 'FIXED' | 'ROTATING' | 'CUSTOM',
    schedule_days: defaultScheduleDays(),
  });

  useEffect(() => {
    if (!showAssignmentModal) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = assignmentDialog.current;
    const controls = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || []);
    controls()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !assignSubmitting) setShowAssignmentModal(false);
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    dialog?.addEventListener('keydown', handleKey);
    return () => { dialog?.removeEventListener('keydown', handleKey); previousFocus?.focus(); };
  }, [showAssignmentModal, assignSubmitting]);

  const role = (currentUser?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const canManageShifts = isAdmin;
  const canApproveDaysOff = role === 'admin' || role === 'manager' || role === 'supervisor';
  const canManageTeam = role === 'admin' || role === 'supervisor' || role === 'manager';
  const userSectionId = (currentUser as any)?.section_id || '';

  const effectiveSectionId = useMemo(() => (isAdmin && sectionId ? sectionId : userSectionId), [isAdmin, sectionId, userSectionId]);

  const dateRange = useMemo(() => {
    const today = new Date();
    if (viewPreset === 'custom') return { start: parseISO(appliedDates.start), end: parseISO(appliedDates.end) };
    if (viewPreset === 'today') return { start: today, end: today };
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
  }, [viewPreset, appliedDates]);

  const loadShifts = async () => {
    const shiftData = await teamApi.listShifts();
    setShifts(shiftData);
    return shiftData;
  };

  const loadScheduledShifts = useCallback(async (mode: 'skeleton' | 'refresh' = 'refresh') => {
    if (!canManageTeam || !effectiveSectionId) return;
    const request = ++scheduleRequest.current;
    setScheduleError('');
    if (mode === 'skeleton') setScheduleLoading(true);
    else setScheduleRefreshing(true);
    try {
      const data = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId,
      });
      if (request === scheduleRequest.current) setScheduledShifts(data);
    } catch {
      if (request === scheduleRequest.current) {
        setScheduleError('The schedule could not be loaded. Retry to reconnect.');
        setScheduledShifts([]);
      }
    } finally {
      if (request === scheduleRequest.current) {
        setScheduleLoading(false);
        setScheduleRefreshing(false);
      }
    }
  }, [canManageTeam, dateRange.end, dateRange.start, effectiveSectionId]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!canManageTeam) return;
      setBootstrapError('');
      try {
        const [shiftResult, sectionResult] = await Promise.allSettled([teamApi.listShifts(), orgApi.listSections()]);
        if (!active) return;
        if (shiftResult.status === 'fulfilled') setShifts(shiftResult.value);
        const sectionData = sectionResult.status === 'fulfilled' ? sectionResult.value : [];
        if (sectionResult.status === 'fulfilled') setSections(sectionData);
        if (shiftResult.status === 'rejected' || sectionResult.status === 'rejected') setBootstrapError('Some scheduling data is unavailable. Retry to load shifts and sections.');
        const nextSection = userSectionId || (isAdmin ? sectionData[0]?.id || '' : '');
        if (nextSection) {
          setSectionId((previous) => previous || nextSection);
        }
      } catch (err) {
        console.error('Failed to load team data', err);
        addNotification({ type: 'error', message: 'Failed to load scheduling intelligence.', priority: 'high' });
      } finally {
        if (active) setBootstrapping(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [addNotification, canManageTeam, isAdmin, userSectionId, bootstrapAttempt]);

  useEffect(() => {
    let active = true;
    setSectionUsers([]);
    const loadUsers = async () => {
      if (!effectiveSectionId) return setSectionUsers([]);
      try {
        const members = await userApi.listUsersBySection(effectiveSectionId);
        if (active) setSectionUsers(members);
      } catch {
        if (active) setSectionUsers([]);
      }
    };
    void loadUsers();
    return () => { active = false; };
  }, [effectiveSectionId]);

  const loadPatterns = async (targetSectionId: string) => {
    const request = ++patternRequest.current;
    setPatternsError('');
    setPatternsLoading(Boolean(targetSectionId));
    setPatterns([]);
    if (!targetSectionId) {
      setPatterns([]);
      return;
    }
    try {
      const data = await shiftSchedulingApi.listShiftPatterns(targetSectionId);
      if (request === patternRequest.current) setPatterns(data);
    } catch (err) {
      console.error('Failed to load patterns', err);
      if (request === patternRequest.current) setPatternsError('Shift patterns could not be loaded. Please retry.');
    } finally {
      if (request === patternRequest.current) setPatternsLoading(false);
    }
  };

  useEffect(() => {
    setMemberFilter('');
    setAssignForm((previous) => ({ ...previous, pattern_id: '', users: [], user_id: '' }));
    setSelectedPattern(null);
    void loadPatterns(effectiveSectionId);
  }, [effectiveSectionId]);

  useEffect(() => {
    const loadSchedule = async () => {
      if (!canManageTeam || !effectiveSectionId) {
        ++scheduleRequest.current;
        setScheduledShifts([]);
        setScheduleLoading(false);
        return;
      }
      try {
        await loadScheduledShifts('skeleton');
      } catch {
        setScheduledShifts([]);
      }
    };
    void loadSchedule();
    const requestCounter = scheduleRequest;
    return () => { ++requestCounter.current; };
  }, [canManageTeam, effectiveSectionId, loadScheduledShifts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [effectiveSectionId, viewPreset, appliedDates, memberFilter, shiftFilter, pageSize]);

  useEffect(() => {
    let active = true;
    setSelectedPattern(null);
    const loadPatternDetails = async () => {
      if (!assignForm.pattern_id) return setSelectedPattern(null);
      try {
        const details = await shiftSchedulingApi.getPatternDetails(assignForm.pattern_id);
        if (active) setSelectedPattern(details);
      } catch {
        if (active) setSelectedPattern(null);
      }
    };
    void loadPatternDetails();
    return () => { active = false; };
  }, [assignForm.pattern_id]);

  const userMap = useMemo(() => new Map(sectionUsers.map((member) => [member.id, member])), [sectionUsers]);
  const shiftMap = useMemo(() => new Map(shifts.map((shift) => [shift.id, shift])), [shifts]);
  const activeSection = useMemo(() => sections.find((section) => section.id === effectiveSectionId) || null, [effectiveSectionId, sections]);
  const shiftIds = useMemo(() => new Set(shifts.map((shift) => shift.id)), [shifts]);

  const sortedAssignments = useMemo(
    () =>
      scheduledShifts.filter((item) => (!memberFilter || item.user_id === memberFilter) && (!shiftFilter || String(item.shift_id) === shiftFilter)).sort((left, right) => {
        const dateCompare = left.date.localeCompare(right.date);
        if (dateCompare !== 0) return dateCompare;
        const leftShift = shiftMap.get(left.shift_id)?.start_time || '';
        const rightShift = shiftMap.get(right.shift_id)?.start_time || '';
        return leftShift.localeCompare(rightShift);
      }),
    [scheduledShifts, shiftMap, memberFilter, shiftFilter]
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
  const visibleWindowLabel = `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d')}`;
  const teamSignals = useMemo(
    () => [
      {
        label: 'Section scope',
        value: activeSection?.section_name || 'Unassigned',
        detail: `${sectionUsers.length} roster members / ${shifts.length} shifts`,
        icon: <FaUsers />,
        tone: activeSection ? 'ok' : 'watch',
      },
      {
        label: 'Assignments',
        value: scheduledShifts.length,
        detail: `${assignedUserCount} people engaged in ${PRESET_LABELS[viewPreset].toLowerCase()}`,
        icon: <FaCalendarAlt />,
        tone: scheduledShifts.length ? 'info' : 'watch',
      },
      {
        label: 'Coverage',
        value: `${coveragePercent}%`,
        detail: sectionUsers.length ? `${assignedUserCount}/${sectionUsers.length} roster engaged` : 'No roster loaded',
        icon: <FaChartLine />,
        tone: coveragePercent >= 80 ? 'ok' : coveragePercent >= 50 ? 'watch' : 'danger',
      },
      {
        label: 'Patterns',
        value: patterns.length,
        detail: `${shiftAnalytics.length} shift types active`,
        icon: <FaLayerGroup />,
        tone: patterns.length ? 'ok' : 'watch',
      },
    ],
    [activeSection, assignedUserCount, coveragePercent, patterns.length, scheduledShifts.length, sectionUsers.length, shiftAnalytics.length, shifts.length, viewPreset]
  );

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
    void loadPatterns(effectiveSectionId);
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

  const openCreateShift = () => {
    setShiftForm({
      id: null,
      name: '',
      start_time: '07:00',
      end_time: '15:00',
      timezone: shifts[0]?.timezone || 'Africa/Johannesburg',
      color: '#2563eb',
    });
    setShowShiftModal(true);
  };

  const closeShiftModal = () => {
    setShowShiftModal(false);
    if (resumePatternAfterShift) {
      setShowPatternModal(true);
      setResumePatternAfterShift(false);
    }
  };

  const openEditShift = (shift: Shift) => {
    setShiftForm({
      id: shift.id,
      name: shift.name || '',
      start_time: (shift.start_time || '').slice(0, 5),
      end_time: (shift.end_time || '').slice(0, 5),
      timezone: shift.timezone || shifts[0]?.timezone || 'Africa/Johannesburg',
      color: shift.color || '#2563eb',
    });
    setShowShiftModal(true);
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

  const handleSaveShift = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageShifts || !shiftForm.name.trim() || !shiftForm.start_time || !shiftForm.end_time) return;

    setShiftSubmitting(true);
    try {
      const payload = {
        name: shiftForm.name.trim(),
        start_time: shiftForm.start_time,
        end_time: shiftForm.end_time,
        timezone: shiftForm.timezone.trim() || 'Africa/Johannesburg',
        color: shiftForm.color || null,
        metadata: {},
      };

      if (shiftForm.id) {
        await teamApi.updateShift(shiftForm.id, payload);
        addNotification({ type: 'success', message: 'Shift updated.', priority: 'medium' });
      } else {
        await teamApi.createShift(payload);
        addNotification({ type: 'success', message: 'Shift created. It is now available for patterns and templates.', priority: 'medium' });
      }

      await loadShifts();
      closeShiftModal();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to save shift',
        priority: 'high',
      });
    } finally {
      setShiftSubmitting(false);
    }
  };

  const handleDeleteShift = async (shift: Shift) => {
    if (!canManageShifts) return;
    if (!window.confirm(`Delete shift "${shift.name}"? This is only allowed when no schedule, pattern, or exception uses it.`)) {
      return;
    }

    try {
      await teamApi.deleteShift(shift.id);
      await loadShifts();
      await loadPatterns(effectiveSectionId);
      addNotification({ type: 'success', message: 'Shift deleted.', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || err.message || 'Failed to delete shift',
        priority: 'high',
      });
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
        <div className="access-guard">
          <FaUsers />
          <h2>Team command access required</h2>
          <p>You need manager or admin rights to orchestrate schedules, patterns, and staffing exceptions.</p>
        </div>
      </div>
    );
  }

  if (bootstrapping) {
    return <TeamManagementPreview />;
  }

  return (
    <div className="advanced-team-mgmt-page">
      {bootstrapError && <div className="pattern-feedback" role="alert">{bootstrapError}<button className="team-btn-secondary" onClick={() => setBootstrapAttempt(attempt => attempt + 1)}>Retry scheduling data</button></div>}
      <section className="team-command-strip">
        <div className="team-command-title">
          <span><FaLayerGroup /> Team management</span>
          <strong>{activeSection?.section_name || 'Unassigned section'}</strong>
          <small>{visibleWindowLabel} / {PRESET_LABELS[viewPreset]} / {role || 'operator'}</small>
        </div>

        <div className="team-signal-grid">
          {teamSignals.map((signal) => (
            <article key={signal.label} className={`team-signal-card tone-${signal.tone}`}>
              <span className="team-signal-icon">{signal.icon}</span>
              <span className="team-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.detail}</em>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="team-command-layout">
        <div className="team-board-panel">
          <div className="team-panel-head">
            <div><span className="team-panel-kicker"><FaCalendarAlt /> Assignment board</span><h2>Team schedule</h2></div>
            <div className="team-panel-meta">
              <span>{scheduledShifts.length} assignments</span>
              <span>{shiftAnalytics.length} shift types active</span>
              <span>{scheduleRefreshing ? 'Refreshing...' : `Page ${Math.min(currentPage, totalPages)} of ${totalPages}`}</span>
            </div>
          </div>

          <div className="team-control-grid">
            <div className="team-toolbar-block">
              <span className="team-toolbar-label">View window</span>
              <div className="view-presets">
                {(Object.keys(PRESET_LABELS) as ViewPreset[]).map((preset) => (
                  <button key={preset} aria-pressed={viewPreset === preset} className={`preset-btn ${viewPreset === preset ? 'active' : ''}`} onClick={() => setViewPreset(preset)} type="button">
                    {PRESET_LABELS[preset]}
                  </button>
                ))}
              </div>
            </div>
            <div className="team-toolbar-block compact"><span className="team-toolbar-label">Window span</span><strong>{visibleWindowLabel}</strong></div>
            {isAdmin ? (
              <div className="team-toolbar-block compact">
                <span className="team-toolbar-label">Section scope</span>
                <select aria-label="Section scope" value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="section-select">
                  <option value="">Select section</option>
                  {sections.map((section) => <option key={section.id} value={section.id}>{section.section_name}</option>)}
                </select>
              </div>
            ) : (
              <div className="team-toolbar-block compact"><span className="team-toolbar-label">Weekend load</span><strong>{weekendAssignments}</strong></div>
            )}
          </div>

          <div className="schedule-explorer">
            {viewPreset === 'custom' && <form className="schedule-date-range" onSubmit={(event) => { event.preventDefault(); if (customDates.start && customDates.end && customDates.end >= customDates.start) setAppliedDates(customDates); }}>
              <label>From<input aria-label="Schedule from date" type="date" required value={customDates.start} onChange={(event) => setCustomDates((previous) => ({ ...previous, start: event.target.value }))} /></label>
              <label>Through<input aria-label="Schedule through date" type="date" required min={customDates.start} value={customDates.end} onChange={(event) => setCustomDates((previous) => ({ ...previous, end: event.target.value }))} /></label>
              <button className="team-btn-secondary" type="submit">Apply dates</button>
              <small>Use the same date for a single day.</small>
            </form>}
            <div className="schedule-filter-row">
              <label>Team member<select value={memberFilter} onChange={(event) => setMemberFilter(event.target.value)}><option value="">All team members</option>{sectionUsers.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}</select></label>
              <label>Shift<select value={shiftFilter} onChange={(event) => setShiftFilter(event.target.value)}><option value="">All shifts</option>{shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}</select></label>
              <span className="schedule-result-count" aria-live="polite">{sortedAssignments.length} matching assignments</span>
              {(memberFilter || shiftFilter) && <button className="team-btn-secondary" type="button" onClick={() => { setMemberFilter(''); setShiftFilter(''); }}>Clear filters</button>}
            </div>
          </div>

          <div className="team-action-row">
            <button className="team-btn-primary-glow" onClick={openBulkAssignment} disabled={!effectiveSectionId} type="button"><FaRobot /> Smart assign</button>
            <button className="team-btn-secondary" onClick={() => setShowDaysOffModal(true)} disabled={!effectiveSectionId} type="button"><FaUserClock /> Time off</button>
            <button className="team-btn-secondary" onClick={openSingleAssignment} disabled={!effectiveSectionId || !shifts.length} type="button"><FaPlus /> Single shift</button>
          </div>

          <div className="team-board-ledger">
            <span><strong>{sectionUsers.length}</strong><em>Roster</em></span>
            <span><strong>{patterns.length}</strong><em>Patterns</em></span>
            <span><strong>{weekendAssignments}</strong><em>Weekend</em></span>
            <span><strong>{busiestDay ? format(parseISO(busiestDay.date), 'MMM d') : '--'}</strong><em>Busiest</em></span>
          </div>

          {scheduleError ? <div className="schedule-state" role="alert"><p>{scheduleError}</p><button className="team-btn-secondary" onClick={() => void loadScheduledShifts('skeleton')}>Retry schedule</button></div> : scheduleLoading ? (
            <div className="schedule-skeleton-stack">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="schedule-skeleton-cluster">
                  <div className="team-skel-line skeleton-day-head" />
                  <div className="schedule-skeleton-grid">
                    {Array.from({ length: 3 }).map((__, nestedIndex) => (
                      <div key={nestedIndex} className="schedule-skeleton-card" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !scheduledByDate.length ? (
            <div className="schedule-state empty"><FaCalendarAlt /><h3>{memberFilter || shiftFilter ? 'No assignments match these filters' : 'No schedule published for this window'}</h3><p>{memberFilter || shiftFilter ? 'Try another person, shift, or date range.' : 'Start with Smart Assign for pattern rollout or create a single shift assignment.'}</p></div>
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
                            <button className="team-btn-icon danger" onClick={() => handleDelete(scheduled.id)} title="Remove assignment"><FaTrash /></button>
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
                <button className="team-btn-secondary" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1}>
                  Previous
                </button>
                <button className="team-btn-secondary" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages}>
                  Next
                </button>
              </div>
            </div>
            </>
          )}
        </div>

        <aside className="team-insights">
          <div className="insight-panel">
            <div className="team-panel-head compact">
              <div>
                <span className="team-panel-kicker"><FaUsers /> Roster</span>
                <h3>Section operators</h3>
              </div>
            </div>
            <div className="roster-list">
              {sectionUsers.slice(0, 6).map((member) => (
                <div key={member.id} className="team-roster-item">
                  <div className="team-avatar-badge">{(member.first_name?.[0] || 'U') + (member.last_name?.[0] || '')}</div>
                  <div><strong>{member.first_name} {member.last_name}</strong><span>{member.role || 'team member'}</span></div>
                </div>
              ))}
              {!sectionUsers.length ? <p className="insight-empty">No team members loaded for this section.</p> : null}
            </div>
          </div>

          <div className="insight-panel">
            <div className="team-panel-head compact">
              <div>
                <span className="team-panel-kicker"><FaChartLine /> Shift mix</span>
                <h3>Distribution</h3>
              </div>
            </div>
            <div className="analytics-list">
              {shiftAnalytics.slice(0, 5).map(({ shift, total }) => (
                <div key={shift?.id || total} className="analytics-item"><div><strong>{shift?.name || 'Unknown shift'}</strong><span>{shift ? `${shift.start_time} - ${shift.end_time}` : 'Missing shift metadata'}</span></div><em>{total}</em></div>
              ))}
              {!shiftAnalytics.length ? <p className="insight-empty">Assignments will surface shift distribution here.</p> : null}
            </div>
          </div>

          <div className="insight-panel">
            <div className="team-panel-head compact">
              <div>
                <span className="team-panel-kicker"><FaClock /> Shift configuration</span>
                <h3>Operational shifts</h3>
              </div>
              {canManageShifts ? (
                <button className="team-btn-secondary" type="button" onClick={openCreateShift}>
                  <FaPlus /> New shift
                </button>
              ) : null}
            </div>
            <div className="shift-config-list">
              {shifts.map((shift) => (
                <div key={shift.id} className="shift-config-item">
                  <span className="shift-color-dot" style={{ backgroundColor: shift.color || '#2563eb' }} />
                  <div>
                    <strong>{shift.name}</strong>
                    <span>{shift.start_time} - {shift.end_time} / {shift.timezone || 'UTC'}</span>
                  </div>
                  {canManageShifts ? (
                    <div className="team-pattern-actions">
                      <button type="button" className="team-btn-icon" onClick={() => openEditShift(shift)} title="Edit shift">
                        <FaEdit />
                      </button>
                      <button type="button" className="team-btn-icon danger" onClick={() => void handleDeleteShift(shift)} title="Delete shift">
                        <FaTrash />
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
              {!shifts.length ? <p className="insight-empty">No shifts configured yet. Create shifts before building patterns.</p> : null}
            </div>
          </div>

          <div className="insight-panel">
            <div className="team-panel-head compact">
              <div>
                <span className="team-panel-kicker"><FaWrench /> Pattern deck</span>
                <h3>Available patterns</h3>
              </div>
              <button className="team-btn-secondary" type="button" onClick={openCreatePattern} disabled={!effectiveSectionId}>
                <FaPlus /> New pattern
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
                  <div className="team-pattern-actions">
                    <button type="button" className="team-btn-icon" onClick={() => openEditPattern(pattern)} title="Edit pattern">
                      <FaEdit />
                    </button>
                    <button type="button" className="team-btn-icon danger" onClick={() => handleDeletePattern(pattern.id)} title="Delete pattern">
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
              {patternsLoading ? <p role="status">Loading patterns…</p> : patternsError ? <p role="alert">{patternsError} <button className="team-btn-secondary" onClick={() => void loadPatterns(effectiveSectionId)}>Retry patterns</button></p> : !patterns.length ? <p className="insight-empty">No shift patterns configured for this section yet.</p> : null}
            </div>
          </div>
        </aside>
      </section>

      {showAssignmentModal ? (
        <div className="team-modal-overlay">
          <div ref={assignmentDialog} className="team-modal-content large" role="dialog" aria-modal="true" aria-label="Smart Assignment">
            <div className="team-modal-header">
              <div><span className="team-panel-kicker">{assignmentMode === 'bulk' ? 'Smart Assignment' : 'Single Assignment'}</span><h2>{assignmentMode === 'bulk' ? 'Pattern-driven team rollout' : 'Precision single-shift placement'}</h2></div>
              <button className="team-btn-close" aria-label="Close assignment" disabled={assignSubmitting} onClick={() => setShowAssignmentModal(false)}><FaTimes /></button>
            </div>
            <div className="team-modal-mode-switch">
              <button className={assignmentMode === 'bulk' ? 'active' : ''} onClick={openBulkAssignment} type="button">Bulk Pattern</button>
              <button className={assignmentMode === 'single' ? 'active' : ''} onClick={openSingleAssignment} type="button">Single Shift</button>
            </div>
            <form onSubmit={assignmentMode === 'bulk' ? handleBulkAssign : handleSingleAssign} className="assignment-form">
              {assignmentMode === 'bulk' ? (
                <>
                  <div className="team-form-group">
                    <label htmlFor="assignment-pattern">Pattern · {activeSection?.section_name || 'Current section'}</label>
                    <select id="assignment-pattern" disabled={patternsLoading || Boolean(patternsError) || !patterns.length} value={assignForm.pattern_id} onChange={(event) => setAssignForm((previous) => ({ ...previous, pattern_id: event.target.value }))} className="team-form-select" required>
                      <option value="">{patternsLoading ? 'Loading shift patterns…' : 'Select a shift pattern'}</option>
                      {patterns.map((pattern) => <option key={pattern.id} value={pattern.id}>{pattern.name} ({pattern.pattern_type})</option>)}
                    </select>
                    {patternsError ? <div className="pattern-feedback" role="alert">{patternsError}<button type="button" className="team-btn-secondary" onClick={() => void loadPatterns(effectiveSectionId)}>Retry patterns</button></div> : !patternsLoading && !patterns.length ? <div className="pattern-feedback">No patterns in this section yet.<button type="button" className="team-btn-secondary" onClick={() => { setShowAssignmentModal(false); openCreatePattern(); }}>Create a pattern</button></div> : null}
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
                  <div className="team-form-row">
                    <div className="team-form-group"><label htmlFor="assignment-start">Start Date</label><input id="assignment-start" type="date" value={assignForm.start_date} onChange={(event) => setAssignForm((previous) => ({ ...previous, start_date: event.target.value }))} className="team-form-input" required /></div>
                    <div className="team-form-group"><label htmlFor="assignment-end">End Date</label><input id="assignment-end" min={assignForm.start_date} type="date" value={assignForm.end_date} onChange={(event) => setAssignForm((previous) => ({ ...previous, end_date: event.target.value }))} className="team-form-input" /></div>
                  </div>
                  <div className="team-form-group">
                    <label>Assign team members</label>
                    <div className="team-user-selector">
                      {sectionUsers.map((member) => (
                        <label key={member.id} className="team-user-checkbox">
                          <input type="checkbox" checked={assignForm.users.includes(member.id)} onChange={(event) => setAssignForm((previous) => ({ ...previous, users: event.target.checked ? [...previous.users, member.id] : previous.users.filter((id) => id !== member.id) }))} />
                          <span>{member.first_name} {member.last_name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="team-form-row">
                    <div className="team-form-group"><label>Date</label><input type="date" value={assignForm.date} onChange={(event) => setAssignForm((previous) => ({ ...previous, date: event.target.value }))} className="team-form-input" required /></div>
                    <div className="team-form-group">
                      <label>Shift</label>
                      <select value={assignForm.shift_id || ''} onChange={(event) => setAssignForm((previous) => ({ ...previous, shift_id: Number(event.target.value) }))} className="team-form-select" required>
                        <option value="">Select shift</option>
                        {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.start_time} - {shift.end_time})</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="team-form-group">
                    <label>Team member</label>
                    <select value={assignForm.user_id} onChange={(event) => setAssignForm((previous) => ({ ...previous, user_id: event.target.value }))} className="team-form-select" required>
                      <option value="">Select team member</option>
                      {sectionUsers.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div className="team-form-actions">
                <button type="button" className="team-btn-secondary" onClick={() => setShowAssignmentModal(false)}>Cancel</button>
                <button type="submit" className="team-btn-primary-glow" disabled={assignSubmitting || (assignmentMode === 'bulk' && (patternsLoading || !assignForm.pattern_id || !assignForm.users.length))}>{assignSubmitting ? 'Applying...' : assignmentMode === 'bulk' ? `Assign ${assignForm.users.length || 0} Members` : 'Create Assignment'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showShiftModal ? (
        <div className="team-modal-overlay">
          <div className="team-modal-content">
            <div className="team-modal-header">
              <div>
                <span className="team-panel-kicker">Shift Configuration</span>
                <h2>{shiftForm.id ? 'Edit operational shift' : 'Create operational shift'}</h2>
              </div>
              <button className="team-btn-close" onClick={closeShiftModal}><FaTimes /></button>
            </div>
            <form onSubmit={handleSaveShift} className="assignment-form">
              <div className="team-form-group">
                <label>Shift name</label>
                <input
                  type="text"
                  className="team-form-input"
                  value={shiftForm.name}
                  onChange={(event) => setShiftForm((previous) => ({ ...previous, name: event.target.value }))}
                  placeholder="e.g., Early Support, Weekend Core, IDC Night"
                  required
                />
              </div>
              <div className="team-form-row">
                <div className="team-form-group">
                  <label>Start time</label>
                  <input
                    type="time"
                    className="team-form-input"
                    value={shiftForm.start_time}
                    onChange={(event) => setShiftForm((previous) => ({ ...previous, start_time: event.target.value }))}
                    required
                  />
                </div>
                <div className="team-form-group">
                  <label>End time</label>
                  <input
                    type="time"
                    className="team-form-input"
                    value={shiftForm.end_time}
                    onChange={(event) => setShiftForm((previous) => ({ ...previous, end_time: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="team-form-row">
                <div className="team-form-group">
                  <label>Timezone</label>
                  <input
                    type="text"
                    className="team-form-input"
                    value={shiftForm.timezone}
                    onChange={(event) => setShiftForm((previous) => ({ ...previous, timezone: event.target.value }))}
                    placeholder="Africa/Johannesburg"
                  />
                </div>
                <div className="team-form-group">
                  <label>Color</label>
                  <div className="shift-color-input">
                    <input
                      type="color"
                      value={shiftForm.color}
                      onChange={(event) => setShiftForm((previous) => ({ ...previous, color: event.target.value }))}
                      aria-label="Shift color"
                    />
                    <input
                      type="text"
                      className="team-form-input"
                      value={shiftForm.color}
                      onChange={(event) => setShiftForm((previous) => ({ ...previous, color: event.target.value }))}
                    />
                  </div>
                </div>
              </div>
              <div className="team-form-actions">
                <button type="button" className="team-btn-secondary" onClick={closeShiftModal}>Cancel</button>
                <button type="submit" className="team-btn-primary-glow" disabled={shiftSubmitting || !canManageShifts}>
                  {shiftSubmitting ? 'Saving...' : shiftForm.id ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showPatternModal ? (
        <div className="team-modal-overlay">
          <div className="team-modal-content large">
            <div className="team-modal-header">
              <div>
                <span className="team-panel-kicker">Pattern Management</span>
                <h2>{patternForm.id ? 'Edit shift pattern' : 'Create shift pattern'}</h2>
              </div>
              <button className="team-btn-close" onClick={() => setShowPatternModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleSavePattern} className="assignment-form">
              <div className="team-form-row">
                <div className="team-form-group">
                  <label>Pattern name</label>
                  <input
                    type="text"
                    className="team-form-input"
                    value={patternForm.name}
                    onChange={(event) => setPatternForm((previous) => ({ ...previous, name: event.target.value }))}
                    required
                  />
                </div>
                <div className="team-form-group">
                  <label>Pattern type</label>
                  <select
                    className="team-form-select"
                    value={patternForm.pattern_type}
                    onChange={(event) => setPatternForm((previous) => ({ ...previous, pattern_type: event.target.value as 'FIXED' | 'ROTATING' | 'CUSTOM' }))}
                  >
                    <option value="FIXED">FIXED</option>
                    <option value="ROTATING">ROTATING</option>
                    <option value="CUSTOM">CUSTOM</option>
                  </select>
                </div>
              </div>
              <div className="team-form-group">
                <label>Description</label>
                <input
                  type="text"
                  className="team-form-input"
                  value={patternForm.description}
                  onChange={(event) => setPatternForm((previous) => ({ ...previous, description: event.target.value }))}
                  placeholder="Optional details for planners"
                />
              </div>
              <div className="pattern-shift-source">
                <FaClock />
                <span>{shifts.length} configured shift{shifts.length === 1 ? '' : 's'} available for this pattern.</span>
                {canManageShifts ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResumePatternAfterShift(true);
                      setShowPatternModal(false);
                      openCreateShift();
                    }}
                  >
                    Add shift
                  </button>
                ) : null}
              </div>
              <div className="pattern-editor-grid">
                {patternForm.schedule_days.map((day) => (
                  <div key={day.day_of_week} className="pattern-editor-day">
                    <strong>{DAY_LABELS[day.day_of_week]}</strong>
                    <label className="team-user-checkbox">
                      <input
                        type="checkbox"
                        checked={day.is_off_day}
                        onChange={(event) => updatePatternDay(day.day_of_week, { is_off_day: event.target.checked })}
                      />
                      <span>Off day</span>
                    </label>
                    <select
                      className="team-form-select"
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
              <div className="team-form-actions">
                <button type="button" className="team-btn-secondary" onClick={() => setShowPatternModal(false)}>Cancel</button>
                <button type="submit" className="team-btn-primary-glow" disabled={patternSubmitting}>
                  {patternSubmitting ? 'Saving...' : patternForm.id ? 'Update Pattern' : 'Create Pattern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showDaysOffModal ? (
        <div className="team-modal-overlay">
          <div className="team-modal-content">
            <div className="team-modal-header">
              <div><span className="team-panel-kicker">Time Off Control</span><h2>Register staffing exceptions</h2></div>
              <button className="team-btn-close" onClick={() => setShowDaysOffModal(false)}><FaTimes /></button>
            </div>
            <form onSubmit={handleRegisterDaysOff} className="simple-form">
              <div className="team-form-group">
                <label>Team member</label>
                <select value={daysOffForm.user_id} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, user_id: event.target.value }))} className="team-form-select" required>
                  <option value="">Select team member</option>
                  {sectionUsers.map((member) => <option key={member.id} value={member.id}>{member.first_name} {member.last_name}</option>)}
                </select>
              </div>
              <div className="team-form-row">
                <div className="team-form-group"><label>Start Date</label><input type="date" value={daysOffForm.start_date} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, start_date: event.target.value }))} className="team-form-input" required /></div>
                <div className="team-form-group"><label>End Date</label><input type="date" value={daysOffForm.end_date} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, end_date: event.target.value }))} className="team-form-input" required /></div>
              </div>
              <div className="team-form-group">
                <label>Reason</label>
                <select value={daysOffForm.reason} onChange={(event) => setDaysOffForm((previous) => ({ ...previous, reason: event.target.value }))} className="team-form-select">
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="team-form-actions">
                <button type="button" className="team-btn-secondary" onClick={() => setShowDaysOffModal(false)}>Cancel</button>
                <button type="submit" className="team-btn-primary-glow" disabled={daysOffSubmitting}>{daysOffSubmitting ? 'Registering...' : 'Register Time Off'}</button>
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
