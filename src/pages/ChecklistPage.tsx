// src/pages/ChecklistPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChecklist } from '../contexts/checklistContext';
import { useAuth } from '../contexts/AuthContext';
import {
  FaArrowLeft, FaPlay, FaCheckCircle, FaClock,
  FaExclamationTriangle, FaBan, FaTimes,
  FaUsers, FaCalendarAlt, FaFlag, FaShareAlt,
  FaChevronDown, FaChevronUp, FaFilePdf, FaHistory, FaSearch
} from 'react-icons/fa';
import {
  ChecklistStats, HandoverNotes, ItemActions,
  ParticipantList, EnhancedChecklistItem, SmartSubitemModal
} from '../components/checklist';
import HandoverNoteModal from '../components/checklist/HandoverNoteModal';
import RealtimeIndicator from '../components/checklist/RealtimeIndicator';
import { ChecklistPageSkeleton } from '../components/checklist/ChecklistPageSkeleton';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { pdfService } from '../services/pdfService';
import { checklistApi } from '../services/checklistApi';
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
    updateItemStatus,
    updateSubitemStatus,
    loading
  } = useChecklist();

  const [showHandover, setShowHandover] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeWithExceptions, setCompleteWithExceptions] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [showShareFeedback, setShowShareFeedback] = useState(false);
  const [showItemActionsModal, setShowItemActionsModal] = useState(false);
  const [selectedItemForActions, setSelectedItemForActions] = useState<any>(null);
  const [showSubitemModal, setShowSubitemModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPDFWarning, setShowPDFWarning] = useState(false);
  const [showHandoverNoteModal, setShowHandoverNoteModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showDateShiftModal, setShowDateShiftModal] = useState(false);
  const [showDateShiftWarning, setShowDateShiftWarning] = useState(false);
  const [dateShiftValue, setDateShiftValue] = useState('');
  const [dateShiftError, setDateShiftError] = useState('');
  const [dateShiftBusy, setDateShiftBusy] = useState(false);
  const [inspectionMode, setInspectionMode] = useState(false);
  const [timelineNow, setTimelineNow] = useState(() => Date.now());

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
    console.log('ðŸ”„ handleItemActionsComplete called with:', { action, hasSubitems, selectedItemForActions });

    // If action is IN_PROGRESS and item has subitems, show SmartSubitemModal immediately
    if (action === 'IN_PROGRESS' && hasSubitems && selectedItemForActions) {
      // Refresh instance to get updated status
      if (id) {
        const refreshedInstance = await loadInstance(id);
        const updatedItem = refreshedInstance?.items?.find((item: any) => item.id === selectedItemForActions.id);

        if (updatedItem) {
          // Show SmartSubitemModal for items with subitems
          setSelectedItem(updatedItem);
          setShowSubitemModal(true);
          console.log('âœ… Showing SmartSubitemModal for item with subitems');
        }
      }
    } else {
      // For all other actions or items without subitems, just close the modal
      console.log('âœ… Closing ItemActions modal - no subitems or different action');
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
      console.log('ðŸ” Enhanced ChecklistPage - CurrentInstance updated:', {
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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimelineNow(Date.now());
    }, 30000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

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
      console.log('ðŸ”„ Refreshing instance after item action...');
      await loadInstance(id);
      console.log('âœ… Instance refreshed successfully');
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

      console.log(`âœ… Subitem action completed: ${action} on ${subitemId}`, notes);

      // No need to manually refresh instance here - context handles it
      // This prevents race conditions and ensures consistent state
    } catch (error) {
      console.error('Failed to perform subitem action:', error);
    }
  };

  const handleCompleteItem = async () => {
    try {
      if (selectedItem && id) {
        await updateItemStatus(id, selectedItem.id, 'COMPLETED', 'All subitems completed');
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

  const generateChecklistPDF = async () => {
    if (!id || isGeneratingPDF) return;

    setIsGeneratingPDF(true);
    try {
      await pdfService.generateAndDownloadPDF(id);
    } catch (error) {
      console.error('PDF download failed:', error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!id || isGeneratingPDF) return;

    const isCompletedChecklist = ['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS', 'INCOMPLETE'].includes(
      currentInstance?.status || ''
    );

    if (!isCompletedChecklist) {
      setShowPDFWarning(true);
      return;
    }

    await generateChecklistPDF();
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

  const openDateShiftFeature = () => {
    const isCompletedChecklist = ['COMPLETED', 'COMPLETED_WITH_EXCEPTIONS', 'INCOMPLETE'].includes(
      currentInstance?.status || ''
    );

    if (!isCompletedChecklist) {
      setShowDateShiftWarning(true);
      return;
    }

    setDateShiftValue(currentInstance?.checklist_date || '');
    setDateShiftError('');
    setShowDateShiftModal(true);
  };

  const submitDateShift = async () => {
    if (!id || !dateShiftValue || dateShiftBusy) return;
    setDateShiftBusy(true);
    setDateShiftError('');
    try {
      await checklistApi.changeInstanceDate(id, dateShiftValue);
      await loadInstance(id);
      setShowDateShiftModal(false);
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || 'Failed to change checklist date.';
      setDateShiftError(message);
    } finally {
      setDateShiftBusy(false);
    }
  };

  const userRole = (user?.role || '').toLowerCase();
  const canCompleteChecklist = userRole === 'manager' || userRole === 'admin';
  const isChecklistActive = currentInstance?.status === 'OPEN' || currentInstance?.status === 'IN_PROGRESS' || currentInstance?.status === 'PENDING_REVIEW';
  const canApproveChecklist = canCompleteChecklist && currentInstance?.status === 'PENDING_REVIEW';

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; tone: string; icon: React.ReactNode }> = {
      'OPEN': { label: 'Open', tone: 'neutral', icon: <FaClock /> },
      'IN_PROGRESS': { label: 'In Progress', tone: 'progress', icon: <FaPlay /> },
      'PENDING_REVIEW': { label: 'Pending Approval', tone: 'review', icon: <FaClock /> },
      'COMPLETED': { label: 'Completed', tone: 'success', icon: <FaCheckCircle /> },
      'COMPLETED_WITH_EXCEPTIONS': { label: 'With Exceptions', tone: 'critical', icon: <FaExclamationTriangle /> },
      'INCOMPLETE': { label: 'Incomplete', tone: 'critical', icon: <FaBan /> },
    };

    const config = statusConfig[status] || statusConfig.OPEN;
    return (
      <span className={`status-badge status-${config.tone}`}>
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

  const guideItems = [
    {
      title: 'Header and Status',
      body: 'The checklist header combines the active template, shift window, and lifecycle state so the operating context is always visible.'
    },
    {
      title: 'Checklist Items',
      body: 'Each item card groups status, metadata, and subitem progress into one place to reduce context switching while executing the shift.'
    },
    {
      title: 'Sidebar Oversight',
      body: 'Progress summary, handover notes, and participant information are placed together so supervisors can assess readiness and coordination quickly.'
    },
    {
      title: 'Action Controls',
      body: 'Join, complete, export, and share controls affect the full checklist, so they are anchored in the header for easy access.'
    }
  ];

  if (loading && !currentInstance) {
    return <ChecklistPageSkeleton />;
  }

  if (!currentInstance) {
    return <ChecklistPageSkeleton />;
  }

  const isUserParticipant = currentInstance.participants?.some((p: { id: string }) => p.id === user?.id) ?? false;
  const canJoin = !isUserParticipant && (currentInstance.status === 'OPEN' || currentInstance.status === 'IN_PROGRESS');

  return (
    <div className="checklist-page">
      {/* Header */}
      <header className="checklist-header main-header">
        <button type="button" onClick={() => navigate('/')} className="back-btn">
          <FaArrowLeft /> Dashboard
        </button>

        <div className="header-content">
          <div className="checklist-title">
            <span className='shift-header-title'>{currentInstance?.template?.name || 'Untitled Checklist'}</span>
            <div className="checklist-meta">
              <span><FaCalendarAlt /> {currentInstance?.checklist_date || 'Unknown Date'}</span>
              <span className="meta-divider">•</span>
              <span>{currentInstance?.shift || 'UNKNOWN'} SHIFT ({getShiftTime(currentInstance?.shift || '')})</span>
              <span className="meta-divider">•</span>
              {getStatusBadge(currentInstance?.status || 'UNKNOWN')}
            </div>
          </div>

          <div className="header-actions">
            <RealtimeIndicator />

            {canJoin && (
              <button
                onClick={handleJoin}
                className="btn-join"
                disabled={isJoining}
              >
                <FaUsers /> {isJoining ? 'Joining...' : 'Join Checklist'}
              </button>
            )}
            {canApproveChecklist && isChecklistActive && (
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
            <button
              className={`btn-inspect ${inspectionMode ? 'is-active' : ''}`}
              onClick={() => setInspectionMode((current) => !current)}
              type="button"
            >
              <FaSearch /> {inspectionMode ? 'Hide Inspection' : 'Inspect Activity'}
            </button>
            <button
              className="btn-date-shift-hidden"
              onClick={openDateShiftFeature}
              title="Temporal calibration (restricted)"
            >
              <FaHistory />
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
              inspectionMode={inspectionMode}
              currentTime={timelineNow}
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
              <HandoverNotes
                instanceId={currentInstance.id}
                onShowModal={() => setShowHandoverNoteModal(true)}
              />
            )}
          </section>

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
                ×
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

      {/* Handover Note Modal */}
      {showHandoverNoteModal && (
        <HandoverNoteModal
          isOpen={showHandoverNoteModal}
          onClose={() => setShowHandoverNoteModal(false)}
          instanceId={currentInstance.id}
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

      {showPDFWarning && (
        <div className="reason-modal-backdrop">
          <div className="reason-modal pdf-warning-modal">
            <div className="reason-modal-header">
              <h3><FaExclamationTriangle /> Incomplete Checklist Export</h3>
              <button
                onClick={() => setShowPDFWarning(false)}
                className="reason-btn cancel"
                type="button"
              >
                <FaTimes />
              </button>
            </div>
            <div className="reason-modal-content">
              <div className="pdf-warning-note">
                <strong>This checklist has not been completed yet.</strong>
                <p>
                  Exporting now may produce a report with pending work, incomplete evidence, and a status that does not
                  reflect the final operational outcome.
                </p>
              </div>
              <div className="pdf-warning-metrics">
                <span>
                  Completed items: {currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0} / {currentInstance.items?.length || 0}
                </span>
                <span>Current status: {currentInstance.status}</span>
              </div>
            </div>
            <div className="reason-modal-actions pdf-warning-actions">
              <button
                onClick={() => setShowPDFWarning(false)}
                className="btn-secondary"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowPDFWarning(false);
                  await generateChecklistPDF();
                }}
                className="reason-btn confirm"
                disabled={isGeneratingPDF}
                type="button"
              >
                {isGeneratingPDF ? 'Generating...' : 'Acknowledge and Download'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDateShiftWarning && (
        <div className="reason-modal-backdrop">
          <div className="reason-modal pdf-warning-modal">
            <div className="reason-modal-header">
              <h3><FaExclamationTriangle /> Timeline Protection</h3>
              <button
                onClick={() => setShowDateShiftWarning(false)}
                className="reason-btn cancel"
                type="button"
              >
                <FaTimes />
              </button>
            </div>
            <div className="reason-modal-content">
              <div className="pdf-warning-note">
                <strong>This checklist is not completed.</strong>
                <p>Changing the date now and completing the checklist after will distort the timeline.</p>
              </div>
            </div>
            <div className="reason-modal-actions pdf-warning-actions">
              <button
                onClick={() => setShowDateShiftWarning(false)}
                className="btn-secondary"
                type="button"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}

      {showDateShiftModal && (
        <div className="reason-modal-backdrop">
          <div className="reason-modal date-shift-modal">
            <div className="reason-modal-header">
              <h3><FaHistory /> Temporal Calibration</h3>
              <button
                onClick={() => setShowDateShiftModal(false)}
                className="reason-btn cancel"
                type="button"
              >
                <FaTimes />
              </button>
            </div>
            <div className="reason-modal-content">
              <p className="date-shift-copy">
                Hidden SentinelOps control for correcting the operational date of a completed checklist and its evidence trail.
              </p>
              <div className="date-shift-field">
                <label htmlFor="date-shift-input">Checklist Date</label>
                <input
                  id="date-shift-input"
                  type="date"
                  value={dateShiftValue}
                  onChange={(e) => setDateShiftValue(e.target.value)}
                  max="2100-12-31"
                />
              </div>
              {dateShiftError ? <p className="date-shift-error">{dateShiftError}</p> : null}
            </div>
            <div className="reason-modal-actions pdf-warning-actions">
              <button
                onClick={() => setShowDateShiftModal(false)}
                className="btn-secondary"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={submitDateShift}
                className="reason-btn confirm"
                disabled={dateShiftBusy || !dateShiftValue}
                type="button"
              >
                {dateShiftBusy ? 'Rewriting Timeline...' : 'Apply Date Change'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showGuide && (
        <div className="checklist-guide-overlay" onClick={() => setShowGuide(false)}>
          <div className="checklist-guide-panel" onClick={(event) => event.stopPropagation()}>
            <div className="checklist-guide-header">
              <div>
                <span className="checklist-guide-kicker">SentinelOps Guide</span>
                <h3>Understanding the checklist workspace</h3>
              </div>
              <button type="button" className="checklist-guide-close" onClick={() => setShowGuide(false)}>
                ×
              </button>
            </div>

            <p className="checklist-guide-intro">
              This workspace is designed for disciplined shift execution: clear status, low-friction actions,
              and fast awareness of progress, exceptions, and coordination.
            </p>

            <div className="checklist-guide-grid">
              {guideItems.map((item) => (
                <article key={item.title} className="checklist-guide-card">
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>

            <div className="checklist-guide-footer">
              <div className="guide-note-card">
                <span>Recommended workflow</span>
                <p>Join the checklist, scan the header and progress summary, then work through the item cards while monitoring handover notes and team presence.</p>
              </div>
              <div className="guide-note-card">
                <span>SentinelOps principle</span>
                <p>The checklist page reduces ambiguity. Every panel is intended to help the team decide what requires attention next.</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <PageGuide guide={pageGuides.checklist} />
    </div>
  );
};

export default ChecklistPage;
