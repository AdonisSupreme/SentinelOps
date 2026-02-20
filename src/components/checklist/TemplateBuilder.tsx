// src/components/checklist/TemplateBuilder.tsx
import React, { useState } from 'react';
import { FaPlus, FaTrash, FaChevronDown, FaChevronUp, FaCheck, FaTimes } from 'react-icons/fa';
import {
  checklistApi,
  type CreateChecklistTemplateRequest,
  type CreateTemplateItemRequest,
  type CreateTemplateSubitemRequest,
} from '../../services/checklistApi';
import './TemplateBuilder.css';

interface TemplateBuilderProps {
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

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({ onSuccess, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shift, setShift] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('MORNING');
  const [is_active, setIsActive] = useState(true);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }
    if (!shift) {
      newErrors.shift = 'Shift is required';
    }
    if (items.length === 0) {
      newErrors.items = 'At least one item is required';
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
      setLoading(true);
      setError(null);

      const templateData: CreateChecklistTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        shift,
        is_active,
        items: items.map(item => ({
          title: item.title.trim(),
          description: item.description.trim(),
          item_type: item.item_type,
          is_required: item.is_required,
          severity: item.severity,
          sort_order: item.sort_order,
          subitems: item.subitems.map(sub => ({
            title: sub.title.trim(),
            description: sub.description.trim(),
            item_type: sub.item_type,
            is_required: sub.is_required,
            severity: sub.severity,
            sort_order: sub.sort_order,
          })),
        })),
      };

