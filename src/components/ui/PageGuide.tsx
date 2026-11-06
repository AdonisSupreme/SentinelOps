import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaBook, FaTimes } from 'react-icons/fa';
import { useAccess } from '../../contexts/AccessContext';
import { operatorGuides, OperatorGuide } from '../../content/operatorGuides';
import OperatorCompanion from './OperatorCompanion';
import './OperatorCompanion.css';
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
  | 'rollover'
  | 'clearingBatch'
  | 'clearingAccount'
  | 'clearingExecution'
  | 'clearingAudit';

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
  moduleKeys?: string[];
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
  walkthroughKicker?: string;
  walkthroughTitle?: string;
  walkthroughIntro?: string;
  featureTreeKicker?: string;
  featureTreeTitle?: string;
  featureTreeIntro?: string;
  decisionKicker?: string;
  decisionTitle?: string;
  decisionIntro?: string;
  examplesKicker?: string;
  examplesTitle?: string;
  examplesIntro?: string;
}


export default function PageGuide({ guide, moduleKeys }: { guide?: PageGuideDefinition; moduleKeys?: string[] }) {
  const [open,setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const title = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const { canAccessModule, canAccessPage } = useAccess();
  const keys = moduleKeys || guide?.moduleKeys || [];
  const available = operatorGuides.filter(item => keys.includes(item.key));
  const fallback: OperatorGuide = { key:'page-reference',title:guide?.title || 'Workspace guidance',group:guide?.eyebrow || 'SentinelOps',path:location.pathname,summary:guide?.intro || '',access:'Follow the permissions and controls available to your signed-in account.',
    tasks:[{id:'workflow',title:'Use this workspace',needs:'Open the intended page and check your signed-in identity.',steps:(guide?.workflow || ['Read the page state before acting.']).map((body,index)=>({title:`Step ${index+1}`,body})),result:guide?.tip || 'Verify the saved result.',stop:'If the result is uncertain, check the record before repeating an action.'}],
    terms:(guide?.sections || []).map(section=>({term:section.title,meaning:section.body})),problems:[],sources:[] };
  const params = new URLSearchParams(location.search);
  const workspace = params.get('workspace');
  const preferred = location.pathname === '/nexus' && workspace ? `nexus.${workspace}` : location.pathname === '/reports' ? ({crb:'reports.crb',hovering:'reports.hovering',settings:'reports.hovering_settings','personal-loans':'reports.personal_loans',sms:'reports.sms'} as Record<string,string>)[workspace || 'crb'] : location.pathname === '/trustlink' ? ({rtgs:'trustlink.rtgs',history:'trustlink.run_history',pipeline:'trustlink.daily_extraction'} as Record<string,string>)[params.get('tab') || 'pipeline'] : undefined;
  const initial = available.find(item=>item.key===preferred && canAccessModule(item.key))?.key || available.find(item=>canAccessModule(item.key))?.key || available[0]?.key;
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  },[open]);
  const downloadSupplement = () => {
    const text = [fallback.title,fallback.summary,...fallback.tasks.flatMap(task=>task.steps.map(step=>step.body)),...fallback.terms.map(term=>`${term.term}: ${term.meaning}`),fallback.tasks[0].result].join('\n\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const anchor=document.createElement('a'); anchor.href=url; anchor.download='SentinelOps-workspace-guide.txt'; anchor.click(); window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <><button type="button" className="operator-guide-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(true)}><FaBook /> Operating guide</button>{open && createPortal(<div className="operator-guide-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false);}}><div ref={dialog} tabIndex={-1} className="operator-guide-dialog" role="dialog" aria-modal="true" aria-labelledby={title} onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);}
    if(event.key==='Tab'){
      const controls=Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input,select,textarea,summary,[tabindex="0"]') || []).filter(item=>!item.closest('details:not([open])') || item.tagName==='SUMMARY');
      const first=controls[0],last=controls[controls.length-1];
      if(event.shiftKey && (document.activeElement===first || document.activeElement===dialog.current)){event.preventDefault();last?.focus();}
      if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }}><header><h2 id={title}>SentinelOps operating guidance</h2><button type="button" aria-label="Close guide" onClick={()=>setOpen(false)}><FaTimes /></button></header><OperatorCompanion guides={available.length?available:[fallback]} initialKey={initial} canNavigate={item=>canAccessPage(item.path.split('?')[0]) && (item.key==='page-reference' || canAccessModule(item.key))} onDownload={available.length?undefined:downloadSupplement} onNavigate={item=>{setOpen(false);if(location.pathname!==item.path.split('?')[0] || item.path.includes('?'))navigate(item.path);}} /></div></div>,document.body)}</>;
}
