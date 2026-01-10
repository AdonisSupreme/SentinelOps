import React from 'react';
import '../../styles/ActivityTimeline.css';

const ActivityTimeline: React.FC = () => {
  const events = [
    { action: 'Checklist Approved', actor: 'Supervisor', time: '09:14' },
    { action: 'Checklist Submitted', actor: 'SysAdmin', time: '08:55' },
    { action: 'AI Flagged Risk Pattern', actor: 'SentinelAI', time: 'Yesterday' }
  ];

  return (
    <div className="activity-timeline">
      <h2>Recent Activity</h2>
      <ul>
        {events.map((e, i) => (
          <li key={i}>
            <span className="dot" />
            <div>
              <strong>{e.action}</strong>
              <p>{e.actor}</p>
            </div>
            <span className="time">{e.time}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ActivityTimeline;
