import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as m from 'motion/react-m';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Flag } from 'lucide-react';
import { formatApiError } from '../lib/steam';
import { scoreTier, stepLabel, ratePercent, FLAG_REASONS, FLAG_NOTE_MAX } from '../lib/arena';
import { misconceptionName } from '../lib/misconceptions';
import { MotionScope, useMotion } from '../lib/motion';
import { useAgeTheme } from '../lib/theme';
import { cn } from '../lib/utils';
import { CorrectionMark, GraphPaper, SpecimenLabel, StatusWord } from './lab';
import { ArenaCounter, JOURNAL_GRID, STEP_GRID, lineLabel, sourceLabel } from './ArenaPlay';

// The verdict is this screen's one orchestrated moment: steps tick "Holds" top-down, stop at
// the wrong step and the correction mark springs in, all inside 600ms. Score, points and
// rating are plain text from the first frame; only the marks on the sheet move.
const TICK = 0.06;
const MOMENT_CAP = 0.6;
const MARK = 0.24;

const CheckRow = ({ ok, okText, failText, testId }) => (
  <li className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2.5" data-testid={testId}>
    <StatusWord status={ok ? 'correct' : 'wrong'} className="w-[7.5rem] shrink-0" />
    <span className="min-w-0 flex-1 basis-60">{ok ? okText : failText}</span>
  </li>
);

const ratingWords = (delta) => {
  if (delta > 0) return `up ${delta}`;
  if (delta < 0) return `down ${Math.abs(delta)}`;
  return 'no change';
};

const lowerFirst = (text) => (text ? text.charAt(0).toLowerCase() + text.slice(1) : '');

