import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardChecklistThread } from '../../services/checklistApi';
import { FaArrowRight, FaCheckCircle, FaClock, FaMoon, FaSun, FaUsers } from 'react-icons/fa';
import './ChecklistCard.css';

const ChecklistCard: React.FC<{ thread: DashboardChecklistThread }> = ({ thread }) => {
  const progress = thread.total_items > 0 && Number.isFinite(thread.execution_percentage)
    ? Math.min(100, Math.max(0, thread.execution_percentage)) : 0;
  const statuses: Record<string, string> = {
    COMPLETED: 'Completed', IN_PROGRESS: 'In progress', PENDING_REVIEW: 'Pending review',
    COMPLETED_WITH_EXCEPTIONS: 'Exceptions tracked', OPEN: 'Open',
  };
  const shiftTimes: Record<string, string> = { MORNING: '07:00–15:00', AFTERNOON: '15:00–23:00', NIGHT: '23:00–07:00' };
  const shift = thread.shift.replace(/_/g, ' ').toLowerCase();
  return (
    <Link to={`/checklist/${thread.id}`} className={`ops-thread-card ops-thread-${thread.status.toLowerCase()}`}>
      <div className="ops-thread-heading">
        <span className="ops-thread-symbol" aria-hidden="true">{thread.shift === 'NIGHT' ? <FaMoon /> : <FaSun />}</span>
        <div className="ops-thread-identity"><h3>{shift} shift</h3><span>{shiftTimes[thread.shift] || 'Operational checklist'}</span></div>
        <span className="ops-thread-status">{statuses[thread.status] || thread.status.replace(/_/g, ' ').toLowerCase()}</span>
      </div>
      <div className="ops-thread-progress-label"><span>Execution progress</span><strong>{Math.round(progress)}<small>%</small></strong></div>
      <div className="ops-thread-track" role="progressbar" aria-label={`${shift} shift execution`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
      <div className="ops-thread-metrics"><span><FaCheckCircle /> {thread.completed_items} / {thread.total_items} items</span><span className={thread.participant_count === 0 ? 'ops-thread-unstaffed' : ''}><FaUsers /> {thread.participant_count === 0 ? 'Awaiting operators' : `${thread.participant_count} operator${thread.participant_count === 1 ? '' : 's'}`}</span></div>
      <div className="ops-thread-footer"><span>{thread.user_joined ? <><FaCheckCircle /> You joined this shift</> : <><FaClock /> Shift workspace</>}</span><span className="ops-thread-open">Open checklist <FaArrowRight /></span></div>
    </Link>
  );
};
export default ChecklistCard;
