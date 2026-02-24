// src/components/checklist/HandoverNotes.tsx
import React, { useState, useEffect } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { FaPlus, FaCheck, FaTimes, FaFlag, FaClock, FaUser, FaArrowRight } from 'react-icons/fa';
import api from '../../services/api';

interface HandoverNote {
  id: string;
  from_instance_id: string;
  to_instance_id: string;
  content: string;
  priority: number;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
  created_by: string;
  created_at: string;
  from_shift?: string;
  from_date?: string;
  to_shift?: string;
  to_date?: string;
  created_by_username?: string;
  created_by_first_name?: string;
  created_by_last_name?: string;
  acknowledged_by_username?: string;
  resolved_by_username?: string;
  direction: 'incoming' | 'outgoing';
}

interface HandoverNotesProps {
  instanceId: string;
  onShowModal: () => void;
}

const HandoverNotes: React.FC<HandoverNotesProps> = ({ instanceId, onShowModal }) => {
  const { loading } = useChecklist();
  const [handoverNotes, setHandoverNotes] = useState<HandoverNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  // Load handover notes for this instance
  const loadHandoverNotes = async () => {
    setNotesLoading(true);
    try {
      const response = await api.get(`/api/v1/checklists/instances/${instanceId}/handover-notes`);
      setHandoverNotes(response.data.handover_notes || []);
    } catch (error) {
      console.error('Failed to load handover notes:', error);
    } finally {
      setNotesLoading(false);
    }
  };

  useEffect(() => {
    if (instanceId) {
      loadHandoverNotes();
    }
  }, [instanceId]);

  const handleAcknowledge = async (noteId: string) => {
    try {
      await api.post(`/api/v1/checklists/handover-notes/${noteId}/acknowledge`);
      loadHandoverNotes(); // Reload notes
    } catch (error) {
      console.error('Failed to acknowledge note:', error);
    }
  };

  const handleResolve = async (noteId: string, resolutionNotes?: string) => {
    try {
      await api.post(`/api/v1/checklists/handover-notes/${noteId}/resolve`, {
        resolutionNotes
      });
      loadHandoverNotes(); // Reload notes
    } catch (error) {
      console.error('Failed to resolve note:', error);
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return '#4caf50'; // Low - Green
      case 2: return '#ff9800'; // Medium - Orange
      case 3: return '#f44336'; // High - Red
      case 4: return '#9c27b0'; // Critical - Purple
      default: return '#757575'; // Grey
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return 'Low';
      case 2: return 'Medium';
      case 3: return 'High';
      case 4: return 'Critical';
      default: return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCreatorName = (note: HandoverNote) => {
    if (note.created_by_first_name && note.created_by_last_name) {
      return `${note.created_by_first_name} ${note.created_by_last_name}`;
    }
    return note.created_by_username || 'Unknown';
  };

  return (
    <div className="handover-notes">
      {/* Add Handover Note Button */}
      <button 
        className="btn-action"
        onClick={onShowModal}
      >
        <FaPlus /> Add Handover Note
      </button>

      {/* Display Existing Handover Notes */}
      <div className="existing-notes">
        {notesLoading ? (
          <div className="loading-notes">Loading handover notes...</div>
        ) : handoverNotes.length === 0 ? (
          <div className="no-notes">No handover notes for this shift</div>
        ) : (
          <div className="notes-list">
            {handoverNotes.map((note) => (
              <div 
                key={note.id} 
                className={`handover-note ${note.direction} ${note.acknowledged_at ? 'acknowledged' : ''} ${note.resolved_at ? 'resolved' : ''}`}
              >
                <div className="note-header">
                  <div className="note-meta">
                    <FaFlag style={{ color: getPriorityColor(note.priority) }} />
                    <span className="priority">{getPriorityLabel(note.priority)}</span>
                    <span className="direction">
                      {note.direction === 'outgoing' ? (
                        <>
                          <span>{note.from_shift} → {note.to_shift}</span>
                          <FaArrowRight />
                        </>
                      ) : (
                        <>
                          <FaArrowRight />
                          <span>{note.from_shift} → {note.to_shift}</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="note-timestamp">
                    <FaClock />
                    {formatDate(note.created_at)}
                  </div>
                </div>
                
                <div className="note-content">
                  <p>{note.content}</p>
                </div>
                
                <div className="note-footer">
                  <div className="note-author">
                    <FaUser />
                    <span>{getCreatorName(note)}</span>
                  </div>
                  
                  {/* Action buttons for incoming notes */}
                  {note.direction === 'incoming' && !note.acknowledged_at && (
                    <div className="note-actions">
                      <button 
                        className="btn-acknowledge"
                        onClick={() => handleAcknowledge(note.id)}
                      >
                        <FaCheck /> Acknowledge
                      </button>
                    </div>
                  )}
                  
                  {/* Status indicators */}
                  {note.acknowledged_at && (
                    <div className="note-status acknowledged">
                      <FaCheck /> Acknowledged by {note.acknowledged_by_username || 'Someone'}
                      {formatDate(note.acknowledged_at)}
                    </div>
                  )}
                  
                  {note.resolved_at && (
                    <div className="note-status resolved">
                      <FaCheck /> Resolved by {note.resolved_by_username || 'Someone'}
                      {formatDate(note.resolved_at)}
                      {note.resolution_notes && (
                        <div className="resolution-notes">
                          {note.resolution_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HandoverNotes;
