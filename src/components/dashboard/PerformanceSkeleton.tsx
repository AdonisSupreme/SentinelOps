// src/components/dashboard/PerformanceSkeleton.tsx
import React from 'react';

export const PerformanceSkeleton: React.FC = () => {
  return (
    <div className="performance-page">
      {/* Header Skeleton */}
      <header className="performance-header-skeleton">
        <div className="header-content-skeleton">
          <div className="skeleton-text skeleton-text-xl"></div>
          <div className="skeleton-text skeleton-text-md"></div>
        </div>
        
        <div className="timeframe-selector-skeleton">
          <div className="timeframe-btn-skeleton"></div>
          <div className="timeframe-btn-skeleton"></div>
          <div className="timeframe-btn-skeleton"></div>
        </div>
      </header>

      <div className="performance-grid-skeleton">
        {/* Left Column Skeleton */}
        <div className="performance-left-skeleton">
          {/* User Overview Section Skeleton */}
          <section className="performance-section-skeleton user-overview-skeleton">
            <div className="section-header-skeleton">
              <div className="section-title-skeleton">
                <div className="title-icon-skeleton"></div>
                <div className="skeleton-text skeleton-text-lg"></div>
              </div>
            </div>
            
            <div className="user-stats-grid-skeleton">
              <div className="stat-card-skeleton large">
                <div className="stat-icon-skeleton"></div>
                <div className="stat-content-skeleton">
                  <div className="skeleton-text skeleton-text-xl"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
              </div>
              
              <div className="stat-card-skeleton large">
                <div className="stat-icon-skeleton"></div>
                <div className="stat-content-skeleton">
                  <div className="skeleton-text skeleton-text-xl"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
              </div>
              
              <div className="stat-card-skeleton large">
                <div className="stat-icon-skeleton"></div>
                <div className="stat-content-skeleton">
                  <div className="skeleton-text skeleton-text-xl"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
              </div>
            </div>
          </section>

          {/* Performance Chart Skeleton */}
          <div className="performance-chart-skeleton">
            <div className="chart-container-skeleton">
              <div className="chart-header-skeleton">
                <div className="skeleton-text skeleton-text-md"></div>
              </div>
              <div className="chart-placeholder-skeleton">
                <div className="chart-lines-skeleton">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="chart-line-skeleton"></div>
                  ))}
                </div>
                <div className="chart-bars-skeleton">
                  {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div key={i} className="chart-bar-skeleton"></div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Streak Tracker Skeleton */}
          <div className="streak-tracker-skeleton">
            <div className="streak-header-skeleton">
              <div className="skeleton-text skeleton-text-md"></div>
            </div>
            <div className="streak-grid-skeleton">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="streak-day-skeleton">
                  <div className="day-circle-skeleton"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="performance-right-skeleton">
          {/* Leaderboard Skeleton */}
          <div className="leaderboard-skeleton">
            <div className="leaderboard-header-skeleton">
              <div className="skeleton-text skeleton-text-lg"></div>
            </div>
            <div className="leaderboard-list-skeleton">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="leaderboard-item-skeleton">
                  <div className="rank-skeleton"></div>
                  <div className="user-info-skeleton">
                    <div className="user-avatar-skeleton"></div>
                    <div className="user-details-skeleton">
                      <div className="skeleton-text skeleton-text-sm"></div>
                      <div className="skeleton-text skeleton-text-xs"></div>
                    </div>
                  </div>
                  <div className="score-skeleton"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Achievement List Skeleton */}
          <div className="achievement-list-skeleton">
            <div className="achievement-header-skeleton">
              <div className="skeleton-text skeleton-text-lg"></div>
            </div>
            <div className="achievements-grid-skeleton">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="achievement-badge-skeleton">
                  <div className="badge-icon-skeleton"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Metrics Skeleton */}
          <section className="performance-section-skeleton team-metrics-skeleton">
            <div className="section-header-skeleton">
              <div className="section-title-skeleton">
                <div className="title-icon-skeleton"></div>
                <div className="skeleton-text skeleton-text-lg"></div>
              </div>
            </div>
            
            <div className="metrics-grid-skeleton">
              <div className="metric-skeleton">
                <div className="skeleton-text skeleton-text-xl"></div>
                <div className="skeleton-text skeleton-text-sm"></div>
              </div>
              
              <div className="metric-skeleton">
                <div className="skeleton-text skeleton-text-xl"></div>
                <div className="skeleton-text skeleton-text-sm"></div>
              </div>
              
              <div className="metric-skeleton">
                <div className="skeleton-text skeleton-text-xl"></div>
                <div className="skeleton-text skeleton-text-sm"></div>
              </div>
              
              <div className="metric-skeleton">
                <div className="skeleton-text skeleton-text-xl"></div>
                <div className="skeleton-text skeleton-text-sm"></div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
