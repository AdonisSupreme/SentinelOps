import React from 'react';
import { FaClipboardList, FaPlus, FaSearch, FaFilter } from 'react-icons/fa';
import './TemplateManagerSkeleton.css';

const TemplateManagerSkeleton: React.FC = () => {
  return (
    <div className="stm-template-manager-page stm-skeleton">
      {/* Header */}
      <div className="stm-template-header stm-skeleton-header">
        <div className="stm-header-content">
          <div className="skeleton skeleton-title">
            <FaClipboardList className="stm-header-icon skeleton-icon" />
          </div>
          <div className="skeleton skeleton-subtitle" />
        </div>

        {/* Navigation Tabs */}
        <div className="stm-nav-tabs">
          <div className="skeleton skeleton-tab stm-active-tab">
            <FaClipboardList className="skeleton-icon" />
          </div>
          <div className="skeleton skeleton-tab skeleton-create-tab">
            <FaPlus className="skeleton-icon" />
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="stm-page-content">
        {/* Breadcrumb Navigation */}
        <div className="stm-breadcrumb">
          <div className="skeleton skeleton-breadcrumb stm-active" />
        </div>

        {/* Main Content */}
        <div className="stm-content-section">
          <div className="stm-list-view">
            <div className="stm-list-header">
              <div className="skeleton skeleton-header-text" />
              <div className="skeleton skeleton-button" />
            </div>

            {/* Search and Filter Controls */}
            <div className="stl-template-controls stm-skeleton-controls">
              <div className="stl-search-container skeleton skeleton-search-container">
                <FaSearch className="stl-search-icon skeleton-icon" />
                <div className="skeleton skeleton-search-input" />
              </div>
              <div className="stl-filter-container skeleton skeleton-filter-container">
                <FaFilter className="stl-filter-icon skeleton-icon" />
                <div className="skeleton skeleton-filter-select" />
              </div>
            </div>

            {/* Template Cards Grid */}
            <div className="stl-templates-grid stm-skeleton-grid">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="stl-template-card stm-skeleton-card">
                  <div className="stl-card-header">
                    <div className="skeleton skeleton-template-name" />
                    <div className="skeleton skeleton-shift-badge" />
                  </div>
                  <div className="skeleton skeleton-description" />
                  <div className="stl-template-meta">
                    <div className="skeleton skeleton-meta-item" />
                    <div className="skeleton skeleton-meta-item" />
                    <div className="skeleton skeleton-meta-item" />
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
        </div>
      </div>
    </div>
  );
};

export default TemplateManagerSkeleton;
