// src/pages/ChecklistPage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useChecklist } from '../contexts/checklistContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  FaArrowLeft, FaPlay, FaCheckCircle, FaClock, 
  FaExclamationTriangle, FaBan,
  FaUsers, FaCalendarAlt, FaFlag, FaShareAlt,
  FaChevronDown, FaChevronUp 
} from 'react-icons/fa';
import { ChecklistTimeline, ChecklistStats, HandoverNotes, ItemActions, ParticipantList } from '../components/checklist';
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
    loading, 
    error 
  } = useChecklist();
  
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completeWithExceptions, setCompleteWithExceptions] = useState(false);
  const [showShareFeedback, setShowShareFeedback] = useState(false);

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
      console.log('🔍 ChecklistPage Debug - CurrentInstance updated:', {
        id: currentInstance.id,
        template: currentInstance.template,
        templateName: currentInstance.template?.name,
        participants: currentInstance.participants,
        participantsCount: currentInstance.participants?.length,
        itemsCount: currentInstance.items?.length || 0,
        firstItem: currentInstance.items?.[0],
        firstItemTitle: currentInstance.items?.[0]?.template_item?.title,
        firstItemStructure: currentInstance.items?.[0] ? Object.keys(currentInstance.items[0]) : [],
        firstItemItemStructure: currentInstance.items?.[0]?.template_item ? Object.keys(currentInstance.items[0].template_item) : [],
        hasItemProperty: !!(currentInstance.items?.[0]?.template_item),
        allItemTitles: currentInstance.items?.map(item => item.template_item?.title || 'NO TITLE')
      });
      
    }
  }, [currentInstance]);

  const handleJoin = async () => {
    if (currentInstance) {
      console.log('Joining checklist:', currentInstance.id);
      await joinInstance(currentInstance.id);
      // After joining, reload the instance to get complete data including template
      if (id) {
        console.log('Reloading instance after join to get complete data');
        await loadInstance(id);
      }
    }
  };

  const handleItemAction = (itemId: string) => {
    setActiveItemId(activeItemId === itemId ? null : itemId);
  };

  const handleItemComplete = async () => {
    // Close the item actions panel
    setActiveItemId(null);
    
    // Refresh the current instance to show updated item status
    if (id) {
      console.log('🔄 Refreshing instance after item action...');
      await loadInstance(id);
      console.log('✅ Instance refreshed successfully');
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

  const canCompleteChecklist = user?.role === 'SUPERVISOR' || user?.role === 'MANAGER' || user?.role === 'admin';
  const isChecklistOpen = currentInstance?.status === 'OPEN' || currentInstance?.status === 'IN_PROGRESS';

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
      'OPEN': { label: 'Open', color: '#6b7280', icon: <FaClock /> },
      'IN_PROGRESS': { label: 'In Progress', color: '#00d9ff', icon: <FaPlay /> },
      'PENDING_REVIEW': { label: 'Pending Review', color: '#ffa502', icon: <FaClock /> },
      'COMPLETED': { label: 'Completed', color: '#2ed573', icon: <FaCheckCircle /> },
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
    return (
      <div className="checklist-loading">
        <div className="loading-spinner large"></div>
        <p>Loading Operational Checklist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checklist-error">
        <FaExclamationTriangle size={48} />
        <h3>Connection Error</h3>
        <p>
          {error.includes('Failed to load') 
            ? 'Unable to connect to the server. Please check your connection and try again.'
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
  const canJoin = !isUserParticipant && currentInstance.status === 'OPEN';

  return (
    <div className="checklist-page">
      {/* Header */}
      <header className="checklist-header">
        <button onClick={() => navigate('/')} className="back-btn">
          <FaArrowLeft /> Dashboard
        </button>
        
        <div className="header-content">
          <div className="checklist-title">
            <h1>{currentInstance?.template?.name || 'Untitled Checklist'}</h1>
            <div className="checklist-meta">
              <span><FaCalendarAlt /> {currentInstance?.checklist_date || 'Unknown Date'}</span>
              <span>•</span>
              <span>{currentInstance?.shift || 'UNKNOWN'} Shift ({getShiftTime(currentInstance?.shift || '')})</span>
              <span>•</span>
              {getStatusBadge(currentInstance?.status || 'OPEN')}
            </div>
          </div>

          <div className="header-actions">
            {canJoin && (
              <button onClick={handleJoin} className="btn-join">
                <FaUsers /> Join Checklist
              </button>
            )}
            {canCompleteChecklist && isChecklistOpen && (
              <button 
                onClick={() => setShowCompleteDialog(true)} 
                className="btn-complete"
              >
                <FaCheckCircle /> Complete Checklist
              </button>
            )}
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
        {/* Left Column - Timeline */}
        <div className="content-left">
          <section className="timeline-section">
            <div className="section-header">
              <h2>Operational Timeline</h2>
              {currentInstance.items && (
                <div>
                  {(() => {
                    const completedItems = currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0;
                    const totalItems = currentInstance.items?.length || 0;
                    const pendingItems = totalItems - completedItems;
                    
                    return (
                      <div className="timeline-stats">
                        <span className="stat">
                          <FaCheckCircle /> {completedItems} completed
                        </span>
                        <span className="stat">
                          <FaClock /> {pendingItems} pending
                        </span>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            
            <ChecklistTimeline 
              items={currentInstance.items || []}
              activeItemId={activeItemId}
              onItemClick={handleItemAction}
            />
          </section>
        </div>

        {/* Right Column - Sidebar */}
        <div className="content-right">
          {/* Stats Card */}
          <ChecklistStats stats={{
            completed_items: currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0,
            total_items: currentInstance.items?.length || 0,
            completion_percentage: (currentInstance.items?.length || 0) > 0 
              ? Math.round(((currentInstance.items?.filter(item => item.status === 'COMPLETED').length || 0) / (currentInstance.items?.length || 0)) * 100)
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

          {/* Active Item Actions */}
          {activeItemId && (
            <section className="sidebar-section">
              <div className="section-header">
                <h3><FaPlay /> Item Actions</h3>
              </div>
              <ItemActions 
                instanceId={currentInstance.id}
                itemId={activeItemId}
                currentStatus={currentInstance.items?.find(item => item.id === activeItemId)?.status}
                onComplete={handleItemComplete}
              />
            </section>
          )}

          {/* Complete Checklist Dialog */}
          {showCompleteDialog && (
            <section className="sidebar-section complete-dialog">
              <div className="section-header">
                <h3><FaCheckCircle /> Complete Checklist</h3>
              </div>
              <div className="complete-dialog-content">
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
                <div className="dialog-actions">
                  <button 
                    onClick={handleCompleteChecklist}
                    className="btn-action confirm"
                    disabled={loading}
                  >
                    {loading ? 'Completing...' : 'Confirm Complete'}
                  </button>
                  <button 
                    onClick={() => {
                      setShowCompleteDialog(false);
                      setCompleteWithExceptions(false);
                    }}
                    className="btn-action cancel"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;