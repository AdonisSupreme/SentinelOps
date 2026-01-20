// src/pages/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChecklist } from '../contexts/ChecklistContext';
import { checklistApi } from '../services/checklistApi';
import { 
  FaPlay, FaCheckCircle, FaClock, FaExclamationTriangle, 
  FaFire, FaTrophy, FaChartLine, FaUsers, FaCalendarAlt 
} from 'react-icons/fa';
import DashboardHeader from '../components/dashboard/DashboardHeader';
import ChecklistCard from '../components/dashboard/ChecklistCard';
import PerformanceWidget from '../components/dashboard/PerformanceWidget';
import QuickActions from '../components/dashboard/QuickActions';
import LiveActivity from '../components/dashboard/LiveActivity';
import GamificationPanel from '../components/dashboard/GamificationPanel';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { todayInstances, loadTodayInstances, loading } = useChecklist();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [gamificationData, setGamificationData] = useState<any>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      await loadTodayInstances();
      
      try {
        const [dashboardSummary, gamification] = await Promise.all([
          checklistApi.getDashboardSummary(),
          checklistApi.getGamificationDashboard()
        ]);
        setDashboardData(dashboardSummary);
        setGamificationData(gamification);
      } catch (error) {
        console.error('Failed to load dashboard data:', error);
      }
    };

    loadDashboardData();
    const interval = setInterval(loadTodayInstances, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadTodayInstances]);

  const getShiftTime = (shift: string) => {
    switch (shift) {
      case 'MORNING': return '06:00 - 14:00';
      case 'AFTERNOON': return '14:00 - 22:00';
      case 'NIGHT': return '22:00 - 06:00';
      default: return '';
    }
  };

  if (loading && !dashboardData) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading SentinelOps Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="sentinel-dashboard">
      <DashboardHeader user={user} />
      
      <div className="dashboard-grid">
        {/* Left Column */}
        <div className="dashboard-left">
          <section className="dashboard-section">
            <div className="section-header">
              <h2><FaCalendarAlt /> Today's Checkpoints</h2>
              <span className="section-badge">{todayInstances.length} Active</span>
            </div>
            
            <div className="checklist-grid">
              {todayInstances.length === 0 ? (
                <div className="empty-state">
                  <FaClock size={48} />
                  <h3>No active checklists</h3>
                  <p>Create or join a checklist to start operations</p>
                </div>
              ) : (
                todayInstances.map((instance) => (
                  <ChecklistCard key={instance.id} instance={instance} />
                ))
              )}
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <h2><FaFire /> Live Activity</h2>
            </div>
            <LiveActivity activities={dashboardData?.recent_activity || []} />
          </section>
        </div>

        {/* Right Column */}
        <div className="dashboard-right">
          <section className="dashboard-section">
            <div className="section-header">
              <h2><FaTrophy /> Operational Performance</h2>
            </div>
            <GamificationPanel data={gamificationData} />
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <h2><FaChartLine /> Performance Metrics</h2>
              <Link to="/performance" className="view-all">View Details</Link>
            </div>
            <PerformanceWidget metrics={dashboardData?.today} />
          </section>

          <section className="dashboard-section">
            <div className="section-header">
              <h2><FaUsers /> Team Overview</h2>
            </div>
            <div className="team-overview">
              <div className="team-stat">
                <div className="stat-value">{dashboardData?.today?.total_checklists || 0}</div>
                <div className="stat-label">Active Shifts</div>
              </div>
              <div className="team-stat">
                <div className="stat-value">{dashboardData?.today?.completed || 0}</div>
                <div className="stat-label">Completed</div>
              </div>
              <div className="team-stat">
                <div className="stat-value">{dashboardData?.today?.in_progress || 0}</div>
                <div className="stat-label">In Progress</div>
              </div>
            </div>
          </section>

          <QuickActions />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;