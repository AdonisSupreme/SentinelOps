// src/components/checklist/TemplateList.tsx
import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaEye, FaFilter, FaSearch, FaPlus } from 'react-icons/fa';
import { checklistApi, type ChecklistTemplate } from '../../services/checklistApi';
import './TemplateList.css';

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
    return (
      <div className="template-list">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="stl-template-list">
      {/* Header Controls */}
      <div className="stl-template-controls">
        <div className="stl-search-container">
          <FaSearch className="stl-search-icon" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="stl-search-input"
          />
        </div>

        <div className="stl-filter-container">
          <FaFilter className="stl-filter-icon" />
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="stl-filter-select"
          >
            <option value="all">All Shifts</option>
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="NIGHT">Night</option>
          </select>
        </div>
      </div>

      {error && <div className="stl-error-message">{error}</div>}

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="stl-empty-state">
          <p>No templates found</p>
        </div>
      ) : (
        <div className="stl-templates-grid">
          {filteredTemplates.map((template) => (
            <div key={template.id} className="stl-template-card">
              <div className="stl-card-header">
                <h3 className="stl-template-name">{template.name}</h3>
                <div className="stl-shift-badge" style={{ borderColor: getShiftColor(template.shift) }}>
                  {template.shift}
                </div>
              </div>

              <p className="stl-template-description">{template.description || 'No description'}</p>

              <div className="stl-template-meta">
                <span className="stl-meta-item">
                  Items: <strong>{template.items?.length || 0}</strong>
                </span>
                <span className="stl-meta-item">
                  Status: <strong>{template.is_active ? 'Active' : 'Inactive'}</strong>
                </span>
                <span className="stl-meta-item">
                  Created: <strong>{formatDate(template.created_at)}</strong>
                </span>
              </div>

              <div className="stl-card-actions">
                <button
                  className="stl-action-btn stl-view-btn"
                  onClick={() => onView(template)}
                  title="View details"
                >
                  <FaEye />
                </button>
                <button
                  className="stl-action-btn stl-edit-btn"
                  onClick={() => onEdit(template)}
                  title="Edit template"
                >
                  <FaEdit />
                </button>
                <button
                  className="stl-action-btn stl-delete-btn"
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
        <div className="stl-modal-backdrop" onClick={() => setShowDeleteConfirm(false)}>
          <div className="stl-delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Template?</h3>
            <p>This action cannot be undone.</p>
            <div className="stl-modal-actions">
              <button
                className="stl-btn stl-btn-cancel"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteId(null);
                }}
              >
                Cancel
              </button>
              <button className="stl-btn stl-btn-danger" onClick={handleDelete}>
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
