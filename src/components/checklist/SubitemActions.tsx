// src/components/checklist/SubitemActions.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { 
  FaCheckCircle, FaBan, FaExclamationTriangle, FaComment
} from 'react-icons/fa';
import './SubitemActions.css';

interface SubitemActionsProps {
  instanceId: string;
  itemId: string;
  subitemId: string;
  currentStatus?: string;
  title: string;
  description: string;
  onComplete: () => void;
  onNext: () => void;
  isLast: boolean;
}

const SubitemActions: React.FC<SubitemActionsProps> = ({ 
  instanceId, 
  itemId, 
  subitemId, 
  currentStatus, 
  title,
  description,
  onComplete,
  onNext,
  isLast
}) => {
  const { updateSubitemStatus, loading: contextLoading } = useChecklist();
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [action, setAction] = useState<'COMPLETE' | 'SKIP' | 'FAIL'>('COMPLETE');
  const [loadingState, setLoading] = useState(false);

  const handleAction = async (status: 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED', notes?: string) => {
    try {
      console.log('🔄 Subitem action triggered:', {
        instanceId,
        itemId,
        subitemId,
        status,
        notes,
        comment,
        reason
      });

      setLoading(true);
      
      // Subitems don't support IN_PROGRESS status directly
      // Only parent items get IN_PROGRESS via start-work endpoint
      if (status === 'IN_PROGRESS') {
        console.warn('⚠️ IN_PROGRESS not supported for subitems, skipping update');
        setLoading(false);
        return;
      }
      
      await updateSubitemStatus(instanceId, itemId, subitemId, status, notes || comment, reason);
      
      // Clear form
      setComment('');
      setReason('');
      
      // Handle navigation after action
      if (status === 'COMPLETED' || status === 'SKIPPED' || status === 'FAILED') {
        if (isLast) {
          // Last subitem completed, go back to main item
          onComplete();
        } else {
          // Move to next subitem
          onNext();
        }
      }
      
      console.log('✅ Subitem action completed successfully');
    } catch (error) {
      console.error('❌ Failed to update subitem:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderForm = () => {
    switch (action) {
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
              Mark Complete
            </button>
          </div>
        );
      
      case 'SKIP':
        return (
          <div className="action-form">
            <textarea
              placeholder="Reason for skipping this subitem..."
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
              placeholder="Describe issue encountered..."
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
      
      default:
        return null;
    }
  };

  // Determine available actions based on current status
  const canCompleteFromSkippedOrFailed = currentStatus === 'SKIPPED' || currentStatus === 'FAILED';
  const isPending = !currentStatus || currentStatus === 'PENDING';
  const isInProgress = currentStatus === 'IN_PROGRESS'; // This shouldn't happen for subitems but handle gracefully
  const canComplete = isPending || isInProgress || canCompleteFromSkippedOrFailed;
  const canSkipOrFail = isPending || isInProgress;
  
  // Subitems don't support IN_PROGRESS status directly
  // They go from PENDING directly to COMPLETED/SKIPPED/FAILED

  return (
    <div className="subitem-actions">
      <div className="subitem-header">
        <h3>Subitem: {title}</h3>
        {description && <p className="subitem-description">{description}</p>}
      </div>

      <div className="action-buttons">
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
            <FaBan /> Skip Subitem
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
        {isLast && (
          <p><strong>Last subitem - completing this will return to the main item</strong></p>
        )}
      </div>
    </div>
  );
};

export default SubitemActions;
