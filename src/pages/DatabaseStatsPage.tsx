// src/pages/DatabaseStatsPage.tsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  FaDatabase, 
  FaChartLine, 
  FaExclamationTriangle, 
  FaCheckCircle, 
  FaSync,
  FaArrowUp,
  FaArrowDown,
  FaCalendarAlt,
  FaServer,
  FaHdd
} from 'react-icons/fa';
import { dashboardApi, DashboardSummary } from '../services/dashboardApi';
import './DatabaseStatsPage.css';

const DatabaseStatsPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000);
    return () => {
      clearInterval(interval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (data?.weekly_growth && canvasRef.current) {
      drawChart();
    }
  }, [data]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const stats = await dashboardApi.getDashboardStats();
      setData(stats);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setLoading(true);
      await dashboardApi.syncDashboardData();
      await loadDashboardData();
    } catch (err) {
      setError('Sync failed');
    } finally {
      setLoading(false);
    }
  };

  const drawChart = React.useCallback(() => {
    if (!data?.weekly_growth || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 30, right: 30, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const weekly = data.weekly_growth;
    const growth = weekly.growth;
    const labels = weekly.labels;
    
    const maxGrowth = Math.max(...growth.map(Math.abs));
    const minGrowth = -maxGrowth;
    const range = maxGrowth - minGrowth || 1;

    const animate = (progress: number) => {
      ctx.clearRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.08)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const y = padding.top + (chartHeight / 6) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      // Draw zero line
      const zeroY = padding.top + chartHeight / 2;
      ctx.strokeStyle = 'rgba(0, 242, 255, 0.2)';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw growth line with glow
      const xStep = chartWidth / (growth.length - 1);
      const currentProgress = Math.min(progress, 1);
      const pointsToDraw = Math.floor(growth.length * currentProgress);

      if (pointsToDraw > 0) {
        // Create gradient for the line
        const gradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
        gradient.addColorStop(0, '#00f2ff');
        gradient.addColorStop(0.5, '#00ff88');
        gradient.addColorStop(1, '#00f2ff');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00f2ff';
        ctx.shadowBlur = 15;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < pointsToDraw; i++) {
          const value = growth[i];
          const x = padding.left + i * xStep;
          const normalizedValue = (value - minGrowth) / range;
          const y = padding.top + chartHeight - (normalizedValue * chartHeight);

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        // Fill area under line
        if (pointsToDraw > 1) {
          const fillGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
          fillGradient.addColorStop(0, 'rgba(0, 242, 255, 0.2)');
          fillGradient.addColorStop(1, 'rgba(0, 242, 255, 0)');

          ctx.fillStyle = fillGradient;
          ctx.beginPath();
          ctx.moveTo(padding.left, zeroY);
          
          for (let i = 0; i < pointsToDraw; i++) {
            const value = growth[i];
            const x = padding.left + i * xStep;
            const normalizedValue = (value - minGrowth) / range;
            const y = padding.top + chartHeight - (normalizedValue * chartHeight);
            ctx.lineTo(x, y);
          }
          
          ctx.lineTo(padding.left + (pointsToDraw - 1) * xStep, zeroY);
          ctx.closePath();
          ctx.fill();
        }

        // Draw points
        for (let i = 0; i < pointsToDraw; i++) {
          const value = growth[i];
          const x = padding.left + i * xStep;
          const normalizedValue = (value - minGrowth) / range;
          const y = padding.top + chartHeight - (normalizedValue * chartHeight);

          // Outer glow
          ctx.fillStyle = 'rgba(0, 242, 255, 0.3)';
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();

          // Inner point
          ctx.fillStyle = value >= 0 ? '#00ff88' : '#ff4444';
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw labels
      ctx.fillStyle = '#a0c4d0';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      
      labels.forEach((label, index) => {
        const x = padding.left + index * xStep;
        const date = new Date(label);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        ctx.fillText(day, x, height - 25);
        ctx.fillStyle = '#5a7a8a';
        ctx.fillText(dateNum, x, height - 10);
        ctx.fillStyle = '#a0c4d0';
      });

      // Y-axis labels
      ctx.textAlign = 'right';
      ctx.fillStyle = '#5a7a8a';
      for (let i = 0; i <= 6; i++) {
        const value = minGrowth + (maxGrowth - minGrowth) * (1 - i / 6);
        const y = padding.top + (chartHeight / 6) * i;
        ctx.fillText(`${value > 0 ? '+' : ''}${value.toFixed(1)}`, padding.left - 12, y + 4);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(() => animate(progress + 0.02));
      }
    };

    animate(0);
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return '#00ff88';
      case 'WARNING':
        return '#ffaa00';
      case 'CRITICAL':
        return '#ff4444';
      default:
        return '#00f2ff';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return <FaCheckCircle className="status-icon healthy" />;
      case 'WARNING':
        return <FaExclamationTriangle className="status-icon warning" />;
      case 'CRITICAL':
        return <FaExclamationTriangle className="status-icon critical" />;
      default:
        return <FaDatabase className="status-icon" />;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (loading && !data) {
    return (
      <div className="dbstats-page loading">
        <div className="loading-container">
          <div className="sentinel-loader">
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
            <div className="loader-ring"></div>
          </div>
          <span className="loading-text">Initializing Database Monitor...</span>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="dbstats-page error">
        <div className="error-container">
          <div className="error-icon-wrapper">
            <FaExclamationTriangle className="error-icon" />
          </div>
          <h2>Connection Disrupted</h2>
          <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            <FaSync /> Reconnect
          </button>
        </div>
      </div>
    );
  }

  const prediction = data?.prediction;
  const weekly = data?.weekly_growth;
  const metrics = data?.derived_metrics;

  return (
    <div className="dbstats-page">
      <header className="dbstats-header">
        <div className="header-brand">
          <div className="brand-icon">
            <FaServer />
          </div>
          <div className="brand-text">
            <h1>SENTINEL<span className="accent">MONITOR</span></h1>
            <span className="brand-subtitle">Database Infrastructure Analytics</span>
          </div>
        </div>
        <div className="header-actions">
          {lastUpdated && (
            <div className="sync-status">
              <span className="sync-indicator"></span>
              <span className="sync-time">{lastUpdated.toLocaleTimeString()}</span>
            </div>
          )}
          <button 
            className={`sync-btn ${loading ? 'syncing' : ''}`} 
            onClick={handleSync}
            disabled={loading}
            title="Sync with external data source"
          >
            <FaSync />
          </button>
        </div>
      </header>

      <main className="dbstats-content">
        {/* Status Cards */}
        <section className="db-stats-grid">
          {/* Capacity Card */}
          <div className="db-stat-card capacity">
            <div className="card-ambient"></div>
            <div className="card-border"></div>
            <div className="card-inner">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <FaHdd className="card-icon" />
                </div>
                <span className="card-title">Storage Utilization</span>
              </div>
              
              <div className="capacity-visual">
                <div className="ring-container">
                  <svg viewBox="0 0 120 120" className="capacity-ring">
                    <defs>
                      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#00f2ff" />
                        <stop offset="50%" stopColor="#00ff88" />
                        <stop offset="100%" stopColor="#00f2ff" />
                      </linearGradient>
                    </defs>
                    <circle className="ring-track" cx="60" cy="60" r="52" />
                    <circle 
                      className="ring-progress" 
                      cx="60" 
                      cy="60" 
                      r="52"
                      strokeDasharray={`${(metrics?.usage_percentage || 0) * 3.27} 327`}
                      style={{ stroke: `url(#ringGradient)` }}
                    />
                  </svg>
                  <div className="ring-center">
                    <span className="percentage-value">{metrics?.usage_percentage.toFixed(1)}%</span>
                    <span className="percentage-label">Utilized</span>
                  </div>
                </div>
                
                <div className="capacity-breakdown">
                  <div className="breakdown-item">
                    <span className="breakdown-value">{prediction?.currentUsedGb.toFixed(0)} GB</span>
                    <span className="breakdown-label">Used</span>
                    <div className="breakdown-bar">
                      <div className="bar-fill" style={{ width: `${metrics?.usage_percentage || 0}%` }}></div>
                    </div>
                  </div>
                  <div className="breakdown-item">
                    <span className="breakdown-value">{metrics?.remaining_capacity_gb.toFixed(0)} GB</span>
                    <span className="breakdown-label">Free</span>
                    <div className="breakdown-bar free">
                      <div className="bar-fill" style={{ width: `${100 - (metrics?.usage_percentage || 0)}%` }}></div>
                    </div>
                  </div>
                  <div className="breakdown-item total">
                    <span className="breakdown-value">{prediction?.totalCapacityGb.toFixed(0)} GB</span>
                    <span className="breakdown-label">Total Capacity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Card */}
          <div className="db-stat-card forecast">
            <div className="card-ambient"></div>
            <div className="card-border"></div>
            <div className="card-inner">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <FaCalendarAlt className="card-icon" />
                </div>
                <span className="card-title">Capacity Forecast</span>
              </div>
              
              <div className="forecast-display">
                <div className="days-remaining">
                  <span className="days-value">{prediction?.daysRemaining}</span>
                  <span className="days-unit">Days</span>
                  <span className="days-label">Until Full</span>
                </div>
                
                <div className="forecast-details">
                  <div className="forecast-row">
                    <span className="forecast-label">Projected Full Date:</span>
                    <span className="forecast-value">
                      {prediction && formatDate(prediction.predictedFullDate)}
                    </span>
                  </div>
                </div>
                
                <div 
                  className="status-pill"
                  style={{ 
                    backgroundColor: `${getStatusColor(prediction?.status || 'HEALTHY')}15`,
                    borderColor: `${getStatusColor(prediction?.status || 'HEALTHY')}50`,
                    color: getStatusColor(prediction?.status || 'HEALTHY')
                  }}
                >
                  {getStatusIcon(prediction?.status || 'HEALTHY')}
                  <span>{prediction?.status || 'UNKNOWN'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Growth Card */}
          <div className="db-stat-card growth">
            <div className="card-ambient"></div>
            <div className="card-border"></div>
            <div className="card-inner">
              <div className="card-header">
                <div className="card-icon-wrapper">
                  <FaChartLine className="card-icon" />
                </div>
                <span className="card-title">Growth Metrics</span>
              </div>
              
              <div className="growth-display">
                <div className="growth-primary">
                  <div className="growth-value-wrapper">
                    <span className="growth-sign">+</span>
                    <span className="growth-number">{prediction?.dailyGrowthRateGb.toFixed(1)}</span>
                    <span className="growth-unit">GB/day</span>
                  </div>
                  <span className="growth-label">Current Daily Growth</span>
                </div>
                
                <div className="growth-secondary">
                  <div className="secondary-stat">
                    <span className="stat-label">7-Day Average:</span>
                    <span className={`stat-value ${(metrics?.average_daily_growth || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {(metrics?.average_daily_growth || 0) >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                      {Math.abs(metrics?.average_daily_growth || 0).toFixed(1)} GB
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chart Section */}
        <section className="chart-section">
          <div className="section-header">
            <div className="section-title">
              <FaChartLine className="title-icon" />
              <strong className="wga-title">Weekly Growth Analysis</strong>
            </div>
            <div className="section-meta">
              <span className="data-badge">
                <span className="badge-dot"></span>
                Live Data
              </span>
            </div>
          </div>
          
          <div className="chart-wrapper">
            <canvas ref={canvasRef} className="growth-chart" />
          </div>
          
          <div className="chart-legend">
            {weekly?.growth.map((value, index) => (
              <div key={index} className="legend-item">
                <div className="legend-bar" style={{ 
                  height: `${Math.abs(value) * 3 + 20}px`,
                  backgroundColor: value >= 0 ? '#00ff88' : '#ff4444'
                }}></div>
                <span className="legend-value" style={{ color: value >= 0 ? '#00ff88' : '#ff4444' }}>
                  {value > 0 ? '+' : ''}{value}
                </span>
                <span className="legend-date">
                  {new Date(weekly.labels[index]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Info */}
        <footer className="dbstats-footer">
          <div className="footer-content">
            <FaServer className="footer-icon" />
            <span className="footer-text">
              Monitoring: 192.168.1.167:3030 | Mode: {data?.timestamp ? 'Cached Fallback' : 'Direct Connection'}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default DatabaseStatsPage;
