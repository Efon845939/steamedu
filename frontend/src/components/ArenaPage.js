import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Bug, Clock, ListOrdered, BadgeCheck, Users, Lock, Play, RotateCcw, GraduationCap, Printer,
  CheckCircle2, XCircle, CircleDot, UserRound,
} from 'lucide-react';
import { SUBJECTS, subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { formatClock, scoreTier, SOURCE_FILTERS, ARENA_TABS, lockReason } from '../lib/arena';
import { ArenaPlay } from './ArenaPlay';
import { ArenaResult } from './ArenaResult';
import { MyScenarios } from './MyScenarios';
import { ArenaLeaderboard } from './ArenaLeaderboard';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

const scoreIcon = (score) => {
  if (score >= 100) return CheckCircle2;
  if (score >= 50) return CircleDot;
  return XCircle;
};

const PageShell = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8" data-testid="arena-page">
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</div>
  </div>
);

const ChallengeCard = ({ challenge: c, user, onStart }) => {
  const reason = lockReason(c, user);
  const tier = c.attempted ? scoreTier(c.best_score) : null;
  const ScoreIcon = c.attempted ? scoreIcon(c.best_score) : null;
  const steps = (c.steps || []).length;
  return (
    <Card className="bg-white/80 backdrop-blur-sm flex flex-col hover:shadow-lg transition-shadow" data-testid={`arena-card-${c.id}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <Badge className={subjectBadgeColor(c.subject)}>
            {subjectEmoji(c.subject)} {c.subject}
          </Badge>
          {c.source === 'peer' ? (
            <Badge variant="outline" className="gap-1 max-w-full">
              <Users className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate">by {c.author_name || 'a classmate'}</span>
            </Badge>
          ) : (
            <Badge className="bg-teal-100 text-teal-800 gap-1">
              <BadgeCheck className="w-3 h-3" aria-hidden="true" /> Official
            </Badge>
          )}
          {c.is_mine && (
            <Badge className="bg-indigo-100 text-indigo-800 gap-1" data-testid={`arena-mine-${c.id}`}>
              <UserRound className="w-3 h-3" aria-hidden="true" /> Yours
            </Badge>
          )}
        </div>
        <CardTitle className="text-lg text-gray-900 break-words">{c.title}</CardTitle>
        {c.problem && (
          <p className="text-sm text-gray-600 line-clamp-2 break-words">{c.problem}</p>
        )}
      </CardHeader>
      <CardContent className="mt-auto space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1">
            <Clock className="w-3 h-3" aria-hidden="true" />
            <span className="sr-only">Time limit</span>
            {formatClock(c.time_limit_seconds)}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <ListOrdered className="w-3 h-3" aria-hidden="true" /> {steps} steps
          </Badge>
          {c.attempted && (
            <Badge className={`gap-1 ${tier.className}`} data-testid={`arena-best-${c.id}`}>
              <ScoreIcon className="w-3 h-3" aria-hidden="true" /> Best {c.best_score ?? 0}/100
            </Badge>
          )}
          {c.source === 'peer' && c.solvers != null && (
            <Badge variant="outline" className="text-gray-600">
              {c.solvers} {c.solvers === 1 ? 'solver' : 'solvers'}
            </Badge>
          )}
        </div>
        {user?.role === 'teacher' && c.misconception?.description && (
          <p className="text-xs text-gray-600 break-words" data-testid={`arena-target-${c.id}`}>
            <span className="font-semibold">Targets:</span> {c.misconception.description}
          </p>
        )}
        <Button
          onClick={() => onStart(c)}
          disabled={!c.can_attempt}
          aria-describedby={reason ? `arena-lock-${c.id}` : undefined}
          className={`w-full bg-emerald-600 hover:bg-emerald-700 ${focusRing}`}
          data-testid={`start-arena-${c.id}`}
        >
          {!c.can_attempt ? (
            <><Lock className="w-4 h-4" aria-hidden="true" /> Locked</>
          ) : c.attempted ? (
            <><RotateCcw className="w-4 h-4" aria-hidden="true" /> Try again</>
          ) : (
            <><Play className="w-4 h-4" aria-hidden="true" /> Start</>
          )}
        </Button>
        {reason && (
          <p id={`arena-lock-${c.id}`} className="text-xs text-gray-500 text-center" data-testid={`arena-lock-reason-${c.id}`}>
            {reason}
          </p>
        )}
      </CardContent>
    </Card>
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
    clearDeepLink();
    startChallenge(nextChallenge);
  }, [nextChallenge, clearDeepLink, startChallenge]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center" role="status">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading the Debug Arena...</p>
        </div>
      </div>
    );
  }

  if (active && result) {
    return (
      <ArenaResult
        challenge={active}
        result={result}
        onNext={nextChallenge ? handleNext : undefined}
        onBack={handleBack}
      />
    );
  }

  if (active) {
    return <ArenaPlay key={active.id} challenge={active} onFinish={handleFinish} onExit={handleExit} />;
  }

  const filtersActive = subject !== 'all' || source !== 'all';

  return (
    <PageShell>
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3" data-testid="arena-heading">
          Debug Arena <span aria-hidden="true">🐞</span>
        </h1>
        <p className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto">
          Find the step where the reasoning breaks, then name the concept it breaks — you are not looking for the
          right answer, you are debugging someone's thinking.
        </p>
      </div>

      {isTeacher && (
        <Card className="bg-white/80 backdrop-blur-sm mb-6 border-teal-200" data-testid="arena-teacher-note">
          <CardContent className="py-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
            <GraduationCap className="w-4 h-4 text-teal-600 shrink-0" aria-hidden="true" />
            <span className="font-semibold">Teachers:</span>
            <Link
              to="/dashboard"
              className={`text-teal-700 underline underline-offset-2 hover:text-teal-900 rounded ${focusRing}`}
              data-testid="arena-teacher-dashboard-link"
            >
              review your students' scenarios on the dashboard
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              to="/arena/worksheet"
              className={`inline-flex items-center gap-1 text-teal-700 underline underline-offset-2 hover:text-teal-900 rounded ${focusRing}`}
              data-testid="arena-worksheet-link"
            >
              <Printer className="w-4 h-4" aria-hidden="true" /> Print an offline worksheet
            </Link>
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={changeTab} className="w-full">
        <TabsList className={`grid w-full max-w-md mx-auto mb-8 ${isTeacher ? 'grid-cols-2' : 'grid-cols-3'}`}>
          <TabsTrigger value="play" className="px-1.5 sm:px-3 text-xs sm:text-sm" data-testid="arena-tab-play">
            <Bug className="w-4 h-4 mr-1 hidden sm:block" aria-hidden="true" />Play
          </TabsTrigger>
          {!isTeacher && (
            <TabsTrigger value="mine" className="px-1.5 sm:px-3 text-xs sm:text-sm" data-testid="arena-tab-mine">My scenarios</TabsTrigger>
          )}
          <TabsTrigger value="hunters" className="px-1.5 sm:px-3 text-xs sm:text-sm" data-testid="arena-tab-hunters">Hunters</TabsTrigger>
        </TabsList>

        <TabsContent value="play">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-center gap-4 mb-8">
            <div className="space-y-1">
              <Label htmlFor="arena-subject" className="text-gray-700">Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger id="arena-subject" className="w-full sm:w-56 bg-white" data-testid="arena-subject-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{subjectEmoji(s)} {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span id="arena-source-label" className="block text-sm font-medium leading-none text-gray-700">Made by</span>
              <div
                role="group"
                aria-labelledby="arena-source-label"
                className="inline-flex w-full sm:w-auto rounded-md border border-input bg-white p-0.5"
              >
                {SOURCE_FILTERS.map((f) => {
                  const selected = source === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setSource(f.value)}
                      aria-pressed={selected}
                      className={`flex-1 sm:flex-none px-3 h-8 text-sm rounded font-medium transition-colors ${focusRing} ${
                        selected ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'
                      }`}
                      data-testid={`arena-source-${f.value}`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="sr-only" aria-live="polite" data-testid="arena-results-count">
            {refreshing ? '' : `${challenges.length} ${challenges.length === 1 ? 'challenge' : 'challenges'} shown`}
          </p>
          <div aria-busy={refreshing}>
            {challenges.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-sm max-w-md mx-auto" data-testid="arena-empty">
                <CardHeader className="text-center">
                  <div className="text-5xl mb-2" aria-hidden="true">🔍</div>
                  <CardTitle className="text-xl text-gray-900">No challenges here yet</CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-gray-600">
                    {filtersActive
                      ? 'Nothing matches these filters. Try another subject or show everything.'
                      : 'There are no Debug Arena challenges for you right now. Check back soon!'}
                  </p>
                  {filtersActive && (
                    <Button
                      onClick={() => { setSubject('all'); setSource('all'); }}
                      className={`bg-emerald-600 hover:bg-emerald-700 ${focusRing}`}
                      data-testid="arena-clear-filters-btn"
                    >
                      Show all challenges
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="arena-challenge-list">
                {challenges.map((c) => (
                  <ChallengeCard key={c.id} challenge={c} user={user} onStart={startChallenge} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {!isTeacher && (
          <TabsContent value="mine">
            <MyScenarios />
          </TabsContent>
        )}

        <TabsContent value="hunters">
          <ArenaLeaderboard />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
};

export default ArenaPage;
