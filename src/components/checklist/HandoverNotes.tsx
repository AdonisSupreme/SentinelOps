// src/components/checklist/HandoverNotes.tsx
import React, { useState } from 'react';
import { useChecklist } from '../../contexts/checklistContext';
import { FaPlus, FaCheck, FaTimes } from 'react-icons/fa';

interface HandoverNotesProps {
  instanceId: string;
}

const HandoverNotes: React.FC<HandoverNotesProps> = ({ instanceId }) => {
  const { createHandoverNote, loading } = useChecklist();
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState(2);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const handleSubmit = async () => {
    if (content.trim()) {
      await createHandoverNote(content, priority);
      setContent('');
      setPriority(2);
      setIsFormOpen(false);
    }
  };

  return (
    <div className="handover-notes">
      {!isFormOpen ? (
        <button 
          className="btn-action"
          onClick={() => setIsFormOpen(true)}
        >
          <FaPlus /> Add Handover Note
        </button>
      ) : (
        <div className="note-form">
          <textarea
            placeholder="Write handover note for next shift..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="form-controls">
            <select 
              value={priority} 
              onChange={(e) => setPriority(parseInt(e.target.value))}
            >
              <option value="1">Low Priority</option>
              <option value="2">Medium Priority</option>
              <option value="3">High Priority</option>
            </select>
            <button 
              onClick={handleSubmit} 
              disabled={!content.trim() || loading}
              className="btn-confirm"
            >
              <FaCheck /> Save Note
            </button>
            <button 
              onClick={() => setIsFormOpen(false)}
              className="btn-cancel"
            >
              <FaTimes /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HandoverNotes;
