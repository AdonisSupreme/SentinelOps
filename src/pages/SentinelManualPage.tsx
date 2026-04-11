import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaBook,
  FaBolt,
  FaCrosshairs,
  FaRoute,
  FaShieldAlt,
  FaSignal,
} from 'react-icons/fa';
import { sentinelManual, SECTION_MANUAL_ID } from '../content/sentinelManual';
import { useAuth } from '../contexts/AuthContext';
import { orgApi } from '../services/orgApi';
import './SentinelManualPage.css';

const SentinelManualPage: React.FC = () => {
  const { user } = useAuth();
  const [sectionName, setSectionName] = useState('');
  const hasManualAccess = user?.section_id === SECTION_MANUAL_ID;

  useEffect(() => {
    const loadSectionName = async () => {
      try {
        const sections = await orgApi.listSections();
        const targetSection = sections.find((section) => section.id === SECTION_MANUAL_ID);
        setSectionName(targetSection?.section_name || '');
      } catch (error) {
        console.error('Failed to resolve manual section name', error);
        setSectionName('');
      }
    };

    void loadSectionName();
  }, []);

  if (!hasManualAccess) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <div className="sentinel-manual-page">
      <section className="manual-hero">
        <div className="manual-hero-copy">
          <span className="manual-eyebrow">{sentinelManual.eyebrow}</span>
          <h1>{sentinelManual.title}</h1>
          <p>{sentinelManual.intro}</p>

          <div className="manual-badge-row">
            <span>Audience: Users assigned to this section</span>
            <span>Section: {sectionName || SECTION_MANUAL_ID}</span>
            <span>Built for the current SentinelOps feature set</span>
          </div>
        </div>

        <aside className="manual-hero-aside">
          <div className="manual-hero-aside-header">
            <FaSignal />
            <span>Read this first</span>
          </div>

          <div className="manual-opening-sequence">
            {sentinelManual.openingSequence.map((item) => (
              <div key={item} className="manual-sequence-item">
                <FaArrowRight />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Operating truths</span>
          <h2>The rules that make the app feel simple</h2>
          <p>
            SentinelOps becomes much easier when you stop treating every page like a general-purpose
            workspace. Each area has a job. These are the rules that keep that job clear.
          </p>
        </div>

        <div className="manual-principles-grid">
          {sentinelManual.principles.map((principle) => (
            <article key={principle.title} className="manual-principle-card">
              <FaCrosshairs />
              <strong>{principle.title}</strong>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">What to do</span>
          <h2>Four proven operating loops</h2>
          <p>
            These are the fastest repeatable ways to move through the platform without wandering. If
            you are not sure where to begin, start with the loop that matches your moment.
          </p>
        </div>

        <div className="manual-loops-grid">
          {sentinelManual.loops.map((loop) => (
            <article key={loop.title} className="manual-loop-card">
              <div className="manual-loop-header">
                <FaRoute />
                <strong>{loop.title}</strong>
              </div>
              <p>{loop.summary}</p>
              <ol>
                {loop.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              <div className="manual-loop-outcome">
                <span>Why this works</span>
                <p>{loop.outcome}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Where to go</span>
          <h2>The SentinelOps workspace map</h2>
          <p>
            Every module below answers a different operational question. Use the when, how, and
            shortcut blocks to move with intent instead of reading the app page by page.
          </p>
        </div>

        <div className="manual-module-grid">
          {sentinelManual.modules.map((module) => (
            <article key={module.title} className="manual-module-card">
              <div className="manual-module-header">
                <div>
                  <span className="manual-module-kicker">Best used when</span>
                  <h3>{module.title}</h3>
                </div>
                {module.route.includes(':') ? (
                  <span className="manual-module-route disabled">
                    <FaBook />
                    <span>Open from a live thread</span>
                  </span>
                ) : (
                  <Link to={module.route} className="manual-module-route">
                    <span>{module.routeLabel}</span>
                    <FaArrowRight />
                  </Link>
                )}
              </div>

              <p className="manual-module-when">{module.when}</p>

              <div className="manual-module-body">
                <div className="manual-module-panel">
                  <label>Why it matters</label>
                  <p>{module.why}</p>
                </div>

                <div className="manual-module-panel">
                  <label>How to work it</label>
                  <ol>
                    {module.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="manual-module-panel manual-module-panel-inline">
                  <div>
                    <label>Workflow shortcut</label>
                    <p>{module.shortcut}</p>
                  </div>
                  <div>
                    <label>Watch for</label>
                    <p>{module.watchFor}</p>
                  </div>
                </div>

                <div className="manual-module-permissions">
                  <FaShieldAlt />
                  <span>{module.permissions}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section manual-shortcuts-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Little edges</span>
          <h2>Workflow shortcuts that save time without inventing new rules</h2>
          <p>
            These are usage shortcuts, not keyboard shortcuts. They are the habits that stop you
            from taking the long route through the platform.
          </p>
        </div>

        <div className="manual-shortcuts-grid">
          {sentinelManual.shortcuts.map((shortcut) => (
            <article key={shortcut.title} className="manual-shortcut-card">
              <FaBolt />
              <strong>{shortcut.title}</strong>
              <p>{shortcut.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">What good operators do</span>
          <h2>Habits that keep SentinelOps sharp shift after shift</h2>
          <p>
            The app feels powerful when the data inside it stays clean. These are the habits that
            keep the operation legible for the next person, not just the current user.
          </p>
        </div>

        <div className="manual-habits-grid">
          {sentinelManual.habits.map((habit) => (
            <article key={habit.title} className="manual-habit-card">
              <strong>{habit.title}</strong>
              <p>{habit.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default SentinelManualPage;