      await checklistApi.createTemplate(templateData);
      onSuccess();
    } catch (err) {
      console.error('Failed to create template:', err);
      setError('Failed to create template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="stb-template-builder" onSubmit={handleSubmit}>
      {/* Template Details */}
      <div className="stb-builder-section">
        <h3 className="stb-section-title">Template Details</h3>

        <div className="stb-form-group">
          <label htmlFor="name" className="stb-form-label">Template Name *</label>
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
            className={`stb-form-input ${errors.name ? 'stb-error' : ''}`}
          />
          {errors.name && <span className="stb-error-text">{errors.name}</span>}
        </div>

        <div className="stb-form-row">
          <div className="stb-form-group">
            <label htmlFor="shift" className="stb-form-label">Shift *</label>
            <select
              id="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value as any)}
              className={`stb-form-select ${errors.shift ? 'stb-error' : ''}`}
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
            {errors.shift && <span className="stb-error-text">{errors.shift}</span>}
          </div>

          <div className="stb-form-group">
            <label htmlFor="active" className="stb-checkbox-label">
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

        <div className="stb-form-group">
          <label htmlFor="description" className="stb-form-label">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this template..."
            rows={3}
            className="stb-form-textarea"
          />
        </div>
      </div>

      {/* Items Section */}
      <div className="stb-builder-section">
        <div className="stb-section-header">
          <h3 className="stb-section-title">Checklist Items</h3>
          <button
            type="button"
            className="stb-btn-add-item"
            onClick={handleAddItem}
            title="Add new item"
          >
            <FaPlus /> Add Item
          </button>
        </div>

        {errors.items && <span className="stb-error-text">{errors.items}</span>}

        {items.length === 0 ? (
          <div className="stb-empty-items">
            <p>No items yet. Click "Add Item" to start building your checklist.</p>
          </div>
        ) : (
          <div className="stb-items-list">
            {items.map((item, itemIdx) => (
              <div key={item.id} className="stb-item-card">
                <div className="stb-item-header">
                  <button
                    type="button"
                    className="stb-expand-btn"
                    onClick={() => handleUpdateItem(item.id, { expanded: !item.expanded })}
                  >
                    {item.expanded ? <FaChevronUp /> : <FaChevronDown />}
                  </button>
                  <span className="stb-item-number">Item {itemIdx + 1}</span>
                  <button
                    type="button"
                    className="stb-delete-btn"
                    onClick={() => handleRemoveItem(item.id)}
                    title="Remove item"
                  >
                    <FaTrash />
                  </button>
                </div>

                {item.expanded && (
                  <div className="stb-item-content">
                    <div className="stb-form-group">
                      <label htmlFor={`item_${item.id}_title`} className="stb-form-label">Item Title *</label>
                      <input
                        id={`item_${item.id}_title`}
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                        placeholder="e.g., Check equipment status"
                        className={`stb-form-input ${errors[`item_${itemIdx}_title`] ? 'stb-error' : ''}`}
                      />
                      {errors[`item_${itemIdx}_title`] && (
                        <span className="stb-error-text">{errors[`item_${itemIdx}_title`]}</span>
                      )}
                    </div>

                    <div className="stb-form-group">
                      <label htmlFor={`item_${item.id}_description`} className="stb-form-label">Description</label>
                      <textarea
                        id={`item_${item.id}_description`}
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                        placeholder="Provide details about this item..."
                        rows={2}
                        className="stb-form-textarea"
                      />
                    </div>

                    <div className="stb-form-row stb-three-cols">
                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_type`} className="stb-form-label">Type</label>
                        <select
                          id={`item_${item.id}_type`}
                          value={item.item_type}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              item_type: e.target.value as any,
                            })
                          }
                          className="stb-form-select"
                        >
                          <option value="ROUTINE">Routine</option>
                          <option value="TIMED">Timed</option>
                          <option value="SCHEDULED_EVENT">Scheduled Event</option>
                          <option value="CONDITIONAL">Conditional</option>
                          <option value="INFORMATIONAL">Informational</option>
                        </select>
                      </div>

                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_severity`} className="stb-form-label">Severity</label>
                        <input
                          id={`item_${item.id}_severity`}
                          type="number"
                          min={1}
                          max={5}
                          value={item.severity}
                          onChange={(e) =>
                            handleUpdateItem(item.id, { severity: parseInt(e.target.value) })
                          }
                          className="stb-form-input"
                        />
                      </div>

                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_required`} className="stb-checkbox-label">
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
                    <div className="stb-subitems-section">
                      <div className="stb-subitems-header">
                        <h4>Subitems</h4>
                        <button
                          type="button"
                          className="stb-btn-add-subitem"
                          onClick={() => handleAddSubitem(item.id)}
                        >
                          <FaPlus /> Add Subitem
                        </button>
                      </div>

                      {item.subitems.length === 0 ? (
                        <p className="stb-empty-subitems">No subitems yet</p>
                      ) : (
                        <div className="stb-subitems-list">
                          {item.subitems.map((subitem, subIdx) => (
                            <div key={subitem.id} className="stb-subitem-card">
                              <div className="stb-subitem-header">
                                <span className="stb-subitem-number">Sub {subIdx + 1}</span>
                                <button
                                  type="button"
                                  className="stb-delete-btn"
                                  onClick={() =>
                                    handleRemoveSubitem(item.id, subitem.id)
                                  }
                                >
                                  <FaTrash />
                                </button>
                              </div>

                              <div className="stb-form-group">
                                <label htmlFor={`subitem_${subitem.id}_title`} className="stb-form-label">Title</label>
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
                                  className="stb-form-input"
                                />
                              </div>

                              <div className="stb-form-row stb-two-cols">
                                <div className="stb-form-group">
                                  <label htmlFor={`subitem_${subitem.id}_type`} className="stb-form-label">Type</label>
                                  <select
                                    id={`subitem_${subitem.id}_type`}
                                    value={subitem.item_type}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
                                        item_type: e.target.value as any,
                                      })
                                    }
                                    className="stb-form-select"
                                  >
                                    <option value="ROUTINE">Routine</option>
                                    <option value="TIMED">Timed</option>
                                    <option value="SCHEDULED_EVENT">Scheduled</option>
                                    <option value="CONDITIONAL">Conditional</option>
                                    <option value="INFORMATIONAL">Informational</option>
                                  </select>
                                </div>

                                <div className="stb-form-group">
                                  <label htmlFor={`subitem_${subitem.id}_required`} className="stb-checkbox-label">
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
      {error && <div className="stb-error-message">{error}</div>}

      {/* Actions */}
      <div className="stb-builder-actions">
        <button
          type="button"
          className="stb-btn stb-btn-secondary"
          onClick={onCancel}
          disabled={loading}
        >
          <FaTimes /> Cancel
        </button>
        <button
          type="submit"
          className="stb-btn stb-btn-primary"
          disabled={loading}
        >
          {loading ? 'Creating...' : <><FaCheck /> Create Template</>}
        </button>
      </div>
    </form>
  );
};

export default TemplateBuilder;
