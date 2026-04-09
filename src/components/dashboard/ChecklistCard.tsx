import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardChecklistThread } from '../../services/checklistApi';
import {
  FaPlay,
  FaCheckCircle,
  FaClock,
  FaExclamationTriangle,
  FaUsers,
  FaCalendarAlt,
  FaArrowRight
} from 'react-icons/fa';
import './ChecklistCard.css';

interface ChecklistCardProps {
  thread: DashboardChecklistThread;
}

const ChecklistCard: React.FC<ChecklistCardProps> = ({ thread }) => {
  const totalItems = thread.total_items;
  const completedItems = thread.completed_items;
  const completionPercentage = totalItems > 0 ? thread.execution_percentage : 0;

  const getStatusIcon = () => {
    switch (thread.status) {
      case 'COMPLETED':
        return <FaCheckCircle className="status-icon completed" />;
      case 'IN_PROGRESS':
        return <FaPlay className="status-icon in-progress" />;
      case 'PENDING_REVIEW':
        return <FaClock className="status-icon pending" />;
      case 'COMPLETED_WITH_EXCEPTIONS':
        return <FaExclamationTriangle className="status-icon exception" />;
      default:
        return <FaClock className="status-icon open" />;
    }
  };

  const getStatusColor = () => {
    switch (thread.status) {
      case 'COMPLETED':
        return '#2ed573';
      case 'IN_PROGRESS':
        return '#00d9ff';
      case 'PENDING_REVIEW':
        return '#ffa502';
      case 'COMPLETED_WITH_EXCEPTIONS':
        return '#ff4757';
      default:
        return '#6b7280';
    }
  };

  const getStatusLabel = () => {
    switch (thread.status) {
      case 'COMPLETED':
        return 'Completed';
      case 'IN_PROGRESS':
        return 'In progress';
      case 'PENDING_REVIEW':
        return 'Pending review';
      case 'COMPLETED_WITH_EXCEPTIONS':
        return 'Exceptions tracked';
      default:
        return 'Open';
    }
  };

  const getShiftTime = (shift: string) => {
    switch (shift) {
      case 'MORNING':
        return '07:00 - 15:00';
      case 'AFTERNOON':
        return '15:00 - 23:00';
      case 'NIGHT':
        return '23:00 - 07:00';
      default:
        return '';
    }
  };

  return (
    <Link to={`/checklist/${thread.id}`} className="checklist-card-link">
      <div className="dsb-checklist-card">
        <div className="card-header">
          <div className="dc-status-indicator" style={{ backgroundColor: getStatusColor() }} />
          <div className="shift-info">
            <h3>{thread.shift} SHIFT</h3>
            <div className="dsb-shift-time">
              <FaCalendarAlt /> {getShiftTime(thread.shift)}
            </div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="card-body">
          <div className="progress-section">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${completionPercentage}%` }} />
            </div>
            <div className="progress-stats">
              <span className="percentage">{completionPercentage}%</span>
              <span className="items">
                {completedItems}/{totalItems} items
              </span>
            </div>
          </div>

          <div className="card-details">
            <div className="detail">
              <FaUsers />
              <span>{thread.participant_count} participants</span>
            </div>
            <div className="detail">
              <FaClock />
              <span>{getStatusLabel()}</span>
            </div>
          </div>
        </div>

        <div className="card-footer">
          <span className={`participation-badge ${thread.user_joined ? 'participant' : ''}`}>
            {thread.user_joined ? 'Joined' : 'Open'}
          </span>
          <FaArrowRight className="arrow-icon" />
        </div>
      </div>
    </Link>
  );
};

export default ChecklistCard;
