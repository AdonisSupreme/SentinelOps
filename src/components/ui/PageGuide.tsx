import React, { useId, useState } from 'react';
import {
  FaBook,
  FaBrain,
  FaCheckCircle,
  FaDatabase,
  FaDownload,
  FaExclamationTriangle,
  FaInfoCircle,
  FaLightbulb,
  FaNetworkWired,
  FaProjectDiagram,
  FaRoute,
  FaShieldAlt,
  FaTimes,
} from 'react-icons/fa';
import './PageGuide.css';

export interface PageGuideSection {
  title: string;
  body: string;
}

export type PageGuideVisualType =
  | 'nexusCommand'
  | 'incidentTriage'
  | 'aiBrief'
  | 'topology'
  | 'evidence'
  | 'actions'
  | 'outcome'
  | 'serviceOnboarding'
  | 'databaseContract'
  | 'businessFlows'
  | 'dependencyEdges'
  | 'lightAgents'
  | 'sops'
  | 'rollover';

export interface PageGuideHeroStat {
  label: string;
  value: string;
  detail?: string;
}

export interface PageGuideVisualStep {
  step: string;
  title: string;
  location: string;
  body: string;
  checklist: string[];
  visual: PageGuideVisualType;
  example?: string;
  avoid?: string;
}

export interface PageGuideDecisionRule {
  title: string;
  useWhen: string;
  doThis: string;
  avoid: string;
  evidence?: string;
}

export interface PageGuideTreeBranch {
  title: string;
  body: string;
  items: string[];
}

export interface PageGuideExample {
  title: string;
  scenario: string;
  interpretation: string;
  operatorMove: string;
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
  variant?: 'default' | 'wide' | 'nexus';
  manualPath?: string;
  manualDownloadLabel?: string;
  heroStats?: PageGuideHeroStat[];
  visualWalkthrough?: PageGuideVisualStep[];
  decisionRules?: PageGuideDecisionRule[];
  featureTree?: PageGuideTreeBranch[];
  examples?: PageGuideExample[];
}

interface PageGuideProps {
  guide: PageGuideDefinition;
}

