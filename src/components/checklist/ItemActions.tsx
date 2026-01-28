// src/components/checklist/ItemActions.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaComment } from 'react-icons/fa';
import './ItemActions.css';

interface ItemActionsProps {
  instanceId: string;
  itemId: string;
  onComplete: () => void;
}

const ItemActions: React.FC<ItemActionsProps> = ({ instanceId, itemId, onComplete }) => {
  const { updateItemStatus, loading } = useChecklist();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'START' | 'COMPLETE' | 'SKIP' | 'FAIL'>('START');

  const handleAction = async (status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED', notes?: string) => {
    try {
      console.log(' Item action triggered:', {
        instanceId,
        itemId,
        status,
        notes,
        comment,
        reason
      });

      await updateItemStatus(instanceId, itemId, status, notes || comment, reason);
      setComment('');
      setReason('');
      onComplete();
      console.log(' Item action completed successfully');
    } catch (error) {
      console.error(' Failed to update item:', error);
    }
  };

  const renderForm = () => {
    switch (action) {
      case 'SKIP':
        return (
          <div className="action-form">
            <textarea
              placeholder="Reason for skipping this item..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
            />
            <button
              onClick={() => handleAction('SKIPPED', reason)}
              disabled={!reason.trim() || loading}
              className="btn-action confirm"
            >
              Confirm Skip
            </button>
          </div>
        );
      
      case 'FAIL':
        return (
          <div className="action-form">
            <textarea
              placeholder="Describe the issue encountered..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              required
            />
            <button
              onClick={() => handleAction('SKIPPED', `ISSUE REPORTED: ${reason}`)}
              disabled={!reason.trim() || loading}
              className="btn-action confirm"
            >
              Report Issue
            </button>
          </div>
        );
      
      case 'COMPLETE':
        return (
          <div className="action-form">
            <textarea
              placeholder="Add completion notes (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <button
              onClick={() => handleAction('COMPLETED', comment)}
              disabled={loading}
              className="btn-action confirm"
            >
              Mark as Complete
            </button>
          </div>
        );
      
      case 'START':
        return (
          <div className="action-form">
            <textarea
              placeholder="Add start notes (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <button
              onClick={() => handleAction('IN_PROGRESS', comment)}
              disabled={loading}
              className="btn-action confirm"
            >
              Start Working
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="item-actions">
      <div className="action-buttons">
        <button
          onClick={() => setAction('START')}
          className={`btn-action ${action === 'START' ? 'active' : ''}`}
        >
          <FaPlay /> Start Working
        </button>
        
        <button
          onClick={() => setAction('COMPLETE')}
          className={`btn-action ${action === 'COMPLETE' ? 'active' : ''}`}
        >
          <FaCheckCircle /> Mark Complete
        </button>
        
        <button
          onClick={() => setAction('SKIP')}
          className={`btn-action ${action === 'SKIP' ? 'active' : ''}`}
        >
          <FaBan /> Skip Item
        </button>
        
        <button
          onClick={() => setAction('FAIL')}
          className={`btn-action ${action === 'FAIL' ? 'active' : ''}`}
        >
          <FaExclamationTriangle /> Report Issue
        </button>
      </div>

      {renderForm()}

      <div className="action-tips">
        <p><FaComment /> Add detailed notes for better handover and audit trail</p>
      </div>
    </div>
  );
};

export default ItemActions;