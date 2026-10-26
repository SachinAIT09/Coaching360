import { useCallback, useEffect, useState } from 'react';

// Theme preference: 'light' | 'dark' | 'system'. Dark is the brand default; 'system' follows the OS.
// Kept in sync with the inline script in index.html, which applies it before first paint.
export const THEME_KEY = 'coaching360-theme';
export const DEFAULT_THEME = 'dark';
const QUERY = '(prefers-color-scheme: dark)';

export function readPreference() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export const resolveTheme = (pref) => (pref === 'system' ? (window.matchMedia(QUERY).matches ? 'dark' : 'light') : pref);

export function applyTheme(pref) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function useTheme() {
  const [preference, setPref] = useState(readPreference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'system') return undefined;
    const mq = window.matchMedia(QUERY);
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((pref) => {
    try {
      if (pref === DEFAULT_THEME) localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, pref);
    } catch { /* storage unavailable: still applies for this session */ }
    setPref(pref);
  }, []);

  return { preference, theme: resolveTheme(preference), setPreference };
}
