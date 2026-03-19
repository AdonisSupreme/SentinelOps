// src/components/checklist/TemplateList.tsx
import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaEye, FaFilter, FaSearch, FaPlus } from 'react-icons/fa';
import { checklistApi, type ChecklistTemplate } from '../../services/checklistApi';
import TemplateManagerSkeleton from './TemplateManagerSkeleton';
import './TemplateList-New.css';
import './TextVisibilityFix.css';

interface TemplateListProps {
  onEdit: (template: ChecklistTemplate) => void;
  onDelete: (templateId: string) => void;
  onView: (template: ChecklistTemplate) => void;
}

const TemplateList: React.FC<TemplateListProps> = ({ onEdit, onDelete, onView }) => {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [shiftFilter, setShiftFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    filterTemplates();
  }, [templates, searchTerm, shiftFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await checklistApi.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filterTemplates = () => {
    let filtered = [...templates];

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (shiftFilter !== 'all') {
      filtered = filtered.filter(t => t.shift === shiftFilter);
    }

    setFilteredTemplates(filtered);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await checklistApi.deleteTemplate(deleteId);
      setTemplates(templates.filter(t => t.id !== deleteId));
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (err) {
      console.error('Failed to delete template:', err);
      setError('Failed to delete template');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getShiftColor = (shift: string) => {
    switch (shift) {
      case 'MORNING':
        return '#FFD700';
      case 'AFTERNOON':
        return '#FF8C00';
      case 'NIGHT':
        return '#4B0082';
      default:
        return '#00d9ff';
    }
  };

  if (loading) {
    return <TemplateManagerSkeleton />;
  }

  return (
    <div className="sentinel-template-list-container">
      {/* Header Controls */}
      <div className="sentinel-template-controls-wrapper">
        <div className="sentinel-search-input-wrapper">
          <FaSearch className="sentinel-search-icon" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sentinel-search-field"
          />
        </div>

        <div className="sentinel-filter-dropdown-wrapper">
          <FaFilter className="sentinel-filter-icon" />
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="sentinel-filter-select-field"
          >
            <option value="all">All Shifts</option>
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="NIGHT">Night</option>
          </select>
        </div>
      </div>

      {error && <div className="sentinel-error-message-container">{error}</div>}

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="sentinel-empty-state-container">
          <p>No templates found</p>
        </div>
      ) : (
        <div className="sentinel-templates-grid-container">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="sentinel-template-card">
              <div className="sentinel-card-header-wrapper">
                <h3 className="sentinel-template-name-text">{template.name}</h3>
                <div className="sentinel-shift-type-badge" style={{ borderColor: getShiftColor(template.shift) }}>
                  {template.shift}
                </div>
              </div>

              <p className="sentinel-template-description-text">{template.description || 'No description'}</p>

              <div className="sentinel-template-meta-wrapper">
                <span className="sentinel-meta-info-row">
                  Items: <strong>{template.items?.length || 0}</strong>
                </span>
                <span className="sentinel-meta-info-row">
                  Status: <strong>{template.is_active ? 'Active' : 'Inactive'}</strong>
                </span>
                <span className="sentinel-meta-info-row">
                  Created: <strong>{formatDate(template.created_at)}</strong>
                </span>
              </div>

              <div className="sentinel-card-actions-wrapper">
                <button
                  className="sentinel-action-button sentinel-view-action-btn"
                  onClick={() => onView(template)}
                  title="View details"
                >
                  <FaEye />
                </button>
                <button
                  className="sentinel-action-button sentinel-edit-action-btn"
                  onClick={() => onEdit(template)}
                  title="Edit template"
                >
                  <FaEdit />
                </button>
                <button
                  className="sentinel-action-button sentinel-delete-action-btn"
                  onClick={() => {
                    setDeleteId(template.id);
                    setShowDeleteConfirm(true);
                  }}
                  title="Delete template"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="sentinel-modal-backdrop-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="sentinel-delete-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Template?</h3>
            <p>This action cannot be undone.</p>
            <div className="sentinel-modal-actions-wrapper">
              <button
                className="sentinel-modal-button sentinel-cancel-modal-btn"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteId(null);
                }}
              >
                Cancel
              </button>
              <button className="sentinel-modal-button sentinel-danger-modal-btn" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateList;