const renderNexusVisual = (type: PageGuideVisualType) => {
  switch (type) {
    case 'nexusCommand':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Nexus workspace</span>
            <strong>Incidents first, catalog always near</strong>
          </div>
          <div className="nexus-guide-visual-tabs">
            <span className="active">Incidents</span>
            <span>Services</span>
            <span>Agents</span>
            <span>Databases</span>
          </div>
          <div className="nexus-guide-visual-grid two">
            <div className="nexus-guide-visual-panel accent-blue">
              <span>Fabric pulse</span>
              <strong>Mapped services 28/31</strong>
            </div>
            <div className="nexus-guide-visual-panel accent-green">
              <span>Safe lanes</span>
              <strong>Diagnostics ready 12</strong>
            </div>
          </div>
        </>
      );
    case 'incidentTriage':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Incident drawer</span>
            <strong>Risk, flow, root candidates</strong>
          </div>
          <div className="nexus-guide-risk-strip">
            <span className="critical">Critical</span>
            <span>Risk 91</span>
            <span>IDC access flow</span>
          </div>
          <div className="nexus-guide-candidate-list">
            <span><b>01 ARX Auth</b><em>0.82 confidence</em></span>
            <span><b>02 IDC Gateway</b><em>0.54 confidence</em></span>
            <span><b>03 Core DB</b><em>0.21 confidence</em></span>
          </div>
        </>
      );
    case 'aiBrief':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Nexus AI brief</span>
            <strong>Explain, cite, constrain</strong>
          </div>
          <div className="nexus-guide-brief-stack">
            <span><b>Known</b><em>External checks fail on gateway.</em></span>
            <span><b>Inferred</b><em>Runtime agent still healthy.</em></span>
            <span><b>Unsafe</b><em>Restart blocked until diagnostics.</em></span>
          </div>
          <div className="nexus-guide-visual-note">Cites SOP, evidence timeline, graph, and candidate scoring.</div>
        </>
      );
    case 'topology':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Topology</span>
            <strong>Direction matters</strong>
          </div>
          <div className="nexus-guide-graph">
            <span className="node root">ARX</span>
            <i />
            <span className="node hot">IDC</span>
            <i />
            <span className="node">LMS</span>
          </div>
          <div className="nexus-guide-visual-grid three">
            <div className="nexus-guide-visual-panel accent-red"><span>Root</span><strong>ARX</strong></div>
            <div className="nexus-guide-visual-panel accent-amber"><span>Blast</span><strong>IDC access</strong></div>
            <div className="nexus-guide-visual-panel"><span>Scope</span><strong>flow only</strong></div>
          </div>
        </>
      );
    case 'evidence':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Evidence lane</span>
            <strong>Timeline before action</strong>
          </div>
          <div className="nexus-guide-timeline">
            <span><b>10:01</b><em>external_network timeout</em></span>
            <span><b>10:03</b><em>agent heartbeat healthy</em></span>
            <span><b>10:05</b><em>ORA-00020 sessions high</em></span>
          </div>
          <div className="nexus-guide-visual-note">Read source, vantage point, layer, and failure-domain hint.</div>
        </>
      );
    case 'actions':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Action lane</span>
            <strong>Evidence-gated control</strong>
          </div>
          <div className="nexus-guide-actionbar">
            <span className="primary">Request diagnostics</span>
            <span>Create task</span>
            <span className="locked">Restart locked</span>
          </div>
          <div className="nexus-guide-gate-list">
            <span>restart_ready</span>
            <span>stateless</span>
            <span>cooldown clear</span>
          </div>
        </>
      );
    case 'outcome':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Outcome</span>
            <strong>Teach Nexus what happened</strong>
          </div>
          <div className="nexus-guide-form-lines">
            <span><b>Verdict</b><em>Confirmed root cause</em></span>
            <span><b>Actual root</b><em>core-db-prod</em></span>
            <span><b>Action worked</b><em>Yes, after pool reset</em></span>
          </div>
        </>
      );
    case 'serviceOnboarding':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Service contract</span>
            <strong>One real operational unit</strong>
          </div>
          <div className="nexus-guide-contract">
            <span><b>service_id</b><em>idc-gateway-prod</em></span>
            <span><b>type</b><em>gateway</em></span>
            <span><b>agent</b><em>light-agent-02</em></span>
            <span><b>stage</b><em>diagnostics_ready</em></span>
          </div>
        </>
      );
    case 'databaseContract':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Database contract</span>
            <strong>Data stores are first-class</strong>
          </div>
          <div className="nexus-guide-db-card">
            <FaDatabase />
            <span>Oracle PROD</span>
            <strong>Schemas: IDC, AUDIT</strong>
            <em>ORA/TNS, sessions, locks, lag, pool usage</em>
          </div>
        </>
      );
    case 'businessFlows':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Business flow</span>
            <strong>Real user journey</strong>
          </div>
          <div className="nexus-guide-flow">
            <span>Channel</span>
            <i />
            <span>ARX auth</span>
            <i />
            <span>IDC core</span>
            <i />
            <span>Outcome</span>
          </div>
          <div className="nexus-guide-visual-note">Required and optional steps change blast radius.</div>
        </>
      );
    case 'dependencyEdges':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Dependency edge</span>
            <strong>From, purpose, scope, evidence</strong>
          </div>
          <div className="nexus-guide-edge">
            <span>lms-api</span>
            <strong>db: transactional writes</strong>
            <span>lms-oracle</span>
          </div>
          <div className="nexus-guide-gate-list">
            <span>flow_scoped</span>
            <span>timeout 2000ms</span>
            <span>ORA-00054</span>
          </div>
        </>
      );
    case 'lightAgents':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Light agents</span>
            <strong>Runtime bridge</strong>
          </div>
          <div className="nexus-guide-agent">
            <span className="pulse" />
            <div>
              <strong>agent-prod-02</strong>
              <em>heartbeat 14s ago, commands allowlisted</em>
            </div>
          </div>
          <div className="nexus-guide-visual-grid three">
            <div className="nexus-guide-visual-panel"><span>logs</span><strong>yes</strong></div>
            <div className="nexus-guide-visual-panel"><span>diagnostics</span><strong>yes</strong></div>
            <div className="nexus-guide-visual-panel accent-red"><span>shell</span><strong>no</strong></div>
          </div>
        </>
      );
    case 'sops':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>SOP governance</span>
            <strong>Indexed plus managed</strong>
          </div>
          <div className="nexus-guide-visual-grid two">
            <div className="nexus-guide-visual-panel accent-blue">
              <span>Indexed corpus</span>
              <strong>Copilot can cite</strong>
            </div>
            <div className="nexus-guide-visual-panel accent-green">
              <span>Managed registry</span>
              <strong>Admin can approve</strong>
            </div>
          </div>
          <div className="nexus-guide-visual-note">Adopt indexed-only SOPs before editing or approving.</div>
        </>
      );
    case 'rollover':
      return (
        <>
          <div className="nexus-guide-visual-topbar">
            <span>Environment rollover</span>
            <strong>Assess, test, approve, execute</strong>
          </div>
          <div className="nexus-guide-rollover">
            <span>PROD-A</span>
            <i />
            <span>PROD-B</span>
            <strong>OTP required</strong>
          </div>
          <div className="nexus-guide-gate-list">
            <span>rule match</span>
            <span>test passed</span>
            <span>reminder set</span>
          </div>
        </>
      );
    default:
      return null;
  }
};

