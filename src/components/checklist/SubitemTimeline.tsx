// src/components/checklist/SubitemTimeline.tsx
import React, { useState } from 'react';
import { 
  FaCheckCircle, FaBan, FaExclamationTriangle, FaClock, 
  FaPlay, FaUser, FaComment, FaArrowRight,
  FaChevronDown, FaChevronUp, FaTasks, FaHistory
} from 'react-icons/fa';
import './SubitemTimeline.css';

interface Subitem {
  id: string;
  title: string;
  description: string;
  item_type: string;
  is_required: boolean;
  severity: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  completed_by?: {
    id: string;
    username: string;
  } | null;
  completed_at: string | null;
  skipped_reason: string | null;
  failure_reason: string | null;
}

interface SubitemTimelineProps {
  subitems: Subitem[];
  itemId: string;
  instanceId: string;
  onSubitemAction: (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL', notes?: string) => Promise<void>;
  onCompleteItem: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isItemCompleted?: boolean;
}

const SubitemTimeline: React.FC<SubitemTimelineProps> = ({
  subitems,
  itemId,
  instanceId,
  onSubitemAction,
  onCompleteItem,
  isExpanded = true,
  onToggleExpand,
  isItemCompleted = false
}) => {
  const [selectedSubitem, setSelectedSubitem] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<{ [key: string]: string }>({});
  const [showActions, setShowActions] = useState<{ [key: string]: boolean }>({});
  const [hoveredSubitem, setHoveredSubitem] = useState<string | null>(null);
  const [expandedSubitems, setExpandedSubitems] = useState<Set<string>>(new Set());

  // Calculate subitem statistics
  const stats = {
    total: subitems.length,
    completed: subitems.filter(s => s.status === 'COMPLETED').length,
    skipped: subitems.filter(s => s.status === 'SKIPPED').length,
    failed: subitems.filter(s => s.status === 'FAILED').length,
    pending: subitems.filter(s => s.status === 'PENDING').length,
    inProgress: subitems.filter(s => s.status === 'IN_PROGRESS').length
  };

  // Calculate progress including all actioned items (COMPLETED + SKIPPED + FAILED)
  const actionedCount = stats.completed + stats.skipped + stats.failed;
  const completionPercentage = stats.total > 0 ? Math.round((actionedCount / stats.total) * 100) : 0;
  const allActioned = stats.pending === 0 && stats.inProgress === 0;

  // Activity indicator functions
  const toggleActivityPreview = (subitemId: string) => {
    const newExpanded = new Set(expandedSubitems);
    if (newExpanded.has(subitemId)) {
      newExpanded.delete(subitemId);
    } else {
      newExpanded.add(subitemId);
    }
    setExpandedSubitems(newExpanded);
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <FaCheckCircle className="status-icon completed" />;
      case 'SKIPPED': return <FaBan className="status-icon skipped" />;
      case 'FAILED': return <FaExclamationTriangle className="status-icon failed" />;
      case 'IN_PROGRESS': return <FaPlay className="status-icon in-progress" />;
      default: return <FaClock className="status-icon pending" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return '#10b981';
      case 'SKIPPED': return '#f59e0b';
      case 'FAILED': return '#ef4444';
      case 'IN_PROGRESS': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Completed';
      case 'SKIPPED': return 'Skipped';
      case 'FAILED': return 'Failed';
      case 'IN_PROGRESS': return 'In Progress';
      default: return 'Pending';
    }
  };

  const handleSubitemClick = (subitemId: string) => {
    if (selectedSubitem === subitemId) {
      setSelectedSubitem(null);
      setShowActions({ ...showActions, [subitemId]: false });
    } else {
      setSelectedSubitem(subitemId);
      setShowActions({ ...showActions, [subitemId]: true });
    }
  };

  const handleAction = async (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL') => {
    const notes = actionNotes[subitemId];
    await onSubitemAction(subitemId, action, notes);
    setActionNotes({ ...actionNotes, [subitemId]: '' });
    setSelectedSubitem(null);
    setShowActions({ ...showActions, [subitemId]: false });
  };

  const handleCompleteItem = async () => {
    await onCompleteItem();
  };

