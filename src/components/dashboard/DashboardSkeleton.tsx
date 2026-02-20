// src/components/dashboard/DashboardSkeleton.tsx
import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="sentinel-dashboard">
      {/* Header Skeleton */}
      <div className="dashboard-header-skeleton">
        <div className="header-content-skeleton">
          <div className="user-info-skeleton">
            <div className="skeleton-avatar"></div>
            <div className="skeleton-text skeleton-text-lg"></div>
          </div>
          <div className="header-actions-skeleton">
            <div className="skeleton-button"></div>
            <div className="skeleton-button"></div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Column Skeleton */}
        <div className="dashboard-left">
          {/* Today's Checkpoints Skeleton */}
          <section className="dashboard-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-lg skeleton-shimmer"></div>
              <div className="skeleton-badge"></div>
            </div>
            <div className="checklist-cards-skeleton">
              {[1, 2, 3].map((i) => (
                <div key={i} className="checklist-card-skeleton">
                  <div className="card-header-skeleton">
                    <div className="skeleton-text skeleton-text-md"></div>
                    <div className="skeleton-badge-small"></div>
                  </div>
                  <div className="card-content-skeleton">
                    <div className="skeleton-text skeleton-text-sm"></div>
                    <div className="skeleton-text skeleton-text-sm"></div>
                  </div>
                  <div className="card-progress-skeleton">
                    <div className="progress-bar-skeleton">
                      <div className="progress-fill-skeleton"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Performance Widget Skeleton */}
          <section className="dashboard-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-lg skeleton-shimmer"></div>
            </div>
            <div className="performance-stats-skeleton">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="stat-card-skeleton">
                  <div className="stat-icon-skeleton"></div>
                  <div className="stat-content-skeleton">
                    <div className="skeleton-text skeleton-text-lg"></div>
                    <div className="skeleton-text skeleton-text-sm"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column Skeleton */}
        <div className="dashboard-right">
          {/* Quick Actions Skeleton */}
          <section className="quick-actions-skeleton">
            <div className="quick-actions-header-skeleton">
              <div className="skeleton-text skeleton-text-md"></div>
              <div className="skeleton-button-small"></div>
            </div>
            <div className="actions-grid-skeleton">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="action-button-skeleton">
                  <div className="skeleton-icon"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
              ))}
            </div>
          </section>

          {/* Live Activity Skeleton */}
          <section className="dashboard-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-lg skeleton-shimmer"></div>
            </div>
            <div className="activity-feed-skeleton">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="activity-item-skeleton">
                  <div className="activity-avatar-skeleton"></div>
                  <div className="activity-content-skeleton">
                    <div className="skeleton-text skeleton-text-sm"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                  </div>
                  <div className="activity-time-skeleton"></div>
                </div>
              ))}
            </div>
          </section>

          {/* Gamification Panel Skeleton */}
          <section className="dashboard-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-lg skeleton-shimmer"></div>
            </div>
            <div className="gamification-skeleton">
              <div className="level-progress-skeleton">
                <div className="level-info-skeleton">
                  <div className="skeleton-text skeleton-text-md"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
                <div className="progress-bar-skeleton">
                  <div className="progress-fill-skeleton"></div>
                </div>
              </div>
              <div className="achievements-skeleton">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="achievement-badge-skeleton"></div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
