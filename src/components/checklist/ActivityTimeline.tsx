// src/components/checklist/ActivityTimeline.tsx
import React from 'react';
import { ItemActivity } from '../../services/checklistApi';
import { 
  FaPlay, FaCheckCircle, FaBan, FaExclamationTriangle, 
  FaClock, FaUser, FaComment, FaArrowRight 
} from 'react-icons/fa';
import './ActivityTimeline.css';

interface ActivityTimelineProps {
  activities: ItemActivity[];
  showItemDetails?: boolean;
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ 
  activities, 
  showItemDetails = false 
}) => {
  const getActionIcon = (action: ItemActivity['action']) => {
    switch (action) {
      case 'STARTED':
        return <FaPlay className="activity-icon started" />;
      case 'COMPLETED':
        return <FaCheckCircle className="activity-icon completed" />;
      case 'SKIPPED':
        return <FaBan className="activity-icon skipped" />;
      case 'FAILED':
        return <FaExclamationTriangle className="activity-icon failed" />;
      case 'ESCALATED':
        return <FaExclamationTriangle className="activity-icon escalated" />;
      case 'UPDATED':
        return <FaArrowRight className="activity-icon updated" />;
      default:
        return <FaClock className="activity-icon default" />;
    }
  };

  const getActionLabel = (action: ItemActivity['action']) => {
    switch (action) {
      case 'STARTED':
        return 'Started Working';
      case 'COMPLETED':
        return 'Completed';
      case 'SKIPPED':
        return 'Skipped';
      case 'FAILED':
        return 'Failed';
      case 'ESCALATED':
        return 'Escalated';
      case 'UPDATED':
        return 'Updated';
      default:
        return action;
    }
  };

  const formatDuration = (durationMs?: number) => {
    if (!durationMs) return '';
    
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffMins < 1440) {
      const hours = Math.floor(diffMins / 60);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  if (!activities || activities.length === 0) {
    return (
      <div className="activity-timeline empty">
        <div className="empty-state">
          <FaClock className="empty-icon" />
          <p>No activity recorded yet</p>
        </div>
      </div>
    );
  }

  const sortedActivities = [...activities]
    .filter(activity => activity && activity.actor) // Filter out activities without actors
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  if (sortedActivities.length === 0) {
    return (
      <div className="activity-timeline empty">
        <div className="empty-state">
          <FaClock className="empty-icon" />
          <p>No valid activities to display</p>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-timeline">
      <div className="timeline-header">
        <h3>Activity History</h3>
        <span className="activity-count">{sortedActivities.length} action{sortedActivities.length > 1 ? 's' : ''}</span>
      </div>
      
      <div className="timeline-items">
        {sortedActivities.map((activity, index) => (
          <div key={activity.id} className="timeline-item">
            <div className="timeline-marker">
              {getActionIcon(activity.action)}
            </div>
            
            <div className="timeline-content">
              <div className="activity-header">
                <div className="action-info">
                  <span className="action-label">{getActionLabel(activity.action)}</span>
                  {activity.metadata?.previous_status && activity.metadata?.new_status && (
                    <span className="status-change">
                      {activity.metadata.previous_status} → {activity.metadata.new_status}
                    </span>
                  )}
                </div>
                <div className="activity-meta">
                  <span className="timestamp" title={new Date(activity.timestamp).toLocaleString()}>
                    {formatTimestamp(activity.timestamp)}
                  </span>
                  {activity.metadata?.duration_ms && (
                    <span className="duration">
                      {formatDuration(activity.metadata.duration_ms)}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="activity-details">
                <div className="actor-info">
                  <FaUser className="actor-icon" />
                  <span className="actor-name">
                    {activity.actor?.username || 'Unknown User'}
                  </span>
                </div>
                
                {activity.notes && (
                  <div className="activity-notes">
                    <FaComment className="notes-icon" />
                    <p>{activity.notes}</p>
                  </div>
                )}
                
                {activity.metadata?.reason && (
                  <div className="activity-reason">
                    <strong>Reason:</strong> {activity.metadata.reason}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;
