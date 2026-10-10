import React, { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { subjectBadgeColor, subjectEmoji, formatApiError } from '../lib/steam';
import { FLAG_REASONS, formatClock, ratePercent, stepLabel, optionLetter } from '../lib/arena';
import {
  ClipboardCheck, AlertTriangle, Bug, Check, Clock, Flag, Users, Lightbulb, Undo2, Inbox, RefreshCw,
} from 'lucide-react';

// needs_review_reasons is a set; scenarios flagged before it existed were low find-rate ones
const reviewReasonText = (reasons) => {
  const list = reasons && reasons.length ? reasons : ['low_rate'];
  const parts = [];
  if (list.includes('low_rate')) parts.push('Fewer than 20% of solvers found the bug — check the answer key');
  if (list.includes('reports')) parts.push('Students outside your class reported it — read the reports below');
  return parts.join('. ');
};

const STATUS_FILTERS = [
  { value: 'queue', label: 'Needs attention' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Sent back' },
  { value: 'all', label: 'All' },
];

const NOTE_MIN = 3;
const NOTE_MAX = 300;

const STATUS_BADGES = {
  pending: { label: 'Pending', className: 'bg-amber-100 text-amber-900' },
  approved: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Sent back', className: 'bg-rose-100 text-rose-800' },
  withdrawn: { label: 'Withdrawn', className: 'bg-gray-200 text-gray-700' },
};

const REASON_BADGES = {
  new: { label: 'New', className: 'bg-sky-100 text-sky-800' },
  edited: { label: 'Edited', className: 'bg-violet-100 text-violet-800' },
  flagged: { label: 'Reported', className: 'bg-red-100 text-red-800' },
};

const flagReasonLabel = (reason) => FLAG_REASONS.find((r) => r.value === reason)?.label || reason;

// Only these states accept a review; anything else would 409
const isReviewable = (s) => s.status === 'pending' || (s.status === 'approved' && s.needs_review);

const settledLine = (s) => {
  if (s.status === 'approved') {
    return `Approved — playable by ${s.visibility === 'public' ? 'everyone' : 'your class'}.`;
  }
  if (s.status === 'rejected') return 'Sent back — waiting for the author to edit and resubmit.';
  if (s.status === 'withdrawn') return 'Withdrawn by the author.';
  return null;
};

const ScenarioItem = ({ s, verified, onReviewed, API }) => {
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState(verified && s.visibility === 'public' ? 'public' : 'class');
  const [busy, setBusy] = useState(null);

  const trimmed = note.trim();
  const noteOk = trimmed.length >= NOTE_MIN && trimmed.length <= NOTE_MAX;
  const reviewable = isReviewable(s);
  const status = STATUS_BADGES[s.status];
  const reason = s.status === 'pending' ? REASON_BADGES[s.review_reason] : null;
  const findRate = ratePercent(s.find_rate);
  const solvers = s.stats?.solvers ?? 0;
  const flags = s.open_flags || [];
  const noteId = `review-note-${s.id}`;
  const noteHintId = `review-note-hint-${s.id}`;
  const visId = `review-visibility-${s.id}`;
  const visHintId = `review-visibility-hint-${s.id}`;

  const submit = async (decision) => {
    if (decision === 'reject' && !noteOk) {
      toast.error(`Tell ${s.author_name || 'the author'} what to fix (${NOTE_MIN}–${NOTE_MAX} characters).`);
      return;
    }
    setBusy(decision);
    try {
      await axios.post(`${API}/teacher/arena/${s.id}/review`, {
        decision,
        note: trimmed.slice(0, NOTE_MAX),
        visibility,
        // the version on screen: if the author edits it meanwhile, the server refuses and we reload
        revision: s.revisions ?? 0,
      });
      if (decision === 'approve') {
        const who = visibility === 'public' ? 'everyone' : 'your class';
        toast.success(`"${s.title}" approved for ${who}.${s.approval_rewarded ? '' : ` ${s.author_name || 'The author'} earns +30 points.`}`);
      } else {
        toast.success(`Sent "${s.title}" back to ${s.author_name || 'the author'} with your note.`);
      }
      setNote('');
      onReviewed();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
      if (e.response?.status === 409) onReviewed();
    } finally {
      setBusy(null);
    }
  };

  return (
    <article
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      aria-labelledby={`review-title-${s.id}`}
      data-testid={`review-item-${s.id}`}
    >
      {/* Header */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id={`review-title-${s.id}`} className="break-words text-base font-semibold text-gray-900">{s.title}</h3>
          <p className="text-sm text-gray-600">by {s.author_name || 'a student'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={`${subjectBadgeColor(s.subject)} border-transparent shadow-none`}>
            <span aria-hidden="true" className="mr-1">{subjectEmoji(s.subject)}</span>{s.subject}
          </Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span className="sr-only">Time limit</span>{formatClock(s.time_limit_seconds)}
          </Badge>
          {status && <Badge className={`${status.className} border-transparent shadow-none`}>{status.label}</Badge>}
          {reason && (
            <Badge className={`${reason.className} gap-1 border-transparent shadow-none`} data-testid={`review-reason-${s.id}`}>
              {s.review_reason === 'flagged' && <Flag className="h-3 w-3" aria-hidden="true" />}
              {reason.label}
            </Badge>
          )}
          {s.revisions > 0 && (
            <Badge variant="outline" className="font-normal">
              Revised {s.revisions}×
            </Badge>
          )}
        </div>
      </div>

      {s.needs_review && (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900" data-testid={`review-needs-check-${s.id}`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {reviewReasonText(s.needs_review_reasons)}
        </p>
      )}

      {flags.length > 0 && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900" data-testid={`review-flags-${s.id}`}>
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <Flag className="h-4 w-4" aria-hidden="true" />
            {flags.length} open {flags.length === 1 ? 'report' : 'reports'}
          </p>
          <ul className="space-y-1">
            {flags.map((f) => (
              <li key={f.id} className="break-words">
                <span className="font-medium">{f.user_name}</span>: {flagReasonLabel(f.reason)}
                {f.note ? <span className="text-red-800"> — “{f.note}”</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Scenario content */}
      <div className="space-y-3 text-sm text-gray-800">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Problem</h4>
          <p className="whitespace-pre-wrap break-words">{s.problem}</p>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Worked solution</h4>
          <ol className="space-y-1.5">
            {(s.steps || []).map((step, i) => {
              const flawed = i === s.flawed_step;
              return (
                <li
                  key={i}
                  className={`rounded-md border p-2 ${flawed ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}
                  data-testid={flawed ? `review-flawed-step-${s.id}` : undefined}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">{stepLabel(i)}</span>
                    {flawed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                        <Bug className="h-3.5 w-3.5" aria-hidden="true" />
                        Marked as the bug
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap break-words">{step}</p>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Explanations</h4>
          <ul className="space-y-1.5">
            {(s.explanations || []).map((text, i) => {
              const correct = text === s.correct_explanation;
              return (
                <li
                  key={i}
                  className={`flex items-start gap-2 rounded-md border p-2 ${correct ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'}`}
                  data-testid={correct ? `review-correct-explanation-${s.id}` : undefined}
                >
                  <span className="text-xs font-semibold text-gray-600">{optionLetter(i)}.</span>
                  <span className="min-w-0 flex-1 break-words">
                    {text}
                    {correct && (
                      <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Correct
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="flex items-start gap-2 rounded-md bg-teal-50 p-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
          <span>
            <span className="font-semibold">Misconception:</span>{' '}
            {s.misconception_info?.description || s.misconception}
          </span>
        </p>

        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">Debrief</h4>
          <p className="whitespace-pre-wrap break-words">{s.debrief}</p>
        </div>

        <p className="flex items-center gap-2 text-xs text-gray-600" data-testid={`review-stats-${s.id}`}>
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          {solvers} {solvers === 1 ? 'solver' : 'solvers'}
          {' · '}
          {findRate == null ? 'no find rate yet' : `${findRate}% found the bug`}
        </p>

        {s.review && (
          <p className="rounded-md bg-gray-50 p-2 text-xs text-gray-700">
            Last review by {s.review.by_name || 'a teacher'}: {s.review.decision === 'approve' ? 'approved' : 'sent back'}
            {s.review.note ? ` — “${s.review.note}”` : ''}
          </p>
        )}
      </div>

      {/* Actions */}
      {reviewable ? (
        <div className="mt-4 space-y-3 border-t border-gray-200 pt-4">
          <div className="space-y-1.5">
            <Label htmlFor={noteId}>Note to {s.author_name || 'the author'}</Label>
            <Textarea
              id={noteId}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder="What should they fix? (needed to send it back)"
              aria-describedby={noteHintId}
              data-testid={`review-note-${s.id}`}
            />
            <p id={noteHintId} className="text-xs text-gray-500">
              Required to send back ({NOTE_MIN}–{NOTE_MAX} characters), optional when approving · {note.length}/{NOTE_MAX}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1.5 sm:w-56">
              <Label htmlFor={visId}>Who can play it</Label>
              <Select value={visibility} onValueChange={setVisibility}>
                <SelectTrigger id={visId} aria-describedby={verified ? undefined : visHintId} data-testid={`review-visibility-${s.id}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="class">My class</SelectItem>
                  <SelectItem value="public" disabled={!verified}>Everyone{verified ? '' : ' (verified teachers)'}</SelectItem>
                </SelectContent>
              </Select>
              {!verified && (
                <p id={visHintId} className="text-xs text-gray-500">
                  Get verified to publish students' scenarios to everyone.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => submit('approve')}
                disabled={busy !== null}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid={`approve-scenario-${s.id}`}
              >
                <Check aria-hidden="true" />
                {busy === 'approve' ? 'Approving…' : 'Approve'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => submit('reject')}
                disabled={busy !== null || !noteOk}
                className="border-rose-500 text-rose-700 hover:bg-rose-50"
                aria-describedby={noteHintId}
                data-testid={`reject-scenario-${s.id}`}
              >
                <Undo2 aria-hidden="true" />
                {busy === 'reject' ? 'Sending…' : 'Send back'}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        settledLine(s) && (
          <p className="mt-4 border-t border-gray-200 pt-3 text-sm text-gray-600" data-testid={`review-settled-${s.id}`}>
            {settledLine(s)}
          </p>
        )
      )}
    </article>
  );
};

export const ScenarioReviewQueue = () => {
  const { user, API } = useContext(AuthContext);
  const [status, setStatus] = useState('queue');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/arena/review`, { params: { status } });
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [API, status]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const counts = data?.counts || { pending: 0, flagged: 0, needs_review: 0 };
  const scenarios = data?.scenarios || [];
  const filterLabel = STATUS_FILTERS.find((f) => f.value === status)?.label || '';

  return (
    <Card className="bg-white/80 backdrop-blur-sm" data-testid="review-queue-card" aria-busy={loading}>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
              <ClipboardCheck className="h-6 w-6 text-emerald-600" aria-hidden="true" />
              Student scenarios
            </CardTitle>
            <CardDescription className="mt-1">
              Debug Arena scenarios your students wrote. Nobody plays one until you approve it — the author earns +30
              points the first time.
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-1.5" data-testid="review-counts">
              <Badge className="border-transparent bg-amber-100 text-amber-900 shadow-none" data-testid="review-count-pending">
                {counts.pending} pending
              </Badge>
              <Badge className="gap-1 border-transparent bg-red-100 text-red-800 shadow-none" data-testid="review-count-flagged">
                <Flag className="h-3 w-3" aria-hidden="true" />
                {counts.flagged} reported
              </Badge>
              <Badge className="gap-1 border-transparent bg-orange-100 text-orange-900 shadow-none" data-testid="review-count-needs-review">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {counts.needs_review} to re-check
              </Badge>
            </div>
          </div>
          <div className="space-y-1.5 sm:w-52">
            <Label htmlFor="review-status-select">Show</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="review-status-select" data-testid="review-status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
        {error && !loading ? (
          <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between" data-testid="review-error">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Couldn't load student scenarios. {error}</span>
            </p>
            <Button type="button" size="sm" variant="outline" onClick={fetchQueue} data-testid="review-retry-btn">
              <RefreshCw aria-hidden="true" />
              Try again
            </Button>
          </div>
        ) : !data ? (
          <p className="text-sm text-gray-500" role="status">Loading scenarios…</p>
        ) : scenarios.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-gray-500" data-testid="review-empty">
            <Inbox className="h-8 w-8 text-gray-300" aria-hidden="true" />
            <p>
              {status === 'queue'
                ? 'No scenarios waiting — students can write one from the Debug Arena.'
                : `No scenarios in "${filterLabel}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="review-list">
            {scenarios.map((s) => (
              <ScenarioItem key={`${s.id}-${s.updated_at}`} s={s} verified={Boolean(user?.verified)} onReviewed={fetchQueue} API={API} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
