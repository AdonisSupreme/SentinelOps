// src/components/dashboard/ChecklistsSkeleton.tsx
import React from 'react';

export const ChecklistsSkeleton: React.FC = () => {
  return (
    <div className="checklists-page">
      {/* Header Skeleton */}
      <div className="checklists-header-skeleton">
        <div className="header-content-skeleton">
          <div className="header-title-skeleton">
            <div className="header-icon-skeleton"></div>
            <div className="skeleton-text skeleton-text-xl"></div>
          </div>
          <div className="skeleton-text skeleton-text-md"></div>
        </div>

        <div className="header-controls-skeleton">
          <div className="search-container-skeleton">
            <div className="search-icon-skeleton"></div>
            <div className="skeleton-input"></div>
          </div>

          <div className="filter-container-skeleton">
            <div className="filter-icon-skeleton"></div>
            <div className="skeleton-select"></div>
            <div className="skeleton-select"></div>
          </div>

          <div className="date-navigation-skeleton">
            <div className="nav-btn-skeleton"></div>
            <div className="skeleton-text skeleton-text-md"></div>
            <div className="nav-btn-skeleton"></div>
          </div>
        </div>
      </div>

      <div className="checklists-content">
        <div className="timeline-container-skeleton">
          {/* Timeline Day Skeletons */}
          {[1, 2, 3].map((dayIndex) => (
            <div key={dayIndex} className="timeline-day-skeleton">
              <div className="day-header-skeleton">
                <div className="skeleton-text skeleton-text-lg"></div>
                <div className="day-stats-skeleton">
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
              </div>

              <div className="instances-grid-skeleton">
                {/* Instance Card Skeletons */}
                {[1, 2, 3, 4].map((instanceIndex) => (
                  <div key={instanceIndex} className="instance-card-skeleton">
                    <div className="instance-header-skeleton">
                      <div className="instance-info-skeleton">
                        <div className="skeleton-text skeleton-text-md"></div>
                        <div className="instance-meta-skeleton">
                          <div className="shift-badge-skeleton"></div>
                          <div className="date-badge-skeleton"></div>
                        </div>
                      </div>
                      <div className="instance-status-skeleton">
                        <div className="status-icon-skeleton"></div>
                        <div className="skeleton-text skeleton-text-sm"></div>
                      </div>
                    </div>

                    <div className="instance-details-skeleton">
                      <div className="time-info-skeleton">
                        <div className="time-item-skeleton">
                          <div className="time-icon-skeleton"></div>
                          <div className="skeleton-text skeleton-text-xs"></div>
                        </div>
                        <div className="time-item-skeleton">
                          <div className="time-icon-skeleton"></div>
                          <div className="skeleton-text skeleton-text-xs"></div>
                        </div>
                      </div>
                      
                      <div className="completion-info-skeleton">
                        <div className="completion-icon-skeleton"></div>
                        <div className="skeleton-text skeleton-text-xs"></div>
                      </div>
                    </div>

                    <div className="instance-footer-skeleton">
                      <div className="skeleton-text skeleton-text-xs"></div>
                      <div className="click-hint-skeleton"></div>
                      <div className="delete-btn-skeleton"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
