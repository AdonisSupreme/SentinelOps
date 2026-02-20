// src/pages/PerformancePage.tsx
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { checklistApi } from '../services/checklistApi';
import { 
  FaTrophy, FaChartLine, FaFire, FaUsers, FaCheckCircle
} from 'react-icons/fa';
import { PerformanceChart, Leaderboard, StreakTracker, AchievementList } from '../components/performance';
import { PerformanceSkeleton } from '../components/dashboard';
import './PerformancePage.css';
import '../components/dashboard/PerformanceSkeleton.css';

const PerformancePage: React.FC = () => {
  const { user } = useAuth();
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter'>('week');
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [leaderboardData, setLeaderboardData] = useState<any>(null);
  const [userScores, setUserScores] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadPerformanceData = async () => {
    setLoading(true);
    try {
      const [metrics, leaderboard, scores] = await Promise.all([
        checklistApi.getPerformanceMetrics(
          getStartDate(timeframe),
          new Date().toISOString().split('T')[0]
        ),
        checklistApi.getLeaderboard(timeframe, 20),
        checklistApi.getUserScores(
          getStartDate(timeframe),
          new Date().toISOString().split('T')[0]
        )
      ]);
      
      setPerformanceData(metrics);
      setLeaderboardData(leaderboard);
      setUserScores(scores);
    } catch (error) {
      console.error('Failed to load performance data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPerformanceData();
  }, [timeframe]);

  const getStartDate = (period: string) => {
    const date = new Date();
    switch (period) {
      case 'week':
        date.setDate(date.getDate() - 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() - 1);
        break;
      case 'quarter':
        date.setMonth(date.getMonth() - 3);
        break;
    }
    return date.toISOString().split('T')[0];
  };

  if (loading) {
    return <PerformanceSkeleton />;
  }

  return (
    <div className="performance-page">
      <header className="performance-header">
        <div>
          <h1>Operational Performance</h1>
          <p className="subtitle">Track team performance, achievements, and metrics</p>
        </div>
        
        <div className="timeframe-selector">
          <button 
            className={timeframe === 'week' ? 'active' : ''}
            onClick={() => setTimeframe('week')}
          >
            This Week
          </button>
          <button 
            className={timeframe === 'month' ? 'active' : ''}
            onClick={() => setTimeframe('month')}
          >
            This Month
          </button>
          <button 
            className={timeframe === 'quarter' ? 'active' : ''}
            onClick={() => setTimeframe('quarter')}
          >
            This Quarter
          </button>
        </div>
      </header>

      <div className="performance-grid">
        {/* Left Column - User Performance */}
        <div className="performance-left">
          <section className="performance-section user-overview">
            <div className="section-header">
              <h2><FaTrophy /> Your Performance</h2>
            </div>
            
            <div className="user-stats-grid">
              <div className="stat-card large">
                <div className="stat-icon">
                  <FaFire />
                </div>
                <div className="stat-content">
                  <div className="stat-value">
                    {leaderboardData?.find((u: any) => u.user_id === user?.id)?.current_streak || 0}
                  </div>
                  <div className="stat-label">Day Streak</div>
                  <div className="stat-trend">+2 this week</div>
                </div>
              </div>
              
              <div className="stat-card large">
                <div className="stat-icon">
                  <FaChartLine />
                </div>
                <div className="stat-content">
                  <div className="stat-value">
                    {leaderboardData?.find((u: any) => u.user_id === user?.id)?.total_points || 0}
                  </div>
                  <div className="stat-label">Total Points</div>
                  <div className="stat-trend">+150 this week</div>
                </div>
              </div>
              
              <div className="stat-card large">
                <div className="stat-icon">
                  <FaCheckCircle />
                </div>
                <div className="stat-content">
                  <div className="stat-value">
                    {performanceData?.reduce((acc: number, shift: any) => acc + shift.completed_on_time, 0) || 0}
                  </div>
                  <div className="stat-label">Completed Shifts</div>
                  <div className="stat-trend">95% success rate</div>
                </div>
              </div>
            </div>
          </section>

          <PerformanceChart data={performanceData} />
          
          <StreakTracker scores={userScores} />
        </div>

        {/* Right Column - Leaderboard & Achievements */}
        <div className="performance-right">
          <Leaderboard data={leaderboardData} user={user} />
          
          <AchievementList />
          
          <section className="performance-section team-metrics">
            <div className="section-header">
              <h2><FaUsers /> Team Metrics</h2>
            </div>
            
            <div className="metrics-grid">
              <div className="metric">
                <div className="metric-value">
                  {performanceData?.reduce((acc: number, shift: any) => acc + shift.total_instances, 0) || 0}
                </div>
                <div className="metric-label">Total Shifts</div>
              </div>
              
              <div className="metric">
                <div className="metric-value">
                  {performanceData?.reduce((acc: number, shift: any) => acc + shift.completed_on_time, 0) || 0}
                </div>
                <div className="metric-label">On Time</div>
              </div>
              
              <div className="metric">
                <div className="metric-value">
                  {performanceData?.reduce((acc: number, shift: any) => acc + shift.avg_completion_time_minutes, 0) / (performanceData?.length || 1) || 0}
                </div>
                <div className="metric-label">Avg. Time</div>
              </div>
              
              <div className="metric">
                <div className="metric-value">
                  {performanceData?.reduce((acc: number, shift: any) => acc + shift.team_engagement_score, 0) / (performanceData?.length || 1) || 0}
                </div>
                <div className="metric-label">Engagement</div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PerformancePage;