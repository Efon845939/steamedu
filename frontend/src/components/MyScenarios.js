import React, { useState, useEffect, useContext, useCallback } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from './ui/alert-dialog';
import axios from 'axios';
import { toast } from 'sonner';
import {
  PenLine, Plus, Clock, CheckCircle2, Undo2, Archive, Flag, Pencil, Trash2, Users, Target, Star,
  AlertTriangle, KeyRound, ChevronDown, GraduationCap, Bug, Scale, Globe, School, MessageSquare,
} from 'lucide-react';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { stepLabel, ratePercent } from '../lib/arena';
import { ScenarioBuilder } from './ScenarioBuilder';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

// Outline variant + explicit colours: the default badge variant darkens on hover.
const STATUS_META = {
  pending: { label: 'Waiting for review', Icon: Clock, className: 'border-amber-200 bg-amber-100 text-amber-900' },
  approved: { label: 'Live', Icon: CheckCircle2, className: 'border-emerald-200 bg-emerald-100 text-emerald-900' },
  rejected: { label: 'Sent back', Icon: Undo2, className: 'border-rose-200 bg-rose-100 text-rose-900' },
  withdrawn: { label: 'Withdrawn', Icon: Archive, className: 'border-gray-200 bg-gray-100 text-gray-700' },
};

const statusInfo = (s) => {
  if (s.status === 'pending' && s.review_reason === 'flagged') {
    return { ...STATUS_META.pending, label: 'Reported by classmates — waiting for teacher', Icon: Flag };
  }
  if (s.status === 'pending' && s.review_reason === 'edited') {
    return { ...STATUS_META.pending, label: 'Updated — waiting for review' };
  }
  return STATUS_META[s.status] || STATUS_META.pending;
};

const POINT_RULES = [
  { Icon: CheckCircle2, points: '+30', text: 'when your teacher approves your scenario.' },
  { Icon: Users, points: '+5', text: 'for every classmate who tries it (up to 20 classmates).' },
  {
    Icon: Scale,
    points: '+50',
    text: 'once, when at least 5 classmates have tried it and 20–80% of them find the bug — tough but fair.',
  },
  {
    Icon: AlertTriangle,
    points: '+0',
    text: 'extra for a scenario almost nobody can solve (under 20% find the bug) — your teacher is asked to re-check it.',
  },
];

const PointsExplainer = () => (
  <Card className="bg-white/80 backdrop-blur-sm" data-testid="scenario-points-explainer">
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Star className="w-4 h-4 text-amber-500" aria-hidden="true" /> How you earn points
      </CardTitle>
    </CardHeader>
    <CardContent>
      <ul className="space-y-2 text-sm text-gray-700">
        {POINT_RULES.map(({ Icon, points, text }) => (
          <li key={points} className="flex items-start gap-2">
            <Icon className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
            <span>
              <span className="font-semibold text-gray-900">{points}</span> {text}
            </span>
          </li>
        ))}
      </ul>
    </CardContent>
  </Card>
);

const Stat = ({ Icon, label, value, testId }) => (
  <div className="rounded-lg bg-gray-50 p-2 text-center min-w-0">
    <dt className="text-xs text-gray-600 flex items-center justify-center gap-1">
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> {label}
    </dt>
    <dd className="text-lg font-bold text-gray-900 tabular-nums" data-testid={testId}>{value}</dd>
  </div>
);

const AnswerKey = ({ scenario: s }) => {
  const [open, setOpen] = useState(false);
  const flawedText = Number.isInteger(s.flawed_step) ? s.steps?.[s.flawed_step] : null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`px-2 text-gray-700 ${focusRing}`}
          data-testid={`answer-key-toggle-${s.id}`}
        >
          <KeyRound className="w-4 h-4 mr-1" aria-hidden="true" />
          {open ? 'Hide answer key' : 'Show answer key'}
          <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="mt-2 space-y-3 rounded-lg border border-gray-200 bg-white p-3 text-sm" data-testid={`answer-key-${s.id}`}>
          <div>
            <dt className="text-xs font-semibold text-rose-800 flex items-center gap-1">
              <Bug className="w-3.5 h-3.5" aria-hidden="true" /> The wrong step
            </dt>
            <dd className="mt-0.5 text-gray-800 break-words">
              {Number.isInteger(s.flawed_step) ? `${stepLabel(s.flawed_step)}: ` : ''}{flawedText || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-emerald-800 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> The right explanation
            </dt>
            <dd className="mt-0.5 text-gray-800 break-words">{s.correct_explanation || '—'}</dd>
          </div>
          {s.debrief && (
            <div>
              <dt className="text-xs font-semibold text-gray-700">Debrief</dt>
              <dd className="mt-0.5 text-gray-800 whitespace-pre-line break-words">{s.debrief}</dd>
            </div>
          )}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  );
};

