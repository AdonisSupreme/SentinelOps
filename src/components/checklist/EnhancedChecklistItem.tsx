// src/components/checklist/EnhancedChecklistItem.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import {
  FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaClock,
  FaChevronDown, FaChevronUp, FaHistory, FaUser
} from 'react-icons/fa';
import SubitemTimeline from './SubitemTimeline';
import './EnhancedChecklistItem.css';
import './EnhancedChecklistItemModal.css';

interface EnhancedChecklistItemProps {
  instanceId: string;
  item: any;
  inspectionMode: boolean;
  currentTime: number;
  onItemAction: (itemId: string, item: any) => void;
  onItemComplete: () => void;
  onItemActionsClick: (item: any) => void;
}

const EnhancedChecklistItem: React.FC<EnhancedChecklistItemProps> = ({
  instanceId,
  item,
  inspectionMode,
  currentTime,
  onItemAction,
  onItemComplete,
  onItemActionsClick
}) => {
  const { updateItemStatus } = useChecklist();
  const [showSubitems, setShowSubitems] = useState(false);
  const [expandedView, setExpandedView] = useState(false);

  const subitems = item.subitems || [];
  const hasSubitems = subitems.length > 0;

  const subitemStats = {
    total: subitems.length,
    completed: subitems.filter((s: any) => s.status === 'COMPLETED').length,
    skipped: subitems.filter((s: any) => s.status === 'SKIPPED').length,
    failed: subitems.filter((s: any) => s.status === 'FAILED').length,
    pending: subitems.filter((s: any) => s.status === 'PENDING').length,
    inProgress: subitems.filter((s: any) => s.status === 'IN_PROGRESS').length
  };

  const actionedCount = subitemStats.completed + subitemStats.skipped + subitemStats.failed;
  const completionPercentage = subitemStats.total > 0
    ? Math.round((actionedCount / subitemStats.total) * 100)
    : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <FaCheckCircle className="eci-status-icon eci-status-icon--completed" />;
      case 'IN_PROGRESS':
        return <FaPlay className="eci-status-icon eci-status-icon--in-progress" />;
      case 'SKIPPED':
        return <FaBan className="eci-status-icon eci-status-icon--skipped" />;
      case 'FAILED':
        return <FaExclamationTriangle className="eci-status-icon eci-status-icon--failed" />;
      default:
        return <FaClock className="eci-status-icon eci-status-icon--pending" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#10b981';
      case 'IN_PROGRESS': return '#3b82f6';
      case 'SKIPPED': return '#f59e0b';
      case 'FAILED': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatScheduledTime = (value?: string | null) => {
    if (!value) {
      return null;
    }

    return new Date(`2000-01-01T${value}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatExecutionTime = (startedAt?: string | null, completedAt?: string | null) => {
    if (!startedAt) {
      return null;
    }

    const startTime = new Date(startedAt).getTime();
    const endTime = completedAt ? new Date(completedAt).getTime() : currentTime;
    if (Number.isNaN(startTime) || Number.isNaN(endTime) || endTime < startTime) {
      return null;
    }

    const totalSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const getScheduledEventSummary = () => {
    const scheduledEvents = item.scheduled_events || item.template_item?.scheduled_events || [];
    if (!Array.isArray(scheduledEvents) || scheduledEvents.length === 0) {
      return null;
    }

    const sortedEvents = [...scheduledEvents].sort(
      (left, right) => new Date(left.event_datetime).getTime() - new Date(right.event_datetime).getTime()
    );
    const now = Date.now();
    const nextUpcoming = sortedEvents.find((scheduledEvent) => new Date(scheduledEvent.event_datetime).getTime() >= now);
    const referenceEvent = nextUpcoming || sortedEvents[sortedEvents.length - 1];
    const isOverdue = !nextUpcoming && item.status !== 'COMPLETED';

    return {
      count: sortedEvents.length,
      nextLabel: new Date(referenceEvent.event_datetime).toLocaleString(),
      notifyBeforeMinutes: referenceEvent.notify_before_minutes,
      isOverdue,
    };
  };

  const renderSeverity = (severity: number) => (
    Array.from({ length: Math.max(0, severity) }, (_, index) => (
      <FaExclamationTriangle
        key={`severity-${item.id}-${index}`}
        className="eci-severity-icon"
        aria-hidden="true"
      />
    ))
  );

  const handleItemClick = () => {
    if (hasSubitems) {
      if (item.status === 'IN_PROGRESS') {
        onItemAction(item.id, item);
      } else {
        onItemActionsClick(item);
      }
    } else {
      onItemActionsClick(item);
    }
  };

  const handleSubitemAction = async (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL', notes?: string) => {
    try {
      await updateItemStatus(instanceId, item.id, 'IN_PROGRESS', `Working on subitem: ${subitemId}`);
      console.log(`Subitem action: ${action} on ${subitemId}`, notes);
    } catch (error) {
      console.error('Failed to perform subitem action:', error);
    }
  };

  const handleCompleteItem = async () => {
    try {
      await updateItemStatus(instanceId, item.id, 'COMPLETED', 'All subitems completed');
      onItemComplete();
    } catch (error) {
      console.error('Failed to complete item:', error);
    }
  };

  const itemType = item.item_type || item.template_item?.item_type || 'ROUTINE';
  const itemDescription = item.description || item.template_item?.description;
  const scheduledTime = item.scheduled_time ?? item.template_item?.scheduled_time;
  const notifyBeforeMinutes = item.notify_before_minutes ?? item.template_item?.notify_before_minutes;
  const scheduledEventSummary = getScheduledEventSummary();
  const inspectionActivities = Array.isArray(item.activities)
    ? [...item.activities]
        .filter((activity: any) => activity?.timestamp)
        .sort(
          (left: any, right: any) =>
            new Date(right.timestamp || '').getTime() - new Date(left.timestamp || '').getTime()
        )
    : [];
  const hasExecutionTime = Boolean(item.has_exe_time ?? item.template_item?.has_exe_time);
  const executionTime = hasExecutionTime
    ? formatExecutionTime(item.started_at, item.completed_at)
    : null;

  const getActivityLabel = (action: string) => {
    switch (action) {
      case 'STARTED':
        return 'Started';
      case 'COMPLETED':
        return 'Completed';
      case 'SKIPPED':
        return 'Skipped';
      case 'FAILED':
      case 'ESCALATED':
        return 'Escalated';
      default:
        return action;
    }
  };

  return (
    <div className="eci-card eci-card--futuristic">
      <div
        className={`eci-header eci-header--${item.status.toLowerCase()} ${hasSubitems ? 'eci-header--has-subitems' : ''}`}
        onClick={handleItemClick}
      >
        <div className="eci-main-info">
          <div className="eci-status-indicator">
            {getStatusIcon(item.status)}
          </div>

          <div className="eci-content">
            <h3 className="eci-title">
              {item.title || item.template_item?.title}
              {item.status === 'COMPLETED' && (
                <div className="eci-completion-overlay">
                  <div className="eci-completion-info">
                    <FaCheckCircle className="eci-completion-icon" />
                    <div>
                      <strong>Completed </strong>
                      {item.completed_at && (
                        <span className="eci-completion-time">
                          at {new Date(item.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </h3>

            {itemDescription && (
              <p className="eci-description">{itemDescription}</p>
            )}

            <div className="eci-metadata">
              <span className="eci-type-badge">{itemType}</span>
              {item.severity && (
                <span className="eci-severity-indicator">{renderSeverity(item.severity)}</span>
              )}
              {itemType === 'TIMED' && scheduledTime && (
                <span className="eci-type-badge">
                  <FaClock /> {formatScheduledTime(scheduledTime)}
                </span>
              )}
              {itemType === 'TIMED' && typeof notifyBeforeMinutes === 'number' && (
                <span className="eci-type-badge">Reminder {notifyBeforeMinutes}m</span>
              )}
              {itemType === 'SCHEDULED_EVENT' && scheduledEventSummary && (
                <>
                  <span className="eci-type-badge">{scheduledEventSummary.count} events</span>
                  <span className="eci-type-badge">
                    {scheduledEventSummary.isOverdue ? 'Overdue since' : 'Next'} {scheduledEventSummary.nextLabel}
                  </span>
                  <span className="eci-type-badge">
                    Reminder {scheduledEventSummary.notifyBeforeMinutes}m
                  </span>
                </>
              )}
              {itemType === 'CONDITIONAL' && (
                <span className="eci-type-badge">Manual only</span>
              )}
              {itemType === 'INFORMATIONAL' && (
                <span className="eci-type-badge">Visibility only</span>
              )}
              {hasExecutionTime && executionTime && (
                <span className="eci-type-badge eci-type-badge--execution">
                  Execution {executionTime}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="eci-controls">
          {hasSubitems && (
            <div className="eci-subitems-progress">
              <div className="eci-progress-ring">
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke="#1f2937"
                    strokeWidth="3"
                  />
                  <circle
                    cx="20"
                    cy="20"
                    r="16"
                    fill="none"
                    stroke={getStatusColor(item.status)}
                    strokeWidth="3"
                    strokeDasharray={`${completionPercentage * 1.005} 100.5`}
                    transform="rotate(-90 20 20)"
                    className="eci-progress-circle"
                  />
                </svg>
                <div className="eci-progress-text">{completionPercentage}%</div>
              </div>
              <div className="eci-progress-stats">
                <span className="eci-progress-stat">{subitemStats.completed}/{subitemStats.total}</span>
                <span className="eci-progress-label">subitems</span>
              </div>
            </div>
          )}

          {hasSubitems && (
            <button
              className="eci-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                setExpandedView(!expandedView);
                setShowSubitems(!showSubitems);
              }}
            >
              {expandedView ? <FaChevronUp /> : <FaChevronDown />}
            </button>
          )}
        </div>
      </div>

      {inspectionMode && inspectionActivities.length > 0 && (
        <div className="eci-inspection-section">
          <div className="eci-activity-panel">
            <div className="eci-activity-panel-header">
              <span className="eci-activity-panel-title">
                <FaHistory />
                Inspection Trail
              </span>
              <span className="eci-activity-panel-count">
                {inspectionActivities.length} logged action{inspectionActivities.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="eci-activity-list">
              {inspectionActivities.map((activity: any) => (
                <div
                  key={activity.id}
                  className={`eci-activity-entry eci-activity-entry--${String(activity.action || '').toLowerCase()}`}
                >
                  <div className="eci-activity-entry-main">
                    <span className="eci-activity-entry-action">{getActivityLabel(activity.action)}</span>
                    <span className="eci-activity-entry-actor">
                      <FaUser />
                      {activity.actor?.username || 'Unknown user'}
                    </span>
                    <span className="eci-activity-entry-time">
                      {new Date(activity.timestamp || '').toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  {activity.notes && (
                    <div className="eci-activity-entry-note">{activity.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {hasSubitems && showSubitems && (
        <div className="eci-subitems-section">
          <SubitemTimeline
            subitems={subitems}
            itemId={item.id}
            instanceId={instanceId}
            currentTime={currentTime}
            onSubitemAction={handleSubitemAction}
            onCompleteItem={handleCompleteItem}
            isExpanded={showSubitems}
            onToggleExpand={() => setShowSubitems(!showSubitems)}
            isItemCompleted={item.status === 'COMPLETED'}
          />
        </div>
      )}
    </div>
  );
};

export default EnhancedChecklistItem;
