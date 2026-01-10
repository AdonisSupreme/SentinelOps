// src/components/ui/ThemeToggle.tsx
import React from 'react';
import { FaSun, FaMoon, FaAdjust } from 'react-icons/fa';
import { useTheme } from '../../contexts/ThemeContext';
import '../../styles/ThemeToggle.css';

type ThemeType = 'light' | 'system' | 'dark';

const themeOrder: ThemeType[] = ['light', 'system', 'dark'];

const themeMeta: Record<
  ThemeType,
  { icon: React.ReactNode; label: string }
> = {
  light: { icon: <FaSun />, label: 'Light' },
  system: { icon: <FaAdjust />, label: 'System' },
  dark: { icon: <FaMoon />, label: 'Dark' },
};

const ThemeToggle: React.FC = () => {
  const { theme, setTheme } = useTheme();

  const handleToggle = () => {
    const currentIndex = themeOrder.indexOf(theme as ThemeType);
    const nextTheme = themeOrder[(currentIndex + 1) % themeOrder.length];
    setTheme(nextTheme);
  };

  const { icon, label } = themeMeta[theme as ThemeType];

  return (
    <button
      className={`theme-toggle-single theme-${theme}`}
      onClick={handleToggle}
      aria-label={`Theme: ${label}`}
      title={`Theme: ${label}`}
    >
      <span className="theme-icon">{icon}</span>
      <span className="theme-label">{label}</span>
    </button>
  );
};

export default ThemeToggle;
