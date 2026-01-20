// src/components/performance/StreakTracker.tsx
import React from 'react';
import { FaFire, FaCalendarAlt } from 'react-icons/fa';

interface Score {
  awarded_at: string;
  points: number;
}

interface StreakTrackerProps {
  scores: Score[];
}

const StreakTracker: React.FC<StreakTrackerProps> = ({ scores }) => {
  if (!scores || scores.length === 0) {
    return (
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        textAlign: 'center',
        color: 'var(--color-text-secondary)'
      }}>
        No streak data available
      </div>
    );
  }

  // Group scores by date and calculate streaks
  const scoresByDate: Record<string, number> = {};
  scores.forEach(score => {
    const date = new Date(score.awarded_at).toISOString().split('T')[0];
    scoresByDate[date] = (scoresByDate[date] || 0) + score.points;
  });

  const sortedDates = Object.keys(scoresByDate).sort().reverse().slice(0, 7);

  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '1.5rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FaFire style={{ color: '#ff4757' }} /> Recent Activity
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {sortedDates.map((date, index) => {
          const points = scoresByDate[date];
          const dateObj = new Date(date);
          const today = new Date();
          const isToday = dateObj.toDateString() === today.toDateString();

          return (
            <div
              key={date}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: isToday ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                color: isToday ? 'white' : 'var(--color-text)',
                borderRadius: '6px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FaCalendarAlt />
                <span style={{ fontSize: '0.9rem' }}>
                  {dateObj.toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  })}
                  {isToday && ' (Today)'}
                </span>
              </div>
              <div style={{ fontWeight: '600', fontSize: '1rem' }}>
                +{points} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StreakTracker;
