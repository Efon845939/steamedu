import React, { useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import * as m from 'motion/react-m';
import {
  ArrowRight, Award, BarChart3, BookOpen, Bug, CheckCircle2, Flame, FlaskConical, Lightbulb, Library,
  PenLine, Printer, Sparkles, Star, Target, Trophy,
} from 'lucide-react';
import { AuthContext } from '../App';
import { Badge } from './ui/badge';
import { formatApiError, firstName } from '../lib/steam';
import { WeeklyRecap } from './WeeklyRecap';
import { CertificateModal } from './CertificateModal';
import { BadgesCard } from './BadgesCard';
import { StudentAnnouncements } from './StudentAnnouncements';
import { notifyNewBadges } from '../lib/badges';
import { MotionScope, useMotion } from '../lib/motion';
import { useAgeTheme } from '../lib/theme';
import { GlassPanel, Trace, onSheen } from './lab';
import { cn } from '../lib/utils';

// Student dashboard: a glass bento. One raised "Next up" slab with the single most useful
// next step, then the numbers, Debug Arena, the week, badges, class news and the path.
// Cells rise in once on load; values are final in the DOM from the first frame.

const scoreTone = (s) => (s >= 80 ? 'border-success-rule bg-success-tint text-success' : s >= 60 ? 'border-warning-rule bg-warning-tint text-warning' : 'border-danger-rule bg-danger-tint text-danger');
const scoreLevel = (s) => (s >= 80 ? 'holds' : s >= 60 ? 'unsure' : 'breaks');

const useCell = () => {
  const mo = useMotion();
  return {
    variants: {
      hidden: mo.full ? { opacity: 0, y: 26, filter: 'blur(8px)' } : { opacity: mo.off ? 1 : 0 },
      show: { opacity: 1, y: 0, filter: 'blur(0px)', transition: mo.full ? { type: 'spring', stiffness: 150, damping: 20 } : mo.enter },
    },
  };
};

const Cell = ({ className, children, ...rest }) => {
  const cell = useCell();
  return (
    <m.div variants={cell.variants} className={className} {...rest}>
      {children}
    </m.div>
  );
};

const Metric = ({ icon: Icon, label, children, note, testid }) => (
  <div className="glass glass-strong flex h-full flex-col gap-3 rounded-[22px] p-5" onPointerMove={onSheen}>
    <div className="flex items-center justify-between gap-2 text-sm text-ink-muted">
      <span>{label}</span>
      <Icon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
    </div>
    <div className="t-num text-4xl leading-none" data-testid={testid}>
      {children}
    </div>
    {note ? <p className="text-sm text-ink-muted">{note}</p> : null}
  </div>
);

// Progress ring that draws once.
const Ring = ({ pct }) => {
  const mo = useMotion();
  const v = Math.max(0, Math.min(100, pct || 0)) / 100;
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-neutral-tint" />
      <m.circle
        cx="32"
        cy="32"
        r="26"
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        className="stroke-brand"
        initial={{ pathLength: mo.full ? 0 : v }}
        animate={{ pathLength: v }}
        transition={mo.full ? { duration: 1.2, ease: [0.65, 0, 0.35, 1], delay: 0.35 } : { duration: 0 }}
      />
    </svg>
  );
};

const Bar = ({ pct, delay = 0 }) => {
  const mo = useMotion();
  const v = Math.max(0, Math.min(100, pct || 0)) / 100;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-neutral-tint" aria-hidden="true">
      <m.div
        className="h-full origin-left rounded-full bg-brand"
        initial={{ scaleX: mo.full ? 0 : v }}
        whileInView={{ scaleX: v }}
        viewport={{ once: true }}
        transition={mo.full ? { type: 'spring', stiffness: 90, damping: 20, delay } : { duration: 0 }}
      />
    </div>
  );
};

const QUICK = [
  { to: '/quiz', label: 'Quizzes', icon: BookOpen, testid: 'take-quiz-btn' },
  { to: '/arena', label: 'Debug Arena', icon: Bug, testid: 'arena-btn' },
  { to: '/activities', label: 'Activities', icon: FlaskConical, testid: 'explore-activities-btn' },
  { to: '/contests', label: 'Contests', icon: Trophy, testid: 'contests-btn' },
  { to: '/leaderboard', label: 'Leaderboard', icon: BarChart3, testid: 'leaderboard-btn' },
  { to: '/content', label: 'Content', icon: Library, testid: 'browse-content-btn' },
];

