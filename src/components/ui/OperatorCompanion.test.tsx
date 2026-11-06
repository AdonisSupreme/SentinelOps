import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import OperatorCompanion from './OperatorCompanion';
import PageGuide from './PageGuide';
import { guideGroups, operatorGuides } from '../../content/operatorGuides';
import registry from '../../policies/modules.json';

jest.mock('../../contexts/AccessContext', () => ({ useAccess: () => ({ canAccessModule:(key:string)=>key==='reports.sms',canAccessPage:()=>true }) }));
jest.mock('react-router-dom', () => ({useNavigate:()=>jest.fn(),useLocation:()=>({pathname:'/reports',search:'?workspace=sms'})}), {virtual:true});

test('every registered module has reviewed procedures, navigation and source references', () => {
  expect(operatorGuides.map(g=>g.key).sort()).toEqual(registry.map(m=>m.module_key).sort());
  operatorGuides.forEach(guide=>{
    expect(guide.path).toMatch(/^\//); expect(guide.sources.length).toBeGreaterThan(0);
    expect(new Set(guide.tasks.map(t=>t.id)).size).toBe(guide.tasks.length);
    guide.tasks.forEach(task=>{ expect(task.steps.length).toBeGreaterThan(1); expect(task.needs).toBeTruthy(); expect(task.result).toBeTruthy(); expect(task.stop).toBeTruthy(); });
  });
});

test('search finds a specific operation, resets steps and exposes correct download', () => {
  const navigate=jest.fn();
  render(<OperatorCompanion guides={operatorGuides} onNavigate={navigate} />);
  fireEvent.change(screen.getByRole('searchbox',{name:'Find a module or operation'}),{target:{value:'orphaned'}});
  fireEvent.click(screen.getByRole('button',{name:/Funds custody and clearing · Repair residual/}));
  expect(screen.getByRole('heading',{name:'Inspect exact evidence'})).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Previous guide step'})).toBeDisabled();
  fireEvent.click(screen.getByRole('button',{name:'Next step'}));
  expect(screen.getByRole('heading',{name:'Choose the eligible repair'})).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Open workspace'}));
  expect(navigate).toHaveBeenCalledWith(expect.objectContaining({key:'funds_custody.workspace'}),'cleanup',1);
  expect(screen.getByRole('link',{name:'Download this guide'})).toHaveAttribute('href','/manual/modules/funds_custody.workspace.pdf');
});

test('denied workspace remains readable but cannot navigate to an operation', () => {
  const navigate=jest.fn();
  render(<OperatorCompanion guides={operatorGuides.slice(0,1)} canNavigate={()=>false} onNavigate={navigate} />);
  const button=screen.getByRole('button',{name:'Open workspace'});
  expect(button).toBeDisabled(); fireEvent.click(button); expect(navigate).not.toHaveBeenCalled();
});

test('contextual reporting guide chooses SMS, traps focus and restores it on Escape', () => {
  render(<PageGuide moduleKeys={guideGroups.reports} />);
  const trigger=screen.getByRole('button',{name:'Operating guide'}); trigger.focus(); fireEvent.click(trigger);
  const dialog=screen.getByRole('dialog');
  expect(within(dialog).getByRole('heading',{name:'SMS queue monitoring'})).toBeInTheDocument();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(dialog,{key:'Tab',shiftKey:true});
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(dialog,{key:'Escape'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument(); expect(trigger).toHaveFocus();
  expect(document.body.style.overflow).not.toBe('hidden');
});

test('troubleshooting is searchable and does not execute operational commands', () => {
  render(<OperatorCompanion guides={operatorGuides.filter(g=>g.key==='funds_custody.workspace')} />);
  fireEvent.change(screen.getByRole('searchbox',{name:'Search help for this module'}),{target:{value:'uncertain'}});
  expect(screen.getByText('Commit uncertain means stop')).toBeInTheDocument();
  expect(screen.queryByText('Write gates closed')).not.toBeInTheDocument();
});
