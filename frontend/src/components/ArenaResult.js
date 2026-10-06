import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Bug, CheckCircle2, XCircle, AlertTriangle, Lightbulb, Flag, ArrowRight, ArrowLeft, LayoutDashboard, Users, Target,
} from 'lucide-react';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { scoreTier, stepLabel, ratePercent, FLAG_REASONS, FLAG_NOTE_MAX } from '../lib/arena';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

const CheckRow = ({ ok, okText, failText, testId }) => (
  <li
    className={`flex items-start gap-3 p-3 rounded-lg border ${
      ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
    }`}
    data-testid={testId}
  >
    {ok ? (
      <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
    ) : (
      <XCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
    )}
    <span>
      <span className="sr-only">{ok ? 'Correct: ' : 'Not quite: '}</span>
      {ok ? okText : failText}
    </span>
  </li>
);

const RatingBadge = ({ rating }) => {
  const delta = rating.delta || 0;
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '±';
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged,';
  const color = delta > 0
    ? 'bg-emerald-100 text-emerald-800'
    : delta < 0 ? 'bg-rose-100 text-rose-800' : 'bg-gray-100 text-gray-800';
  return (
    <Badge className={`text-base px-4 py-2 ${color}`} data-testid="arena-rating">
      Debugger rating {rating.after}{' '}
      <span aria-hidden="true">({arrow}{Math.abs(delta)})</span>
      <span className="sr-only">({direction} {Math.abs(delta)})</span>
    </Badge>
  );
};

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
        toast.success('Thanks for the report — the scenario has been taken down until your teacher reviews it.');
      } else {
        toast.success('Thanks for the report — your teacher will take a look.');
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
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg rounded-lg" data-testid="flag-scenario-dialog">
        <DialogHeader>
          <DialogTitle>Report a problem</DialogTitle>
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
            <p id="flag-note-count" className="text-xs text-gray-500 text-right">
              {note.length}/{FLAG_NOTE_MAX}
            </p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="flag-cancel-btn">
            Cancel
          </Button>
          <Button
            onClick={send}
            disabled={!reason || sending}
            className="bg-rose-600 hover:bg-rose-700 text-white"
            data-testid="flag-submit-btn"
          >
            {sending ? 'Sending…' : 'Send report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const ArenaResult = ({ challenge, result, onNext, onBack }) => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
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

  const stepFailText = picked == null
    ? `You didn't pick a step. The bug was in ${stepLabel(flawed)}.`
    : `You picked ${stepLabel(picked)}, but the bug was in ${stepLabel(flawed)}.`;
  const conceptFailText = result.selected_explanation == null
    ? "You didn't pick an explanation."
    : 'Your explanation didn’t match the concept this step breaks.';

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8" data-testid="arena-result">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="flex flex-wrap justify-center gap-2 mb-2">
              <Badge className={subjectBadgeColor(challenge.subject)}>
                {subjectEmoji(challenge.subject)} {challenge.subject}
              </Badge>
              {isPeer && (
                <Badge variant="outline" className="gap-1" data-testid="arena-result-author">
                  <Users className="w-3 h-3" aria-hidden="true" /> by {result.author_name || challenge.author_name || 'a classmate'}
                </Badge>
              )}
            </div>
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl sm:text-3xl font-bold text-gray-900 break-words focus:outline-none"
              data-testid="arena-result-title"
            >
              Diagnosis: {challenge.title}
            </h1>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center space-y-3">
              <div className="text-5xl sm:text-6xl font-bold text-gray-900 tabular-nums" data-testid="arena-score">
                {result.score}/100
              </div>
              <Badge className={`text-base px-4 py-1 ${tier.className}`} data-testid="arena-score-tier">
                {result.score >= 100 ? '🐞 ' : ''}{tier.label}
              </Badge>
            </div>

            <ul className="grid gap-3 sm:grid-cols-2" aria-label="How you did">
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

            <div className="flex flex-wrap justify-center gap-3">
              <Badge className="text-base px-4 py-2 bg-yellow-100 text-yellow-800" data-testid="arena-points-earned">
                ⭐ +{result.points_earned || 0} points
              </Badge>
              <Badge className="text-base px-4 py-2 bg-orange-100 text-orange-800" data-testid="arena-streak">
                🔥 {result.streak_days || 0}-day streak
              </Badge>
              {result.rating && <RatingBadge rating={result.rating} />}
            </div>

            {isPeer && (
              <p className="text-center text-sm text-gray-600" data-testid="arena-community">
                {findPct == null || solvers === 0
                  ? 'No classmates have a counted attempt on this one yet.'
                  : `${findPct}% of ${solvers} ${solvers === 1 ? 'classmate' : 'classmates'} found it.`}
              </p>
            )}
            {!result.first_attempt && (
              <p className="text-center text-sm text-gray-500" data-testid="arena-retry-note">
                Points and rating only count on your first attempt.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm" data-testid="arena-result-steps">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-gray-900">The reasoning, debugged</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className={`whitespace-pre-wrap break-words text-gray-700 bg-gray-50 rounded-lg p-3 ${textFont}`}>
              {challenge.problem}
            </p>
            <ol className="space-y-2">
              {steps.map((text, i) => {
                const isBug = i === flawed;
                const isPick = picked === i;
                const wrongPick = isPick && !isBug;
                let style = 'border-gray-200 bg-white';
                if (isBug) style = 'border-rose-500 bg-rose-50';
                else if (wrongPick) style = 'border-amber-400 bg-amber-50';
                return (
                  <li
                    key={i}
                    className={`p-3 rounded-lg border-2 ${style}`}
                    data-testid={`arena-result-step-${i}`}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold ${
                          isBug ? 'bg-rose-600 text-white' : wrongPick ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'
                        }`}
                        aria-hidden="true"
                      >
                        {isBug ? <Bug className="w-4 h-4" /> : i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="sr-only">Step {i + 1}: </span>
                        <span className={`whitespace-pre-wrap break-words text-gray-800 ${textFont}`}>{text}</span>
                        {(isBug || isPick) && (
                          <div className="mt-1 flex flex-wrap gap-2">
                            {isBug && (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700" data-testid="arena-bug-label">
                                <Bug className="w-3 h-3" aria-hidden="true" /> The bug
                              </span>
                            )}
                            {isPick && (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${isBug ? 'text-emerald-700' : 'text-amber-700'}`}
                                data-testid="arena-pick-label"
                              >
                                <Target className="w-3 h-3" aria-hidden="true" /> Your pick
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4" data-testid="arena-correct-explanation">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 mb-1">
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> Why it's wrong
              </p>
              <p className="whitespace-pre-wrap break-words text-emerald-900">{result.correct_explanation}</p>
              {result.selected_explanation && !result.explanation_correct && (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="font-semibold">You picked:</span> {result.selected_explanation}
                </p>
              )}
            </div>

            {result.misconception?.description && (
              <Alert role="note" className="border-rose-300 bg-rose-50 text-rose-900" data-testid="arena-misconception">
                <AlertTriangle className="h-4 w-4 !text-rose-600" aria-hidden="true" />
                <AlertDescription>
                  <span className="font-semibold">The trap:</span> {result.misconception.description}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {result.debrief && (
          <Card className="bg-amber-50 border-amber-200" data-testid="arena-debrief">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg text-amber-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-600" aria-hidden="true" /> Debrief
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-amber-950">{result.debrief}</p>
            </CardContent>
          </Card>
        )}

        {isPeer && user?.role === 'student' && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              onClick={() => setFlagOpen(true)}
              disabled={flagged}
              className={`text-gray-600 ${focusRing}`}
              data-testid="flag-scenario-btn"
            >
              <Flag className="w-4 h-4" aria-hidden="true" /> {flagged ? 'Reported' : 'Report a problem'}
            </Button>
            <FlagDialog
              open={flagOpen}
              onOpenChange={setFlagOpen}
              challenge={challenge}
              onFlagged={() => setFlagged(true)}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={onNext}
            disabled={!onNext}
            className={`bg-emerald-600 hover:bg-emerald-700 ${focusRing}`}
            data-testid="arena-next-btn"
          >
            {onNext ? 'Next challenge' : 'No new challenges left'} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" onClick={onBack} className={focusRing} data-testid="arena-back-btn">
            <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back to Arena
          </Button>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className={focusRing} data-testid="arena-dashboard-btn">
            <LayoutDashboard className="w-4 h-4" aria-hidden="true" /> Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ArenaResult;
