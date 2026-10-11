import React, { useState } from 'react';

// Content language (TR/EN) for quiz and Debug Arena text. Same storage key as the quiz page, so a student
// who picks Türkçe once keeps it everywhere. Only the text changes: answers are always sent in English.
export const CONTENT_LANG_KEY = 'steamhub:quiz-lang';

const initialLang = () => {
  try {
    const stored = window.localStorage.getItem(CONTENT_LANG_KEY);
    if (stored === 'en' || stored === 'tr') return stored;
  } catch (e) { /* storage blocked: fall back to the browser language */ }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

export const useContentLang = () => {
  const [lang, setLangState] = useState(initialLang);
  const setLang = (value) => {
    setLangState(value);
    try { window.localStorage.setItem(CONTENT_LANG_KEY, value); } catch (e) { /* not critical */ }
  };
  return [lang, setLang];
};

export const LangToggle = ({ lang, setLang, testIdPrefix = 'lang' }) => (
  <div className="flex shrink-0 rounded-md border border-gray-300 text-xs" role="group" aria-label="Language / Dil">
    {['tr', 'en'].map((code) => (
      <button
        key={code}
        type="button"
        onClick={() => setLang(code)}
        aria-pressed={lang === code}
        className={`px-2 py-1 font-semibold ${lang === code ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
        data-testid={`${testIdPrefix}-${code}`}
      >
        {code.toUpperCase()}
      </button>
    ))}
  </div>
);
