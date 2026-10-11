import React, { useState, useEffect, useContext } from 'react';
import { CalendarDays, CheckCircle2, Flame, Globe, GraduationCap, BookOpen, Star, Target, Trophy } from 'lucide-react';
import axios from 'axios';
import { AuthContext } from '../App';
import { GlassPanel } from './lab';

const Stat = ({ icon: Icon, value, label, testid }) => (
  <div className="flex items-center gap-3 rounded-2xl border border-rule/50 bg-surface/45 px-4 py-3" data-testid={testid}>
    <Icon className="h-5 w-5 shrink-0 text-brand-ink" aria-hidden="true" />
    <div className="flex flex-col">
      <span className="t-num text-xl leading-tight">{value}</span>
      <span className="text-xs text-ink-muted">{label}</span>
    </div>
  </div>
);

const Chip = ({ icon: Icon, children, testid }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-rule-strong/40 bg-surface/50 px-3 py-1 text-sm" data-testid={testid}>
    <Icon className="h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
    <span>{children}</span>
  </span>
);

export const WeeklyRecap = () => {
  const { API } = useContext(AuthContext);
  const [recap, setRecap] = useState(null);

  useEffect(() => {
    axios.get(`${API}/stats/weekly`).then((r) => setRecap(r.data)).catch(console.error);
  }, [API]);

  if (!recap) return null;

  return (
    <GlassPanel
      icon={CalendarDays}
      title="Your week"
      description={
        recap.points_week > 0
          ? `You earned ${recap.points_week} points this week. Keep the streak going.`
          : 'A fresh week. One quiz puts you on the board.'
      }
      data-testid="weekly-recap-card"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Star} value={`+${recap.points_week}`} label="points this week" testid="recap-points" />
        <Stat icon={BookOpen} value={recap.quizzes_week} label="quizzes taken" testid="recap-quizzes" />
        <Stat icon={Target} value={recap.activities_week} label="activities done" testid="recap-activities" />
        <Stat icon={Flame} value={`${recap.active_days}/7`} label="active days" testid="recap-active-days" />
        <Stat icon={CheckCircle2} value={recap.challenges_week} label="challenges done" testid="recap-challenges" />
        <Stat icon={Trophy} value={recap.certificates_week} label="certificates won" testid="recap-certificates" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip icon={Globe} testid="recap-rank-general">
          <span className="t-num">#{recap.rank_general}</span> overall
        </Chip>
        {recap.rank_age_group && (
          <Chip icon={GraduationCap} testid="recap-rank-age">
            <span className="t-num">#{recap.rank_age_group}</span> in ages {recap.age_group}
          </Chip>
        )}
        {recap.best_quiz && (
          <Chip icon={Star} testid="recap-best-quiz">
            Best: {recap.best_quiz.title} (<span className="t-num">{recap.best_quiz.score}%</span>)
          </Chip>
        )}
        <Chip icon={Flame}>
          <span className="t-num">{recap.streak_days}</span>-day streak
        </Chip>
      </div>
    </GlassPanel>
  );
};
