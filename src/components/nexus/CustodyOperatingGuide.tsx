import React, { useState } from 'react';
import { FaArrowRight, FaBook, FaCheckCircle, FaChevronLeft, FaChevronRight, FaDownload, FaExclamationTriangle } from 'react-icons/fa';
import { pageGuides } from '../../content/pageGuides';
export type CustodyLane = 'control' | 'accounts' | 'execution' | 'audit' | 'guide';
const routes = [
  { id:'import', title:'Prepare a Finance batch', description:'Import identifiers, verify evidence, and submit the exact scope.', needs:'A Finance reference and a CSV or XLSX containing one Account or RRN column.', steps:['02','03','04','06'], lane:'control' as CustodyLane },
  { id:'accounts', title:'Investigate an account or RRN', description:'Find the right currency row and prepare a governed correction.', needs:'An external account number or transaction RRN, plus supporting authorization if preparing a correction.', steps:['05','03','04','06'], lane:'accounts' as CustodyLane },
  { id:'execution', title:'Review a submitted payload', description:'Check the sealed effects and follow the execution result.', needs:'A submitted payload, the required checker authority, and the supporting reference. Approval executes the mutation.', steps:['06','07','08'], lane:'execution' as CustodyLane },
  { id:'audit', title:'Trace an outcome or reversal', description:'Find the event, inspect its proof, and verify the recorded result.', needs:'An account, RRN, batch reference, or approximate event date. Reversal remains subject to backend eligibility.', steps:['08'], lane:'audit' as CustodyLane },
];
const destination = (step: string, fallback: CustodyLane): CustodyLane => step === '05' ? 'accounts' : step === '07' ? 'execution' : step === '08' ? 'audit' : step === '06' ? fallback === 'execution' ? 'execution' : 'control' : 'control';
const laneLabel: Record<CustodyLane,string> = {control:'Batch control',accounts:'Account explorer',execution:'Execution desk',audit:'Custody trail',guide:'Operating guide'};
interface Props { origin: CustodyLane; onNavigate:(lane:CustodyLane)=>void; onDownload:()=>void; }
export default function CustodyOperatingGuide({origin,onNavigate,onDownload}:Props) {
  const [routeId,setRouteId]=useState(origin === 'control' || origin === 'guide' ? 'import' : origin);
  const [stepIndex,setStepIndex]=useState(0);
  const [search,setSearch]=useState('');
  const guide=pageGuides.clearing;
  const route=routes.find(entry=>entry.id===routeId) || routes[0];
  const steps=route.steps.map(id=>guide.visualWalkthrough?.find(step=>step.step===id)).filter(Boolean) as NonNullable<typeof guide.visualWalkthrough>;
  const step=steps[Math.min(stepIndex,steps.length-1)];
  const rules=(guide.decisionRules || []).filter(rule=>`${rule.title} ${rule.useWhen} ${rule.doThis}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="custody-help">
    <header className="custody-help-header"><div><span className="clearing-kicker"><FaBook/> Operator companion</span><h2>What do you need to do?</h2><p>Choose a task. Follow the steps, then return to the workspace with your context intact.</p></div><button type="button" className="secondary" onClick={onDownload}><FaDownload/> Full manual</button></header>
    <div className="custody-help-routes" aria-label="Guide tasks">{routes.map(entry=><button key={entry.id} type="button" aria-pressed={entry.id===route.id} onClick={()=>{setRouteId(entry.id);setStepIndex(0);}}><strong>{entry.title}</strong><span>{entry.description}</span><FaArrowRight/></button>)}</div>
    <div className="custody-help-prerequisite"><FaCheckCircle/><div><strong>Before you begin</strong><p>{route.needs}</p></div></div>
    <div className="custody-help-flow">
      <nav aria-label="Procedure steps">{steps.map((entry,index)=><button key={entry.step} type="button" aria-current={index===stepIndex?'step':undefined} onClick={()=>setStepIndex(index)}><span>{String(index+1).padStart(2,'0')}</span><strong>{entry.title}</strong></button>)}</nav>
      <article className="custody-help-step" aria-live="polite"><span className="clearing-kicker">Step {stepIndex+1} of {steps.length} · {step.location}</span><h3>{step.title}</h3><p>{step.body}</p><ul>{step.checklist.map(entry=><li key={entry}><FaCheckCircle/><span>{entry}</span></li>)}</ul>{step.avoid&&<div className="custody-help-stop"><FaExclamationTriangle/><div><strong>Stop and check</strong><p>{step.avoid}</p></div></div>}{step.example&&<details><summary>See an example</summary><p>{step.example}</p></details>}<footer><button type="button" onClick={()=>onNavigate(destination(step.step,route.lane))}>Open {laneLabel[destination(step.step,route.lane)]}<FaArrowRight/></button><div><button type="button" className="secondary" aria-label="Previous guide step" disabled={stepIndex===0} onClick={()=>setStepIndex(stepIndex-1)}><FaChevronLeft/></button><button type="button" className="secondary" disabled={stepIndex===steps.length-1} onClick={()=>setStepIndex(stepIndex+1)}>Next step<FaChevronRight/></button></div></footer></article>
    </div>
    <section className="custody-help-troubleshooting"><div><h3>Something is blocking you?</h3><p>Find the condition you see before repeating an operation.</p></div><input type="search" aria-label="Search custody help" placeholder="Search: blocked, uncertain, gates, source…" value={search} onChange={event=>setSearch(event.target.value)}/><div>{rules.map(rule=><details key={rule.title}><summary>{rule.title}<FaChevronRight/></summary><dl><dt>When you see this</dt><dd>{rule.useWhen}</dd><dt>What to do</dt><dd>{rule.doThis}</dd><dt>Stop condition</dt><dd>{rule.avoid}</dd>{rule.evidence&&<><dt>Where to confirm</dt><dd>{rule.evidence}</dd></>}</dl></details>)}{rules.length===0&&<p role="status">No matching guidance. Try “blocked”, “gates”, or “uncertain”.</p>}</div></section>
    <details className="custody-help-reference"><summary>Operating scenarios and full custody path</summary><div className="custody-help-examples">{guide.examples?.map(example=><article key={example.title}><h4>{example.title}</h4><p>{example.scenario}</p><p>{example.interpretation}</p><strong>Next move</strong><p>{example.operatorMove}</p></article>)}</div><ol>{guide.workflow.map(entry=><li key={entry}>{entry}</li>)}</ol></details>
  </section>;
}
