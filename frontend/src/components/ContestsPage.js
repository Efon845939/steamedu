import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { Trophy, BadgeCheck, Users, Clock, ArrowLeft } from 'lucide-react';

const statusBadge = (status) => ({
  active: 'bg-emerald-100 text-emerald-800',
  upcoming: 'bg-blue-100 text-blue-800',
  ended: 'bg-gray-200 text-gray-700',
}[status]);

const ContestsPage = () => {
  const { user, API } = useContext(AuthContext);
  const [contests, setContests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [taking, setTaking] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const fetchContests = async () => {
    try {
      const res = await axios.get(`${API}/tournaments`);
      setContests(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContests();
  }, []);

  const openDetail = async (id) => {
    try {
      const res = await axios.get(`${API}/tournaments/${id}`);
      setDetail(res.data);
      setTaking(false);
      setResult(null);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const joinContest = async (t) => {
    try {
      await axios.post(`${API}/tournaments/${t.id}/join`);
      toast.success(`Joined "${t.title}"! Take the quiz whenever you're ready.`);
      fetchContests();
      if (detail?.id === t.id) openDetail(t.id);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const startAttempt = async () => {
    try {
      const res = await axios.get(`${API}/quizzes/${detail.quiz_id}`);
      setQuiz(res.data);
      setAnswers({});
      setTaking(true);
    } catch (e) {
      toast.error('Could not load the contest quiz');
    }
  };

  const submitAttempt = async () => {
    const answerList = quiz.questions.map((_, i) => ({ question_index: i, selected: answers[i] || null }));
    try {
      const res = await axios.post(`${API}/tournaments/${detail.id}/submit`, { answers: answerList });
      setResult(res.data);
      setTaking(false);
      toast.success(`Submitted! You scored ${res.data.score}% — currently rank #${res.data.rank} 🏆`);
      fetchContests();
      openDetail(detail.id);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  // ---------- Quiz taking view ----------
  if (detail && taking && quiz) {
    const allAnswered = quiz.questions.every((_, i) => answers[i]);
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="bg-white/90 backdrop-blur-sm shadow-xl mb-6">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Trophy className="w-6 h-6 text-amber-500" /> {detail.title}
              </CardTitle>
              <CardDescription>
                One attempt only — answer all {quiz.questions.length} questions, then submit. Good luck!
              </CardDescription>
            </CardHeader>
          </Card>

          {quiz.questions.map((q, qi) => (
            <Card key={qi} className="bg-white/90 backdrop-blur-sm mb-4" data-testid={`contest-question-${qi}`}>
              <CardHeader>
                <CardTitle className="text-base">{qi + 1}. {q.question}</CardTitle>
              </CardHeader>
              <CardContent className="grid sm:grid-cols-2 gap-2">
                {q.options.map((opt, oi) => (
                  <button
                    key={oi}
                    onClick={() => setAnswers({ ...answers, [qi]: opt })}
                    className={`p-3 text-left text-sm rounded-lg border-2 transition-all ${
                      answers[qi] === opt
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-gray-200 bg-white hover:border-amber-200'
                    }`}
                    data-testid={`contest-q${qi}-option-${oi}`}
                  >
                    {opt}
                  </button>
                ))}
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setTaking(false)} data-testid="cancel-contest-attempt-btn">Cancel</Button>
            <Button
              onClick={submitAttempt}
              disabled={!allAnswered}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="submit-contest-attempt-btn"
            >
              Submit Final Answers
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Detail view ----------
  if (detail) {
    const myEntry = detail.ranking.find((e) => e.student_id === user.id)
      || detail.pending.find((e) => e.student_id === user.id);
    const listItem = contests.find((t) => t.id === detail.id);
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Button variant="ghost" onClick={() => setDetail(null)} className="mb-4 text-gray-600" data-testid="back-to-contests-btn">
            <ArrowLeft className="w-4 h-4 mr-2" /> All contests
          </Button>

          <Card className="bg-white/90 backdrop-blur-sm shadow-xl mb-6" data-testid="contest-detail-card">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Badge className={statusBadge(detail.status)}>{detail.status}</Badge>
                {detail.is_professional && <Badge className="bg-sky-100 text-sky-800">⭐ Professional</Badge>}
                <Badge className={subjectBadgeColor(detail.subject)}>{subjectEmoji(detail.subject)} {detail.subject}</Badge>
                <Badge variant="outline">{detail.age_group === 'all' ? 'All ages' : `Ages ${detail.age_group}`}</Badge>
                <Badge variant="outline">{detail.scope === 'open' ? 'Open to everyone' : 'Class only'}</Badge>
              </div>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Trophy className="w-8 h-8 text-amber-500" /> {detail.title}
              </CardTitle>
              <CardDescription className="text-base">
                {detail.description} <br />
                Hosted by <span className="font-semibold">{detail.teacher_name}</span> • Quiz: {detail.quiz_title} • Ends {new Date(detail.end_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {detail.status === 'ended' && detail.winner_name && (
                <div className="p-4 rounded-lg border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 mb-4" data-testid="contest-winner-banner">
                  <p className="font-bold text-amber-900">🏆 Champion: {detail.winner_name} — certificate awarded!</p>
                </div>
              )}
              {user.role === 'student' && detail.status === 'active' && (
                !myEntry ? (
                  listItem?.can_join ? (
                    <Button onClick={() => joinContest(detail)} className="bg-amber-600 hover:bg-amber-700" data-testid="join-contest-detail-btn">
                      Join Contest
                    </Button>
                  ) : (
                    <p className="text-sm text-gray-500">This contest isn't open to your age group or class.</p>
                  )
                ) : myEntry.score === null ? (
                  <Button onClick={startAttempt} className="bg-amber-600 hover:bg-amber-700" data-testid="take-contest-quiz-btn">
                    Take the Contest Quiz
                  </Button>
                ) : (
                  <Badge className="bg-emerald-100 text-emerald-800 text-base px-4 py-2" data-testid="my-contest-score">
                    Your score: {myEntry.score}%
                  </Badge>
                )
              )}
              {result && (
                <p className="mt-3 text-sm text-gray-600">You earned +{result.points_earned} points for competing! 🔥 Streak: {result.streak_days} days</p>
              )}
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur-sm shadow-xl" data-testid="contest-ranking-card">
            <CardHeader>
              <CardTitle className="text-xl">📊 Live Ranking ({detail.participants} participants)</CardTitle>
            </CardHeader>
            <CardContent>
              {detail.ranking.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">No scores submitted yet — be the first!</p>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    let lastScore = null;
                    let lastRank = 0;
                    return detail.ranking.map((e, i) => {
                      const rank = e.score === lastScore ? lastRank : i + 1;
                      lastScore = e.score;
                      lastRank = rank;
                      return (
                    <div
                      key={e.id}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        e.student_id === user.id ? 'bg-emerald-50 border-2 border-emerald-300' : rank <= 3 ? 'bg-gradient-to-r from-amber-50 to-yellow-50' : 'bg-gray-50'
                      }`}
                      data-testid={`ranking-row-${i + 1}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold w-8 text-center">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}</span>
                        <span className="font-semibold text-sm">
                          {e.student_name} {e.student_id === user.id && <span className="text-emerald-600">(you)</span>}
                        </span>
                      </div>
                      <Badge className="bg-blue-100 text-blue-800">{e.score}%</Badge>
                    </div>
                      );
                    });
                  })()}
                </div>
              )}
              {detail.pending.length > 0 && (
                <p className="text-xs text-gray-400 mt-3">{detail.pending.length} joined but haven't submitted yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ---------- List view ----------
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Contests 🏆</h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Compete with students in your age group. Win a professional contest and earn a certificate that means something.
          </p>
        </div>

        {contests.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">🏆</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Contests Yet</h3>
              <p className="text-gray-600">Check back soon — verified teachers host contests regularly.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {contests.map((t) => (
              <Card key={t.id} className="bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300" data-testid={`contest-card-${t.id}`}>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Badge className={statusBadge(t.status)}>{t.status}</Badge>
                    {t.is_professional && <Badge className="bg-sky-100 text-sky-800">⭐ Professional</Badge>}
                    <Badge className={subjectBadgeColor(t.subject)}>{subjectEmoji(t.subject)} {t.subject}</Badge>
                    <Badge variant="outline">{t.age_group === 'all' ? 'All ages' : `Ages ${t.age_group}`}</Badge>
                  </div>
                  <CardTitle className="text-xl flex items-center gap-2">{t.title}</CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                  <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                    <span className="flex items-center gap-1"><BadgeCheck className="w-3.5 h-3.5 text-sky-500" />{t.teacher_name}</span>
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{t.participants} joined</span>
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />ends {new Date(t.end_at).toLocaleDateString()}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex gap-3">
                  <Button variant="outline" onClick={() => openDetail(t.id)} className="flex-1" data-testid={`view-contest-${t.id}`}>
                    View Ranking
                  </Button>
                  {t.can_join && (
                    <Button onClick={() => joinContest(t)} className="flex-1 bg-amber-600 hover:bg-amber-700" data-testid={`join-contest-${t.id}`}>
                      Join
                    </Button>
                  )}
                  {t.my_entry && t.my_entry.score === null && t.status === 'active' && (
                    <Button onClick={() => openDetail(t.id)} className="flex-1 bg-emerald-600 hover:bg-emerald-700" data-testid={`compete-contest-${t.id}`}>
                      Compete Now
                    </Button>
                  )}
                  {t.my_entry && t.my_entry.score !== null && (
                    <Badge className="bg-emerald-100 text-emerald-800 self-center px-3 py-2">You: {t.my_entry.score}%</Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestsPage;
