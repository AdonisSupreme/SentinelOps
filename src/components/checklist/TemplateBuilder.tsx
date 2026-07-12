import React, { useCallback, useEffect, useState } from 'react';
import { FaCheck, FaPlus, FaTimes } from 'react-icons/fa';
import { checklistApi, type CreateChecklistTemplateRequest } from '../../services/checklistApi';
import { teamApi } from '../../services/teamApi';
import { useAuth } from '../../contexts/AuthContext';
import { orgApi, type Section } from '../../services/orgApi';
import { buildShiftOptions, normalizeShiftCode, type ShiftOption } from '../../utils/shiftUtils';
import ShiftCreatorModal from './ShiftCreatorModal';
import TemplateAuthoringWorkspace from './TemplateAuthoringWorkspace';
import {
  normalizeItems,
  serializeItemForRequest,
  type ItemForm,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const applyShiftOptions = useCallback((options: ShiftOption[], preferredShift?: string) => {
    const normalizedPreferred = normalizeShiftCode(preferredShift);
    setShiftOptions(options);
    setShift((current) => {
      const normalizedCurrent = normalizeShiftCode(current);
      if (normalizedPreferred && options.some((option) => option.code === normalizedPreferred)) {
        return normalizedPreferred;
      }
      return options.some((option) => option.code === normalizedCurrent)
        ? normalizedCurrent
        : options[0]?.code || '';
    });
  }, []);

  const refreshShiftOptions = useCallback(async (preferredShift?: string) => {
    try {
      setShiftsLoading(true);
      const data = await teamApi.listShifts();
      const includeCodes = preferredShift ? [preferredShift] : [];
      applyShiftOptions(buildShiftOptions(data, includeCodes), preferredShift);
    } catch (loadError) {
      console.warn('Failed to load configured shifts for template builder:', loadError);
      const includeCodes = preferredShift ? [preferredShift] : [];
      applyShiftOptions(buildShiftOptions([], includeCodes), preferredShift);
    } finally {
      setShiftsLoading(false);
    }
  }, [applyShiftOptions]);

  useEffect(() => {
    void refreshShiftOptions();
  }, [refreshShiftOptions]);

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
        if (mounted) {
          setSections(data);
        }
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
        ? 'Section is required for template creation'
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
        shift: normalizeShiftCode(shift),
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

  return (
    <>
      <form className="stb-template-builder stb-command-authoring" onSubmit={handleSubmit}>
        <section className="stb-builder-section stb-frame-section">
          <div className="stb-frame-copy">
            <span className="stb-section-kicker">Template Frame</span>
            <h3 className="stb-section-title">Operating Scope</h3>
          </div>

          <div className="stb-frame-grid">
            <div className="stb-form-group stb-field-span-2">
              <label htmlFor="name" className="stb-form-label">
                Template Name *
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g., Morning opening checklist"
                className={`stb-form-input ${errors.name ? 'stb-error' : ''}`}
              />
              {errors.name && <span className="stb-error-text">{errors.name}</span>}
            </div>

            <div className="stb-form-group">
              <div className="stb-field-title-row">
                <label htmlFor="shift" className="stb-form-label">
                  Shift *
                </label>
                {isAdmin && (
                  <button type="button" className="stb-inline-action" onClick={() => setShowShiftCreator(true)}>
                    <FaPlus /> New shift
                  </button>
                )}
              </div>
              <select
                id="shift"
                value={shift}
                onChange={(event) => setShift(normalizeShiftCode(event.target.value))}
                className={`stb-form-select ${errors.shift ? 'stb-error' : ''}`}
                disabled={shiftsLoading}
              >
                <option value="">{shiftsLoading ? 'Loading configured shifts...' : 'Select a configured shift'}</option>
                {shiftOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.shift && <span className="stb-error-text">{errors.shift}</span>}
              {!errors.shift && !shiftsLoading && shiftOptions.length === 0 && (
                <span className="stb-field-hint">
                  No shifts are configured yet. Admins can create one here before saving the template.
                </span>
              )}
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
                    onChange={(event) => setSelectedSectionId(event.target.value)}
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
              <label htmlFor="active" className="stb-checkbox-label stb-active-check">
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

            <div className="stb-form-group stb-field-span-2">
              <label htmlFor="description" className="stb-form-label">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the purpose of this template..."
                rows={3}
                className="stb-form-textarea"
              />
            </div>
          </div>
        </section>

        <TemplateAuthoringWorkspace items={items} errors={errors} onItemsChange={updateItems} />

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
      <ShiftCreatorModal
        open={showShiftCreator}
        onClose={() => setShowShiftCreator(false)}
        onCreated={handleShiftCreated}
      />
    </>
  );
};

export default TemplateBuilder;
