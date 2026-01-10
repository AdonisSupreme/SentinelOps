import React from 'react';
import OpsPulse from '../components/dashboard/OpsPulse';
import RiskPanel from '../components/dashboard/RiskPanel';
import ActivityTimeline from '../components/dashboard/ActivityTimeline';
import '../styles/Dashboard.css';

const DashboardPage: React.FC = () => {
  return (
    <div className="sentinel-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>SentinelOps</h1>
          <p className="subtitle">Operational Command Interface</p>
        </div>
        <div className="system-status">
          <span className="status-dot online" />
          <span>System Nominal</span>
        </div>
      </header>

      <section className="dashboard-section">
        <OpsPulse />
      </section>

      <section className="dashboard-split">
        <RiskPanel />
        <ActivityTimeline />
      </section>
    </div>
  );
};

export default DashboardPage;
