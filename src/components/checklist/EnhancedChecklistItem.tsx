// src/components/checklist/EnhancedChecklistItem.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import {
  FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaClock,
  FaChevronDown, FaChevronUp
} from 'react-icons/fa';
import SubitemTimeline from './SubitemTimeline';
import './EnhancedChecklistItem.css';
import './EnhancedChecklistItemModal.css';

interface EnhancedChecklistItemProps {
  instanceId: string;
  item: any;
  onItemAction: (itemId: string, item: any) => void;
  onItemComplete: () => void;
  onItemActionsClick: (item: any) => void;
}

const EnhancedChecklistItem: React.FC<EnhancedChecklistItemProps> = ({
  instanceId,
  item,
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

            {item.description && (
              <p className="eci-description">{item.description}</p>
            )}

            <div className="eci-metadata">
              <span className="eci-type-badge">{item.item_type || item.template_item?.item_type}</span>
              {item.severity && (
                <span className="eci-severity-indicator">{renderSeverity(item.severity)}</span>
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

      {hasSubitems && showSubitems && (
        <div className="eci-subitems-section">
          <SubitemTimeline
            subitems={subitems}
            itemId={item.id}
            instanceId={instanceId}
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
