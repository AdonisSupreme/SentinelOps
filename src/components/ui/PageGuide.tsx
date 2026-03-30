import React, { useId, useState } from 'react';
import { FaInfoCircle, FaLightbulb, FaRoute, FaTimes } from 'react-icons/fa';
import './PageGuide.css';

export interface PageGuideSection {
  title: string;
  body: string;
}

export interface PageGuideDefinition {
  title: string;
  eyebrow: string;
  intro: string;
  sections: PageGuideSection[];
  workflow: string[];
  workflowTitle?: string;
  tipTitle?: string;
  tip: string;
  triggerLabel?: string;
}

interface PageGuideProps {
  guide: PageGuideDefinition;
}

const PageGuide: React.FC<PageGuideProps> = ({ guide }) => {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  return (
    <>
      <button
        type="button"
        className={`page-guide-trigger ${open ? 'active' : ''}`}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={headingId}
      >
        <span className="page-guide-trigger-icon">
          <FaInfoCircle />
        </span>
        <span className="page-guide-trigger-copy">
          <strong>{guide.triggerLabel || 'Guide'}</strong>
          <small>How this page works</small>
        </span>
      </button>

      {open && (
        <div className="page-guide-overlay" onClick={() => setOpen(false)}>
          <div
            className="page-guide-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="page-guide-header">
              <div>
                <span className="page-guide-eyebrow">{guide.eyebrow}</span>
                <h3 id={headingId}>{guide.title}</h3>
              </div>
              <button type="button" className="page-guide-close" onClick={() => setOpen(false)} aria-label="Close guide">
                <FaTimes />
              </button>
            </div>

            <p className="page-guide-intro">{guide.intro}</p>

            <div className="page-guide-grid">
              {guide.sections.map((section) => (
                <article key={section.title} className="page-guide-card">
                  <strong>{section.title}</strong>
                  <p>{section.body}</p>
                </article>
              ))}
            </div>

            <div className="page-guide-lower">
              <section className="page-guide-workflow">
                <div className="page-guide-section-heading">
                  <FaRoute />
                  <span>{guide.workflowTitle || 'Recommended flow'}</span>
                </div>
                <ol>
                  {guide.workflow.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </section>

              <section className="page-guide-tip">
                <div className="page-guide-section-heading">
                  <FaLightbulb />
                  <span>{guide.tipTitle || 'What to remember'}</span>
                </div>
                <p>{guide.tip}</p>
              </section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PageGuide;
