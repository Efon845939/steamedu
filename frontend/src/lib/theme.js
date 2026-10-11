import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLiteMode } from '../hooks/use-lite-mode';

// Display settings.
// - The theme (html[data-age]) is fixed by the account: 13-15, 16-18 or 18+ for
//   students, teacher for teachers, 16-18 when logged out. Nobody picks it.
// - People can change only what doesn't break the theme: appearance (light, dark,
//   system), text size, motion and density. Lite mode lives in hooks/use-lite-mode.
// - public/index.html applies the same settings before React mounts, so the first
//   paint is right. Keep the two in sync: storage keys, defaults, attribute names,
//   FONT_FAMILIES.

export const AGE_STORAGE_KEY = 'steamhub:age';
export const DISPLAY_STORAGE_KEY = 'steamhub:display';

export const THEME_IDS = ['13-15', '16-18', '18+', 'teacher'];

const ARCHIVO = 'family=Archivo:wdth,wght@75..125,500..800';
const ATKINSON = 'family=Atkinson+Hyperlegible+Next:wght@400;500;600';

export const THEMES = {
  '13-15': { name: 'Field notebook', fonts: `${ARCHIVO}&${ATKINSON}`, density: 'comfortable' },
  '16-18': { name: 'Engineering pad', fonts: `${ARCHIVO}&${ATKINSON}`, density: 'comfortable' },
  '18+': { name: 'Journal and slate', fonts: `${ATKINSON}&family=Source+Serif+4:opsz,wght@8..60,600`, density: 'compact' },
  teacher: { name: 'Ledger', fonts: `${ARCHIVO}&family=IBM+Plex+Sans:wght@400;500;600`, density: 'compact' },
};

export const DEFAULT_DISPLAY = {
  mode: 'system', // 'system' | 'light' | 'dark'
  text: 'm', // 's' | 'm' | 'l'
  motion: 'system', // 'system' | 'full' | 'reduced' | 'off'
  density: 'auto', // 'auto' | 'comfortable' | 'compact'
};

export const themeForUser = (user) => {
  if (!user) return '16-18';
  if (user.role === 'teacher') return 'teacher';
  return THEME_IDS.includes(user.age_group) ? user.age_group : '16-18';
};

const sanitize = (value) => {
  const s = { ...DEFAULT_DISPLAY, ...(value && typeof value === 'object' ? value : {}) };
  if (!['system', 'light', 'dark'].includes(s.mode)) s.mode = DEFAULT_DISPLAY.mode;
  if (!['s', 'm', 'l'].includes(s.text)) s.text = DEFAULT_DISPLAY.text;
  if (!['system', 'full', 'reduced', 'off'].includes(s.motion)) s.motion = DEFAULT_DISPLAY.motion;
  if (!['auto', 'comfortable', 'compact'].includes(s.density)) s.density = DEFAULT_DISPLAY.density;
  return { mode: s.mode, text: s.text, motion: s.motion, density: s.density };
};

const readStored = () => {
  try {
    return JSON.parse(window.localStorage.getItem(DISPLAY_STORAGE_KEY) || '{}');
  } catch (e) {
    return {};
  }
};

const writeStored = (key, value) => {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    // Storage blocked: the settings still apply for this visit.
  }
};

const useMedia = (query) => {
  const get = () => {
    try {
      return window.matchMedia(query).matches;
    } catch (e) {
      return false;
    }
  };
  const [value, setValue] = useState(get);
  useEffect(() => {
    let mq;
    try {
      mq = window.matchMedia(query);
    } catch (e) {
      return undefined;
    }
    const onChange = (e) => setValue(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [query]);
  return value;
};

const FONT_ORIGIN = 'https://fonts.gstatic.com';

// One stylesheet per theme. Callers skip it in lite mode: the system font stack is the fallback.
// (Lite is passed in rather than read from <html class="lite">, because the lite provider's
// effect runs after this one when lite is switched off.)
export const ensureThemeFonts = (themeId) => {
  if (typeof document === 'undefined') return;
  const id = `font-${themeId}`;
  if (document.getElementById(id)) return;
  try {
    if (!document.querySelector(`link[rel="preconnect"][href="${FONT_ORIGIN}"]`)) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = FONT_ORIGIN;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${THEMES[themeId].fonts}&display=swap`;
    document.head.appendChild(link);
  } catch (e) {
    // Fonts are cosmetic.
  }
};

const DisplayContext = createContext({
  theme: '16-18',
  settings: DEFAULT_DISPLAY,
  resolved: { dark: false, motion: 'full', density: 'comfortable', text: 'm' },
  update: () => {},
  reset: () => {},
});

export const DisplayProvider = ({ user, children }) => {
  const { lite } = useLiteMode();
  const [settings, setSettings] = useState(() => sanitize(readStored()));
  const systemDark = useMedia('(prefers-color-scheme: dark)');
  const systemReduce = useMedia('(prefers-reduced-motion: reduce)');

  const theme = themeForUser(user);
  const dark = settings.mode === 'dark' || (settings.mode === 'system' && systemDark);
  let motion = settings.motion === 'system' ? (systemReduce ? 'reduced' : 'full') : settings.motion;
  if (lite) motion = 'off';
  const density = settings.density === 'auto' ? THEMES[theme].density : settings.density;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.age = theme;
    root.dataset.mode = dark ? 'dark' : 'light';
    root.dataset.text = settings.text;
    root.dataset.motion = motion;
    root.dataset.density = density;
    root.classList.toggle('dark', dark);
    if (!lite) ensureThemeFonts(theme);
    writeStored(AGE_STORAGE_KEY, theme);
    // Browser chrome (mobile address bar) matches the page.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
      if (bg) meta.setAttribute('content', `rgb(${bg.split(/\s+/).join(',')})`);
    }
  }, [theme, dark, settings.text, motion, density, lite]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== DISPLAY_STORAGE_KEY) return;
      try {
        setSettings(sanitize(JSON.parse(event.newValue || '{}')));
      } catch (e) {
        // ignore malformed values
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = sanitize({ ...prev, ...patch });
      writeStored(DISPLAY_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => update(DEFAULT_DISPLAY), [update]);

  const value = useMemo(
    () => ({ theme, settings, resolved: { dark, motion, density, text: settings.text, systemReduce }, update, reset }),
    [theme, settings, dark, motion, density, systemReduce, update, reset]
  );

  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
};

export const useDisplay = () => useContext(DisplayContext);

// The account's theme id: '13-15' | '16-18' | '18+' | 'teacher'. Use it for the few
// layout choices that change with age (where points live, line numbers, labels).
export const useAgeTheme = () => useContext(DisplayContext).theme;
