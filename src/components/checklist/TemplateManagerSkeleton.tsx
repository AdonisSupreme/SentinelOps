import React from 'react';
import { FaFilter, FaSearch } from 'react-icons/fa';
import './TemplateManagerSkeleton.css';

const TemplateManagerSkeleton: React.FC = () => {
  return (
    <div className="sentinel-template-list-container stm-skeleton stm-skeleton-command">
      <div className="stl-template-controls stm-skeleton-controls">
        <div className="stl-search-container skeleton-search-shell">
          <FaSearch className="stl-search-icon skeleton-icon" />
          <div className="skeleton skeleton-search-input" />
        </div>
        <div className="stl-filter-container skeleton-filter-shell">
          <FaFilter className="stl-filter-icon skeleton-icon" />
          <div className="skeleton skeleton-filter-select" />
        </div>
      </div>

      <div className="stl-templates-grid stm-skeleton-grid">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="stl-template-card stm-skeleton-card">
            <div className="stl-card-header">
              <div className="skeleton skeleton-template-name" />
              <div className="skeleton skeleton-shift-badge" />
            </div>
            <div className="skeleton skeleton-description" />
            <div className="stm-skeleton-blueprint">
              <div className="skeleton skeleton-status-line" />
              <div className="skeleton skeleton-chip-row" />
              <div className="skeleton skeleton-type-line" />
            </div>
            <div className="stl-card-actions">
              <div className="skeleton skeleton-action-btn" />
              <div className="skeleton skeleton-action-btn" />
              <div className="skeleton skeleton-action-btn" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateManagerSkeleton;