const ScenarioCard = ({ scenario: s, onEdit, onWithdraw, editBlockedReason }) => {
  const status = statusInfo(s);
  const StatusIcon = status.Icon;
  const stats = s.stats || {};
  const solvers = stats.solvers || 0;
  const showStats = s.status === 'approved' || solvers > 0;
  const findRate = ratePercent(s.find_rate);
  const canEdit = s.status === 'pending' || s.status === 'rejected';
  const editBlocked = s.status === 'rejected' ? editBlockedReason : null;
  const canWithdraw = s.status !== 'withdrawn';
  const hintId = `edit-blocked-${s.id}`;

  return (
    <Card className="bg-white/80 backdrop-blur-sm flex flex-col min-w-0" data-testid={`my-scenario-${s.id}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge variant="outline" className={`gap-1 ${status.className}`} data-testid={`scenario-status-${s.id}`}>
            <StatusIcon className="w-3 h-3 shrink-0" aria-hidden="true" /> {status.label}
          </Badge>
          {s.status === 'approved' && (
            <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-900">
              {s.visibility === 'public' ? (
                <><Globe className="w-3 h-3" aria-hidden="true" /> Everyone</>
              ) : (
                <><School className="w-3 h-3" aria-hidden="true" /> Class</>
              )}
            </Badge>
          )}
          <Badge className={subjectBadgeColor(s.subject)}>{subjectEmoji(s.subject)} {s.subject}</Badge>
          {s.calibrated && (
            <Badge variant="outline" className="gap-1 border-sky-200 bg-sky-50 text-sky-900" data-testid={`scenario-calibrated-${s.id}`}>
              <Scale className="w-3 h-3" aria-hidden="true" /> Calibrated ✓
              <span className="sr-only">: tough but fair</span>
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg break-words">{s.title}</CardTitle>
        <CardDescription className="line-clamp-2 break-words">{s.problem}</CardDescription>
        <p className="text-xs text-gray-500 flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
          <span>{(s.steps || []).length} steps</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" /> {s.time_limit_seconds}s
          </span>
          {s.created_at && <span>Written {new Date(s.created_at).toLocaleDateString()}</span>}
        </p>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 flex flex-col">
        {s.status === 'rejected' && s.review?.note && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" data-testid={`scenario-review-note-${s.id}`}>
            <p className="font-semibold flex items-center gap-1">
              <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
              Note from {s.review.by_name || 'your teacher'}
            </p>
            <p className="mt-1 whitespace-pre-line break-words">{s.review.note}</p>
          </div>
        )}

        {s.status === 'pending' && s.review_reason === 'flagged' && (
          <p className="text-xs text-amber-900 flex items-start gap-1">
            <Flag className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
            Classmates reported a problem, so it's hidden until your teacher checks it again.
          </p>
        )}

        {showStats && (
          <dl className="grid grid-cols-3 gap-2" aria-label="How classmates did">
            <Stat Icon={Users} label="Tried it" value={solvers} testId={`scenario-solvers-${s.id}`} />
            <Stat
              Icon={Target}
              label="Found the bug"
              value={findRate == null ? '—' : `${findRate}%`}
              testId={`scenario-find-rate-${s.id}`}
            />
            <Stat Icon={Star} label="Your points" value={stats.author_points || 0} testId={`scenario-points-${s.id}`} />
          </dl>
        )}

        {s.needs_review && (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 flex items-start gap-1"
            data-testid={`scenario-needs-review-${s.id}`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
            {(s.needs_review_reasons || []).includes('reports') && !(s.needs_review_reasons || []).includes('low_rate')
              ? 'Someone reported a possible problem, so your teacher has been asked to take another look. It stays visible meanwhile.'
              : "Fewer than 1 in 5 classmates found the bug, so your teacher has been asked to double-check it. Scenarios that are almost impossible to solve don't earn the bonus."}
          </p>
        )}

        <AnswerKey scenario={s} />

        {(canEdit || canWithdraw) && (
          <div className="mt-auto pt-2 space-y-2">
            <div className="flex flex-wrap gap-2">
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onEdit(s)}
                  disabled={Boolean(editBlocked)}
                  aria-describedby={editBlocked ? hintId : undefined}
                  className={focusRing}
                  data-testid={`edit-scenario-${s.id}`}
                >
                  <Pencil className="w-4 h-4 mr-1" aria-hidden="true" /> Edit &amp; resubmit
                </Button>
              )}
              {canWithdraw && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onWithdraw(s)}
                  className={`text-rose-700 hover:bg-rose-50 hover:text-rose-800 ${focusRing}`}
                  data-testid={`withdraw-scenario-${s.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-1" aria-hidden="true" /> Withdraw
                </Button>
              )}
            </div>
            {editBlocked && <p id={hintId} className="text-xs text-gray-600">{editBlocked}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const MyScenarios = () => {
  const { user, API } = useContext(AuthContext);
  const isStudent = user?.role === 'student';
  const hasTeacher = Boolean(user?.teacher_id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  // The target outlives the dialog's open state so its text doesn't change during the close animation
  const [withdrawing, setWithdrawing] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const fetchMine = useCallback(async () => {
    if (!isStudent || !hasTeacher) {
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/arena/peer/mine`);
      setData(res.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [API, isStudent, hasTeacher]);

  useEffect(() => {
    fetchMine();
  }, [fetchMine]);

  const openNew = () => {
    setEditing(null);
    setBuilderOpen(true);
  };

  const openEdit = (scenario) => {
    setEditing(scenario);
    setBuilderOpen(true);
  };

  const askWithdraw = (scenario) => {
    setWithdrawing(scenario);
    setWithdrawOpen(true);
  };

  const confirmWithdraw = async () => {
    const target = withdrawing;
    setWithdrawOpen(false);
    if (!target) return;
    try {
      const res = await axios.delete(`${API}/arena/peer/${target.id}`);
      toast.success(res.data?.deleted
        ? `"${target.title}" was deleted`
        : `"${target.title}" was withdrawn — classmates won't see it anymore`);
      fetchMine();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (!isStudent) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm max-w-xl mx-auto" data-testid="my-scenarios-teacher">
        <CardContent className="py-8 text-center text-gray-600">
          Students write scenarios here. You review them from your dashboard.
        </CardContent>
      </Card>
    );
  }

  if (!hasTeacher) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm max-w-xl mx-auto" data-testid="my-scenarios-no-teacher">
        <CardHeader className="text-center">
          <GraduationCap className="w-10 h-10 mx-auto text-emerald-600 mb-2" aria-hidden="true" />
          <CardTitle className="text-xl">Join a class to write scenarios</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-gray-600">
          Ask your teacher to add you to their class — they review scenarios before classmates can play them.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading your scenarios" data-testid="my-scenarios-loading">
        <div className="spinner" />
      </div>
    );
  }

  const scenarios = data?.scenarios || [];
  const limits = data?.limits;
  let blockReason = null;
  if (limits && limits.pending >= limits.max_pending) {
    blockReason = `You have ${limits.pending} scenarios waiting for review (the limit is ${limits.max_pending}). `
      + 'Write the next one after your teacher reviews one.';
  } else if (limits && limits.today >= limits.daily_limit) {
    blockReason = `You've written ${limits.daily_limit} scenarios in the last 24 hours — try again tomorrow.`;
  }
  const editBlockedReason = limits && limits.pending >= limits.max_pending
    ? `You can resubmit this once fewer than ${limits.max_pending} of your scenarios are waiting for review.`
    : null;
  const withdrawTried = (withdrawing?.stats?.solvers || 0) > 0;

  return (
    <div className="space-y-6" data-testid="my-scenarios">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PenLine className="w-6 h-6 text-emerald-600" aria-hidden="true" /> My scenarios
          </h2>
          <p className="text-gray-600 mt-1">
            Hide one bug in a worked solution. Once your teacher approves it, classmates try to find it.
          </p>
          {limits && (
            <p className="text-xs text-gray-500 mt-1" data-testid="scenario-limits">
              {limits.pending}/{limits.max_pending} waiting for review · {limits.today}/{limits.daily_limit} written
              in the last 24 hours
            </p>
          )}
        </div>
        <div className="sm:text-right shrink-0">
          <Button
            type="button"
            onClick={openNew}
            disabled={Boolean(blockReason)}
            aria-describedby={blockReason ? 'write-scenario-blocked' : undefined}
            className={`w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 ${focusRing}`}
            data-testid="write-scenario-btn"
          >
            <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Write a scenario
          </Button>
          {blockReason && (
            <p id="write-scenario-blocked" className="text-xs text-amber-900 mt-2 sm:max-w-xs" data-testid="write-scenario-blocked">
              {blockReason}
            </p>
          )}
        </div>
      </div>

      <PointsExplainer />

      {scenarios.length === 0 ? (
        <Card className="bg-white/80 backdrop-blur-sm max-w-md mx-auto" data-testid="my-scenarios-empty">
          <CardHeader className="text-center">
            <div className="text-5xl mb-2" aria-hidden="true">🐞</div>
            <CardTitle className="text-xl">No scenarios yet</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-gray-600">
            Think of a mistake people often make in a subject you like. Write a solution that makes it — then see
            who in your class can spot it.
          </CardContent>
        </Card>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6" data-testid="my-scenarios-list">
          {scenarios.map((s) => (
            <ScenarioCard
              key={s.id}
              scenario={s}
              onEdit={openEdit}
              onWithdraw={askWithdraw}
              editBlockedReason={editBlockedReason}
            />
          ))}
        </div>
      )}

      <ScenarioBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        initial={editing}
        onSaved={fetchMine}
      />

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent data-testid="withdraw-scenario-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words">Withdraw “{withdrawing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              {withdrawTried
                ? "Classmates won't see it anymore. Because some of them already tried it, it stays in your list as "
                  + "withdrawn so your teacher's class insights stay accurate."
                : 'It will be deleted for good. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={focusRing} data-testid="cancel-withdraw-btn">Keep it</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmWithdraw}
              className={`bg-rose-600 hover:bg-rose-700 ${focusRing}`}
              data-testid="confirm-withdraw-btn"
            >
              Withdraw
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
