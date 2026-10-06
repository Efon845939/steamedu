import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { AuthContext } from '../App';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowUp, ArrowDown, Trash2, Plus, Bug, CheckCircle2, AlertCircle, Send, Loader2, MessageSquare,
} from 'lucide-react';
import { SUBJECTS, subjectEmoji, formatApiError } from '../lib/steam';

// Mirrors _validate_peer in backend/server.py so students see problems before the server rejects them.
const LIMITS = {
  title: [5, 80],
  problem: [20, 800],
  step: [5, 300],
  explanation: [5, 300],
  debrief: [20, 1000],
  steps: [3, 8],
  explanations: [2, 4],
  time: [30, 300],
};
const DEFAULT_TIME = 90;
const STARTING_STEPS = 4;
const STARTING_EXPLANATIONS = 3;

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

// Python's len() counts code points, so an emoji is 1 character on the server — count the same way here.
const charCount = (value) => Array.from((value || '').trim()).length;

// Every step / explanation gets a stable key, so the "wrong step" and "right explanation" marks
// follow the item when the list is reordered or trimmed.
let keySeq = 0;
const newKey = (prefix) => {
  keySeq += 1;
  return `${prefix}${keySeq}`;
};
const makeItems = (texts, prefix) => texts.map((text) => ({ key: newKey(prefix), text: text || '' }));
const blankList = (count) => Array.from({ length: count }, () => '');

const blankForm = () => ({
  title: '',
  subject: '',
  time: String(DEFAULT_TIME),
  problem: '',
  steps: makeItems(blankList(STARTING_STEPS), 's'),
  flawedKey: '',
  explanations: makeItems(blankList(STARTING_EXPLANATIONS), 'e'),
  correctKey: '',
  misconception: '',
  debrief: '',
});

const formFromInitial = (initial) => {
  if (!initial) return blankForm();
  const steps = makeItems(initial.steps?.length ? initial.steps : blankList(STARTING_STEPS), 's');
  const explanations = makeItems(
    initial.explanations?.length ? initial.explanations : blankList(STARTING_EXPLANATIONS), 'e',
  );
  const flawed = Number.isInteger(initial.flawed_step) ? steps[initial.flawed_step] : null;
  const correct = explanations.find((x) => x.text === initial.correct_explanation);
  const tag = initial.misconception && typeof initial.misconception === 'object'
    ? initial.misconception.tag
    : initial.misconception;
  return {
    title: initial.title || '',
    subject: SUBJECTS.includes(initial.subject) ? initial.subject : '',
    time: String(initial.time_limit_seconds ?? DEFAULT_TIME),
    problem: initial.problem || '',
    steps,
    flawedKey: flawed ? flawed.key : '',
    explanations,
    correctKey: correct ? correct.key : '',
    misconception: tag || '',
    debrief: initial.debrief || '',
  };
};

const lengthError = (value, [min, max]) => {
  const n = charCount(value);
  if (n < min) return `Needs at least ${min} characters (${n} so far)`;
  if (n > max) return `Keep it under ${max + 1} characters (${n} now)`;
  return null;
};

// Checks a list of texts: per-item length errors plus duplicates (ignoring case, like the server).
const checkList = (items, range, noun) => {
  const errors = {};
  const seen = new Map();
  let tooShortOrLong = false;
  let duplicate = false;
  items.forEach((item, i) => {
    const error = lengthError(item.text, range);
    if (error) {
      errors[item.key] = error;
      tooShortOrLong = true;
      return;
    }
    const norm = item.text.trim().toLowerCase();
    if (seen.has(norm)) {
      errors[item.key] = `Same as ${noun} ${seen.get(norm) + 1} — each one must be different`;
      duplicate = true;
    } else {
      seen.set(norm, i);
    }
  });
  return { errors, tooShortOrLong, duplicate };
};

