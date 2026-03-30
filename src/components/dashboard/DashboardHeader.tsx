// src/components/dashboard/DashboardHeader.tsx
import React, { useEffect, useState } from 'react';
import { User } from '../../contexts/AuthContext';
import ShiftReminder from './ShiftReminder';
import './DashboardHeader.css';

interface DashboardHeaderProps {
  user: User | null;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ user }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <h1>
          <span className="greeting">{getGreeting()}</span>
          <span className="username">{user?.first_name || 'Operator'}</span>
          <p className="subtitle">
            SentinelOps operational dashboard
            {user?.department ? ` · ${user.department}` : ''}
          </p>
        </h1>
      </div>
      
      <div className="header-center">
        <ShiftReminder />
      </div>
      
      <div className="header-right">
        <div className="mission-clock">
          <div className="clock-label">Current Time</div>
          <div className="clock-value">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="clock-date">
            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
