// src/pages/TemplateManagerPage.tsx
import React, { useState } from 'react';
import { FaPlus, FaClipboardList } from 'react-icons/fa';
import SentinelTemplateList from '../components/checklist/TemplateList';
import TemplateBuilder from '../components/checklist/TemplateBuilder';
import TemplateEditor from '../components/checklist/TemplateEditor';
import type { ChecklistTemplate } from '../services/checklistApi';
import './TemplateManagerPage.css';

type View = 'list' | 'create' | 'edit' | 'view';

const SentinelTemplateManagerPage: React.FC = () => {
  const [view, setView] = useState<View>('list');
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);

  const handleShowCreate = () => {
    setView('create');
  };

  const handleShowList = () => {
    setView('list');
    setSelectedTemplate(null);
  };

  const handleEditTemplate = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setView('edit');
  };

  const handleViewTemplate = (template: ChecklistTemplate) => {
    setSelectedTemplate(template);
    setView('view');
  };

  const handleDeleteTemplate = (templateId: string) => {
    // After deletion, refresh to list
    handleShowList();
  };

  const handleCreateSuccess = () => {
    handleShowList();
  };

  const handleEditSuccess = () => {
    handleShowList();
  };

  const handleCancel = () => {
    handleShowList();
  };

  return (
    <div className="stm-template-manager-page">
      {/* Header */}
      <div className="stm-template-header">
        <div className="stm-header-content">
          <h1>
            <FaClipboardList className="stm-header-icon" />
            Sentinel Template Manager
          </h1>
          <p className="stm-header-subtitle">Create and manage advanced checklist templates for your SentinelOps team</p>
        </div>

        {/* Navigation Tabs */}
        <div className="stm-nav-tabs">
          <button
            className={`stm-nav-tab ${view === 'list' ? 'stm-active' : ''}`}
            onClick={handleShowList}
          >
            <FaClipboardList />
            Templates
          </button>
          {view !== 'create' && (
            <button
              className={`stm-nav-tab stm-create-tab`}
              onClick={handleShowCreate}
            >
              <FaPlus />
              Create Template
            </button>
          )}
        </div>
      </div>

      {/* Page Content */}
      <div className="stm-page-content">
        {/* Breadcrumb Navigation */}
        <div className="stm-breadcrumb">
          <a href="#" onClick={handleShowList} className={view === 'list' ? 'stm-active' : ''}>
            Templates
          </a>
          {view === 'create' && (
            <>
              <span className="stm-breadcrumb-sep">/</span>
              <span className="stm-breadcrumb-current">Create New Template</span>
            </>
          )}
          {view === 'edit' && (
            <>
              <span className="stm-breadcrumb-sep">/</span>
              <span className="stm-breadcrumb-current">Edit Template</span>
            </>
          )}
          {view === 'view' && (
            <>
              <span className="stm-breadcrumb-sep">/</span>
              <span className="stm-breadcrumb-current">View Template</span>
            </>
          )}
        </div>

        {/* Main Content */}
        <div className="stm-content-section">
          {view === 'list' && (
            <div className="stm-list-view">
              <div className="stm-list-header">
                <h2>Available Templates</h2>
                <button className="stm-btn-create" onClick={handleShowCreate}>
                  <FaPlus /> Create New Template
                </button>
              </div>
              <SentinelTemplateList
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
                onView={handleViewTemplate}
              />
            </div>
          )}

          {view === 'create' && (
            <div className="stm-create-view">
              <div className="stm-view-header">
                <h2>Create New Template</h2>
                <p>Build a comprehensive checklist template with items and subitems</p>
              </div>
              <TemplateBuilder
                onSuccess={handleCreateSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}

          {view === 'edit' && selectedTemplate && (
            <div className="stm-edit-view">
              <div className="stm-view-header">
                <h2>Edit Template: {selectedTemplate.name}</h2>
                <p>Update template configuration</p>
              </div>
              <TemplateEditor
                template={selectedTemplate}
                onSuccess={handleEditSuccess}
                onCancel={handleCancel}
              />
            </div>
          )}

          {view === 'view' && selectedTemplate && (
            <div className="stm-view-view">
              <div className="stm-view-header">
                <h2>{selectedTemplate.name}</h2>
                <p className="stm-view-shift">Shift: {selectedTemplate.shift}</p>
              </div>

              <div className="stm-template-details">
                <div className="stm-detail-section">
                  <h3>Description</h3>
                  <p>{selectedTemplate.description || 'No description provided'}</p>
                </div>

                <div className="stm-detail-section">
                  <h3>Status</h3>
                  <div className="stm-status-badge">
                    {selectedTemplate.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>

                {selectedTemplate.items && selectedTemplate.items.length > 0 && (
                  <div className="stm-detail-section">
                    <h3>Items ({selectedTemplate.items.length})</h3>
                    <div className="stm-items-list-view">
                      {selectedTemplate.items.map((item, idx) => (
                        <div key={item.id} className="stm-item-view">
                          <div className="stm-item-header-view">
                            <h4>
                              {idx + 1}. {item.title}
                            </h4>
                            <div className="stm-item-meta">
                              {item.is_required && (
                                <span className="stm-badge stm-required">Required</span>
                              )}
                              <span className="stm-badge stm-type">{item.item_type}</span>
                            </div>
                          </div>
                          {item.description && (
                            <p className="stm-item-description">{item.description}</p>
                          )}
                          {item.subitems && item.subitems.length > 0 && (
                            <div className="stm-subitems-list-view">
                              <p className="stm-subitems-title">Subitems:</p>
                              <ul>
                                {item.subitems.map((sub, subIdx) => (
                                  <li key={sub.id}>
                                    <span className="stm-subitem-number">
                                      {idx + 1}.{subIdx + 1}
                                    </span>
                                    <span className="stm-subitem-title">{sub.title}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="stm-view-actions">
                <button className="stm-btn stm-btn-secondary" onClick={handleShowList}>
                  Back to List
                </button>
                <button
                  className="stm-btn stm-btn-primary"
                  onClick={() => handleEditTemplate(selectedTemplate)}
                >
                  Edit Template
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SentinelTemplateManagerPage;
