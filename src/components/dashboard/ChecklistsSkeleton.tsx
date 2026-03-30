import React from 'react';

export const ChecklistsSkeleton: React.FC = () => {
  return (
    <div className="checklists-page checklists-skeleton-page">
      <section className="checklists-skeleton-hero">
        <div className="skel-line skel-kicker" />
        <div className="skel-line skel-title" />
        <div className="skel-line skel-copy" />
        <div className="skel-chip-row">
          <div className="skel-chip" />
          <div className="skel-chip" />
        </div>
      </section>

      <section className="checklists-skeleton-summary">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="checklists-skeleton-card">
            <div className="skel-line skel-label" />
            <div className="skel-line skel-value" />
            <div className="skel-line skel-footnote" />
          </div>
        ))}
      </section>

      <section className="checklists-skeleton-command">
        <div className="checklists-skeleton-row">
          <div className="skel-input wide" />
          <div className="skel-input short" />
          <div className="skel-input short" />
        </div>
        <div className="checklists-skeleton-row">
          <div className="skel-segment" />
          <div className="skel-panel" />
        </div>
      </section>

      <section className="checklists-skeleton-timeline">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={index} className="checklists-skeleton-day">
            <div className="day-rail-skeleton">
              <div className="skel-dot" />
              <div className="skel-line skel-day-title" />
              <div className="skel-line skel-day-copy" />
              <div className="skel-chip-row">
                <div className="skel-chip" />
                <div className="skel-chip" />
              </div>
            </div>
            <div className="day-grid-skeleton">
              {Array.from({ length: 3 }).map((__, nested) => (
                <div key={nested} className="checklists-skeleton-instance">
                  <div className="skel-line skel-instance-title" />
                  <div className="skel-chip-row">
                    <div className="skel-chip" />
                    <div className="skel-chip" />
                  </div>
                  <div className="skel-line skel-copy" />
                  <div className="skel-line skel-copy short" />
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
