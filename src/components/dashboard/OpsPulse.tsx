import React from 'react';
import { FaClipboardCheck, FaUserShield, FaExclamationTriangle, FaRobot } from 'react-icons/fa';
import '../../styles/OpsPulse.css';

const OpsPulse: React.FC = () => {
  const metrics = [
    {
      icon: <FaClipboardCheck />,
      label: 'Checklists Completed Today',
      value: 18,
      trend: '+3',
      tone: 'good'
    },
    {
      icon: <FaUserShield />,
      label: 'Pending Approvals',
      value: 4,
      trend: '-1',
      tone: 'warning'
    },
    {
      icon: <FaExclamationTriangle />,
      label: 'Operational Risks',
      value: 2,
      trend: '+1',
      tone: 'critical'
    },
    {
      icon: <FaRobot />,
      label: 'AI Observations',
      value: 6,
      trend: '+2',
      tone: 'info'
    }
  ];

  return (
    <div className="ops-pulse-grid">
      {metrics.map((m, idx) => (
        <div key={idx} className={`pulse-card ${m.tone}`}>
          <div className="pulse-icon">{m.icon}</div>
          <div className="pulse-body">
            <h3>{m.value}</h3>
            <p>{m.label}</p>
          </div>
          <span className="pulse-trend">{m.trend}</span>
        </div>
      ))}
    </div>
  );
};

export default OpsPulse;
