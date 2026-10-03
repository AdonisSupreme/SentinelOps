import React from 'react';
import { DashboardSkeleton } from '../dashboard/DashboardSkeleton';
import { ChecklistsSkeleton } from '../dashboard/ChecklistsSkeleton';
import './WorkspacePreview.css';

// These contain no data or effects. Used only while an existing session restores.
export const WorkspacePreview = ({ path }: { path: string }) => {
  if (path === '/') return <DashboardSkeleton />;
  if (path === '/checklists') return <ChecklistsSkeleton />;
  return <div className="workspace-preview" role="status" aria-label="Loading workspace" aria-busy="true">
    <div className="workspace-preview-command"><span /><span /><span /></div>
    <div className="workspace-preview-body"><aside /><section>{[0,1,2,3].map(i => <div key={i}><span /><span /><span /></div>)}</section></div>
  </div>;
};
