// src/components/checklist/ItemActions.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaComment } from 'react-icons/fa';
import './ItemActions.css';

interface ItemActionsProps {
  instanceId: string;
  itemId: string;
  currentStatus?: string;
  onComplete: () => void;
}

const ItemActions: React.FC<ItemActionsProps> = ({ instanceId, itemId, currentStatus, onComplete }) => {
  const { updateItemStatus, loading: contextLoading } = useChecklist();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'START' | 'COMPLETE' | 'SKIP' | 'FAIL'>('START');
  const [loadingState, setLoading] = useState(false);

  const handleAction = async (status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED', notes?: string) => {
    try {
      console.log(' Item action triggered:', {
        instanceId,
        itemId,
        status,
        notes,
        comment,
        reason
      });

      // Add immediate user feedback
      const actionType = status === 'IN_PROGRESS' ? 'started' : 
                       status === 'COMPLETED' ? 'completed' : 'skipped';
      
      // Show loading state
      setLoading(true);
      
      await updateItemStatus(instanceId, itemId, status, notes || comment, reason);
      
      // Clear form and close
      setComment('');
      setReason('');
      onComplete();
      
      console.log(' Item action completed successfully');
    } catch (error) {
      console.error(' Failed to update item:', error);
      // Could add error notification here
    } finally {
      setLoading(false);
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
              disabled={!reason.trim() || loadingState || contextLoading}
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
              onClick={() => handleAction('FAILED', reason)}
              disabled={!reason.trim() || loadingState || contextLoading}
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
              disabled={loadingState || contextLoading}
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
              disabled={loadingState || contextLoading}
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

  // Determine available actions based on current status
  const canCompleteFromSkippedOrFailed = currentStatus === 'SKIPPED' || currentStatus === 'FAILED';
  const isPending = !currentStatus || currentStatus === 'PENDING';
  const isInProgress = currentStatus === 'IN_PROGRESS';
  const canStart = isPending || isInProgress;
  const canComplete = isPending || isInProgress || canCompleteFromSkippedOrFailed;
  const canSkipOrFail = isPending || isInProgress;

  return (
    <div className="item-actions">
      <div className="action-buttons">
        {canStart && (
          <button
            onClick={() => setAction('START')}
            className={`btn-action ${action === 'START' ? 'active' : ''}`}
          >
            <FaPlay /> Start Working
          </button>
        )}
        
        {canComplete && (
          <button
            onClick={() => setAction('COMPLETE')}
            className={`btn-action ${action === 'COMPLETE' ? 'active' : ''}`}
          >
            <FaCheckCircle /> {canCompleteFromSkippedOrFailed ? 'Resolve & Complete' : 'Mark Complete'}
          </button>
        )}
        
        {canSkipOrFail && (
          <button
            onClick={() => setAction('SKIP')}
            className={`btn-action ${action === 'SKIP' ? 'active' : ''}`}
          >
            <FaBan /> Skip Item
          </button>
        )}
        
        {canSkipOrFail && (
          <button
            onClick={() => setAction('FAIL')}
            className={`btn-action ${action === 'FAIL' ? 'active' : ''}`}
          >
            <FaExclamationTriangle /> Report Issue
          </button>
        )}
      </div>

      {renderForm()}

      <div className="action-tips">
        <p><FaComment /> Add detailed notes for better handover and audit trail</p>
      </div>
    </div>
  );
};

export default ItemActions;