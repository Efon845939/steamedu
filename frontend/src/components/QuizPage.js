import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import { SUBJECTS } from '../lib/steam';
import { notifyNewBadges } from '../lib/badges';
import { cn } from '../lib/utils';
import { useAgeTheme } from '../lib/theme';
import { misconceptionName } from '../lib/misconceptions';
import { SpecimenLabel, StatusWord, Trace } from './lab';

// Quiz screen in English or Turkish. Only text changes: the answer sent to the server is always the
// English option at the same index, so grading and misconception tags stay identical in both languages.
const QUIZ_LANG_KEY = 'steamhub:quiz-lang';
const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

const UI_TEXT = {
  en: {
    question: (n, total) => `Question ${n} of ${total}`, previous: 'Previous', exit: 'Exit quiz',
    next: 'Next question', submit: 'Check answers', sureQ: 'How sure are you?', sure: "I'm sure",
    guess: 'I guessed', sureHint: 'Be honest: a guess is not counted as a wrong idea.',
    progress: 'Quiz progress', pick: 'Pick an answer. Keys A to D work too.', pickSure: 'Now say how sure you are.',
    readyNext: 'Ready for the next question.', readyCheck: 'Ready to check your answers.',
  },
  tr: {
    question: (n, total) => `Soru ${n} / ${total}`, previous: 'Geri', exit: 'Testten çık',
    next: 'Sonraki soru', submit: 'Cevapları kontrol et', sureQ: 'Ne kadar eminsin?', sure: 'Eminim',
    guess: 'Tahmin ettim', sureHint: 'Dürüst ol: tahminler yanlış fikir olarak sayılmaz.',
    progress: 'Test ilerlemesi', pick: 'Bir cevap seç. A-D tuşları da çalışır.', pickSure: 'Şimdi ne kadar emin olduğunu seç.',
    readyNext: 'Sonraki soruya hazırsın.', readyCheck: 'Cevaplarını kontrol etmeye hazırsın.',
  },
};

const plural = (n, one, many) => (n === 1 ? one : many);

