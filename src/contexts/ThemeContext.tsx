import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ThemeContextType = { theme: Theme; setTheme: (theme: Theme) => void; resolvedTheme: 'light' | 'dark' };
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const systemTheme = () => window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
const storedTheme = (): Theme => {
  try {
    const value = localStorage.getItem('theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  } catch { return 'system'; }
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [system, setSystem] = useState<'light' | 'dark'>(systemTheme);
  const resolvedTheme = theme === 'system' ? system : theme;
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme);
    document.documentElement.style.colorScheme = resolvedTheme;
    try { localStorage.setItem('theme', theme); } catch { /* Storage may be disabled. */ }
  }, [theme, resolvedTheme]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystem(media.matches ? 'dark' : 'light');
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
};
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

