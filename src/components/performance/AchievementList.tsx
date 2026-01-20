// src/components/performance/AchievementList.tsx
import React from 'react';
import { FaStar, FaCheckCircle, FaMedal, FaFire } from 'react-icons/fa';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

const AchievementList: React.FC = () => {
  const achievements: Achievement[] = [
    {
      id: '1',
      name: 'Quick Starter',
      description: 'Complete your first checklist',
      icon: 'star',
      unlocked: true
    },
    {
      id: '2',
      name: 'Week Warrior',
      description: 'Complete 7 checklists in a week',
      icon: 'fire',
      unlocked: true
    },
    {
      id: '3',
      name: 'Perfect Score',
      description: 'Complete 5 checklists without any exceptions',
      icon: 'medal',
      unlocked: false
    },
    {
      id: '4',
      name: 'Team Player',
      description: 'Join 10 collaborative checklists',
      icon: 'checkmark',
      unlocked: false
    },
    {
      id: '5',
      name: 'Night Owl',
      description: 'Complete 5 night shift checklists',
      icon: 'star',
      unlocked: true
    }
  ];

  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case 'star':
        return <FaStar />;
      case 'fire':
        return <FaFire />;
      case 'medal':
        return <FaMedal />;
      case 'checkmark':
        return <FaCheckCircle />;
      default:
        return <FaStar />;
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <div style={{
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: '8px',
      padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, color: 'var(--color-text)' }}>Achievements</h3>
        <span style={{
          background: 'var(--color-primary)',
          color: 'white',
          padding: '0.2rem 0.6rem',
          borderRadius: '12px',
          fontSize: '0.75rem',
          fontWeight: '600'
        }}>
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            style={{
              padding: '1rem',
              background: achievement.unlocked ? 'var(--color-bg-tertiary)' : 'rgba(0,0,0,0.1)',
              border: achievement.unlocked ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
              borderRadius: '6px',
              opacity: achievement.unlocked ? 1 : 0.5,
              transition: 'all 0.2s',
              cursor: 'pointer'
            }}
          >
            <div style={{
              fontSize: '1.5rem',
              marginBottom: '0.5rem',
              color: achievement.unlocked ? 'var(--color-primary)' : 'var(--color-text-secondary)'
            }}>
              {getAchievementIcon(achievement.icon)}
            </div>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--color-text)' }}>
              {achievement.name}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: 'var(--color-text-secondary)',
              marginTop: '0.25rem'
            }}>
              {achievement.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AchievementList;
