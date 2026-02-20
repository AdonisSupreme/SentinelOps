// src/components/checklist/ChecklistPageSkeleton.tsx
import React from 'react';

export const ChecklistPageSkeleton: React.FC = () => {
  return (
    <div className="checklist-page">
      {/* Header Skeleton */}
      <header className="checklist-header-skeleton">
        <div className="back-btn-skeleton"></div>
        
        <div className="header-content-skeleton">
          <div className="checklist-title-skeleton">
            <div className="skeleton-text skeleton-text-xl"></div>
            <div className="checklist-meta-skeleton">
              <div className="skeleton-text skeleton-text-sm"></div>
              <div className="skeleton-text skeleton-text-sm"></div>
              <div className="skeleton-text skeleton-text-sm"></div>
            </div>
          </div>

          <div className="header-actions-skeleton">
            <div className="btn-skeleton"></div>
            <div className="btn-skeleton"></div>
            <div className="btn-skeleton"></div>
          </div>
        </div>
      </header>

      <div className="checklist-content">
        {/* Left Column - Timeline Skeleton */}
        <div className="content-left">
          <section className="timeline-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-lg"></div>
              <div className="timeline-stats-skeleton">
                <div className="skeleton-text skeleton-text-sm"></div>
                <div className="skeleton-text skeleton-text-sm"></div>
              </div>
            </div>
            
            {/* Timeline Items Skeleton */}
            <div className="timeline-items-skeleton">
              {[1, 2, 3, 4, 5].map((itemIndex) => (
                <div key={itemIndex} className="timeline-item-skeleton">
                  <div className="timeline-item-status-skeleton"></div>
                  <div className="timeline-item-content-skeleton">
                    <div className="skeleton-text skeleton-text-md"></div>
                    <div className="skeleton-text skeleton-text-sm"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column - Sidebar Skeleton */}
        <div className="content-right">
          {/* Stats Card Skeleton */}
          <div className="stats-card-skeleton">
            <div className="stats-grid-skeleton">
              {[1, 2, 3].map((statIndex) => (
                <div key={statIndex} className="stat-item-skeleton">
                  <div className="stat-icon-skeleton"></div>
                  <div className="stat-content-skeleton">
                    <div className="skeleton-text skeleton-text-xs"></div>
                    <div className="skeleton-text skeleton-text-md"></div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Progress Bar Skeleton */}
            <div className="progress-section-skeleton">
              <div className="progress-header-skeleton">
                <div className="skeleton-text skeleton-text-sm"></div>
                <div className="skeleton-text skeleton-text-xs"></div>
              </div>
              <div className="progress-bar-skeleton">
                <div className="progress-track-skeleton">
                  <div className="progress-fill-skeleton"></div>
                </div>
              </div>
              <div className="progress-details-skeleton">
                <div className="detail-item-skeleton">
                  <div className="skeleton-text skeleton-text-xs"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
                <div className="detail-item-skeleton">
                  <div className="skeleton-text skeleton-text-xs"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
                <div className="detail-item-skeleton">
                  <div className="skeleton-text skeleton-text-xs"></div>
                  <div className="skeleton-text skeleton-text-sm"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Participants Section Skeleton */}
          <section className="sidebar-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-md"></div>
              <div className="chevron-skeleton"></div>
            </div>
            <div className="participants-list-skeleton">
              {[1, 2, 3].map((participantIndex) => (
                <div key={participantIndex} className="participant-item-skeleton">
                  <div className="participant-avatar-skeleton"></div>
                  <div className="participant-info-skeleton">
                    <div className="skeleton-text skeleton-text-sm"></div>
                    <div className="skeleton-text skeleton-text-xs"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Handover Notes Section Skeleton */}
          <section className="sidebar-section-skeleton">
            <div className="section-header-skeleton">
              <div className="skeleton-text skeleton-text-md"></div>
              <div className="chevron-skeleton"></div>
            </div>
            <div className="handover-notes-skeleton">
              <div className="skeleton-text skeleton-text-sm"></div>
              <div className="skeleton-text skeleton-text-sm"></div>
              <div className="skeleton-text skeleton-text-xs"></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
