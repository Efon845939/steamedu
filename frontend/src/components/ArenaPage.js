import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRight, Lock, Printer } from 'lucide-react';
import { SUBJECTS, formatApiError } from '../lib/steam';
import { formatClock, SOURCE_FILTERS, ARENA_TABS, lockReason } from '../lib/arena';
import { misconceptionName } from '../lib/misconceptions';
import { cn } from '../lib/utils';
import { SpecimenLabel, StatusWord } from './lab';
import { ArenaPlay } from './ArenaPlay';
import { ArenaResult } from './ArenaResult';
import { MyScenarios } from './MyScenarios';
import { ArenaLeaderboard, TAB_LIST, TAB_TRIGGER, SEG_GROUP, segButton } from './ArenaLeaderboard';

const LINK = 'inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-ink underline-offset-4 hover:underline';

// Best score so far, as a status word: 100 holds, 50 half, 0 missed.
const bestStatus = (score) => {
  const s = Number(score) || 0;
  if (s >= 100) return { status: 'holds', word: 'Solved' };
  if (s >= 50) return { status: 'unsure', word: 'Half solved' };
  return { status: 'wrong', word: 'Missed' };
};

const sourceText = (c) => (c.source === 'peer' ? `By ${c.author_name || 'a classmate'}` : 'Official');

const PageShell = ({ children }) => (
  <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10" data-testid="arena-page">
    {children}
  </div>
);

