import React, { useEffect, useState } from 'react';
import { FaCheck, FaChevronDown, FaChevronUp, FaClock, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { checklistApi, type ChecklistTemplate, type UpdateChecklistTemplateRequest } from '../../services/checklistApi';
import { useAuth } from '../../contexts/AuthContext';
import { orgApi, type Section } from '../../services/orgApi';
import {
  ITEM_TYPE_OPTIONS,
  applyItemTypeRules,
  applySubitemTypeRules,
  createEmptyItem,
  createEmptyScheduledEvent,
  createEmptySubitem,
  getItemTypeHint,
  mapTemplateItemToForm,
  normalizeItems,
  serializeItemForRequest,
  type ItemForm,
  type ScheduledEventForm,
  type SubitemForm,
} from './templateFormHelpers';
import './TemplateEditor.css';
import './CheckboxFix.css';
import './TextVisibilityFix.css';

interface TemplateEditorProps {
  template: ChecklistTemplate;
  onSuccess: () => void;
  onCancel: () => void;
}

const TemplateEditor: React.FC<TemplateEditorProps> = ({ template, onSuccess, onCancel }) => {
  const { user } = useAuth();
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const userSectionId = user?.section_id || '';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shift, setShift] = useState<'MORNING' | 'AFTERNOON' | 'NIGHT'>('MORNING');
  const [isActive, setIsActive] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [items, setItems] = useState<ItemForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setName(template.name);
    setDescription(template.description || '');
    setShift(template.shift);
    setIsActive(template.is_active);
    setSelectedSectionId(isAdmin ? template.section_id || '' : userSectionId || template.section_id || '');
    setItems(normalizeItems((template.items || []).map(mapTemplateItemToForm)));
    setLoading(false);
  }, [template, isAdmin, userSectionId]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    let mounted = true;
    const loadSections = async () => {
      try {
        setSectionsLoading(true);
        setSectionsError(null);
        const data = await orgApi.listSections();
        if (!mounted) return;
        setSections(data);
      } catch (loadError) {
        console.error('Failed to load sections for template editor:', loadError);
        if (mounted) {
          setSectionsError('Failed to load sections');
        }
      } finally {
        if (mounted) {
          setSectionsLoading(false);
        }
      }
    };

    void loadSections();
    return () => {
      mounted = false;
    };
  }, [isAdmin]);

  const updateItems = (nextItems: ItemForm[]) => {
    setItems(normalizeItems(nextItems));
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    const effectiveSectionId = isAdmin ? selectedSectionId.trim() : userSectionId;

    if (!name.trim()) {
      nextErrors.name = 'Template name is required';
    }

    if (!effectiveSectionId) {
      nextErrors.section_id = isAdmin
        ? 'Section is required for template updates'
        : 'Your profile is not assigned to a section';
    }

    if (items.length === 0) {
      nextErrors.items = 'At least one checklist item is required';
    }

    items.forEach((item, itemIdx) => {
      if (!item.title.trim()) {
        nextErrors[`item_${itemIdx}_title`] = 'Item title is required';
      }

      if (item.item_type === 'TIMED' && !item.scheduled_time) {
        nextErrors[`item_${itemIdx}_scheduled_time`] = 'Timed items need a scheduled time';
      }

      if (
        item.item_type === 'SCHEDULED_EVENT' &&
        item.scheduled_events.filter((scheduledEvent) => scheduledEvent.event_datetime).length === 0
      ) {
        nextErrors[`item_${itemIdx}_scheduled_events`] = 'Add at least one scheduled event';
      }

      item.scheduled_events.forEach((scheduledEvent, eventIdx) => {
        if (!scheduledEvent.event_datetime) {
          nextErrors[`item_${itemIdx}_event_${eventIdx}`] = 'Event date and time is required';
        }
      });

      item.subitems.forEach((subitem, subIdx) => {
        if (!subitem.title.trim()) {
          nextErrors[`item_${itemIdx}_subitem_${subIdx}_title`] = 'Subitem title is required';
        }

        if (subitem.item_type === 'TIMED' && !subitem.scheduled_time) {
          nextErrors[`item_${itemIdx}_subitem_${subIdx}_scheduled_time`] = 'Timed subitems need a scheduled time';
        }
      });
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleAddItem = () => updateItems([...items, createEmptyItem(items.length)]);

  const handleRemoveItem = (itemId: string) => {
    updateItems(items.filter((item) => item.id !== itemId));
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ItemForm>) => {
    updateItems(
      items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        const nextItem = { ...item, ...updates };
        return 'item_type' in updates ? applyItemTypeRules(nextItem) : nextItem;
      })
    );
  };

  const handleAddSubitem = (itemId: string) => {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, subitems: [...item.subitems, createEmptySubitem(item.subitems.length)] }
          : item
      )
    );
  };

  const handleRemoveSubitem = (itemId: string, subitemId: string) => {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, subitems: item.subitems.filter((subitem) => subitem.id !== subitemId) }
          : item
      )
    );
  };

  const handleUpdateSubitem = (
    itemId: string,
    subitemId: string,
    updates: Partial<SubitemForm>
  ) => {
    updateItems(
      items.map((item) => {
        if (item.id !== itemId) {
          return item;
        }

        return {
          ...item,
          subitems: item.subitems.map((subitem) => {
            if (subitem.id !== subitemId) {
              return subitem;
            }

            const nextSubitem = { ...subitem, ...updates };
            return 'item_type' in updates ? applySubitemTypeRules(nextSubitem) : nextSubitem;
          }),
        };
      })
    );
  };

  const handleAddScheduledEvent = (itemId: string) => {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, scheduled_events: [...item.scheduled_events, createEmptyScheduledEvent()] }
          : item
      )
    );
  };

  const handleUpdateScheduledEvent = (
    itemId: string,
    eventId: string,
    updates: Partial<ScheduledEventForm>
  ) => {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              scheduled_events: item.scheduled_events.map((scheduledEvent) =>
                scheduledEvent.id === eventId ? { ...scheduledEvent, ...updates } : scheduledEvent
              ),
            }
          : item
      )
    );
  };

  const handleRemoveScheduledEvent = (itemId: string, eventId: string) => {
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              scheduled_events: item.scheduled_events.filter((scheduledEvent) => scheduledEvent.id !== eventId),
            }
          : item
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const effectiveSectionId = isAdmin ? selectedSectionId.trim() : userSectionId;

      const updateData: UpdateChecklistTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        shift,
        is_active: isActive,
        section_id: effectiveSectionId,
        items: normalizeItems(items).map(serializeItemForRequest),
      };

      await checklistApi.updateTemplate(template.id, updateData);
      onSuccess();
    } catch (submitError) {
      console.error('Failed to update template:', submitError);
      setError('Failed to update template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderTimedFields = (
    item: ItemForm | SubitemForm,
    keyPrefix: string,
    onChange: (updates: Partial<ItemForm & SubitemForm>) => void
  ) => (
    <div className="type-panel">
      <div className="form-row two-cols">
        <div className="form-group">
          <label htmlFor={`${keyPrefix}_scheduled_time`}>Scheduled Time</label>
          <input
            id={`${keyPrefix}_scheduled_time`}
            type="time"
            value={item.scheduled_time}
            onChange={(e) => onChange({ scheduled_time: e.target.value })}
            className={`form-input ${errors[`${keyPrefix}_scheduled_time`] ? 'error' : ''}`}
          />
          {errors[`${keyPrefix}_scheduled_time`] && (
            <span className="error-text">{errors[`${keyPrefix}_scheduled_time`]}</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor={`${keyPrefix}_notify_before_minutes`}>Notify Before (minutes)</label>
          <input
            id={`${keyPrefix}_notify_before_minutes`}
            type="number"
            min={0}
            value={item.notify_before_minutes}
            onChange={(e) =>
              onChange({
                notify_before_minutes: e.target.value ? Number(e.target.value) : '',
              })
            }
            className="form-input"
            placeholder="30"
          />
        </div>
      </div>
    </div>
  );

  const renderScheduledEvents = (item: ItemForm, itemIdx: number) => (
    <div className="type-panel">
      <div className="panel-note">
        <FaClock />
        <span>{getItemTypeHint(item.item_type)}</span>
      </div>
      {errors[`item_${itemIdx}_scheduled_events`] && (
        <span className="error-text">{errors[`item_${itemIdx}_scheduled_events`]}</span>
      )}
      <div className="subitems-list">
        {item.scheduled_events.map((scheduledEvent, eventIdx) => (
          <div key={scheduledEvent.id} className="subitem-card">
            <div className="subitem-header">
              <span className="subitem-number">Event {eventIdx + 1}</span>
              <button
                type="button"
                className="delete-btn"
                onClick={() => handleRemoveScheduledEvent(item.id, scheduledEvent.id)}
              >
                <FaTrash />
              </button>
            </div>

            <div className="form-row two-cols">
              <div className="form-group">
                <label htmlFor={`item_${item.id}_event_${scheduledEvent.id}`}>Event Date & Time</label>
                <input
                  id={`item_${item.id}_event_${scheduledEvent.id}`}
                  type="datetime-local"
                  value={scheduledEvent.event_datetime}
                  onChange={(e) =>
                    handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                      event_datetime: e.target.value,
                    })
                  }
                  className={`form-input ${errors[`item_${itemIdx}_event_${eventIdx}`] ? 'error' : ''}`}
                />
                {errors[`item_${itemIdx}_event_${eventIdx}`] && (
                  <span className="error-text">{errors[`item_${itemIdx}_event_${eventIdx}`]}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor={`item_${item.id}_event_${scheduledEvent.id}_notify_before`}>
                  Notify Before (minutes)
                </label>
                <input
                  id={`item_${item.id}_event_${scheduledEvent.id}_notify_before`}
                  type="number"
                  min={0}
                  value={scheduledEvent.notify_before_minutes}
                  onChange={(e) =>
                    handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                      notify_before_minutes: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  className="form-input"
                />
              </div>
            </div>

            <label>
              <input
                type="checkbox"
                className="sentinel-checkbox-input custom-checkbox"
                checked={scheduledEvent.notify_all}
                onChange={(e) =>
                  handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                    notify_all: e.target.checked,
                  })
                }
              />
              Notify all assigned participants
            </label>
          </div>
        ))}
      </div>

      <button type="button" className="btn-add-subitem" onClick={() => handleAddScheduledEvent(item.id)}>
        <FaPlus /> Add Scheduled Event
      </button>
    </div>
  );

  const renderItemTypeContent = (item: ItemForm, itemIdx: number) => {
    if (item.item_type === 'TIMED') {
      return (
        <>
          <div className="panel-note">
            <FaClock />
            <span>{getItemTypeHint(item.item_type)}</span>
          </div>
          {renderTimedFields(item, `item_${itemIdx}`, (updates) => handleUpdateItem(item.id, updates))}
        </>
      );
    }

    if (item.item_type === 'SCHEDULED_EVENT') {
      return renderScheduledEvents(item, itemIdx);
    }

    return (
      <div className="panel-note">
        <FaClock />
        <span>{getItemTypeHint(item.item_type)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="template-editor">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <form className="template-editor" onSubmit={handleSubmit}>
      <div className="editor-section">
        <h3 className="section-title">Template Details</h3>

        <div className="form-group">
          <label htmlFor="name">Template Name *</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`form-input ${errors.name ? 'error' : ''}`}
            placeholder="e.g., Morning opening checklist"
          />
          {errors.name && <span className="error-text">{errors.name}</span>}
        </div>

        <div className="form-row two-cols">
          <div className="form-group">
            <label htmlFor="shift">Shift</label>
            <select
              id="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value as 'MORNING' | 'AFTERNOON' | 'NIGHT')}
              className="form-select"
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="active">
              <input
                id="active"
                type="checkbox"
                className="sentinel-checkbox-input"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Active
            </label>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="section_id">Section {isAdmin ? '*' : ''}</label>
          {isAdmin ? (
            <>
              <select
                id="section_id"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`form-select ${errors.section_id ? 'error' : ''}`}
                disabled={sectionsLoading}
              >
                <option value="">{sectionsLoading ? 'Loading sections...' : 'Select a section'}</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.section_name}
                  </option>
                ))}
              </select>
              {errors.section_id && <span className="error-text">{errors.section_id}</span>}
              {!errors.section_id && sectionsError && <span className="error-text">{sectionsError}</span>}
            </>
          ) : (
            <>
              <input
                id="section_id"
                type="text"
                value={userSectionId ? 'Assigned automatically from your profile' : 'No section assigned'}
                readOnly
                className={`form-input ${errors.section_id ? 'error' : ''}`}
              />
              {errors.section_id && <span className="error-text">{errors.section_id}</span>}
            </>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="form-textarea"
            placeholder="Describe the purpose of this template..."
          />
        </div>
      </div>

      <div className="editor-section">
        <div className="section-header">
          <h3 className="section-title">Checklist Items</h3>
          <button type="button" className="btn-add-item" onClick={handleAddItem}>
            <FaPlus /> Add Item
          </button>
        </div>

        {errors.items && <span className="error-text">{errors.items}</span>}

        {items.length === 0 ? (
          <div className="empty-items">
            <p>No items. Add a checklist item to continue.</p>
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
                  <button type="button" className="delete-btn" onClick={() => handleRemoveItem(item.id)}>
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
                        className={`form-input ${errors[`item_${itemIdx}_title`] ? 'error' : ''}`}
                        placeholder="e.g., Inspect equipment status"
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
                        rows={2}
                        className="form-textarea"
                        placeholder="Add operational context, evidence guidance, or expectations..."
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
                              item_type: e.target.value as ItemForm['item_type'],
                            })
                          }
                          className="form-select"
                        >
                          {ITEM_TYPE_OPTIONS.map((itemType) => (
                            <option key={itemType} value={itemType}>
                              {itemType.replace(/_/g, ' ')}
                            </option>
                          ))}
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
                          onChange={(e) => handleUpdateItem(item.id, { severity: Number(e.target.value) || 1 })}
                          className="form-input"
                        />
                      </div>

                      <div className="form-group">
                        <label htmlFor={`item_${item.id}_required`}>
                          <input
                            id={`item_${item.id}_required`}
                            type="checkbox"
                            className="sentinel-checkbox-input custom-checkbox"
                            checked={item.is_required}
                            onChange={(e) => handleUpdateItem(item.id, { is_required: e.target.checked })}
                          />
                          Required
                        </label>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor={`item_${item.id}_has_exe_time`}>
                        <input
                          id={`item_${item.id}_has_exe_time`}
                          type="checkbox"
                          className="sentinel-checkbox-input custom-checkbox"
                          checked={item.has_exe_time}
                          onChange={(e) => handleUpdateItem(item.id, { has_exe_time: e.target.checked })}
                        />
                        Track execution time for this item
                      </label>
                    </div>

                    {renderItemTypeContent(item, itemIdx)}

                    <div className="subitems-section">
                      <div className="subitems-header">
                        <h4>Subitems</h4>
                        <button type="button" className="btn-add-subitem" onClick={() => handleAddSubitem(item.id)}>
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
                                  onClick={() => handleRemoveSubitem(item.id, subitem.id)}
                                >
                                  <FaTrash />
                                </button>
                              </div>

                              <div className="form-group">
                                <label htmlFor={`subitem_${subitem.id}_title`}>Title *</label>
                                <input
                                  id={`subitem_${subitem.id}_title`}
                                  type="text"
                                  value={subitem.title}
                                  onChange={(e) =>
                                    handleUpdateSubitem(item.id, subitem.id, { title: e.target.value })
                                  }
                                  className={`form-input ${
                                    errors[`item_${itemIdx}_subitem_${subIdx}_title`] ? 'error' : ''
                                  }`}
                                  placeholder="Subitem title"
                                />
                                {errors[`item_${itemIdx}_subitem_${subIdx}_title`] && (
                                  <span className="error-text">
                                    {errors[`item_${itemIdx}_subitem_${subIdx}_title`]}
                                  </span>
                                )}
                              </div>

                              <div className="form-group">
                                <label htmlFor={`subitem_${subitem.id}_description`}>Description</label>
                                <textarea
                                  id={`subitem_${subitem.id}_description`}
                                  value={subitem.description}
                                  onChange={(e) =>
                                    handleUpdateSubitem(item.id, subitem.id, { description: e.target.value })
                                  }
                                  rows={2}
                                  className="form-textarea"
                                  placeholder="Optional subitem guidance"
                                />
                              </div>

                              <div className="form-row three-cols">
                                <div className="form-group">
                                  <label htmlFor={`subitem_${subitem.id}_type`}>Type</label>
                                  <select
                                    id={`subitem_${subitem.id}_type`}
                                    value={subitem.item_type}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
                                        item_type: e.target.value as SubitemForm['item_type'],
                                      })
                                    }
                                    className="form-select"
                                  >
                                    {ITEM_TYPE_OPTIONS.map((itemType) => (
                                      <option key={itemType} value={itemType}>
                                        {itemType.replace(/_/g, ' ')}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="form-group">
                                  <label htmlFor={`subitem_${subitem.id}_severity`}>Severity</label>
                                  <input
                                    id={`subitem_${subitem.id}_severity`}
                                    type="number"
                                    min={1}
                                    max={5}
                                    value={subitem.severity}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
                                        severity: Number(e.target.value) || 1,
                                      })
                                    }
                                    className="form-input"
                                  />
                                </div>

                                <div className="form-group">
                                  <label htmlFor={`subitem_${subitem.id}_required`}>
                                    <input
                                      id={`subitem_${subitem.id}_required`}
                                      type="checkbox"
                                      className="sentinel-checkbox-input custom-checkbox"
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

                              <div className="form-group">
                                <label htmlFor={`subitem_${subitem.id}_has_exe_time`}>
                                  <input
                                    id={`subitem_${subitem.id}_has_exe_time`}
                                    type="checkbox"
                                    className="sentinel-checkbox-input custom-checkbox"
                                    checked={subitem.has_exe_time}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
                                        has_exe_time: e.target.checked,
                                      })
                                    }
                                  />
                                  Track execution time for this subitem
                                </label>
                              </div>

                              <div className="panel-note">
                                <FaClock />
                                <span>{getItemTypeHint(subitem.item_type)}</span>
                              </div>

                              {subitem.item_type === 'TIMED' &&
                                renderTimedFields(subitem, `item_${itemIdx}_subitem_${subIdx}`, (updates) =>
                                  handleUpdateSubitem(item.id, subitem.id, updates)
                                )}
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

      {error && <div className="error-message">{error}</div>}

      <div className="editor-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
          <FaTimes /> Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Updating...' : <><FaCheck /> Update Template</>}
        </button>
      </div>
    </form>
  );
};

export default TemplateEditor;
