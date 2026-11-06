import React, { useEffect, useId, useRef, useState } from 'react';
import { FaArrowRight, FaBook, FaCheckCircle, FaChevronLeft, FaChevronRight, FaDownload, FaExclamationTriangle, FaSearch } from 'react-icons/fa';
import { guideEdition, guidePdf, OperatorGuide } from '../../content/operatorGuides';
import './OperatorCompanion.css';

interface Props {
  guides: OperatorGuide[];
  initialKey?: string;
  initialTask?: string;
  onNavigate?: (guide: OperatorGuide, taskId: string, step: number) => void;
  canNavigate?: (guide: OperatorGuide) => boolean;
  onDownload?: () => void;
}

/** Read-only guidance. Navigation is supplied by the workspace; no operational API is called here. */
export default function OperatorCompanion({ guides, initialKey, initialTask, onNavigate, canNavigate, onDownload }: Props) {
  const [selected, setSelected] = useState(initialKey || guides[0]?.key || '');
  const [taskId, setTaskId] = useState(initialTask || '');
  const [stepIndex, setStepIndex] = useState(0);
  const [search, setSearch] = useState('');
  const [helpSearch, setHelpSearch] = useState('');
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const guide = guides.find(item => item.key === selected) || guides[0];
  const task = guide?.tasks.find(item => item.id === taskId) || guide?.tasks[0];
  const index = Math.min(stepIndex, (task?.steps.length || 1) - 1);
  const step = task?.steps[index];
  const query = search.trim().toLowerCase();
  const matches = guides.filter(item => JSON.stringify([item.title,item.summary,item.tasks,item.terms]).toLowerCase().includes(query));
  useEffect(() => {
    setSelected(initialKey || guides[0]?.key || ''); setTaskId(initialTask || ''); setStepIndex(0);
    // Reinitialize only when the caller changes context, not on a refreshed array identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialKey, initialTask]);
  if (!guide || !task || !step) return <section className="operator-companion"><p>No guide is available for this workspace.</p></section>;
  const choose = (key: string, nextTask = '') => { setSelected(key); setTaskId(nextTask); setStepIndex(0); setHelpSearch(''); };
  const move = (next: number) => { setStepIndex(next); stepHeading.current?.focus(); };
  const problems = guide.problems.filter(item => `${item.symptom} ${item.action}`.toLowerCase().includes(helpSearch.trim().toLowerCase()));
  return <section className="operator-companion" aria-label="Operator companion">
    <header className="oc-heading"><div><span className="oc-kicker"><FaBook /> Operator companion · {guideEdition}</span><h2>What do you need to do?</h2><p>Find a task, follow the procedure, and verify the result.</p></div><div className="oc-downloads">
      {onDownload ? <button type="button" onClick={onDownload}><FaDownload /> Full manual</button> : <a href={guidePdf(guide.key)} download><FaDownload /> Download this guide</a>}
      <a href="/manual/SentinelOps_User_Manual.pdf" download>All modules PDF</a>
    </div></header>
    {guides.length > 1 && <div className="oc-picker"><label htmlFor={`${id}-search`}><FaSearch /> Find a module or operation</label><input id={`${id}-search`} type="search" placeholder="Search: requeue, handover, OTP, export…" value={search} onChange={event => setSearch(event.target.value)} />
      <div className="oc-module-list" aria-label="Module guides">{matches.map(item => <button type="button" key={item.key} aria-pressed={guide.key === item.key} onClick={() => choose(item.key)}><small>{item.group}</small><strong>{item.title}</strong><span>{item.tasks.length} procedures</span></button>)}</div>
      {query && <div className="oc-search-results" role="status">{matches.length ? `${matches.length} matching modules` : 'No matches. Try an operation name or clear the search.'}{matches.flatMap(item => item.tasks.filter(entry => JSON.stringify(entry).toLowerCase().includes(query)).map(entry => <button type="button" key={`${item.key}-${entry.id}`} onClick={() => { choose(item.key,entry.id); setSearch(''); }}>{item.title} · {entry.title}<FaArrowRight /></button>))}</div>}
    </div>}
    <div className="oc-module-heading"><span className="oc-kicker">{guide.group}</span><h3>{guide.title}</h3><p>{guide.summary}</p><details><summary>Access and authority</summary><p>{guide.access}</p><p>Access to this guidance does not grant permission to execute an operation. Follow the controls and server response in your workspace.</p></details></div>
    <div className="oc-tasks" aria-label="Guide tasks">{guide.tasks.map(entry => <button type="button" key={entry.id} aria-pressed={entry.id === task.id} onClick={() => { setTaskId(entry.id); setStepIndex(0); }}><strong>{entry.title}</strong><span>{entry.steps.length} steps</span><FaArrowRight /></button>)}</div>
    <div className="oc-prerequisite"><FaCheckCircle /><div><strong>Before you begin</strong><p>{task.needs}</p></div></div>
    <div className="oc-flow"><nav aria-label="Procedure steps">{task.steps.map((entry,i) => <button type="button" key={entry.title} aria-current={i === index ? 'step' : undefined} onClick={() => move(i)}><span>{String(i+1).padStart(2,'0')}</span><strong>{entry.title}</strong></button>)}</nav>
      <article className="oc-step"><small className="oc-kicker">Step {index+1} of {task.steps.length} · {task.title}</small><h3 ref={stepHeading} tabIndex={-1}>{step.title}</h3><p className="oc-instruction">{step.body}</p><div className="oc-stop"><FaExclamationTriangle /><div><strong>Stop and check</strong><p>{task.stop}</p></div></div>
        <div className="oc-result"><FaCheckCircle /><div><strong>How to confirm success</strong><p>{task.result}</p></div></div>
        <footer><div>{onNavigate && <button type="button" disabled={canNavigate ? !canNavigate(guide) : false} onClick={() => onNavigate(guide,task.id,index)}>Open workspace<FaArrowRight /></button>}{canNavigate && !canNavigate(guide) && <small>This workspace is outside your current access.</small>}</div><div><button type="button" aria-label="Previous guide step" disabled={index === 0} onClick={() => move(index-1)}><FaChevronLeft /></button><button type="button" disabled={index === task.steps.length-1} onClick={() => move(index+1)}>Next step<FaChevronRight /></button></div></footer>
      </article></div>
    <details className="oc-full-procedure"><summary>Read the complete procedure</summary><ol>{task.steps.map(entry => <li key={entry.title}><strong>{entry.title}</strong><p>{entry.body}</p></li>)}</ol></details>
    <section className="oc-troubleshooting"><h3>Something is blocking you?</h3><label htmlFor={`${id}-help`}>Search help for this module</label><input id={`${id}-help`} type="search" value={helpSearch} onChange={event => setHelpSearch(event.target.value)} placeholder="Search a condition or error…" />{problems.map(item => <details key={item.symptom}><summary>{item.symptom}</summary><p>{item.action}</p></details>)}{!problems.length && <p role="status">No matching guidance. Clear the search or contact the module owner with the record reference and exact error.</p>}</section>
    {guide.terms.length > 0 && <details className="oc-glossary"><summary>Terms in plain language</summary><dl>{guide.terms.map(item => <div key={item.term}><dt>{item.term}</dt><dd>{item.meaning}</dd></div>)}</dl></details>}
    <p className="oc-edition">Procedure reference · {guide.key} · Reviewed against source {guideEdition}. Downloads are reference copies; check the current guide after a deployment.</p>
  </section>;
}
