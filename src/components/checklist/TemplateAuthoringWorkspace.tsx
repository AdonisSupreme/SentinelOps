import React, { useEffect, useMemo, useState } from 'react';
import { FaCheck, FaClock, FaLayerGroup, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import {
  ITEM_TYPE_OPTIONS,
  applyItemTypeRules,
  applySubitemTypeRules,
  createEmptyItem,
  createEmptyScheduledEvent,
  createEmptySubitem,
  getItemTypeHint,
  normalizeItems,
  type ItemForm,
  type ScheduledEventForm,
  type SubitemForm,
} from './templateFormHelpers';
import './TemplateAuthoringWorkspace.css';

interface TemplateAuthoringWorkspaceProps {
  items: ItemForm[];
  errors: Record<string, string>;
  onItemsChange: (items: ItemForm[]) => void;
}

type SavePreference = 'final' | 'locked';

const formatItemType = (itemType: string) => itemType.replace(/_/g, ' ');

const TemplateAuthoringWorkspace: React.FC<TemplateAuthoringWorkspaceProps> = ({
  items,
  errors,
  onItemsChange,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [lockedItemIds, setLockedItemIds] = useState<string[]>([]);
  const [savePreference, setSavePreference] = useState<SavePreference>('final');

  const selectedItemIndex = useMemo(
    () => items.findIndex((item) => item.id === selectedItemId),
    [items, selectedItemId]
  );
  const selectedItem = selectedItemIndex >= 0 ? items[selectedItemIndex] : null;

  useEffect(() => {
    setLockedItemIds((current) => current.filter((itemId) => items.some((item) => item.id === itemId)));
    if (selectedItemId && !items.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(null);
    }
  }, [items, selectedItemId]);

  const updateItems = (nextItems: ItemForm[]) => {
    onItemsChange(normalizeItems(nextItems));
  };

  const markItemDraft = (itemId: string) => {
    setLockedItemIds((current) => current.filter((lockedId) => lockedId !== itemId));
  };

  const itemHasErrors = (itemIdx: number) =>
    Object.keys(errors).some((key) => key === `item_${itemIdx}_title` || key.startsWith(`item_${itemIdx}_`));

  const handleAddItem = () => {
    const nextItem = createEmptyItem(items.length);
    updateItems([...items, { ...nextItem, expanded: false }]);
    setSelectedItemId(nextItem.id);
  };

  const handleRemoveItem = (itemId: string) => {
    updateItems(items.filter((item) => item.id !== itemId));
    setLockedItemIds((current) => current.filter((lockedId) => lockedId !== itemId));
    if (selectedItemId === itemId) {
      setSelectedItemId(null);
    }
  };

  const handleUpdateItem = (itemId: string, updates: Partial<ItemForm>) => {
    markItemDraft(itemId);
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
    markItemDraft(itemId);
    updateItems(
      items.map((item) =>
        item.id === itemId
          ? { ...item, subitems: [...item.subitems, createEmptySubitem(item.subitems.length)] }
          : item
      )
    );
  };

  const handleRemoveSubitem = (itemId: string, subitemId: string) => {
    markItemDraft(itemId);
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
    markItemDraft(itemId);
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
    markItemDraft(itemId);
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
    markItemDraft(itemId);
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
    markItemDraft(itemId);
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

  const handleCardKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, itemId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedItemId(itemId);
    }
  };

  const handleLockSelectedItem = () => {
    if (!selectedItem || !selectedItem.title.trim()) {
      return;
    }

    setLockedItemIds((current) =>
      current.includes(selectedItem.id) ? current : [...current, selectedItem.id]
    );
    setSelectedItemId(null);
  };

  const renderTimedFields = (
    item: ItemForm | SubitemForm,
    keyPrefix: string,
    onChange: (updates: Partial<ItemForm & SubitemForm>) => void
  ) => (
    <div className="taw-timing-grid">
      <label className="taw-field" htmlFor={`${keyPrefix}_scheduled_time`}>
        <span>Scheduled Time</span>
        <input
          id={`${keyPrefix}_scheduled_time`}
          type="time"
          value={item.scheduled_time}
          onChange={(event) => onChange({ scheduled_time: event.target.value })}
          className={`taw-input ${errors[`${keyPrefix}_scheduled_time`] ? 'taw-input-error' : ''}`}
        />
        {errors[`${keyPrefix}_scheduled_time`] && (
          <small className="taw-error-text">{errors[`${keyPrefix}_scheduled_time`]}</small>
        )}
      </label>

      <label className="taw-field" htmlFor={`${keyPrefix}_notify_before_minutes`}>
        <span>Notify Before</span>
        <input
          id={`${keyPrefix}_notify_before_minutes`}
          type="number"
          min={0}
          value={item.notify_before_minutes}
          onChange={(event) =>
            onChange({
              notify_before_minutes: event.target.value ? Number(event.target.value) : '',
            })
          }
          className="taw-input"
          placeholder="30"
        />
      </label>
    </div>
  );

  const renderItemTiming = (item: ItemForm, itemIdx: number) => {
    if (item.item_type === 'TIMED') {
      return (
        <div className="taw-type-panel">
          <div className="taw-panel-note">
            <FaClock />
            <span>{getItemTypeHint(item.item_type)}</span>
          </div>
          {renderTimedFields(item, `item_${itemIdx}`, (updates) => handleUpdateItem(item.id, updates))}
        </div>
      );
    }

    if (item.item_type === 'SCHEDULED_EVENT') {
      return (
        <div className="taw-type-panel">
          <div className="taw-panel-note">
            <FaClock />
            <span>{getItemTypeHint(item.item_type)}</span>
          </div>
          {errors[`item_${itemIdx}_scheduled_events`] && (
            <small className="taw-error-text">{errors[`item_${itemIdx}_scheduled_events`]}</small>
          )}
          <div className="taw-event-stack">
            {item.scheduled_events.map((scheduledEvent, eventIdx) => (
              <div key={scheduledEvent.id} className="taw-event-row">
                <span className="taw-event-index">Event {eventIdx + 1}</span>
                <label className="taw-field" htmlFor={`item_${item.id}_event_${scheduledEvent.id}`}>
                  <span>Date and Time</span>
                  <input
                    id={`item_${item.id}_event_${scheduledEvent.id}`}
                    type="datetime-local"
                    value={scheduledEvent.event_datetime}
                    onChange={(event) =>
                      handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                        event_datetime: event.target.value,
                      })
                    }
                    className={`taw-input ${errors[`item_${itemIdx}_event_${eventIdx}`] ? 'taw-input-error' : ''}`}
                  />
                  {errors[`item_${itemIdx}_event_${eventIdx}`] && (
                    <small className="taw-error-text">{errors[`item_${itemIdx}_event_${eventIdx}`]}</small>
                  )}
                </label>
                <label className="taw-field taw-field-small" htmlFor={`item_${item.id}_event_${scheduledEvent.id}_notify`}>
                  <span>Notify</span>
                  <input
                    id={`item_${item.id}_event_${scheduledEvent.id}_notify`}
                    type="number"
                    min={0}
                    value={scheduledEvent.notify_before_minutes}
                    onChange={(event) =>
                      handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                        notify_before_minutes: event.target.value ? Number(event.target.value) : '',
                      })
                    }
                    className="taw-input"
                  />
                </label>
                <label className="taw-check taw-event-check">
                  <input
                    type="checkbox"
                    className="sentinel-checkbox-input custom-checkbox"
                    checked={scheduledEvent.notify_all}
                    onChange={(event) =>
                      handleUpdateScheduledEvent(item.id, scheduledEvent.id, {
                        notify_all: event.target.checked,
                      })
                    }
                  />
                  Notify all
                </label>
                <button
                  type="button"
                  className="taw-icon-button taw-danger"
                  onClick={() => handleRemoveScheduledEvent(item.id, scheduledEvent.id)}
                  title="Remove scheduled event"
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="taw-secondary-action" onClick={() => handleAddScheduledEvent(item.id)}>
            <FaPlus /> Add Scheduled Event
          </button>
        </div>
      );
    }

    return (
      <div className="taw-type-panel taw-type-panel-compact">
        <div className="taw-panel-note">
          <FaClock />
          <span>{getItemTypeHint(item.item_type)}</span>
        </div>
      </div>
    );
  };

  const renderSubitems = (item: ItemForm, itemIdx: number) => (
    <div className="taw-subitem-stack">
      {item.subitems.length === 0 ? (
        <div className="taw-empty-subitems">
          <strong>No subitems locked to this item yet.</strong>
          <button type="button" className="taw-secondary-action" onClick={() => handleAddSubitem(item.id)}>
            <FaPlus /> Add Subitem
          </button>
        </div>
      ) : (
        item.subitems.map((subitem, subIdx) => (
          <div key={subitem.id} className="taw-subitem-card">
            <div className="taw-subitem-head">
              <span>Sub {String(subIdx + 1).padStart(2, '0')}</span>
              <button
                type="button"
                className="taw-icon-button taw-danger"
                onClick={() => handleRemoveSubitem(item.id, subitem.id)}
                title="Remove subitem"
              >
                <FaTrash />
              </button>
            </div>

            <label className="taw-field" htmlFor={`subitem_${subitem.id}_title`}>
              <span>Title</span>
              <input
                id={`subitem_${subitem.id}_title`}
                type="text"
                value={subitem.title}
                onChange={(event) => handleUpdateSubitem(item.id, subitem.id, { title: event.target.value })}
                className={`taw-input ${errors[`item_${itemIdx}_subitem_${subIdx}_title`] ? 'taw-input-error' : ''}`}
                placeholder="Subitem title"
              />
              {errors[`item_${itemIdx}_subitem_${subIdx}_title`] && (
                <small className="taw-error-text">{errors[`item_${itemIdx}_subitem_${subIdx}_title`]}</small>
              )}
            </label>

            <label className="taw-field" htmlFor={`subitem_${subitem.id}_description`}>
              <span>Description</span>
              <textarea
                id={`subitem_${subitem.id}_description`}
                value={subitem.description}
                onChange={(event) => handleUpdateSubitem(item.id, subitem.id, { description: event.target.value })}
                rows={2}
                className="taw-textarea"
                placeholder="Optional subitem guidance"
              />
            </label>

            <div className="taw-compact-grid">
              <label className="taw-field" htmlFor={`subitem_${subitem.id}_type`}>
                <span>Type</span>
                <select
                  id={`subitem_${subitem.id}_type`}
                  value={subitem.item_type}
                  onChange={(event) =>
                    handleUpdateSubitem(item.id, subitem.id, {
                      item_type: event.target.value as SubitemForm['item_type'],
                    })
                  }
                  className="taw-select"
                >
                  {ITEM_TYPE_OPTIONS.map((itemType) => (
                    <option key={itemType} value={itemType}>
                      {formatItemType(itemType)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="taw-field" htmlFor={`subitem_${subitem.id}_severity`}>
                <span>Severity</span>
                <input
                  id={`subitem_${subitem.id}_severity`}
                  type="number"
                  min={1}
                  max={5}
                  value={subitem.severity}
                  onChange={(event) =>
                    handleUpdateSubitem(item.id, subitem.id, {
                      severity: Number(event.target.value) || 1,
                    })
                  }
                  className="taw-input"
                />
              </label>

              <div className="taw-check-stack">
                <label className="taw-check">
                  <input
                    type="checkbox"
                    className="sentinel-checkbox-input custom-checkbox"
                    checked={subitem.is_required}
                    onChange={(event) =>
                      handleUpdateSubitem(item.id, subitem.id, {
                        is_required: event.target.checked,
                      })
                    }
                  />
                  Required
                </label>
                <label className="taw-check">
                  <input
                    type="checkbox"
                    className="sentinel-checkbox-input custom-checkbox"
                    checked={subitem.has_exe_time}
                    onChange={(event) =>
                      handleUpdateSubitem(item.id, subitem.id, {
                        has_exe_time: event.target.checked,
                      })
                    }
                  />
                  Track time
                </label>
              </div>
            </div>

            <div className="taw-panel-note taw-subitem-note">
              <FaClock />
              <span>{getItemTypeHint(subitem.item_type)}</span>
            </div>

            {subitem.item_type === 'TIMED' &&
              renderTimedFields(subitem, `item_${itemIdx}_subitem_${subIdx}`, (updates) =>
                handleUpdateSubitem(item.id, subitem.id, updates)
              )}
          </div>
        ))
      )}
    </div>
  );

  return (
    <section className="taw-authoring-section">
      <div className="taw-authoring-header">
        <div>
          <span className="taw-kicker">Template Line</span>
          <h3>Items</h3>
        </div>
        <div className="taw-authoring-controls">
          <div className="taw-preference-toggle" aria-label="Template save preference">
            <button
              type="button"
              className={savePreference === 'final' ? 'taw-active' : ''}
              onClick={() => setSavePreference('final')}
            >
              Final Save
            </button>
            <button
              type="button"
              className={savePreference === 'locked' ? 'taw-active' : ''}
              onClick={() => setSavePreference('locked')}
            >
              Lock Groups
            </button>
          </div>
          <button type="button" className="taw-primary-action" onClick={handleAddItem}>
            <FaPlus /> Add Item
          </button>
        </div>
      </div>

      {errors.items && <small className="taw-error-text taw-section-error">{errors.items}</small>}

      {items.length === 0 ? (
        <div className="taw-empty-deck">
          <FaLayerGroup />
          <strong>No items drafted yet.</strong>
          <button type="button" className="taw-primary-action" onClick={handleAddItem}>
            <FaPlus /> Add First Item
          </button>
        </div>
      ) : (
        <div className="taw-item-deck">
          {items.map((item, itemIdx) => {
            const locked = lockedItemIds.includes(item.id);
            const hasErrors = itemHasErrors(itemIdx);
            const cardTitle = item.title.trim() || 'Untitled item';

            return (
              <div
                key={item.id}
                className={`taw-item-card ${locked ? 'taw-locked' : ''} ${hasErrors ? 'taw-has-error' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedItemId(item.id)}
                onKeyDown={(event) => handleCardKeyDown(event, item.id)}
              >
                <div className="taw-item-index">{String(itemIdx + 1).padStart(2, '0')}</div>
                <div className="taw-item-card-body">
                  <div className="taw-item-tags">
                    <span>{formatItemType(item.item_type)}</span>
                    <span>S{item.severity}</span>
                    {item.is_required && <span>Required</span>}
                    {locked && <span className="taw-lock-tag"><FaCheck /> Locked</span>}
                  </div>
                  <h4>{cardTitle}</h4>
                  <p>{item.description.trim() || getItemTypeHint(item.item_type)}</p>
                  <div className="taw-item-foot">
                    <span><FaLayerGroup /> {item.subitems.length} subitems</span>
                    {item.item_type === 'TIMED' && item.scheduled_time && (
                      <span><FaClock /> {item.scheduled_time}</span>
                    )}
                    {item.item_type === 'SCHEDULED_EVENT' && (
                      <span><FaClock /> {item.scheduled_events.length} events</span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="taw-card-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRemoveItem(item.id);
                  }}
                  title="Remove item"
                >
                  <FaTrash />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedItem && (
        <div className="taw-modal-backdrop" onClick={() => setSelectedItemId(null)}>
          <div
            className="taw-item-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="taw-item-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="taw-modal-header">
              <div>
                <span className="taw-kicker">Item {String(selectedItemIndex + 1).padStart(2, '0')}</span>
                <h3 id="taw-item-modal-title">{selectedItem.title.trim() || 'Untitled item'}</h3>
              </div>
              <div className="taw-modal-tools">
                <span className={`taw-state-pill ${lockedItemIds.includes(selectedItem.id) ? 'taw-state-locked' : ''}`}>
                  {lockedItemIds.includes(selectedItem.id) ? 'Locked' : 'Draft'}
                </span>
                <button
                  type="button"
                  className="taw-close-button"
                  onClick={() => setSelectedItemId(null)}
                  title="Close item workspace"
                >
                  <FaTimes />
                </button>
              </div>
            </div>

            <div className="taw-modal-body">
              <section className="taw-modal-panel taw-item-setup">
                <div className="taw-panel-heading">
                  <span>Item Setup</span>
                  <strong>{formatItemType(selectedItem.item_type)}</strong>
                </div>

                <label className="taw-field" htmlFor={`item_${selectedItem.id}_title`}>
                  <span>Title</span>
                  <input
                    id={`item_${selectedItem.id}_title`}
                    type="text"
                    value={selectedItem.title}
                    onChange={(event) => handleUpdateItem(selectedItem.id, { title: event.target.value })}
                    className={`taw-input ${errors[`item_${selectedItemIndex}_title`] ? 'taw-input-error' : ''}`}
                    placeholder="e.g., Inspect equipment status"
                  />
                  {errors[`item_${selectedItemIndex}_title`] && (
                    <small className="taw-error-text">{errors[`item_${selectedItemIndex}_title`]}</small>
                  )}
                </label>

                <label className="taw-field" htmlFor={`item_${selectedItem.id}_description`}>
                  <span>Description</span>
                  <textarea
                    id={`item_${selectedItem.id}_description`}
                    value={selectedItem.description}
                    onChange={(event) => handleUpdateItem(selectedItem.id, { description: event.target.value })}
                    rows={3}
                    className="taw-textarea"
                    placeholder="Operational context, evidence guidance, or expectations"
                  />
                </label>

                <div className="taw-compact-grid">
                  <label className="taw-field" htmlFor={`item_${selectedItem.id}_type`}>
                    <span>Type</span>
                    <select
                      id={`item_${selectedItem.id}_type`}
                      value={selectedItem.item_type}
                      onChange={(event) =>
                        handleUpdateItem(selectedItem.id, {
                          item_type: event.target.value as ItemForm['item_type'],
                        })
                      }
                      className="taw-select"
                    >
                      {ITEM_TYPE_OPTIONS.map((itemType) => (
                        <option key={itemType} value={itemType}>
                          {formatItemType(itemType)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="taw-field" htmlFor={`item_${selectedItem.id}_severity`}>
                    <span>Severity</span>
                    <input
                      id={`item_${selectedItem.id}_severity`}
                      type="number"
                      min={1}
                      max={5}
                      value={selectedItem.severity}
                      onChange={(event) => handleUpdateItem(selectedItem.id, { severity: Number(event.target.value) || 1 })}
                      className="taw-input"
                    />
                  </label>

                  <div className="taw-check-stack">
                    <label className="taw-check">
                      <input
                        type="checkbox"
                        className="sentinel-checkbox-input custom-checkbox"
                        checked={selectedItem.is_required}
                        onChange={(event) => handleUpdateItem(selectedItem.id, { is_required: event.target.checked })}
                      />
                      Required
                    </label>
                    <label className="taw-check">
                      <input
                        type="checkbox"
                        className="sentinel-checkbox-input custom-checkbox"
                        checked={selectedItem.has_exe_time}
                        onChange={(event) => handleUpdateItem(selectedItem.id, { has_exe_time: event.target.checked })}
                      />
                      Track time
                    </label>
                  </div>
                </div>

                {renderItemTiming(selectedItem, selectedItemIndex)}
              </section>

              <section className="taw-modal-panel taw-subitem-setup">
                <div className="taw-panel-heading">
                  <span>Subitems</span>
                  <button type="button" className="taw-secondary-action" onClick={() => handleAddSubitem(selectedItem.id)}>
                    <FaPlus /> Add Subitem
                  </button>
                </div>
                {renderSubitems(selectedItem, selectedItemIndex)}
              </section>
            </div>

            <div className="taw-modal-footer">
              <div className="taw-save-signal">
                {savePreference === 'locked' ? 'Group lock preferred' : 'Save entire template'}
              </div>
              <button type="button" className="taw-secondary-action" onClick={() => setSelectedItemId(null)}>
                Keep Draft
              </button>
              <button
                type="button"
                className="taw-primary-action"
                onClick={handleLockSelectedItem}
                disabled={!selectedItem.title.trim()}
              >
                <FaCheck /> Lock Group
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default TemplateAuthoringWorkspace;