const ChallengeRow = ({ challenge: c, user, onStart }) => {
  const reason = lockReason(c, user);
  const steps = (c.steps || []).length;
  const best = c.attempted ? bestStatus(c.best_score) : null;
  return (
    <li
      className="grid gap-x-6 gap-y-3 border-b border-rule/60 py-5 last:border-b-0 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto]"
      data-testid={`arena-card-${c.id}`}
    >
      <p className="text-sm font-semibold text-ink-muted sm:pt-0.5">{c.subject}</p>

      <div className="min-w-0">
        <h3 className="break-words text-lg">{c.title}</h3>
        {c.problem && (
          <p className="mt-1 line-clamp-2 break-words text-ink-muted">{c.problem}</p>
        )}
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
          <span className="min-w-0 truncate">{sourceText(c)}</span>
          <span className="tnum">{steps} steps</span>
          <span className="tnum">
            <span className="sr-only">Time limit </span>
            {formatClock(c.time_limit_seconds)}
          </span>
          {c.source === 'peer' && c.solvers != null && (
            <span className="tnum">{c.solvers} {c.solvers === 1 ? 'solver' : 'solvers'}</span>
          )}
          {c.is_mine && (
            <span className="font-semibold text-ink" data-testid={`arena-mine-${c.id}`}>Yours</span>
          )}
        </p>
        {user?.role === 'teacher' && c.misconception?.description && (
          <p
            className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-sm"
            data-testid={`arena-target-${c.id}`}
          >
            <span className="text-ink-muted">Targets</span>
            {c.misconception.tag && <SpecimenLabel name={misconceptionName(c.misconception.tag)} />}
            <span className="min-w-0 break-words text-ink-muted">{c.misconception.description}</span>
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:min-w-[8.5rem] sm:flex-col sm:items-end sm:justify-start">
        {best ? (
          <span className="inline-flex items-center gap-2" data-testid={`arena-best-${c.id}`}>
            <StatusWord status={best.status}>{best.word}</StatusWord>
            <span className="text-sm text-ink-muted tnum">
              <span className="sr-only">best score </span>{c.best_score ?? 0}/100
            </span>
          </span>
        ) : c.can_attempt && user?.role !== 'teacher' ? (
          <StatusWord status="new" />
        ) : (
          <span />
        )}
        <Button
          variant="outline"
          onClick={() => onStart(c)}
          disabled={!c.can_attempt}
          aria-describedby={reason ? `arena-lock-${c.id}` : undefined}
          className="min-w-[7.5rem]"
          data-testid={`start-arena-${c.id}`}
        >
          {!c.can_attempt ? (
            <><Lock aria-hidden="true" /> Locked</>
          ) : c.attempted ? 'Try again' : 'Start'}
        </Button>
        {reason && (
          <p
            id={`arena-lock-${c.id}`}
            className="w-full max-w-[16rem] text-sm text-ink-muted sm:text-right"
            data-testid={`arena-lock-reason-${c.id}`}
          >
            {reason}
          </p>
        )}
      </div>
    </li>
  );
};

const ArenaPage = () => {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher';

  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subject, setSubject] = useState('all');
  const [source, setSource] = useState('all');
  const [active, setActive] = useState(null);
  const [result, setResult] = useState(null);
  const autoStartedRef = useRef(null);

  const requestedTab = searchParams.get('tab');
  let tab = ARENA_TABS.includes(requestedTab) ? requestedTab : 'play';
  if (isTeacher && tab === 'mine') tab = 'play';

  const changeTab = (value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', value);
      return next;
    }, { replace: true });
  };

  const fetchChallenges = useCallback(async () => {
    setRefreshing(true);
    try {
      const params = { source };
      if (user?.role === 'student' && user?.age_group) params.age_group = user.age_group;
      if (subject !== 'all') params.subject = subject;
      const res = await axios.get(`${API}/arena/challenges`, { params });
      setChallenges(res.data);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [API, user?.role, user?.age_group, subject, source]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const startChallenge = useCallback((challenge) => {
    setResult(null);
    setActive(challenge);
    window.scrollTo(0, 0);
  }, []);

  // /arena/:id deep link: start that challenge once, after the first list load.
  useEffect(() => {
    if (!id || loading || autoStartedRef.current === id) return;
    autoStartedRef.current = id;
    const found = challenges.find((c) => c.id === id);
    if (found) {
      if (found.can_attempt) startChallenge(found);
      else toast.error(lockReason(found, user));
      return;
    }
    // Not in the filtered list (e.g. outside the student's age group): load it directly.
    axios.get(`${API}/arena/challenges/${id}`)
      .then((res) => {
        if (autoStartedRef.current !== id) return;
        const challenge = {
          ...res.data,
          attempted: false,
          best_score: null,
          is_mine: false,
          can_attempt: res.data.source !== 'peer' || user?.role === 'student',
        };
        if (challenge.can_attempt) startChallenge(challenge);
        else toast.error(lockReason(challenge, user));
      })
      .catch((e) => toast.error(formatApiError(e.response?.data?.detail)));
  }, [id, loading, challenges, startChallenge, API, user]);

  const clearDeepLink = useCallback(() => {
    if (id) navigate({ pathname: '/arena', search: searchParams.toString() }, { replace: true });
  }, [id, navigate, searchParams]);

  const handleFinish = useCallback((res) => {
    setResult(res);
    window.scrollTo(0, 0);
    fetchChallenges();
  }, [fetchChallenges]);

  const handleExit = useCallback(() => {
    setActive(null);
    setResult(null);
    clearDeepLink();
  }, [clearDeepLink]);

  const handleBack = useCallback(() => {
    setActive(null);
    setResult(null);
    clearDeepLink();
    fetchChallenges();
  }, [clearDeepLink, fetchChallenges]);

  const nextChallenge = useMemo(() => {
    if (!active) return null;
    const candidates = challenges.filter((c) => c.can_attempt && !c.attempted && c.id !== active.id);
    if (candidates.length === 0) return null;
    const currentIndex = challenges.findIndex((c) => c.id === active.id);
    return candidates.find((c) => challenges.indexOf(c) > currentIndex) || candidates[0];
  }, [active, challenges]);

  const handleNext = useCallback(() => {
    if (!nextChallenge) return;
    if (id) {
      // The route boundary remounts the page when the path changes, so starting the challenge here would be
      // lost. Point the deep link at the next challenge instead; the remounted page auto-starts it.
      navigate({ pathname: `/arena/${nextChallenge.id}`, search: searchParams.toString() }, { replace: true });
      return;
    }
    startChallenge(nextChallenge);
  }, [nextChallenge, id, navigate, searchParams, startChallenge]);

  // "Solution 3 of 10" in the play and result headers (index -1 when the solution came from a deep link).
  const position = useMemo(() => ({
    index: active ? challenges.findIndex((c) => c.id === active.id) : -1,
    total: challenges.length,
  }), [active, challenges]);

  // The list's one primary action: the first solution this student has not tried yet.
  const upNext = useMemo(
    () => (isTeacher ? null : challenges.find((c) => c.can_attempt && !c.attempted) || null),
    [challenges, isTeacher]
  );

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="text-center" role="status">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-ink-muted">Loading the Debug Arena...</p>
        </div>
      </div>
    );
  }

  if (active && result) {
    return (
      <ArenaResult
        challenge={active}
        result={result}
        position={position}
        onNext={nextChallenge ? handleNext : undefined}
        onBack={handleBack}
      />
    );
  }

  if (active) {
    return <ArenaPlay key={active.id} challenge={active} position={position} onFinish={handleFinish} onExit={handleExit} />;
  }

  const filtersActive = subject !== 'all' || source !== 'all';
  const tried = challenges.filter((c) => c.attempted).length;
  const solved = challenges.filter((c) => c.attempted && (c.best_score ?? 0) >= 100).length;

  return (
    <PageShell>
      <header className="max-w-3xl">
        <h1 className="t-h1" data-testid="arena-heading">Debug Arena</h1>
        <p className="mt-3 text-lg text-ink-muted">
          Each worked solution has one step where the reasoning breaks. You are not looking for the right
          answer: find the first wrong step, then name the idea behind it.
        </p>
      </header>

      {isTeacher && (
        <div
          className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-0 border-y border-rule py-1 text-sm"
          data-testid="arena-teacher-note"
        >
          <span className="text-ink-muted">For teachers</span>
          <Link to="/dashboard" className={LINK} data-testid="arena-teacher-dashboard-link">
            Review your students' scenarios on the dashboard
          </Link>
          <Link to="/arena/worksheet" className={LINK} data-testid="arena-worksheet-link">
            <Printer className="h-4 w-4" aria-hidden="true" /> Print an offline worksheet
          </Link>
        </div>
      )}

      <Tabs value={tab} onValueChange={changeTab} className="mt-8 w-full">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="play" className={TAB_TRIGGER} data-testid="arena-tab-play">Play</TabsTrigger>
          {!isTeacher && (
            <TabsTrigger value="mine" className={TAB_TRIGGER} data-testid="arena-tab-mine">My scenarios</TabsTrigger>
          )}
          <TabsTrigger value="hunters" className={TAB_TRIGGER} data-testid="arena-tab-hunters">Hunters</TabsTrigger>
        </TabsList>

        <TabsContent value="play" className="mt-8">
          {upNext && (
            <section
              aria-labelledby="arena-up-next"
              className="glass glass-tint-brand animate-question mb-10 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[26px] px-6 py-6 sm:px-8"
            >
              <div className="min-w-0">
                <p className="t-cap">Next up</p>
                <h2 id="arena-up-next" className="mt-0.5 break-words text-xl">{upNext.title}</h2>
                <p className="mt-0.5 text-ink-muted tnum">
                  {upNext.subject}, {(upNext.steps || []).length} steps, {formatClock(upNext.time_limit_seconds)} on the clock
                </p>
              </div>
              <Button onClick={() => startChallenge(upNext)} className="min-w-[9rem]" data-testid="arena-up-next-btn">
                Start <ArrowRight aria-hidden="true" />
              </Button>
            </section>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="arena-subject" className="text-ink-muted">Subject</Label>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger id="arena-subject" className="w-full sm:w-56" data-testid="arena-subject-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects</SelectItem>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <span id="arena-source-label" className="block text-sm font-medium leading-none text-ink-muted">Made by</span>
                <div role="group" aria-labelledby="arena-source-label" className={cn(SEG_GROUP, 'flex w-full sm:inline-flex sm:w-auto')}>
                  {SOURCE_FILTERS.map((f) => {
                    const selected = source === f.value;
                    return (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setSource(f.value)}
                        aria-pressed={selected}
                        className={cn(segButton(selected), 'flex-1 sm:flex-none')}
                        data-testid={`arena-source-${f.value}`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {challenges.length > 0 && (
              <p className="text-sm text-ink-muted tnum sm:pb-2.5">
                {isTeacher
                  ? `${challenges.length} ${challenges.length === 1 ? 'solution' : 'solutions'}`
                  : `${tried} of ${challenges.length} tried, ${solved} solved in full`}
              </p>
            )}
          </div>

          <p className="sr-only" aria-live="polite" data-testid="arena-results-count">
            {refreshing ? '' : `${challenges.length} ${challenges.length === 1 ? 'solution' : 'solutions'} shown`}
          </p>
          <div aria-busy={refreshing} className="mt-6">
            {challenges.length === 0 ? (
              <div className="glass glass-strong rounded-[24px] p-8" data-testid="arena-empty">
                <h2 className="t-h3">No solutions here yet</h2>
                <p className="mt-2 max-w-prose text-ink-muted">
                  {filtersActive
                    ? 'Nothing matches these filters. Try another subject or show everything.'
                    : 'There are no Debug Arena solutions for you right now. Check back soon.'}
                </p>
                {filtersActive && (
                  <Button
                    onClick={() => { setSubject('all'); setSource('all'); }}
                    className="mt-5"
                    data-testid="arena-clear-filters-btn"
                  >
                    Show all solutions
                  </Button>
                )}
              </div>
            ) : (
              <>
                <h2 className="sr-only">Solutions</h2>
                <ul className="glass glass-strong overflow-hidden rounded-[24px] px-5 sm:px-6" data-testid="arena-challenge-list">
                  {challenges.map((c) => (
                    <ChallengeRow key={c.id} challenge={c} user={user} onStart={startChallenge} />
                  ))}
                </ul>
              </>
            )}
          </div>
        </TabsContent>

        {!isTeacher && (
          <TabsContent value="mine" className="mt-8">
            <MyScenarios />
          </TabsContent>
        )}

        <TabsContent value="hunters" className="mt-8">
          <ArenaLeaderboard />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ArenaPage;