const validate = (form, tagsForSubject) => {
  const errors = {};
  const todo = [];
  const add = (field, message, todoText) => {
    errors[field] = message;
    todo.push(todoText);
  };

  const titleError = lengthError(form.title, LIMITS.title);
  if (titleError) add('title', titleError, 'Give it a title (5–80 characters)');
  if (!SUBJECTS.includes(form.subject)) add('subject', 'Pick a subject', 'Pick a subject');
  const time = Number(form.time);
  if (!Number.isInteger(time) || time < LIMITS.time[0] || time > LIMITS.time[1]) {
    add('time', 'Choose a whole number from 30 to 300', 'Set a time limit between 30 and 300 seconds');
  }
  const problemError = lengthError(form.problem, LIMITS.problem);
  if (problemError) add('problem', problemError, 'Describe the problem (20–800 characters)');

  const steps = checkList(form.steps, LIMITS.step, 'Step');
  errors.steps = steps.errors;
  if (form.steps.length < LIMITS.steps[0] || form.steps.length > LIMITS.steps[1]) todo.push('Use 3–8 steps');
  if (steps.tooShortOrLong) todo.push('Fill in every step (5–300 characters each)');
  if (steps.duplicate) todo.push('Two steps are identical');
  if (!form.steps.some((s) => s.key === form.flawedKey)) {
    add('flawed', 'Mark the step where the reasoning first goes wrong', 'Mark the step that is wrong');
  }

  const explanations = checkList(form.explanations, LIMITS.explanation, 'Explanation');
  errors.explanations = explanations.errors;
  if (form.explanations.length < LIMITS.explanations[0] || form.explanations.length > LIMITS.explanations[1]) {
    todo.push('Use 2–4 explanations');
  }
  if (explanations.tooShortOrLong) todo.push('Fill in every explanation (5–300 characters each)');
  if (explanations.duplicate) todo.push('Explanations must all be different');
  if (!form.explanations.some((x) => x.key === form.correctKey)) {
    add('correct', 'Mark which explanation is the right one', 'Mark the right explanation');
  }

  if (!form.misconception) {
    add('misconception', 'Pick the misconception behind the bug', 'Pick the misconception behind the bug');
  } else if (tagsForSubject && !tagsForSubject.includes(form.misconception)) {
    add('misconception', 'Pick a misconception from this subject', 'Pick a misconception from this subject');
  }

  const debriefError = lengthError(form.debrief, LIMITS.debrief);
  if (debriefError) add('debrief', debriefError, 'Write the debrief (20–1000 characters)');

  return { errors, todo, valid: todo.length === 0 };
};

const toPayload = (form) => ({
  title: form.title.trim(),
  subject: form.subject,
  problem: form.problem.trim(),
  steps: form.steps.map((s) => s.text.trim()),
  explanations: form.explanations.map((x) => x.text.trim()),
  flawed_step: form.steps.findIndex((s) => s.key === form.flawedKey),
  correct_explanation: (form.explanations.find((x) => x.key === form.correctKey)?.text || '').trim(),
  misconception: form.misconception,
  debrief: form.debrief.trim(),
  time_limit_seconds: Number(form.time),
});

// Neutral helper text that turns into an error (icon + text, not colour alone) once it should show.
const FieldHint = ({ id, error, show, children, testId }) => {
  const isError = Boolean(error && show);
  return (
    <p
      id={id}
      className={`text-xs flex items-start gap-1 ${isError ? 'text-rose-700' : 'text-gray-500'}`}
      data-testid={testId}
    >
      {isError && <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />}
      <span>{isError ? error : children}</span>
    </p>
  );
};

const IconAction = ({ label, onClick, disabled, testId, children, danger }) => (
  <Button
    type="button"
    variant="ghost"
    size="icon"
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    title={label}
    className={`h-8 w-8 ${danger ? 'text-rose-700 hover:bg-rose-50 hover:text-rose-800' : 'text-gray-600'} ${focusRing}`}
    data-testid={testId}
  >
    {children}
  </Button>
);