const DashboardBody = ({ stats, refreshStats }) => {
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();
  const theme = useAgeTheme();
  const mo = useMotion();
  const [challenges, setChallenges] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [selectedCert, setSelectedCert] = useState(null);
  const [badgeKey, setBadgeKey] = useState(0);

  const fetchExtras = useCallback(async () => {
    try {
      const [chRes, certRes] = await Promise.all([
        axios.get(`${API}/challenges/today`),
        axios.get(`${API}/certificates/me`),
      ]);
      setChallenges(chRes.data);
      setCertificates(certRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [API]);

  useEffect(() => {
    fetchExtras();
  }, [fetchExtras]);

  const completeTask = async (challenge) => {
    try {
      const res = await axios.post(`${API}/challenges/${challenge.id}/complete`);
      toast.success(`Challenge complete. +${res.data.points_earned} points`);
      notifyNewBadges(res.data.new_badges);
      setBadgeKey((k) => k + 1);
      fetchExtras();
      refreshStats();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  // The one next step: a quiz your teacher set today, else the next quiz, else Debug Arena.
  const nextUp = useMemo(() => {
    const quizChallenge = challenges.find((c) => !c.completed && c.type === 'quiz');
    if (quizChallenge) {
      return { kicker: "Today's challenge", title: quizChallenge.title, text: quizChallenge.description, cta: 'Take the quiz', onClick: () => navigate(`/quiz/${quizChallenge.quiz_id}`) };
    }
    const left = (stats.total_quizzes || 0) - (stats.quizzes_completed || 0);
    if (left > 0) {
      return { kicker: 'Next up', title: 'Your next quiz', text: `${left} quiz${left === 1 ? '' : 'zes'} for your age group ${left === 1 ? 'is' : 'are'} waiting.`, cta: 'Choose a quiz', to: '/quiz' };
    }
    return { kicker: 'Next up', title: 'Debug Arena', text: 'Find the broken step in a worked solution and name the idea behind it.', cta: 'Hunt bugs', to: '/arena' };
  }, [challenges, stats, navigate]);

  const recent = stats.recent_attempts || [];
  const traceLevels = recent.length >= 2 ? recent.slice().reverse().map((a) => scoreLevel(a.score)) : ['holds', 'breaks', 'unsure', 'holds'];
  const showPoints = theme !== '18+';

  const words = `Hi ${firstName(user.full_name)}`.split(' ');

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 md:pt-12">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6" data-testid="dashboard-header">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-[clamp(2.4rem,5vw,3.8rem)] font-bold leading-none tracking-[-0.02em]" aria-label={words.join(' ')}>
            {words.map((w, i) => (
              <m.span
                key={w + i}
                aria-hidden="true"
                className="inline-block"
                initial={mo.full ? { opacity: 0, y: 20, filter: 'blur(10px)' } : { opacity: mo.off ? 1 : 0 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={mo.full ? { type: 'spring', stiffness: 170, damping: 20, delay: 0.05 + i * 0.08 } : mo.enter}
              >
                {w}
                {' '}
              </m.span>
            ))}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-ink-muted">
            {stats.teacher_name ? (
              <span>
                Your mentor: <span className="font-semibold text-ink" data-testid="mentor-name">{stats.teacher_name}</span>
              </span>
            ) : (
              <span>No mentor yet. Your teacher can add you with your username.</span>
            )}
            {stats.age_group && <span className="glass rounded-full px-3 py-1 text-xs font-semibold text-ink">Ages {stats.age_group}</span>}
          </div>
        </div>
        {showPoints && (
          <div className="flex gap-2.5">
            <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5" data-testid="points-badge">
              <Star className="h-5 w-5 text-brand-ink" aria-hidden="true" />
              <span className="t-num text-lg">{stats.points}</span>
              <span className="text-sm text-ink-muted">points</span>
            </div>
            <div className="glass flex items-center gap-2 rounded-full px-4 py-2.5" data-testid="streak-badge">
              <Flame className="h-5 w-5 text-warning" aria-hidden="true" />
              <span className="t-num text-lg">{stats.streak_days}</span>
              <span className="text-sm text-ink-muted">day streak</span>
            </div>
          </div>
        )}
      </div>

      <m.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: mo.full ? 0.06 : 0 } } }} className="grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12">
        {/* Next up: the one raised slab */}
        <Cell className="md:col-span-6 lg:col-span-8">
          <div className="glass glass-tint-brand relative flex h-full flex-col justify-between gap-6 overflow-hidden rounded-[28px] p-6 sm:p-8" onPointerMove={onSheen}>
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-brand-ink">{nextUp.kicker}</span>
              <h2 className="t-h2 max-w-xl">{nextUp.title}</h2>
              {nextUp.text ? <p className="max-w-lg text-ink-muted">{nextUp.text}</p> : null}
            </div>
            <div className="flex flex-wrap items-end justify-between gap-6">
              {nextUp.to ? (
                <Link to={nextUp.to} className="glass-brand inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold transition-transform duration-press active:scale-[0.97]">
                  {nextUp.cta}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </Link>
              ) : (
                <button type="button" onClick={nextUp.onClick} className="glass-brand inline-flex h-12 items-center gap-2 rounded-full px-6 font-semibold transition-transform duration-press active:scale-[0.97]">
                  {nextUp.cta}
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </button>
              )}
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1 sm:max-w-xs">
                <Trace levels={traceLevels} height={44} draw={mo.full} />
                <span className="text-xs text-ink-muted">{recent.length >= 2 ? 'Your last quizzes, oldest first' : 'Your trace fills in as you take quizzes'}</span>
              </div>
            </div>
          </div>
        </Cell>

        {/* Progress ring */}
        <Cell className="md:col-span-3 lg:col-span-4">
          <div className="glass glass-strong flex h-full items-center gap-5 rounded-[28px] p-6" onPointerMove={onSheen}>
            <Ring pct={stats.progress} />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-ink-muted">Learning progress</span>
              <span className="t-num text-4xl leading-none" data-testid="learning-progress-stat">
                {stats.progress}%
              </span>
              <span className="text-sm text-ink-muted">of all content for your age group</span>
            </div>
          </div>
        </Cell>

        <Cell className="md:col-span-3 lg:col-span-4">
          <Metric icon={BookOpen} label="Quizzes completed" note={`Average score ${stats.avg_score}%`} testid="quizzes-completed-stat">
            {stats.quizzes_completed}
            <span className="text-xl text-ink-muted">/{stats.total_quizzes}</span>
          </Metric>
        </Cell>
        <Cell className="md:col-span-3 lg:col-span-4">
          <Metric icon={Target} label="Activities completed" note="Hands-on learning done" testid="activities-completed-stat">
            {stats.activities_completed}
            <span className="text-xl text-ink-muted">/{stats.total_activities}</span>
          </Metric>
        </Cell>
        <Cell className="md:col-span-3 lg:col-span-4">
          <Metric
            icon={Lightbulb}
            label="Ideas and awards"
            note={`${stats.certificates} certificate${stats.certificates !== 1 ? 's' : ''}, ${stats.badges_earned} of ${stats.badges_total} badges`}
            testid="ideas-shared-stat"
          >
            {stats.ideas_shared} <span className="text-xl text-ink-muted">ideas</span>
          </Metric>
        </Cell>

        {/* Debug Arena */}
        <Cell className="md:col-span-6 lg:col-span-12">
          <div className="glass glass-strong flex flex-col gap-6 rounded-[28px] p-6 sm:flex-row sm:items-center sm:justify-between" onPointerMove={onSheen} data-testid="arena-card">
            <div className="flex flex-col gap-2">
              <h2 className="flex items-center gap-2 text-xl">
                <Bug className="h-5 w-5 text-brand-ink" aria-hidden="true" />
                Debug Arena
              </h2>
              <p className="max-w-md text-ink-muted">Find the broken step in a worked solution, or write your own trap for your classmates.</p>
            </div>
            <div className="flex flex-wrap items-center gap-8">
              <div className="flex flex-col">
                <span className="t-num text-4xl leading-none" data-testid="arena-debug-rating">
                  {stats.debug_rating}
                </span>
                <span className="mt-1 text-sm text-ink-muted">Debugger rating</span>
              </div>
              <div className="flex flex-col">
                <span className="t-num text-4xl leading-none" data-testid="arena-bugs-found">
                  {stats.bugs_found}
                  <span className="text-xl text-ink-muted">/{stats.arena_attempted}</span>
                </span>
                <span className="mt-1 text-sm text-ink-muted">Found on the first try</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <Link to="/arena" className="glass-brand inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold" data-testid="arena-play-btn">
                  <Bug className="h-4 w-4" aria-hidden="true" />
                  Hunt bugs
                </Link>
                <Link to="/arena?tab=mine" className="glass inline-flex h-11 items-center gap-2 rounded-full px-5 font-semibold" data-testid="arena-write-btn">
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Write a scenario
                </Link>
              </div>
            </div>
          </div>
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-12">
          <WeeklyRecap />
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-12">
          <BadgesCard reloadKey={badgeKey} />
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-6">
          <StudentAnnouncements />
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-6">
          <GlassPanel
            className="h-full"
            icon={Sparkles}
            title="Today's challenges"
            description={stats.teacher_name ? `Set by ${stats.teacher_name}` : 'Get a mentor to receive daily challenges'}
            data-testid="daily-challenges-card"
          >
            {challenges.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted" data-testid="no-challenges-msg">
                No challenges for today yet. Check back later.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-rule/60">
                {challenges.map((ch) => (
                  <li key={ch.id} className="flex items-start justify-between gap-3 py-3.5" data-testid={`challenge-${ch.id}`}>
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2 font-semibold">
                        {ch.completed && <CheckCircle2 className="h-4 w-4 text-success" aria-label="Done" />}
                        {ch.title}
                        <span className="t-num rounded-full border border-rule-strong/50 px-2 py-0.5 text-xs">+{ch.points}</span>
                      </span>
                      <span className="text-sm text-ink-muted">{ch.description}</span>
                    </div>
                    {!ch.completed &&
                      (ch.type === 'quiz' ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/quiz/${ch.quiz_id}`)}
                          className="glass-brand inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold"
                          data-testid={`challenge-quiz-btn-${ch.id}`}
                        >
                          Take quiz
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => completeTask(ch)}
                          className="glass inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold"
                          data-testid={`challenge-complete-btn-${ch.id}`}
                        >
                          Mark done
                        </button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </Cell>

        {/* Jump to */}
        <Cell className="md:col-span-6 lg:col-span-12">
          <nav aria-label="Jump to" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {QUICK.map((q) => (
              <m.span key={q.to} whileHover={mo.full ? { y: -4 } : undefined} whileTap={mo.full ? { scale: 0.97 } : undefined} transition={mo.spring}>
                <Link
                  to={q.to}
                  className="glass flex h-full items-center gap-3 rounded-2xl px-4 py-4 font-semibold"
                  onPointerMove={onSheen}
                  data-testid={q.testid}
                >
                  <q.icon className="h-5 w-5 text-brand-ink" aria-hidden="true" />
                  {q.label}
                </Link>
              </m.span>
            ))}
          </nav>
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-6">
          <GlassPanel className="h-full" icon={BarChart3} title="Recent quiz results" data-testid="recent-results-card">
            {recent.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted">No quizzes yet. Your first one takes a few minutes.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-rule/60">
                {recent.map((a) => (
                  <li key={`${a.quiz_title}-${a.completed_at}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-semibold">{a.quiz_title}</span>
                      <span className="text-sm text-ink-muted">{new Date(a.completed_at).toLocaleDateString()}</span>
                    </div>
                    <span className={cn('t-num shrink-0 rounded-full border px-3 py-1 text-sm', scoreTone(a.score))}>{a.score}%</span>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-6">
          <GlassPanel
            className="h-full"
            icon={Award}
            title="My certificates"
            description="Win contests to earn certificates. Open one to print it."
            data-testid="certificates-card"
          >
            {certificates.length === 0 ? (
              <p className="py-4 text-sm text-ink-muted">No certificates yet. Join a contest and finish first.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {certificates.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedCert(c)}
                      className="glass flex w-full items-start gap-3 rounded-2xl p-4 text-left"
                      data-testid={`certificate-${c.id}`}
                    >
                      <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="flex flex-wrap items-center gap-2 font-semibold">
                          Champion, {c.tournament_title}
                          {c.is_professional && <Badge variant="info">Professional</Badge>}
                        </span>
                        <span className="text-sm text-ink-muted">
                          {c.subject}, hosted by {c.teacher_name}, {new Date(c.awarded_at).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                          <Printer className="h-4 w-4" aria-hidden="true" />
                          View and print
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassPanel>
        </Cell>

        <Cell className="md:col-span-6 lg:col-span-12">
          <GlassPanel icon={Target} title="Your learning path" description="Real progress in every subject" data-testid="learning-path-card">
            <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
              {stats.subject_progress.map((sp, i) => (
                <li key={sp.subject} className="flex flex-col gap-2" data-testid={`subject-progress-${sp.subject.toLowerCase()}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">{sp.subject}</span>
                    <span className="t-num text-sm text-ink-muted">
                      {sp.completed}/{sp.total}
                    </span>
                  </div>
                  <Bar pct={sp.pct} delay={0.1 + i * 0.06} />
                </li>
              ))}
            </ul>
          </GlassPanel>
        </Cell>
      </m.div>

      <CertificateModal certificate={selectedCert} onClose={() => setSelectedCert(null)} />
    </div>
  );
};

const StudentDashboard = (props) => (
  <MotionScope>
    <DashboardBody {...props} />
  </MotionScope>
);

export default StudentDashboard;
