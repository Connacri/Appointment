import { useState, useEffect, useCallback } from 'react';
import { Theme, AppThemeId } from '../types/booking';

export const THEME_STORAGE_KEY = 'omnibook_theme';
export const APP_THEME_STORAGE_KEY = 'omnibook_app_theme';
export const DEFAULT_APP_THEME: AppThemeId = 'classic-slate';

/**
 * Detects whether the user's browser or operating system prefers dark mode.
 */
export function getBrowserPreferredTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Custom hook to manage and automatically synchronize theme state (light/dark mode
 * and custom palette preset) with browser localStorage and document root attributes.
 *
 * Guarantees that selections made from ThemeSelectorModal or Sidebar persist across
 * browser refreshes and sync seamlessly across tabs.
 */
export function useThemeSync() {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem(THEME_STORAGE_KEY) as Theme;
    if (saved === 'light' || saved === 'dark') return saved;
    return getBrowserPreferredTheme();
  });

  const [appTheme, setAppThemeState] = useState<AppThemeId>(() => {
    if (typeof window === 'undefined') return DEFAULT_APP_THEME;
    const saved = localStorage.getItem(APP_THEME_STORAGE_KEY) as AppThemeId;
    return saved || DEFAULT_APP_THEME;
  });

  // Apply and persist dark/light theme mode
  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch (e) {
      console.warn('[useThemeSync] Failed to save theme to localStorage:', e);
    }
  }, []);

  // Apply and persist custom palette theme
  const setAppTheme = useCallback((nextAppTheme: AppThemeId) => {
    setAppThemeState(nextAppTheme);
    try {
      localStorage.setItem(APP_THEME_STORAGE_KEY, nextAppTheme);
    } catch (e) {
      console.warn('[useThemeSync] Failed to save appTheme to localStorage:', e);
    }
  }, []);

  /**
   * Reverts the application theme to the browser's preferred color scheme
   * (light or dark) and resets the palette preset to the default ('classic-slate').
   */
  const resetThemeToDefault = useCallback(() => {
    const preferredMode = getBrowserPreferredTheme();
    setThemeState(preferredMode);
    setAppThemeState(DEFAULT_APP_THEME);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, preferredMode);
      localStorage.setItem(APP_THEME_STORAGE_KEY, DEFAULT_APP_THEME);
    } catch (e) {
      console.warn('[useThemeSync] Failed to reset theme in localStorage:', e);
    }

    if (preferredMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    document.documentElement.setAttribute('data-app-theme', DEFAULT_APP_THEME);

    return { mode: preferredMode, appTheme: DEFAULT_APP_THEME };
  }, []);

  // Synchronize DOM classes and attributes whenever theme or appTheme changes
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-app-theme', appTheme);
  }, [appTheme]);

  // Synchronize across browser tabs and listen for OS preference shifts
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
      }
      if (e.key === APP_THEME_STORAGE_KEY && e.newValue) {
        setAppThemeState(e.newValue as AppThemeId);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return {
    theme,
    setTheme,
    appTheme,
    setAppTheme,
    resetThemeToDefault,
  };
}