  const getSeverityBadge = (severity: number) => {
    const colors = ['green', 'yellow', 'orange', 'red'];
    const color = colors[Math.min(severity - 1, 3)];
    return (
      <span className={`severity-badge severity-${color}`}>
        {'⚠'.repeat(severity)}
      </span>
    );
  };

  return (
    <div className="subitem-timeline futuristic">
      {/* Header with statistics */}
      <div className="timeline-header">
        <div className="timeline-title">
          <h3>Subitems Timeline</h3>
          <button 
            className="expand-toggle-btn"
            onClick={onToggleExpand}
          >
            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
          </button>
        </div>
        
        <div className="timeline-stats">
          <div className="stat-item">
            <span className="stat-value">{completionPercentage}%</span>
            <span className="stat-label">Complete</span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div 
                className="progress-fill completed" 
                style={{ width: `${completionPercentage}%` }}
              />
              <div 
                className="progress-fill skipped" 
                style={{ width: `${Math.round((stats.skipped / stats.total) * 100)}%` }}
              />
              <div 
                className="progress-fill failed" 
                style={{ width: `${Math.round((stats.failed / stats.total) * 100)}%` }}
              />
            </div>
          </div>
        </div>
        
        <div className="stat-breakdown">
          <div className="stat-badge completed">
            <FaCheckCircle /> {stats.completed}
          </div>
          <div className="stat-badge skipped">
            <FaBan /> {stats.skipped}
          </div>
          <div className="stat-badge failed">
            <FaExclamationTriangle /> {stats.failed}
          </div>
          <div className="stat-badge pending">
            <FaClock /> {stats.pending}
          </div>
        </div>
      </div>

      {/* Timeline content */}
      {isExpanded && (
        <div className="timeline-content">
          {subitems.map((subitem, index) => (
            <div 
              key={subitem.id}
              className={`timeline-item ${subitem.status.toLowerCase()} ${selectedSubitem === subitem.id ? 'selected' : ''}`}
              onClick={() => handleSubitemClick(subitem.id)}
            >
              {/* Timeline connector */}
              <div className="timeline-connector">
                <div className="connector-line" />
                <div className="status-node">
                  {getStatusIcon(subitem.status)}
                </div>
                {index < subitems.length - 1 && <div className="connector-line" />}
              </div>

              {/* Subitem content */}
              <div className="subitem-content">
                <div className="subitem-header">
                  <div className="subitem-title-section">
                    <h4 className="subitem-title">{subitem.title}</h4>
                    <div className="subitem-meta">
                      {getSeverityBadge(subitem.severity)}
                      {subitem.is_required && (
                        <span className="required-badge">Required</span>
                      )}
                      <span className="type-badge">{subitem.item_type}</span>
                    </div>
                  </div>
                  
                  <div className="subitem-status">
                    <span 
                      className="status-label"
                      style={{ color: getStatusColor(subitem.status) }}
                    >
                      {getStatusLabel(subitem.status)}
                    </span>
                    {subitem.completed_at && (
                      <span className="completion-time">
                        {new Date(subitem.completed_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Complete item button when all subitems are actioned */}
      {allActioned && !isItemCompleted && (
        <div className="complete-item-section">
          <div className="complete-item-prompt">
            <FaCheckCircle className="complete-icon" />
            <div>
              <h4>All Subitems Actioned</h4>
              <p>
                {stats.completed} of {stats.total} subitems completed successfully
                {stats.skipped > 0 && ` (${stats.skipped} skipped)`}
                {stats.failed > 0 && ` (${stats.failed} failed)`}
              </p>
            </div>
          </div>
          <button
            className="complete-item-btn futuristic"
            onClick={handleCompleteItem}
          >
            <FaArrowRight /> Complete Main Item
          </button>
        </div>
      )}

      {/* Show completion message after item is completed */}
      {isItemCompleted && (
        <div className="complete-item-section completed">
          <div className="complete-item-prompt">
            <FaCheckCircle className="complete-icon" />
            <div>
              <h4>Completed</h4>
              <p>
                {stats.completed} of {stats.total} subitems completed successfully
                {stats.skipped > 0 && ` (${stats.skipped} skipped)`}
                {stats.failed > 0 && ` (${stats.failed} failed)`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubitemTimeline;