const PageGuide: React.FC<PageGuideProps> = ({ guide }) => {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  const isNexusGuide = guide.variant === 'nexus';
  const variantClass = [
    guide.variant === 'wide' || isNexusGuide ? 'page-guide-panel--wide' : '',
    isNexusGuide ? 'page-guide-panel--nexus' : '',
  ].filter(Boolean).join(' ');

  const renderDefaultGuide = () => (
    <>
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
            {guide.workflow.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
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
    </>
  );

  const renderNexusGuide = () => (
    <>
      {guide.heroStats?.length ? (
        <div className="nexus-guide-stats" aria-label="Nexus guide highlights">
          {guide.heroStats.map((stat) => (
            <article key={stat.label} className="nexus-guide-stat">
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              {stat.detail ? <small>{stat.detail}</small> : null}
            </article>
          ))}
        </div>
      ) : null}

      {guide.visualWalkthrough?.length ? (
        <section className="nexus-guide-section">
          <div className="nexus-guide-section-heading">
            <span><FaProjectDiagram /> Guided Nexus path</span>
            <h4>Operate the whole intelligence fabric, not just the open incident</h4>
            <p>Each block points to the exact Nexus surface, the action that matters there, and the operational trap to avoid.</p>
          </div>
          <div className="nexus-guide-walkthrough">
            {guide.visualWalkthrough.map((item) => (
              <article key={item.step} className="nexus-guide-step-card">
                <div className="nexus-guide-step-copy">
                  <div className="nexus-guide-step-meta">
                    <strong>{item.step}</strong>
                    <span>{item.location}</span>
                  </div>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                  <ul className="nexus-guide-checklist">
                    {item.checklist.map((entry) => (
                      <li key={entry}><FaCheckCircle /> {entry}</li>
                    ))}
                  </ul>
                  {item.example ? <p className="nexus-guide-example"><FaBook /> {item.example}</p> : null}
                  {item.avoid ? <p className="nexus-guide-avoid"><FaExclamationTriangle /> {item.avoid}</p> : null}
                </div>
                <div className={`nexus-guide-mini nexus-guide-mini--${item.visual}`}>
                  {renderNexusVisual(item.visual)}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {guide.featureTree?.length ? (
        <section className="nexus-guide-section">
          <div className="nexus-guide-section-heading">
            <span><FaNetworkWired /> Full feature tree</span>
            <h4>The Nexus mental model</h4>
            <p>Use this tree when you are deciding where a question belongs and which record needs to be corrected.</p>
          </div>
          <div className="nexus-guide-tree">
            {guide.featureTree.map((branch) => (
              <article key={branch.title} className="nexus-guide-tree-card">
                <h5>{branch.title}</h5>
                <p>{branch.body}</p>
                <ul>
                  {branch.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {guide.decisionRules?.length ? (
        <section className="nexus-guide-section">
          <div className="nexus-guide-section-heading">
            <span><FaShieldAlt /> Decision rules</span>
            <h4>What to do, what to avoid, and when to stop</h4>
            <p>These are the rules that keep Nexus useful under pressure instead of turning it into a noisy command panel.</p>
          </div>
          <div className="nexus-guide-decision-grid">
            {guide.decisionRules.map((rule) => (
              <article key={rule.title} className="nexus-guide-decision-card">
                <h5>{rule.title}</h5>
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
                    <dt>Avoid</dt>
                    <dd>{rule.avoid}</dd>
                  </div>
                  {rule.evidence ? (
                    <div>
                      <dt>Evidence</dt>
                      <dd>{rule.evidence}</dd>
                    </div>
                  ) : null}
                </dl>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {guide.examples?.length ? (
        <section className="nexus-guide-section">
          <div className="nexus-guide-section-heading">
            <span><FaBrain /> Applicable examples</span>
            <h4>How experienced operators read Nexus</h4>
            <p>These examples show how the same evidence changes meaning when graph scope, flow scope, and source layer are read correctly.</p>
          </div>
          <div className="nexus-guide-examples">
            {guide.examples.map((example) => (
              <article key={example.title} className="nexus-guide-example-card">
                <h5>{example.title}</h5>
                <p><strong>Scenario:</strong> {example.scenario}</p>
                <p><strong>Interpretation:</strong> {example.interpretation}</p>
                <p><strong>Operator move:</strong> {example.operatorMove}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="page-guide-lower nexus-guide-lower">
        <section className="page-guide-workflow">
          <div className="page-guide-section-heading">
            <FaRoute />
            <span>{guide.workflowTitle || 'Recommended flow'}</span>
          </div>
          <ol>
            {guide.workflow.map((step, index) => (
              <li key={`${index}-${step}`}>{step}</li>
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
    </>
  );

  return (
    <>
      <button
        type="button"
        className={`page-guide-trigger ${open ? 'active' : ''} ${isNexusGuide ? 'page-guide-trigger--nexus' : ''}`}
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
            className={`page-guide-panel ${variantClass}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="page-guide-header">
              <div className='fine-div'>
                <span className="page-guide-eyebrow">{guide.eyebrow}</span>
                <h3 id={headingId}>{guide.title}</h3>
              </div>
              <div className="page-guide-header-actions">
                {guide.manualPath ? (
                  <a className="page-guide-download" href={guide.manualPath} download>
                    <FaDownload />
                    <span>{guide.manualDownloadLabel || 'Download PDF'}</span>
                  </a>
                ) : null}
                <button type="button" className="page-guide-close" onClick={() => setOpen(false)} aria-label="Close guide">
                  <FaTimes />
                </button>
              </div>
            </div>

            <p className="page-guide-intro">{guide.intro}</p>

            {isNexusGuide ? renderNexusGuide() : renderDefaultGuide()}
          </div>
        </div>
      )}
    </>
  );
};

export default PageGuide;
