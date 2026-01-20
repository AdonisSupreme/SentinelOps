// src/pages/DashboardPage.tsx
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useChecklist } from '../contexts/checklistContext';
import { checklistApi } from '../services/checklistApi';
import { 
  FaClock, FaFire, FaTrophy, FaChartLine, FaUsers, FaCalendarAlt 
} from 'react-icons/fa';
import { DashboardHeader, ChecklistCard, PerformanceWidget, QuickActions, LiveActivity, GamificationPanel } from '../components/dashboard';
import './DashboardPage.css';

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { todayInstances, loadTodayInstances, loading } = useChecklist();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [gamificationData, setGamificationData] = useState<any>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (hasInitialized) return; // Prevent duplicate initialization
    
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
    setHasInitialized(true);
    
    // Set up periodic refresh, but don't call on mount again
    const interval = setInterval(() => {
      loadTodayInstances();
    }, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(interval);
  }, [hasInitialized, loadTodayInstances]);

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