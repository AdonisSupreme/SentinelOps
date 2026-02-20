// src/components/dashboard/DatabaseStatsSkeleton.tsx
import React from 'react';

export const DatabaseStatsSkeleton: React.FC = () => {
  return (
    <div className="dbstats-page">
      {/* Header Skeleton */}
      <header className="dbstats-header-skeleton">
        <div className="header-brand-skeleton">
          <div className="brand-icon-skeleton"></div>
          <div className="brand-text-skeleton">
            <div className="skeleton-text skeleton-text-xl"></div>
            <div className="skeleton-text skeleton-text-sm"></div>
          </div>
        </div>
        <div className="header-actions-skeleton">
          <div className="sync-status-skeleton">
            <div className="skeleton-indicator"></div>
            <div className="skeleton-text skeleton-text-xs"></div>
          </div>
          <div className="skeleton-button"></div>
        </div>
      </header>

      <main className="dbstats-content">
        {/* Stats Grid Skeleton */}
        <section className="db-stats-grid-skeleton">
          {/* Capacity Card Skeleton */}
          <div className="db-stat-card-skeleton capacity">
            <div className="card-ambient-skeleton"></div>
            <div className="card-border-skeleton"></div>
            <div className="card-inner-skeleton">
              <div className="card-header-skeleton">
                <div className="card-icon-skeleton"></div>
                <div className="skeleton-text skeleton-text-md"></div>
              </div>
              
              <div className="capacity-visual-skeleton">
                <div className="ring-container-skeleton">
                  <div className="capacity-ring-skeleton"></div>
                  <div className="ring-center-skeleton">
                    <div className="skeleton-text skeleton-text-lg"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                  </div>
                </div>
                
                <div className="capacity-breakdown-skeleton">
                  <div className="breakdown-item-skeleton">
                    <div className="skeleton-text skeleton-text-md"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                    <div className="breakdown-bar-skeleton">
                      <div className="bar-fill-skeleton"></div>
                    </div>
                  </div>
                  <div className="breakdown-item-skeleton">
                    <div className="skeleton-text skeleton-text-md"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                    <div className="breakdown-bar-skeleton">
                      <div className="bar-fill-skeleton"></div>
                    </div>
                  </div>
                  <div className="breakdown-item-skeleton">
                    <div className="skeleton-text skeleton-text-md"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Forecast Card Skeleton */}
          <div className="db-stat-card-skeleton forecast">
            <div className="card-ambient-skeleton"></div>
            <div className="card-border-skeleton"></div>
            <div className="card-inner-skeleton">
              <div className="card-header-skeleton">
                <div className="card-icon-skeleton"></div>
                <div className="skeleton-text skeleton-text-md"></div>
              </div>
              
              <div className="forecast-display-skeleton">
                <div className="days-remaining-skeleton">
                  <div className="skeleton-text skeleton-text-xl"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
                
                <div className="forecast-details-skeleton">
                  <div className="forecast-row-skeleton">
                    <div className="skeleton-text skeleton-text-sm"></div>
                    <div className="skeleton-text skeleton-text-md"></div>
                  </div>
                </div>
                
                <div className="status-pill-skeleton"></div>
              </div>
            </div>
          </div>

          {/* Growth Card Skeleton */}
          <div className="db-stat-card-skeleton growth">
            <div className="card-ambient-skeleton"></div>
            <div className="card-border-skeleton"></div>
            <div className="card-inner-skeleton">
              <div className="card-header-skeleton">
                <div className="card-icon-skeleton"></div>
                <div className="skeleton-text skeleton-text-md"></div>
              </div>
              
              <div className="growth-display-skeleton">
                <div className="growth-primary-skeleton">
                  <div className="growth-value-wrapper-skeleton">
                    <div className="skeleton-text skeleton-text-xl"></div>
                    <div className="skeleton-text skeleton-text-sm"></div>
                  </div>
                  <div className="skeleton-text skeleton-text-xs"></div>
                </div>
                
                <div className="growth-secondary-skeleton">
                  <div className="secondary-stat-skeleton">
                    <div className="skeleton-text skeleton-text-xs"></div>
                    <div className="skeleton-text skeleton-text-md"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chart Section Skeleton */}
        <section className="chart-section-skeleton">
          <div className="section-header-skeleton">
            <div className="section-title-skeleton">
              <div className="title-icon-skeleton"></div>
              <div className="skeleton-text skeleton-text-lg"></div>
            </div>
            <div className="section-meta-skeleton">
              <div className="data-badge-skeleton">
                <div className="badge-dot-skeleton"></div>
                <div className="skeleton-text skeleton-text-xs"></div>
              </div>
            </div>
          </div>
          
          <div className="chart-wrapper-skeleton">
            <div className="chart-placeholder-skeleton">
              <div className="chart-lines-skeleton">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="chart-line-skeleton"></div>
                ))}
              </div>
              <div className="chart-points-skeleton">
                {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <div key={i} className="chart-point-skeleton"></div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="chart-legend-skeleton">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="legend-item-skeleton">
                <div className="legend-bar-skeleton"></div>
                <div className="legend-value-skeleton"></div>
                <div className="legend-date-skeleton"></div>
              </div>
            ))}
          </div>
        </section>

        {/* Footer Skeleton */}
        <footer className="dbstats-footer-skeleton">
          <div className="footer-content-skeleton">
            <div className="footer-icon-skeleton"></div>
            <div className="skeleton-text skeleton-text-md"></div>
          </div>
        </footer>
      </main>
    </div>
  );
};
