// src/components/checklist/HandoverNoteModal.tsx
import React, { useState, useEffect } from 'react';
import { FaTimes, FaFlag, FaPlus, FaSave, FaExclamationTriangle } from 'react-icons/fa';
import { useChecklist } from '../../contexts/checklistContext';
import './HandoverNoteModal.css';

interface HandoverNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  instanceId: string;
}

const HandoverNoteModal: React.FC<HandoverNoteModalProps> = ({
  isOpen,
  onClose,
  instanceId
}) => {
  const { createHandoverNote, loading } = useChecklist();
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(2);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setContent('');
      setPriority(2);
      setError('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      setError('Please enter a handover note');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await createHandoverNote(content.trim(), priority, instanceId);
      setContent('');
      setPriority(2);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create handover note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const getPriorityColor = (level: number) => {
    switch (level) {
      case 1: return '#22c55e'; // Low - Green
      case 2: return '#f59e0b'; // Medium - Orange  
      case 3: return '#ef4444'; // High - Red
      case 4: return '#a855f7'; // Critical - Purple
      default: return '#64748b'; // Gray
    }
  };

  const getPriorityLabel = (level: number) => {
    switch (level) {
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'High';
      case 4: return 'Critical';
      default: return 'Medium';
    }
  };

  const getPriorityIcon = (level: number) => {
    if (level >= 3) {
      return <FaExclamationTriangle style={{ color: getPriorityColor(level) }} />;
    }
    return <FaFlag style={{ color: getPriorityColor(level) }} />;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="handover-note-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="handover-note-modal futuristic"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="handover-note-modal-title"
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title" id="handover-note-modal-title">
            <FaFlag />
            Create Handover Note
          </div>
          <button 
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close modal"
          >
            <FaTimes />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Priority Selection */}
          <div className="priority-section">
            <label className="section-label">Priority Level</label>
            <div className="priority-options">
              {[1, 2, 3, 4].map((level) => (
                <button
                  key={level}
                  type="button"
                  className={`priority-option ${priority === level ? 'active' : ''}`}
                  onClick={() => setPriority(level)}
                  disabled={isSubmitting}
                >
                  <div className="priority-icon">
                    {getPriorityIcon(level)}
                  </div>
                  <div className="priority-info">
                    <div className="priority-label">{getPriorityLabel(level)}</div>
                    <div className="priority-value">{level}</div>
                  </div>
                  <div className="priority-indicator" style={{ backgroundColor: getPriorityColor(level) }} />
                </button>
              ))}
            </div>
          </div>

          {/* Note Content */}
          <div className="content-section">
            <label htmlFor="handover-content" className="section-label">
              Handover Note Content
            </label>
            <div className="textarea-wrapper">
              <textarea
                id="handover-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Enter important information, tasks, or issues that need to be handed over to the next shift..."
                className="handover-textarea"
                rows={6}
                disabled={isSubmitting}
                autoFocus
              />
              <div className="textarea-footer">
                <span className="char-count">{content.length} characters</span>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message">
              <FaExclamationTriangle />
              {error}
            </div>
          )}

          {/* Help Text */}
          <div className="help-text">
            <FaFlag />
            <span>
              You can add multiple handover notes for the same checklist.
              SentinelOps may also add automatic exception handovers, and your manual notes will appear alongside them.
            </span>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={isSubmitting}
          >
            <FaTimes /> Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || !content.trim()}
          >
            {isSubmitting ? (
              <>
                <div className="spinner" />
                Creating...
              </>
            ) : (
              <>
                <FaSave /> Create Handover Note
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HandoverNoteModal;
