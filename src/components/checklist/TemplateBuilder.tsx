import React, { useEffect, useState } from 'react';
import { FaCheck, FaChevronDown, FaChevronUp, FaClock, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { checklistApi, type CreateChecklistTemplateRequest } from '../../services/checklistApi';
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
  normalizeItems,
  serializeItemForRequest,
  type ItemForm,
  type ScheduledEventForm,
  type SubitemForm,
} from './templateFormHelpers';
import './TemplateBuilder.css';
import './CheckboxFix.css';
import './TextVisibilityFix.css';

interface TemplateBuilderProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const TemplateBuilder: React.FC<TemplateBuilderProps> = ({ onSuccess, onCancel }) => {
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) {
      setSelectedSectionId(userSectionId);
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
        console.error('Failed to load sections for template builder:', loadError);
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
  }, [isAdmin, userSectionId]);

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
        ? 'Section is required for template creation'
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
        item.scheduled_events.filter((event) => event.event_datetime).length === 0
      ) {
        nextErrors[`item_${itemIdx}_scheduled_events`] = 'Add at least one scheduled event';
      }

      item.scheduled_events.forEach((event, eventIdx) => {
        if (!event.event_datetime) {
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
            scheduled_events: item.scheduled_events.map((event) =>
              event.id === eventId ? { ...event, ...updates } : event
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
            scheduled_events: item.scheduled_events.filter((event) => event.id !== eventId),
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
      setLoading(true);
      setError(null);
      const effectiveSectionId = isAdmin ? selectedSectionId.trim() : userSectionId;

      const templateData: CreateChecklistTemplateRequest = {
        name: name.trim(),
        description: description.trim(),
        shift,
        is_active: isActive,
        section_id: effectiveSectionId,
        items: normalizeItems(items).map(serializeItemForRequest),
      };

      await checklistApi.createTemplate(templateData);
      onSuccess();
    } catch (submitError) {
      console.error('Failed to create template:', submitError);
      setError('Failed to create template. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderTimedFields = (
    item: ItemForm | SubitemForm,
    keyPrefix: string,
    onChange: (updates: Partial<ItemForm & SubitemForm>) => void
  ) => (
    <div className="stb-type-panel">
      <div className="stb-form-row stb-two-cols">
        <div className="stb-form-group">
          <label htmlFor={`${keyPrefix}_scheduled_time`} className="stb-form-label">
            Scheduled Time
          </label>
          <input
            id={`${keyPrefix}_scheduled_time`}
            type="time"
            value={item.scheduled_time}
            onChange={(e) => onChange({ scheduled_time: e.target.value })}
            className={`stb-form-input ${errors[`${keyPrefix}_scheduled_time`] ? 'stb-error' : ''}`}
          />
          {errors[`${keyPrefix}_scheduled_time`] && (
            <span className="stb-error-text">{errors[`${keyPrefix}_scheduled_time`]}</span>
          )}
        </div>

        <div className="stb-form-group">
          <label htmlFor={`${keyPrefix}_notify_before_minutes`} className="stb-form-label">
            Notify Before (minutes)
          </label>
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
            className="stb-form-input"
            placeholder="30"
          />
        </div>
      </div>
    </div>
  );

  const renderScheduledEvents = (item: ItemForm, itemIdx: number) => (
    <div className="stb-type-panel">
      <div className="stb-panel-note">
        <FaClock />
        <span>{getItemTypeHint(item.item_type)}</span>
      </div>
      {errors[`item_${itemIdx}_scheduled_events`] && (
        <span className="stb-error-text">{errors[`item_${itemIdx}_scheduled_events`]}</span>
      )}
      <div className="stb-subitems-list">
        {item.scheduled_events.map((scheduledEvent, eventIdx) => (
          <div key={scheduledEvent.id} className="stb-subitem-card">
            <div className="stb-subitem-header">
              <span className="stb-subitem-number">Event {eventIdx + 1}</span>
              <button
                type="button"
                className="stb-delete-btn"
                onClick={() => handleRemoveScheduledEvent(item.id, scheduledEvent.id)}
              >
                <FaTrash />
              </button>
            </div>

            <div className="stb-form-row stb-two-cols">
              <div className="stb-form-group">
                <label htmlFor={`item_${item.id}_event_${scheduledEvent.id}`} className="stb-form-label">
                  Event Date & Time
                </label>
                <input
                  id={`item_${item.id}_event_${scheduledEvent.id}`}
                  type="datetime-local"
                  value={scheduledEvent.event_datetime}
                  onChange={(e) =>
                    handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                      event_datetime: e.target.value,
                    })
                  }
                  className={`stb-form-input ${errors[`item_${itemIdx}_event_${eventIdx}`] ? 'stb-error' : ''}`}
                />
                {errors[`item_${itemIdx}_event_${eventIdx}`] && (
                  <span className="stb-error-text">{errors[`item_${itemIdx}_event_${eventIdx}`]}</span>
                )}
              </div>

              <div className="stb-form-group">
                <label
                  htmlFor={`item_${item.id}_event_${scheduledEvent.id}_notify_before`}
                  className="stb-form-label"
                >
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
                  className="stb-form-input"
                />
              </div>
            </div>

            <label className="stb-checkbox-label">
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

      <button type="button" className="stb-btn-add-subitem" onClick={() => handleAddScheduledEvent(item.id)}>
        <FaPlus /> Add Scheduled Event
      </button>
    </div>
  );

  const renderItemTypeContent = (item: ItemForm, itemIdx: number) => {
    if (item.item_type === 'TIMED') {
      return (
        <>
          <div className="stb-panel-note">
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
      <div className="stb-panel-note">
        <FaClock />
        <span>{getItemTypeHint(item.item_type)}</span>
      </div>
    );
  };

  return (
    <form className="stb-template-builder" onSubmit={handleSubmit}>
      <div className="stb-builder-section">
        <h3 className="stb-section-title">Template Details</h3>

        <div className="stb-form-group">
          <label htmlFor="name" className="stb-form-label">
            Template Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Morning opening checklist"
            className={`stb-form-input ${errors.name ? 'stb-error' : ''}`}
          />
          {errors.name && <span className="stb-error-text">{errors.name}</span>}
        </div>

        <div className="stb-form-row stb-two-cols">
          <div className="stb-form-group">
            <label htmlFor="shift" className="stb-form-label">
              Shift
            </label>
            <select
              id="shift"
              value={shift}
              onChange={(e) => setShift(e.target.value as 'MORNING' | 'AFTERNOON' | 'NIGHT')}
              className="stb-form-select"
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
          </div>

          <div className="stb-form-group">
            <label htmlFor="active" className="stb-checkbox-label">
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

        <div className="stb-form-group">
          <label htmlFor="section_id" className="stb-form-label">
            Section {isAdmin ? '*' : ''}
          </label>
          {isAdmin ? (
            <>
              <select
                id="section_id"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className={`stb-form-select ${errors.section_id ? 'stb-error' : ''}`}
                disabled={sectionsLoading}
              >
                <option value="">{sectionsLoading ? 'Loading sections...' : 'Select a section'}</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.section_name}
                  </option>
                ))}
              </select>
              {errors.section_id && <span className="stb-error-text">{errors.section_id}</span>}
              {!errors.section_id && sectionsError && <span className="stb-error-text">{sectionsError}</span>}
            </>
          ) : (
            <>
              <input
                id="section_id"
                type="text"
                value={userSectionId ? 'Assigned automatically from your profile' : 'No section assigned'}
                readOnly
                className={`stb-form-input ${errors.section_id ? 'stb-error' : ''}`}
              />
              {errors.section_id && <span className="stb-error-text">{errors.section_id}</span>}
            </>
          )}
        </div>

        <div className="stb-form-group">
          <label htmlFor="description" className="stb-form-label">
            Description
          </label>
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

      <div className="stb-builder-section">
        <div className="stb-section-header">
          <h3 className="stb-section-title">Checklist Items</h3>
          <button type="button" className="stb-btn-add-item" onClick={handleAddItem}>
            <FaPlus /> Add Item
          </button>
        </div>

        {errors.items && <span className="stb-error-text">{errors.items}</span>}

        {items.length === 0 ? (
          <div className="stb-empty-items">
            <p>No items yet. Add the first checklist item to begin.</p>
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
                      <label htmlFor={`item_${item.id}_title`} className="stb-form-label">
                        Item Title *
                      </label>
                      <input
                        id={`item_${item.id}_title`}
                        type="text"
                        value={item.title}
                        onChange={(e) => handleUpdateItem(item.id, { title: e.target.value })}
                        className={`stb-form-input ${errors[`item_${itemIdx}_title`] ? 'stb-error' : ''}`}
                        placeholder="e.g., Inspect equipment status"
                      />
                      {errors[`item_${itemIdx}_title`] && (
                        <span className="stb-error-text">{errors[`item_${itemIdx}_title`]}</span>
                      )}
                    </div>

                    <div className="stb-form-group">
                      <label htmlFor={`item_${item.id}_description`} className="stb-form-label">
                        Description
                      </label>
                      <textarea
                        id={`item_${item.id}_description`}
                        value={item.description}
                        onChange={(e) => handleUpdateItem(item.id, { description: e.target.value })}
                        rows={2}
                        className="stb-form-textarea"
                        placeholder="Add operational context, evidence guidance, or expectations..."
                      />
                    </div>

                    <div className="stb-form-row stb-three-cols">
                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_type`} className="stb-form-label">
                          Type
                        </label>
                        <select
                          id={`item_${item.id}_type`}
                          value={item.item_type}
                          onChange={(e) =>
                            handleUpdateItem(item.id, {
                              item_type: e.target.value as ItemForm['item_type'],
                            })
                          }
                          className="stb-form-select"
                        >
                          {ITEM_TYPE_OPTIONS.map((itemType) => (
                            <option key={itemType} value={itemType}>
                              {itemType.replace(/_/g, ' ')}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_severity`} className="stb-form-label">
                          Severity
                        </label>
                        <input
                          id={`item_${item.id}_severity`}
                          type="number"
                          min={1}
                          max={5}
                          value={item.severity}
                          onChange={(e) => handleUpdateItem(item.id, { severity: Number(e.target.value) || 1 })}
                          className="stb-form-input"
                        />
                      </div>

                      <div className="stb-form-group">
                        <label htmlFor={`item_${item.id}_required`} className="stb-checkbox-label">
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

                    {renderItemTypeContent(item, itemIdx)}

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
                                  onClick={() => handleRemoveSubitem(item.id, subitem.id)}
                                >
                                  <FaTrash />
                                </button>
                              </div>

                              <div className="stb-form-group">
                                <label htmlFor={`subitem_${subitem.id}_title`} className="stb-form-label">
                                  Title *
                                </label>
                                <input
                                  id={`subitem_${subitem.id}_title`}
                                  type="text"
                                  value={subitem.title}
                                  onChange={(e) =>
                                    handleUpdateSubitem(item.id, subitem.id, { title: e.target.value })
                                  }
                                  className={`stb-form-input ${errors[`item_${itemIdx}_subitem_${subIdx}_title`] ? 'stb-error' : ''
                                    }`}
                                  placeholder="Subitem title"
                                />
                                {errors[`item_${itemIdx}_subitem_${subIdx}_title`] && (
                                  <span className="stb-error-text">
                                    {errors[`item_${itemIdx}_subitem_${subIdx}_title`]}
                                  </span>
                                )}
                              </div>

                              <div className="stb-form-group">
                                <label htmlFor={`subitem_${subitem.id}_description`} className="stb-form-label">
                                  Description
                                </label>
                                <textarea
                                  id={`subitem_${subitem.id}_description`}
                                  value={subitem.description}
                                  onChange={(e) =>
                                    handleUpdateSubitem(item.id, subitem.id, { description: e.target.value })
                                  }
                                  rows={2}
                                  className="stb-form-textarea"
                                  placeholder="Optional subitem guidance"
                                />
                              </div>

                              <div className="stb-form-row stb-three-cols">
                                <div className="stb-form-group">
                                  <label htmlFor={`subitem_${subitem.id}_type`} className="stb-form-label">
                                    Type
                                  </label>
                                  <select
                                    id={`subitem_${subitem.id}_type`}
                                    value={subitem.item_type}
                                    onChange={(e) =>
                                      handleUpdateSubitem(item.id, subitem.id, {
                                        item_type: e.target.value as SubitemForm['item_type'],
                                      })
                                    }
                                    className="stb-form-select"
                                  >
                                    {ITEM_TYPE_OPTIONS.map((itemType) => (
                                      <option key={itemType} value={itemType}>
                                        {itemType.replace(/_/g, ' ')}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="stb-form-group">
                                  <label htmlFor={`subitem_${subitem.id}_severity`} className="stb-form-label">
                                    Severity
                                  </label>
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
                                    className="stb-form-input"
                                  />
                                </div>

                                <div className="stb-form-group">
                                  <label htmlFor={`subitem_${subitem.id}_required`} className="stb-checkbox-label">
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

                              <div className="stb-panel-note">
                                <FaClock />
                                <span>{getItemTypeHint(subitem.item_type)}</span>
                              </div>

                              {subitem.item_type === 'TIMED' &&
                                renderTimedFields(subitem, `item_${itemIdx}_subitem_${subIdx}`, (updates) =>
                                  handleUpdateSubitem(item.id, subitem.id, updates)
                                )}
                            </div>
                          ))}
                          <button
                            type="button"
                            className="stb-btn-add-subitem"
                            onClick={() => handleAddSubitem(item.id)}
                          >
                            <FaPlus /> Add Subitem
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <button type="button" className="stb-btn-add-item" onClick={handleAddItem}>
          <FaPlus /> Add Item
        </button>
      </div>

      {error && <div className="stb-error-message">{error}</div>}

      <div className="stb-builder-actions">
        <button type="button" className="stb-btn stb-btn-secondary" onClick={onCancel} disabled={loading}>
          <FaTimes /> Cancel
        </button>
        <button type="submit" className="stb-btn stb-btn-primary" disabled={loading}>
          {loading ? 'Creating...' : <><FaCheck /> Create Template</>}
        </button>
      </div>
    </form>
  );
};

export default TemplateBuilder;
