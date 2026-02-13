import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaUsers,
  FaPlus,
  FaTrash,
  FaClock,
  FaTimes,
  FaWrench,
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { shiftSchedulingApi, ShiftPattern, PatternSchedule } from '../services/shiftSchedulingApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, addMonths, startOfMonth, endOfMonth, parseISO, isWeekend } from 'date-fns';
import './AdvancedTeamManagementPage.css';

type ViewMode = 'simple' | 'pattern' | 'exceptions';
type ViewPreset = 'tomorrow' | 'weekend' | 'this_month' | 'next_month';

const AdvancedTeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();

  // Core state
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [sectionUsers, setSectionUsers] = useState<UserListItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [patterns, setPatterns] = useState<ShiftPattern[]>([]);
  const [selectedPattern, setSelectedPattern] = useState<PatternSchedule | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [sectionId, setSectionId] = useState<string>('');

  // Assignment form state
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<'single' | 'bulk'>('single');
  const [assignForm, setAssignForm] = useState({
    mode: 'single' as 'single' | 'bulk',
    shift_id: 0,
    user_id: '',
    date: '',
    // Bulk/pattern mode
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

  const canManageTeam = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    return r === 'admin' || r === 'supervisor' || r === 'manager';
  }, [currentUser]);

  // Load initial data
  useEffect(() => {
    const load = async () => {
      if (!canManageTeam) return;
      setLoading(true);
      try {
        const [shiftsData, sectionsData, patternsData] = await Promise.all([
          teamApi.listShifts(),
          orgApi.listSections(),
          shiftSchedulingApi.listShiftPatterns(effectiveSectionId),
        ]);
        setShifts(shiftsData);
        setSections(sectionsData);
        setPatterns(patternsData);

        if (!sectionId && !isAdmin && userSectionId) {
          setSectionId(userSectionId);
        } else if (!sectionId && isAdmin && sectionsData.length > 0) {
          setSectionId(sectionsData[0].id);
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
    };
    void load();
  }, [canManageTeam, isAdmin, userSectionId, addNotification, effectiveSectionId]);

  // Load scheduled shifts
  useEffect(() => {
    const loadScheduledShifts = async () => {
      if (!canManageTeam || !effectiveSectionId) return;
      try {
        const schedData = await teamApi.listScheduledShifts({
          start_date: format(dateRange.start, 'yyyy-MM-dd'),
          end_date: format(dateRange.end, 'yyyy-MM-dd'),
          section_id: effectiveSectionId,
        });
        setScheduledShifts(schedData);
      } catch (err) {
        console.error('Failed to load scheduled shifts', err);
        setScheduledShifts([]);
      }
    };
    void loadScheduledShifts();
  }, [canManageTeam, effectiveSectionId, dateRange, viewPreset]);

  // Load patterns when section changes
  useEffect(() => {
    const loadPatterns = async () => {
      if (!effectiveSectionId) return;
      try {
        const patternsData = await shiftSchedulingApi.listShiftPatterns(effectiveSectionId);
        setPatterns(patternsData);
      } catch (err) {
        console.error('Failed to load patterns', err);
      }
    };
    void loadPatterns();
  }, [effectiveSectionId]);

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      if (!effectiveSectionId) return;
      try {
        const users = await userApi.listUsersBySection(effectiveSectionId);
        setSectionUsers(users);
      } catch {
        setSectionUsers([]);
      }
    };
    void loadUsers();
  }, [effectiveSectionId]);

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

      // Reload schedule
      const sched = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId || undefined,
      });
      setScheduledShifts(sched);
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
        approved: isAdmin,
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
        message: err.message || 'Failed to register days off',
        priority: 'high',
      });
    } finally {
      setLoading(false);
    }
  };

  
  const handleDelete = async (id: string) => {
    try {
      await teamApi.deleteScheduledShift(id);
      setScheduledShifts((prev) => prev.filter((s) => s.id !== id));
      addNotification({ type: 'success', message: 'Shift removed', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to remove assignment',
        priority: 'high',
      });
    }
  };

  const userMap = useMemo(() => {
    const m = new Map<string, UserListItem>();
    sectionUsers.forEach((u) => m.set(u.id, u));
    return m;
  }, [sectionUsers]);

  const shiftMap = useMemo(() => {
    const m = new Map<number, Shift>();
    shifts.forEach((s) => m.set(s.id, s));
    return m;
  }, [shifts]);

  if (!canManageTeam) {
    return (
      <div className="advanced-team-mgmt-page">
        <div className="access-guard">
          <FaUsers size={40} />
          <h2>Team & Shift Management</h2>
          <p>You need manager or admin rights to manage shift schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="advanced-team-mgmt-page">
      <header className="team-mgmt-header">
        <div className="header-content">
          <div>
            <h1>🚀 Team & Shift Schedule</h1>
            <p>Smart pattern-based scheduling with bulk assignment and exception management</p>
          </div>
          <div className="header-actions">
            <button
              className="btn-primary-glow"
              onClick={async () => {
                setAssignmentMode('bulk');
                setAssignForm((p) => ({
                  ...p,
                  mode: 'bulk',
                  // prefill start date to today to avoid submit remaining disabled
                  start_date: format(new Date(), 'yyyy-MM-dd'),
                  users: [],
                  pattern_id: '',
                }));
                // refresh patterns when opening modal so dropdown shows recent inserts
                try {
                  if (!patterns || patterns.length === 0) {
                    const refreshed = await shiftSchedulingApi.listShiftPatterns(effectiveSectionId);
                    setPatterns(refreshed);
                  }
                } catch (err) {
                  console.error('Failed to refresh patterns', err);
                }
                setShowAssignmentModal(true);
              }}
              disabled={loading || !effectiveSectionId}
              title={patterns.length === 0 ? 'No patterns configured for this section' : 'Assign shift patterns to multiple users'}
            >
              <FaWrench /> Smart Assign
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowDaysOffModal(true)}
              disabled={loading || !effectiveSectionId}
              title="Register or approve days off"
            >
              <FaCalendarAlt /> Time Off
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setAssignmentMode('single');
                setAssignForm((p) => ({ ...p, mode: 'single', date: format(new Date(), 'yyyy-MM-dd') }));
                setShowAssignmentModal(true);
              }}
              disabled={loading || shifts.length === 0 || !effectiveSectionId}
              title="Single-date assignment"
            >
              <FaPlus /> Single Shift
            </button>
          </div>
        </div>
      </header>

      <div className="team-mgmt-toolbar">
        <div className="view-controls">
          <div className="view-presets">
            {(['tomorrow', 'weekend', 'this_month', 'next_month'] as ViewPreset[]).map((preset) => (
              <button
                key={preset}
                className={`preset-btn ${viewPreset === preset ? 'active' : ''}`}
                onClick={() => setViewPreset(preset)}
              >
                {preset === 'tomorrow' && '📅 Tomorrow'}
                {preset === 'weekend' && '🏖️ This Weekend'}
                {preset === 'this_month' && '📆 This Month'}
                {preset === 'next_month' && '📆 Next Month'}
              </button>
            ))}
          </div>
          {isAdmin && (
            <div className="section-filter">
              <label>Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="section-select"
              >
                <option value="">— All —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.section_name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <div className="team-mgmt-content">
        <div className="schedule-grid">
          <div className="schedule-header">
            <span className="col-date">Date</span>
            <span className="col-shift">Shift</span>
            <span className="col-user">Assigned To</span>
            <span className="col-actions"></span>
          </div>

          {loading ? (
            <div className="schedule-loading">⏳ Loading schedule...</div>
          ) : scheduledShifts.length === 0 ? (
            <div className="schedule-empty">
              <FaCalendarAlt size={32} />
              <p>No scheduled shifts for this period.</p>
              <p className="hint">Use Smart Assign for bulk scheduling or add individual shifts above.</p>
            </div>
          ) : (
            scheduledShifts.map((s) => {
              const u = userMap.get(s.user_id);
              const sh = shiftMap.get(s.shift_id);
              const isWeekendDay = isWeekend(parseISO(s.date));
              return (
                <div key={s.id} className={`schedule-row ${isWeekendDay ? 'weekend' : ''}`}>
                  <span className="col-date">
                    {format(parseISO(s.date), 'EEE, MMM d')}
                    {isWeekendDay && <span className="weekend-badge">WKD</span>}
                  </span>
                  <span className="col-shift">
                    <FaClock /> {sh?.name || `Shift #${s.shift_id}`}
                    {sh && <small>{sh.start_time} – {sh.end_time}</small>}
                  </span>
                  <span className="col-user">{u ? `${u.first_name} ${u.last_name}` : s.user_id}</span>
                  <span className="col-actions">
                    <button
                      className="btn-icon danger"
                      onClick={() => handleDelete(s.id)}
                      title="Remove assignment"
                    >
                      <FaTrash />
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Smart Assignment Modal */}
      {showAssignmentModal && (
        <div className="modal-overlay">
          <div className="modal-content large">
            <div className="modal-header">
              <h2>{assignmentMode === 'bulk' ? '🚀 Smart Pattern Assignment' : '📅 Single Shift Assignment'}</h2>
              <button className="btn-close" onClick={() => setShowAssignmentModal(false)}>
                <FaTimes />
              </button>
            </div>

            <form onSubmit={assignmentMode === 'bulk' ? handleBulkAssign : undefined} className="assignment-form">
              {assignmentMode === 'bulk' ? (
                <>
                  <div className="form-group">
                    <label>Select Pattern</label>
                    <select
                      value={assignForm.pattern_id}
                      onChange={async (e) => {
                        setAssignForm((p) => ({ ...p, pattern_id: e.target.value }));
                        if (e.target.value) {
                          try {
                            const details = await shiftSchedulingApi.getPatternDetails(e.target.value);
                            setSelectedPattern(details);
                          } catch (err) {
                            console.error('Failed to load pattern details', err);
                          }
                        }
                      }}
                      required
                      className="form-select"
                    >
                      <option value="">— Choose a pattern —</option>
                      {patterns.length === 0 ? (
                        <option value="" disabled>
                          No patterns available for this section
                        </option>
                      ) : (
                        patterns.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.pattern_type})
                          </option>
                        ))
                      )}
                    </select>
                    <p className="form-hint">Patterns define recurring schedules (e.g., Mon-Fri Morning, Weekends Off)</p>
                  </div>

                  {selectedPattern && (
                    <div className="pattern-preview">
                      <h4>📋 Pattern Schedule</h4>
                      {selectedPattern.schedule && Object.keys(selectedPattern.schedule).length > 0 ? (
                        <div className="pattern-days">
                          {Object.entries(selectedPattern.schedule).map(([day, config]: any) => (
                            <div key={day} className="pattern-day">
                              <strong>{day}</strong>
                              {config.off_day ? (
                                <span className="off-day-badge">OFF</span>
                              ) : (
                                <span 
                                  className="shift-badge"
                                  style={config.color ? { 
                                    backgroundColor: `${config.color}30`,
                                    borderColor: config.color,
                                    color: config.color
                                  } : undefined}
                                >
                                  {config.shift_name?.substring(0, 8) || 'SHIFT'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="pattern-days-empty">
                          ⚠️ No schedule configured for this pattern. Contact your administrator.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="form-row">
                    <div className="form-group">
                      <label>Start Date</label>
                      <input
                        type="date"
                        value={assignForm.start_date}
                        onChange={(e) => setAssignForm((p) => ({ ...p, start_date: e.target.value }))}
                        required
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>End Date (Optional)</label>
                      <input
                        type="date"
                        value={assignForm.end_date}
                        onChange={(e) => setAssignForm((p) => ({ ...p, end_date: e.target.value }))}
                        className="form-input"
                      />
                      <p className="form-hint">Leave empty for ongoing assignment</p>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Assign to Team Members ({assignForm.users.length} selected)</label>
                    <div className="user-selector">
                      {sectionUsers.map((u) => (
                        <label key={u.id} className="user-checkbox">
                          <input
                            type="checkbox"
                            checked={assignForm.users.includes(u.id)}
                            onChange={(e) => {
                              setAssignForm((p) => ({
                                ...p,
                                users: e.target.checked
                                  ? [...p.users, u.id]
                                  : p.users.filter((uid) => uid !== u.id),
                              }));
                            }}
                          />
                          <span>
                            {u.first_name} {u.last_name}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowAssignmentModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-primary-glow"
                      disabled={
                        assignSubmitting || !assignForm.pattern_id || assignForm.users.length === 0 || !assignForm.start_date
                      }
                    >
                      {assignSubmitting ? '⏳ Assigning...' : `✨ Assign to ${assignForm.users.length} Members`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Date</label>
                      <input
                        type="date"
                        value={assignForm.date}
                        onChange={(e) => setAssignForm((p) => ({ ...p, date: e.target.value }))}
                        required
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Shift</label>
                      <select
                        value={assignForm.shift_id}
                        onChange={(e) => setAssignForm((p) => ({ ...p, shift_id: parseInt(e.target.value, 10) }))}
                        required
                        className="form-select"
                      >
                        <option value="">— Select —</option>
                        {shifts.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.start_time}–{s.end_time})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Team Member</label>
                      <select
                        value={assignForm.user_id}
                        onChange={(e) => setAssignForm((p) => ({ ...p, user_id: e.target.value }))}
                        required
                        className="form-select"
                      >
                        <option value="">— Select —</option>
                        {sectionUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name} {u.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn-secondary" onClick={() => setShowAssignmentModal(false)}>
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary-glow" disabled={assignSubmitting}>
                      {assignSubmitting ? '⏳ Assigning...' : 'Assign'}
                    </button>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Days Off Modal */}
      {showDaysOffModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>🏖️ Register Time Off</h2>
              <button className="btn-close" onClick={() => setShowDaysOffModal(false)}>
                <FaTimes />
              </button>
            </div>
            <form onSubmit={handleRegisterDaysOff} className="simple-form">
              <div className="form-group">
                <label>Team Member</label>
                <select
                  value={daysOffForm.user_id}
                  onChange={(e) => setDaysOffForm((p) => ({ ...p, user_id: e.target.value }))}
                  required
                  className="form-select"
                >
                  <option value="">— Select —</option>
                  {sectionUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name} {u.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    value={daysOffForm.start_date}
                    onChange={(e) => setDaysOffForm((p) => ({ ...p, start_date: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label>End Date</label>
                  <input
                    type="date"
                    value={daysOffForm.end_date}
                    onChange={(e) => setDaysOffForm((p) => ({ ...p, end_date: e.target.value }))}
                    required
                    className="form-input"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Reason</label>
                <select
                  value={daysOffForm.reason}
                  onChange={(e) => setDaysOffForm((p) => ({ ...p, reason: e.target.value }))}
                  className="form-select"
                >
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowDaysOffModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-glow" disabled={loading}>
                  {loading ? '⏳ Registering...' : 'Register Time Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedTeamManagementPage;
