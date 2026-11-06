import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBook, FaDownload } from 'react-icons/fa';
import { useAccess } from '../contexts/AccessContext';
import { guideEdition, guidePrinciples, operatorGuides } from '../content/operatorGuides';
import OperatorCompanion from '../components/ui/OperatorCompanion';
import '../components/ui/OperatorCompanion.css';

export default function SentinelManualPage() {
  const navigate = useNavigate();
  const { canAccessModule, canAccessPage } = useAccess();
  return <main className="operator-manual"><header><span className="oc-kicker"><FaBook /> SentinelOps field manual · {guideEdition}</span><h1>Clear guidance. Confident operations.</h1><p>All {operatorGuides.length} modules, organized around the work you need to do. Find the procedure, check its prerequisites and confirm the outcome. Workspace links respect your current access.</p><a href="/manual/SentinelOps_User_Manual.pdf" download><FaDownload /> Download complete manual</a></header>
    <details><summary>Start here · access, evidence and safe operation</summary><ol>{guidePrinciples.map(item=><li key={item}>{item}</li>)}</ol></details>
    <OperatorCompanion guides={operatorGuides} initialKey={operatorGuides.find(item=>canAccessModule(item.key))?.key} canNavigate={item=>canAccessModule(item.key) && canAccessPage(item.path.split('?')[0])} onNavigate={item=>navigate(item.path)} />
  </main>;
}
