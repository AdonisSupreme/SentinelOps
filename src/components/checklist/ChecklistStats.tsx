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
  return (
    <section className="sidebar-section stats-card">
      <div className="stats-grid">
        <div className="stat-item">
          <div className="stat-icon">
            <FaCheckCircle />
          </div>
          <div className="stat-content">
            <span className="stat-label">Completed</span>
            <span className="stat-value">{stats.completed_items}/{stats.total_items}</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">
            <FaPercentage />
          </div>
          <div className="stat-content">
            <span className="stat-label">Progress</span>
            <span className="stat-value">{stats.completion_percentage}%</span>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">
            <FaHourglass />
          </div>
          <div className="stat-content">
            <span className="stat-label">Time Left</span>
            <span className="stat-value">{stats.time_remaining_minutes}m</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ChecklistStats;
