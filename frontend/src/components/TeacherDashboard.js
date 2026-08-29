import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../App';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Progress } from './ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import axios from 'axios';
import { toast } from 'sonner';
import { SUBJECTS, AGE_GROUPS, formatApiError } from '../lib/steam';
import { BadgeCheck, Trophy, MessageCircle, Users } from 'lucide-react';
import { TeacherAnnouncements } from './TeacherAnnouncements';

const TeacherDashboard = ({ stats, refreshStats }) => {
  const { user, setUser, API } = useContext(AuthContext);
  const [students, setStudents] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [newChallenge, setNewChallenge] = useState({ title: '', description: '', type: 'task', quiz_id: '', points: 20 });
  const [newTournament, setNewTournament] = useState({ title: '', description: '', subject: 'Science', age_group: 'all', scope: 'class', quiz_id: '', duration_days: 7 });

  const fetchAll = useCallback(async () => {
    try {
      const [stRes, chRes, tRes, qRes] = await Promise.all([
        axios.get(`${API}/teacher/students`),
        axios.get(`${API}/challenges/mine`),
        axios.get(`${API}/tournaments`),
        axios.get(`${API}/quizzes`),
      ]);
      setStudents(stRes.data);
      setChallenges(chRes.data);
      setTournaments(tRes.data.filter((t) => t.teacher_id === user.id));
      setQuizzes(qRes.data);
    } catch (e) {
      console.error(e);
    }
  }, [API, user.id]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createChallenge = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/challenges`, {
        ...newChallenge,
        points: parseInt(newChallenge.points, 10) || 20,
        quiz_id: newChallenge.type === 'quiz' ? newChallenge.quiz_id : null,
      });
      toast.success('Daily challenge created! Your students will see it today.');
      setChallengeOpen(false);
      setNewChallenge({ title: '', description: '', type: 'task', quiz_id: '', points: 20 });
      fetchAll();
      refreshStats();
      const me = await axios.get(`${API}/auth/me`);
      setUser(me.data);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const createTournament = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/tournaments`, {
        ...newTournament,
        duration_days: parseInt(newTournament.duration_days, 10) || 7,
      });
      toast.success('Contest created! 🏆');
      setTournamentOpen(false);
      setNewTournament({ title: '', description: '', subject: 'Science', age_group: 'all', scope: 'class', quiz_id: '', duration_days: 7 });
      fetchAll();
      refreshStats();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8" data-testid="teacher-dashboard-header">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              Teacher Dashboard
              {stats.verified && <BadgeCheck className="w-8 h-8 text-sky-500" data-testid="teacher-verified-badge" />}
            </h1>
            <p className="text-xl text-gray-600">
              Welcome, {user.full_name}! {stats.verified ? 'You are a verified educator.' : 'Complete the requirements to get verified.'}
            </p>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <Link to="/chat"><Button variant="outline" className="border-teal-600 text-teal-600" data-testid="teacher-chat-btn"><MessageCircle className="w-4 h-4 mr-2" />Chat with Students</Button></Link>
            <Link to="/leaderboard"><Button variant="outline" className="border-amber-600 text-amber-600" data-testid="teacher-leaderboard-btn"><Trophy className="w-4 h-4 mr-2" />Leaderboards</Button></Link>
          </div>
        </div>

        {/* Verification progress */}
        {!stats.verified && (
          <Card className="bg-gradient-to-r from-sky-50 to-blue-50 border-2 border-sky-200 mb-8" data-testid="verification-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BadgeCheck className="w-6 h-6 text-sky-500" />
                Get Your Verified Checkmark
              </CardTitle>
              <CardDescription>
                Verified teachers can host open professional contests whose winners earn certificates.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Mentor at least {stats.requirements.min_students} students</span>
                  <span className="font-bold">{stats.students_count}/{stats.requirements.min_students}</span>
                </div>
                <Progress value={Math.min(100, (stats.students_count / stats.requirements.min_students) * 100)} />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Create at least {stats.requirements.min_challenges} daily challenges</span>
                  <span className="font-bold">{stats.challenges_count}/{stats.requirements.min_challenges}</span>
                </div>
                <Progress value={Math.min(100, (stats.challenges_count / stats.requirements.min_challenges) * 100)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'My Students', value: stats.students_count, emoji: '🎓', testid: 'students-count-stat' },
            { label: 'Challenges Created', value: stats.challenges_count, emoji: '🔥', testid: 'challenges-count-stat' },
            { label: 'Contests Hosted', value: stats.tournaments_count, emoji: '🏆', testid: 'tournaments-count-stat' },
            { label: 'Professional Contests', value: stats.pro_tournaments, emoji: '⭐', testid: 'pro-tournaments-stat' },
          ].map((s) => (
            <Card key={s.label} className="bg-white/70 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <span className="text-2xl">{s.emoji}</span>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600" data-testid={s.testid}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-4 mb-8">
          <Dialog open={challengeOpen} onOpenChange={setChallengeOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="create-challenge-btn">🔥 Create Daily Challenge</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create Today's Challenge</DialogTitle>
                <DialogDescription>Your students will see this on their dashboard today.</DialogDescription>
              </DialogHeader>
              <form onSubmit={createChallenge} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newChallenge.title} onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })} required placeholder="e.g. Ace the Geometry quiz" data-testid="challenge-title-input" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newChallenge.description} onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })} placeholder="What should students do?" data-testid="challenge-description-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newChallenge.type} onValueChange={(v) => setNewChallenge({ ...newChallenge, type: v })}>
                      <SelectTrigger data-testid="challenge-type-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="task">Simple Task</SelectItem>
                        <SelectItem value="quiz">Linked Quiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Points</Label>
                    <Input type="number" min="5" max="100" value={newChallenge.points} onChange={(e) => setNewChallenge({ ...newChallenge, points: e.target.value })} data-testid="challenge-points-input" />
                  </div>
                </div>
                {newChallenge.type === 'quiz' && (
                  <div className="space-y-2">
                    <Label>Quiz</Label>
                    <Select value={newChallenge.quiz_id} onValueChange={(v) => setNewChallenge({ ...newChallenge, quiz_id: v })}>
                      <SelectTrigger data-testid="challenge-quiz-select"><SelectValue placeholder="Pick a quiz" /></SelectTrigger>
                      <SelectContent>
                        {quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title} ({q.subject})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid="submit-challenge-btn">Create Challenge</Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={tournamentOpen} onOpenChange={setTournamentOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700" data-testid="create-tournament-btn">🏆 Create Contest</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Create a Contest</DialogTitle>
                <DialogDescription>
                  {stats.verified
                    ? 'As a verified teacher your contests are professional — winners earn certificates.'
                    : 'Unverified teachers can host class contests for their own students only.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createTournament} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={newTournament.title} onChange={(e) => setNewTournament({ ...newTournament, title: e.target.value })} required placeholder="e.g. Winter Math Sprint" data-testid="tournament-title-input" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={newTournament.description} onChange={(e) => setNewTournament({ ...newTournament, description: e.target.value })} data-testid="tournament-description-input" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={newTournament.subject} onValueChange={(v) => setNewTournament({ ...newTournament, subject: v })}>
                      <SelectTrigger data-testid="tournament-subject-select"><SelectValue /></SelectTrigger>
                      <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Age Group</Label>
                    <Select value={newTournament.age_group} onValueChange={(v) => setNewTournament({ ...newTournament, age_group: v })}>
                      <SelectTrigger data-testid="tournament-age-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All ages</SelectItem>
                        {AGE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Scope</Label>
                    <Select value={newTournament.scope} onValueChange={(v) => setNewTournament({ ...newTournament, scope: v })}>
                      <SelectTrigger data-testid="tournament-scope-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="class">My students only</SelectItem>
                        <SelectItem value="open" disabled={!stats.verified}>Open to everyone {!stats.verified && '(verified only)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (days)</Label>
                    <Input type="number" min="1" max="60" value={newTournament.duration_days} onChange={(e) => setNewTournament({ ...newTournament, duration_days: e.target.value })} data-testid="tournament-duration-input" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contest Quiz</Label>
                  <Select value={newTournament.quiz_id} onValueChange={(v) => setNewTournament({ ...newTournament, quiz_id: v })}>
                    <SelectTrigger data-testid="tournament-quiz-select"><SelectValue placeholder="Pick the quiz students will compete on" /></SelectTrigger>
                    <SelectContent>
                      {quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title} ({q.subject})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full bg-amber-600 hover:bg-amber-700" disabled={!newTournament.quiz_id} data-testid="submit-tournament-btn">Create Contest</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-8">
          <TeacherAnnouncements studentsCount={students.length} />
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Students */}
          <Card className="bg-white/70 backdrop-blur-sm" data-testid="students-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-6 h-6 text-emerald-600" />My Students</CardTitle>
              <CardDescription>Add students by chatting with them and clicking "Add as my student"</CardDescription>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-3">No students yet.</p>
                  <Link to="/chat"><Button variant="outline" className="border-emerald-600 text-emerald-600" data-testid="find-students-btn">Find students via Chat</Button></Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`student-row-${s.username}`}>
                      <div>
                        <h4 className="font-semibold text-sm">{s.full_name} <span className="text-gray-400 font-normal">@{s.username}</span></h4>
                        <p className="text-xs text-gray-600">
                          Age {s.age_group} • {s.quizzes_completed} quizzes • avg {s.avg_score}% • {s.activities_completed} activities
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-100 text-yellow-800">⭐ {s.points}</Badge>
                        <Badge className="bg-orange-100 text-orange-800">🔥 {s.streak_days}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* My challenges */}
          <Card className="bg-white/70 backdrop-blur-sm" data-testid="my-challenges-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><span className="text-2xl">🔥</span>My Daily Challenges</CardTitle>
            </CardHeader>
            <CardContent>
              {challenges.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No challenges yet — create your first one!</p>
              ) : (
                <div className="space-y-3">
                  {challenges.slice(0, 6).map((ch) => (
                    <div key={ch.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-sm">{ch.title}</h4>
                        <p className="text-xs text-gray-600">{ch.date} • {ch.type === 'quiz' ? 'Quiz challenge' : 'Task'} • +{ch.points} pts</p>
                      </div>
                      <Badge variant="outline">{ch.completions} done</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* My tournaments */}
        <Card className="bg-white/70 backdrop-blur-sm" data-testid="my-tournaments-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="w-6 h-6 text-amber-500" />My Contests</CardTitle>
          </CardHeader>
          <CardContent>
            {tournaments.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">No contests yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {tournaments.map((t) => (
                  <Link key={t.id} to="/contests" className="block">
                    <div className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{t.title}</h4>
                        {t.is_professional && <Badge className="bg-sky-100 text-sky-800 text-xs">Professional</Badge>}
                        <Badge className={t.status === 'active' ? 'bg-emerald-100 text-emerald-800 text-xs' : 'bg-gray-200 text-gray-700 text-xs'}>{t.status}</Badge>
                      </div>
                      <p className="text-xs text-gray-600">
                        {t.subject} • {t.age_group === 'all' ? 'All ages' : `Ages ${t.age_group}`} • {t.participants} participants • ends {new Date(t.end_at).toLocaleDateString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeacherDashboard;