const RESULT_TEXT = {
  en: {
    questions: (n) => `${n} ${plural(n, 'question', 'questions')}`,
    headline: ({ held, shaky, allCorrect }) => {
      if (held > 0) {
        const lead = `You hold ${held} ${plural(held, 'misconception', 'misconceptions')}`;
        return shaky > 0 ? `${lead}, and ${shaky} more came up in ${plural(shaky, 'a guess', 'guesses')}.` : `${lead}.`;
      }
      if (shaky > 0) return `No firm misconceptions. ${shaky} ${plural(shaky, 'idea', 'ideas')} came up in ${plural(shaky, 'a guess', 'guesses')}.`;
      return allCorrect ? 'Every answer holds.' : 'No misconceptions showed up.';
    },
    correct: (c, n) => `${c} of ${n} correct`,
    points: (p) => (p > 0 ? `+${p} points` : 'No new points'),
    streak: (d) => `${d}-day streak`,
    firstOnly: 'Points count only on your first attempt at each quiz.',
    traceTitle: 'Question by question',
    traceLabel: (levels) => `Your answers, question by question: ${levels.map((l, i) => `${i + 1} ${l === 'holds' ? 'holds' : l === 'unsure' ? 'unsure' : 'breaks'}`).join(', ')}`,
    ideasTitle: 'Ideas to work on',
    ideasNote: 'A wrong answer you were sure of shows an idea you hold. Guesses are listed but not counted.',
    qList: (nums) => {
      if (nums.length === 1) return `Question ${nums[0]}`;
      return `Questions ${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`;
    },
    sureNote: (sure, total) => {
      if (sure === total) return total === 1 ? 'you were sure' : 'sure each time';
      if (sure === 0) return total === 1 ? 'a guess' : 'all guesses';
      return `sure on ${sure} of ${total}`;
    },
    holdsIdea: 'Breaks here', shakyIdea: 'Unsure',
    practiseArena: 'Practise in Debug Arena', practise: 'Practise',
    answersTitle: 'Your answers', yourAnswer: 'Your answer:', aGuess: 'a guess',
    holds: 'Holds', holdsGuess: 'Holds, but a guess', wrong: 'Not quite', wrongGuess: 'Not quite, a guess',
    open: 'In your score',
    openNote: (c, m) => `Questions without a mark: ${c} of these ${m} are correct.`,
    keyPrivate: 'The answer key stays private, so a retake is still a fair check.',
    retake: 'Retake quiz', backToQuizzes: 'Back to quizzes', dashboard: 'Dashboard',
  },
  tr: {
    questions: (n) => `${n} soru`,
    headline: ({ held, shaky, allCorrect }) => {
      if (held > 0) return shaky > 0 ? `${held} kavram yanılgın var, ${shaky} tanesi de tahminlerinde çıktı.` : `${held} kavram yanılgın var.`;
      if (shaky > 0) return `Kesin bir kavram yanılgın yok. ${shaky} fikir tahminlerinde çıktı.`;
      return allCorrect ? 'Tüm cevapların doğru.' : 'Hiç kavram yanılgısı çıkmadı.';
    },
    correct: (c, n) => `${n} sorudan ${c} doğru`,
    points: (p) => (p > 0 ? `+${p} puan` : 'Yeni puan yok'),
    streak: (d) => `${d} günlük seri`,
    firstOnly: 'Puanlar sadece her testteki ilk denemende sayılır.',
    traceTitle: 'Soru soru',
    traceLabel: (levels) => `Cevapların, soru soru: ${levels.map((l, i) => `${i + 1} ${l === 'holds' ? 'doğru' : l === 'unsure' ? 'emin değil' : 'yanlış'}`).join(', ')}`,
    ideasTitle: 'Üzerinde çalışılacak fikirler',
    ideasNote: 'Emin olduğun yanlış bir cevap, sahip olduğun bir fikri gösterir. Tahminler listelenir ama sayılmaz.',
    qList: (nums) => {
      if (nums.length === 1) return `${nums[0]}. soru`;
      return `${nums.slice(0, -1).map((x) => `${x}.`).join(', ')} ve ${nums[nums.length - 1]}. sorular`;
    },
    sureNote: (sure, total) => {
      if (sure === total) return total === 1 ? 'emindin' : 'her seferinde emindin';
      if (sure === 0) return total === 1 ? 'tahmin' : 'hepsi tahmin';
      return `${total} sorunun ${sure} tanesinde emindin`;
    },
    holdsIdea: 'Burada bozuluyor', shakyIdea: 'Emin değil',
    practiseArena: "Debug Arena'da çalış", practise: 'Çalış',
    answersTitle: 'Cevapların', yourAnswer: 'Cevabın:', aGuess: 'tahmin',
    holds: 'Doğru', holdsGuess: 'Doğru ama tahmin', wrong: 'Tam değil', wrongGuess: 'Tam değil, tahmin',
    open: 'Puanında',
    openNote: (c, m) => `İşaretsiz sorular: bu ${m} sorudan ${c} tanesi doğru.`,
    keyPrivate: 'Cevap anahtarı gizli kalır, böylece testi tekrar çözmek yine adil bir kontrol olur.',
    retake: 'Testi tekrar çöz', backToQuizzes: 'Testlere dön', dashboard: 'Panele dön',
  },
};

