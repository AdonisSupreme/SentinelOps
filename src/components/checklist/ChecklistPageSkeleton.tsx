// src/components/checklist/ChecklistPageSkeleton.tsx
import React from 'react';

export const ChecklistPageSkeleton: React.FC = () => (
  <div className="checklist-page checklist-command-page checklist-skeleton-page">
    <section className="checklist-command-strip checklist-skel-panel">
      <div className="checklist-skel-command-copy">
        <div className="checklist-skel-line checklist-skel-kicker" />
        <div className="checklist-skel-line checklist-skel-title" />
        <div className="checklist-skel-line checklist-skel-meta" />
      </div>
      <div className="checklist-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="checklist-skel-signal-card">
            <div className="checklist-skel-block checklist-skel-icon" />
            <div className="checklist-skel-signal-copy">
              <div className="checklist-skel-line checklist-skel-label" />
              <div className="checklist-skel-line checklist-skel-value" />
              <div className="checklist-skel-line checklist-skel-meta" />
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="checklist-workspace">
      <main className="checklist-execution-board checklist-skel-panel">
        <div className="checklist-skel-board-head">
          <div>
            <div className="checklist-skel-line checklist-skel-kicker" />
            <div className="checklist-skel-line checklist-skel-panel-title" />
            <div className="checklist-skel-line checklist-skel-meta" />
          </div>
          <div className="checklist-skel-block checklist-skel-pill" />
        </div>
        <div className="checklist-skel-actions">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="checklist-skel-block checklist-skel-action" />
          ))}
        </div>
        <div className="checklist-skel-item-stack">
          {Array.from({ length: 6 }).map((_, index) => (
            <article key={index} className="checklist-skel-item-card">
              <div className="checklist-skel-block checklist-skel-status" />
              <div className="checklist-skel-item-copy">
                <div className="checklist-skel-line checklist-skel-item-title" />
                <div className="checklist-skel-line checklist-skel-item-meta" />
                <div className="checklist-skel-chip-row">
                  <div className="checklist-skel-block checklist-skel-chip" />
                  <div className="checklist-skel-block checklist-skel-chip" />
                  <div className="checklist-skel-block checklist-skel-chip" />
                </div>
              </div>
              <div className="checklist-skel-block checklist-skel-ring" />
            </article>
          ))}
        </div>
      </main>

      <aside className="content-right checklist-side-rail">
        <section className="sidebar-section stats-card checklist-skel-panel">
          <div className="checklist-skel-metric-grid">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="checklist-skel-metric" />
            ))}
          </div>
          <div className="checklist-skel-progress" />
        </section>
        <section className="sidebar-section checklist-skel-panel">
          <div className="checklist-skel-line checklist-skel-panel-title" />
          <div className="checklist-skel-list">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="checklist-skel-row" />
            ))}
          </div>
        </section>
        <section className="sidebar-section checklist-skel-panel">
          <div className="checklist-skel-line checklist-skel-panel-title" />
          <div className="checklist-skel-list">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="checklist-skel-row" />
            ))}
          </div>
        </section>
      </aside>
    </section>
  </div>
);
