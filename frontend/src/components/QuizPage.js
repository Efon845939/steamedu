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
    newAnswers[currentQuestion] = { question_index: currentQuestion, selected: selectedOption };
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

    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-gray-900">{selectedQuiz.title}</h1>
              <Badge variant="outline" data-testid="question-counter">
                Question {currentQuestion + 1} of {selectedQuiz.questions.length}
              </Badge>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <Card className="bg-white/90 backdrop-blur-sm shadow-xl mb-6">
            <CardHeader>
              <CardTitle className="text-xl text-gray-900" data-testid="question-text">
                {question.question}
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
                      <span className="text-lg">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button onClick={previousQuestion} disabled={currentQuestion === 0} variant="outline" data-testid="previous-question-btn">
              Previous
            </Button>
            <div className="flex space-x-3">
              <Button onClick={restartQuiz} variant="outline" data-testid="exit-quiz-btn">
                Exit Quiz
              </Button>
              <Button
                onClick={nextQuestion}
                disabled={!currentAnswer}
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="next-question-btn"
              >
                {currentQuestion === selectedQuiz.questions.length - 1 ? 'Submit Quiz' : 'Next Question'}
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
