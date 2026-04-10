import React from 'react';
import {
  FaCheckCircle, FaBan, FaExclamationTriangle, FaClock,
  FaPlay, FaUser, FaArrowRight,
  FaChevronDown, FaChevronUp
} from 'react-icons/fa';
import './SubitemTimeline.css';

interface Subitem {
  id: string;
  title: string;
  description: string | null;
  item_type: string;
  is_required: boolean;
  has_exe_time?: boolean;
  severity: number;
  sort_order: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  started_at?: string | null;
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
  currentTime: number;
  onSubitemAction: (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL', notes?: string) => Promise<void>;
  onCompleteItem: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  isItemCompleted?: boolean;
}

const SubitemTimeline: React.FC<SubitemTimelineProps> = ({
  subitems,
  currentTime,
  onCompleteItem,
  isExpanded = true,
  onToggleExpand,
  isItemCompleted = false
}) => {
  const stats = {
    total: subitems.length,
    completed: subitems.filter((subitem) => subitem.status === 'COMPLETED').length,
    skipped: subitems.filter((subitem) => subitem.status === 'SKIPPED').length,
    failed: subitems.filter((subitem) => subitem.status === 'FAILED').length,
    pending: subitems.filter((subitem) => subitem.status === 'PENDING').length,
    inProgress: subitems.filter((subitem) => subitem.status === 'IN_PROGRESS').length
  };

  const actionedCount = stats.completed + stats.skipped + stats.failed;
  const completionPercentage = stats.total > 0 ? Math.round((actionedCount / stats.total) * 100) : 0;
  const allActioned = stats.pending === 0 && stats.inProgress === 0;

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

  const getSeverityBadge = (severity: number) => {
    const colors = ['green', 'yellow', 'orange', 'red'];
    const color = colors[Math.min(Math.max(severity - 1, 0), 3)];
    return (
      <span className={`severity-badge severity-${color}`}>
        {'!'.repeat(severity)}
      </span>
    );
  };

  return (
    <div className="subitem-timeline futuristic">
      <div className="timeline-header">
        <div className="timeline-title">
          <h3>Subitems Timeline</h3>
          <button
            className="expand-toggle-btn"
            onClick={onToggleExpand}
            type="button"
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

      {isExpanded && (
        <div className="timeline-content">
          {subitems.map((subitem, index) => {
            const executionTime = subitem.has_exe_time
              ? formatExecutionTime(subitem.started_at, subitem.completed_at)
              : null;

            return (
              <div
                key={subitem.id}
                className={`timeline-item ${subitem.status.toLowerCase()}`}
              >
                <div className="timeline-connector">
                  <div className="connector-line" />
                  <div className="status-node">
                    {getStatusIcon(subitem.status)}
                  </div>
                  {index < subitems.length - 1 && <div className="connector-line" />}
                </div>

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
                        {subitem.has_exe_time && executionTime && (
                          <span className="type-badge execution-badge">Exec {executionTime}</span>
                        )}
                      </div>
                    </div>

                    <div className="subitem-status">
                      <span
                        className="status-label"
                        style={{ color: getStatusColor(subitem.status) }}
                      >
                        {getStatusLabel(subitem.status)}
                      </span>
                      {subitem.completed_by?.username && (
                        <span className="status-detail">
                          <FaUser />
                          {subitem.completed_by.username}
                        </span>
                      )}
                    </div>
                  </div>

                  {subitem.description && (
                    <p className="subitem-description">{subitem.description}</p>
                  )}

                  {(subitem.skipped_reason || subitem.failure_reason) && (
                    <div className="status-details">
                      {subitem.skipped_reason && (
                        <div className="skip-reason">
                          <FaBan className="info-icon" />
                          <span>{subitem.skipped_reason}</span>
                        </div>
                      )}
                      {subitem.failure_reason && (
                        <div className="failure-reason">
                          <FaExclamationTriangle className="info-icon" />
                          <span>{subitem.failure_reason}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      )}

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
            onClick={onCompleteItem}
            type="button"
          >
            <FaArrowRight /> Complete Main Item
          </button>
        </div>
      )}

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
