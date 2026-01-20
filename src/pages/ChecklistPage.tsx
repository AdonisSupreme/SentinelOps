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
    loading, 
    error 
  } = useChecklist();
  
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [showHandover, setShowHandover] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);

  useEffect(() => {
    if (id) {
      loadInstance(id);
    }
  }, [id, loadInstance]);

  const handleJoin = async () => {
    if (currentInstance) {
      await joinInstance(currentInstance.id);
    }
  };

  const handleItemAction = (itemId: string) => {
    setActiveItemId(activeItemId === itemId ? null : itemId);
  };

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
      case 'MORNING': return '06:00 - 14:00';
      case 'AFTERNOON': return '14:00 - 22:00';
      case 'NIGHT': return '22:00 - 06:00';
      default: return '';
    }
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
        <h3>Checklist Not Found</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          <FaArrowLeft /> Return to Dashboard
        </button>
      </div>
    );
  }

  if (!currentInstance) {
    return null;
  }

  const isUserParticipant = currentInstance.participants.some(p => p.id === user?.id);
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
            <h1>{currentInstance.template.name}</h1>
            <div className="checklist-meta">
              <span><FaCalendarAlt /> {currentInstance.checklist_date}</span>
              <span>•</span>
              <span>{currentInstance.shift} Shift ({getShiftTime(currentInstance.shift)})</span>
              <span>•</span>
              {getStatusBadge(currentInstance.status)}
            </div>
          </div>

          <div className="header-actions">
            {canJoin && (
              <button onClick={handleJoin} className="btn-join">
                <FaUsers /> Join Checklist
              </button>
            )}
            <button className="btn-share">
              <FaShareAlt /> Share
            </button>
          </div>
        </div>
      </header>

      <div className="checklist-content">
        {/* Left Column - Timeline */}
        <div className="content-left">
          <section className="timeline-section">
            <div className="section-header">
              <h2>Operational Timeline</h2>
              <div className="timeline-stats">
                <span className="stat">
                  <FaCheckCircle /> {currentInstance.statistics.completed_items} completed
                </span>
                <span className="stat">
                  <FaClock /> {currentInstance.statistics.total_items - currentInstance.statistics.completed_items} pending
                </span>
              </div>
            </div>
            
            <ChecklistTimeline 
              items={currentInstance.items}
              activeItemId={activeItemId}
              onItemClick={handleItemAction}
            />
          </section>
        </div>

        {/* Right Column - Sidebar */}
        <div className="content-right">
          {/* Stats Card */}
          <ChecklistStats stats={currentInstance.statistics} />

          {/* Participants */}
          <section className="sidebar-section">
            <div 
              className="section-header collapsible"
              onClick={() => setShowParticipants(!showParticipants)}
            >
              <h3><FaUsers /> Team Members ({currentInstance.participants.length})</h3>
              {showParticipants ? <FaChevronUp /> : <FaChevronDown />}
            </div>
            {showParticipants && (
              <ParticipantList participants={currentInstance.participants} />
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
                onComplete={() => setActiveItemId(null)}
              />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistPage;