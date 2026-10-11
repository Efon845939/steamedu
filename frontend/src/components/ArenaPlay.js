import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import axios from 'axios';
import { toast } from 'sonner';
import { AlarmClock, LogOut, Timer } from 'lucide-react';
import { formatApiError } from '../lib/steam';
import { notifyNewBadges } from '../lib/badges';
import { formatClock, optionLetter } from '../lib/arena';
import { useCountdown } from '../hooks/useCountdown';
import { useAgeTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { CorrectionMark, GraphPaper } from './lab';

const LOW_TIME_SECONDS = 15;
const DEFAULT_LIMIT_SECONDS = 90;

// Screen readers only hear the clock at these moments, not on every tick.
const timerAnnouncement = (remaining) => {
  if (remaining <= 0) return "Time's up.";
  if (remaining <= 10) return '10 seconds left.';
  if (remaining <= 30) return '30 seconds left.';
  return '';
};

// Shared with ArenaResult: the worked solution is the same sheet before and after the verdict.

// Line numbers: "3" in most themes, "(3)" in the 18+ journal.
export const lineLabel = (i, journal) => (journal ? `(${i + 1})` : String(i + 1));

// One step row on graph paper: a fixed numeric gutter, then the text.
export const STEP_GRID = 'grid w-full grid-cols-[2rem_minmax(0,1fr)] items-start gap-3 sm:grid-cols-[2.25rem_minmax(0,1fr)]';
export const JOURNAL_GRID = 'grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-2';

export const sourceLabel = (challenge, result) => (
  (result?.source ?? challenge.source) === 'peer'
    ? `By ${result?.author_name || challenge.author_name || 'a classmate'}`
    : 'Official'
);

// "Debug Arena, solution 3 of 10" (18+: "Puzzle 3"). index is -1 for a deep-linked solution.
export const ArenaCounter = ({ position, journal, className }) => {
  const index = position?.index ?? -1;
  const total = position?.total ?? 0;
  if (index < 0) return <p className={cn('t-cap', className)}>Debug Arena</p>;
  if (journal) {
    return (
      <p className={cn('t-cap tnum', className)}>
        Puzzle <span className="t-num text-ink">{index + 1}</span>
      </p>
    );
  }
  return (
    <p className={cn('t-cap tnum', className)}>
      <span className="sm:hidden">Solution</span>
      <span className="hidden sm:inline">Debug Arena, solution</span>{' '}
      <span className="t-num text-ink">{index + 1}</span> of {total}
    </p>
  );
};

export const ArenaPlay = ({ challenge, onFinish, onExit, position }) => {
  const { API, user } = useContext(AuthContext);
  const theme = useAgeTheme();
  const journal = theme === '18+';
  const notebook = theme === '13-15';
  const [step, setStep] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const submittingRef = useRef(false);
  const stepRefs = useRef([]);

  const limit = challenge.time_limit_seconds || DEFAULT_LIMIT_SECONDS;
  const steps = challenge.steps || [];
  const explanations = challenge.explanations || [];
  const isCode = challenge.subject === 'Technology';
  const textFont = isCode ? 'font-mono text-sm' : '';

  // submit() has to exist before the countdown (it is the expiry handler), so it reads elapsed time from a ref.
  const elapsedRef = useRef(0);

  const submit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/arena/challenges/${challenge.id}/attempt`, {
        selected_step: step ?? null,
        selected_explanation: explanation ?? null,
        seconds_used: elapsedRef.current,
      });
      notifyNewBadges(res.data.new_badges);
      setFinished(true);
      onFinish(res.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [API, challenge.id, step, explanation, onFinish]);

  const handleExpire = useCallback(() => {
    elapsedRef.current = limit;
    toast.info("Time's up. Submitting what you have.");
    submit();
  }, [limit, submit]);

  const { remaining, elapsed, pct } = useCountdown(limit, {
    running: !submitting && !finished,
    onExpire: handleExpire,
    resetKey: challenge.id,
  });

  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  const expired = remaining <= 0;
  const lowTime = remaining <= LOW_TIME_SECONDS;
  const ready = step !== null && explanation !== null;
  const canSubmit = (ready || expired) && !submitting && !finished;
  const ClockIcon = lowTime ? AlarmClock : Timer;
  const streak = user?.streak_days || 0;

  // Arrow keys move between steps; Enter or Space picks (native button behaviour).
  const moveFocus = (event, i) => {
    let next = null;
    if (event.key === 'ArrowDown') next = Math.min(steps.length - 1, i + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, i - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = steps.length - 1;
    if (next === null) return;
    event.preventDefault();
    stepRefs.current[next]?.focus();
  };

  const stepHeading = journal
    ? 'Find the first line that breaks, then say why.'
    : 'Pick the first wrong step, then the idea behind it.';
  const whyHeading = journal
    ? (step === null ? 'Why does it break?' : `Why does line (${step + 1}) break?`)
    : (step === null ? 'What is the idea behind the wrong step?' : `What is the idea behind step ${step + 1}?`);

  let guide;
  if (expired && !ready) guide = "Time's up. Submit what you have.";
  else if (ready) guide = journal ? 'Submit when ready.' : 'Ready when you are.';
  else if (step === null && explanation === null) guide = journal ? 'Select a line, then the reason it breaks.' : 'Pick a step and an idea to submit.';
  else if (step === null) guide = journal ? 'Now select the first line that breaks.' : 'Now pick the first wrong step.';
  else guide = journal ? `Now choose why line (${step + 1}) breaks.` : `Now pick the idea behind step ${step + 1}.`;

  const stepButton = (text, i) => {
    const selected = step === i;
    const body = <span className={cn('block whitespace-pre-wrap break-words', textFont)}>{text}</span>;
    return (
      <button
        key={i}
        ref={(el) => { stepRefs.current[i] = el; }}
        type="button"
        onClick={() => setStep(i)}
        onKeyDown={(e) => moveFocus(e, i)}
        aria-pressed={selected}
        disabled={submitting || finished}
        className={cn(
          'text-left transition-colors disabled:cursor-not-allowed',
          journal
            ? cn(JOURNAL_GRID, 'min-h-12 py-2.5 pl-1 pr-3')
            : cn(STEP_GRID, 'min-h-14 border-b border-rule px-3 py-3.5 last:border-b-0 sm:px-4'),
          selected ? 'bg-brand-tint/80' : 'hover:bg-brand-tint/50'
        )}
        data-testid={`arena-step-${i}`}
      >
        <span aria-hidden="true" className="text-right text-ink-muted t-num">{lineLabel(i, journal)}</span>
        <span className="min-w-0">
          <span className="sr-only">Step {i + 1}: </span>
          {selected ? (
            // The overlay box reaches below the last line so the wipe's clip never cuts its wave.
            <CorrectionMark draw className="[&>.wavy-draw]:-bottom-3">{body}</CorrectionMark>
          ) : <span className="relative block">{body}</span>}
        </span>
      </button>
    );
  };

  return (
    <div className={cn('mx-auto w-full px-4 pb-16 sm:px-6', journal ? 'max-w-5xl' : 'max-w-3xl')} data-testid="arena-play">
      <div className="sticky top-[5.25rem] z-30 mt-4" data-testid="arena-play-header">
        <div className="glass relative flex min-h-14 flex-wrap items-center justify-between gap-x-5 gap-y-1 overflow-hidden rounded-full px-5 py-2">
          <ArenaCounter position={position} journal={journal} />
          <div className="flex items-center gap-5">
            {notebook && streak > 0 && (
              <span className="whitespace-nowrap text-sm">
                <span className="t-num">{streak}</span>-day streak
              </span>
            )}
            <span
              className={cn(
                'inline-flex items-baseline gap-1.5 whitespace-nowrap',
                notebook ? 'text-base' : 'text-sm',
                lowTime ? 'font-semibold text-danger' : notebook ? 'text-ink' : 'text-ink-muted'
              )}
              data-testid="arena-timer"
            >
              <ClockIcon className="h-[1.15em] w-[1.15em] shrink-0 self-center" aria-hidden="true" />
              <span className="sr-only">Time left: </span>
              <span className={cn('t-num', notebook && 'text-lg')}>{formatClock(remaining)}</span>
              <span aria-hidden="true">left</span>
              {lowTime && <span className="sr-only">, time almost up</span>}
            </span>
          </div>
          <Progress
            value={pct}
            className={cn(
              'absolute inset-x-0 -bottom-px h-0.5 rounded-none bg-transparent',
              lowTime ? '[&>div]:bg-danger' : '[&>div]:bg-brand-ink'
            )}
            aria-label="Time remaining"
            getValueLabel={() => `${remaining} seconds left`}
            data-testid="arena-timer-progress"
          />
        </div>
        <p className="sr-only" aria-live="polite" data-testid="arena-timer-announcement">
          {timerAnnouncement(remaining)}
        </p>
      </div>

      <div className={cn('glass glass-strong animate-question mt-6 rounded-[28px] p-6 sm:mt-8 sm:p-8', journal && 'max-w-[68ch]')}>
        <p className="flex flex-wrap gap-x-4 text-sm text-ink-muted">
          <span className="font-semibold">{challenge.subject}</span>
          <span>{sourceLabel(challenge)}</span>
        </p>
        <h1 className="t-h2 mt-1.5 break-words" data-testid="arena-play-title">
          {challenge.title}
        </h1>
        <div className="mt-4" data-testid="arena-problem-card">
          <h2 className="sr-only">The problem</h2>
          <p className={cn('whitespace-pre-wrap break-words', textFont)} data-testid="arena-problem">
            {challenge.problem}
          </p>
        </div>
      </div>

      <section className="mt-7" data-testid="arena-steps-card">
        <h2 id="arena-step-heading" className="font-sans text-base font-normal text-ink-muted">
          {stepHeading}
        </h2>
        {journal ? (
          <div role="group" aria-labelledby="arena-step-heading" className="mt-3 border-t border-rule">
            {steps.map((text, i) => (
              <div key={i} className="flex flex-wrap items-start gap-x-7 border-b border-rule">
                <GraphPaper className="min-w-0 flex-[999_1_460px] border-0 border-l-2 border-l-transparent">
                  {stepButton(text, i)}
                </GraphPaper>
                <div className="flex-[1_1_240px] pb-3 pl-[3.375rem] text-sm empty:hidden sm:py-3 sm:pl-0">
                  {step === i && (
                    <p className="border-l-2 border-brand pl-3 text-ink-muted">You marked this line.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <GraphPaper role="group" aria-labelledby="arena-step-heading" className="mt-3">
            {steps.map((text, i) => stepButton(text, i))}
          </GraphPaper>
        )}
      </section>

      <section className={cn('mt-8', journal && 'max-w-[760px]')} data-testid="arena-explanations-card">
        <h2
          id="arena-explanation-heading"
          className={cn('font-sans text-base font-semibold', step === null && 'text-ink-muted')}
        >
          {whyHeading}
        </h2>
        <div role="group" aria-labelledby="arena-explanation-heading" className="mt-3 flex flex-col gap-2">
          {explanations.map((text, i) => {
            const selected = explanation === text;
            return (
              <button
                key={text}
                type="button"
                onClick={() => setExplanation(text)}
                aria-pressed={selected}
                disabled={submitting || finished}
                className={cn(
                  'min-h-12 w-full rounded-2xl border px-4 py-3 text-left transition-[border-color,background-color,transform,box-shadow] duration-enter ease-spring active:scale-[0.99] disabled:cursor-not-allowed',
                  selected
                    ? 'scale-[1.01] border-brand-ink bg-brand-tint/90 shadow-[0_10px_30px_-14px_rgb(var(--brand)/0.7)] ring-1 ring-inset ring-brand-ink'
                    : 'border-rule-strong/50 bg-surface/55 backdrop-blur-md hover:-translate-y-0.5 hover:bg-surface/80'
                )}
                data-testid={`arena-explanation-${i}`}
              >
                <span className="sr-only">Option {optionLetter(i)}: </span>
                <span className="whitespace-pre-wrap break-words">{text}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div
        className={cn(
          'glass sticky bottom-3 z-20 mt-8 flex flex-col gap-3 rounded-[22px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between',
          journal && 'max-w-[760px]'
        )}
      >
        <p id="arena-submit-hint" aria-live="polite" className={cn('text-ink-muted', ready && 'text-ink')}>
          {guide}
        </p>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <Button variant="ghost" onClick={onExit} disabled={submitting} data-testid="exit-arena-btn">
            <LogOut aria-hidden="true" /> Exit
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            aria-describedby={!ready && !expired ? 'arena-submit-hint' : undefined}
            className="min-w-[8.5rem]"
            data-testid="submit-arena-btn"
          >
            {submitting ? 'Submitting...' : expired && !ready ? 'Submit what I have' : 'Submit'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArenaPlay;
