// src/components/checklist/ParticipantList.tsx
import React from 'react';
import { FaUser, FaIdBadge, FaShieldAlt, FaCrown, FaStar, FaUserShield } from 'react-icons/fa';
import './ParticipantList.css';

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
  const getRoleIcon = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
      case 'supervisor':
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
        return '#ff6b6b';
      case 'lead':
      case 'team lead':
        return '#00d9ff';
      case 'operator':
      case 'specialist':
        return '#00ff9d';
      default:
        return '#8892b0';
    }
  };

  const getInitials = (username: string) => {
    if (!username) return 'U';
    return username
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

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
      <div className="participants-grid">
        {participants.map((participant, index) => (
          <div 
            key={participant.id} 
            className="participant-card"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="participant-avatar">
              <div className="avatar-circle" style={{ borderColor: getRoleColor(participant.role) }}>
                <span className="avatar-text">{getInitials(participant.username)}</span>
              </div>
              <div className="p-status-indicator online"></div>
            </div>
            
            <div className="participant-info">
              <div className="participant-header">
                <h4 className="participant-name">{participant.username || 'Unknown User'}</h4>
                <div className="participant-role-badge" style={{ backgroundColor: `${getRoleColor(participant.role)}20`, color: getRoleColor(participant.role) }}>
                  {getRoleIcon(participant.role)}
                  <span>{participant.role || 'Member'}</span>
                </div>
              </div>
              
              <div className="participant-details">
                <div className="participant-email">
                  <span className="email-label">Email:</span>
                  <span className="email-value">{participant.email || 'No email'}</span>
                </div>
                <div className="participant-id">
                  <span className="id-label">ID:</span>
                  <span className="id-value">{participant.id.slice(-8)}</span>
                </div>
              </div>
            </div>

            <div className="participant-actions">
              <button className="action-button primary" title="View Profile">
                <FaUser />
              </button>
              <button className="action-button secondary" title="Send Message">
                <FaShieldAlt />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="participants-summary">
        <div className="summary-item">
          <span className="summary-label">Total Members</span>
          <span className="summary-value">{participants.length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Online Now</span>
          <span className="summary-value online">{participants.length}</span>
        </div>
      </div>
    </div>
  );
};

export default ParticipantList;
