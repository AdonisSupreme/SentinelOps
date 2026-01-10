import React from 'react';
import '../../styles/RiskPanel.css';

const RiskPanel: React.FC = () => {
  const risks = [
    { title: 'Night Shift Checklist Missed', severity: 'High', time: '2h ago' },
    { title: 'Repeated Approval Delays', severity: 'Medium', time: 'Today' },
    { title: 'Outdated SOP Version Detected', severity: 'Low', time: 'Yesterday' }
  ];

  return (
    <div className="risk-panel">
      <h2>Operational Risks</h2>
      <ul>
        {risks.map((risk, i) => (
          <li key={i} className={`risk-item ${risk.severity.toLowerCase()}`}>
            <div>
              <strong>{risk.title}</strong>
              <span>{risk.time}</span>
            </div>
            <span className="severity">{risk.severity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RiskPanel;
