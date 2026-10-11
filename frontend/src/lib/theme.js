import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Appearance settings: age theme, accent colour, light/dark, text size, motion.
// - The colours themselves are CSS variables (tailwind.config.js); this file only
//   sets attributes on <html>: data-age, data-accent, data-text, class dark / calm-motion.
// - public/index.html applies the saved settings before React mounts so the first
//   paint is already right. Keep the two in sync (STORAGE_KEY, defaults, attribute names).
// - Settings are kept in localStorage per browser. "auto" age follows the signed-in
//   student's age group, so a shared lab computer still looks right for each class.

export const THEME_STORAGE_KEY = 'steamhub:theme';

export const AGE_THEMES = {
  explorer: {
    label: 'Middle school',
    short: 'Ages 11-14',
    description: 'Rounder shapes, friendly type, a bit larger text.',
    accent: 'violet',
    font: 'Nunito:wght@400;600;700;800',
  },
  lab: {
    label: 'High school',
    short: 'Ages 14-18',
    description: 'Clean and focused, with a lab-notebook feel.',
    accent: 'emerald',
    font: 'Space+Grotesk:wght@500;600;700',
  },
  pro: {
    label: 'University+',
    short: '18 and up',
    description: 'Compact and quiet. More on screen, less decoration.',
    accent: 'indigo',
    font: null,
  },
};

// Swatch colours for the picker (Tailwind 500/600 shades). The real palettes are in tailwind.config.js.
export const ACCENTS = {
  emerald: { label: 'Green', swatch: '#10b981' },
  teal: { label: 'Teal', swatch: '#14b8a6' },
  sky: { label: 'Sky', swatch: '#0ea5e9' },
  indigo: { label: 'Indigo', swatch: '#6366f1' },
  violet: { label: 'Violet', swatch: '#8b5cf6' },
  rose: { label: 'Rose', swatch: '#f43f5e' },
  orange: { label: 'Orange', swatch: '#f97316' },
};

export const DEFAULT_SETTINGS = {
  age: 'auto', // 'auto' | keyof AGE_THEMES
  accent: 'auto', // 'auto' | keyof ACCENTS
  mode: 'light', // 'light' | 'dark' | 'system'
  text: 'md', // 'md' | 'lg'
  motion: 'full', // 'full' | 'calm'
};

// The account's age group decides the theme while the user hasn't picked one.
export const ageThemeForUser = (user) => {
  if (!user) return 'lab';
  if (user.role === 'teacher') return 'lab';
  if (user.age_group === '13-15') return 'explorer';
  if (user.age_group === '18+') return 'pro';
  return 'lab';
};

const sanitize = (value) => {
  const s = { ...DEFAULT_SETTINGS, ...(value && typeof value === 'object' ? value : {}) };
  if (s.age !== 'auto' && !AGE_THEMES[s.age]) s.age = 'auto';
  if (s.accent !== 'auto' && !ACCENTS[s.accent]) s.accent = 'auto';
  if (!['light', 'dark', 'system'].includes(s.mode)) s.mode = 'light';
  if (!['md', 'lg'].includes(s.text)) s.text = 'md';
  if (!['full', 'calm'].includes(s.motion)) s.motion = 'full';
  return s;
};

const readStored = () => {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
};

const prefersDark = () => {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch (e) {
    return false;
  }
};

const loadFont = (spec) => {
  if (!spec || typeof document === 'undefined') return;
  if (document.documentElement.classList.contains('lite')) return; // Lite mode: no web fonts
  const id = `font-${spec.split(':')[0]}`;
  if (document.getElementById(id)) return;
  try {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
    document.head.appendChild(link);
  } catch (e) {
    // Fonts are cosmetic; the system stack is the fallback.
  }
};

const ThemeContext = createContext({
  settings: DEFAULT_SETTINGS,
  resolved: { age: 'lab', accent: 'emerald', dark: false },
  update: () => {},
  reset: () => {},
});

export const ThemeProvider = ({ user, children }) => {
  const stored = useMemo(readStored, []);
  const [settings, setSettings] = useState(() => sanitize(stored));
  const [systemDark, setSystemDark] = useState(prefersDark);

  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
    } catch (e) {
      return undefined;
    }
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const age = settings.age === 'auto' ? ageThemeForUser(user) : settings.age;
  const accent = settings.accent === 'auto' ? AGE_THEMES[age].accent : settings.accent;
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && systemDark);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.age = age;
    root.dataset.accent = accent;
    root.dataset.text = settings.text;
    root.classList.toggle('dark', dark);
    root.classList.toggle('calm-motion', settings.motion === 'calm');
    loadFont(AGE_THEMES[age].font);
    try {
      // resolvedAge/resolvedAccent let index.html paint the right theme before the user is known.
      window.localStorage.setItem(
        THEME_STORAGE_KEY,
        JSON.stringify({ ...settings, resolvedAge: age, resolvedAccent: accent })
      );
    } catch (e) {
      // Storage blocked: settings still apply for this visit.
    }
  }, [age, accent, dark, settings]);

  const update = useCallback((patch) => {
    const root = document.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 350);
    setSettings((prev) => sanitize({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => update(DEFAULT_SETTINGS), [update]);

  const value = useMemo(
    () => ({ settings, resolved: { age, accent, dark }, update, reset }),
    [settings, age, accent, dark, update, reset]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);
