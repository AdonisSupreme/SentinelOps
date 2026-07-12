// src/components/checklist/TemplateList.tsx
import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaEye, FaFilter, FaSearch } from 'react-icons/fa';
import { checklistApi, type ChecklistTemplate } from '../../services/checklistApi';
import { teamApi } from '../../services/teamApi';
import {
  DEFAULT_SHIFT_OPTIONS,
  buildShiftOptions,
  getShiftColor,
  getShiftLabel,
  normalizeShiftCode,
  type ShiftOption,
} from '../../utils/shiftUtils';
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
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>(DEFAULT_SHIFT_OPTIONS);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    let filtered = [...templates];

    if (searchTerm) {
      filtered = filtered.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (shiftFilter !== 'all') {
      filtered = filtered.filter(t => normalizeShiftCode(t.shift) === shiftFilter);
    }

    setFilteredTemplates(filtered);
  }, [templates, searchTerm, shiftFilter]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, configuredShifts] = await Promise.all([
        checklistApi.getTemplates(),
        teamApi.listShifts().catch((shiftError) => {
          console.warn('Failed to load configured shifts for template list:', shiftError);
          return [];
        }),
      ]);
      setTemplates(data);
      setShiftOptions(buildShiftOptions(configuredShifts, data.map((template) => template.shift)));
    } catch (err) {
      console.error('Failed to load templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
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

  const getSubitemCount = (template: ChecklistTemplate) =>
    template.items?.reduce((count, item) => count + (item.subitems?.length || 0), 0) || 0;

  const getTemplateTypeLine = (template: ChecklistTemplate) => {
    const types = Array.from(new Set((template.items || []).map((item) => (item.item_type || 'ROUTINE').replace(/_/g, ' '))));
    return types.length > 0 ? types.slice(0, 3).join(' / ') : 'No items drafted';
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
            {shiftOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
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
                <div className="sentinel-shift-type-badge" style={{ borderColor: getShiftColor(template.shift, shiftOptions) }}>
                  {getShiftLabel(template.shift, shiftOptions)}
                </div>
              </div>

              <p className="sentinel-template-description-text">{template.description || 'No description'}</p>

              <div className="sentinel-template-meta-wrapper">
                <div className="sentinel-template-status-line">
                  <span className={template.is_active ? 'sentinel-live-dot' : 'sentinel-muted-dot'} />
                  <strong>{template.is_active ? 'Active template' : 'Inactive template'}</strong>
                  <span>{formatDate(template.created_at)}</span>
                </div>
                <div className="sentinel-template-blueprint-line">
                  <span>{template.items?.length || 0} items</span>
                  <span>{getSubitemCount(template)} subitems</span>
                </div>
                <p className="sentinel-template-type-line">{getTemplateTypeLine(template)}</p>
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
