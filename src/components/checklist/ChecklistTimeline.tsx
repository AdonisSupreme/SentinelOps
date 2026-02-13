// src/components/checklist/ChecklistTimeline.tsx
import React, { useState } from 'react';
import { ChecklistItemInstance } from '../../services/checklistApi';
import { 
  FaCheckCircle, FaPlay, FaClock, FaExclamationTriangle, 
  FaBan, FaComment, FaFlag, FaBell, FaUser, FaHistory
} from 'react-icons/fa';
import ActivityTimeline from './ActivityTimeline';
import { useAuth } from '../../contexts/AuthContext';
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
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  
  const toggleActivityTimeline = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const getActivitySummary = (activities: any[]) => {
    if (!activities || activities.length === 0) return null;
    
    const latestActivity = activities[activities.length - 1];
    const activityCount = activities.length;
    
    return {
      latest: latestActivity,
      count: activityCount,
      hasMultiple: activityCount > 1
    };
  };
  // Debug logging to understand data structure
  console.log('🔍 ChecklistTimeline Debug - Items received:', {
    itemsCount: items?.length || 0,
    firstItem: items?.[0],
    firstItemTitle: items?.[0]?.title || items?.[0]?.template_item?.title,
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
          // Use item severity if available, otherwise fallback to template_item
          const severity = item.severity ?? item.template_item?.severity ?? 3; 
          const severityColor = getSeverityColor(severity);
          const scheduledTime = item.scheduled_time ?? item.template_item?.scheduled_time;
          
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
              className={`timeline-item ${isActive ? 'active' : ''} ${statusClass} ${deadlineWarningClass} capacity`}
              onClick={() => onItemClick(item.id)}
            >
              <div className="card-ambient"></div>
              <div className="card-border"></div>
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
                    <h4>{item.title || item.template_item?.title || 'Untitled Item'}</h4>
                    {getItemTypeIcon(item.item_type || item.template_item?.item_type || '')}
                    {(item.scheduled_time ?? item.template_item?.scheduled_time) && (
                      <span className={`scheduled-time ${isOverdue ? 'overdue' : ''}`}>
                        <FaClock /> {formatTime((item.scheduled_time ?? item.template_item?.scheduled_time)!)}
                        {isOverdue && <span className="overdue-badge">OVERDUE</span>}
                      </span>
                    )}
                  </div>
                  <div className="item-meta">
                    {(item.is_required ?? item.template_item?.is_required) && (
                      <span className="badge required">Required</span>
                    )}
                    {item.completed_by && (
                      <span className={`completed-by ${item.completed_by.username === user?.username ? 'current-user' : ''}`}>
                        <FaUser /> {item.completed_by.username || 'Unknown User'}
                      </span>
                    )}
                    {item.completed_at && (
                      <span className={`completed-time ${item.completed_by?.username === user?.username ? 'current-user' : ''}`}>
                        <FaClock /> {new Date(item.completed_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {(item.description ?? item.template_item?.description) && (
                  <p className="item-description">{item.description || item.template_item?.description}</p>
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
                      {item.completed_by.username === user?.username && (
                        <span style={{ 
                          marginLeft: '0.5rem', 
                          color: '#00d9ff', 
                          fontWeight: '600',
                          fontSize: '0.7rem'
                        }}>
                          ⚡ You
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
              
              {/* Inline Activity Indicator */}
              {item.activities && item.activities.length > 0 && (
                <div 
                  className="activity-indicator"
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleActivityTimeline(item.id);
                  }}
                >
                  <div className="activity-chip">
                    <FaHistory className="activity-icon" />
                    <span className="activity-count">{item.activities.length}</span>
                  </div>
                  
                  {hoveredItem === item.id && !expandedItems.has(item.id) && (
                    <div className="activity-preview">
                      <div className="preview-header">
                        <span className="preview-title">Recent Activity</span>
                        <span className="preview-time">
                          {new Date(item.activities[item.activities.length - 1].timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className="preview-content">
                        <span className="preview-action">
                          {item.activities[item.activities.length - 1].action}
                        </span>
                        <span className="preview-actor">
                          by {item.activities[item.activities.length - 1].actor?.username || 'system'}
                        </span>
                        {item.activities[item.activities.length - 1].notes && (
                          <span className="preview-notes">
                            "{item.activities[item.activities.length - 1].notes}"
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              {expandedItems.has(item.id) && (
                <div className="activity-timeline-wrapper">
                  <ActivityTimeline 
                    activities={item.activities || []} 
                    showItemDetails={false}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChecklistTimeline;
