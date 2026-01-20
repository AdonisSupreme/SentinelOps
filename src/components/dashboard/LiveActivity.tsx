// src/components/dashboard/LiveActivity.tsx
import React from 'react';
import { FaCheckCircle, FaClock, FaUser, FaCalendarAlt } from 'react-icons/fa';

interface Activity {
  id: string;
  user: string;
  action: string;
  timestamp: string;
}

interface LiveActivityProps {
  activities: Activity[];
}

const LiveActivity: React.FC<LiveActivityProps> = ({ activities }) => {
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSeconds < 60) return 'just now';
      if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
      if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
      return date.toLocaleDateString();
    } catch {
      return timestamp;
    }
  };

  const getActionIcon = (action: string) => {
    if (action.includes('completed')) return <FaCheckCircle style={{ color: '#2ed573' }} />;
    if (action.includes('started')) return <FaClock style={{ color: '#00d9ff' }} />;
    return <FaUser style={{ color: '#6b7280' }} />;
  };

  return (
    <div>
      {activities && activities.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activities.slice(0, 5).map((activity) => (
            <div
              key={activity.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: 'var(--color-bg-tertiary)',
                borderRadius: '6px',
                borderLeft: '3px solid var(--color-primary)'
              }}
            >
              <div style={{ fontSize: '1.2rem' }}>
                {getActionIcon(activity.action)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--color-text)' }}>
                  {activity.user} {activity.action}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
                  <FaCalendarAlt /> {formatTime(activity.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
          No recent activity
        </div>
      )}
    </div>
  );
};

export default LiveActivity;
