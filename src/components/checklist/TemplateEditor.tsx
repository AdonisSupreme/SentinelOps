import React, { useCallback, useEffect, useState } from 'react';
import { FaCheck, FaPlus, FaTimes } from 'react-icons/fa';
import { checklistApi, type ChecklistTemplate, type UpdateChecklistTemplateRequest } from '../../services/checklistApi';
import { teamApi } from '../../services/teamApi';
import { useAuth } from '../../contexts/AuthContext';
import { orgApi, type Section } from '../../services/orgApi';
import { buildShiftOptions, normalizeShiftCode, type ShiftOption } from '../../utils/shiftUtils';
import ShiftCreatorModal from './ShiftCreatorModal';
import TemplateAuthoringWorkspace from './TemplateAuthoringWorkspace';
import {
  mapTemplateItemToForm,
  normalizeItems,
  serializeItemForRequest,
  type ItemForm,
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
  const [shift, setShift] = useState<string>('');
  const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [showShiftCreator, setShowShiftCreator] = useState(false);
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
    setShift(normalizeShiftCode(template.shift));
    setIsActive(template.is_active);
    setSelectedSectionId(isAdmin ? template.section_id || '' : userSectionId || template.section_id || '');
    setItems(normalizeItems((template.items || []).map(mapTemplateItemToForm)));
    setLoading(false);
  }, [template, isAdmin, userSectionId]);

  const applyShiftOptions = useCallback((options: ShiftOption[], preferredShift?: string) => {
    const normalizedPreferred = normalizeShiftCode(preferredShift);
    setShiftOptions(options);
    setShift((current) => {
      const normalizedCurrent = normalizeShiftCode(current || template.shift);
      if (normalizedPreferred && options.some((option) => option.code === normalizedPreferred)) {
        return normalizedPreferred;
      }
      return options.some((option) => option.code === normalizedCurrent)
        ? normalizedCurrent
        : options[0]?.code || '';
    });
  }, [template.shift]);

  const refreshShiftOptions = useCallback(async (preferredShift?: string) => {
    const includeCodes = [preferredShift || template.shift].filter(Boolean);
    try {
      setShiftsLoading(true);
      const data = await teamApi.listShifts();
      applyShiftOptions(buildShiftOptions(data, includeCodes), preferredShift || template.shift);
    } catch (loadError) {
      console.warn('Failed to load configured shifts for template editor:', loadError);
      applyShiftOptions(buildShiftOptions([], includeCodes), preferredShift || template.shift);
    } finally {
      setShiftsLoading(false);
    }
  }, [applyShiftOptions, template.shift]);

  useEffect(() => {
    void refreshShiftOptions(template.shift);
  }, [refreshShiftOptions, template.shift]);

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
        if (mounted) {
          setSections(data);
        }
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

  const handleShiftCreated = async (createdShift: string) => {
    await refreshShiftOptions(createdShift);
    setShowShiftCreator(false);
  };

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

    if (!normalizeShiftCode(shift)) {
      nextErrors.shift = 'Create or select a configured shift';
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
        shift: normalizeShiftCode(shift),
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

  if (loading) {
    return (
      <div className="template-editor ste-command-authoring">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading template...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <form className="template-editor ste-command-authoring" onSubmit={handleSubmit}>
        <section className="editor-section ste-frame-section">
          <div className="ste-frame-copy">
            <span className="section-kicker">Template Frame</span>
            <h3 className="section-title">Operating Scope</h3>
          </div>

          <div className="ste-frame-grid">
            <div className="form-group ste-field-span-2">
              <label htmlFor="name">Template Name *</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="e.g., Morning opening checklist"
              />
              {errors.name && <span className="error-text">{errors.name}</span>}
            </div>

            <div className="form-group">
              <div className="field-title-row">
                <label htmlFor="shift">Shift *</label>
                {isAdmin && (
                  <button type="button" className="inline-action" onClick={() => setShowShiftCreator(true)}>
                    <FaPlus /> New shift
                  </button>
                )}
              </div>
              <select
                id="shift"
                value={shift}
                onChange={(event) => setShift(normalizeShiftCode(event.target.value))}
                className={`form-select ${errors.shift ? 'error' : ''}`}
                disabled={shiftsLoading}
              >
                <option value="">{shiftsLoading ? 'Loading configured shifts...' : 'Select a configured shift'}</option>
                {shiftOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.shift && <span className="error-text">{errors.shift}</span>}
              {!errors.shift && !shiftsLoading && shiftOptions.length === 0 && (
                <span className="field-hint">
                  No shifts are configured yet. Admins can create one here before saving this template.
                </span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="section_id">Section {isAdmin ? '*' : ''}</label>
              {isAdmin ? (
                <>
                  <select
                    id="section_id"
                    value={selectedSectionId}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
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
              <label htmlFor="active" className="ste-active-check">
                <input
                  id="active"
                  type="checkbox"
                  className="sentinel-checkbox-input"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                />
                Active
              </label>
            </div>

            <div className="form-group ste-field-span-2">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="form-textarea"
                placeholder="Describe the purpose of this template..."
              />
            </div>
          </div>
        </section>

        <TemplateAuthoringWorkspace items={items} errors={errors} onItemsChange={updateItems} />

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
      <ShiftCreatorModal
        open={showShiftCreator}
        onClose={() => setShowShiftCreator(false)}
        onCreated={handleShiftCreated}
      />
    </>
  );
};

export default TemplateEditor;
