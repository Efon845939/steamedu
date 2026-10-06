import React, { useState, useContext, useCallback, useEffect, useRef } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import axios from 'axios';
import { toast } from 'sonner';
import { Bug, Clock, AlarmClock, CheckCircle2, LogOut, Send, BadgeCheck, Users } from 'lucide-react';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { notifyNewBadges } from '../lib/badges';
import { formatClock, optionLetter } from '../lib/arena';
import { useCountdown } from '../hooks/useCountdown';
import { useLiteMode } from '../hooks/use-lite-mode';

const LOW_TIME_SECONDS = 15;
const DEFAULT_LIMIT_SECONDS = 90;

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

// Screen readers only hear the clock at these moments, not on every tick.
const timerAnnouncement = (remaining) => {
  if (remaining <= 0) return "Time's up.";
  if (remaining <= 10) return '10 seconds left.';
  if (remaining <= 30) return '30 seconds left.';
  return '';
};

export const ArenaPlay = ({ challenge, onFinish, onExit }) => {
  const { API } = useContext(AuthContext);
  const { lite } = useLiteMode();
  const [step, setStep] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const submittingRef = useRef(false);

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
    toast.info("Time's up — submitting what you have");
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
  const ClockIcon = lowTime ? AlarmClock : Clock;

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8" data-testid="arena-play">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-white/90 backdrop-blur-sm shadow-lg mb-6 sticky top-16 z-30" data-testid="arena-play-header">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge className={subjectBadgeColor(challenge.subject)}>
                    {subjectEmoji(challenge.subject)} {challenge.subject}
                  </Badge>
                  {challenge.source === 'peer' ? (
                    <Badge variant="outline" className="gap-1">
                      <Users className="w-3 h-3" aria-hidden="true" /> by {challenge.author_name || 'a classmate'}
                    </Badge>
                  ) : (
                    <Badge className="bg-teal-100 text-teal-800 gap-1">
                      <BadgeCheck className="w-3 h-3" aria-hidden="true" /> Official
                    </Badge>
                  )}
                </div>
                <h1 className="text-base sm:text-xl font-bold text-gray-900 break-words" data-testid="arena-play-title">
                  {challenge.title}
                </h1>
              </div>
              <Badge
                className={`shrink-0 text-base px-3 py-1 gap-1 tabular-nums ${
                  lowTime
                    ? `bg-rose-100 text-rose-800 border-rose-300 ${lite ? '' : 'animate-pulse'}`
                    : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                }`}
                data-testid="arena-timer"
              >
                <ClockIcon className="w-4 h-4" aria-hidden="true" />
                <span className="sr-only">Time left: </span>
                {formatClock(remaining)}
                {lowTime && <span className="sr-only"> — time almost up</span>}
              </Badge>
            </div>
            <Progress
              value={pct}
              className={`h-3 ${lowTime ? 'bg-rose-100 [&>div]:bg-rose-500' : 'bg-emerald-100 [&>div]:bg-emerald-500'}`}
              aria-label="Time remaining"
              getValueLabel={() => `${remaining} seconds left`}
              data-testid="arena-timer-progress"
            />
            <p className="sr-only" aria-live="polite" data-testid="arena-timer-announcement">
              {timerAnnouncement(remaining)}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm mb-6" data-testid="arena-problem-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-900">The problem</CardTitle>
            <p className="text-sm text-gray-600">
              Someone worked through this problem and one step of their reasoning is broken. Find it.
            </p>
          </CardHeader>
          <CardContent>
            <p className={`whitespace-pre-wrap break-words text-gray-800 ${textFont}`} data-testid="arena-problem">
              {challenge.problem}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm mb-6" data-testid="arena-steps-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-900 flex items-center gap-2" id="arena-step-heading">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-600 text-white text-sm" aria-hidden="true">1</span>
              Which step is wrong?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div role="group" aria-labelledby="arena-step-heading" className="space-y-2">
              {steps.map((text, i) => {
                const selected = step === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setStep(i)}
                    aria-pressed={selected}
                    disabled={submitting || finished}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-colors ${focusRing} disabled:opacity-70 ${
                      selected
                        ? 'border-rose-500 bg-rose-50 text-rose-900'
                        : 'border-gray-200 bg-white hover:border-rose-200 hover:bg-rose-50/50'
                    }`}
                    data-testid={`arena-step-${i}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${
                          selected ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                        aria-hidden="true"
                      >
                        {selected ? <Bug className="w-4 h-4" /> : i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">Step {i + 1}: </span>
                        <span className={`whitespace-pre-wrap break-words ${textFont}`}>{text}</span>
                        {selected && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-rose-700">
                            <Bug className="w-3 h-3" aria-hidden="true" /> Bug here
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card
          className={`bg-white/80 backdrop-blur-sm mb-6 transition-opacity ${step === null ? 'opacity-75' : ''}`}
          data-testid="arena-explanations-card"
        >
          <CardHeader className="pb-2">
            <CardTitle
              className={`text-lg flex items-center gap-2 ${step === null ? 'text-gray-600' : 'text-gray-900'}`}
              id="arena-explanation-heading"
            >
              <span
                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-white text-sm ${
                  step === null ? 'bg-gray-400' : 'bg-teal-600'
                }`}
                aria-hidden="true"
              >
                2
              </span>
              Why is it wrong?
            </CardTitle>
            {step === null && (
              <p className="text-sm text-gray-500">Pick the broken step first, then name the concept it breaks.</p>
            )}
          </CardHeader>
          <CardContent>
            <div role="group" aria-labelledby="arena-explanation-heading" className="space-y-2">
              {explanations.map((text, i) => {
                const selected = explanation === text;
                return (
                  <button
                    key={text}
                    type="button"
                    onClick={() => setExplanation(text)}
                    aria-pressed={selected}
                    disabled={submitting || finished}
                    className={`w-full text-left p-3 sm:p-4 rounded-lg border-2 transition-colors ${focusRing} disabled:opacity-70 ${
                      selected
                        ? 'border-teal-500 bg-teal-50 text-teal-900'
                        : 'border-gray-200 bg-white hover:border-teal-200 hover:bg-teal-50/50'
                    }`}
                    data-testid={`arena-explanation-${i}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${
                          selected ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                        aria-hidden="true"
                      >
                        {selected ? <CheckCircle2 className="w-4 h-4" /> : optionLetter(i)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="sr-only">Option {optionLetter(i)}: </span>
                        <span className="whitespace-pre-wrap break-words">{text}</span>
                        {selected && (
                          <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-teal-700">
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Your diagnosis
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          <Button
            variant="outline"
            onClick={onExit}
            disabled={submitting}
            className={focusRing}
            data-testid="exit-arena-btn"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" /> Exit
          </Button>
          <div className="flex flex-col sm:items-end gap-1">
            <Button
              onClick={submit}
              disabled={!canSubmit}
              aria-describedby={!ready && !expired ? 'arena-submit-hint' : undefined}
              className={`bg-rose-600 hover:bg-rose-700 text-white ${focusRing}`}
              data-testid="submit-arena-btn"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
              {submitting ? 'Submitting…' : expired && !ready ? 'Submit what I have' : 'Submit diagnosis'}
            </Button>
            {!ready && !expired && (
              <p id="arena-submit-hint" className="text-xs text-gray-500 text-center sm:text-right">
                Pick a step and an explanation to submit.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArenaPlay;
