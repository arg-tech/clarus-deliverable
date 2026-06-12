import { useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { getStoredTheme, setTheme } from '../theme';
import type { Theme } from '../theme';
import './ThemeToggle.css';

export const ThemeToggle = () => {
  const [currentTheme, setCurrentTheme] = useState<Theme>(getStoredTheme);

  const toggle = () => {
    const next = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setCurrentTheme(next);
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {currentTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
};
