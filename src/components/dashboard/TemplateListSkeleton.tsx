import React from 'react';
import '../checklist/ChecklistPageSkeleton.css';

const TemplateListSkeleton: React.FC = () => (
  <div className="qa-templates-list-skeleton">
    {[1, 2, 3].map((i) => (
      <div className="qa-template-option skeleton" key={i} style={{ marginBottom: 12 }}>
        <div className="skeleton-text skeleton-text-lg" style={{ width: 180, marginBottom: 8 }} />
        <div className="skeleton-text skeleton-text-sm" style={{ width: 120 }} />
      </div>
    ))}
  </div>
);

export default TemplateListSkeleton;
