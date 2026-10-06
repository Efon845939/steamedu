// Shared helpers for the Debug Arena (solving, results, filters).

// 75 -> "1:15", 9 -> "0:09". Negative / missing values clamp to "0:00".
export const formatClock = (sec) => {
  const total = Math.max(0, Math.floor(Number(sec) || 0));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

// Arena scores are 0, 50 or 100: 50 for finding the broken step, 50 for naming the concept.
export const scoreTier = (score) => {
  const s = Number(score) || 0;
  if (s >= 100) return { label: 'Bug squashed', className: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
  if (s >= 50) return { label: 'Half way there', className: 'bg-amber-100 text-amber-800 border-amber-300' };
  return { label: 'Missed it', className: 'bg-rose-100 text-rose-800 border-rose-300' };
};

// Values map straight onto the `source` query param of GET /arena/challenges.
export const SOURCE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'system', label: 'Official' },
  { value: 'peer', label: 'Classmates' },
];

export const ARENA_TABS = ['play', 'mine', 'hunters'];

// Reasons accepted by POST /arena/challenges/{id}/flag.
export const FLAG_REASONS = [
  { value: 'wrong_answer', label: 'The marked answer is wrong' },
  { value: 'confusing', label: 'Confusing or ambiguous' },
  { value: 'inappropriate', label: 'Inappropriate' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
];

export const FLAG_NOTE_MAX = 300;

// 0 -> "A", 1 -> "B" ... (explanation labels)
export const optionLetter = (index) => String.fromCharCode(65 + index);

// 0-based step index -> "Step 1"
export const stepLabel = (index) => `Step ${Number(index) + 1}`;

// 0.42 -> 42 ; null stays null
export const ratePercent = (rate) => (rate == null ? null : Math.round(Number(rate) * 100));

// Why a challenge in the list can't be started (null when it can).
export const lockReason = (challenge, user) => {
  if (!challenge || challenge.can_attempt) return null;
  if (challenge.is_mine) return 'You wrote this one, so your classmates get to solve it.';
  if (user?.role === 'teacher') return "Teachers can't solve classmates' scenarios.";
  return "This challenge isn't open to you.";
};
