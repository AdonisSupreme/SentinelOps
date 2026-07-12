// src/components/dashboard/DatabaseStatsSkeleton.tsx
import React from 'react';

const signalPlaceholders = ['Runway', 'Used', 'Free', 'Growth'];
const ledgerPlaceholders = Array.from({ length: 7 }, (_, index) => index);
const railPlaceholders = ['Runway', 'Growth', 'Notes'];

export const DatabaseStatsSkeleton: React.FC = () => {
  return (
    <div className="dbstats-page dbstats-command-page dbstats-skeleton-page">
      <div className="dbstats-backdrop" />
      <main className="dbstats-shell">
        <section className="db-command-strip db-skeleton-panel">
          <div className="db-command-title">
            <div className="db-skeleton-chip db-skeleton-kicker" />
            <div className="db-skeleton-line db-skeleton-title" />
            <div className="db-skeleton-line db-skeleton-copy" />
          </div>

          <div className="db-command-actions">
            <div className="db-skeleton-button" />
            <div className="dbstats-sync-meta db-skeleton-sync-meta">
              <div className="db-skeleton-line db-skeleton-xs" />
              <div className="db-skeleton-line db-skeleton-sm" />
            </div>
          </div>

          <div className="db-signal-grid">
            {signalPlaceholders.map((label) => (
              <article className="db-signal-card db-skeleton-card" key={label}>
                <div className="db-signal-icon db-skeleton-icon" />
                <div>
                  <div className="db-skeleton-line db-skeleton-xs" />
                  <div className="db-skeleton-line db-skeleton-value" />
                  <div className="db-skeleton-line db-skeleton-sm" />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="db-command-layout db-skeleton-layout">
          <div className="db-command-main">
            <article className="db-panel db-capacity-board db-skeleton-panel">
              <div className="panel-head">
                <div>
                  <div className="db-skeleton-line db-skeleton-xs" />
                  <div className="db-skeleton-line db-skeleton-heading" />
                </div>
                <div className="panel-icon db-skeleton-icon" />
              </div>

              <div className="capacity-layout">
                <div className="db-skeleton-ring">
                  <div className="db-skeleton-line db-skeleton-ring-value" />
                  <div className="db-skeleton-line db-skeleton-xs" />
                </div>

                <div className="capacity-breakdown">
                  {[1, 2, 3].map((item) => (
                    <div className="breakdown-item db-skeleton-breakdown" key={item}>
                      <div className="breakdown-topline">
                        <div className="db-skeleton-line db-skeleton-sm" />
                        <div className="db-skeleton-line db-skeleton-xs" />
                      </div>
                      <div className="db-skeleton-meter" />
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="db-panel chart-panel db-growth-board db-skeleton-panel">
              <div className="panel-head panel-head-inline">
                <div>
                  <div className="db-skeleton-line db-skeleton-xs" />
                  <div className="db-skeleton-line db-skeleton-heading" />
                </div>
                <div className="db-skeleton-chip" />
              </div>

              <div className="chart-wrapper db-skeleton-chart">
                <div className="db-skeleton-chart-line line-one" />
                <div className="db-skeleton-chart-line line-two" />
                <div className="db-skeleton-chart-line line-three" />
              </div>
            </article>

            <article className="legend-panel db-ledger-board db-skeleton-panel">
              <div className="legend-header">
                <div className="db-skeleton-line db-skeleton-xs" />
                <div className="db-skeleton-line db-skeleton-heading" />
              </div>

              <div className="chart-legend">
                {ledgerPlaceholders.map((item) => (
                  <div className="legend-item db-skeleton-ledger" key={item}>
                    <div className="db-skeleton-ledger-bar" />
                    <div className="db-skeleton-line db-skeleton-xs" />
                    <div className="db-skeleton-line db-skeleton-xs" />
                  </div>
                ))}
              </div>
            </article>
          </div>

          <aside className="db-command-rail">
            {railPlaceholders.map((label, index) => (
              <article className="db-panel db-skeleton-panel db-skeleton-rail-card" key={label}>
                <div className="panel-head">
                  <div>
                    <div className="db-skeleton-line db-skeleton-xs" />
                    <div className="db-skeleton-line db-skeleton-heading" />
                  </div>
                  <div className="panel-icon db-skeleton-icon" />
                </div>
                <div className={index === 0 ? 'db-skeleton-runway' : 'db-skeleton-rail-lines'}>
                  <div className="db-skeleton-line db-skeleton-big-value" />
                  <div className="db-skeleton-line db-skeleton-sm" />
                  <div className="db-skeleton-line db-skeleton-copy" />
                </div>
              </article>
            ))}
          </aside>
        </section>
      </main>
    </div>
  );
};
