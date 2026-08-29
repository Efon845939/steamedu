import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import axios from 'axios';

const Stat = ({ emoji, value, label, testid }) => (
  <div className="text-center p-3 bg-white/60 rounded-xl" data-testid={testid}>
    <div className="text-2xl">{emoji}</div>
    <div className="text-xl font-bold text-gray-900">{value}</div>
    <div className="text-xs text-gray-600">{label}</div>
  </div>
);

export const WeeklyRecap = () => {
  const { API } = useContext(AuthContext);
  const [recap, setRecap] = useState(null);

  useEffect(() => {
    axios.get(`${API}/stats/weekly`).then((r) => setRecap(r.data)).catch(console.error);
  }, [API]);

  if (!recap) return null;

  return (
    <Card className="bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 border-2 border-indigo-100 mb-8" data-testid="weekly-recap-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="text-2xl">📅</span> Your Week in Review
        </CardTitle>
        <CardDescription>
          {recap.points_week > 0
            ? `You earned ${recap.points_week} points this week — keep the momentum going!`
            : 'A fresh week awaits — take a quiz to get on the board!'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
          <Stat emoji="⭐" value={`+${recap.points_week}`} label="points this week" testid="recap-points" />
          <Stat emoji="📝" value={recap.quizzes_week} label="quizzes taken" testid="recap-quizzes" />
          <Stat emoji="🎯" value={recap.activities_week} label="activities done" testid="recap-activities" />
          <Stat emoji="🔥" value={`${recap.active_days}/7`} label="active days" testid="recap-active-days" />
          <Stat emoji="✅" value={recap.challenges_week} label="challenges done" testid="recap-challenges" />
          <Stat emoji="🏆" value={recap.certificates_week} label="certificates won" testid="recap-certificates" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-indigo-100 text-indigo-800" data-testid="recap-rank-general">
            🌍 #{recap.rank_general} overall (all ages)
          </Badge>
          {recap.rank_age_group && (
            <Badge className="bg-violet-100 text-violet-800" data-testid="recap-rank-age">
              🎓 #{recap.rank_age_group} in ages {recap.age_group}
            </Badge>
          )}
          {recap.best_quiz && (
            <Badge variant="outline" data-testid="recap-best-quiz">
              🌟 Best: {recap.best_quiz.title} ({recap.best_quiz.score}%)
            </Badge>
          )}
          <Badge variant="outline">🔥 {recap.streak_days}-day streak</Badge>
        </div>
      </CardContent>
    </Card>
  );
};
