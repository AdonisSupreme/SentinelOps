// src/components/checklist/SubitemModal.tsx
import React, { useState } from 'react';
import { FaPlus, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import './SubitemModal.css';

interface Subitem {
  id: string;
  title: string;
  description: string;
  item_type: 'ROUTINE' | 'TIMED' | 'SCHEDULED_EVENT' | 'CONDITIONAL' | 'INFORMATIONAL';
  is_required: boolean;
  severity: number;
}

interface SubitemModalProps {
  isOpen: boolean;
  subitems: Subitem[];
  onAdd: (subitem: Omit<Subitem, 'id'>) => void;
  onDelete: (subitemId: string) => void;
  onClose: () => void;
}

const SubitemModal: React.FC<SubitemModalProps> = ({
  isOpen,
  subitems,
  onAdd,
  onDelete,
  onClose,
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    item_type: 'ROUTINE' as const,
    is_required: false,
    severity: 1,
  });

  const handleAddSubitem = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title.trim()) {
      onAdd(formData);
      setFormData({
        title: '',
        description: '',
        item_type: 'ROUTINE',
        is_required: false,
        severity: 1,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="subitem-modal-backdrop" onClick={onClose}>
      <div className="subitem-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h3>Manage Subitems</h3>
          <button className="close-btn" onClick={onClose} title="Close">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Add Subitem Form */}
          <div className="add-subitem-form">
            <h4>Add New Subitem</h4>
            <form onSubmit={handleAddSubitem}>
              <div className="form-group">
                <label htmlFor="title">Title *</label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Subitem title"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Brief description"
                  rows={2}
                  className="form-textarea"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="type">Type</label>
                  <select
                    id="type"
                    value={formData.item_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        item_type: e.target.value as any,
                      })
                    }
                    className="form-select"
                  >
                    <option value="ROUTINE">Routine</option>
                    <option value="TIMED">Timed</option>
                    <option value="SCHEDULED_EVENT">Scheduled</option>
                    <option value="CONDITIONAL">Conditional</option>
                    <option value="INFORMATIONAL">Informational</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="severity">Severity</label>
                  <input
                    id="severity"
                    type="number"
                    min={1}
                    max={5}
                    value={formData.severity}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        severity: parseInt(e.target.value),
                      })
                    }
                    className="form-input"
                  />
                </div>

                <div className="form-group checkbox-group">
                  <label htmlFor="required">
                    <input
                      id="required"
                      type="checkbox"
                      checked={formData.is_required}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_required: e.target.checked,
                        })
                      }
                    />
                    Required
                  </label>
                </div>
              </div>

              <button type="submit" className="btn-add-subitem-form">
                <FaPlus /> Add Subitem
              </button>
            </form>
          </div>

          {/* Subitems List */}
          {subitems.length === 0 ? (
            <div className="empty-subitems-list">
              <p>No subitems yet. Add one above to get started.</p>
            </div>
          ) : (
            <div className="subitems-list">
              <h4>Current Subitems ({subitems.length})</h4>
              <div className="subitem-items">
                {subitems.map((subitem) => (
                  <div key={subitem.id} className="subitem-item">
                    <div className="subitem-info">
                      <h5>{subitem.title}</h5>
                      {subitem.description && (
                        <p className="subitem-desc">{subitem.description}</p>
                      )}
                      <div className="subitem-meta">
                        <span className="meta-badge">{subitem.item_type}</span>
                        <span className="meta-badge severity">
                          {"⚠".repeat(subitem.severity)}
                        </span>
                        {subitem.is_required && (
                          <span className="meta-badge required">Required</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="btn-delete-subitem"
                      onClick={() => onDelete(subitem.id)}
                      title="Delete subitem"
                    >
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubitemModal;
