// src/components/dashboard/PerformanceWidget.tsx
import React from 'react';
import { FaCheckCircle, FaClock, FaExclamationTriangle } from 'react-icons/fa';

interface PerformanceWidgetProps {
  metrics: any;
}

const PerformanceWidget: React.FC<PerformanceWidgetProps> = ({ metrics }) => {
  if (!metrics) {
    return (
      <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
      <div style={{
        padding: '1rem',
        background: 'var(--color-bg-tertiary)',
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
          <FaCheckCircle style={{ marginRight: '0.4rem' }} />
          Completed
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-success)' }}>
          {metrics.completed_on_time || 0}
        </div>
      </div>

      <div style={{
        padding: '1rem',
        background: 'var(--color-bg-tertiary)',
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
          <FaClock style={{ marginRight: '0.4rem' }} />
          In Progress
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>
          {metrics.in_progress || 0}
        </div>
      </div>

      <div style={{
        padding: '1rem',
        background: 'var(--color-bg-tertiary)',
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
          <FaExclamationTriangle style={{ marginRight: '0.4rem' }} />
          Avg Time
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text)' }}>
          {metrics.avg_completion_time_minutes || 0}m
        </div>
      </div>

      <div style={{
        padding: '1rem',
        background: 'var(--color-bg-tertiary)',
        borderRadius: '6px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
          Engagement Score
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-primary)' }}>
          {metrics.team_engagement_score || 0}%
        </div>
      </div>
    </div>
  );
};

export default PerformanceWidget;
