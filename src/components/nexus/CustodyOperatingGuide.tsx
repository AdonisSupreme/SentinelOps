import React from 'react';
import OperatorCompanion from '../ui/OperatorCompanion';
import { operatorGuides } from '../../content/operatorGuides';
export type CustodyLane = 'control' | 'accounts' | 'execution' | 'audit' | 'guide';
interface Props { origin: CustodyLane; onNavigate:(lane:CustodyLane)=>void; onDownload:()=>void; }
const guides = operatorGuides.filter(guide => guide.key === 'funds_custody.workspace');
export default function CustodyOperatingGuide({origin,onNavigate,onDownload}:Props) {
  return <OperatorCompanion guides={guides} initialTask={origin === 'execution' ? 'execution' : origin === 'accounts' ? 'accounts' : origin === 'audit' ? 'audit' : 'import'} onDownload={onDownload} onNavigate={(_,task,index)=>{
    const lane: CustodyLane = task === 'audit' ? index === 1 ? 'execution' : 'audit' : task === 'execution' || task === 'policy' ? 'execution' : task === 'accounts' || task === 'cleanup' ? index === 2 ? 'control' : 'accounts' : index === 3 ? 'execution' : 'control';
    onNavigate(lane);
  }} />;
}
