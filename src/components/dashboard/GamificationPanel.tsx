// src/components/dashboard/GamificationPanel.tsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaTrophy, FaFire, FaMedal, FaChartLine, FaCrown } from 'react-icons/fa';
import './GamificationPanel.css';

interface GamificationPanelProps {
  data: any;
}

const GamificationPanel: React.FC<GamificationPanelProps> = ({ data }) => {
  if (!data) {
    return (
      <div className="gamification-panel loading">
        <div className="loading-spinner small"></div>
        <p>Loading gamification data...</p>
      </div>
    );
  }

  const { user, leaderboard_preview, next_milestones } = data;

  return (
    <div className="gamification-panel">
      {/* User Stats */}
      <div className="user-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FaTrophy />
          </div>
          <div className="stat-content">
            <div className="stat-value">{user?.total_points || 0}</div>
            <div className="stat-label">Total Points</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FaFire />
          </div>
          <div className="stat-content">
            <div className="stat-value">{user?.current_streak || 0} days</div>
            <div className="stat-label">Current Streak</div>
          </div>
        </div>
      </div>

      {/* Leaderboard Preview */}
      <div className="leaderboard-preview">
        <div className="preview-header">
          <h4><FaCrown /> Leaderboard</h4>
          <Link to="/performance" className="view-leaderboard">View All</Link>
        </div>
        
        <div className="leaderboard-list">
          {leaderboard_preview?.slice(0, 3).map((entry: any, index: number) => (
            <div key={entry.user_id} className="leaderboard-entry">
              <div className="rank">#{index + 1}</div>
              <div className="avatar">
                <img src={entry.avatar_url} alt={entry.username} />
              </div>
              <div className="entry-info">
                <div className="username">{entry.username}</div>
                <div className="points">{entry.total_points} pts</div>
              </div>
              {index === 0 && <FaCrown className="crown-icon" />}
            </div>
          ))}
        </div>
      </div>

      {/* Next Milestones */}
      {next_milestones && next_milestones.length > 0 && (
        <div className="milestones">
          <h4><FaMedal /> Next Milestones</h4>
          {next_milestones.map((milestone: any, index: number) => (
            <div key={index} className="milestone">
              <div className="milestone-info">
                <div className="milestone-name">{milestone.type} - {milestone.target}</div>
                <div className="milestone-progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-fill"
                      style={{ width: `${(milestone.current / milestone.target) * 100}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {milestone.current}/{milestone.target}
                  </span>
                </div>
              </div>
              <div className="milestone-reward">+{milestone.reward} pts</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GamificationPanel;