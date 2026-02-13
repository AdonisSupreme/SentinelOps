import React, { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaUsers,
  FaPlus,
  FaTrash,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { useNotifications } from '../contexts/NotificationContext';
import { format, addDays, addMonths, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import './TeamManagementPage.css';

type ViewPreset = 'tomorrow' | 'weekend' | 'this_month' | 'next_month';

const TeamManagementPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { addNotification } = useNotifications();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [scheduledShifts, setScheduledShifts] = useState<ScheduledShift[]>([]);
  const [sectionUsers, setSectionUsers] = useState<UserListItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewPreset, setViewPreset] = useState<ViewPreset>('this_month');
  const [sectionId, setSectionId] = useState<string>('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({
    shift_id: 0,
    user_id: '',
    date: '',
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

  const canManageTeam = useMemo(() => {
    const r = (currentUser?.role || '').toLowerCase();
    return r === 'admin' || r === 'supervisor' || r === 'manager';
  }, [currentUser]);

  useEffect(() => {
    const load = async () => {
      if (!canManageTeam) return;
      setLoading(true);
      try {
        const [shiftsData, sectionsData] = await Promise.all([
          teamApi.listShifts(),
          orgApi.listSections(),
        ]);
        setShifts(shiftsData);
        setSections(sectionsData);
        
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
          message: 'Failed to load shift schedule.',
          priority: 'high',
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [canManageTeam, isAdmin, userSectionId, addNotification]); // Removed effectiveSectionId from dependency
  
  // Separate effect for loading scheduled shifts based on effective section and date range
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
  }, [canManageTeam, effectiveSectionId, dateRange, viewPreset]); // Proper dependency for scheduled shifts

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

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.shift_id || !assignForm.user_id || !assignForm.date) return;
    setLoading(true);
    try {
      await teamApi.createScheduledShift({
        shift_id: assignForm.shift_id,
        user_id: assignForm.user_id,
        date: assignForm.date,
      });
      const sched = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId || undefined,
      });
      setScheduledShifts(sched);
      setShowAssignModal(false);
      setAssignForm({ shift_id: 0, user_id: '', date: '' });
      addNotification({ type: 'success', message: 'Shift assigned successfully', priority: 'medium' });
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to assign shift',
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
      addNotification({ type: 'success', message: 'Shift unassigned', priority: 'medium' });
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
      <div className="team-mgmt-page">
        <div className="team-mgmt-guard">
          <FaUsers size={40} />
          <h2>Team Management</h2>
          <p>You need manager or admin rights to manage shift schedules.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-mgmt-page">
      <header className="team-mgmt-header">
        <div>
          <h1>Team & Shift Schedule</h1>
          <p>Plan who's on shift — tomorrow, this weekend, this month, next month.</p>
        </div>
        <button
          className="btn-primary-glow"
          onClick={() => {
            setAssignForm({
              shift_id: shifts[0]?.id || 0,
              user_id: '',
              date: format(new Date(), 'yyyy-MM-dd'),
            });
            setShowAssignModal(true);
          }}
          disabled={loading || shifts.length === 0 || !effectiveSectionId}
          title={
            shifts.length === 0
              ? 'No shifts available - create shifts first'
              : !effectiveSectionId
              ? 'Select a section first'
              : ''
          }
        >
          <FaPlus /> Assign Shift
        </button>
      </header>

      <div className="team-mgmt-toolbar">
        <div className="view-presets">
          {(['tomorrow', 'weekend', 'this_month', 'next_month'] as ViewPreset[]).map((preset) => (
            <button
              key={preset}
              className={`preset-btn ${viewPreset === preset ? 'active' : ''}`}
              onClick={() => setViewPreset(preset)}
            >
              {preset === 'tomorrow' && 'Tomorrow'}
              {preset === 'weekend' && 'This Weekend'}
              {preset === 'this_month' && 'This Month'}
              {preset === 'next_month' && 'Next Month'}
            </button>
          ))}
        </div>
        {isAdmin && (
          <div className="section-filter">
            <label>Section</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
            >
              <option value="">— All —</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.section_name}</option>
              ))}
            </select>
          </div>
        )}
        {loading && <span className="loading-pill">Loading schedule...</span>}
      </div>

      <div className="team-mgmt-content">
        <div className="schedule-grid">
          <div className="schedule-header">
            <span className="col-date">Date</span>
            <span className="col-shift">Shift</span>
            <span className="col-user">Assigned To</span>
            <span className="col-actions"></span>
          </div>
          {scheduledShifts.length === 0 ? (
            <div className="schedule-empty">
              <FaCalendarAlt size={32} />
              <p>No scheduled shifts for this period.</p>
              <p className="hint">Assign shifts using the button above.</p>
            </div>
          ) : (
            scheduledShifts.map((s) => {
              const u = userMap.get(s.user_id);
              const sh = shiftMap.get(s.shift_id);
              return (
                <div key={s.id} className="schedule-row">
                  <span className="col-date">{format(parseISO(s.date), 'EEE, MMM d')}</span>
                  <span className="col-shift">
                    <FaClock /> {sh?.name || `Shift #${s.shift_id}`}
                    {sh && (
                      <small>{sh.start_time} – {sh.end_time}</small>
                    )}
                  </span>
                  <span className="col-user">
                    {u ? `${u.first_name} ${u.last_name}` : s.user_id}
                  </span>
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

      {showAssignModal && (
        <div className="team-mgmt-modal">
          <div className="team-mgmt-modal-content">
            <h2>Assign Shift</h2>
            <form onSubmit={handleAssign} className="assign-form">
              <label>
                Date
                <input
                  type="date"
                  value={assignForm.date}
                  onChange={(e) => setAssignForm((p) => ({ ...p, date: e.target.value }))}
                  required
                />
              </label>
              <label>
                Shift
                <select
                  value={assignForm.shift_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, shift_id: parseInt(e.target.value, 10) }))}
                  required
                >
                  <option value="">— Select —</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.start_time}–{s.end_time})</option>
                  ))}
                </select>
              </label>
              <label>
                Team Member
                <select
                  value={assignForm.user_id}
                  onChange={(e) => setAssignForm((p) => ({ ...p, user_id: e.target.value }))}
                  required
                >
                  <option value="">— Select —</option>
                  {sectionUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                  ))}
                </select>
              </label>
              <div className="assign-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-glow" disabled={loading}>
                  {loading ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagementPage;
