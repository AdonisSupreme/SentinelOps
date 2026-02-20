// src/components/checklist/EnhancedChecklistItem.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { 
  FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaClock,
  FaChevronDown, FaChevronUp, FaTasks, FaEye
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
  const [showSubitems, setShowSubitems] = useState(false); // Hidden by default
  const [expandedView, setExpandedView] = useState(false);

  // Extract subitems from the item
  const subitems = item.subitems || [];
  const hasSubitems = subitems.length > 0;

  // Calculate subitem statistics
  const subitemStats = {
    total: subitems.length,
    completed: subitems.filter((s: any) => s.status === 'COMPLETED').length,
    skipped: subitems.filter((s: any) => s.status === 'SKIPPED').length,
    failed: subitems.filter((s: any) => s.status === 'FAILED').length,
    pending: subitems.filter((s: any) => s.status === 'PENDING').length,
    inProgress: subitems.filter((s: any) => s.status === 'IN_PROGRESS').length
  };

  // Calculate progress including all actioned items (COMPLETED + SKIPPED + FAILED)
  const actionedCount = subitemStats.completed + subitemStats.skipped + subitemStats.failed;
  const completionPercentage = subitemStats.total > 0 ? Math.round((actionedCount / subitemStats.total) * 100) : 0;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <FaCheckCircle className="status-icon completed" />;
      case 'IN_PROGRESS': return <FaPlay className="status-icon in-progress" />;
      case 'SKIPPED': return <FaBan className="status-icon skipped" />;
      case 'FAILED': return <FaExclamationTriangle className="status-icon failed" />;
      default: return <FaClock className="status-icon pending" />;
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

  const handleItemClick = () => {
    // Don't show subitems automatically - only when user clicks View button
    if (hasSubitems) {
      // If item has subitems and is in progress, trigger subitem modal
      if (item.status === 'IN_PROGRESS') {
        onItemAction(item.id, item);
      } else {
        // Otherwise, trigger item actions modal via parent
        onItemActionsClick(item);
      }
    } else {
      // No subitems, trigger item actions modal via parent
      onItemActionsClick(item);
    }
  };

  const handleSubitemAction = async (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL', notes?: string) => {
    try {
      await updateItemStatus(instanceId, item.id, 'IN_PROGRESS', `Working on subitem: ${subitemId}`);
      
      // Call the subitem action through the context
      // This will be handled by the SubitemTimeline component
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
    <div className="enhanced-checklist-item futuristic">
      {/* Main item header */}
      <div 
        className={`item-header ${item.status.toLowerCase()} ${hasSubitems ? 'has-subitems' : ''}`}
        onClick={handleItemClick}
      >
        <div className="item-main-info">
          <div className="status-indicator">
            {getStatusIcon(item.status)}
          </div>
          
          <div className="item-content">
            <h3 className="item-title">{item.title || item.template_item?.title}
              {/* Status overlay for completed items */}
              {item.status === 'COMPLETED' && (
                <div className="it-completion-overlay">
                  <div className="completion-info">
                    <FaCheckCircle className="completion-icon" />
                    <div>
                      <strong>Completed </strong>
                      {item.completed_at && (
                        <span className="it-completion-time">
                          at {new Date(item.completed_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                    </div>
                </div>
              )}
            </h3>
            {item.description && (
              <p className="item-description">{item.description}</p>
            )}
            
            <div className="item-metadata">
              <span className="type-badge">{item.item_type || item.template_item?.item_type}</span>
              {item.severity && (
                <span className="severity-indicator">
                  {'⚠'.repeat(item.severity)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="item-controls">
          {/* Subitems progress indicator */}
          {hasSubitems && (
            <div className="subitems-progress">
              <div className="progress-ring">
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
                    className="progress-circle"
                  />
                </svg>
                <div className="progress-text">{completionPercentage}%</div>
              </div>
              <div className="progress-stats">
                <span className="stat">{subitemStats.completed}/{subitemStats.total}</span>
                <span className="label">subitems</span>
              </div>
            </div>
          )}

          {/* Expand/collapse button */}
          {hasSubitems && (
            <button 
              className="expand-btn"
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

      {/* Subitems timeline section */}
      {hasSubitems && showSubitems && (
        <div className="subitems-section">
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
