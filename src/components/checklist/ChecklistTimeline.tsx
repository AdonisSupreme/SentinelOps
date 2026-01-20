// src/components/checklist/ChecklistTimeline.tsx
import React from 'react';
import { ChecklistItemInstance } from '../../services/checklistApi';
import { 
  FaCheckCircle, FaPlay, FaClock, FaExclamationTriangle, 
  FaBan, FaComment, FaFlag, FaBell 
} from 'react-icons/fa';
import './ChecklistTimeline.css';

interface ChecklistTimelineProps {
  items: ChecklistItemInstance[];
  activeItemId: string | null;
  onItemClick: (itemId: string) => void;
}

const ChecklistTimeline: React.FC<ChecklistTimelineProps> = ({ items, activeItemId, onItemClick }) => {
  const getItemIcon = (item: ChecklistItemInstance) => {
    switch (item.status) {
      case 'COMPLETED':
        return <FaCheckCircle className="timeline-icon completed" />;
      case 'IN_PROGRESS':
        return <FaPlay className="timeline-icon in-progress" />;
      case 'FAILED':
        return <FaExclamationTriangle className="timeline-icon failed" />;
      case 'SKIPPED':
        return <FaBan className="timeline-icon skipped" />;
      default:
        return <FaClock className="timeline-icon pending" />;
    }
  };

  const getItemTypeIcon = (itemType: string) => {
    switch (itemType) {
      case 'TIMED':
        return <FaBell className="item-type-icon timed" />;
      case 'SCHEDULED_EVENT':
        return <FaFlag className="item-type-icon scheduled" />;
      case 'CONDITIONAL':
        return <FaComment className="item-type-icon conditional" />;
      default:
        return null;
    }
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '';
    const date = new Date(`2000-01-01T${timeString}`);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (severity: number) => {
    switch (severity) {
      case 5: return '#ff4757';
      case 4: return '#ffa502';
      case 3: return '#00d9ff';
      case 2: return '#2ed573';
      default: return '#6b7280';
    }
  };

  return (
    <div className="checklist-timeline">
      <div className="timeline-track">
        <div className="timeline-line"></div>
        
        {items.map((item, index) => {
          const isActive = activeItemId === item.id;
          const severityColor = getSeverityColor(item.template_item.severity);
          
          return (
            <div 
              key={item.id}
              className={`timeline-item ${isActive ? 'active' : ''}`}
              onClick={() => onItemClick(item.id)}
            >
              <div className="timeline-point" style={{ borderColor: severityColor }}>
                <div 
                  className="severity-indicator" 
                  style={{ backgroundColor: severityColor }}
                />
                {getItemIcon(item)}
              </div>

              <div className="timeline-content">
                <div className="content-header">
                  <div className="item-title">
                    <h4>{item.template_item.title}</h4>
                    {getItemTypeIcon(item.template_item.item_type)}
                    {item.template_item.scheduled_time && (
                      <span className="scheduled-time">
                        <FaClock /> {formatTime(item.template_item.scheduled_time)}
                      </span>
                    )}
                  </div>
                  <div className="item-meta">
                    {item.template_item.is_required && (
                      <span className="badge required">Required</span>
                    )}
                    {item.completed_by && (
                      <span className="completed-by">
                        by {item.completed_by.username}
                      </span>
                    )}
                  </div>
                </div>

                {item.template_item.description && (
                  <p className="item-description">{item.template_item.description}</p>
                )}

                {(item.skipped_reason || item.failure_reason) && (
                  <div className="item-reason">
                    {item.skipped_reason && (
                      <span className="reason skipped">Skipped: {item.skipped_reason}</span>
                    )}
                    {item.failure_reason && (
                      <span className="reason failed">Failed: {item.failure_reason}</span>
                    )}
                  </div>
                )}

                {item.activities.length > 0 && (
                  <div className="item-activity">
                    <FaComment />
                    <span>{item.activities.length} activity log(s)</span>
                  </div>
                )}

                {isActive && (
                  <div className="active-indicator">
                    <div className="pulse-ring"></div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChecklistTimeline;