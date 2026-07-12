import React, { useEffect, useState, useRef } from 'react';
import {
  FaArrowDown,
  FaArrowUp,
  FaCalendarAlt,
  FaChartLine,
  FaCheckCircle,
  FaDatabase,
  FaExclamationTriangle,
  FaHdd,
  FaServer,
  FaShieldAlt,
  FaSync,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { dashboardApi, DashboardSummary } from '../services/dashboardApi';
import { DATABASE_TELEMETRY_ENDPOINT_LABEL } from '../config/env';
import { DatabaseStatsSkeleton } from '../components/dashboard';
import { pageGuides } from '../content/pageGuides';
import './DatabaseStatsPage.css';
import '../components/dashboard/DatabaseStatsSkeleton.css';

const DatabaseStatsPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    void loadDashboardData();
    const interval = setInterval(() => {
      void loadDashboardData(false);
    }, 30000);

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

  const loadDashboardData = async (showLoader: boolean = true) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
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
      await loadDashboardData(false);
    } catch (err) {
      setError('Sync failed');
      setLoading(false);
    }
  };

  const drawChart = React.useCallback(() => {
    if (!data?.weekly_growth || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const styles = getComputedStyle(document.documentElement);
    const chartLinePrimary = styles.getPropertyValue('--dbstats-accent-cyan').trim() || '#00d9ff';
    const chartLineSecondary = styles.getPropertyValue('--dbstats-accent-green').trim() || '#00ff88';
    const chartPositive = styles.getPropertyValue('--dbstats-accent-green').trim() || '#00ff88';
    const chartNegative = styles.getPropertyValue('--dbstats-accent-red').trim() || '#ff5f7a';
    const chartGrid = styles.getPropertyValue('--dbstats-chart-grid').trim() || 'rgba(0, 217, 255, 0.08)';
    const chartAxis = styles.getPropertyValue('--dbstats-chart-axis').trim() || 'rgba(154, 177, 204, 0.7)';
    const chartAxisMuted = styles.getPropertyValue('--dbstats-chart-axis-muted').trim() || 'rgba(120, 142, 167, 0.72)';
    const chartFillStrong = styles.getPropertyValue('--dbstats-chart-fill-strong').trim() || 'rgba(0, 217, 255, 0.22)';
    const chartFillSoft = styles.getPropertyValue('--dbstats-chart-fill-soft').trim() || 'rgba(0, 217, 255, 0.02)';
    const chartGlow = styles.getPropertyValue('--dbstats-chart-glow').trim() || 'rgba(0, 217, 255, 0.26)';

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 28, right: 24, bottom: 46, left: 52 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const weekly = data.weekly_growth;
    const growth = weekly.growth;
    const labels = weekly.labels;

    const maxGrowth = Math.max(...growth.map(Math.abs), 1);
    const minGrowth = -maxGrowth;
    const range = maxGrowth - minGrowth || 1;

    const animate = (progress: number) => {
      ctx.clearRect(0, 0, width, height);

      ctx.strokeStyle = chartGrid;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 6; i++) {
        const y = padding.top + (chartHeight / 6) * i;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
      }

      const zeroY = padding.top + chartHeight / 2;
      ctx.strokeStyle = chartAxisMuted;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(padding.left, zeroY);
      ctx.lineTo(width - padding.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);

      const xStep = growth.length > 1 ? chartWidth / (growth.length - 1) : 0;
      const currentProgress = Math.min(progress, 1);
      const pointsToDraw = Math.max(1, Math.floor(growth.length * currentProgress));

      const lineGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
      lineGradient.addColorStop(0, chartLinePrimary);
      lineGradient.addColorStop(0.5, chartLineSecondary);
      lineGradient.addColorStop(1, chartLinePrimary);

      if (pointsToDraw > 0) {
        ctx.strokeStyle = lineGradient;
        ctx.lineWidth = 3;
        ctx.shadowColor = chartGlow;
        ctx.shadowBlur = 18;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < pointsToDraw; i++) {
          const value = growth[i];
          const x = padding.left + i * xStep;
          const normalizedValue = (value - minGrowth) / range;
          const y = padding.top + chartHeight - normalizedValue * chartHeight;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();
        ctx.shadowBlur = 0;

        if (pointsToDraw > 1) {
          const fillGradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
          fillGradient.addColorStop(0, chartFillStrong);
          fillGradient.addColorStop(1, chartFillSoft);

          ctx.fillStyle = fillGradient;
          ctx.beginPath();
          ctx.moveTo(padding.left, zeroY);

          for (let i = 0; i < pointsToDraw; i++) {
            const value = growth[i];
            const x = padding.left + i * xStep;
            const normalizedValue = (value - minGrowth) / range;
            const y = padding.top + chartHeight - normalizedValue * chartHeight;
            ctx.lineTo(x, y);
          }

          ctx.lineTo(padding.left + (pointsToDraw - 1) * xStep, zeroY);
          ctx.closePath();
          ctx.fill();
        }

        for (let i = 0; i < pointsToDraw; i++) {
          const value = growth[i];
          const x = padding.left + i * xStep;
          const normalizedValue = (value - minGrowth) / range;
          const y = padding.top + chartHeight - normalizedValue * chartHeight;

          ctx.fillStyle = value >= 0 ? `${chartPositive}33` : `${chartNegative}33`;
          ctx.beginPath();
          ctx.arc(x, y, 8, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = value >= 0 ? chartPositive : chartNegative;
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.fillStyle = chartAxis;
      ctx.font = "11px 'JetBrains Mono', monospace";
      ctx.textAlign = 'center';

      labels.forEach((label, index) => {
        const x = padding.left + index * xStep;
        const date = new Date(label);
        const day = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateNum = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
        ctx.fillText(day, x, height - 22);
        ctx.fillStyle = chartAxisMuted;
        ctx.fillText(dateNum, x, height - 8);
        ctx.fillStyle = chartAxis;
      });

      ctx.textAlign = 'right';
      ctx.fillStyle = chartAxisMuted;
      for (let i = 0; i <= 6; i++) {
        const value = minGrowth + (maxGrowth - minGrowth) * (1 - i / 6);
        const y = padding.top + (chartHeight / 6) * i;
        ctx.fillText(`${value > 0 ? '+' : ''}${value.toFixed(1)}`, padding.left - 10, y + 4);
      }

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(() => animate(progress + 0.025));
      }
    };

    animate(0);
  }, [data]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HEALTHY':
        return 'var(--dbstats-accent-green)';
      case 'WARNING':
        return 'var(--dbstats-accent-orange)';
      case 'CRITICAL':
        return 'var(--dbstats-accent-red)';
      default:
        return 'var(--dbstats-accent-cyan)';
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
    return <DatabaseStatsSkeleton />;
  }

  if (error && !data) {
    return (
      <div className="dbstats-page error">
        <div className="dbstats-error-panel">
          <div className="error-icon-wrapper">
            <FaExclamationTriangle className="error-icon" />
          </div>
          <h2>Telemetry Link Interrupted</h2>
          <p>{typeof error === 'string' ? error : JSON.stringify(error)}</p>
          <button onClick={() => void loadDashboardData()} className="retry-btn" type="button">
            <FaSync /> Reconnect
          </button>
        </div>
      </div>
    );
  }

  const prediction = data?.prediction;
  const weekly = data?.weekly_growth;
  const metrics = data?.derived_metrics;
  const usedPercentage = metrics?.usage_percentage || 0;
  const remainingPercentage = Math.max(0, 100 - usedPercentage);
  const averageGrowth = metrics?.average_daily_growth || 0;
  const latestGrowth = prediction?.dailyGrowthRateGb || 0;
  const syncLabel = lastUpdated?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Pending';
  const status = prediction?.status || 'HEALTHY';
  const capacityTone = usedPercentage >= 90 ? 'critical' : usedPercentage >= 75 ? 'warning' : 'healthy';
  const growthTone = latestGrowth >= 0 ? 'warning' : 'healthy';
  const dbSignals = [
    {
      label: 'Runway',
      value: `${prediction?.daysRemaining ?? '--'}d`,
      meta: prediction ? formatDate(prediction.predictedFullDate) : 'Projection unavailable',
      tone: status.toLowerCase(),
      icon: <FaShieldAlt />
    },
    {
      label: 'Used',
      value: `${usedPercentage.toFixed(1)}%`,
      meta: `${prediction?.currentUsedGb.toFixed(0) ?? '--'} / ${prediction?.totalCapacityGb.toFixed(0) ?? '--'} GB`,
      tone: capacityTone,
      icon: <FaHdd />
    },
    {
      label: 'Free',
      value: `${metrics?.remaining_capacity_gb.toFixed(0) ?? '--'} GB`,
      meta: `${remainingPercentage.toFixed(1)}% headroom`,
      tone: remainingPercentage <= 10 ? 'critical' : remainingPercentage <= 25 ? 'warning' : 'healthy',
      icon: <FaDatabase />
    },
    {
      label: 'Growth',
      value: `${latestGrowth >= 0 ? '+' : '-'}${Math.abs(latestGrowth).toFixed(1)}`,
      meta: 'GB per day',
      tone: growthTone,
      icon: latestGrowth >= 0 ? <FaArrowUp /> : <FaArrowDown />
    }
  ];

  return (
    <div className="dbstats-page dbstats-command-page">
      <div className="dbstats-backdrop" />
      <main className="dbstats-shell">
        <section className="db-command-strip">
          <div className="db-command-title fine-div">
            <span className="dbstats-kicker"><FaShieldAlt /> Database Command</span>
            <h1>Database Stats</h1>
            <p>Storage pressure, runway, and growth telemetry for operator decisions.</p>
          </div>

          <div className="db-command-actions">
            <button
              className={`dbstats-sync-btn ${loading ? 'syncing' : ''}`}
              onClick={handleSync}
              disabled={loading}
              type="button"
            >
              <FaSync />
              <span>{loading ? 'Syncing' : 'Sync'}</span>
            </button>
            <div className="dbstats-sync-meta">
              <span className="sync-meta-label">Refresh</span>
              <strong>{syncLabel}</strong>
            </div>
          </div>

          <div className="db-signal-grid">
            {dbSignals.map((signal) => (
              <article className={`db-signal-card tone-${signal.tone}`} key={signal.label}>
                <div className="db-signal-icon">{signal.icon}</div>
                <div>
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                  <small>{signal.meta}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="db-command-layout">
          <div className="db-command-main">
            <article className="db-panel db-capacity-board">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Storage Core</span>
                  <h2>Capacity posture</h2>
                </div>
                <div className="panel-icon"><FaServer /></div>
              </div>

              <div className="capacity-layout">
                <div className="ring-container">
                  <svg viewBox="0 0 120 120" className="capacity-ring">
                    <defs>
                      <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="var(--dbstats-accent-cyan)" />
                        <stop offset="50%" stopColor="var(--dbstats-accent-green)" />
                        <stop offset="100%" stopColor="var(--dbstats-accent-cyan)" />
                      </linearGradient>
                    </defs>
                    <circle className="ring-track" cx="60" cy="60" r="52" />
                    <circle
                      className="ring-progress"
                      cx="60"
                      cy="60"
                      r="52"
                      strokeDasharray={`${usedPercentage * 3.27} 327`}
                      style={{ stroke: 'url(#ringGradient)' }}
                    />
                  </svg>
                  <div className="ring-center">
                    <span className="percentage-value">{usedPercentage.toFixed(1)}%</span>
                    <span className="percentage-label">Utilized</span>
                  </div>
                </div>

                <div className="capacity-breakdown">
                  <div className="breakdown-item">
                    <div className="breakdown-topline">
                      <span className="breakdown-label">Used now</span>
                      <span className="breakdown-value">{prediction?.currentUsedGb.toFixed(1)} GB</span>
                    </div>
                    <div className="breakdown-bar">
                      <div className="bar-fill" style={{ width: `${usedPercentage}%` }} />
                    </div>
                  </div>

                  <div className="breakdown-item">
                    <div className="breakdown-topline">
                      <span className="breakdown-label">Remaining buffer</span>
                      <span className="breakdown-value">{metrics?.remaining_capacity_gb.toFixed(1)} GB</span>
                    </div>
                    <div className="breakdown-bar free">
                      <div className="bar-fill" style={{ width: `${remainingPercentage}%` }} />
                    </div>
                  </div>

                  <div className="breakdown-item total">
                    <div className="breakdown-topline">
                      <span className="breakdown-label">Provisioned total</span>
                      <span className="breakdown-value">{prediction?.totalCapacityGb.toFixed(1)} GB</span>
                    </div>
                  </div>
                </div>
              </div>
            </article>

            <article className="db-panel chart-panel db-growth-board">
              <div className="panel-head panel-head-inline">
                <div>
                  <span className="panel-kicker">Weekly Analysis</span>
                  <h2>Growth contour</h2>
                </div>
                <div className="live-chip">
                  <span className="badge-dot" />
                  Live Data
                </div>
              </div>

              <div className="chart-wrapper">
                <canvas ref={canvasRef} className="growth-chart" />
              </div>
            </article>

            <article className="legend-panel db-ledger-board">
              <div className="legend-header fine-div">
                <span className="panel-kicker">Seven-Day Detail</span>
                <h2>Daily ledger</h2>
              </div>

              <div className="chart-legend">
                {weekly?.growth.map((value, index) => (
                  <div key={index} className="legend-item">
                    <div
                      className={`legend-bar ${value >= 0 ? 'positive' : 'negative'}`}
                      style={{ height: `${Math.abs(value) * 3 + 20}px` }}
                    />
                    <span className={`legend-value ${value >= 0 ? 'positive' : 'negative'}`}>
                      {value > 0 ? '+' : ''}{value}
                    </span>
                    <span className="legend-date">
                      {new Date(weekly.labels[index]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="db-command-rail">
            <article className="db-panel db-runway-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Predictive Layer</span>
                  <h2>Runway</h2>
                </div>
                <div className="panel-icon"><FaCalendarAlt /></div>
              </div>

              <div className="forecast-display">
                <div className="days-remaining">
                  <span className="days-value">{prediction?.daysRemaining}</span>
                  <span className="days-unit">days</span>
                </div>

                <div className="forecast-details">
                  <div className="forecast-detail-row">
                    <span className="forecast-label">Full date</span>
                    <strong>{prediction && formatDate(prediction.predictedFullDate)}</strong>
                  </div>
                  <div className="forecast-detail-row">
                    <span className="forecast-label">Risk state</span>
                    <strong style={{ color: getStatusColor(status) }}>{status}</strong>
                  </div>
                </div>

                <div className={`dbstats-status-pill ${status.toLowerCase()}`}>
                  {getStatusIcon(status)}
                  <span>{status}</span>
                </div>
              </div>
            </article>

            <article className="db-panel db-growth-rail-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Velocity Scan</span>
                  <h2>Growth pulse</h2>
                </div>
                <div className="panel-icon"><FaChartLine /></div>
              </div>

              <div className="growth-display">
                <div className="growth-primary">
                  <div className="growth-value-wrapper">
                    {latestGrowth >= 0 ? <FaArrowUp className="growth-direction" /> : <FaArrowDown className="growth-direction negative" />}
                    <span className="growth-number">{Math.abs(latestGrowth).toFixed(1)}</span>
                    <span className="growth-unit">GB/day</span>
                  </div>
                  <span className="growth-label">Current daily growth rate</span>
                </div>

                <div className="growth-secondary">
                  <div className="secondary-stat">
                    <span className="stat-label">7-day average</span>
                    <span className={`stat-value ${averageGrowth >= 0 ? 'positive' : 'negative'}`}>
                      {averageGrowth >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                      {Math.abs(averageGrowth).toFixed(1)} GB
                    </span>
                  </div>
                </div>
              </div>
            </article>

            <article className="db-panel insight-panel">
              <div className="panel-head">
                <div>
                  <span className="panel-kicker">Operator Insight</span>
                  <h2>Control notes</h2>
                </div>
                <div className="panel-icon"><FaShieldAlt /></div>
              </div>

              <div className="insight-list">
                <div className="insight-item">
                  <span className="insight-label">Runway confidence</span>
                  <p>
                    With {prediction?.daysRemaining ?? '--'} days remaining, the platform is tracking a
                    <strong> {status.toLowerCase()} </strong>
                    storage posture.
                  </p>
                </div>

                <div className="insight-item">
                  <span className="insight-label">Capacity pressure</span>
                  <p>
                    {usedPercentage.toFixed(1)}% occupied, leaving {remainingPercentage.toFixed(1)}% available for future growth.
                  </p>
                </div>

                <div className="insight-item">
                  <span className="insight-label">Growth watch</span>
                  <p>
                    Current change is {Math.abs(latestGrowth).toFixed(1)} GB/day against a {Math.abs(averageGrowth).toFixed(1)} GB/day weekly baseline.
                  </p>
                </div>
              </div>
            </article>

            <footer className="dbstats-footer">
              <div className="footer-content">
                <FaServer className="footer-icon" />
                <span className="footer-text">
                  {DATABASE_TELEMETRY_ENDPOINT_LABEL} | {data?.timestamp ? 'Cached fallback' : 'Direct connection'}
                </span>
              </div>
            </footer>
          </aside>
        </section>
      </main>
      <PageGuide guide={pageGuides.databaseStats} />
    </div>
  );
};

export default DatabaseStatsPage;
