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
  const completedItems = instance.items.filter(item => item.status === 'COMPLETED').length;
  const actionedItems = instance.items.filter(item => ['COMPLETED', 'SKIPPED', 'FAILED'].includes(item.status)).length;
  const totalItems = instance.items.length;
  const completionPercentage = totalItems > 0 ? Math.round((actionedItems / totalItems) * 100) : 0;

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
      case 'MORNING': return '07:00 - 15:00';
      case 'AFTERNOON': return '15:00 - 23:00';
      case 'NIGHT': return '23:00 - 07:00';
      default: return '';
    }
  };

  const isUserParticipant = instance.participants.length > 0;

  return (
    <Link to={`/checklist/${instance.id}`} className="checklist-card-link">
      <div className="dsb-checklist-card">
        <div className="card-header">
          <div className="dc-status-indicator" style={{ backgroundColor: getStatusColor() }} />
          <div className="shift-info">
            <h3>{instance.shift} SHIFT</h3>
            <div className="dsb-shift-time">
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
                style={{ width: `${completionPercentage}%` }}
              />
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
              <span>{instance.participants.length} participants</span>
            </div>
            <div className="detail">
              <FaClock />
              <span>Active</span>
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