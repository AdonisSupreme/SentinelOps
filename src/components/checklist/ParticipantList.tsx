// src/components/checklist/ParticipantList.tsx
import React from 'react';
import { FaUser, FaIdBadge } from 'react-icons/fa';

interface Participant {
  id: string;
  username: string;
  email: string;
  role: string;
}

interface ParticipantListProps {
  participants: Participant[];
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants }) => {
  return (
    <div className="participant-list">
      {participants.length === 0 ? (
        <p className="no-participants">No participants yet</p>
      ) : (
        <ul>
          {participants.map((participant) => (
            <li key={participant.id} className="participant-item">
              <div className="participant-avatar">
                <FaUser />
              </div>
              <div className="participant-info">
                <span className="participant-name">{participant.username}</span>
                <span className="participant-email">{participant.email}</span>
              </div>
              <div className="participant-role">
                <FaIdBadge />
                <span>{participant.role}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ParticipantList;
