// src/components/performance/Leaderboard.tsx
import React from 'react';
import { FaTrophy, FaMedal, FaFire } from 'react-icons/fa';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  total_points: number;
  current_streak: number;
  perfect_shifts: number;
  rank: number;
}

interface LeaderboardProps {
  data: LeaderboardEntry[];
  user: any;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ data, user }) => {
  if (!data || data.length === 0) {
    return (
      <div style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '1.5rem',
        textAlign: 'center',
        color: 'var(--color-text-secondary)'
      }}>
        No leaderboard data available
      </div>
    );
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <FaTrophy style={{ color: '#FFD700' }} />;
    if (rank === 2) return <FaMedal style={{ color: '#C0C0C0' }} />;
    if (rank === 3) return <FaMedal style={{ color: '#CD7F32' }} />;
    return null;
  };

  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '1.5rem'
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <FaTrophy /> Leaderboard
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.slice(0, 10).map((entry) => {
          const isCurrentUser = user?.id === entry.user_id;

          return (
            <div
              key={entry.user_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem',
                background: isCurrentUser ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                color: isCurrentUser ? 'white' : 'var(--color-text)',
                borderRadius: '6px',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
            >
              <div style={{ fontSize: '1.1rem', minWidth: '24px', textAlign: 'center' }}>
                {getRankIcon(entry.rank) || entry.rank}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '500', fontSize: '0.95rem' }}>
                  {entry.username}
                  {isCurrentUser && ' (You)'}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  opacity: isCurrentUser ? 0.9 : 0.7,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  marginTop: '0.25rem'
                }}>
                  <FaFire /> {entry.current_streak} day streak
                </div>
              </div>

              <div style={{
                fontWeight: '600',
                fontSize: '1.1rem',
                minWidth: '50px',
                textAlign: 'right'
              }}>
                {entry.total_points}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Leaderboard;
