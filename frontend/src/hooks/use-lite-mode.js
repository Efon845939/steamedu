import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Lite (low-bandwidth) mode.
// - public/index.html sets <html class="lite"> before React mounts and only loads the
//   Inter web font when lite is off, so the first paint already matches the setting.
// - This provider keeps that class in sync, remembers an explicit choice in
//   localStorage ('1' / '0') and loads the web font on demand when lite is switched off.
// - Components read { lite } to skip network-heavy things (e.g. photos) entirely:
//   hiding an <img> with CSS still downloads it.

export const LITE_STORAGE_KEY = 'steamhub:lite';
const LITE_CLASS = 'lite';
const FONT_LINK_ID = 'inter-font';
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
const FONT_ORIGIN = 'https://fonts.gstatic.com';

const isSlowConnection = () => {
  try {
    const connection = typeof navigator !== 'undefined' ? navigator.connection : undefined;
    return Boolean(connection && (connection.saveData || /(^|-)2g$/.test(connection.effectiveType || '')));
  } catch (e) {
    return false;
  }
};

const readStoredChoice = () => {
  try {
    const stored = window.localStorage.getItem(LITE_STORAGE_KEY);
    if (stored === '1') return true;
    if (stored === '0') return false;
  } catch (e) {
    // Storage blocked (private mode, disabled cookies): fall through to the connection check.
  }
  return null;
};

const getInitialLite = () => {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains(LITE_CLASS)) return true;
  const stored = readStoredChoice();
  if (stored !== null) return stored;
  return isSlowConnection();
};

const ensureInterFont = () => {
  if (typeof document === 'undefined' || document.getElementById(FONT_LINK_ID)) return;
  try {
    if (!document.querySelector(`link[rel="preconnect"][href="${FONT_ORIGIN}"]`)) {
      const preconnect = document.createElement('link');
      preconnect.rel = 'preconnect';
      preconnect.href = FONT_ORIGIN;
      preconnect.crossOrigin = 'anonymous';
      document.head.appendChild(preconnect);
    }
    const font = document.createElement('link');
    font.id = FONT_LINK_ID;
    font.rel = 'stylesheet';
    font.href = FONT_HREF;
    document.head.appendChild(font);
  } catch (e) {
    // Font is cosmetic; the system font stack is the fallback.
  }
};

const LiteModeContext = createContext({ lite: false, setLite: () => {}, toggleLite: () => {} });

export const LiteModeProvider = ({ children }) => {
  const [lite, setLiteState] = useState(getInitialLite);
  // Only an explicit choice is persisted, so an auto-detected slow connection
  // is re-checked on the next visit instead of being remembered forever.
  const userChoseRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle(LITE_CLASS, lite);
    if (!lite) ensureInterFont();
    if (!userChoseRef.current) return;
    try {
      window.localStorage.setItem(LITE_STORAGE_KEY, lite ? '1' : '0');
    } catch (e) {
      // Storage blocked: the setting still applies for this page view.
    }
  }, [lite]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== LITE_STORAGE_KEY) return;
      if (event.newValue === '1') setLiteState(true);
      else if (event.newValue === '0') setLiteState(false);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setLite = useCallback((next) => {
    userChoseRef.current = true;
    setLiteState((prev) => Boolean(typeof next === 'function' ? next(prev) : next));
  }, []);

  const toggleLite = useCallback(() => setLite((prev) => !prev), [setLite]);

  const value = useMemo(() => ({ lite, setLite, toggleLite }), [lite, setLite, toggleLite]);

  return <LiteModeContext.Provider value={value}>{children}</LiteModeContext.Provider>;
};

export const useLiteMode = () => useContext(LiteModeContext);
