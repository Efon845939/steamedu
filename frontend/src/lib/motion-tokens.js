import { useMemo } from 'react';
import { useDisplay } from './theme';

// Motion tokens per age theme, with no dependency on the motion library, so CSS-only
// components can read them without pulling it into the main bundle. lib/motion.js
// (MotionScope) feeds the same values to motion/react.
//
// Rules (frontend/DESIGN.md):
// - One orchestrated moment per screen. Everything else only answers what the person did.
// - Exit is faster than enter. Interactive motion uses the theme spring, nothing else does.
// - Never block input, and put final values (score, points) in the DOM from frame one.
// - Reduced: opacity only, 120ms. Off and lite: nothing moves.

export const MOTION_TOKENS = {
  '13-15': { spring: { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }, enter: 0.22, exit: 0.14, travel: 12, stagger: 0.06, moment: 0.42 },
  '16-18': { spring: { type: 'spring', stiffness: 500, damping: 38 }, enter: 0.18, exit: 0.12, travel: 8, stagger: 0.06, moment: 0.5 },
  '18+': { spring: { type: 'spring', stiffness: 600, damping: 45 }, enter: 0.15, exit: 0.1, travel: 4, stagger: 0.03, moment: 0.35 },
  teacher: { spring: { type: 'spring', stiffness: 520, damping: 42 }, enter: 0.15, exit: 0.1, travel: 0, stagger: 0.012, moment: 0.3 },
};

const EASE_ENTER = [0.2, 0.8, 0.2, 1];
const EASE_EXIT = [0.4, 0, 1, 1];
const REDUCED = { duration: 0.12, ease: 'linear' };
const NONE = { duration: 0 };

export const tokensFor = (theme, mode) => {
  const t = MOTION_TOKENS[theme] || MOTION_TOKENS['16-18'];
  const full = mode === 'full';
  const off = mode === 'off';
  const enter = off ? NONE : full ? { duration: t.enter, ease: EASE_ENTER } : REDUCED;
  const exit = off ? NONE : full ? { duration: t.exit, ease: EASE_EXIT } : REDUCED;
  const spring = full ? t.spring : enter;
  const travel = full ? t.travel : 0;
  return {
    mode,
    full,
    off,
    reduced: mode === 'reduced',
    spring,
    enter,
    exit,
    travel,
    stagger: full ? t.stagger : 0,
    moment: full ? t.moment : off ? 0 : 0.12,
    // Ready-made props for m.* elements (inside a MotionScope).
    rise: { initial: { opacity: 0, y: travel }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: exit }, transition: enter },
    fade: { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: exit }, transition: enter },
    pin: { initial: { opacity: 0, y: -travel }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: exit }, transition: spring },
  };
};

// const mo = useMotion(); mo.full, mo.spring, mo.stagger, <m.div {...mo.rise}>
export const useMotion = () => {
  const { theme, resolved } = useDisplay();
  return useMemo(() => tokensFor(theme, resolved.motion), [theme, resolved.motion]);
};
