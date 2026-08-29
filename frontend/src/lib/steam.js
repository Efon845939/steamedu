export const SUBJECTS = ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics'];
export const AGE_GROUPS = ['13-15', '16-18', '18+'];

export const subjectEmoji = (s) => ({
  science: '🔬', technology: '💻', engineering: '⚙️', arts: '🎨', mathematics: '🔢',
}[s?.toLowerCase()] || '📚');

export const subjectBadgeColor = (s) => ({
  science: 'bg-blue-100 text-blue-800',
  technology: 'bg-purple-100 text-purple-800',
  engineering: 'bg-green-100 text-green-800',
  arts: 'bg-pink-100 text-pink-800',
  mathematics: 'bg-orange-100 text-orange-800',
}[s?.toLowerCase()] || 'bg-gray-100 text-gray-800');

export const difficultyColor = (d) => ({
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-red-100 text-red-800',
}[d?.toLowerCase()] || 'bg-gray-100 text-gray-800');

export const firstName = (fullName) => {
  const honorifics = ['dr.', 'dr', 'mr.', 'mr', 'mrs.', 'mrs', 'ms.', 'ms', 'prof.', 'prof'];
  const parts = (fullName || '').split(' ').filter(Boolean);
  if (parts.length > 1 && honorifics.includes(parts[0].toLowerCase())) return parts[1];
  return parts[0] || '';
};

export const formatApiError = (detail) => {
  if (detail == null) return 'Something went wrong. Please try again.';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => (e && typeof e.msg === 'string' ? e.msg : JSON.stringify(e)))
      .filter(Boolean)
      .join(' ');
  }
  if (detail && typeof detail.msg === 'string') return detail.msg;
  return String(detail);
};
