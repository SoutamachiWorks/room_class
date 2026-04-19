'use client';

import { useTheme } from '@/lib/theme';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) return <div className={styles.placeholder} />;

  const isDark = theme === 'dark';

  return (
    <button
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={isDark ? 'Aktifkan Light Mode' : 'Aktifkan Dark Mode'}
      title={isDark ? 'Light Mode' : 'Dark Mode'}
    >
      <div className={`${styles.track} ${isDark ? styles.trackDark : ''}`}>
        <div className={`${styles.thumb} ${isDark ? styles.thumbDark : ''}`}>
          {isDark ? (
            /* Moon icon */
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          ) : (
            /* Sun icon */
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          )}
        </div>
      </div>
    </button>
  );
}
