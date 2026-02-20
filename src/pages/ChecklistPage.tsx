// src/pages/ChecklistPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChecklist } from '../contexts/checklistContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaArrowLeft, FaPlay, FaCheckCircle, FaClock, 
  FaExclamationTriangle, FaBan, FaTimes,
  FaUsers, FaCalendarAlt, FaFlag, FaShareAlt,
  FaChevronDown, FaChevronUp, FaDownload, FaFilePdf
} from 'react-icons/fa';
import { 
  ChecklistStats, HandoverNotes, ItemActions, 
  ParticipantList, EnhancedChecklistItem, SmartSubitemModal
} from '../components/checklist';
import { ChecklistPageSkeleton } from '../components/checklist/ChecklistPageSkeleton';
import { pdfService } from '../services/pdfService';
import '../components/checklist/ChecklistPageSkeleton.css';
import './ChecklistPage.css';

const ChecklistPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    currentInstance, 
    loadInstance, 
    joinInstance, 
    completeInstance,
    updateSubitemStatus,
    loading, 
    error 
  } = useChecklist();
  
  const [showHandover, setShowHandover] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeWithExceptions, setCompleteWithExceptions] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showShareFeedback, setShowShareFeedback] = useState(false);
  const [showItemActionsModal, setShowItemActionsModal] = useState(false);
  const [selectedItemForActions, setSelectedItemForActions] = useState<any>(null);
  const [showSubitemModal, setShowSubitemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Handler for ItemActions modal
  const handleItemActionsClick = (item: any) => {
    setSelectedItemForActions(item);
    setShowItemActionsModal(true);
  };

  const handleItemActionsClose = () => {
    setShowItemActionsModal(false);
    setSelectedItemForActions(null);
  };

  // Handler for when ItemActions completes (e.g., starting work)
  const handleItemActionsComplete = async (action?: string, hasSubitems?: boolean) => {
    console.log('🔄 handleItemActionsComplete called with:', { action, hasSubitems, selectedItemForActions });
    
    // If action is IN_PROGRESS and item has subitems, show SmartSubitemModal immediately
    if (action === 'IN_PROGRESS' && hasSubitems && selectedItemForActions) {
      // Refresh instance to get updated status
      if (id) {
        await loadInstance(id);
        // Get the current instance data to ensure we have the latest
        const updatedItem = currentInstance?.items?.find((item: any) => item.id === selectedItemForActions.id);
        
        if (updatedItem) {
          // Show SmartSubitemModal for items with subitems
          setSelectedItem(updatedItem);
          setShowSubitemModal(true);
          console.log('✅ Showing SmartSubitemModal for item with subitems');
        }
      }
    } else {
      // For all other actions or items without subitems, just close the modal
      console.log('✅ Closing ItemActions modal - no subitems or different action');
    }
    
    // Close ItemActions modal
    handleItemActionsClose();
  };

  useEffect(() => {
    if (id && id !== 'undefined') {
      console.log('Loading checklist instance with ID:', id);
      loadInstance(id);
    } else {
      console.warn('Invalid checklist ID provided:', id);
    }
  }, [id, loadInstance]);

  useEffect(() => {
    if (currentInstance) {
      console.log('🔍 Enhanced ChecklistPage - CurrentInstance updated:', {
        id: currentInstance.id,
        template: currentInstance.template,
        templateName: currentInstance.template?.name,
        participants: currentInstance.participants,
        participantsCount: currentInstance.participants?.length,
        itemsCount: currentInstance.items?.length || 0,
        firstItem: currentInstance.items?.[0],
        firstItemTitle: currentInstance.items?.[0]?.title || currentInstance.items?.[0]?.template_item?.title,
        firstItemStructure: currentInstance.items?.[0] ? Object.keys(currentInstance.items[0]) : [],
        firstItemItemStructure: currentInstance.items?.[0]?.template_item ? Object.keys(currentInstance.items[0].template_item) : [],
        hasItemProperty: !!(currentInstance.items?.[0]?.template_item),
        allItemTitles: currentInstance.items?.map(item => item.title || 'NO TITLE')
      });
    }
  }, [currentInstance]);

  const handleJoin = async () => {
    if (currentInstance && !isJoining) {
      setIsJoining(true);
      console.log('Joining checklist:', currentInstance.id);
      try {
        await joinInstance(currentInstance.id);
        // After joining, reload instance to get complete data including template
        if (id) {
          console.log('Reloading instance after join to get complete data');
          await loadInstance(id);
        }
      } finally {
        setIsJoining(false);
      }
    }
  };

  const handleItemClick = (itemId: string, item: any) => {
    // Check if item has subitems
    const hasSubitems = item.subitems && item.subitems.length > 0;
    
    if (hasSubitems) {
      // If item has subitems and is in progress, show subitem modal
      if (item.status === 'IN_PROGRESS') {
        setSelectedItem(item);
        setShowSubitemModal(true);
      } else {
        // Otherwise, show item actions modal
        handleItemActionsClick(item);
      }
    } else {
      // No subitems, show item actions modal
      handleItemActionsClick(item);
    }
  };

  const handleItemComplete = async () => {
    // Close subitem modal and item actions modal
    setShowSubitemModal(false);
    setShowItemActionsModal(false);
    setSelectedItem(null);
    setSelectedItemForActions(null);
    
    // Refresh current instance to show updated item status
    if (id) {
      console.log('🔄 Refreshing instance after item action...');
      await loadInstance(id);
      console.log('✅ Instance refreshed successfully');
    }
  };

  const handleSubitemAction = async (subitemId: string, action: 'COMPLETED' | 'SKIPPED' | 'FAILED' | 'IN_PROGRESS', notes?: string) => {
    try {
      if (!selectedItem || !id) {
        throw new Error('No selected item or instance ID');
      }

      // Call the proper API method from checklist context
      // The context will handle optimistic updates and instance refresh
      await updateSubitemStatus(id, selectedItem.id, subitemId, action, notes, notes);
      
      console.log(`✅ Subitem action completed: ${action} on ${subitemId}`, notes);
      
      // No need to manually refresh instance here - context handles it
      // This prevents race conditions and ensures consistent state
    } catch (error) {
      console.error('Failed to perform subitem action:', error);
    }
  };

  const handleCompleteItem = async () => {
    try {
      if (selectedItem && id) {
        await completeInstance(id, completeWithExceptions);
        setShowSubitemModal(false);
        setSelectedItem(null);
        
        // Refresh instance
        await loadInstance(id);
      }
    } catch (error) {
      console.error('Failed to complete item:', error);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShowShareFeedback(true);
      setTimeout(() => setShowShareFeedback(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setShowShareFeedback(true);
      setTimeout(() => setShowShareFeedback(false), 2000);
    }
  };

  const handleDownloadPDF = async () => {
    if (!id || isGeneratingPDF) return;
    
    setIsGeneratingPDF(true);
    try {
      await pdfService.generateAndDownloadPDF(id);
    } catch (error) {
      console.error('PDF download failed:', error);
      // Error is handled by the PDF service
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleCompleteChecklist = async () => {
    if (!currentInstance || !id) return;
    
    try {
      await completeInstance(id, completeWithExceptions);
      setShowCompleteDialog(false);
      setCompleteWithExceptions(false);
    } catch (err) {
      console.error('Failed to complete checklist:', err);
    }
  };

  const canCompleteChecklist = user?.role === 'MANAGER' || user?.role === 'admin';
  const isChecklistActive = currentInstance?.status === 'OPEN' || currentInstance?.status === 'IN_PROGRESS' || currentInstance?.status === 'PENDING_REVIEW';

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      'OPEN': { label: 'Open', color: '#6b7280', icon: <FaClock /> },
      'IN_PROGRESS': { label: 'In Progress', color: '#023aa3ff', icon: <FaPlay /> },
      'PENDING_REVIEW': { label: 'Pending Review', color: '#ffa502', icon: <FaClock /> },
      'COMPLETED': { label: 'Completed', color: '#005423ff', icon: <FaCheckCircle /> },
      'COMPLETED_WITH_EXCEPTIONS': { label: 'With Exceptions', color: '#ff4757', icon: <FaExclamationTriangle /> },
      'CLOSED_BY_EXCEPTION': { label: 'Closed by Exception', color: '#ff4757', icon: <FaBan /> },
    };

    const config = statusConfig[status] || statusConfig.OPEN;
    return (
      <span 
        className="status-badge" 
        style={{ backgroundColor: `${config.color}20`, color: config.color, borderColor: config.color }}
      >
        {config.icon}
        {config.label}
      </span>
    );
  };

  const getShiftTime = (shift: string) => {
    switch (shift) {
      case 'MORNING': return '07:00 - 15:00';
      case 'AFTERNOON': return '15:00 - 23:00';
      case 'NIGHT': return '23:00 - 07:00';
      default: return '';
    }
  };

  const calculateTimeRemaining = (instance: any) => {
    if (!instance) return 0;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Get shift end time based on shift type
    let shiftEndTime;
    switch (instance.shift) {
      case 'MORNING':
        shiftEndTime = '15:00';
        break;
      case 'AFTERNOON':
        shiftEndTime = '23:00';
        break;
      case 'NIGHT':
        // For night shift, if it's before midnight, end time is today, else tomorrow
        if (now.getHours() >= 23) {
          shiftEndTime = '07:00';
          // Add one day to target date
          today.setDate(today.getDate() + 1);
        } else {
          shiftEndTime = '07:00';
        }
        break;
      default:
        shiftEndTime = '23:00';
    }
    
    const shiftEndDateTime = new Date(today.toDateString() + ' ' + shiftEndTime);
    const timeDiff = shiftEndDateTime.getTime() - now.getTime();
    const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
    
    return minutesRemaining;
  };

  if (loading && !currentInstance) {
    return <ChecklistPageSkeleton />;
  }

  if (error) {
    return (
      <div className="checklist-error">
        <FaExclamationTriangle size={48} />
        <h3>Connection Error</h3>
        <p>
          {error.includes('Failed to load') 
            ? 'Unable to connect to server. Please check your connection and try again.'
            : error}
        </p>
        <div className="error-actions">
          <button onClick={() => navigate('/')} className="btn-primary">
            <FaArrowLeft /> Return to Dashboard
          </button>
          <button onClick={() => window.location.reload()} className="btn-secondary">
            Refresh Page
          </button>
          {id && (
            <button onClick={() => loadInstance(id)} className="btn-secondary">
              Retry Loading
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!currentInstance) {
    return null;
  }

  const isUserParticipant = currentInstance.participants?.some((p: { id: string }) => p.id === user?.id) ?? false;
  const canJoin = !isUserParticipant && (currentInstance.status === 'OPEN' || currentInstance.status === 'IN_PROGRESS');

  return (
    <div className="checklist-page">
      {/* Header */}
      <header className="checklist-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <FaArrowLeft /> Dashboard
        </button>
        
        <div className="header-content">
          <div className="checklist-title">
            <span className='shift-header-title'>{currentInstance?.template?.name || 'Untitled Checklist'}</span>
            <div className="checklist-meta">
              <span><FaCalendarAlt /> {currentInstance?.checklist_date || 'Unknown Date'}</span>
              <span>•</span>
              <span>{currentInstance?.shift || 'UNKNOWN'} SHIFT ({getShiftTime(currentInstance?.shift || '')})</span>
              <span>•</span>
              {getStatusBadge(currentInstance?.status || 'UNKNOWN')}
            </div>
          </div>

          <div className="header-actions">
            {canJoin && (
              <button 
                onClick={handleJoin} 
                className="btn-join"
                disabled={isJoining}
              >
                <FaUsers /> {isJoining ? 'Joining...' : 'Join Checklist'}
              </button>
            )}
            {canCompleteChecklist && isChecklistActive && (
              <button 
                onClick={() => setShowCompleteDialog(true)} 
                className="btn-complete"
              >
                <FaCheckCircle /> Complete Checklist
              </button>
            )}
            <button 
              className="btn-download-pdf" 
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF || !id}
              title="Download SentinelOps Checklist PDF"
            >
              <FaFilePdf /> 
              {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
            </button>
            <button className="btn-share" onClick={handleShare}>
              <FaShareAlt /> Share
            </button>
            {showShareFeedback && (
              <span className="share-feedback">Link copied!</span>
            )}
          </div>
        </div>
      </header>

      <div className="checklist-content">
        {/* Items with Enhanced Subitem Display */}
        <div className="items-section">
          {currentInstance.items?.map((item: any) => (
            <EnhancedChecklistItem
              key={item.id}
              instanceId={currentInstance.id}
              item={item}
              onItemAction={handleItemClick}
              onItemComplete={handleItemComplete}
              onItemActionsClick={handleItemActionsClick}
            />
          ))}
        </div>

        {/* Right Sidebar */}
        <div className="content-right">
          {/* Stats Card */}
          <ChecklistStats stats={{
            completed_items: currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0,
            total_items: currentInstance.items?.length || 0,
            completion_percentage: (currentInstance.items?.length || 0) > 0 
              ? Math.round(((currentInstance.items?.filter(item => ['COMPLETED', 'SKIPPED', 'FAILED'].includes(item.status)).length || 0) / (currentInstance.items?.length || 0)) * 100)
              : 0,
            time_remaining_minutes: calculateTimeRemaining(currentInstance)
          }} />

          {/* Participants */}
          <section className="sidebar-section">
            <div 
              className="section-header collapsible"
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <h3><FaUsers /> Team Members ({currentInstance.participants?.length || 0})</h3>
              {showParticipants ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            {showParticipants && (
              <ParticipantList participants={currentInstance.participants || []} />
            )}
          </section>

          {/* Handover Notes */}
          <section className="sidebar-section">
            <div 
              className="section-header collapsible"
              onClick={() => setShowHandover(!showHandover)}
            >
              <h3><FaFlag /> Handover Notes</h3>
              {showHandover ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            {showHandover && (
              <HandoverNotes instanceId={currentInstance.id} />
            )}
          </section>
        </div>
      </div>

      {/* Item Actions Modal */}
      {showItemActionsModal && selectedItemForActions && (
        <div 
          className="enhanced-item-actions-modal-overlay" 
          onClick={handleItemActionsClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div 
            className="enhanced-item-actions-modal" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="enhanced-modal-header">
              <h3 id="modal-title"><FaPlay /> Item Actions</h3>
              <button 
                className="enhanced-modal-close"
                onClick={handleItemActionsClose}
                aria-label="Close modal"
                type="button"
              >
                ✕
              </button>
            </div>
            <ItemActions
              instanceId={currentInstance.id}
              itemId={selectedItemForActions.id}
              currentStatus={selectedItemForActions.status}
              onComplete={handleItemActionsComplete}
            />
          </div>
        </div>
      )}

      {/* Smart Subitem Modal */}
      {showSubitemModal && selectedItem && (
        <SmartSubitemModal
          isOpen={showSubitemModal}
          itemTitle={selectedItem.title || selectedItem.template_item?.title}
          itemId={selectedItem.id}
          instanceId={currentInstance.id}
          subitems={selectedItem.subitems || []}
          onAction={handleSubitemAction}
          onCompleteItem={handleCompleteItem}
          onClose={() => {
            setShowSubitemModal(false);
            setSelectedItem(null);
          }}
        />
      )}

      {/* Complete Checklist Dialog */}
      {showCompleteDialog && (
        <div className="reason-modal-backdrop">
          <div className="reason-modal">
            <div className="reason-modal-header">
              <h3><FaCheckCircle /> Complete Checklist</h3>
              <button 
                onClick={() => {
                  setShowCompleteDialog(false);
                  setCompleteWithExceptions(false);
                }}
                className="reason-btn cancel"
              >
                <FaTimes />
              </button>
            </div>
            <div className="reason-modal-content">
              <p>Are you sure you want to complete this checklist?</p>
              <div className="completion-stats">
                <span>
                  {currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0} / {currentInstance.items?.length || 0} items completed
                </span>
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={completeWithExceptions}
                  onChange={(e) => setCompleteWithExceptions(e.target.checked)}
                />
                Complete with exceptions (allow skipped/failed items)
              </label>
            </div>
            <div className="reason-modal-actions">
              <button 
                onClick={handleCompleteChecklist}
                className="reason-btn confirm"
                disabled={loading}
              >
                {loading ? 'Completing...' : 'Confirm Complete'}
              </button>
              
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistPage;
