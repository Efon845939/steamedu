import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { createPortal, flushSync } from 'react-dom';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import axios from 'axios';
import { toast } from 'sonner';
import { SUBJECTS, subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, FileText, Info, Loader2, Printer, RefreshCw, Target, UserRound, WifiOff,
} from 'lucide-react';

const MAX_ITEMS = 10;

const INSTRUCTIONS = 'For each problem: circle the FIRST step where the reasoning goes wrong, '
  + 'tick the explanation that fits, then explain the correct reasoning in your own words.';

const formatDate = (value) => new Date(value).toLocaleDateString('en-GB', {
  day: 'numeric', month: 'long', year: 'numeric',
});

const PAGE_CLASS = 'min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8';
const INNER_CLASS = 'max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8';

// The worksheet itself. Rendered as the on-screen preview and, while printing, into a
// body-level portal (.print-sheet) that only shows up on paper.
// part: 'student' | 'key' | 'both'
const WorksheetDocument = ({ sheet, title, classLabel, part, idPrefix }) => {
  const showStudent = part !== 'key';
  const showKey = part !== 'student';
  const itemsByNumber = useMemo(() => {
    const map = {};
    sheet.items.forEach((item) => { map[item.number] = item; });
    return map;
  }, [sheet.items]);
  const generated = sheet.generated_at ? formatDate(sheet.generated_at) : '';

  return (
    <div className="ws-doc" data-testid={`${idPrefix}-document`}>
      {showStudent && (
        <section className="ws-student" aria-label="Student sheet" data-testid={`${idPrefix}-student-sheet`}>
          <header className="ws-header">
            <h3 className="ws-title">{title}</h3>
            {(classLabel || sheet.teacher_name) && (
              <p className="ws-meta">
                {classLabel && <span>Class: {classLabel}</span>}
                {sheet.teacher_name && <span>Teacher: {sheet.teacher_name}</span>}
              </p>
            )}
            <div className="ws-fields">
              <span className="ws-field">Name: <span className="ws-blank" /></span>
              <span className="ws-field">Date: <span className="ws-blank ws-blank-short" /></span>
            </div>
          </header>

          <p className="ws-instructions">{INSTRUCTIONS}</p>

          {sheet.items.map((item) => (
            <article key={item.id} className="ws-item" data-testid={`${idPrefix}-item-${item.number}`}>
              <h4 className="ws-item-title">
                {item.number}. {item.title}{' '}
                <span className="ws-item-meta">
                  ({item.subject}{item.source === 'peer' && item.author_name ? ` · by ${item.author_name}` : ''})
                </span>
              </h4>
              <p className={`ws-problem${item.subject === 'Technology' ? ' ws-mono' : ''}`}>{item.problem}</p>

              <p className="ws-label">Worked solution — circle the first wrong step</p>
              <ol className="ws-steps">
                {item.steps.map((step, i) => (
                  <li key={i}>
                    <span className="ws-mark" aria-hidden="true">○</span>
                    <span className="ws-num">{i + 1}.</span>
                    <span className="ws-text">{step}</span>
                  </li>
                ))}
              </ol>

              <p className="ws-label">Which explanation fits? Tick one</p>
              <ul className="ws-options">
                {item.explanations.map((opt) => (
                  <li key={opt.letter}>
                    <span className="ws-mark" aria-hidden="true">☐</span>
                    <span className="ws-num">{opt.letter}.</span>
                    <span className="ws-text">{opt.text}</span>
                  </li>
                ))}
              </ul>

              <div className="ws-write-box">
                <span className="ws-write-label">In my own words:</span>
              </div>
            </article>
          ))}
        </section>
      )}

      {showKey && (
        <section
          className={`ws-answer-key${showStudent ? '' : ' ws-key-only'}`}
          aria-label="Answer key"
          data-testid={`${idPrefix}-answer-key`}
        >
          <header className="ws-header">
            <h3 className="ws-title">Answer key — {title}</h3>
            <p className="ws-meta">
              <span>Teacher copy — do not hand out.</span>
              {classLabel && <span>Class: {classLabel}</span>}
              {generated && <span>Generated {generated}</span>}
            </p>
          </header>

          {sheet.answer_key.map((key) => {
            const stepText = itemsByNumber[key.number]?.steps?.[key.flawed_step];
            return (
              <article key={key.number} className="ws-item" data-testid={`${idPrefix}-key-${key.number}`}>
                <h4 className="ws-item-title">{key.number}. {key.title}</h4>
                <p className="ws-key-row">
                  <strong>Bug:</strong> {key.flawed_step_label}
                  {stepText && <span className="ws-key-quote"> — “{stepText}”</span>}
                </p>
                <p className="ws-key-row">
                  <strong>Correct:</strong> {key.correct_letter} — {key.correct_explanation}
                </p>
                {key.misconception?.description && (
                  <p className="ws-key-row">
                    <strong>Misconception:</strong> {key.misconception.description}
                  </p>
                )}
                {key.debrief && (
                  <p className="ws-key-row">
                    <strong>Debrief:</strong> {key.debrief}
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};

const WorksheetPage = () => {
  const { user, API } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const targetTag = searchParams.get('tag') || '';
  const isTeacher = user?.role === 'teacher';

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState([]);
  const [title, setTitle] = useState(() => `Debug Hunt — ${formatDate(Date.now())}`);
  const [classLabel, setClassLabel] = useState('');
  const [includeKey, setIncludeKey] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [generatedKey, setGeneratedKey] = useState('');
  const [generating, setGenerating] = useState(false);
  const [printPart, setPrintPart] = useState(null);
  const [announcement, setAnnouncement] = useState('');

  const previewHeadingRef = useRef(null);
  const focusPreviewRef = useRef(false);
  const frameRef = useRef(null);
  const fallbackCleanupRef = useRef(null);

  const fetchCandidates = useCallback(async () => {
    if (!isTeacher) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const res = await axios.get(`${API}/arena/challenges`);
      const rows = Array.isArray(res.data) ? res.data : [];
      setCandidates(rows);
      if (targetTag) {
        setSelected(rows
          .filter((c) => c.misconception?.tag === targetTag)
          .slice(0, MAX_ITEMS)
          .map((c) => c.id));
      }
    } catch (e) {
      setLoadError(true);
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [API, isTeacher, targetTag]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // ---------- Printing ----------
  const clearPrintFallback = useCallback(() => {
    if (fallbackCleanupRef.current) {
      fallbackCleanupRef.current();
      fallbackCleanupRef.current = null;
    }
  }, []);

  const cancelPendingPrint = useCallback(() => {
    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    clearPrintFallback();
  }, [clearPrintFallback]);

  const endPrint = useCallback(() => {
    document.body.classList.remove('printing-sheet');
    clearPrintFallback();
    setPrintPart(null);
  }, [clearPrintFallback]);

  const hasSheet = Boolean(sheet);

  useEffect(() => {
    // Ctrl+P or the browser menu: print the worksheet as previewed instead of a blank page.
    // "beforeprint" runs before the print layout, so the portal is mounted synchronously here.
    const onBeforePrint = () => {
      if (!hasSheet) return;
      flushSync(() => setPrintPart((current) => current || (includeKey ? 'both' : 'student')));
      document.body.classList.add('printing-sheet');
    };
    window.addEventListener('beforeprint', onBeforePrint);
    window.addEventListener('afterprint', endPrint);
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint);
      window.removeEventListener('afterprint', endPrint);
    };
  }, [hasSheet, includeKey, endPrint]);

  useEffect(() => () => {
    cancelPendingPrint();
    document.body.classList.remove('printing-sheet');
  }, [cancelPendingPrint]);

  const startPrint = (part) => {
    if (!sheet) return;
    cancelPendingPrint();
    // Mount the print-only portal now so it is in the DOM before the print dialog opens.
    flushSync(() => setPrintPart(part));
    document.body.classList.add('printing-sheet');
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      window.print();
      if (!document.body.classList.contains('printing-sheet')) return; // "afterprint" already cleaned up
      // Fallback for browsers that never fire "afterprint". Some (Safari, mobile) return from
      // print() before the page is rendered for printing, so clear the class on the next
      // interaction instead of straight away. The class only changes print styles, so leaving
      // it on for a moment is invisible on screen.
      const done = () => endPrint();
      const events = ['pointerdown', 'keydown', 'focus'];
      events.forEach((name) => window.addEventListener(name, done, { once: true }));
      fallbackCleanupRef.current = () => events.forEach((name) => window.removeEventListener(name, done));
    });
  };

  // ---------- Selection ----------
  const groups = useMemo(() => {
    const bySubject = new Map();
    candidates.forEach((c) => {
      const subject = c.subject || 'Other';
      if (!bySubject.has(subject)) bySubject.set(subject, []);
      bySubject.get(subject).push(c);
    });
    const order = [...SUBJECTS, ...[...bySubject.keys()].filter((s) => !SUBJECTS.includes(s))];
    return order.filter((s) => bySubject.has(s)).map((s) => ({ subject: s, items: bySubject.get(s) }));
  }, [candidates]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Items print in the same order as the list on screen.
  const orderedIds = useMemo(
    () => groups.flatMap((g) => g.items).filter((c) => selectedSet.has(c.id)).map((c) => c.id),
    [groups, selectedSet],
  );
  const selectionKey = orderedIds.join(',');
  const atMax = orderedIds.length >= MAX_ITEMS;

  const targetInfo = useMemo(() => {
    if (!targetTag) return null;
    const matches = candidates.filter((c) => c.misconception?.tag === targetTag);
    return {
      description: matches[0]?.misconception?.description || targetTag,
      count: matches.length,
    };
  }, [candidates, targetTag]);

  const toggle = (id) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ITEMS) return prev;
      return [...prev, id];
    });
  };

  // ---------- Generate ----------
  const generate = async () => {
    if (!orderedIds.length) return;
    setGenerating(true);
    try {
      const res = await axios.get(`${API}/teacher/worksheet`, { params: { ids: selectionKey } });
      focusPreviewRef.current = true;
      setSheet(res.data);
      setGeneratedKey(selectionKey);
      const count = res.data?.items?.length || 0;
      setAnnouncement(`Worksheet ready with ${count} problem${count === 1 ? '' : 's'}. Preview below.`);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (sheet && focusPreviewRef.current) {
      focusPreviewRef.current = false;
      previewHeadingRef.current?.focus();
    }
  }, [sheet]);

  const sheetTitle = title.trim() || 'Debug Hunt';
  const classText = classLabel.trim();
  const previewPart = includeKey ? 'both' : 'student';
  const stale = Boolean(sheet) && generatedKey !== selectionKey;

  // ---------- Views ----------
  if (!isTeacher) {
    return (
      <div className={PAGE_CLASS}>
        <div className={INNER_CLASS} data-testid="worksheet-page">
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <h1 className="text-2xl font-semibold leading-tight tracking-tight">Offline Debug Hunt worksheet</h1>
              <CardDescription>
                Only teachers can build printable worksheets. You can still hunt bugs online in the Debug Arena.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
                <Link to="/arena" data-testid="worksheet-go-arena-btn">Go to the Debug Arena</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`${PAGE_CLASS} flex items-center justify-center`} data-testid="worksheet-page">
        <div role="status" className="flex flex-col items-center gap-3 text-gray-600">
          <div className="spinner" aria-hidden="true"></div>
          <span>Loading challenges…</span>
        </div>
      </div>
    );
  }

  return (
    <div className={PAGE_CLASS}>
      <div className={INNER_CLASS} data-testid="worksheet-page">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-emerald-700 hover:text-emerald-800 hover:underline mb-4 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"
          data-testid="worksheet-back-link"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to dashboard
        </Link>

        <Card className="bg-white/80 backdrop-blur-sm mb-6">
          <CardHeader>
            <h1 className="text-2xl sm:text-3xl font-semibold leading-tight tracking-tight flex items-center gap-2">
              <FileText className="w-7 h-7 text-emerald-600 shrink-0" aria-hidden="true" />
              <span>Offline Debug Hunt worksheet</span>
            </h1>
            <CardDescription className="text-base">
              Turn Debug Arena challenges into a paper worksheet for lessons with little or no internet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-1 text-sm text-gray-700">
              <li>Tick up to {MAX_ITEMS} challenges below, then generate the worksheet.</li>
              <li>
                Print it, or choose <strong>Save as PDF</strong> in the print dialog to keep a copy — the paper
                sheet works with no internet in class.
              </li>
              <li>
                Students circle the step where the reasoning first goes wrong, tick the explanation that fits, and
                explain it in their own words.
              </li>
              <li>Use the answer key (printed on its own page) to mark the sheets and lead the discussion.</li>
            </ol>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
              Only generating needs a connection; once printed or saved, nothing else is downloaded.
            </p>
          </CardContent>
        </Card>

        {targetInfo && (
          <div
            className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900"
            role="status"
            data-testid="worksheet-target-banner"
          >
            <Target className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold break-words">Targeting: {targetInfo.description}</p>
              <p className="mt-0.5">
                {targetInfo.count === 0
                  ? 'No challenges test this misconception yet — pick any challenges below.'
                  : `${Math.min(targetInfo.count, MAX_ITEMS)} matching challenge${targetInfo.count === 1 ? ' is' : 's are'} ticked for you`
                    + `${targetInfo.count > MAX_ITEMS ? ` (the first ${MAX_ITEMS} of ${targetInfo.count})` : ''}.`
                    + ' Add or remove any you like.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* ---------- Candidate list ---------- */}
          <Card className="bg-white/80 backdrop-blur-sm lg:col-span-2 min-w-0" data-testid="worksheet-candidates">
            <CardHeader>
              <h2 className="text-xl font-semibold leading-none tracking-tight">1. Choose challenges</h2>
              <CardDescription>
                Official challenges and the approved scenarios your students wrote.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {loadError && (
                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 min-w-0">Couldn't load the challenges. Check your connection.</span>
                  <Button size="sm" variant="outline" onClick={fetchCandidates} data-testid="worksheet-retry-btn">
                    <RefreshCw className="w-4 h-4" aria-hidden="true" /> Retry
                  </Button>
                </div>
              )}

              {!loadError && groups.length === 0 && (
                <p className="text-sm text-gray-600" data-testid="worksheet-empty">
                  There are no Debug Arena challenges available yet.
                </p>
              )}

              {groups.map((group) => {
                const pickedInGroup = group.items.filter((c) => selectedSet.has(c.id)).length;
                return (
                  <fieldset key={group.subject} className="min-w-0" data-testid={`worksheet-group-${group.subject.toLowerCase()}`}>
                    <legend className="mb-2 flex flex-wrap items-baseline gap-2 font-semibold text-gray-900">
                      <span><span aria-hidden="true">{subjectEmoji(group.subject)}</span> {group.subject}</span>
                      <span className="text-xs font-normal text-gray-500">
                        {pickedInGroup} of {group.items.length} ticked
                      </span>
                    </legend>
                    <ul className="space-y-2">
                      {group.items.map((c) => {
                        const checked = selectedSet.has(c.id);
                        const disabled = !checked && atMax;
                        const inputId = `worksheet-candidate-input-${c.id}`;
                        const isTarget = Boolean(targetTag) && c.misconception?.tag === targetTag;
                        return (
                          <li key={c.id}>
                            <div
                              className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                                checked ? 'border-emerald-500 bg-emerald-50/80' : 'border-gray-200 bg-white'
                              } ${disabled ? 'opacity-60' : ''}`}
                            >
                              <input
                                id={inputId}
                                type="checkbox"
                                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                                checked={checked}
                                disabled={disabled}
                                onChange={() => toggle(c.id)}
                                aria-describedby={disabled ? 'worksheet-max-hint' : undefined}
                                data-testid={`worksheet-candidate-${c.id}`}
                              />
                              <label
                                htmlFor={inputId}
                                className={`min-w-0 flex-1 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                              >
                                <span className="block font-medium text-gray-900 break-words">{c.title}</span>
                                <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-semibold ${subjectBadgeColor(c.subject)}`}>
                                    <span aria-hidden="true" className="mr-1">{subjectEmoji(c.subject)}</span>{c.subject}
                                  </span>
                                  {c.source === 'peer' ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-sky-800">
                                      <UserRound className="w-3 h-3" aria-hidden="true" />
                                      by {c.author_name || 'a student'}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-emerald-800">
                                      <BadgeCheck className="w-3 h-3" aria-hidden="true" />
                                      Official
                                    </span>
                                  )}
                                  {isTarget && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-rose-800">
                                      <Target className="w-3 h-3" aria-hidden="true" />
                                      Targeted
                                    </span>
                                  )}
                                  {Array.isArray(c.steps) && (
                                    <span className="text-gray-500">{c.steps.length} steps</span>
                                  )}
                                </span>
                                {c.misconception?.description && (
                                  <span className="mt-1 block text-xs text-gray-600 break-words">
                                    Misconception: {c.misconception.description}
                                  </span>
                                )}
                              </label>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </fieldset>
                );
              })}
            </CardContent>
          </Card>

          {/* ---------- Settings + generate ---------- */}
          <Card className="bg-white/80 backdrop-blur-sm self-start lg:sticky lg:top-24 min-w-0" data-testid="worksheet-settings">
            <CardHeader>
              <h2 className="text-xl font-semibold leading-none tracking-tight">2. Set up the sheet</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div aria-live="polite" className="text-sm" data-testid="worksheet-selected-count">
                <p className="font-medium text-gray-900">
                  {orderedIds.length} of {MAX_ITEMS} challenges ticked
                </p>
                {atMax && (
                  <p id="worksheet-max-hint" className="mt-1 flex items-start gap-1.5 text-amber-800">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>That's the maximum of {MAX_ITEMS}. Untick one to swap in another.</span>
                  </p>
                )}
              </div>
              {orderedIds.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2 text-gray-600"
                  onClick={() => setSelected([])}
                  data-testid="worksheet-clear-btn"
                >
                  Clear selection
                </Button>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="worksheet-title">Sheet title</Label>
                <Input
                  id="worksheet-title"
                  value={title}
                  maxLength={80}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="worksheet-title-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="worksheet-class">
                  Class name <span className="font-normal text-gray-500">(optional)</span>
                </Label>
                <Input
                  id="worksheet-class"
                  value={classLabel}
                  maxLength={60}
                  placeholder="e.g. 8B Physics"
                  onChange={(e) => setClassLabel(e.target.value)}
                  data-testid="worksheet-class-input"
                />
              </div>
              <div className="flex items-start gap-2">
                <input
                  id="worksheet-include-key"
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
                  checked={includeKey}
                  onChange={(e) => setIncludeKey(e.target.checked)}
                  aria-describedby="worksheet-include-key-hint"
                  data-testid="worksheet-include-key"
                />
                <div className="min-w-0">
                  <label htmlFor="worksheet-include-key" className="text-sm font-medium cursor-pointer">
                    Include answer key
                  </label>
                  <p id="worksheet-include-key-hint" className="text-xs text-gray-500">
                    Turn off to keep the answers out of the preview and the printout, e.g. when projecting the sheet.
                  </p>
                </div>
              </div>

              <Button
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={generate}
                disabled={!orderedIds.length || generating}
                aria-busy={generating}
                data-testid="worksheet-generate-btn"
              >
                {generating
                  ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  : <FileText className="w-4 h-4" aria-hidden="true" />}
                {generating ? 'Generating…' : sheet ? 'Generate again' : 'Generate worksheet'}
              </Button>
              {!orderedIds.length && (
                <p className="text-xs text-gray-500">Tick at least one challenge to generate a worksheet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="sr-only" aria-live="polite">{announcement}</p>

        {/* ---------- Preview ---------- */}
        {sheet && (
          <Card className="bg-white/80 backdrop-blur-sm mt-6 min-w-0" data-testid="worksheet-preview-card">
            <CardHeader className="gap-3">
              <div>
                <h2
                  ref={previewHeadingRef}
                  tabIndex={-1}
                  className="text-xl font-semibold leading-none tracking-tight focus:outline-none"
                >
                  3. Preview and print
                </h2>
                <CardDescription className="mt-1.5">
                  {sheet.items.length} problem{sheet.items.length === 1 ? '' : 's'}
                  {includeKey ? ' · the answer key starts on a new page' : ' · answer key hidden'}.
                  In the print dialog, pick a printer or “Save as PDF”.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => startPrint('student')}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="print-student-btn"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" /> Print student sheet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => startPrint('key')}
                  disabled={!includeKey}
                  data-testid="print-key-btn"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" /> Print answer key
                </Button>
                <Button
                  variant="outline"
                  onClick={() => startPrint('both')}
                  disabled={!includeKey}
                  data-testid="print-both-btn"
                >
                  <Printer className="w-4 h-4" aria-hidden="true" /> Print both
                </Button>
              </div>
              {!includeKey && (
                <p className="text-xs text-gray-500">
                  Tick “Include answer key” above to preview or print the answers.
                </p>
              )}
              {stale && (
                <p
                  className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                  role="status"
                  data-testid="worksheet-stale-notice"
                >
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>Your selection has changed since this preview was made. Generate again to update it.</span>
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <div className="ws-screen" data-testid="worksheet-preview">
                  <WorksheetDocument
                    sheet={sheet}
                    title={sheetTitle}
                    classLabel={classText}
                    part={previewPart}
                    idPrefix="worksheet-preview"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Print-only copy, mounted only while printing so the hidden duplicate never sits in the DOM. */}
      {sheet && printPart && createPortal(
        <div className="print-sheet" data-testid="worksheet-print-sheet">
          <WorksheetDocument
            sheet={sheet}
            title={sheetTitle}
            classLabel={classText}
            part={printPart}
            idPrefix="worksheet-print"
          />
        </div>,
        document.body,
      )}
    </div>
  );
};

export default WorksheetPage;
