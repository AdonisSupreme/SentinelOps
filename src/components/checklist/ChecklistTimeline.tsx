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
          // Use template_item severity if available, otherwise fallback to item.severity or default
          const severity = (item as any).template_item?.severity ?? (item as any).severity ?? 3; 
          const severityColor = getSeverityColor(severity);
          
          // Determine status class
          const getStatusClass = (status: string) => {
            switch (status) {
              case 'COMPLETED': return 'completed';
              case 'IN_PROGRESS': return 'in-progress';
              case 'SKIPPED': return 'skipped';
              case 'FAILED': return 'failed';
              default: return '';
            }
          };
          
          const statusClass = getStatusClass(item.status);
          
          return (
            <div 
              key={item.id}
              className={`timeline-item ${isActive ? 'active' : ''} ${statusClass}`}
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
                    <h4>{(item as any).template_item?.title || (item as any).item?.title || 'Untitled Item'}</h4>
                    {getItemTypeIcon((item as any).template_item?.item_type || (item as any).item?.item_type || '')}
                    {(item as any).template_item?.scheduled_time && (
                      <span className="scheduled-time">
                        <FaClock /> {formatTime((item as any).template_item.scheduled_time)}
                      </span>
                    )}
                  </div>
                  <div className="item-meta">
                    {(item as any).template_item?.is_required && (
                      <span className="badge required">Required</span>
                    )}
                    {item.completed_by && (
                      <span className="completed-by">
                        by {item.completed_by.username}
                      </span>
                    )}
                  </div>
                </div>

                {(item as any).template_item?.description && (
                  <p className="item-description">{(item as any).template_item.description}</p>
                )}

                {item.notes && (
                  <div className="item-reason">
                    <span className="reason notes">Notes: {item.notes}</span>
                  </div>
                )}

                {item.completed_at && (
                  <div className="item-activity">
                    <FaComment />
                    <span>Completed at {new Date(item.completed_at).toLocaleTimeString()}</span>
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
