// src/components/dashboard/ChecklistCard.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { ChecklistInstance } from '../../services/checklistApi';
import { 
  FaPlay, FaCheckCircle, FaClock, FaExclamationTriangle, 
  FaUsers, FaCalendarAlt, FaArrowRight 
} from 'react-icons/fa';
import './ChecklistCard.css';

interface ChecklistCardProps {
  instance: ChecklistInstance;
}

const ChecklistCard: React.FC<ChecklistCardProps> = ({ instance }) => {
  const getStatusIcon = () => {
    switch (instance.status) {
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
    switch (instance.status) {
      case 'COMPLETED': return '#2ed573';
      case 'IN_PROGRESS': return '#00d9ff';
      case 'PENDING_REVIEW': return '#ffa502';
      case 'COMPLETED_WITH_EXCEPTIONS': return '#ff4757';
      default: return '#6b7280';
    }
  };

  const getShiftTime = (shift: string) => {
    switch (shift) {
      case 'MORNING': return '06:00 - 14:00';
      case 'AFTERNOON': return '14:00 - 22:00';
      case 'NIGHT': return '22:00 - 06:00';
      default: return '';
    }
  };

  const isUserParticipant = instance.participants.length > 0;

  return (
    <Link to={`/checklist/${instance.id}`} className="checklist-card-link">
      <div className="checklist-card">
        <div className="card-header">
          <div className="status-indicator" style={{ backgroundColor: getStatusColor() }} />
          <div className="shift-info">
            <h3>{instance.shift} SHIFT</h3>
            <div className="shift-time">
              <FaCalendarAlt /> {getShiftTime(instance.shift)}
            </div>
          </div>
          {getStatusIcon()}
        </div>

        <div className="card-body">
          <div className="progress-section">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${instance.statistics.completion_percentage}%` }}
              />
            </div>
            <div className="progress-stats">
              <span className="percentage">{instance.statistics.completion_percentage}%</span>
              <span className="items">
                {instance.statistics.completed_items}/{instance.statistics.total_items} items
              </span>
            </div>
          </div>

          <div className="card-details">
            <div className="detail">
              <FaUsers />
              <span>{instance.participants.length} operators</span>
            </div>
            <div className="detail">
              <FaClock />
              <span>{instance.statistics.time_remaining_minutes}m remaining</span>
            </div>
          </div>
        </div>

        <div className="card-footer">
          <span className={`participation-badge ${isUserParticipant ? 'participant' : ''}`}>
            {isUserParticipant ? '✓ Joined' : 'Join Now'}
          </span>
          <FaArrowRight className="arrow-icon" />
        </div>
      </div>
    </Link>
  );
};

export default ChecklistCard;