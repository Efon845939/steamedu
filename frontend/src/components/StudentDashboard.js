import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../App';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { subjectEmoji, formatApiError, firstName } from '../lib/steam';
import { Flame, Star, Trophy, Award, CheckCircle2 } from 'lucide-react';
import { WeeklyRecap } from './WeeklyRecap';
import { CertificateModal } from './CertificateModal';
import { BadgesCard } from './BadgesCard';
import { StudentAnnouncements } from './StudentAnnouncements';
import { notifyNewBadges } from '../lib/badges';

const StudentDashboard = ({ stats, refreshStats }) => {
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();
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
      toast.success(`Challenge complete! +${res.data.points_earned} points 🎉`);
      notifyNewBadges(res.data.new_badges);
      setBadgeKey((k) => k + 1);
      fetchExtras();
      refreshStats();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8" data-testid="dashboard-header">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Welcome back, {firstName(user.full_name)}! 👋
            </h1>
            <div className="text-xl text-gray-600">
              {stats.teacher_name
                ? <>Your mentor: <span className="font-semibold text-emerald-700" data-testid="mentor-name">{stats.teacher_name}</span></>
                : 'No mentor yet — your teacher can add you using your username.'}
              {stats.age_group && <Badge variant="outline" className="ml-3">Age group {stats.age_group}</Badge>}
            </div>
          </div>
          <div className="flex gap-3 mt-4 sm:mt-0">
            <div className="flex items-center gap-2 bg-white/80 rounded-xl px-4 py-2 shadow" data-testid="points-badge">
              <Star className="w-5 h-5 text-yellow-500" />
              <span className="font-bold text-gray-900">{stats.points}</span>
              <span className="text-sm text-gray-500">pts</span>
            </div>
            <div className="flex items-center gap-2 bg-white/80 rounded-xl px-4 py-2 shadow" data-testid="streak-badge">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="font-bold text-gray-900">{stats.streak_days}</span>
              <span className="text-sm text-gray-500">day streak</span>
            </div>
          </div>
        </div>

        {/* Real Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quizzes Completed</CardTitle>
              <span className="text-2xl">📝</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600" data-testid="quizzes-completed-stat">
                {stats.quizzes_completed}<span className="text-base text-gray-400">/{stats.total_quizzes}</span>
              </div>
              <p className="text-xs text-muted-foreground">Average score: {stats.avg_score}%</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Activities Completed</CardTitle>
              <span className="text-2xl">🎯</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="activities-completed-stat">
                {stats.activities_completed}<span className="text-base text-gray-400">/{stats.total_activities}</span>
              </div>
              <p className="text-xs text-muted-foreground">Hands-on learning done</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Learning Progress</CardTitle>
              <span className="text-2xl">📊</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid="learning-progress-stat">{stats.progress}%</div>
              <Progress value={stats.progress} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Of all content for your age group</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ideas & Awards</CardTitle>
              <span className="text-2xl">💡</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="ideas-shared-stat">
                {stats.ideas_shared} <span className="text-sm font-normal text-gray-500">ideas</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.certificates} certificate{stats.certificates !== 1 && 's'} • {stats.badges_earned}/{stats.badges_total} badges
              </p>
            </CardContent>
          </Card>
        </div>

        <WeeklyRecap />

        <BadgesCard reloadKey={badgeKey} />

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <StudentAnnouncements />

          {/* Daily Challenges */}
          <Card className="bg-white/70 backdrop-blur-sm" data-testid="daily-challenges-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-2xl">🔥</span>
                <span>Today's Challenges</span>
              </CardTitle>
              <CardDescription>
                {stats.teacher_name ? `Set by ${stats.teacher_name}` : 'Get a mentor to receive daily challenges'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {challenges.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center" data-testid="no-challenges-msg">
                  No challenges for today yet. Check back later!
                </p>
              ) : (
                challenges.map((ch) => (
                  <div key={ch.id} className={`p-4 rounded-lg border-2 ${ch.completed ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`} data-testid={`challenge-${ch.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-semibold text-sm flex items-center gap-2">
                          {ch.completed && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                          {ch.title}
                          <Badge variant="outline" className="text-xs">+{ch.points} pts</Badge>
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">{ch.description}</p>
                      </div>
                      {!ch.completed && (
                        ch.type === 'quiz' ? (
                          <Button size="sm" onClick={() => navigate(`/quiz/${ch.quiz_id}`)} className="bg-emerald-600 hover:bg-emerald-700 shrink-0" data-testid={`challenge-quiz-btn-${ch.id}`}>
                            Take Quiz
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => completeTask(ch)} className="border-emerald-600 text-emerald-600 shrink-0" data-testid={`challenge-complete-btn-${ch.id}`}>
                            Mark Done
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

        </div>

        <div className="mb-8">
          {/* Quick Actions */}
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-2xl">🚀</span>
                <span>Quick Actions</span>
              </CardTitle>
              <CardDescription>Jump into your learning activities</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              <Link to="/quiz"><Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700" data-testid="take-quiz-btn">📝 Quizzes</Button></Link>
              <Link to="/activities"><Button variant="outline" className="w-full justify-start border-purple-600 text-purple-600 hover:bg-purple-50" data-testid="explore-activities-btn">🎯 Activities</Button></Link>
              <Link to="/contests"><Button variant="outline" className="w-full justify-start border-amber-600 text-amber-600 hover:bg-amber-50" data-testid="contests-btn"><Trophy className="w-4 h-4 mr-2" />Contests</Button></Link>
              <Link to="/leaderboard"><Button variant="outline" className="w-full justify-start border-blue-600 text-blue-600 hover:bg-blue-50" data-testid="leaderboard-btn">🏆 Leaderboard</Button></Link>
              <Link to="/content"><Button variant="outline" className="w-full justify-start border-green-600 text-green-600 hover:bg-green-50" data-testid="browse-content-btn">📚 Content</Button></Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          {/* Recent quiz results */}
          <Card className="bg-white/70 backdrop-blur-sm" data-testid="recent-results-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-2xl">📈</span>
                <span>Recent Quiz Results</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recent_attempts.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No quizzes taken yet — start one now!</p>
              ) : (
                <div className="space-y-3">
                  {stats.recent_attempts.map((a) => (
                    <div key={`${a.quiz_title}-${a.completed_at}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-sm">{a.quiz_title}</h4>
                        <p className="text-xs text-gray-500">{new Date(a.completed_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={a.score >= 80 ? 'bg-emerald-100 text-emerald-800' : a.score >= 60 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}>
                        {a.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Certificates */}
          <Card className="bg-white/70 backdrop-blur-sm" data-testid="certificates-card">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-6 h-6 text-amber-500" />
                <span>My Certificates</span>
              </CardTitle>
              <CardDescription>Win contests to earn certificates — click one to print it</CardDescription>
            </CardHeader>
            <CardContent>
              {certificates.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">
                  No certificates yet. Join a contest and finish first! 🏆
                </p>
              ) : (
                <div className="space-y-3">
                  {certificates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCert(c)}
                      className="w-full text-left p-4 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:shadow-md transition-shadow"
                      data-testid={`certificate-${c.id}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h4 className="font-bold text-sm text-amber-900">Champion — {c.tournament_title}</h4>
                        {c.is_professional && <Badge className="bg-sky-100 text-sky-800 text-xs">Professional</Badge>}
                      </div>
                      <p className="text-xs text-amber-800">
                        {subjectEmoji(c.subject)} {c.subject} • Hosted by {c.teacher_name} • {new Date(c.awarded_at).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-amber-600 font-semibold mt-1">🖨️ View & print certificate</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Subject progress */}
        <Card className="bg-white/70 backdrop-blur-sm" data-testid="learning-path-card">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <span>Your Learning Path</span>
            </CardTitle>
            <CardDescription>Real progress in every STEAM subject</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {stats.subject_progress.map((sp, index) => (
                <div key={sp.subject} className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg hover:shadow-md transition-all duration-300" data-testid={`subject-progress-${sp.subject.toLowerCase()}`}>
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold ${
                    ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-pink-500', 'bg-orange-500'][index]
                  }`}>
                    {sp.subject[0]}
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900">{sp.subject}</h3>
                  <Progress value={sp.pct} className="mt-2 h-2" />
                  <p className="text-xs text-gray-500 mt-1">{sp.completed}/{sp.total} done</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <CertificateModal certificate={selectedCert} onClose={() => setSelectedCert(null)} />
      </div>
    </div>
  );
};

export default StudentDashboard;
