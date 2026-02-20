// src/components/checklist/TemplateEditor.tsx
import React, { useState, useEffect } from 'react';
import { FaPlus, FaTrash, FaChevronDown, FaChevronUp, FaCheck, FaTimes } from 'react-icons/fa';
import {
  checklistApi,
  type ChecklistTemplate,
  type UpdateChecklistTemplateRequest,
  type CreateTemplateItemRequest,
  type CreateTemplateSubitemRequest,
} from '../../services/checklistApi';
import './TemplateEditor.css';

interface TemplateEditorProps {
  template: ChecklistTemplate;
  onSuccess: () => void;
  onCancel: () => void;
}

interface SubitemForm {
  id: string;
  title: string;
  description: string;
  item_type: 'ROUTINE' | 'TIMED' | 'SCHEDULED_EVENT' | 'CONDITIONAL' | 'INFORMATIONAL';
  is_required: boolean;
  severity: number;
  sort_order: number;
}

interface ItemForm {
  id: string;
  title: string;
  description: string;
  item_type: 'ROUTINE' | 'TIMED' | 'SCHEDULED_EVENT' | 'CONDITIONAL' | 'INFORMATIONAL';
  is_required: boolean;
  severity: number;
  sort_order: number;
  subitems: SubitemForm[];
  expanded: boolean;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shift, setShift] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('MORNING');
  const [is_active, setIsActive] = useState(true);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load template data
  useEffect(() => {
    const loadTemplate = () => {
      setName(template.name);
      setDescription(template.description || '');
      setShift(template.shift);
      setIsActive(template.is_active);

      if (template.items) {
        const loadedItems: ItemForm[] = template.items.map((item, idx) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          item_type: item.item_type,
          is_required: item.is_required,
          severity: item.severity,
          sort_order: item.sort_order,
          subitems: (item.subitems || []).map((sub) => ({
            id: sub.id,
            title: sub.title,
            description: sub.description,
            item_type: sub.item_type,
            is_required: sub.is_required,
            severity: sub.severity,
            sort_order: sub.sort_order,
          })),
          expanded: true,
        }));
        setItems(loadedItems);
      }

      setLoading(false);
    };

    loadTemplate();
  }, [template]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!shift) {
      newErrors.shift = 'Shift is required';
    }

    items.forEach((item, idx) => {
      if (!item.title.trim()) {
        newErrors[`item_${idx}_title`] = 'Item title is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddItem = () => {
    const newItem: ItemForm = {
      id: Date.now().toString(),
      title: '',
      description: '',
      item_type: 'ROUTINE',
      is_required: true,
      severity: 1,
      sort_order: items.length,
      subitems: [],
      expanded: true,
    };
    setItems([...items, newItem]);
  };

  const handleRemoveItem = (itemId: string) => {
    setItems(items.filter(item => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ItemForm>) => {
    setItems(
      items.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  };

  const handleAddSubitem = (itemId: string) => {
    setItems(
      items.map(item => {
        if (item.id === itemId) {
          const newSubitem: SubitemForm = {
            id: Date.now().toString(),
            title: '',
            description: '',
            item_type: 'ROUTINE',
            is_required: false,
            severity: 1,
            sort_order: item.subitems.length,
          };
          return { ...item, subitems: [...item.subitems, newSubitem] };
        }
        return item;
      })
    );
  };

  const handleRemoveSubitem = (itemId: string, subitemId: string) => {
    setItems(
      items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            subitems: item.subitems.filter(sub => sub.id !== subitemId),
          };
        }
        return item;
      })
    );
  };

  const handleUpdateSubitem = (
    itemId: string,
    subitemId: string,
    updates: Partial<SubitemForm>
  ) => {
    setItems(
      items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            subitems: item.subitems.map(sub =>
              sub.id === subitemId ? { ...sub, ...updates } : sub
            ),
          };
        }
        return item;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const updateData: UpdateChecklistTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        shift,
        is_active,
      };

      await checklistApi.updateTemplate(template.id, updateData);
      onSuccess();
    } catch (err) {
      console.error('Failed to update template:', err);
      setError('Failed to update template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="template-editor">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <form className="template-editor" onSubmit={handleSubmit}>
      {/* Template Details */}
      <div className="editor-section">
        <h3 className="section-title">Template Details</h3>

        <div className="form-group">
          <label htmlFor="name">Template Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) {
                const newErrors = { ...errors };
                delete newErrors.name;
                setErrors(newErrors);
              }
            }}
            placeholder="e.g., Morning Opening Checklist"
            className={`form-input ${errors.name ? 'error' : ''}`}
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="shift">Shift *</label>
            <select
              id="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value as any)}
              className={`form-select ${errors.shift ? 'error' : ''}`}
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
            {errors.shift && <span className="error-text">{errors.shift}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="active">
              <input
                id="active"
                type="checkbox"
                checked={is_active}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this template..."
            rows={3}
            className="form-textarea"
          />
        </div>
      </div>

      {/* Items Section */}
      <div className="editor-section">
        <div className="section-header">
          <h3 className="section-title">Checklist Items</h3>
          <button
            type="button"
            className="btn-add-item"
            onClick={handleAddItem}
            title="Add new item"
          >
            <FaPlus /> Add Item
          </button>
        </div>

        {items.length === 0 ? (
          <div className="empty-items">
            <p>No items. Click "Add Item" to add new checklist items.</p>
          </div>
        ) : (
          <div className="items-list">
            {items.map((item, itemIdx) => (
              <div key={item.id} className="item-card">
                <div className="item-header">
                  <button
                    type="button"
                    className="expand-btn"
                    onClick={() => handleUpdateItem(item.id, { expanded: !item.expanded })}
                  >
                    {item.expanded ? <FaChevronUp /> : <FaChevronDown />}
                  </button>
                  <span className="item-number">Item {itemIdx + 1}</span>
                  <button
                    type="button"
                    className="delete-btn"
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remove item"
                  >
                    <FaTrash />
                  </button>
                </div>

                {item.expanded && (
                  <div className="item-content">
                    <div className="form-group">
                      <label htmlFor={`item_${item.id}_title`}>Item Title *</label>
                      <input
                        id={`item_${item.id}_title`}
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                        placeholder="e.g., Check equipment status"
                        className={`form-input ${errors[`item_${itemIdx}_title`] ? 'error' : ''}`}
                      />
                      {errors[`item_${itemIdx}_title`] && (
                        <span className="error-text">{errors[`item_${itemIdx}_title`]}</span>
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor={`item_${item.id}_description`}>Description</label>
                      <textarea
                        id={`item_${item.id}_description`}
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                        placeholder="Provide details about this item..."
                        rows={2}
                        className="form-textarea"
                      />
                    </div>

                    <div className="form-row three-cols">
                      <div className="form-group">
                        <label htmlFor={`item_${item.id}_type`}>Type</label>
                        <select
                          id={`item_${item.id}_type`}
                          value={item.item_type}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              item_type: e.target.value as any,
                            })
                          }
                          className="form-select"
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="TIMED">Timed</option>
                          <option value="SCHEDULED_EVENT">Scheduled Event</option>
                          <option value="CONDITIONAL">Conditional</option>
                          <option value="INFORMATIONAL">Informational</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label htmlFor={`item_${item.id}_severity`}>Severity</label>
                        <input
                          id={`item_${item.id}_severity`}
                          type="number"
                          min={1}
                          max={5}
                          value={item.severity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { severity: parseInt(e.target.value) })
                          }
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor={`item_${item.id}_required`}>
                          <input
                            id={`item_${item.id}_required`}
                            type="checkbox"
                            checked={item.is_required}
                            onChange={(e) =>
                              handleUpdateItem(item.id, { is_required: e.target.checked })
                            }
                          />
                          Required
                        </label>
                      </div>
                    </div>

                    {/* Subitems */}
                    <div className="subitems-section">
                      <div className="subitems-header">
                        <h4>Subitems</h4>
                        <button
                          type="button"
                          className="btn-add-subitem"
                          onClick={() => handleAddSubitem(item.id)}
                        >
                          <FaPlus /> Add Subitem
                        </button>
                      </div>

                      {item.subitems.length === 0 ? (
                        <p className="empty-subitems">No subitems yet</p>
                      ) : (
                        <div className="subitems-list">
                          {item.subitems.map((subitem, subIdx) => (
                            <div key={subitem.id} className="subitem-card">
                              <div className="subitem-header">
                                <span className="subitem-number">Sub {subIdx + 1}</span>
                                <button
                                  type="button"
                                  className="delete-btn"
                                  onClick={() =>
                                    handleRemoveSubitem(item.id, subitem.id)
                                  }
                                >
                                  <FaTrash />
                                </button>
                              </div>

                              <div className="form-group">
                                <label htmlFor={`subitem_${subitem.id}_title`}>Title</label>
                                <input
                                  id={`subitem_${subitem.id}_title`}
                                  type="text"
                                  value={subitem.title}
                                  onChange={(e) =>
                                    handleUpdateSubitem(item.id, subitem.id, {
                                      title: e.target.value,
                                    })
                                  }
                                  placeholder="Subitem title"
                                  className="form-input"
                                />
                              </div>

                              <div className="form-row two-cols">
                                <div className="form-group">
                                  <label htmlFor={`subitem_${subitem.id}_type`}>Type</label>
                                  <select
                                    id={`subitem_${subitem.id}_type`}
                                    value={subitem.item_type}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
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
                                  <label htmlFor={`subitem_${subitem.id}_required`}>
                                    <input
                                      id={`subitem_${subitem.id}_required`}
                                      type="checkbox"
                                      checked={subitem.is_required}
                                      onChange={(e) =>
                                        handleUpdateSubitem(item.id, subitem.id, {
                                          is_required: e.target.checked,
                                        })
                                      }
                                    />
                                    Required
                                  </label>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && <div className="error-message">{error}</div>}

      {/* Actions */}
      <div className="editor-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          <FaTimes /> Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={saving}
        >
          {saving ? 'Updating...' : <><FaCheck /> Update Template</>}
        </button>
      </div>
    </form>
  );
};

export default TemplateEditor;
