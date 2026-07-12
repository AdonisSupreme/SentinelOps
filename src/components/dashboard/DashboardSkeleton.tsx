import React from 'react';

export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="sentinel-dashboard dashboard-skeleton-page">
      <header className="dash-skeleton-header">
        <div>
          <div className="dash-skel-line dash-kicker" />
          <div className="dash-skel-line dash-name" />
          <div className="dash-skel-line dash-meta" />
        </div>
        <div className="dash-skel-shift" />
        <div className="dash-skel-clock" />
      </header>

      <section className="dash-skeleton-command-strip">
        <div className="dash-skel-command-copy">
          <div className="dash-skel-line dash-kicker" />
          <div className="dash-skel-line dash-posture" />
          <div className="dash-skel-line dash-meta" />
        </div>

        <div className="dash-skel-signal-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="dash-skel-signal-card">
              <div className="dash-skel-block dash-icon" />
              <div className="dash-skel-signal-copy">
                <div className="dash-skel-line dash-label" />
                <div className="dash-skel-line dash-value" />
                <div className="dash-skel-line dash-meta" />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dash-skeleton-layout">
        <div className="dash-skeleton-main">
          <article className="dash-skel-panel dash-skel-thread-panel">
            <div className="dash-skel-panel-head">
              <div className="dash-skel-line dash-panel-title" />
              <div className="dash-skel-chip" />
            </div>
            <div className="dash-skel-thread-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="dash-skel-thread-card">
                  <div className="dash-skel-line dash-value" />
                  <div className="dash-skel-line dash-copy" />
                  <div className="dash-skel-progress" />
                  <div className="dash-skel-mini-row">
                    <div className="dash-skel-chip" />
                    <div className="dash-skel-chip" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dash-skel-panel">
            <div className="dash-skel-panel-head">
              <div className="dash-skel-line dash-panel-title" />
              <div className="dash-skel-chip" />
            </div>
            <div className="dash-skel-radar-grid">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="dash-skel-radar-card">
                  <div className="dash-skel-line dash-label" />
                  <div className="dash-skel-line dash-value" />
                  <div className="dash-skel-progress" />
                  <div className="dash-skel-mini-row three">
                    <div className="dash-skel-chip" />
                    <div className="dash-skel-chip" />
                    <div className="dash-skel-chip" />
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="dash-skel-panel">
            <div className="dash-skel-panel-head">
              <div className="dash-skel-line dash-panel-title" />
              <div className="dash-skel-chip" />
            </div>
            <div className="dash-skel-fabric-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="dash-skel-fabric-lane">
                  <div className="dash-skel-line dash-label" />
                  <div className="dash-skel-line dash-value" />
                  <div className="dash-skel-line dash-meta" />
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="dash-skeleton-side">
          <article className="dash-skel-panel dash-skel-actions">
            <div className="dash-skel-panel-head">
              <div className="dash-skel-line dash-panel-title" />
              <div className="dash-skel-block dash-small-icon" />
            </div>
            <div className="dash-skel-action-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="dash-skel-action-btn">
                  <div className="dash-skel-block dash-small-icon" />
                  <div className="dash-skel-line dash-label" />
                </div>
              ))}
            </div>
            <div className="dash-skel-live-stack">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="dash-skel-live-row">
                  <div className="dash-skel-block dash-small-icon" />
                  <div>
                    <div className="dash-skel-line dash-label" />
                    <div className="dash-skel-line dash-meta" />
                  </div>
                  <div className="dash-skel-chip" />
                </div>
              ))}
            </div>
          </article>

          {Array.from({ length: 3 }).map((_, index) => (
            <article key={index} className="dash-skel-panel dash-skel-compact-panel">
              <div className="dash-skel-line dash-panel-title" />
              <div className="dash-skel-line dash-copy" />
              <div className="dash-skel-line dash-copy short" />
            </article>
          ))}
        </aside>
      </section>
    </div>
  );
};