export const ScenarioBuilder = ({ open, onOpenChange, initial = null, onSaved }) => {
  const { API } = useContext(AuthContext);
  const [form, setForm] = useState(blankForm);
  const [touched, setTouched] = useState({});
  const [misconceptions, setMisconceptions] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const [focusId, setFocusId] = useState(null);
  const editing = Boolean(initial?.id);

  // Every time the dialog opens, start from the scenario being edited (or a blank one)
  useEffect(() => {
    if (open) {
      setForm(formFromInitial(initial));
      setTouched({});
      setServerError('');
      setAnnouncement('');
    }
  }, [open, initial]);

  const fetchMisconceptions = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/misconceptions`);
      setMisconceptions(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  }, [API]);

  useEffect(() => {
    if (open) fetchMisconceptions();
  }, [open, fetchMisconceptions]);

  // Move focus into a step / explanation that was just added
  useEffect(() => {
    if (!focusId) return;
    const el = document.getElementById(focusId);
    if (el) el.focus();
    setFocusId(null);
  }, [focusId]);

  const subjectTags = useMemo(
    () => (misconceptions || []).filter((m) => m.subject === form.subject),
    [misconceptions, form.subject],
  );
  const { errors, todo, valid } = useMemo(
    () => validate(form, misconceptions ? subjectTags.map((m) => m.tag) : null),
    [form, misconceptions, subjectTags],
  );
  const selectedTag = subjectTags.find((m) => m.tag === form.misconception);

  const touch = (field) => setTouched((t) => (t[field] ? t : { ...t, [field]: true }));
  const shows = (field, value) => Boolean(touched[field] || charCount(value) > 0);
  const setField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const changeSubject = (subject) => {
    // Misconception tags belong to one subject, so a new subject clears the tag
    setForm((f) => ({ ...f, subject, misconception: subject === f.subject ? f.misconception : '' }));
  };

  // ----- steps -----
  const setStepText = (key, text) => setForm((f) => ({
    ...f, steps: f.steps.map((s) => (s.key === key ? { ...s, text } : s)),
  }));

  const moveStep = (index, delta) => {
    const target = index + delta;
    if (target < 0 || target >= form.steps.length) return;
    setForm((f) => {
      const steps = [...f.steps];
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...f, steps };
    });
    setAnnouncement(`Step ${index + 1} moved ${delta < 0 ? 'up' : 'down'} to position ${target + 1}`);
  };

  const removeStep = (index) => {
    if (form.steps.length <= LIMITS.steps[0]) return;
    const removed = form.steps[index];
    const wasFlawed = removed.key === form.flawedKey;
    setForm((f) => ({
      ...f,
      steps: f.steps.filter((s) => s.key !== removed.key),
      flawedKey: f.flawedKey === removed.key ? '' : f.flawedKey,
    }));
    setAnnouncement(`Step ${index + 1} removed${wasFlawed ? ' — mark the wrong step again' : ''}`);
  };

  const addStep = () => {
    if (form.steps.length >= LIMITS.steps[1]) return;
    const key = newKey('s');
    setForm((f) => ({ ...f, steps: [...f.steps, { key, text: '' }] }));
    setAnnouncement(`Step ${form.steps.length + 1} added`);
    setFocusId(`scenario-step-text-${key}`);
  };

  // ----- explanations -----
  const setExplanationText = (key, text) => setForm((f) => ({
    ...f, explanations: f.explanations.map((x) => (x.key === key ? { ...x, text } : x)),
  }));

  const removeExplanation = (index) => {
    if (form.explanations.length <= LIMITS.explanations[0]) return;
    const removed = form.explanations[index];
    const wasCorrect = removed.key === form.correctKey;
    setForm((f) => ({
      ...f,
      explanations: f.explanations.filter((x) => x.key !== removed.key),
      correctKey: f.correctKey === removed.key ? '' : f.correctKey,
    }));
    setAnnouncement(`Explanation ${index + 1} removed${wasCorrect ? ' — mark the right explanation again' : ''}`);
  };

  const addExplanation = () => {
    if (form.explanations.length >= LIMITS.explanations[1]) return;
    const key = newKey('e');
    setForm((f) => ({ ...f, explanations: [...f.explanations, { key, text: '' }] }));
    setAnnouncement(`Explanation ${form.explanations.length + 1} added`);
    setFocusId(`scenario-explanation-text-${key}`);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    setServerError('');
    try {
      const payload = toPayload(form);
      const res = editing
        ? await axios.put(`${API}/arena/peer/${initial.id}`, payload)
        : await axios.post(`${API}/arena/peer`, payload);
      toast.success('Sent to your teacher for review');
      setForm(blankForm());
      setTouched({});
      if (onSaved) onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      const message = formatApiError(err.response?.data?.detail);
      setServerError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  const flawedIndex = form.steps.findIndex((s) => s.key === form.flawedKey);
  const correctIndex = form.explanations.findIndex((x) => x.key === form.correctKey);
  const teacherNote = initial?.status === 'rejected' && initial?.review?.note ? initial.review : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto" data-testid="scenario-builder">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            <Bug className="w-5 h-5 text-rose-600 shrink-0" aria-hidden="true" />
            {editing ? 'Edit your scenario' : 'Write a Debug Arena scenario'}
          </DialogTitle>
          <DialogDescription className="text-left">
            Write a worked solution with exactly ONE wrong step — the first place the reasoning goes wrong. Your
            teacher reviews it before classmates see it.
          </DialogDescription>
        </DialogHeader>

        {teacherNote && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900" data-testid="scenario-teacher-note">
            <p className="font-semibold flex items-center gap-1">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              {teacherNote.by_name || 'Your teacher'} sent it back:
            </p>
            <p className="mt-1 whitespace-pre-line break-words">{teacherNote.note}</p>
          </div>
        )}

        <p className="sr-only" aria-live="polite">{announcement}</p>

        <form onSubmit={submit} noValidate className="space-y-6 min-w-0">
          {/* ----- Basics ----- */}
          <div className="space-y-2">
            <Label htmlFor="scenario-title">Title</Label>
            <Input
              id="scenario-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              onBlur={() => touch('title')}
              maxLength={LIMITS.title[1]}
              placeholder="e.g. The speedy shortcut"
              aria-invalid={Boolean(errors.title && shows('title', form.title))}
              aria-describedby="scenario-title-hint"
              data-testid="scenario-title-input"
            />
            <FieldHint id="scenario-title-hint" error={errors.title} show={shows('title', form.title)}>
              5–80 characters · {charCount(form.title)}/{LIMITS.title[1]}
            </FieldHint>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="scenario-subject">Subject</Label>
              <Select
                value={form.subject}
                onValueChange={changeSubject}
                onOpenChange={(isOpen) => { if (!isOpen) touch('subject'); }}
              >
                <SelectTrigger
                  id="scenario-subject"
                  className={focusRing}
                  aria-describedby="scenario-subject-hint"
                  data-testid="scenario-subject-select"
                >
                  <SelectValue placeholder="Pick a subject" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>{subjectEmoji(s)} {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldHint id="scenario-subject-hint" error={errors.subject} show={Boolean(touched.subject)}>
                The misconception list depends on it.
              </FieldHint>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="scenario-time">Time limit (seconds)</Label>
              <Input
                id="scenario-time"
                type="number"
                inputMode="numeric"
                min={LIMITS.time[0]}
                max={LIMITS.time[1]}
                step={1}
                value={form.time}
                onChange={(e) => setField('time', e.target.value)}
                onBlur={() => touch('time')}
                aria-invalid={Boolean(errors.time)}
                aria-describedby="scenario-time-hint"
                data-testid="scenario-time-input"
              />
              <FieldHint id="scenario-time-hint" error={errors.time} show>
                30–300 seconds. Most classmates need about 90.
              </FieldHint>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-problem">Problem</Label>
            <Textarea
              id="scenario-problem"
              rows={4}
              value={form.problem}
              onChange={(e) => setField('problem', e.target.value)}
              onBlur={() => touch('problem')}
              maxLength={LIMITS.problem[1]}
              placeholder="State the question your worked solution answers."
              aria-invalid={Boolean(errors.problem && shows('problem', form.problem))}
              aria-describedby="scenario-problem-hint"
              data-testid="scenario-problem-input"
            />
            <FieldHint id="scenario-problem-hint" error={errors.problem} show={shows('problem', form.problem)}>
              20–800 characters · {charCount(form.problem)}/{LIMITS.problem[1]}
            </FieldHint>
          </div>

          {/* ----- Steps ----- */}
          <fieldset className="space-y-3 min-w-0">
            <legend className="text-sm font-medium mb-1">Solution steps</legend>
            <p className="text-xs text-gray-500" id="scenario-steps-hint">
              Write {LIMITS.steps[0]}–{LIMITS.steps[1]} steps in order (5–300 characters each). Mark the ONE step where
              the reasoning first goes wrong — the steps after it may follow from the mistake.
            </p>
            <RadioGroup
              value={form.flawedKey}
              onValueChange={(v) => setField('flawedKey', v)}
              aria-label="Which step is wrong?"
              aria-describedby="scenario-flawed-hint"
              className="gap-3"
            >
              <ol className="space-y-3">
                {form.steps.map((s, i) => {
                  const flawed = s.key === form.flawedKey;
                  const stepError = errors.steps[s.key];
                  const showStepError = shows(`step-${s.key}`, s.text);
                  return (
                    <li
                      key={s.key}
                      className={`rounded-lg border-2 p-3 transition-colors ${
                        flawed ? 'border-rose-300 bg-rose-50' : 'border-gray-200 bg-white'
                      }`}
                      data-testid={`scenario-step-${i}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <Label htmlFor={`scenario-step-text-${s.key}`} className="font-semibold flex items-center gap-2">
                          Step {i + 1}
                          {flawed && (
                            <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-800">
                              <Bug className="w-3 h-3" aria-hidden="true" /> Wrong step
                            </span>
                          )}
                        </Label>
                        <div className="flex items-center gap-1">
                          <IconAction
                            label={`Move step ${i + 1} up`}
                            onClick={() => moveStep(i, -1)}
                            disabled={i === 0}
                            testId={`scenario-step-${i}-up`}
                          >
                            <ArrowUp className="w-4 h-4" aria-hidden="true" />
                          </IconAction>
                          <IconAction
                            label={`Move step ${i + 1} down`}
                            onClick={() => moveStep(i, 1)}
                            disabled={i === form.steps.length - 1}
                            testId={`scenario-step-${i}-down`}
                          >
                            <ArrowDown className="w-4 h-4" aria-hidden="true" />
                          </IconAction>
                          <IconAction
                            label={`Remove step ${i + 1}`}
                            onClick={() => removeStep(i)}
                            disabled={form.steps.length <= LIMITS.steps[0]}
                            testId={`scenario-step-${i}-remove`}
                            danger
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </IconAction>
                        </div>
                      </div>
                      <Textarea
                        id={`scenario-step-text-${s.key}`}
                        rows={2}
                        value={s.text}
                        onChange={(e) => setStepText(s.key, e.target.value)}
                        onBlur={() => touch(`step-${s.key}`)}
                        maxLength={LIMITS.step[1]}
                        placeholder={i === 0 ? 'e.g. Write down what we know: distance = 120 km, time = 1.5 h' : ''}
                        aria-invalid={Boolean(stepError && showStepError)}
                        aria-describedby={`scenario-step-hint-${s.key}`}
                        className="bg-white"
                        data-testid={`scenario-step-${i}-input`}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            value={s.key}
                            id={`scenario-step-flawed-${s.key}`}
                            className={`border-rose-600 text-rose-600 ${focusRing}`}
                            data-testid={`scenario-step-${i}-flawed`}
                          />
                          <Label htmlFor={`scenario-step-flawed-${s.key}`} className="text-sm font-normal cursor-pointer">
                            This step is wrong
                          </Label>
                        </div>
                        <FieldHint id={`scenario-step-hint-${s.key}`} error={stepError} show={showStepError}>
                          {charCount(s.text)}/{LIMITS.step[1]}
                        </FieldHint>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </RadioGroup>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addStep}
                disabled={form.steps.length >= LIMITS.steps[1]}
                className={focusRing}
                data-testid="scenario-add-step-btn"
              >
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add step
              </Button>
              <p
                id="scenario-flawed-hint"
                className={`text-xs flex items-center gap-1 ${flawedIndex >= 0 ? 'text-rose-800' : 'text-gray-500'}`}
                data-testid="scenario-flawed-status"
              >
                {flawedIndex >= 0 ? (
                  <><Bug className="w-3.5 h-3.5" aria-hidden="true" /> Step {flawedIndex + 1} is marked as the wrong step</>
                ) : (
                  'No wrong step marked yet'
                )}
                {form.steps.length >= LIMITS.steps[1] && ` · ${LIMITS.steps[1]} steps is the maximum`}
              </p>
            </div>
          </fieldset>

          {/* ----- Explanations ----- */}
          <fieldset className="space-y-3 min-w-0">
            <legend className="text-sm font-medium mb-1">Why is that step wrong? — answer options</legend>
            <p className="text-xs text-gray-500">
              Write {LIMITS.explanations[0]}–{LIMITS.explanations[1]} explanations: one right, the others believable but
              wrong. Classmates see them in a shuffled order.
            </p>
            <RadioGroup
              value={form.correctKey}
              onValueChange={(v) => setField('correctKey', v)}
              aria-label="Which explanation is right?"
              aria-describedby="scenario-correct-hint"
              className="gap-3"
            >
              <ol className="space-y-3">
                {form.explanations.map((x, i) => {
                  const correct = x.key === form.correctKey;
                  const xError = errors.explanations[x.key];
                  const showXError = shows(`expl-${x.key}`, x.text);
                  return (
                    <li
                      key={x.key}
                      className={`rounded-lg border-2 p-3 transition-colors ${
                        correct ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white'
                      }`}
                      data-testid={`scenario-explanation-${i}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Label htmlFor={`scenario-explanation-text-${x.key}`} className="font-semibold flex flex-wrap items-center gap-2">
                          Explanation {i + 1}
                          {correct && (
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> Right one
                            </span>
                          )}
                        </Label>
                        <IconAction
                          label={`Remove explanation ${i + 1}`}
                          onClick={() => removeExplanation(i)}
                          disabled={form.explanations.length <= LIMITS.explanations[0]}
                          testId={`scenario-explanation-${i}-remove`}
                          danger
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </IconAction>
                      </div>
                      <Input
                        id={`scenario-explanation-text-${x.key}`}
                        value={x.text}
                        onChange={(e) => setExplanationText(x.key, e.target.value)}
                        onBlur={() => touch(`expl-${x.key}`)}
                        maxLength={LIMITS.explanation[1]}
                        aria-invalid={Boolean(xError && showXError)}
                        aria-describedby={`scenario-explanation-hint-${x.key}`}
                        className="bg-white"
                        data-testid={`scenario-explanation-${i}-input`}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem
                            value={x.key}
                            id={`scenario-explanation-correct-${x.key}`}
                            className={`border-emerald-700 text-emerald-700 ${focusRing}`}
                            data-testid={`scenario-explanation-${i}-correct`}
                          />
                          <Label htmlFor={`scenario-explanation-correct-${x.key}`} className="text-sm font-normal cursor-pointer">
                            This is the right explanation
                          </Label>
                        </div>
                        <FieldHint id={`scenario-explanation-hint-${x.key}`} error={xError} show={showXError}>
                          {charCount(x.text)}/{LIMITS.explanation[1]}
                        </FieldHint>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </RadioGroup>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={addExplanation}
                disabled={form.explanations.length >= LIMITS.explanations[1]}
                className={focusRing}
                data-testid="scenario-add-explanation-btn"
              >
                <Plus className="w-4 h-4 mr-1" aria-hidden="true" /> Add explanation
              </Button>
              <p
                id="scenario-correct-hint"
                className={`text-xs flex items-center gap-1 ${correctIndex >= 0 ? 'text-emerald-800' : 'text-gray-500'}`}
                data-testid="scenario-correct-status"
              >
                {correctIndex >= 0 ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> Explanation {correctIndex + 1} is marked as right</>
                ) : (
                  'No right explanation marked yet'
                )}
              </p>
            </div>
          </fieldset>

          {/* ----- Misconception + debrief ----- */}
          <div className="space-y-2 min-w-0">
            <Label htmlFor="scenario-misconception">Misconception behind the bug</Label>
            <Select
              value={form.misconception}
              onValueChange={(v) => setField('misconception', v)}
              onOpenChange={(isOpen) => { if (!isOpen) touch('misconception'); }}
              disabled={!form.subject || !misconceptions || subjectTags.length === 0}
            >
              <SelectTrigger
                id="scenario-misconception"
                className={focusRing}
                aria-describedby="scenario-misconception-hint"
                data-testid="scenario-misconception-select"
              >
                <SelectValue
                  placeholder={
                    !form.subject ? 'Pick a subject first' : !misconceptions ? 'Loading…' : 'Pick a misconception'
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-w-[calc(100vw-2rem)]">
                {subjectTags.map((m) => (
                  <SelectItem key={m.tag} value={m.tag} data-testid={`scenario-misconception-${m.tag}`}>
                    {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHint
              id="scenario-misconception-hint"
              error={errors.misconception}
              show={Boolean(form.misconception) || Boolean(touched.misconception)}
            >
              {selectedTag
                ? `Tagged: ${selectedTag.description}`
                : form.subject && misconceptions && subjectTags.length === 0
                  ? `No misconceptions are listed for ${form.subject} yet — try another subject.`
                  : 'Your teacher uses this to see which ideas the class mixes up.'}
            </FieldHint>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-debrief">Debrief</Label>
            <Textarea
              id="scenario-debrief"
              rows={4}
              value={form.debrief}
              onChange={(e) => setField('debrief', e.target.value)}
              onBlur={() => touch('debrief')}
              maxLength={LIMITS.debrief[1]}
              placeholder="Explain the bug and the correct reasoning — students see this after they answer"
              aria-invalid={Boolean(errors.debrief && shows('debrief', form.debrief))}
              aria-describedby="scenario-debrief-hint"
              data-testid="scenario-debrief-input"
            />
            <FieldHint id="scenario-debrief-hint" error={errors.debrief} show={shows('debrief', form.debrief)}>
              20–1000 characters · {charCount(form.debrief)}/{LIMITS.debrief[1]}
            </FieldHint>
          </div>

          {/* ----- Submit ----- */}
          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
              data-testid="scenario-server-error"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{serverError}</span>
            </div>
          )}

          {!valid && (
            <div id="scenario-todo" className="rounded-lg bg-amber-50 border border-amber-200 p-3" data-testid="scenario-todo">
              <p className="text-xs font-semibold text-amber-900 mb-1">Before you can send it:</p>
              <ul className="list-disc pl-5 text-xs text-amber-900 space-y-0.5">
                {todo.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={focusRing}
              data-testid="cancel-scenario-btn"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid || submitting}
              aria-describedby={!valid ? 'scenario-todo' : undefined}
              className={`bg-emerald-600 hover:bg-emerald-700 ${focusRing}`}
              data-testid="submit-scenario-btn"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" /> Sending to your teacher…</>
              ) : (
                <><Send className="w-4 h-4 mr-2" aria-hidden="true" /> {editing ? 'Resubmit for review' : 'Send to my teacher'}</>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
