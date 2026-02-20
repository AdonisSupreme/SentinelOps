// src/components/checklist/SmartSubitemModal.tsx
import React, { useState, useEffect } from 'react';
import { 
  FaTimes, FaArrowLeft, FaArrowRight, FaCheckCircle, 
  FaClock, FaPlay, FaBan, FaExclamationTriangle
} from 'react-icons/fa';
import './SmartSubitemModal.css';

interface Subitem {
  id: string;
  title: string;
  description: string;
  item_type: string;
  is_required: boolean;
  severity: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  completed_by?: {
    id: string;
    username: string;
  } | null;
  completed_at: string | null;
  skipped_reason: string | null;
  failure_reason: string | null;
}

interface SmartSubitemModalProps {
  isOpen: boolean;
  itemTitle: string;
  itemId: string;
  instanceId: string;
  subitems: Subitem[];
  onAction: (subitemId: string, action: 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'IN_PROGRESS', notes?: string) => Promise<void>;
  onCompleteItem: () => void;
  onClose: () => void;
}

const SmartSubitemModal: React.FC<SmartSubitemModalProps> = ({
  isOpen,
  itemTitle,
  itemId,
  instanceId,
  subitems,
  onAction,
  onCompleteItem,
  onClose
}) => {
  const [currentSubitemIndex, setCurrentSubitemIndex] = useState(0);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ subitemId: string; action: 'SKIPPED' | 'FAILED'; notes?: string } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [forceUpdate, setForceUpdate] = useState(0); // Force re-render flag
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, { status: string; timestamp: number }>>(new Map()); // Track optimistic updates

  // Calculate statistics including optimistic updates
  const stats = {
    total: subitems.length,
    completed: subitems.filter(s => {
      const optimisticUpdate = optimisticUpdates.get(s.id);
      return optimisticUpdate ? optimisticUpdate.status === 'COMPLETED' : s.status === 'COMPLETED';
    }).length,
    skipped: subitems.filter(s => {
      const optimisticUpdate = optimisticUpdates.get(s.id);
      return optimisticUpdate ? optimisticUpdate.status === 'SKIPPED' : s.status === 'SKIPPED';
    }).length,
    failed: subitems.filter(s => {
      const optimisticUpdate = optimisticUpdates.get(s.id);
      return optimisticUpdate ? optimisticUpdate.status === 'FAILED' : s.status === 'FAILED';
    }).length,
    pending: subitems.filter(s => {
      const optimisticUpdate = optimisticUpdates.get(s.id);
      return optimisticUpdate ? optimisticUpdate.status === 'PENDING' : s.status === 'PENDING';
    }).length,
    inProgress: subitems.filter(s => {
      const optimisticUpdate = optimisticUpdates.get(s.id);
      return optimisticUpdate ? optimisticUpdate.status === 'IN_PROGRESS' : s.status === 'IN_PROGRESS';
    }).length
  };

  // Calculate progress including all actioned items (COMPLETED + SKIPPED + FAILED)
  const actionedCount = stats.completed + stats.skipped + stats.failed;
  const completionPercentage = stats.total > 0 ? Math.round((actionedCount / stats.total) * 100) : 0;
  const allActioned = stats.pending === 0 && stats.inProgress === 0;
  const currentSubitem = subitems[currentSubitemIndex];

  // Get current subitem with optimistic updates applied
  const getCurrentSubitemWithOptimisticUpdates = () => {
    const baseSubitem = subitems[currentSubitemIndex];
    if (!baseSubitem) return null;
    
    const optimisticUpdate = optimisticUpdates.get(baseSubitem.id);
    if (optimisticUpdate) {
      // Return a new object with the optimistic status
      return {
        ...baseSubitem,
        status: optimisticUpdate.status as Subitem['status']
      };
    }
    
    return baseSubitem;
  };

  const currentSubitemWithOptimistic = getCurrentSubitemWithOptimisticUpdates();

  // Reset to first subitem when opening modal
  useEffect(() => {
    if (isOpen) {
      // Find first item waiting for action (PENDING status only)
      const firstPendingIndex = subitems.findIndex(s => s.status === 'PENDING');
      setCurrentSubitemIndex(firstPendingIndex >= 0 ? firstPendingIndex : 0);
      // Clear optimistic updates when opening modal
      setOptimisticUpdates(new Map());
    }
  }, [isOpen, subitems]);

  // Clean up optimistic updates when subitems prop changes (sync with server state)
  useEffect(() => {
    // Clear optimistic updates that have been confirmed by server
    const confirmedUpdates = new Map<string, { status: string; timestamp: number }>();
    optimisticUpdates.forEach((update, subitemId) => {
      const serverSubitem = subitems.find(s => s.id === subitemId);
      if (serverSubitem && serverSubitem.status === update.status) {
        // This update has been confirmed by server, keep it
        confirmedUpdates.set(subitemId, update);
      }
    });
    
    if (confirmedUpdates.size !== optimisticUpdates.size) {
      setOptimisticUpdates(confirmedUpdates);
    }
  }, [subitems]);

  // Sync current subitem when subitems prop changes (critical fix)
  useEffect(() => {
    if (subitems && subitems.length > 0 && currentSubitemIndex < subitems.length) {
      const updatedCurrentSubitem = subitems[currentSubitemIndex];
      if (updatedCurrentSubitem) {
        // Force re-render by updating currentSubitemIndex
        setCurrentSubitemIndex(currentSubitemIndex);
      }
    }
  }, [subitems, currentSubitemIndex, forceUpdate]); // Add forceUpdate to dependencies

  const handleSubitemAction = async (subitemId: string, action: 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'IN_PROGRESS', notes?: string) => {
    // For SKIPPED and FAILED actions, show reason modal first
    if (action === 'SKIPPED' || action === 'FAILED') {
      setPendingAction({ subitemId, action, notes });
      setShowReasonModal(true);
      return;
    }

    // Apply optimistic update immediately for instant UI feedback
    if (action === 'IN_PROGRESS' || action === 'COMPLETED') {
      const newOptimisticUpdates = new Map(optimisticUpdates);
      newOptimisticUpdates.set(subitemId, { status: action, timestamp: Date.now() });
      setOptimisticUpdates(newOptimisticUpdates);
      
      // Force re-render to show updated buttons immediately
      setForceUpdate(prev => prev + 1);
    }

    // Direct action without race condition
    try {
      await onAction(subitemId, action, notes);
      
      // For COMPLETED actions, handle smart auto-advance
      if (action === 'COMPLETED') {
        const nextActionableIndex = getNextActionableItem();
        if (nextActionableIndex >= 0) {
          setTimeout(() => {
            setCurrentSubitemIndex(nextActionableIndex);
          }, 500);
        } else if (currentSubitemIndex < subitems.length - 1) {
          // Fallback to sequential navigation if no more actionable items
          setTimeout(() => {
            setCurrentSubitemIndex(currentSubitemIndex + 1);
          }, 500);
        }
      }
    } catch (error) {
      console.error('Subitem action failed:', error);
      // Revert optimistic update on error
      const newOptimisticUpdates = new Map(optimisticUpdates);
      newOptimisticUpdates.delete(subitemId);
      setOptimisticUpdates(newOptimisticUpdates);
      setForceUpdate(prev => prev + 1);
    }
  };

  const handleReasonSubmit = async () => {
    if (!pendingAction || !reasonText.trim()) {
      return;
    }
    
    const { subitemId, action } = pendingAction;
    
    // Apply optimistic update immediately for instant UI feedback
    const newOptimisticUpdates = new Map(optimisticUpdates);
    newOptimisticUpdates.set(subitemId, { status: action, timestamp: Date.now() });
    setOptimisticUpdates(newOptimisticUpdates);
    
    // Force re-render to show updated status immediately
    setForceUpdate(prev => prev + 1);
    
    try {
      await onAction(subitemId, action, reasonText.trim());
      
      // Smart auto-advance: use smart navigation for skip/fail actions
      // Stay on current item for FAILED actions to show updated status
      const nextActionableIndex = getNextActionableItem();
      if (action === 'FAILED') {
        // Don't navigate - stay on current item to show "Issue Reported" status
      } else if (nextActionableIndex >= 0) {
        setTimeout(() => {
          setCurrentSubitemIndex(nextActionableIndex);
        }, 500);
      } else if (currentSubitemIndex < subitems.length - 1) {
        // Fallback to sequential navigation if no more actionable items
        setTimeout(() => {
          setCurrentSubitemIndex(currentSubitemIndex + 1);
        }, 500);
      }
    } catch (error) {
      console.error('Subitem action failed:', error);
      // Revert optimistic update on error
      const revertedUpdates = new Map(optimisticUpdates);
      revertedUpdates.delete(subitemId);
      setOptimisticUpdates(revertedUpdates);
      setForceUpdate(prev => prev + 1);
    }
    
    // Close modal and reset state
    setShowReasonModal(false);
    setPendingAction(null);
    setReasonText('');
  };

  const handleReasonCancel = () => {
    setShowReasonModal(false);
    setPendingAction(null);
    setReasonText('');
  };

  const handlePreviousSubitem = () => {
    if (currentSubitemIndex > 0) {
      setCurrentSubitemIndex(currentSubitemIndex - 1);
    }
  };

  const handleNextSubitem = () => {
    if (currentSubitemIndex < subitems.length - 1) {
      setCurrentSubitemIndex(currentSubitemIndex + 1);
    }
  };

  const handleJumpToSubitem = (index: number) => {
    setCurrentSubitemIndex(index);
  };

  // Intelligent navigation: find next actionable item
  const getNextActionableItem = () => {
    for (let i = currentSubitemIndex + 1; i < subitems.length; i++) {
      if (subitems[i].status === 'PENDING' || subitems[i].status === 'IN_PROGRESS') {
        return i;
      }
    }
    return -1;
  };

  const handleSmartNext = () => {
    const nextActionableIndex = getNextActionableItem();
    if (nextActionableIndex >= 0) {
      setCurrentSubitemIndex(nextActionableIndex);
    }
  };

  const handleCompleteItem = () => {
    onCompleteItem();
    onClose();
  };


  const renderSequentialView = () => (
    <div className="sequential-view">
      {currentSubitemWithOptimistic ? (
        <>
          <div className="subitem-navigation">
            <button
              className="nav-btn prev"
              onClick={handlePreviousSubitem}
              disabled={currentSubitemIndex === 0}
            >
              <FaArrowLeft /> Previous
            </button>
            
            <div className="si-progress-indicator">
              <span className="step-text">Step {currentSubitemIndex + 1} of {subitems.length}</span>
              <div className="step-dots">
                {subitems.map((_, index) => (
                  <div
                    key={index}
                    className={`step-dot ${index === currentSubitemIndex ? 'active' : ''} ${index < currentSubitemIndex ? 'completed' : ''}`}
                  />
                ))}
              </div>
            </div>
            
            <button
              className="nav-btn next"
              onClick={handleNextSubitem}
              disabled={currentSubitemIndex === subitems.length - 1}
            >
              <FaArrowRight /> Next
            </button>

            {completionPercentage < 100 && (<button
              className="nav-btn smart-next"
              onClick={handleSmartNext}
              disabled={getNextActionableItem() === -1}
              title={getNextActionableItem() >= 0 ? `Jump to next actionable item (${getNextActionableItem() + 1})` : 'No more actionable items'}
            >
              <FaArrowRight /> {getNextActionableItem() >= 0 ? 'Continue' : 'End'}
            </button>
            )}
          </div>

          <div className="current-subitem" key={`${currentSubitemWithOptimistic?.id || currentSubitemIndex}-${currentSubitemWithOptimistic?.status || 'unknown'}-${currentSubitemWithOptimistic?.completed_at || 'not-completed'}-${currentSubitemWithOptimistic?.skipped_reason || 'not-skipped'}-${currentSubitemWithOptimistic?.failure_reason || 'not-failed'}`}>
            <div className="subitem-header">
              <h3>{currentSubitemWithOptimistic.title}</h3>
              <div className="subitem-meta">
                <span className="type-badge">{currentSubitemWithOptimistic.item_type}</span>
                {currentSubitemWithOptimistic.is_required && (
                  <span className="required-badge">Required</span>
                )}
                <span className="severity-indicator">
                  {'⚠'.repeat(currentSubitemWithOptimistic.severity)}
                </span>
              </div>
            </div>
            
            {currentSubitemWithOptimistic.description && (
              <p className="subitem-description">{currentSubitemWithOptimistic.description}</p>
            )}
            
            <div className="subitem-actions">
              {currentSubitemWithOptimistic.status === 'PENDING' && (
                <button
                  className="action-btn start"
                  onClick={() => handleSubitemAction(currentSubitemWithOptimistic.id, 'IN_PROGRESS')}
                >
                  <FaPlay /> Start Working
                </button>
              )}
              
              {currentSubitemWithOptimistic.status === 'IN_PROGRESS' && (
                <>
                  <button
                    className="action-btn complete"
                    onClick={() => handleSubitemAction(currentSubitemWithOptimistic.id, 'COMPLETED')}
                  >
                    <FaCheckCircle /> Mark Complete
                  </button>
                  
                  <button
                    className="action-btn skip"
                    onClick={() => handleSubitemAction(currentSubitemWithOptimistic.id, 'SKIPPED')}
                  >
                    <FaTimes /> Skip
                  </button>
                  
                  <button
                    className="action-btn fail"
                    onClick={() => handleSubitemAction(currentSubitemWithOptimistic.id, 'FAILED')}
                  >
                    <FaTimes /> Report Issue
                  </button>
                </>
              )}
              
              {currentSubitemWithOptimistic.status === 'COMPLETED' && (
                <div className="status-display completed">
                  <FaCheckCircle className="status-icon" />
                  <span>Completed</span>
                  {currentSubitemWithOptimistic.completed_at && (
                    <div className="completion-time">
                      at {new Date(currentSubitemWithOptimistic.completed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}
              
              {currentSubitemWithOptimistic.status === 'SKIPPED' && (
                <div className="status-display skipped">
                  <FaBan className="status-icon" />
                  <span>Skipped</span>
                  {currentSubitemWithOptimistic.skipped_reason && (
                    <div className="reason-display">
                      Reason: {currentSubitemWithOptimistic.skipped_reason}
                    </div>
                  )}
                </div>
              )}
              
              {currentSubitemWithOptimistic.status === 'FAILED' && (
                <div className="status-display failed">
                  <FaExclamationTriangle className="status-icon" />
                  <span>Issue Reported</span>
                  {currentSubitemWithOptimistic.failure_reason && (
                    <div className="reason-display">
                      Issue: {currentSubitemWithOptimistic.failure_reason}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="no-subitems">
          <FaCheckCircle className="completion-icon" />
          <h3>All Subitems Completed</h3>
          <p>Great work! All subitems for this item have been actioned.</p>
          <button
            className="complete-item-btn futuristic"
            onClick={handleCompleteItem}
          >
            <FaCheckCircle /> Complete Main Item
          </button>
        </div>
      )}
    </div>
  );


  if (!isOpen) return null;

  return (
    <div className="smart-subitem-modal-backdrop" onClick={onClose}>
      <div className="smart-subitem-modal futuristic" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-content">
            <h2 className="modal-title">{itemTitle}<div className="header-stats">
              <span className="completion-badge">{completionPercentage}%</span>
            </div></h2>
          </div>
          
          <div className="header-controls">
            <button className="close-btn" onClick={onClose}>
              <FaTimes />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="modal-content">
          <div className="sequential-view">
            {renderSequentialView()}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <div className="footer-info">
            <FaClock />
            <span>
              {allActioned 
                ? 'All subitems actioned - ready to complete main item'
                : `${stats.pending + stats.inProgress} subitem${(stats.pending + stats.inProgress) === 1 ? '' : 's'} remaining`
              }
            </span>
          </div>
        </div>
      </div>

      {/* Reason Modal */}
      {showReasonModal && (
        <div className="reason-modal-backdrop" onClick={handleReasonCancel}>
          <div className="reason-modal" onClick={(e) => e.stopPropagation()}>
            <div className="reason-modal-header">
              <h3>
                {pendingAction?.action === 'SKIPPED' ? 'Skip Subitem' : 'Report Issue'}
              </h3>
              <button className="reason-modal-close" onClick={handleReasonCancel}>
                <FaTimes />
              </button>
            </div>
            
            <div className="reason-modal-content">
              <p>
                {pendingAction?.action === 'SKIPPED' 
                  ? 'Please provide a reason for skipping this subitem:' 
                  : 'Please describe the issue with this subitem:'
                }
              </p>
              
              <textarea
                className="reason-textarea"
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder={
                  pendingAction?.action === 'SKIPPED' 
                    ? 'Enter reason for skipping...' 
                    : 'Describe the issue...'
                }
                rows={4}
                autoFocus
              />
            </div>
            
            <div className="reason-modal-actions">
              <button 
                className="reason-btn cancel"
                onClick={handleReasonCancel}
              >
                Cancel
              </button>
              <button 
                className="reason-btn confirm"
                onClick={handleReasonSubmit}
                disabled={!reasonText.trim()}
              >
                {pendingAction?.action === 'SKIPPED' ? 'Skip' : 'Report Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartSubitemModal;
