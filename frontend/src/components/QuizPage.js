import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { SUBJECTS, subjectEmoji, subjectBadgeColor } from '../lib/steam';
import { notifyNewBadges } from '../lib/badges';

// Quiz screen in English or Turkish. Only text changes: the answer sent to the server is always the
// English option at the same index, so grading and misconception tags stay identical in both languages.
const QUIZ_LANG_KEY = 'steamhub:quiz-lang';
const UI_TEXT = {
  en: {
    question: (n, total) => `Question ${n} of ${total}`, previous: 'Previous', exit: 'Exit Quiz',
    next: 'Next Question', submit: 'Submit Quiz', sureQ: 'How sure are you?', sure: "I'm sure",
    guess: 'I guessed', sureHint: 'Be honest: a guess is not counted as a wrong idea.',
  },
  tr: {
    question: (n, total) => `Soru ${n} / ${total}`, previous: 'Geri', exit: 'Testten çık',
    next: 'Sonraki soru', submit: 'Testi bitir', sureQ: 'Ne kadar eminsin?', sure: 'Eminim',
    guess: 'Tahmin ettim', sureHint: 'Dürüst ol: tahminler yanlış fikir olarak sayılmaz.',
  },
};

const initialQuizLang = () => {
  try {
    const stored = window.localStorage.getItem(QUIZ_LANG_KEY);
    if (stored === 'en' || stored === 'tr') return stored;
  } catch (e) { /* storage blocked: fall back to the browser language */ }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

const QuizPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();

  const [quizzes, setQuizzes] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState(searchParams.get('subject') || 'all');
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [quizResult, setQuizResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState(initialQuizLang);

  const setLang = (value) => {
    setLangState(value);
    try { window.localStorage.setItem(QUIZ_LANG_KEY, value); } catch (e) { /* not critical */ }
  };

  const fetchQuizzes = useCallback(async () => {
    try {
      const params = {};
      if (user?.age_group) params.age_group = user.age_group;
      const response = await axios.get(`${API}/quizzes`, { params });
      setQuizzes(response.data);
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, [API, user?.age_group]);

  const startQuiz = useCallback((quiz) => {
    setSelectedQuiz(quiz);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setQuizResult(null);
  }, []);

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  useEffect(() => {
    if (id && quizzes.length > 0) {
      const quiz = quizzes.find((q) => q.id === id);
      if (quiz) startQuiz(quiz);
    }
  }, [id, quizzes, startQuiz]);

  const handleAnswerSelect = (selectedOption) => {
    const newAnswers = [...answers];
    // Picking another option clears the confidence answer, so it always belongs to the option on screen
    const keep = newAnswers[currentQuestion]?.selected === selectedOption ? newAnswers[currentQuestion].confident : undefined;
    newAnswers[currentQuestion] = { question_index: currentQuestion, selected: selectedOption, confident: keep };
    setAnswers(newAnswers);
  };

  const handleConfidence = (confident) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = { ...newAnswers[currentQuestion], confident };
    setAnswers(newAnswers);
  };

  const nextQuestion = () => {
    if (currentQuestion < selectedQuiz.questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      submitQuiz();
    }
  };

  const previousQuestion = () => {
    if (currentQuestion > 0) setCurrentQuestion(currentQuestion - 1);
  };

  const submitQuiz = async () => {
    try {
      const response = await axios.post(`${API}/quizzes/${selectedQuiz.id}/attempt`, { answers });
      setQuizResult(response.data);
      setShowResults(true);
      if (response.data.challenge_completed) {
        toast.success(`Daily challenge "${response.data.challenge_completed}" completed! 🔥`);
      }
      notifyNewBadges(response.data.new_badges);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      toast.error('Failed to submit quiz');
    }
  };

  const restartQuiz = () => {
    setSelectedQuiz(null);
    setCurrentQuestion(0);
    setAnswers([]);
    setShowResults(false);
    setQuizResult(null);
    if (id) navigate('/quiz');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading quizzes...</p>
        </div>
      </div>
    );
  }

  if (showResults && quizResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="bg-white/90 backdrop-blur-sm shadow-xl">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-gray-900">Quiz Complete! 🎉</CardTitle>
              <CardDescription className="text-lg">
                Great job completing "{selectedQuiz.title}"
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="space-y-4">
                <div className="text-6xl font-bold text-emerald-600" data-testid="quiz-score">
                  {quizResult.score}%
                </div>
                <div className="text-xl text-gray-700">
                  You got {Math.round((quizResult.score / 100) * selectedQuiz.questions.length)} out of {selectedQuiz.questions.length} questions correct!
                </div>

                <div className="flex justify-center gap-3 flex-wrap">
                  <Badge
                    variant={quizResult.score >= 80 ? 'default' : quizResult.score >= 60 ? 'secondary' : 'destructive'}
                    className="text-lg px-4 py-2"
                  >
                    {quizResult.score >= 80 ? 'Excellent! 🌟' : quizResult.score >= 60 ? 'Good Job! 👍' : 'Keep Practicing! 💪'}
                  </Badge>
                  <Badge className="text-lg px-4 py-2 bg-yellow-100 text-yellow-800" data-testid="quiz-points-earned">
                    ⭐ +{quizResult.points_earned} points
                  </Badge>
                  <Badge className="text-lg px-4 py-2 bg-orange-100 text-orange-800" data-testid="quiz-streak">
                    🔥 {quizResult.streak_days}-day streak
                  </Badge>
                </div>
                {!quizResult.first_attempt && (
                  <p className="text-sm text-gray-500">Points are only awarded on your first attempt of each quiz.</p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button onClick={() => startQuiz(selectedQuiz)} className="bg-emerald-600 hover:bg-emerald-700" data-testid="retake-quiz-btn">
                  Retake Quiz
                </Button>
                <Button onClick={restartQuiz} variant="outline" data-testid="back-to-quizzes-btn">
                  Back to Quizzes
                </Button>
                <Button onClick={() => navigate('/dashboard')} variant="outline" data-testid="back-to-dashboard-btn">
                  Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    const progress = ((currentQuestion + 1) / selectedQuiz.questions.length) * 100;
    const question = selectedQuiz.questions[currentQuestion];
    const currentAnswer = answers[currentQuestion]?.selected;
    const currentConfidence = answers[currentQuestion]?.confident;
    // Diagnostic quizzes ask "sure or guessing?" so a lucky or random click doesn't read as a misconception
    const asksConfidence = Boolean(selectedQuiz.diagnostic);
    const hasTurkish = Boolean(question.tr?.question);
    const showTr = hasTurkish && lang === 'tr';
    const t = UI_TEXT[hasTurkish ? lang : 'en'];
    const canContinue = Boolean(currentAnswer) && (!asksConfidence || typeof currentConfidence === 'boolean');

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">
                {showTr && selectedQuiz.tr?.title ? selectedQuiz.tr.title : selectedQuiz.title}
              </h1>
              <div className="flex items-center gap-2">
                {hasTurkish && (
                  <div className="flex rounded-md border border-gray-300 text-xs" role="group" aria-label="Language / Dil">
                    {['tr', 'en'].map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLang(code)}
                        aria-pressed={lang === code}
                        className={`px-2 py-1 font-semibold ${lang === code ? 'bg-emerald-600 text-white' : 'bg-white text-gray-700'}`}
                        data-testid={`quiz-lang-${code}`}
                      >
                        {code.toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
                <Badge variant="outline" data-testid="question-counter">
                  {t.question(currentQuestion + 1, selectedQuiz.questions.length)}
                </Badge>
              </div>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <Card className="bg-white/90 backdrop-blur-sm shadow-xl mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900" data-testid="question-text">
                {showTr ? question.tr.question : question.question}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {question.options.map((option, index) => (
                  <button
                    key={option}
                    onClick={() => handleAnswerSelect(option)}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 ${
                      currentAnswer === option
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50'
                    }`}
                    data-testid={`option-${index}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        currentAnswer === option ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
                      }`}>
                        {currentAnswer === option && <div className="w-3 h-3 bg-white rounded-full"></div>}
                      </div>
                      <span className="text-lg">{showTr ? (question.tr.options?.[index] || option) : option}</span>
                    </div>
                  </button>
                ))}
              </div>
              {asksConfidence && currentAnswer && (
                <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-3" data-testid="confidence-check">
                  <p className="text-sm font-semibold text-gray-800">{t.sureQ}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[[true, t.sure], [false, t.guess]].map(([value, label]) => (
                      <Button
                        key={String(value)}
                        type="button"
                        size="sm"
                        variant={currentConfidence === value ? 'default' : 'outline'}
                        aria-pressed={currentConfidence === value}
                        onClick={() => handleConfidence(value)}
                        className={currentConfidence === value ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                        data-testid={`confidence-${value ? 'sure' : 'guess'}`}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">{t.sureHint}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button onClick={previousQuestion} disabled={currentQuestion === 0} variant="outline" data-testid="previous-question-btn">
              {t.previous}
            </Button>
            <div className="flex space-x-3">
              <Button onClick={restartQuiz} variant="outline" data-testid="exit-quiz-btn">
                {t.exit}
              </Button>
              <Button
                onClick={nextQuestion}
                disabled={!canContinue}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="next-question-btn"
              >
                {currentQuestion === selectedQuiz.questions.length - 1 ? t.submit : t.next}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filtered = subjectFilter === 'all' ? quizzes : quizzes.filter((q) => q.subject === subjectFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">STEAM Quizzes 📝</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Quizzes matched to your age group{user?.age_group ? ` (${user.age_group})` : ''}. First attempts earn points toward the leaderboard!
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-56" data-testid="quiz-subject-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{subjectEmoji(s)} {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quizzes Available</h3>
              <p className="text-gray-600 mb-6">No quizzes match this filter for your age group.</p>
              <Button onClick={() => setSubjectFilter('all')} className="bg-emerald-600 hover:bg-emerald-700">
                Show All Subjects
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((quiz) => (
              <Card key={quiz.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={subjectBadgeColor(quiz.subject)}>
                      {subjectEmoji(quiz.subject)} {quiz.subject}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{quiz.questions.length} Questions</Badge>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{quiz.title}</CardTitle>
                  <CardDescription className="text-gray-600">{quiz.description}</CardDescription>
                  <div className="flex gap-1 pt-1">
                    {(quiz.age_groups || []).map((g) => (
                      <Badge key={g} variant="outline" className="text-xs">{g === 'all' ? 'All ages' : `Ages ${g}`}</Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => startQuiz(quiz)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 btn-hover-scale"
                    data-testid={`start-quiz-${quiz.id}`}
                  >
                    Start Quiz
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizPage;
