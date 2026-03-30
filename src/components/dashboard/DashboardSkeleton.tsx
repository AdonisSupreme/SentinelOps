import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="sentinel-dashboard dashboard-skeleton-page">
      <section className="dashboard-skeleton-hero">
        <div className="dash-skel-copy">
          <div className="dash-skel-line kicker" />
          <div className="dash-skel-line title" />
          <div className="dash-skel-line copy" />
          <div className="dash-signal-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="dash-signal-card">
                <div className="dash-skel-block icon" />
                <div className="dash-signal-copy">
                  <div className="dash-skel-line label" />
                  <div className="dash-skel-line value" />
                  <div className="dash-skel-line meta" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="dash-skel-aside">
          <div className="dash-skel-line label" />
          <div className="dash-skel-line value" />
          <div className="dash-ring-row">
            <div className="dash-skel-block ring" />
            <div className="dash-skel-block ring" />
            <div className="dash-skel-block ring" />
          </div>
          <div className="dash-footer-row">
            <div className="dash-skel-line meta" />
            <div className="dash-skel-line meta" />
          </div>
        </div>
      </section>

      <section className="dashboard-skeleton-grid">
        <div className="dashboard-skeleton-main">
          <article className="dashboard-skeleton-panel">
            <div className="dash-skel-line panel-title" />
            <div className="dash-radar-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="dash-radar-card">
                  <div className="dash-skel-line label" />
                  <div className="dash-skel-line value" />
                  <div className="dash-skel-progress" />
                  <div className="dash-tag-row">
                    <div className="dash-skel-chip" />
                    <div className="dash-skel-chip" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dashboard-skeleton-panel">
            <div className="dash-skel-line panel-title" />
            <div className="dash-thread-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="dash-thread-card">
                  <div className="dash-skel-line value" />
                  <div className="dash-skel-line copy" />
                  <div className="dash-skel-progress" />
                </div>
              ))}
            </div>
          </article>
        </div>

        <div className="dashboard-skeleton-side">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="dashboard-skeleton-panel compact">
              <div className="dash-skel-line panel-title" />
              <div className="dash-skel-line copy" />
              <div className="dash-skel-line copy short" />
              <div className="dash-tag-row">
                <div className="dash-skel-chip" />
                <div className="dash-skel-chip" />
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};
