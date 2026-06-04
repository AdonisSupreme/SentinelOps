import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBook,
  FaCheckCircle,
  FaClipboardList,
  FaDownload,
  FaExclamationTriangle,
  FaFilePdf,
  FaFlag,
  FaPlay,
  FaRoute,
  FaShieldAlt,
  FaTasks,
  FaUsers,
} from 'react-icons/fa';
import {
  ManualVisualType,
  SENTINEL_MANUAL_PDF_PATH,
  sentinelManual,
} from '../content/sentinelManual';
import { useAuth } from '../contexts/AuthContext';
import { orgApi } from '../services/orgApi';
import './SentinelManualPage.css';

const renderManualVisual = (type: ManualVisualType) => {
  switch (type) {
    case 'dashboard':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Dashboard</span>
            <strong>Operational State</strong>
          </div>
          <div className="manual-visual-grid two">
            <div className="manual-visual-panel accent-blue">
              <span>Command posture</span>
              <strong>Stable with watch items</strong>
              <small>Read this before opening queues.</small>
            </div>
            <div className="manual-visual-panel accent-amber">
              <span>Shift Radar</span>
              <div className="manual-visual-bars">
                <i style={{ width: '58%' }} />
                <i style={{ width: '76%' }} />
                <i style={{ width: '34%' }} />
              </div>
            </div>
          </div>
          <div className="manual-visual-row">
            <span className="manual-visual-chip active">Command thread</span>
            <span className="manual-visual-chip">Handover Summary</span>
          </div>
        </>
      );
    case 'timeline':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Checklist Timeline</span>
            <strong>Filters first</strong>
          </div>
          <div className="manual-visual-row">
            <span className="manual-visual-chip active">Week</span>
            <span className="manual-visual-chip">Specific Day</span>
            <span className="manual-visual-chip">Date Range</span>
          </div>
          <div className="manual-visual-list">
            <span><b>Morning Shift</b><em>Completed</em></span>
            <span><b>Afternoon Shift</b><em>In Progress</em></span>
            <span><b>Night Shift</b><em>Completed With Exceptions</em></span>
          </div>
        </>
      );
    case 'checklistHeader':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Live Checklist</span>
            <strong>Header controls</strong>
          </div>
          <div className="manual-visual-actionbar">
            <span className="manual-visual-button primary"><FaUsers /> Join Checklist</span>
            <span className="manual-visual-button success"><FaCheckCircle /> Complete Checklist</span>
            <span className="manual-visual-button"><FaFilePdf /> Download PDF</span>
          </div>
          <div className="manual-visual-grid two">
            <div className="manual-visual-panel">
              <span>Progress</span>
              <strong>8 / 10 actioned</strong>
            </div>
            <div className="manual-visual-panel">
              <span>Team Members</span>
              <strong>3 online</strong>
            </div>
          </div>
        </>
      );
    case 'itemActions':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Item Actions</span>
            <strong>Choose the truthful action</strong>
          </div>
          <div className="manual-visual-actionbar wrap">
            <span className="manual-visual-button primary"><FaPlay /> Start Working</span>
            <span className="manual-visual-button success">Mark Complete</span>
            <span className="manual-visual-button warning">Skip Item</span>
            <span className="manual-visual-button danger">Report Issue</span>
          </div>
          <div className="manual-visual-note">
            <span>Reason or completion notes</span>
            <i />
            <i />
          </div>
        </>
      );
    case 'subitems':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Smart Subitem Modal</span>
            <strong>Step 3 of 6</strong>
          </div>
          <div className="manual-visual-dots">
            <i className="done" />
            <i className="done" />
            <i className="active" />
            <i />
            <i />
            <i />
          </div>
          <div className="manual-visual-panel accent-blue">
            <span>Current subitem</span>
            <strong>Validate evidence and action result</strong>
          </div>
          <div className="manual-visual-actionbar wrap">
            <span className="manual-visual-button success">Mark Complete</span>
            <span className="manual-visual-button warning">Skip</span>
            <span className="manual-visual-button danger">Report Issue</span>
          </div>
        </>
      );
    case 'handover':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Handover Notes</span>
            <strong>Priority and next action</strong>
          </div>
          <div className="manual-visual-panel accent-amber">
            <span>Incoming</span>
            <strong>High priority note</strong>
            <small>Acknowledge before action.</small>
          </div>
          <div className="manual-visual-note compact">
            <span>Create Handover Note</span>
            <i />
            <i />
          </div>
          <div className="manual-visual-actionbar">
            <span className="manual-visual-button primary"><FaFlag /> Add Handover Note</span>
          </div>
        </>
      );
    case 'taskCenter':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Task Center</span>
            <strong>Durable ownership</strong>
          </div>
          <div className="manual-visual-grid task">
            <div className="manual-visual-sidebar">
              <span className="active">Personal</span>
              <span>Assigned</span>
              <span>Team</span>
              <span>Overdue</span>
            </div>
            <div className="manual-visual-list">
              <span><b>Follow up failed check</b><em>Due today</em></span>
              <span><b>Escalation evidence</b><em>Owner set</em></span>
            </div>
          </div>
        </>
      );
    case 'finalize':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Complete Checklist</span>
            <strong>Final evidence check</strong>
          </div>
          <div className="manual-visual-grid three">
            <div className="manual-visual-panel"><span>Actioned</span><strong>10 / 10</strong></div>
            <div className="manual-visual-panel"><span>Clean</span><strong>8</strong></div>
            <div className="manual-visual-panel accent-red"><span>Exceptions</span><strong>2</strong></div>
          </div>
          <div className="manual-visual-panel accent-amber">
            <span>Final status</span>
            <strong>Completed With Exceptions</strong>
          </div>
          <div className="manual-visual-actionbar">
            <span className="manual-visual-button success">Confirm Complete</span>
          </div>
        </>
      );
    case 'templates':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Template Manager</span>
            <strong>Reusable flow</strong>
          </div>
          <div className="manual-visual-list numbered">
            <span><b>1. Opening checks</b><em>Required</em></span>
            <span><b>2. Evidence validation</b><em>Subitems</em></span>
            <span><b>3. Handover readiness</b><em>Required</em></span>
          </div>
          <span className="manual-visual-button primary">Publish structure</span>
        </>
      );
    case 'schedule':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Team Management</span>
            <strong>Coverage horizon</strong>
          </div>
          <div className="manual-visual-row">
            <span className="manual-visual-chip active">7 days</span>
            <span className="manual-visual-chip">Patterns</span>
            <span className="manual-visual-chip">Exceptions</span>
          </div>
          <div className="manual-visual-calendar">
            {Array.from({ length: 12 }, (_, index) => (
              <i key={index} className={index === 2 || index === 7 ? 'warn' : index % 3 === 0 ? 'active' : ''} />
            ))}
          </div>
        </>
      );
    case 'network':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Network Sentinel</span>
            <strong>Signal, Timeline, Evidence</strong>
          </div>
          <div className="manual-visual-grid two">
            <div className="manual-visual-list">
              <span><b>IDC Core</b><em>Stable</em></span>
              <span><b>USSD Gateway</b><em>Degraded</em></span>
              <span><b>Postilion</b><em>Stable</em></span>
            </div>
            <div className="manual-visual-panel accent-red">
              <span>Evidence</span>
              <strong>Incident sequence detected</strong>
            </div>
          </div>
        </>
      );
    case 'trustlink':
      return (
        <>
          <div className="manual-visual-topbar">
            <span>TrustLink Operations</span>
            <strong>Pipeline state</strong>
          </div>
          <div className="manual-visual-pipeline">
            <i className="done" />
            <i className="done" />
            <i className="active" />
            <i />
            <i />
          </div>
          <div className="manual-visual-panel accent-blue">
            <span>Download readiness</span>
            <strong>File save pending</strong>
          </div>
        </>
      );
    case 'settings':
    default:
      return (
        <>
          <div className="manual-visual-topbar">
            <span>Profile Settings</span>
            <strong>Identity and access</strong>
          </div>
          <div className="manual-visual-grid two">
            <div className="manual-visual-panel">
              <span>Role</span>
              <strong>Operator</strong>
            </div>
            <div className="manual-visual-panel">
              <span>Section</span>
              <strong>Assigned</strong>
            </div>
          </div>
          <div className="manual-visual-list">
            <span><b>My Schedule</b><em>Open</em></span>
            <span><b>SentinelOps Manual</b><em>Available</em></span>
          </div>
        </>
      );
  }
};