const initialQuizLang = () => {
  try {
    const stored = window.localStorage.getItem(QUIZ_LANG_KEY);
    if (stored === 'en' || stored === 'tr') return stored;
  } catch (e) { /* storage blocked: fall back to the browser language */ }
  return (navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en';
};

// What the attempt response can tell about each question. The server never sends the answer key,
// only the tag behind each wrong answer it recognised. An untagged answer is right or a plain slip:
// the score says how many of those are right, so they resolve when the count leaves no doubt.
const reviewAnswers = (quiz, answers, result) => {
  const questions = quiz.questions;
  const n = questions.length;
  const tagged = new Map();
  (result.misconceptions || []).forEach((m) => tagged.set(m.question_index, m.tag));
  (result.guessed_misconceptions || []).forEach((m) => tagged.set(m.question_index, m.tag));
  const correct = Math.round((result.score / 100) * n);
  const untagged = questions.map((_, i) => i).filter((i) => !tagged.has(i));
  let resolved = null;
  if (correct === untagged.length) resolved = 'holds';
  else if (correct === 0) resolved = 'wrong';
  const rows = questions.map((question, i) => {
    const answer = answers[i] || {};
    const guessed = answer.confident === false;
    const base = { index: i, question, selected: answer.selected, guessed };
    if (tagged.has(i)) return { ...base, state: 'wrong', tag: tagged.get(i) };
    return { ...base, state: resolved || 'open' };
  });
  const known = rows.every((r) => r.state !== 'open');
  const levels = known
    ? rows.map((r) => (r.guessed ? 'unsure' : r.state === 'holds' ? 'holds' : 'breaks'))
    : null;
  return { rows, correct, untagged: untagged.length, known, levels };
};

// Misconceptions found, grouped by tag. Confident answers first: a guess shows no belief.
const groupIdeas = (result) => {
  const byTag = new Map();
  const add = (m, sure) => {
    const entry = byTag.get(m.tag) || { tag: m.tag, questions: [], sure: 0 };
    entry.questions.push(m.question_index + 1);
    if (sure) entry.sure += 1;
    byTag.set(m.tag, entry);
  };
  (result.misconceptions || []).forEach((m) => add(m, true));
  (result.guessed_misconceptions || []).forEach((m) => add(m, false));
  const ideas = [...byTag.values()].map((e) => ({ ...e, questions: e.questions.sort((a, b) => a - b) }));
  ideas.sort((a, b) => b.sure - a.sure || b.questions.length - a.questions.length);
  return ideas;
};

const LangToggle = ({ lang, onChange }) => (
  <div className="inline-flex rounded-sm border border-rule-strong p-0.5" role="group" aria-label="Language / Dil">
    {['tr', 'en'].map((code) => (
      <button
        key={code}
        type="button"
        lang={code}
        onClick={() => onChange(code)}
        aria-pressed={lang === code}
        className={cn(
          'h-9 min-w-[2.75rem] rounded-[3px] px-2.5 text-sm font-semibold transition-colors duration-press',
          lang === code ? 'bg-brand-tint text-ink' : 'text-ink-muted hover:text-ink'
        )}
        data-testid={`quiz-lang-${code}`}
      >
        {code.toUpperCase()}
      </button>
    ))}
  </div>
);

const QuestionProgress = ({ value, total, label }) => (
  <div
    role="progressbar"
    aria-valuemin={1}
    aria-valuemax={total}
    aria-valuenow={value}
    aria-label={label}
    className="flex min-w-0 flex-1 items-center gap-1"
  >
    {total <= 16 ? (
      Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn('h-1.5 w-3.5 shrink-0 rounded-sm', i < value ? 'bg-brand-ink' : 'bg-rule')} />
      ))
    ) : (
      <span className="h-1.5 w-full max-w-[12rem] overflow-hidden rounded-sm bg-rule">
        <span className="block h-full bg-brand-ink" style={{ width: `${(value / total) * 100}%` }} />
      </span>
    )}
  </div>
);

