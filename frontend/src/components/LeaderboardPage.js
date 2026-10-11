import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { SUBJECTS, AGE_GROUPS } from '../lib/steam';
import { BadgeCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const ordinal = (n) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${{ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'}`;
};

const formatNumber = (value, digits = 0) =>
  Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: digits });

const TAB_LIST = 'glass inline-flex h-auto w-auto max-w-full justify-start gap-1 overflow-x-auto rounded-full p-1 text-ink-muted';
const TAB_TRIGGER = cn(
  'h-10 shrink-0 rounded-full px-4 text-sm font-semibold text-ink-muted transition-colors',
  'hover:text-ink data-[state=active]:bg-surface data-[state=active]:text-ink data-[state=active]:shadow-raised'
);

const TH = 'py-2 pr-4 text-left align-bottom text-sm font-semibold text-ink-muted';
const TD = 'py-3 pr-4 align-middle';

const Verified = () => (
  <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-info">
    <BadgeCheck aria-hidden="true" className="h-4 w-4" />
    Verified
  </span>
);

const LeaderboardPage = () => {
  const { user, API } = useContext(AuthContext);
  const [ageGroup, setAgeGroup] = useState('all');
  const [subject, setSubject] = useState('all');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState({ best: [], popular: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const params = { age_group: ageGroup };
        if (subject !== 'all') params.subject = subject;
        const res = await axios.get(`${API}/leaderboard/students`, { params });
        setStudents(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [ageGroup, subject, API]);

  useEffect(() => {
    axios.get(`${API}/leaderboard/teachers`).then((res) => setTeachers(res.data)).catch(console.error);
  }, [API]);

  const bySubject = subject !== 'all';
  const me = students.find((s) => s.user_id === user.id);
  const boardName = `${ageGroup === 'all' ? 'All ages' : `Ages ${ageGroup}`}${bySubject ? `, ${subject}` : ''}`;
  const rankedBy = bySubject ? `Ranked by average best score in ${subject}.` : 'Ranked by total points.';

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <header className="max-w-3xl animate-rise">
        <h1 className="t-h1">Leaderboard</h1>
        <p className="t-lead mt-3 text-ink-muted">Students ranked by points, and the teachers whose classes take part.</p>
      </header>

      <Tabs defaultValue="students" className="mt-8 w-full">
        <TabsList className={TAB_LIST}>
          <TabsTrigger value="students" className={TAB_TRIGGER} data-testid="students-leaderboard-tab">Students</TabsTrigger>
          <TabsTrigger value="teachers" className={TAB_TRIGGER} data-testid="teachers-leaderboard-tab">Teachers</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <div className="flex flex-col gap-1">
                <span id="lb-age-label" className="t-cap">Age group</span>
                <Select value={ageGroup} onValueChange={setAgeGroup}>
                  <SelectTrigger className="w-full sm:w-48" aria-labelledby="lb-age-label" data-testid="leaderboard-age-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All ages</SelectItem>
                    {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>Ages {g}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span id="lb-subject-label" className="t-cap">Subject</span>
                <Select value={subject} onValueChange={setSubject}>
                  <SelectTrigger className="w-full sm:w-56" aria-labelledby="lb-subject-label" data-testid="leaderboard-subject-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All subjects, by points</SelectItem>
                    {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}, by average score</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="tnum text-ink-muted sm:text-right" aria-live="polite">
              {me ? (
                <>
                  You are <span className="t-num text-ink">{ordinal(me.rank)}</span> of{' '}
                  <span className="t-num text-ink">{students.length}</span>. {rankedBy}
                </>
              ) : (
                rankedBy
              )}
            </p>
          </div>

          <div className="glass glass-strong mt-6 overflow-x-auto rounded-[24px] px-5 py-2" data-testid="students-leaderboard-card">
            {loading ? (
              <p className="border-y border-rule py-8 text-ink-muted" role="status">Loading the board</p>
            ) : students.length === 0 ? (
              <p className="border-y border-rule py-8 text-ink-muted">No students on this board yet.</p>
            ) : (
              <table className="w-full border-collapse tnum">
                <caption className="sr-only">Student leaderboard: {boardName}. {rankedBy}</caption>
                <thead>
                  <tr className="border-b border-rule-strong">
                    <th scope="col" className={cn(TH, 'w-16 pl-3')}>Rank</th>
                    <th scope="col" className={TH}>Student</th>
                    <th scope="col" className={cn(TH, 'hidden md:table-cell')}>Ages</th>
                    <th scope="col" className={cn(TH, 'text-right')}>{bySubject ? 'Avg score' : 'Points'}</th>
                    <th scope="col" className={cn(TH, 'hidden text-right sm:table-cell')}>Streak</th>
                    <th scope="col" className={cn(TH, 'hidden pr-3 text-right sm:table-cell')}>Quizzes</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => {
                    const isMe = s.user_id === user.id;
                    return (
                      <tr
                        key={s.user_id}
                        className={cn('border-b border-rule', isMe && 'bg-brand-tint')}
                        data-testid={`leaderboard-row-${s.rank}`}
                      >
                        <td className={cn(TD, 'pl-3')}>
                          <span className="t-num text-lg">{s.rank}</span>
                        </td>
                        <th scope="row" className={cn(TD, 'text-left font-normal')}>
                          <span className="font-semibold text-ink">{s.full_name}</span>
                          {isMe && <span className="text-ink-muted"> (you)</span>}
                          <span className="block text-sm text-ink-muted">@{s.username}</span>
                        </th>
                        <td className={cn(TD, 'hidden text-ink-muted md:table-cell')}>{s.age_group || ''}</td>
                        <td className={cn(TD, 'text-right')}>
                          <span className="t-num text-lg text-ink">
                            {bySubject ? `${formatNumber(s.avg_score)}%` : formatNumber(s.points)}
                          </span>
                        </td>
                        <td className={cn(TD, 'hidden text-right sm:table-cell')}>
                          <span className="t-num">{formatNumber(s.streak_days)}</span>
                          <span className="text-sm text-ink-muted"> {s.streak_days === 1 ? 'day' : 'days'}</span>
                        </td>
                        <td className={cn(TD, 'hidden pr-3 text-right sm:table-cell')}>
                          <span className="t-num">{formatNumber(s.quizzes_completed)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="teachers" className="mt-6">
          <div className="grid gap-x-10 gap-y-12 lg:grid-cols-2">
            <section aria-labelledby="best-teachers-title" data-testid="best-teachers-card">
              <h2 id="best-teachers-title" className="t-h3">Best teachers</h2>
              <p className="t-cap mt-1">75% professional contests hosted, 25% their students' streaks and quiz scores.</p>
              {teachers.best.length === 0 ? (
                <p className="mt-4 border-y border-rule py-6 text-ink-muted">No teachers yet.</p>
              ) : (
                <div className="glass glass-strong mt-4 overflow-x-auto rounded-[24px] px-5 py-2">
                  <table className="w-full border-collapse tnum">
                    <caption className="sr-only">Best teachers</caption>
                    <thead>
                      <tr className="border-b border-rule-strong">
                        <th scope="col" className={cn(TH, 'w-14 pl-3')}>Rank</th>
                        <th scope="col" className={TH}>Teacher</th>
                        <th scope="col" className={cn(TH, 'pr-3 text-right')}>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.best.map((t) => (
                        <tr
                          key={t.user_id}
                          className={cn('border-b border-rule', t.user_id === user.id && 'bg-brand-tint')}
                          data-testid={`best-teacher-row-${t.rank}`}
                        >
                          <td className={cn(TD, 'pl-3')}><span className="t-num text-lg">{t.rank}</span></td>
                          <th scope="row" className={cn(TD, 'text-left font-normal')}>
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              <span className="font-semibold text-ink">{t.full_name}</span>
                              {t.verified && <Verified />}
                            </span>
                            <span className="block text-sm text-ink-muted">
                              {formatNumber(t.pro_tournaments)} pro {t.pro_tournaments === 1 ? 'contest' : 'contests'}, {formatNumber(t.students_count)} {t.students_count === 1 ? 'student' : 'students'}
                            </span>
                          </th>
                          <td className={cn(TD, 'pr-3 text-right')}>
                            <span className="t-num text-lg text-ink">{formatNumber(t.score, 1)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section aria-labelledby="popular-teachers-title" data-testid="popular-teachers-card">
              <h2 id="popular-teachers-title" className="t-h3">Most popular</h2>
              <p className="t-cap mt-1">How many of their students competed in contests.</p>
              {teachers.popular.length === 0 ? (
                <p className="mt-4 border-y border-rule py-6 text-ink-muted">No teachers yet.</p>
              ) : (
                <div className="glass glass-strong mt-4 overflow-x-auto rounded-[24px] px-5 py-2">
                  <table className="w-full border-collapse tnum">
                    <caption className="sr-only">Most popular teachers</caption>
                    <thead>
                      <tr className="border-b border-rule-strong">
                        <th scope="col" className={cn(TH, 'w-14 pl-3')}>Rank</th>
                        <th scope="col" className={TH}>Teacher</th>
                        <th scope="col" className={cn(TH, 'pr-3 text-right')}>Competing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teachers.popular.map((t) => (
                        <tr
                          key={t.user_id}
                          className={cn('border-b border-rule', t.user_id === user.id && 'bg-brand-tint')}
                          data-testid={`popular-teacher-row-${t.rank}`}
                        >
                          <td className={cn(TD, 'pl-3')}><span className="t-num text-lg">{t.rank}</span></td>
                          <th scope="row" className={cn(TD, 'text-left font-normal')}>
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                              <span className="font-semibold text-ink">{t.full_name}</span>
                              {t.verified && <Verified />}
                            </span>
                            <span className="block text-sm text-ink-muted">
                              {formatNumber(t.students_count)} mentored {t.students_count === 1 ? 'student' : 'students'}
                            </span>
                          </th>
                          <td className={cn(TD, 'pr-3 text-right')}>
                            <span className="t-num text-lg text-ink">{formatNumber(t.tournament_students)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default LeaderboardPage;