const ManualScreenVisual: React.FC<{ type: ManualVisualType; label: string }> = ({ type, label }) => (
  <div className={`manual-visual manual-visual-${type}`} aria-label={label}>
    {renderManualVisual(type)}
  </div>
);

const SentinelManualPage: React.FC = () => {
  const { user } = useAuth();
  const [sectionName, setSectionName] = useState('');

  useEffect(() => {
    const loadSectionName = async () => {
      if (!user?.section_id) {
        setSectionName('');
        return;
      }

      try {
        const sections = await orgApi.listSections();
        const activeSection = sections.find((section) => section.id === user.section_id);
        setSectionName(activeSection?.section_name || '');
      } catch (error) {
        console.error('Failed to resolve user section name for manual', error);
        setSectionName('');
      }
    };

    void loadSectionName();
  }, [user?.section_id]);

  return (
    <div className="sentinel-manual-page">
      <section className="manual-hero">
        <div className="manual-hero-copy">
          <span className="manual-eyebrow">{sentinelManual.eyebrow}</span>
          <h1>{sentinelManual.title}</h1>
          <p>{sentinelManual.intro}</p>

          <div className="manual-hero-actions">
            <a className="manual-primary-action" href={SENTINEL_MANUAL_PDF_PATH} download>
              <FaDownload />
              <span>{sentinelManual.downloadLabel}</span>
            </a>
            <a className="manual-secondary-action" href="#operator-journey">
              <FaRoute />
              <span>Start guided walkthrough</span>
            </a>
          </div>

          <div className="manual-badge-row">
            <span>{sentinelManual.edition}</span>
            <span>Audience: all SentinelOps users</span>
            <span>Section: {sectionName || user?.section_id || 'All sections'}</span>
          </div>
        </div>

        <aside className="manual-hero-aside">
          <div className="manual-hero-aside-header">
            <FaClipboardList />
            <span>Operating sequence</span>
          </div>
          <div className="manual-opening-sequence">
            {sentinelManual.openingSequence.map((item, index) => (
              <div key={item} className="manual-sequence-item">
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="manual-stats-grid" aria-label="Manual quick map">
        {sentinelManual.heroStats.map((stat) => (
          <article key={stat.label} className="manual-stat-card">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Operating truths</span>
          <h2>The simple rules underneath the masterpiece</h2>
          <p>
            These principles keep every click understandable. When the system feels busy, return to
            these rules and the right next action becomes easier to see.
          </p>
        </div>

        <div className="manual-principles-grid">
          {sentinelManual.principles.map((principle) => (
            <article key={principle.title} className="manual-principle-card">
              <FaShieldAlt />
              <strong>{principle.title}</strong>
              <p>{principle.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="operator-journey" className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Operator checklist</span>
          <h2>Follow this path from login to clean closeout</h2>
          <p>
            The steps below mirror the actual SentinelOps workflow. Each one names the spot on the
            screen, the action to take, and the safety rule that keeps the record transparent.
          </p>
        </div>

        <div className="manual-journey-list">
          {sentinelManual.operatorJourney.map((step) => (
            <article key={step.step} className="manual-journey-card">
              <ManualScreenVisual type={step.visual} label={`${step.title} visual`} />
              <div className="manual-journey-copy">
                <div className="manual-journey-header">
                  <span>{step.step}</span>
                  <div>
                    <small>{step.location}</small>
                    <h3>{step.title}</h3>
                  </div>
                </div>
                <p>{step.body}</p>
                <div className="manual-action-pill">
                  <FaArrowRight />
                  <span>{step.actionLabel}</span>
                </div>
                <ol>
                  {step.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
                <div className="manual-safety-note">
                  <FaExclamationTriangle />
                  <span>{step.safety}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Decision guide</span>
          <h2>When to complete, skip, report, hand over, or finalize</h2>
          <p>
            The buttons are simple. The judgement behind them matters. Use this table when the next
            click is not obvious.
          </p>
        </div>

        <div className="manual-decision-grid">
          {sentinelManual.decisionRules.map((rule) => (
            <article key={rule.title} className="manual-decision-card">
              <div className="manual-decision-title">
                <FaCheckCircle />
                <strong>{rule.title}</strong>
              </div>
              <dl>
                <div>
                  <dt>Use when</dt>
                  <dd>{rule.useWhen}</dd>
                </div>
                <div>
                  <dt>Do this</dt>
                  <dd>{rule.doThis}</dd>
                </div>
                <div>
                  <dt>Evidence left behind</dt>
                  <dd>{rule.evidence}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Workspace map</span>
          <h2>Use the right room for the right kind of work</h2>
          <p>
            SentinelOps becomes easier when every page has a purpose. These visual cards show the
            part of the system to use and the question it answers.
          </p>
        </div>

        <div className="manual-module-grid">
          {sentinelManual.modules.map((workspace) => (
            <article key={workspace.title} className="manual-module-card">
              <ManualScreenVisual type={workspace.visual} label={`${workspace.title} visual`} />
              <div className="manual-module-copy">
                <div className="manual-module-header">
                  <div>
                    <span className="manual-module-kicker">{workspace.question}</span>
                    <h3>{workspace.title}</h3>
                  </div>
                  {workspace.route.includes(':') ? (
                    <span className="manual-module-route disabled">
                      <FaBook />
                      <span>{workspace.routeLabel}</span>
                    </span>
                  ) : (
                    <Link to={workspace.route} className="manual-module-route">
                      <span>{workspace.routeLabel}</span>
                      <FaArrowRight />
                    </Link>
                  )}
                </div>
                <p>{workspace.when}</p>
                <ul>
                  {workspace.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="manual-avoid-note">
                  <FaExclamationTriangle />
                  <span>{workspace.avoid}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-section manual-closeout-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Final check</span>
          <h2>Before you leave the shift</h2>
          <p>
            Use this as the last checklist before handover or final approval. It is intentionally
            practical: if an item below is not true, the record is not ready.
          </p>
        </div>

        <div className="manual-closeout-grid">
          <ManualScreenVisual type="finalize" label="Checklist closeout visual" />
          <div className="manual-closeout-list">
            {sentinelManual.closeoutChecklist.map((item) => (
              <div key={item} className="manual-closeout-item">
                <FaCheckCircle />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="manual-section">
        <div className="manual-section-heading">
          <span className="manual-section-kicker">Good habits</span>
          <h2>The habits that make the system feel friendly</h2>
        </div>

        <div className="manual-habits-grid">
          {sentinelManual.habits.map((habit) => (
            <article key={habit.title} className="manual-habit-card">
              <FaTasks />
              <strong>{habit.title}</strong>
              <p>{habit.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="manual-download-band">
        <div>
          <span className="manual-section-kicker">Portable copy</span>
          <h2>Download the SentinelOps PDF manual</h2>
          <p>
            Use the PDF for onboarding, shift-room reference, training, or offline review. It keeps
            the same checklist flow and visual landmarks as this page.
          </p>
        </div>
        <a className="manual-primary-action" href={SENTINEL_MANUAL_PDF_PATH} download>
          <FaDownload />
          <span>Download PDF</span>
        </a>
      </section>
    </div>
  );
};

export default SentinelManualPage;
