// src/components/checklist/SubitemExecutionModal.tsx
import React, { useState } from 'react';
import { FaCheck, FaBan, FaExclamationTriangle, FaArrowRight } from 'react-icons/fa';
import './SubitemModal.css';

interface Subitem {
  id: string;
  title: string;
  description: string;
  item_type: string;
  is_required: boolean;
  severity: number;
  status: string;
}

interface SubitemExecutionModalProps {
  isOpen: boolean;
  itemTitle: string;
  subitems: Subitem[];
  onAction: (subitemId: string, action: 'COMPLETE' | 'SKIP' | 'FAIL', notes?: string) => Promise<void>;
  onClose: () => void;
}

const SubitemExecutionModal: React.FC<SubitemExecutionModalProps> = ({
  isOpen,
  itemTitle,
  subitems,
  onAction,
  onClose,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const current = subitems[currentIdx];

  if (!isOpen || !current) return null;

  const handleAction = async (action: 'COMPLETE' | 'SKIP' | 'FAIL') => {
    setLoading(true);
    await onAction(current.id, action, notes);
    setLoading(false);
    setNotes('');
    if (currentIdx < subitems.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      onClose();
    }
  };

  return (
    <div className="subitem-modal-backdrop" onClick={onClose}>
      <div className="subitem-modal futuristic" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{itemTitle}</h3>
          <button className="close-btn" onClick={onClose} title="Close">✕</button>
        </div>
        <div className="modal-content slide-in">
          <div className="subitem-step-indicator">
            Subitem {currentIdx + 1} / {subitems.length}
          </div>
          <h4 className="subitem-title">{current.title}</h4>
          {current.description && <p className="subitem-desc">{current.description}</p>}
          <div className="subitem-meta">
            <span className="meta-badge">{current.item_type}</span>
            <span className="meta-badge severity">{'⚠'.repeat(current.severity)}</span>
            {current.is_required && <span className="meta-badge required">Required</span>}
          </div>
          <textarea
            className="subitem-notes-input"
            placeholder="Add notes (optional)"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
          />
          <div className="subitem-actions">
            <button className="btn-action confirm" disabled={loading} onClick={() => handleAction('COMPLETE')}>
              <FaCheck /> Complete
            </button>
            <button className="btn-action skip" disabled={loading} onClick={() => handleAction('SKIP')}>
              <FaBan /> Skip
            </button>
            <button className="btn-action fail" disabled={loading} onClick={() => handleAction('FAIL')}>
              <FaExclamationTriangle /> Report Issue
            </button>
            {currentIdx < subitems.length - 1 && (
              <button className="btn-action next" disabled>
                <FaArrowRight /> Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubitemExecutionModal;
