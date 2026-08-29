import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { SUBJECTS, AGE_GROUPS, subjectEmoji } from '../lib/steam';
import { BadgeCheck, Trophy, Medal } from 'lucide-react';

const rankBadge = (rank) => {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
};

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
  }, [ageGroup, subject]);

  useEffect(() => {
    axios.get(`${API}/leaderboard/teachers`).then((res) => setTeachers(res.data)).catch(console.error);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Leaderboards 🏆</h1>
          <p className="text-lg text-gray-600">The best students across all ages — and the teachers who inspire them.</p>
        </div>

        <Tabs defaultValue="students" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
            <TabsTrigger value="students" data-testid="students-leaderboard-tab">Students</TabsTrigger>
            <TabsTrigger value="teachers" data-testid="teachers-leaderboard-tab">Teachers</TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <div className="flex flex-col sm:flex-row gap-4 mb-6 justify-center">
              <Select value={ageGroup} onValueChange={setAgeGroup}>
                <SelectTrigger className="w-48" data-testid="leaderboard-age-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">🌍 All Ages (General)</SelectItem>
                  {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>Ages {g}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger className="w-48" data-testid="leaderboard-subject-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects (by points)</SelectItem>
                  {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{subjectEmoji(s)} {s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-white/80 backdrop-blur-sm" data-testid="students-leaderboard-card">
              <CardContent className="pt-6">
                {loading ? (
                  <p className="text-center text-gray-500 py-8">Loading...</p>
                ) : students.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No students on this board yet.</p>
                ) : (
                  <div className="space-y-2">
                    {students.map((s) => (
                      <div
                        key={s.user_id}
                        className={`flex items-center justify-between p-4 rounded-xl transition-colors ${
                          s.user_id === user.id
                            ? 'bg-emerald-50 border-2 border-emerald-300'
                            : s.rank <= 3 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'bg-gray-50'
                        }`}
                        data-testid={`leaderboard-row-${s.rank}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-xl font-bold w-10 text-center">{rankBadge(s.rank)}</span>
                          <div>
                            <h4 className="font-semibold text-sm">
                              {s.full_name} {s.user_id === user.id && <span className="text-emerald-600">(you)</span>}
                            </h4>
                            <p className="text-xs text-gray-500">@{s.username} • Ages {s.age_group}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-sm">
                          {subject !== 'all' ? (
                            <Badge className="bg-blue-100 text-blue-800">avg {s.avg_score}%</Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-800">⭐ {s.points} pts</Badge>
                          )}
                          <Badge variant="outline" className="hidden sm:inline-flex">🔥 {s.streak_days}</Badge>
                          <Badge variant="outline" className="hidden sm:inline-flex">📝 {s.quizzes_completed}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teachers">
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white/80 backdrop-blur-sm" data-testid="best-teachers-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Best Teachers</CardTitle>
                  <CardDescription>75% professional tournaments hosted, 25% student streaks & quiz scores</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teachers.best.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">No teachers yet.</p>
                  ) : teachers.best.map((t) => (
                    <div key={t.user_id} className={`flex items-center justify-between p-3 rounded-lg ${t.rank <= 3 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'bg-gray-50'}`} data-testid={`best-teacher-row-${t.rank}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold w-8 text-center">{rankBadge(t.rank)}</span>
                        <div>
                          <h4 className="font-semibold text-sm flex items-center gap-1">
                            {t.full_name}
                            {t.verified && <BadgeCheck className="w-4 h-4 text-sky-500" />}
                          </h4>
                          <p className="text-xs text-gray-500">{t.pro_tournaments} pro tournaments • {t.students_count} students</p>
                        </div>
                      </div>
                      <Badge className="bg-amber-100 text-amber-800">{t.score}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-white/80 backdrop-blur-sm" data-testid="popular-teachers-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Medal className="w-5 h-5 text-purple-500" />Most Popular</CardTitle>
                  <CardDescription>Number of their students who competed in tournaments</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {teachers.popular.length === 0 ? (
                    <p className="text-center text-gray-500 py-6">No teachers yet.</p>
                  ) : teachers.popular.map((t) => (
                    <div key={t.user_id} className={`flex items-center justify-between p-3 rounded-lg ${t.rank <= 3 ? 'bg-gradient-to-r from-purple-50 to-fuchsia-50' : 'bg-gray-50'}`} data-testid={`popular-teacher-row-${t.rank}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold w-8 text-center">{rankBadge(t.rank)}</span>
                        <div>
                          <h4 className="font-semibold text-sm flex items-center gap-1">
                            {t.full_name}
                            {t.verified && <BadgeCheck className="w-4 h-4 text-sky-500" />}
                          </h4>
                          <p className="text-xs text-gray-500">{t.students_count} mentored students</p>
                        </div>
                      </div>
                      <Badge className="bg-purple-100 text-purple-800">{t.tournament_students} competing</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LeaderboardPage;
