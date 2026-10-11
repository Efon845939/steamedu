import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

// Lite (low-bandwidth) mode.
// - public/index.html sets <html class="lite"> before React mounts and only loads the
//   theme's web fonts when lite is off, so the first paint already matches the setting.
// - This provider keeps that class in sync and remembers an explicit choice in
//   localStorage ('1' / '0'). lib/theme.js loads the fonts when lite is switched off
//   and turns motion off while lite is on.
// - Components read { lite } to skip network-heavy things (e.g. photos) entirely:
//   hiding an <img> with CSS still downloads it.

export const LITE_STORAGE_KEY = 'steamhub:lite';
const LITE_CLASS = 'lite';

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

const LiteModeContext = createContext({ lite: false, setLite: () => {}, toggleLite: () => {} });

export const LiteModeProvider = ({ children }) => {
  const [lite, setLiteState] = useState(getInitialLite);
  // Only an explicit choice is persisted, so an auto-detected slow connection
  // is re-checked on the next visit instead of being remembered forever.
  const userChoseRef = useRef(false);

  useEffect(() => {
    document.documentElement.classList.toggle(LITE_CLASS, lite);
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
