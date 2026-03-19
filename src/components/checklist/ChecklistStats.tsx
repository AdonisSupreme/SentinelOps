// src/components/checklist/ChecklistStats.tsx
import React from 'react';
import { FaCheckCircle, FaClock, FaPercentage, FaHourglass } from 'react-icons/fa';

interface ChecklistStatsProps {
  stats: {
    total_items: number;
    completed_items: number;
    completion_percentage: number;
    time_remaining_minutes?: number;
  };
}

const ChecklistStats: React.FC<ChecklistStatsProps> = ({ stats }) => {
  const formatTimeRemaining = (minutes: number) => {
    if (minutes === undefined || minutes === null) return '--';
    
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    
    let timeString = '';
    if (hours > 0) {
      timeString = `${hours}h ${mins}m`;
    } else {
      timeString = `${mins}m`;
    }
    
    // Add prefix for negative time (late)
    if (minutes < 0) {
      return `-${timeString}`;
    }
    
    return timeString;
  };

  const getTimeLabel = (minutes: number) => {
    if (minutes === undefined || minutes === null) return 'Time Left';
    return minutes < 0 ? 'Overdue' : 'Time Left';
  };

  const getTimeIconClass = (minutes: number) => {
    if (minutes === undefined || minutes === null) return '';
    return minutes < 0 ? 'overdue' : '';
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 80) return '#00ff9d'; // Green for high completion
    if (percentage >= 50) return '#00d9ff'; // Blue for medium completion
    if (percentage >= 25) return '#ffa502'; // Orange for low completion
    return '#ff4757'; // Red for very low completion
  };

  const getProgressStatus = (percentage: number) => {
    if (percentage === 100) return 'Complete';
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good Progress';
    if (percentage >= 40) return 'In Progress';
    if (percentage >= 20) return 'Just Started';
    return 'Needs Attention';
  };

  return (
    <section className="sidebar-section stats-card">
      <div className="stats-grid">
        <div className="cp-stat-item">
          <div className="cl-stat-icon">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.completed_items}/{stats.total_items}</span>
          </div>
        </div>

        <div className="cp-stat-item">
          <div className="cl-stat-icon">
            <FaPercentage />
          </div>
          <div className="stat-content">
            <span className="stat-label">Progress</span>
            <span className="stat-value">{stats.completion_percentage}%</span>
          </div>
        </div>

        <div className="cp-stat-item">
          <div className="cl-stat-icon">
            <FaHourglass className={getTimeIconClass(stats.time_remaining_minutes || 0)} />
          </div>
          <div className="stat-content">
            <span className="stat-label">{getTimeLabel(stats.time_remaining_minutes || 0)}</span>
            <span className={`stat-value ${stats.time_remaining_minutes && stats.time_remaining_minutes < 0 ? 'overdue' : ''}`}>
              {formatTimeRemaining(stats.time_remaining_minutes || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Progress Bar Section */}
      <div className="progress-section">
        <div className="progress-header">
          <span className="progress-title">Completion Progress</span>
          <span className="progress-status" style={{ color: getProgressColor(stats.completion_percentage) }}>
            {getProgressStatus(stats.completion_percentage)}
          </span>
        </div>
        
        <div className="progress-bar-container">
          {/* Background track */}
          <div className="progress-track">
            {/* Animated progress fill */}
            <div 
              className="progress-fill"
              style={{
                width: `${stats.completion_percentage}%`,
                background: `linear-gradient(90deg, ${getProgressColor(stats.completion_percentage)} 0%, ${getProgressColor(stats.completion_percentage)}cc 100%)`
              }}
            >
              {/* Animated shimmer effect */}
              <div className="progress-shimmer"></div>
            </div>
            
            {/* Progress markers */}
            <div className="progress-markers">
              <div className="marker" data-position="25"></div>
              <div className="marker" data-position="50"></div>
              <div className="marker" data-position="75"></div>
              <div className="marker" data-position="100"></div>
            </div>
          </div>
          
          {/* Percentage indicator */}
          <div className="progress-indicator">
            <span className="percentage-text">{stats.completion_percentage}%</span>
          </div>
        </div>

        {/* Progress details */}
        <div className="progress-details">
          <div className="detail-item">
            <span className="detail-label">Items Completed:</span>
            <span className="detail-value">{stats.completed_items}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Items Remaining:</span>
            <span className="detail-value">{stats.total_items - stats.completed_items}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Items:</span>
            <span className="detail-value">{stats.total_items}</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChecklistStats;
