import { toast } from 'sonner';
import {
  BookCheck, Layers, Target, Puzzle, Flame, CalendarCheck, Star, Sparkles,
  Crown, Lightbulb, BadgeCheck, Trophy, Award, Bug, Search,
} from 'lucide-react';

export const BADGE_ICONS = {
  BookCheck, Layers, Target, Puzzle, Flame, CalendarCheck, Star, Sparkles,
  Crown, Lightbulb, BadgeCheck, Trophy, Bug, Search,
};

export const badgeIcon = (name) => BADGE_ICONS[name] || Award;

export const badgeStyles = {
  emerald: 'from-emerald-400 to-emerald-600 shadow-emerald-200',
  teal: 'from-teal-400 to-teal-600 shadow-teal-200',
  rose: 'from-rose-400 to-rose-600 shadow-rose-200',
  purple: 'from-purple-400 to-purple-600 shadow-purple-200',
  orange: 'from-orange-400 to-orange-600 shadow-orange-200',
  red: 'from-red-400 to-red-600 shadow-red-200',
  yellow: 'from-yellow-400 to-yellow-500 shadow-yellow-200',
  amber: 'from-amber-400 to-amber-600 shadow-amber-200',
  indigo: 'from-indigo-400 to-indigo-600 shadow-indigo-200',
  lime: 'from-lime-400 to-lime-600 shadow-lime-200',
  sky: 'from-sky-400 to-sky-600 shadow-sky-200',
};

export const notifyNewBadges = (newBadges) => {
  (newBadges || []).forEach((b, i) => {
    setTimeout(() => {
      toast.success(`Badge unlocked: ${b.name}`, { description: b.description, duration: 6000 });
    }, i * 400);
  });
};
