import React from 'react';
import { FaUsers } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './ParticipantList.css';

interface Participant {
  id: string;
  username: string;
  email: string;
  role: string;
  is_online?: boolean;
}

const ParticipantList: React.FC<{ participants: Participant[] }> = ({ participants = [] }) => {
  const { user } = useAuth();
  const isOnline = (person: Participant) => Boolean(person.is_online || (user?.id && person.id === user.id));
  const onlineCount = participants.filter(isOnline).length;
  return (
    <div className="participant-list team-roster">
      <div className="team-roster-summary"><span>{participants.length} {participants.length === 1 ? 'member' : 'members'}</span><span><i aria-hidden="true" />{onlineCount} online</span></div>
      {participants.length === 0 ? <div className="team-roster-empty"><FaUsers aria-hidden="true"/><strong>No one has joined yet</strong><p>Members appear here when they join this checklist.</p></div> :
        <ul className="team-roster-list" aria-label="Checklist team members">
          {participants.map(person => {
            const online = isOnline(person);
            const self = person.id === user?.id;
            const initials = (person.username || 'U').split(/[\s._-]+/).map(word => word[0]).join('').slice(0,2).toUpperCase();
            return <li key={person.id} className={`team-roster-person ${online ? 'online' : 'offline'}`}>
              <span className="team-roster-avatar" aria-hidden="true">{initials}<i/></span>
              <div className="team-roster-identity"><div><strong>{person.username || 'Unknown user'}</strong>{self && <span className="team-roster-self">You</span>}</div><span>{person.role || 'Member'} · {online ? 'Online' : 'Offline'}</span>{person.email && <span className="team-roster-email" title={person.email}>{person.email}</span>}</div>
            </li>;
          })}
        </ul>}
    </div>
  );
};
export default ParticipantList;
