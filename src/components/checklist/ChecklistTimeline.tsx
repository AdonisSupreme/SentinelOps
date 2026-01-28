// src/components/checklist/ChecklistTimeline.tsx
import React from 'react';
import { ChecklistItemInstance } from '../../services/checklistApi';
import { 
  FaCheckCircle, FaPlay, FaClock, FaExclamationTriangle, 
  FaBan, FaComment, FaFlag, FaBell, FaUser
} from 'react-icons/fa';
import './ChecklistTimeline.css';

interface ChecklistTimelineProps {
  items: ChecklistItemInstance[];
  activeItemId: string | null;
  onItemClick: (itemId: string) => void;
  currentTime?: Date;
}

const ChecklistTimeline: React.FC<ChecklistTimelineProps> = ({ 
  items, 
  onItemClick, 
  activeItemId,
  currentTime = new Date()
}) => {
  // Debug logging to understand data structure
  console.log('🔍 ChecklistTimeline Debug - Items received:', {
    itemsCount: items?.length || 0,
    firstItem: items?.[0],
    firstItemTitle: items?.[0]?.template_item?.title,
    firstItemStructure: items?.[0] ? Object.keys(items[0]) : [],
    firstItemItemStructure: items?.[0]?.template_item ? Object.keys(items[0].template_item) : [],
    hasItemProperty: !!(items?.[0]?.template_item),
    sampleData: items?.slice(0, 2)
  });

  console.log("INSTANCE ITEM: ", items);

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

  const checkDeadlineWarning = (scheduledTime: string | null | undefined, status: string) => {
    if (!scheduledTime || status === 'COMPLETED') return false;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const scheduledDateTime = new Date(today.toDateString() + ' ' + scheduledTime);
    
    // Check if current time is past the scheduled time
    return now > scheduledDateTime;
  };

  const getDeadlineWarningClass = (scheduledTime: string | null | undefined, status: string) => {
    if (checkDeadlineWarning(scheduledTime, status)) {
      return 'deadline-warning';
    }
    return '';
  };

  return (
    <div className="checklist-timeline">
      <div className="timeline-track">
        <div className="timeline-line"></div>
        
        {items.map((item, index) => {
          const isActive = activeItemId === item.id;
          // Use item.template_item severity if available, otherwise fallback to default
          const severity = item.template_item?.severity ?? 3; 
          const severityColor = getSeverityColor(severity);
          const scheduledTime = item.template_item?.scheduled_time;
          
          // Determine status class
          const getStatusClass = (status: string) => {
            switch (status) {
              case 'COMPLETED': return 'completed';
              case 'IN_PROGRESS': return 'in-progress';
              case 'SKIPPED': return 'skipped';
              default: return '';
            }
          };
          
          const statusClass = getStatusClass(item.status);
          const deadlineWarningClass = getDeadlineWarningClass(scheduledTime, item.status);
          const isOverdue = checkDeadlineWarning(scheduledTime, item.status);
          
          return (
            <div 
              key={item.id}
              className={`timeline-item ${isActive ? 'active' : ''} ${statusClass} ${deadlineWarningClass}`}
              onClick={() => onItemClick(item.id)}
            >
              <div className="timeline-point" style={{ borderColor: severityColor }}>
                <div 
                  className="severity-indicator" 
                  style={{ backgroundColor: severityColor }}
                />
                {getItemIcon(item)}
                {isOverdue && (
                  <div className="deadline-warning-icon">
                    <FaExclamationTriangle />
                  </div>
                )}
              </div>

              <div className="timeline-content">
                <div className="content-header">
                  <div className="item-title">
                    <h4>{item.template_item?.title || 'Untitled Item'}</h4>
                    {getItemTypeIcon(item.template_item?.item_type || '')}
                    {item.template_item?.scheduled_time && (
                      <span className={`scheduled-time ${isOverdue ? 'overdue' : ''}`}>
                        <FaClock /> {formatTime(item.template_item.scheduled_time)}
                        {isOverdue && <span className="overdue-badge">OVERDUE</span>}
                      </span>
                    )}
                  </div>
                  <div className="item-meta">
                    {item.template_item?.is_required && (
                      <span className="badge required">Required</span>
                    )}
                    {item.completed_by && (
                      <span className={`completed-by ${item.completed_by.username === 'ashumba' ? 'ashumba' : ''}`}>
                        <FaUser /> {item.completed_by.username || 'Unknown User'}
                      </span>
                    )}
                    {item.completed_at && (
                      <span className={`completed-time ${item.completed_by?.username === 'ashumba' ? 'ashumba' : ''}`}>
                        <FaClock /> {new Date(item.completed_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {item.template_item?.description && (
                  <p className="item-description">{item.template_item.description}</p>
                )}

                {item.notes && (
                  <div className="item-reason">
                    <span className="reason notes">Notes: {item.notes}</span>
                  </div>
                )}

                {item.completed_at && item.completed_by && (
                  <div className="item-activity">
                    <FaCheckCircle className="completion-icon" />
                    <span>
                      Completed by <strong>{item.completed_by.username}</strong> at {new Date(item.completed_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                      {item.completed_by.username === 'ashumba' && (
                        <span style={{ 
                          marginLeft: '0.5rem', 
                          color: '#00d9ff', 
                          fontWeight: '600',
                          fontSize: '0.7rem'
                        }}>
                          ⚡ Senior Operator
                        </span>
                      )}
                    </span>
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