const FlagDialog = ({ open, onOpenChange, challenge, onFlagged }) => {
  const { API } = useContext(AuthContext);
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      const body = { reason };
      if (note.trim()) body.note = note.trim();
      const res = await axios.post(`${API}/arena/challenges/${challenge.id}/flag`, body);
      if (res.data.hidden) {
        toast.success('Thanks for the report. The scenario is hidden until your teacher reviews it.');
      } else {
        toast.success('Thanks for the report. Your teacher will take a look.');
      }
      onFlagged();
      onOpenChange(false);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      if (e.response?.status === 409) {
        onFlagged();
        onOpenChange(false);
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] rounded-xl sm:max-w-lg" data-testid="flag-scenario-dialog">
        <DialogHeader>
          <DialogTitle className="font-sans">Report a problem</DialogTitle>
          <DialogDescription>
            Something off with &ldquo;{challenge.title}&rdquo;? Your teacher sees every report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="flag-reason">What's wrong?</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="flag-reason" data-testid="flag-reason-select">
                <SelectValue placeholder="Pick a reason" />
              </SelectTrigger>
              <SelectContent>
                {FLAG_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value} data-testid={`flag-reason-${r.value}`}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="flag-note">Note for your teacher (optional)</Label>
            <Textarea
              id="flag-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, FLAG_NOTE_MAX))}
              maxLength={FLAG_NOTE_MAX}
              rows={3}
              aria-describedby="flag-note-count"
              data-testid="flag-note-input"
            />
            <p id="flag-note-count" className="text-right text-sm text-ink-muted tnum">
              {note.length}/{FLAG_NOTE_MAX}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="flag-cancel-btn">
            Cancel
          </Button>
          <Button onClick={send} disabled={!reason || sending} data-testid="flag-submit-btn">
            {sending ? 'Sending...' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const ArenaResultSheet = ({ challenge, result, onNext, onBack, position }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useAgeTheme();
  const mo = useMotion();
  const journal = theme === '18+';
  const headingRef = useRef(null);
  const [flagOpen, setFlagOpen] = useState(false);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    // Move focus to the result so keyboard and screen-reader users land on the outcome.
    if (headingRef.current) headingRef.current.focus();
  }, []);

  const tier = scoreTier(result.score);
  const steps = challenge.steps || [];
  const flawed = result.flawed_step;
  const picked = result.selected_step;
  const isPeer = result.source === 'peer';
  const isCode = challenge.subject === 'Technology';
  const textFont = isCode ? 'font-mono text-sm' : '';
  const findPct = ratePercent(result.community?.find_rate);
  const solvers = result.community?.solvers || 0;
  const tag = result.misconception?.tag;
  const trap = result.misconception?.description;
  const showStreak = theme === '13-15' || theme === '16-18';

  const stepFailText = picked == null
    ? `You didn't pick a step. The bug was in ${stepLabel(flawed)}.`
    : `You picked ${stepLabel(picked)}, but the bug was in ${stepLabel(flawed)}.`;
  const conceptFailText = result.selected_explanation == null
    ? "You didn't pick an explanation."
    : 'Your explanation didn’t match the concept this step breaks.';

  // Timings for the moment. Reduced: a 120ms fade, no delays. Off (and lite): final state at once.
  const breakAt = mo.full ? Math.min((flawed || 0) * TICK, MOMENT_CAP - MARK) : 0;
  const gap = mo.full && flawed > 0 ? breakAt / flawed : 0;
  const tickIn = (i) => (mo.off ? { initial: false } : {
    initial: { opacity: 0, y: mo.travel },
    animate: { opacity: 1, y: 0 },
    transition: { ...mo.enter, delay: i * gap },
  });
  const breakIn = mo.off ? { initial: false } : {
    initial: { opacity: 0, scale: mo.full ? 0.92 : 1 },
    animate: { opacity: 1, scale: 1 },
    transition: mo.full ? { ...mo.spring, delay: breakAt } : mo.enter,
  };
  const markIn = mo.off ? { initial: false } : mo.full ? {
    initial: { clipPath: 'inset(0 100% 0 0)' },
    animate: { clipPath: 'inset(0 0% 0 0)' },
    transition: { duration: MARK, ease: [0.3, 1.3, 0.55, 1], delay: breakAt },
  } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: mo.enter };
  const noteIn = mo.off ? { initial: false } : {
    initial: { opacity: 0, y: mo.full ? -mo.travel : 0 },
    animate: { opacity: 1, y: 0 },
    transition: mo.full ? { ...mo.spring, delay: Math.min(breakAt + 0.1, MOMENT_CAP - 0.2) } : mo.enter,
  };

  const statusFor = (i) => {
    if (i < flawed) {
      return (
        <m.span className="inline-flex" {...tickIn(i)}>
          <StatusWord status="holds" />
        </m.span>
      );
    }
    if (i === flawed) {
      return (
        <m.span className="inline-flex origin-left" {...breakIn}>
          <StatusWord status="breaks" data-testid="arena-bug-label">
            {journal ? `Breaks at ${lineLabel(i, true)}` : 'Breaks here'}
          </StatusWord>
        </m.span>
      );
    }
    return null;
  };

  const pickNote = (i) => (picked === i ? (
    <span className={cn('t-cap block', !journal && 'mt-2')} data-testid="arena-pick-label">
      {journal ? 'You marked this line.' : 'Your pick'}
    </span>
  ) : null);

  const stepText = (text, i) => {
    const body = <span className={cn('block whitespace-pre-wrap break-words', textFont)}>{text}</span>;
    if (i !== flawed) return <span className="relative block">{body}</span>;
    return (
      <span className="relative block">
        {body}
        <m.span aria-hidden="true" className="pointer-events-none absolute inset-0 -bottom-3 text-transparent" {...markIn}>
          <CorrectionMark className="block">{body}</CorrectionMark>
        </m.span>
      </span>
    );
  };

  // The margin note under (or beside, at 18+) the wrong step: the specimen, then the explanation.
  const note = (
    <m.div className={cn('flex flex-col gap-2', journal && 'border-l-2 border-brand pl-3 text-sm')} {...noteIn}>
      {(tag || trap) && (
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1" data-testid="arena-misconception">
          {tag && <SpecimenLabel name={misconceptionName(tag)} />}
          {trap && <span className="text-sm text-ink-muted">The trap: {lowerFirst(trap)}</span>}
        </p>
      )}
      <div data-testid="arena-correct-explanation">
        <p className="whitespace-pre-wrap break-words">{result.correct_explanation}</p>
        {result.selected_explanation && !result.explanation_correct && (
          <p className="mt-1 text-sm text-ink-muted">
            You picked: <span className="text-ink">{result.selected_explanation}</span>
          </p>
        )}
      </div>
    </m.div>
  );

  const rating = result.rating;
  const delta = rating?.delta || 0;

  return (
    <div className={cn('mx-auto w-full px-4 pb-16 pt-6 sm:px-6 sm:pt-8', journal ? 'max-w-5xl' : 'max-w-3xl')} data-testid="arena-result">
      <div className={cn(journal && 'max-w-[760px]')}>
        <ArenaCounter position={position} journal={journal} />
        <p className="mt-3 flex flex-wrap gap-x-4 text-sm text-ink-muted">
          <span className="font-semibold">{challenge.subject}</span>
          {isPeer ? (
            <span data-testid="arena-result-author">{sourceLabel(challenge, result)}</span>
          ) : (
            <span>{sourceLabel(challenge, result)}</span>
          )}
        </p>
        <h1 ref={headingRef} tabIndex={-1} className="t-h2 mt-1.5 break-words" data-testid="arena-result-title">
          <span className="sr-only">Diagnosis: </span>{challenge.title}
        </h1>

        <div className="mt-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="t-num text-4xl leading-none" data-testid="arena-score">
            {result.score}<span className="text-2xl text-ink-muted">/100</span>
          </p>
          <p className="text-lg font-semibold" data-testid="arena-score-tier">{tier.label}</p>
        </div>

        <ul className="mt-4 divide-y divide-rule border-y border-rule" aria-label="How you did">
          <CheckRow
            ok={result.step_correct}
            okText={`You found the broken step (${stepLabel(flawed)}).`}
            failText={stepFailText}
            testId="arena-check-step"
          />
          <CheckRow
            ok={result.explanation_correct}
            okText="You named the concept it breaks."
            failText={conceptFailText}
            testId="arena-check-concept"
          />
        </ul>

        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-ink-muted">
          <span data-testid="arena-points-earned">
            <span className="t-num text-ink">+{result.points_earned || 0}</span> points
          </span>
          {rating && (
            <span data-testid="arena-rating">
              Debugger rating <span className="t-num text-ink">{Number(rating.after).toLocaleString()}</span>, {ratingWords(delta)}
            </span>
          )}
          {showStreak && (
            <span data-testid="arena-streak">
              <span className="t-num text-ink">{result.streak_days || 0}</span>-day streak
            </span>
          )}
        </p>
        {isPeer && (
          <p className="mt-2 text-sm text-ink-muted tnum" data-testid="arena-community">
            {findPct == null || solvers === 0
              ? 'No classmates have a counted attempt on this one yet.'
              : `${findPct}% of ${solvers} ${solvers === 1 ? 'classmate' : 'classmates'} found it.`}
          </p>
        )}
        {!result.first_attempt && (
          <p className="mt-2 text-sm text-ink-muted" data-testid="arena-retry-note">
            Points and rating only count on your first attempt.
          </p>
        )}
      </div>

      <section className="mt-10" data-testid="arena-result-steps" aria-labelledby="arena-checked-heading">
        <h2 id="arena-checked-heading" className="font-sans text-base font-semibold">The reasoning, checked</h2>
        <p className={cn('mt-2 whitespace-pre-wrap break-words text-ink-muted', journal && 'max-w-[68ch]', textFont)}>
          {challenge.problem}
        </p>

        {journal ? (
          <ol className="mt-4 border-t border-rule">
            {steps.map((text, i) => (
              <li
                key={i}
                className="flex flex-wrap items-stretch gap-x-7 border-b border-rule"
                data-testid={`arena-result-step-${i}`}
              >
                <GraphPaper
                  className={cn(
                    'min-w-0 flex-[999_1_460px] border-0 border-l-2',
                    i === flawed ? 'border-l-brand' : 'border-l-transparent'
                  )}
                >
                  <div className={cn(JOURNAL_GRID, 'py-2.5 pl-1 pr-3')}>
                    <span aria-hidden="true" className="text-right text-ink-muted t-num">{lineLabel(i, true)}</span>
                    <span className="min-w-0">
                      <span className="sr-only">Step {i + 1}: </span>
                      {stepText(text, i)}
                    </span>
                  </div>
                </GraphPaper>
                <div className="flex flex-[1_1_240px] flex-col items-start gap-1.5 pb-3 pl-[3.375rem] text-sm empty:hidden sm:py-3 sm:pl-0">
                  {i === flawed ? (
                    <>
                      {statusFor(i)}
                      {note}
                    </>
                  ) : statusFor(i)}
                  {pickNote(i)}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <GraphPaper as="ol" className="mt-4">
            {steps.map((text, i) => (
              <li key={i} className="border-b border-rule last:border-b-0" data-testid={`arena-result-step-${i}`}>
                <div className={cn(STEP_GRID, 'gap-y-1.5 px-3 py-3.5 sm:grid-cols-[2.25rem_minmax(0,1fr)_8.5rem] sm:px-4')}>
                  <span aria-hidden="true" className="text-right text-ink-muted t-num">{lineLabel(i, false)}</span>
                  <span className="min-w-0">
                    <span className="sr-only">Step {i + 1}: </span>
                    {stepText(text, i)}
                    {pickNote(i)}
                  </span>
                  <span className="col-start-2 empty:hidden sm:col-start-auto sm:text-right">{statusFor(i)}</span>
                </div>
                {i === flawed && (
                  <div className="px-3 pb-4 pl-[3.5rem] sm:pl-[4rem] sm:pr-4">{note}</div>
                )}
              </li>
            ))}
          </GraphPaper>
        )}
      </section>

      {result.debrief && (
        <section className={cn('mt-8', journal && 'max-w-[68ch]')} data-testid="arena-debrief" aria-labelledby="arena-debrief-heading">
          <h2 id="arena-debrief-heading" className="font-sans text-base font-semibold">Debrief</h2>
          <p className="mt-2 whitespace-pre-wrap break-words">{result.debrief}</p>
        </section>
      )}

      <div className={cn('mt-10 flex flex-col gap-3 border-t border-rule pt-5 sm:flex-row sm:flex-wrap sm:items-center', journal && 'max-w-[760px]')}>
        <Button onClick={onNext} disabled={!onNext} className="min-w-[10rem]" data-testid="arena-next-btn">
          {onNext ? 'Next solution' : 'No new solutions left'} <ArrowRight aria-hidden="true" />
        </Button>
        <Button variant="outline" onClick={onBack} data-testid="arena-back-btn">
          <ArrowLeft aria-hidden="true" /> All solutions
        </Button>
        <Button variant="ghost" onClick={() => navigate('/dashboard')} data-testid="arena-dashboard-btn">
          Dashboard
        </Button>
        {isPeer && user?.role === 'student' && (
          <>
            <Button
              variant="ghost"
              onClick={() => setFlagOpen(true)}
              disabled={flagged}
              className="text-ink-muted sm:ml-auto"
              data-testid="flag-scenario-btn"
            >
              <Flag aria-hidden="true" /> {flagged ? 'Reported' : 'Report a problem'}
            </Button>
            <FlagDialog
              open={flagOpen}
              onOpenChange={setFlagOpen}
              challenge={challenge}
              onFlagged={() => setFlagged(true)}
            />
          </>
        )}
      </div>
    </div>
  );
};

export const ArenaResult = (props) => (
  <MotionScope>
    <ArenaResultSheet {...props} />
  </MotionScope>
);

export default ArenaResult;
