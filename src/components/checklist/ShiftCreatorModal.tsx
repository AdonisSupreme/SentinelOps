import React, { useEffect, useState } from 'react';
import { FaPlus, FaTimes } from 'react-icons/fa';
import { teamApi } from '../../services/teamApi';
import { normalizeShiftCode } from '../../utils/shiftUtils';
import './ShiftCreatorModal.css';

interface ShiftCreatorModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (shiftName: string) => void | Promise<void>;
}

const defaultTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

const ShiftCreatorModal: React.FC<ShiftCreatorModalProps> = ({ open, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [timezone, setTimezone] = useState(defaultTimezone);
  const [color, setColor] = useState('#2563eb');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName('');
    setStartTime('07:00');
    setEndTime('15:00');
    setTimezone(defaultTimezone());
    setColor('#2563eb');
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedName = normalizeShiftCode(name);

    if (!normalizedName) {
      setError('Shift name is required');
      return;
    }

    if (!startTime || !endTime) {
      setError('Start and end times are required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await teamApi.createShift({
        name: normalizedName,
        start_time: startTime,
        end_time: endTime,
        timezone: timezone.trim() || 'UTC',
        color,
      });
      await onCreated(normalizedName);
    } catch (createError) {
      console.error('Failed to create shift:', createError);
      setError('Failed to create shift. Check for duplicates and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="shift-creator-backdrop" onMouseDown={onClose}>
      <form className="shift-creator-modal" onSubmit={handleSubmit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="shift-creator-header">
          <div>
            <span className="shift-creator-kicker">Shift Configuration</span>
            <h3>Create operational shift</h3>
          </div>
          <button type="button" className="shift-creator-icon-btn" onClick={onClose} aria-label="Close">
            <FaTimes />
          </button>
        </div>

        <div className="shift-creator-grid">
          <label className="shift-creator-field">
            <span>Shift name</span>
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., LATE, WEEKEND, SPLIT A"
              autoFocus
            />
          </label>

          <label className="shift-creator-field">
            <span>Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              placeholder="Africa/Johannesburg"
            />
          </label>

          <label className="shift-creator-field">
            <span>Start time</span>
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>

          <label className="shift-creator-field">
            <span>End time</span>
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>

          <label className="shift-creator-field shift-creator-color">
            <span>Color</span>
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </label>
        </div>

        {error && <div className="shift-creator-error">{error}</div>}

        <div className="shift-creator-actions">
          <button type="button" className="shift-creator-btn secondary" onClick={onClose} disabled={submitting}>
            <FaTimes /> Cancel
          </button>
          <button type="submit" className="shift-creator-btn primary" disabled={submitting}>
            {submitting ? (
              'Creating...'
            ) : (
              <>
                <FaPlus /> Create Shift
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ShiftCreatorModal;