const QuizPage = () => {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();
  const ageTheme = useAgeTheme();

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
    window.scrollTo(0, 0);
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

  const handleAnswerSelect = useCallback((selectedOption) => {
    setAnswers((prev) => {
      const newAnswers = [...prev];
      // Picking another option clears the confidence answer, so it always belongs to the option on screen
      const keep = newAnswers[currentQuestion]?.selected === selectedOption ? newAnswers[currentQuestion].confident : undefined;
      newAnswers[currentQuestion] = { question_index: currentQuestion, selected: selectedOption, confident: keep };
      return newAnswers;
    });
  }, [currentQuestion]);

  const handleConfidence = (confident) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestion] = { ...newAnswers[currentQuestion], confident };
    setAnswers(newAnswers);
  };

  // A to D pick an answer while a question is on screen.
  const activeQuestion = selectedQuiz && !showResults ? selectedQuiz.questions[currentQuestion] : null;
  useEffect(() => {
    if (!activeQuestion) return undefined;
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !e.key || e.key.length !== 1) return;
      const el = e.target;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const index = KEYS.indexOf(e.key.toUpperCase());
      if (index < 0 || index >= activeQuestion.options.length) return;
      e.preventDefault();
      handleAnswerSelect(activeQuestion.options[index]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeQuestion, handleAnswerSelect]);

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
      window.scrollTo(0, 0);
      if (response.data.challenge_completed) {
        toast.success(`Daily challenge "${response.data.challenge_completed}" done.`);
      }
      notifyNewBadges(response.data.new_badges);
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      toast.error('Could not check your answers. Try again.');
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
      <div className="mx-auto flex min-h-[50vh] w-full max-w-5xl items-center px-4 sm:px-6" role="status">
        <p className="text-ink-muted">Loading quizzes</p>
      </div>
    );
  }

  if (showResults && quizResult) {
    const quizHasTr = Boolean(selectedQuiz.tr) || selectedQuiz.questions.some((q) => q.tr?.question);
    const rl = quizHasTr ? lang : 'en';
    const r = RESULT_TEXT[rl];
    const n = selectedQuiz.questions.length;
    const review = reviewAnswers(selectedQuiz, answers, quizResult);
    const ideas = groupIdeas(quizResult);
    const held = ideas.filter((i) => i.sure > 0).length;
    const shaky = ideas.length - held;
    const isDiagnostic = Boolean(selectedQuiz.diagnostic);
    const title = rl === 'tr' && selectedQuiz.tr?.title ? selectedQuiz.tr.title : selectedQuiz.title;
    const headline = isDiagnostic
      ? r.headline({ held, shaky, allCorrect: review.correct === n })
      : r.correct(review.correct, n) + '.';
    const quietPoints = ageTheme === '18+';
    const showAnswers = isDiagnostic || review.known;
    const optionText = (row) => {
      const q = row.question;
      if (rl === 'tr' && q.tr?.options) {
        const idx = q.options.indexOf(row.selected);
        if (idx >= 0 && q.tr.options[idx]) return q.tr.options[idx];
      }
      return row.selected;
    };

    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12" lang={rl}>
        <header className="animate-rise">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="t-cap tnum">{title}, {r.questions(n)}</p>
            {quizHasTr && <LangToggle lang={lang} onChange={setLang} />}
          </div>
          <h1 className="t-h1 mt-3" aria-live="polite">{headline}</h1>
          <p className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <span className="t-num text-4xl leading-none text-ink" data-testid="quiz-score">{quizResult.score}%</span>
            {isDiagnostic && <span className="tnum">{r.correct(review.correct, n)}</span>}
            <span className={cn('tnum', quietPoints && 'text-sm text-ink-muted')} data-testid="quiz-points-earned">
              {r.points(quizResult.points_earned)}
            </span>
            <span className={cn('tnum', quietPoints ? 'text-sm text-ink-muted' : 'text-ink-muted')} data-testid="quiz-streak">
              {r.streak(quizResult.streak_days)}
            </span>
          </p>
          {!quizResult.first_attempt && <p className="t-cap mt-2">{r.firstOnly}</p>}
        </header>

        {review.levels && (
          <section aria-labelledby="trace-title" className="mt-8 border-y border-rule py-5">
            <h2 id="trace-title" className="t-cap font-sans font-normal">{r.traceTitle}</h2>
            <div className="relative mt-3" style={{ height: 72 }}>
              <span aria-hidden="true" className="absolute inset-x-0 top-[22%] border-t border-dashed border-rule" />
              <span aria-hidden="true" className="absolute inset-x-0 top-[78%] border-t border-dashed border-rule" />
              <Trace levels={review.levels} height={72} draw label={r.traceLabel(review.levels)} className="relative" />
            </div>
            <ol aria-hidden="true" className="mt-2 grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
              {review.levels.map((_, i) => (
                <li key={i} className="t-cap tnum text-center">{i + 1}</li>
              ))}
            </ol>
          </section>
        )}

        {ideas.length > 0 && (
          <section aria-labelledby="ideas-title" className="mt-10">
            <div className="border-b border-rule pb-3">
              <h2 id="ideas-title" className="t-h3">{r.ideasTitle}</h2>
              <p className="t-cap mt-1">{r.ideasNote}</p>
            </div>
            <ul>
              {ideas.map((idea, i) => (
                <li
                  key={idea.tag}
                  className="grid min-h-16 grid-cols-1 items-center gap-x-6 gap-y-2 border-b border-rule py-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <SpecimenLabel name={misconceptionName(idea.tag, rl)} lang={rl} />
                      <StatusWord status={idea.sure > 0 ? 'breaks' : 'unsure'}>{idea.sure > 0 ? r.holdsIdea : r.shakyIdea}</StatusWord>
                    </div>
                    <p className="t-cap tnum mt-1">
                      {r.qList(idea.questions)}, {r.sureNote(idea.sure, idea.questions.length)}
                    </p>
                  </div>
                  {i === 0 && idea.sure > 0 ? (
                    <Button asChild className="justify-self-start sm:justify-self-end" data-testid="practise-arena-btn">
                      <Link to="/arena">{r.practiseArena}</Link>
                    </Button>
                  ) : (
                    <Link
                      to="/arena"
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-ink underline-offset-4 hover:underline justify-self-start sm:justify-self-end"
                    >
                      {r.practise}
                      <ArrowRight aria-hidden="true" className="h-4 w-4" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {showAnswers && (
          <section aria-labelledby="answers-title" className="mt-10">
            <h2 id="answers-title" className="t-h3 border-b border-rule pb-3">{r.answersTitle}</h2>
            <ol>
              {review.rows.map((row) => {
                const q = row.question;
                const text = rl === 'tr' && q.tr?.question ? q.tr.question : q.question;
                let status = null;
                let rule = 'border-rule-strong';
                if (row.state === 'holds') {
                  status = <StatusWord status={row.guessed ? 'unsure' : 'holds'}>{row.guessed ? r.holdsGuess : r.holds}</StatusWord>;
                  rule = row.guessed ? 'border-warning' : 'border-success';
                } else if (row.state === 'wrong') {
                  status = <StatusWord status={row.guessed ? 'unsure' : 'wrong'}>{row.guessed ? r.wrongGuess : r.wrong}</StatusWord>;
                  rule = row.guessed ? 'border-warning' : 'border-danger';
                }
                return (
                  <li
                    key={row.index}
                    className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2 border-b border-rule py-4 sm:grid-cols-[2rem_minmax(0,1fr)_auto] sm:gap-x-4"
                  >
                    <span className="t-num pt-px text-ink-muted">{row.index + 1}</span>
                    <div className="min-w-0">
                      <p className="text-pretty">{text}</p>
                      <p className={cn('mt-2 border-l-2 pl-3 text-sm', rule)}>
                        <span className="text-ink-muted">{r.yourAnswer}</span>{' '}
                        <span className="font-semibold">{optionText(row)}</span>
                        {row.guessed && <span className="text-ink-muted">, {r.aGuess}</span>}
                      </p>
                    </div>
                    <div className="col-start-2 sm:col-start-3 sm:row-start-1 sm:pt-0.5">
                      {status || <span className="t-cap">{r.open}</span>}
                    </div>
                  </li>
                );
              })}
            </ol>
            {!review.known && (
              <p className="t-cap tnum mt-3">{r.openNote(review.correct, review.untagged)}</p>
            )}
          </section>
        )}

        {!showAnswers && (
          <p className="mt-8 max-w-prose border-t border-rule pt-5 text-ink-muted">{r.keyPrivate}</p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Button
            onClick={() => startQuiz(selectedQuiz)}
            variant={held > 0 ? 'outline' : 'default'}
            data-testid="retake-quiz-btn"
          >
            {r.retake}
          </Button>
          <Button onClick={restartQuiz} variant="outline" data-testid="back-to-quizzes-btn">
            {r.backToQuizzes}
          </Button>
          <Button onClick={() => navigate('/dashboard')} variant="ghost" data-testid="back-to-dashboard-btn">
            {r.dashboard}
          </Button>
        </div>
      </div>
    );
  }

  if (selectedQuiz) {
    const total = selectedQuiz.questions.length;
    const question = selectedQuiz.questions[currentQuestion];
    const currentAnswer = answers[currentQuestion]?.selected;
    const currentConfidence = answers[currentQuestion]?.confident;
    // Diagnostic quizzes ask "sure or guessing?" so a lucky or random click doesn't read as a misconception
    const asksConfidence = Boolean(selectedQuiz.diagnostic);
    const hasTurkish = Boolean(question.tr?.question);
    const showTr = hasTurkish && lang === 'tr';
    const t = UI_TEXT[hasTurkish ? lang : 'en'];
    const qLang = showTr ? 'tr' : 'en';
    const canContinue = Boolean(currentAnswer) && (!asksConfidence || typeof currentConfidence === 'boolean');
    const isLast = currentQuestion === total - 1;
    let barText = t.pick;
    if (currentAnswer && !canContinue) barText = t.pickSure;
    else if (canContinue) barText = isLast ? t.readyCheck : t.readyNext;

    return (
      <div className="mx-auto w-full max-w-[44rem] px-4 pt-6 sm:px-6 sm:pt-10">
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
            <h1 className="font-sans text-sm font-semibold leading-snug text-ink" lang={qLang}>
              {showTr && selectedQuiz.tr?.title ? selectedQuiz.tr.title : selectedQuiz.title}
            </h1>
            <div className="mt-2 flex items-center gap-3">
              <span className="t-cap tnum shrink-0" aria-live="polite" lang={qLang} data-testid="question-counter">
                {t.question(currentQuestion + 1, total)}
              </span>
              <QuestionProgress value={currentQuestion + 1} total={total} label={t.progress} />
            </div>
          </div>
          <div className="order-first ml-auto flex items-center gap-2 sm:order-none">
            {hasTurkish && <LangToggle lang={lang} onChange={setLang} />}
            <Button onClick={restartQuiz} variant="ghost" size="sm" lang={qLang} data-testid="exit-quiz-btn">
              {t.exit}
            </Button>
          </div>
        </header>

        <div key={currentQuestion} className="animate-rise">
          <h2
            id="quiz-question"
            lang={qLang}
            className={cn(
              'mt-8 text-pretty',
              ageTheme === '18+' ? 't-h3' : 'font-sans text-xl font-semibold leading-snug tracking-normal'
            )}
            data-testid="question-text"
          >
            {showTr ? question.tr.question : question.question}
          </h2>

          <div role="group" aria-labelledby="quiz-question" lang={qLang} className="mt-6 flex flex-col gap-2.5">
            {question.options.map((option, index) => {
              const selected = currentAnswer === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleAnswerSelect(option)}
                  aria-pressed={selected}
                  className={cn(
                    'grid min-h-14 w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-3.5 rounded-md border bg-surface py-2.5 pl-3 pr-4 text-left',
                    'transition-[border-color,background-color,color,box-shadow] duration-press',
                    selected
                      ? 'border-brand-ink bg-brand-tint ring-1 ring-inset ring-brand-ink'
                      : 'border-rule-strong hover:border-ink'
                  )}
                  data-testid={`option-${index}`}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-sm border text-sm font-semibold',
                      selected ? 'border-brand-ink text-brand-ink' : 'border-rule-strong text-ink-muted'
                    )}
                  >
                    {KEYS[index]}
                  </span>
                  <span className="text-base">{showTr ? (question.tr.options?.[index] || option) : option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {asksConfidence && currentAnswer && (
          <div className="mt-6 animate-rise" lang={qLang} data-testid="confidence-check">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <p id="confidence-label" className="font-semibold">{t.sureQ}</p>
              <div role="group" aria-labelledby="confidence-label" className="flex flex-wrap gap-2">
                {[[true, t.sure], [false, t.guess]].map(([value, label]) => (
                  <button
                    key={String(value)}
                    type="button"
                    aria-pressed={currentConfidence === value}
                    onClick={() => handleConfidence(value)}
                    className={cn(
                      'h-11 rounded-sm border px-4 text-sm transition-[border-color,background-color] duration-press',
                      currentConfidence === value
                        ? 'border-brand-ink bg-brand-tint font-semibold text-ink'
                        : 'border-rule-strong text-ink hover:bg-surface'
                    )}
                    data-testid={`confidence-${value ? 'sure' : 'guess'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className="t-cap mt-2">{t.sureHint}</p>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-rule bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:mx-0 sm:px-0">
          <div className="flex items-center justify-between gap-3">
            <p className="t-cap hidden min-w-0 flex-1 sm:block" aria-live="polite" lang={qLang}>{barText}</p>
            <div className="ml-auto flex items-center gap-2">
              <Button
                onClick={previousQuestion}
                disabled={currentQuestion === 0}
                variant="ghost"
                lang={qLang}
                data-testid="previous-question-btn"
              >
                {t.previous}
              </Button>
              <Button
                onClick={nextQuestion}
                disabled={!canContinue}
                className="min-w-[10rem]"
                lang={qLang}
                data-testid="next-question-btn"
              >
                {isLast ? t.submit : t.next}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filtered = subjectFilter === 'all' ? quizzes : quizzes.filter((q) => q.subject === subjectFilter);
  const featured = filtered.filter((q) => q.diagnostic);
  const rest = filtered.filter((q) => !q.diagnostic);
  const agesLabel = (groups) => (groups || []).map((g) => (g === 'all' ? 'All ages' : `Ages ${g}`)).join(', ');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
      <header className="max-w-3xl animate-rise">
        <h1 className="t-h1">Quizzes</h1>
        <p className="t-lead mt-3 text-ink-muted">
          {user?.age_group ? `Matched to ages ${user.age_group}. ` : ''}
          {ageTheme === '18+' ? 'Each one is a short check on a single topic.' : 'Your first attempt at each quiz earns points.'}
        </p>
      </header>

      {featured.map((quiz) => (
        <section
          key={quiz.id}
          aria-labelledby={`featured-${quiz.id}`}
          className="surface-raised mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 py-5 sm:px-6"
        >
          <div className="min-w-0 max-w-2xl">
            <p className="t-cap tnum">Diagnostic, {quiz.subject}, {quiz.questions.length} questions</p>
            <h2 id={`featured-${quiz.id}`} className="mt-1 font-display text-xl" style={{ fontStretch: 'var(--display-stretch)', fontWeight: 'var(--display-weight)' }}>
              {quiz.title}
            </h2>
            <p className="mt-1 text-ink-muted">{quiz.description}</p>
            {quiz.tr && (
              <p className="t-cap mt-1">
                Also in Turkish: <span lang="tr">{quiz.tr.title}</span>
              </p>
            )}
          </div>
          <Button onClick={() => startQuiz(quiz)} data-testid={`start-quiz-${quiz.id}`}>
            Start the diagnostic
            <ArrowRight aria-hidden="true" />
          </Button>
        </section>
      ))}

      <section aria-labelledby="quiz-list-title" className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule pb-3">
          <h2 id="quiz-list-title" className="t-h3">{featured.length ? 'Practice quizzes' : 'All quizzes'}</h2>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <span id="quiz-subject-label" className="t-cap shrink-0">Subject</span>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger
                className="w-full sm:w-56"
                aria-labelledby="quiz-subject-label"
                data-testid="quiz-subject-select"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All subjects</SelectItem>
                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="border-b border-rule py-10">
            <p className="font-semibold">No quizzes here yet</p>
            <p className="mt-1 text-ink-muted">No {subjectFilter} quizzes match your age group.</p>
            <Button onClick={() => setSubjectFilter('all')} className="mt-5">
              Show all subjects
            </Button>
          </div>
        ) : rest.length === 0 ? (
          <p className="t-cap border-b border-rule py-6">Only the diagnostic above matches this subject.</p>
        ) : (
          <ul>
            {rest.map((quiz) => (
              <li key={quiz.id} className="border-b border-rule">
                <button
                  type="button"
                  onClick={() => startQuiz(quiz)}
                  className="group -mx-3 grid w-[calc(100%+1.5rem)] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 rounded-md px-3 py-4 text-left transition-colors duration-press hover:bg-neutral-tint"
                  data-testid={`start-quiz-${quiz.id}`}
                >
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold leading-snug text-ink">{quiz.title}</span>
                    <span className="mt-0.5 block text-ink-muted">{quiz.description}</span>
                    <span className="t-cap tnum mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5">
                      <span className="font-semibold text-ink">{quiz.subject}</span>
                      <span>{quiz.questions.length} questions</span>
                      <span>{agesLabel(quiz.age_groups)}</span>
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-brand-ink">
                    <span className="hidden sm:inline">Start</span>
                    <ArrowRight aria-hidden="true" className="h-5 w-5 transition-transform duration-press group-hover:translate-x-0.5" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default QuizPage;
