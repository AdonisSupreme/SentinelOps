// src/components/dashboard/DashboardHeader.tsx
import React from 'react';
import { User } from '../../contexts/AuthContext';
import { FaBell, FaBolt, FaShieldAlt } from 'react-icons/fa';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  user: User | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user }) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1>
          <span className="greeting">{getGreeting()},</span>
          <span className="username">{user?.first_name || 'Operator'}</span>
        </h1>
        <p className="subtitle">Welcome to SentinelOps Command Center</p>
        
        <div className="status-indicators">
          <div className="status-item">
            <FaShieldAlt className="status-icon shield" />
            <div>
              <div className="status-label">System Security</div>
              <div className="status-value active">Operational</div>
            </div>
          </div>
          
          <div className="status-item">
            <FaBolt className="status-icon bolt" />
            <div>
              <div className="status-label">Response Time</div>
              <div className="status-value">42ms</div>
            </div>
          </div>
          
          <div className="status-item">
            <FaBell className="status-icon bell" />
            <div>
              <div className="status-label">Active Alerts</div>
              <div className="status-value">2</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="header-right">
        <div className="mission-clock">
          <div className="clock-label">Mission Time</div>
          <div className="clock-value">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <div className="clock-date">
            {new Date().toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;