// src/components/checklist/ItemActions.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { FaCheckCircle, FaPlay, FaBan, FaExclamationTriangle, FaComment } from 'react-icons/fa';
import SubitemActions from './SubitemActions';
import './ItemActions.css';

interface ItemActionsProps {
  instanceId: string;
  itemId: string;
  currentStatus?: string;
  onComplete: (action?: string, hasSubitems?: boolean) => void;
}

const ItemActions: React.FC<ItemActionsProps> = ({ instanceId, itemId, currentStatus, onComplete }) => {
  const { currentInstance, updateItemStatus, addItemFinalVerdict, loading: contextLoading } = useChecklist();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'START' | 'COMPLETE' | 'SKIP' | 'FAIL'>('START');
  const [loadingState, setLoading] = useState(false);
  const [showFinalVerdictForm, setShowFinalVerdictForm] = useState(false);

  // Get the current item
  const currentItem = currentInstance?.items.find(item => item.id === itemId) as any;
  const subitems = Array.isArray(currentItem?.subitems) ? currentItem.subitems : [];
  const unresolvedSubitems = subitems.filter(
    (subitem: any) => subitem.status === 'PENDING' || subitem.status === 'IN_PROGRESS'
  ).length;
  const hasSubitems = subitems.length > 0;
  const canCompleteWithSubitems = unresolvedSubitems === 0;
  const exceptionSubitems = subitems.filter((subitem: any) => subitem.status === 'SKIPPED' || subitem.status === 'FAILED');
  const hasExceptionEvidence = exceptionSubitems.length > 0 || currentStatus === 'SKIPPED' || currentStatus === 'FAILED';
  const existingFinalVerdict = typeof currentItem?.final_verdict === 'string'
    ? currentItem.final_verdict.trim()
    : '';
  const canCaptureFinalVerdict = currentStatus === 'COMPLETED' && hasExceptionEvidence;

  const handleAction = async (status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED', notes?: string) => {
    if (status === 'COMPLETED' && hasSubitems && !canCompleteWithSubitems) {
      return;
    }

    try {
      console.log(' Item action triggered:', {
        instanceId,
        itemId,
        status,
        notes,
        comment,
        reason
      });

      // Show loading state
      setLoading(true);
      
      await updateItemStatus(instanceId, itemId, status, notes || comment, reason);
      
      // Clear form
      setComment('');
      setReason('');
      
      // Check if item has subitems
      const hasSubitems = currentItem && currentItem.subitems && currentItem.subitems.length > 0;
      
      // Pass action type and subitem info to parent for intelligent modal handling
      onComplete(status, hasSubitems);
      
      console.log(' Item action completed successfully');
    } catch (error) {
      console.error(' Failed to update item:', error);
      // Could add error notification here
    } finally {
      setLoading(false);
    }
  };

  const handleAddFinalVerdict = async () => {
    const normalizedComment = comment.trim();
    if (!normalizedComment) {
      return;
    }

    try {
      setLoading(true);
      await addItemFinalVerdict(instanceId, itemId, normalizedComment);
      setComment('');
      setShowFinalVerdictForm(false);
      onComplete(currentStatus, Boolean(currentItem?.subitems?.length));
    } catch (error) {
      console.error('Failed to add item verdict note:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    if (canCaptureFinalVerdict) {
      if (existingFinalVerdict) {
        return (
          <div className="action-form action-form--readonly">
            <div className="item-note-preview">
              <div className="item-note-preview__label">
                <FaComment /> Final verdict
              </div>
              <p>{existingFinalVerdict}</p>
            </div>
          </div>
        );
      }

      if (!showFinalVerdictForm) {
        return (
          <div className="action-form action-form--readonly">
            <button
              onClick={() => setShowFinalVerdictForm(true)}
              disabled={loadingState || contextLoading}
              className="btn-action confirm"
            >
              <FaComment /> Add Final Verdict
            </button>
          </div>
        );
      }

      return (
        <div className="action-form">
          <textarea
            placeholder="Add the final verdict for this item and its exceptions..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
          />
          <button
            onClick={handleAddFinalVerdict}
            disabled={!comment.trim() || loadingState || contextLoading}
            className="btn-action confirm"
          >
            Save Final Verdict
          </button>
        </div>
      );
    }

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
            {hasSubitems && !canCompleteWithSubitems && (
              <p className="action-blocked-note">
                Complete all subitems first. {unresolvedSubitems} subitem{unresolvedSubitems === 1 ? '' : 's'} still pending or in progress.
              </p>
            )}
            <textarea
              placeholder="Add completion notes (optional)..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
            <button
              onClick={() => handleAction('COMPLETED', comment)}
              disabled={loadingState || contextLoading || (hasSubitems && !canCompleteWithSubitems)}
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
            {currentStatus === 'PENDING' && (
              <button
              onClick={() => handleAction('IN_PROGRESS', comment)}
              disabled={loadingState || contextLoading}
              className="btn-action confirm"
            >
              Start Working
            </button>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Determine available actions based on current status
  const canCompleteFromSkippedOrFailed = currentStatus === 'SKIPPED' || currentStatus === 'FAILED';
  const isPending = currentStatus === 'PENDING';
  const isInProgress = currentStatus === 'IN_PROGRESS';
  const canStart = isPending;
  const canComplete = isPending || isInProgress || canCompleteFromSkippedOrFailed;
  const canSkipOrFail = isPending || isInProgress;
  const showStandardActions = !canCaptureFinalVerdict;

  return (
    <div className="item-actions">
      {showStandardActions && (
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
              disabled={hasSubitems && !canCompleteWithSubitems}
              title={hasSubitems && !canCompleteWithSubitems ? 'Complete all subitems first' : undefined}
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
      )}

      {renderForm()}

      <div className="action-tips">
        <p><FaComment /> Add detailed notes for better handover and audit trail</p>
      </div>
    </div>
  );
};

export default ItemActions;
