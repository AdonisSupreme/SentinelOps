import React from 'react';
import { FaUser, FaIdBadge, FaCrown, FaStar, FaUserShield } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import './ParticipantList.css';

interface Participant {
  id: string;
  username: string;
  email: string;
  role: string;
  is_online?: boolean;
}

interface ParticipantListProps {
  participants: Participant[];
}

const ParticipantList: React.FC<ParticipantListProps> = ({ participants }) => {
  const { user } = useAuth();

  const isParticipantOnline = (participant: Participant) => (
    participant.is_online || (user?.id && participant.id === user.id)
  );

  const onlineCount = participants.filter((participant) => isParticipantOnline(participant)).length;

  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'supervisor':
      case 'manager':
        return <FaCrown className="role-icon admin" />;
      case 'lead':
      case 'team lead':
        return <FaStar className="role-icon lead" />;
      case 'operator':
      case 'specialist':
        return <FaUserShield className="role-icon specialist" />;
      default:
        return <FaIdBadge className="role-icon member" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'supervisor':
      case 'manager':
        return '#ff7a59';
      case 'lead':
      case 'team lead':
        return '#14b8ff';
      case 'operator':
      case 'specialist':
        return '#22c55e';
      default:
        return '#94a3b8';
    }
  };

  const getInitials = (username: string) => {
    if (!username) return 'U';
    return username
      .split(' ')
      .map((word) => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPresenceLabel = (participant: Participant) => (
    isParticipantOnline(participant) ? 'Online' : 'Offline'
  );

  if (!participants || participants.length === 0) {
    return (
      <div className="participant-list">
        <div className="no-participants">
          <FaUser className="no-participants-icon" />
          <p>No team members yet</p>
          <span className="no-participants-subtitle">Be the first to join this checklist</span>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-list">
      <div className="participants-summary participants-summary--top">
        <div className="summary-item">
          <span className="summary-label">Total members</span>
          <span className="summary-value">{participants.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Online now</span>
          <span className="summary-value online">{onlineCount}</span>
        </div>
      </div>

      <div className="participants-grid">
        {participants.map((participant, index) => {
          const isOnline = isParticipantOnline(participant);
          const isSelf = Boolean(user?.id && participant.id === user.id);
          const accent = getRoleColor(participant.role);

          return (
            <div
              key={participant.id}
              className={`participant-card ${isOnline ? 'is-online' : 'is-offline'} ${isSelf ? 'is-self' : ''}`}
              style={{
                ['--participant-accent' as any]: accent,
                animationDelay: `${index * 0.07}s`
              }}
            >
              <div className="participant-card-glow" aria-hidden="true" />

              <div className="participant-card-main">
                <div className="participant-avatar">
                  <div className="avatar-circle">
                    <span className="avatar-text">{getInitials(participant.username)}</span>
                  </div>
                  <div
                    className={`p-status-indicator ${isOnline ? 'online' : 'offline'}`}
                    aria-label={getPresenceLabel(participant)}
                    title={getPresenceLabel(participant)}
                  />
                </div>

                <div className="participant-info">
                  <div className="participant-header">
                    <div className="participant-title-group">
                      <div className="participant-name-row">
                        <h4 className="participant-name">{participant.username || 'Unknown User'}</h4>
                        {isSelf && <span className="participant-self-badge">You</span>}
                      </div>
                      <p className="participant-subtitle">
                        {isOnline ? 'Active on shift coverage' : 'Currently away from the shift console'}
                      </p>
                    </div>

                    <span className={`participant-presence-pill ${isOnline ? 'online' : 'offline'}`}>
                      {getPresenceLabel(participant)}
                    </span>
                  </div>

                  <div className="participant-meta-row">
                    <div className="participant-role-badge">
                      {getRoleIcon(participant.role)}
                      <span>{participant.role || 'Member'}</span>
                    </div>

                    {participant.email && (
                      <div className="participant-meta-chip participant-meta-chip--wide">
                        <span>{participant.email}</span>
                      </div>
                    )}

                    <div className="participant-meta-chip">
                      <span>Node {participant.id.slice(-6).toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ParticipantList;
