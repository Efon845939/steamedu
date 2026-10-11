import React, { useCallback, useContext, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, useMotionValue, useSpring } from 'motion/react';
import * as m from 'motion/react-m';
import { ArrowRight, Languages, ScanLine, Timer } from 'lucide-react';
import { AuthContext } from '../App';
import { MotionScope, useMotion } from '../lib/motion';
import { BrandMark, CorrectionMark, SpecimenLabel, StatusWord } from './lab';
import { cn } from '../lib/utils';

// Logged-out landing. Liquid glass layers over a slow ambient light field, one live
// Debug Arena puzzle as the hero, a trace that draws as you scroll through the three
// steps, and a teacher X-ray that scans in. Everything settles to a readable static
// page with reduced motion, motion off or lite mode.

const ARENA = {
  en: {
    title: 'The Top of the Throw',
    toggle: 'Türkçe göster',
    problem:
      'A 0.5 kg ball is thrown straight up. Ignoring air resistance, what is the net force on the ball at its highest point? (g = 9.8 m/s²)',
    steps: [
      'Once the ball leaves the hand, the only force acting on it is gravity.',
      'On the way up, gravity slows the ball down by 9.8 m/s every second.',
      'At the highest point the ball stops rising for an instant, so its velocity is 0 m/s.',
      'Since the velocity is zero, the net force on the ball at that instant must also be zero: 0 N.',
    ],
    holds: 'Holds',
    breaks: 'Breaks here',
    prompt: 'Tap the first step that goes wrong.',
    label: 'Zero velocity, zero force',
    foundLead: 'Breaks at step 4.',
    explain: 'Zero speed is not zero force: gravity still pulls down, so the net force is mg ≈ 4.9 N.',
    early: (n) => `Step ${n} holds. The first wrong step is further down.`,
  },
  tr: {
    title: 'Atışın tepesi',
    toggle: 'Show in English',
    problem:
      '0,5 kg kütleli bir top dik olarak yukarı atılıyor. Hava direnci ihmal edilirse, en yüksek noktada topa etki eden net kuvvet nedir? (g = 9,8 m/s²)',
    steps: [
      'Top elden çıktıktan sonra ona etki eden tek kuvvet yer çekimidir.',
      'Yukarı çıkarken yer çekimi topu her saniye 9,8 m/s yavaşlatır.',
      'En yüksek noktada top bir anlığına yükselmeyi bırakır, yani hızı 0 m/s olur.',
      'Hız sıfır olduğuna göre, o anda topa etki eden net kuvvet de sıfır olmalıdır: 0 N.',
    ],
    holds: 'Doğru',
    breaks: 'Burada kırılıyor',
    prompt: 'Yanlış giden ilk adıma dokun.',
    label: 'Sıfır hız, sıfır kuvvet',
    foundLead: '4. adımda kırılıyor.',
    explain:
      'Hızın sıfır olması kuvvetin sıfır olması demek değildir: yer çekimi hâlâ aşağı çeker, yani net kuvvet mg ≈ 4,9 N olur.',
    early: (n) => `${n}. adım doğru. Yanlış giden ilk adım daha aşağıda.`,
  },
};
const FLAWED = 3;

// Sample X-ray for illustration only (labelled as such on the page).
const XRAY_COLS = ['Zero velocity, zero force', 'Impetus', 'Heavier falls faster'];
const XRAY_ROWS = [
  ['Ayşe K.', [80, 50, 0]],
  ['Gökçe T.', [40, 60, 20]],
  ['İlker S.', [60, 0, 33]],
  ['Mert D.', [75, 25, 10]],
];
const XRAY_CLASS = [['61%', '17 / 28'], ['43%', '12 / 28'], ['18%', '5 / 28']];
const rampStep = (v) => (v === 0 ? 0 : v < 20 ? 1 : v < 35 ? 2 : v < 50 ? 3 : v < 70 ? 4 : 5);
const RAMP_BG = ['bg-ramp-0', 'bg-ramp-1', 'bg-ramp-2', 'bg-ramp-3', 'bg-ramp-4', 'bg-ramp-5'];
const RAMP_INK = ['text-ramp-ink-0', 'text-ramp-ink-1', 'text-ramp-ink-2', 'text-ramp-ink-3', 'text-ramp-ink-4', 'text-ramp-ink-5'];
// Cells at 50% or more also get a hatch, so the X-ray reads without colour (and in print).
const HATCH = { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 5px, rgb(var(--ramp-ink-5) / 0.26) 5px 6.5px)' };

// Pointer sheen for .glass panels: writes --mx / --my so the highlight follows the cursor.
const useSheen = () =>
  useCallback((e) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
  }, []);

const finePointer = () => {
  try {
    return window.matchMedia('(pointer: fine)').matches;
  } catch (e) {
    return false;
  }
};

// Headline that resolves word by word, from blurred to sharp. The full sentence stays
// the accessible name; the animated words are presentation.
const RevealHeadline = ({ lines, className }) => {
  const mo = useMotion();
  let index = 0;
  return (
    <h1 className={className} aria-label={lines.map((l) => l.map((w) => w.text).join(' ')).join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.map((word) => {
            const i = index++;
            const inner = word.mark ? (
              <span className="relative inline-block">
                {word.text}
                <WavyUnderline delay={0.55 + i * 0.07} />
              </span>
            ) : (
              word.text
            );
            return (
              <m.span
                key={word.text + i}
                className="inline-block"
                initial={mo.full ? { opacity: 0, y: 28, filter: 'blur(12px)' } : { opacity: mo.off ? 1 : 0 }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={mo.full ? { type: 'spring', stiffness: 170, damping: 22, delay: 0.08 + i * 0.07 } : mo.enter}
              >
                {inner}
                {' '}
              </m.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
};

// The correction mark drawn under the hero's "wrong idea".
const WavyUnderline = ({ delay = 0.6 }) => {
  const mo = useMotion();
  return (
    <svg
      className="pointer-events-none absolute -bottom-[0.12em] left-0 h-[0.32em] w-full overflow-visible text-danger"
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <m.path
        d="M2 10 Q 9 2, 16 10 T 30 10 T 44 10 T 58 10 T 72 10 T 86 10 T 100 10 T 114 10 T 128 10 T 142 10 T 156 10 T 170 10 T 184 10 T 198 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        initial={{ pathLength: mo.full ? 0 : 1, opacity: mo.off ? 1 : 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={mo.full ? { duration: 0.9, ease: [0.65, 0, 0.35, 1], delay } : mo.enter}
      />
    </svg>
  );
};

// Scroll-triggered entrance for a section's content.
const Reveal = ({ children, className, delay = 0, as = 'div' }) => {
  const mo = useMotion();
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial={mo.full ? { opacity: 0, y: 40, filter: 'blur(8px)' } : { opacity: mo.off ? 1 : 0 }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount: 0.25 }}
      transition={mo.full ? { type: 'spring', stiffness: 120, damping: 20, delay } : mo.enter}
    >
      {children}
    </Comp>
  );
};

// The hero: one real Debug Arena puzzle on a floating glass card that tilts with the pointer.
const ArenaDemo = () => {
  const mo = useMotion();
  const sheen = useSheen();
  const [lang, setLang] = useState('en');
  const [picked, setPicked] = useState(null);
  const t = ARENA[lang];

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 150, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 150, damping: 18 });
  const tilt = mo.full && finePointer();

  const onMove = (e) => {
    sheen(e);
    if (!tilt) return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 9);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 7);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const found = picked === FLAWED;

  return (
    <m.div
      className="relative"
      initial={mo.full ? { opacity: 0, y: 60, scale: 0.94, filter: 'blur(10px)' } : { opacity: mo.off ? 1 : 0 }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      transition={mo.full ? { type: 'spring', stiffness: 90, damping: 16, delay: 0.35 } : mo.enter}
      style={{ perspective: 1200 }}
    >
      {/* A floating chip in front of the card, for depth. */}
      <m.div
        aria-hidden="true"
        data-decor
        className="glass glass-strong absolute -bottom-5 right-8 z-10 hidden items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold sm:flex"
        animate={mo.full ? { y: [0, -8, 0] } : undefined}
        transition={mo.full ? { duration: 6, repeat: Infinity, ease: 'easeInOut' } : undefined}
      >
        <Timer className="h-4 w-4 text-brand-ink" aria-hidden="true" />
        90 seconds per puzzle
      </m.div>
      <m.figure
        aria-labelledby="arena-demo-title"
        className="glass glass-strong relative m-0 overflow-hidden rounded-[28px]"
        style={tilt ? { rotateX, rotateY, transformStyle: 'preserve-3d' } : undefined}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-3 pt-5">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-ink-muted">Debug Arena, live sample</span>
            <span id="arena-demo-title" lang={lang} className="t-h3 text-xl">
              {t.title}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLang((l) => (l === 'en' ? 'tr' : 'en'))}
            aria-pressed={lang === 'tr'}
            className="glass inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-transform active:scale-95"
          >
            <Languages className="h-4 w-4" aria-hidden="true" />
            {t.toggle}
          </button>
        </div>
        <p lang={lang} className="px-6 pb-4 text-sm leading-relaxed text-ink-muted">
          {t.problem}
        </p>
        <ol lang={lang} className="graph-paper mx-3 overflow-hidden rounded-2xl border border-rule/70 bg-surface/70">
          {t.steps.map((text, i) => {
            const isPicked = picked === i;
            const holds = picked !== null && i < FLAWED && i <= picked;
            const breaks = found && i === FLAWED;
            return (
              <li key={i} className="border-b border-rule/70 last:border-b-0">
                <button
                  type="button"
                  onClick={() => setPicked(i)}
                  aria-pressed={isPicked}
                  className={cn(
                    'grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3.5 text-left transition-colors',
                    isPicked ? 'bg-brand-tint/80' : 'hover:bg-brand-tint/45'
                  )}
                >
                  <span className="t-num pt-px text-right text-ink-muted">{i + 1}</span>
                  <span className="leading-relaxed">
                    {breaks ? <CorrectionMark draw={mo.full}>{text}</CorrectionMark> : text}
                  </span>
                  <span className="min-w-[1.25rem] pt-0.5">
                    <AnimatePresence>
                      {holds && (
                        <m.span
                          key="holds"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={mo.full ? { type: 'spring', stiffness: 500, damping: 22, delay: i * 0.06 } : mo.enter}
                          className="inline-flex"
                        >
                          <StatusWord status="holds">{t.holds}</StatusWord>
                        </m.span>
                      )}
                      {breaks && (
                        <m.span
                          key="breaks"
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={mo.full ? { type: 'spring', stiffness: 500, damping: 18, delay: 0.2 } : mo.enter}
                          className="inline-flex"
                        >
                          <StatusWord status="breaks">{t.breaks}</StatusWord>
                        </m.span>
                      )}
                    </AnimatePresence>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
        <div aria-live="polite" lang={lang} className="min-h-[5.5rem] px-6 pb-6 pt-4 sm:pb-10">
          <AnimatePresence mode="wait" initial={false}>
            {picked === null && (
              <m.p key="idle" {...mo.fade} className="text-sm text-ink-muted">
                {t.prompt}
              </m.p>
            )}
            {picked !== null && !found && (
              <m.p key={`early-${picked}`} {...mo.rise} className="text-sm leading-relaxed">
                {t.early(picked + 1)}
              </m.p>
            )}
            {found && (
              <m.div key="found" {...mo.rise} className="flex flex-col gap-3">
                <m.span
                  initial={mo.full ? { opacity: 0, y: -14, rotate: -3 } : { opacity: 0 }}
                  animate={{ opacity: 1, y: 0, rotate: 0 }}
                  transition={mo.full ? { type: 'spring', stiffness: 420, damping: 16, delay: 0.25 } : mo.enter}
                  className="self-start"
                >
                  <SpecimenLabel name={t.label} />
                </m.span>
                <p className="text-sm leading-relaxed">
                  <strong className="font-semibold">{t.foundLead}</strong> {t.explain}
                </p>
              </m.div>
            )}
          </AnimatePresence>
        </div>
      </m.figure>
    </m.div>
  );
};

// Three steps, joined by a trace that steps down at the wrong idea and back up; it draws
// once when the section comes into view.
const STEPS = [
  {
    n: '01',
    title: 'Diagnose',
    text: 'Eight questions, each with "how sure are you?". A confident wrong answer is the signal that an idea has set.',
    mini: 'diagnose',
  },
  {
    n: '02',
    title: 'Practise',
    text: 'Debug Arena hands you worked solutions with one broken step. Find it and name the idea behind it.',
    mini: 'practise',
  },
  {
    n: '03',
    title: 'See',
    text: 'The teacher’s Misconception X-ray shows which ideas the class still holds, student by student.',
    mini: 'see',
  },
];

const Mini = ({ kind }) => {
  if (kind === 'diagnose') {
    return (
      <div className="flex flex-col gap-2.5" aria-hidden="true">
        <div className="h-2 w-4/5 rounded-full bg-ink/15" />
        <div className="h-2 w-3/5 rounded-full bg-ink/10" />
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-rule-strong/60 px-2.5 py-1 text-xs text-ink-muted">Guessing</span>
          <span className="rounded-full border border-rule-strong/60 px-2.5 py-1 text-xs text-ink-muted">Fairly sure</span>
          <span className="rounded-full border border-brand-ink bg-brand-tint px-2.5 py-1 text-xs font-semibold">Certain</span>
        </div>
        <StatusWord status="wrong" className="text-xs" />
      </div>
    );
  }
  if (kind === 'practise') {
    return (
      <div className="graph-paper flex flex-col gap-2 rounded-xl border border-rule/60 p-3 text-xs" aria-hidden="true">
        <span className="text-ink-muted">1&nbsp; F = mg acts the whole time</span>
        <span className="text-ink-muted">2&nbsp; At the top, v = 0</span>
        <span>
          3&nbsp; <span className="wavy">so F = 0 at the top</span>
        </span>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-1" aria-hidden="true">
      {[80, 50, 0, 20, 60, 40, 60, 20, 0, 75, 25, 10, 33, 0, 55].map((v, i) => (
        <span key={i} className={cn('h-5 rounded-[3px]', RAMP_BG[rampStep(v)])} style={v >= 50 ? HATCH : undefined} />
      ))}
    </div>
  );
};

const HowItWorks = () => {
  const mo = useMotion();
  const ref = useRef(null);
  const sheen = useSheen();

  return (
    <section ref={ref} aria-labelledby="how-h" className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 md:py-32">
      <Reveal className="mb-20 max-w-2xl">
        <p className="mb-3 text-sm font-semibold text-brand-ink">How it works</p>
        <h2 id="how-h" className="t-h1">
          Catch the idea, fix the idea, see it fixed.
        </h2>
      </Reveal>

      <div className="relative">
      {/* The trace runs just above the cards and follows them: high, down at the wrong
          idea, back up once it is fixed. */}
      <svg
        className="pointer-events-none absolute -top-10 left-0 hidden h-[136px] w-full text-brand-ink md:block"
        viewBox="0 0 1000 136"
        preserveAspectRatio="none"
        aria-hidden="true"
        data-decor
      >
        <m.path
          d="M2 10 H318 L346 106 H654 L682 10 H998"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: mo.full ? 0 : 1 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={mo.full ? { duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.3 } : { duration: 0 }}
          style={{ opacity: 0.7 }}
        />
      </svg>
      <ol className="relative grid gap-6 md:grid-cols-3 md:gap-8">
        {STEPS.map((s, i) => (
          <Reveal as="li" key={s.n} delay={i * 0.12} className={cn(i === 1 && 'md:mt-24')}>
            <m.article
              className="glass flex h-full flex-col gap-5 rounded-[26px] p-6"
              onPointerMove={sheen}
              whileHover={mo.full ? { y: -6 } : undefined}
              transition={mo.spring}
            >
              <div className="flex items-baseline justify-between">
                <span className="t-num text-sm text-brand-ink">{s.n}</span>
              </div>
              <h3 className="t-h2">{s.title}</h3>
              <p className="text-ink-muted">{s.text}</p>
              <div className="mt-auto rounded-2xl border border-rule/50 bg-surface/55 p-4">
                <Mini kind={s.mini} />
              </div>
            </m.article>
          </Reveal>
        ))}
      </ol>
      </div>
    </section>
  );
};

// The teacher view: a sample X-ray that fills in with a scan line when it comes into view.
const XraySection = () => {
  const mo = useMotion();
  const sheen = useSheen();
  return (
    <section aria-labelledby="xray-h" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6 md:pb-32">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Reveal>
          <div className="glass overflow-hidden rounded-[28px] p-2" onPointerMove={sheen}>
            <div className="relative overflow-x-auto rounded-[22px] bg-surface/75">
              <table className="w-full min-w-[34rem] border-separate border-spacing-0 font-sans text-sm">
                <thead>
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-semibold text-ink-muted">
                      Student
                    </th>
                    {XRAY_COLS.map((c) => (
                      <th
                        key={c}
                        scope="col"
                        className="px-3 py-3 text-left font-display text-xs font-semibold leading-tight"
                        style={{ fontStretch: '75%' }}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row" className="border-y border-rule/70 px-4 py-2.5 text-left font-semibold">
                      Class
                    </th>
                    {XRAY_CLASS.map(([pct, n]) => (
                      <td key={pct} className="tnum border-y border-rule/70 px-3 py-2.5 font-semibold">
                        {pct} <span className="font-normal text-ink-muted">{n}</span>
                      </td>
                    ))}
                  </tr>
                  {XRAY_ROWS.map(([name, values], ri) => (
                    <tr key={name}>
                      <th scope="row" className="whitespace-nowrap px-4 text-left font-normal">
                        {name}
                      </th>
                      {values.map((v, ci) => {
                        const k = rampStep(v);
                        return (
                          <td key={ci} className="p-0.5">
                            <m.span
                              className={cn('tnum flex h-10 items-center rounded-md px-3 font-semibold', RAMP_BG[k], RAMP_INK[k], k === 0 && 'ring-1 ring-inset ring-rule-strong')}
                              style={v >= 50 ? HATCH : undefined}
                              initial={mo.full ? { opacity: 0, scale: 0.85 } : { opacity: mo.off ? 1 : 0 }}
                              whileInView={{ opacity: 1, scale: 1 }}
                              viewport={{ once: true, amount: 0.6 }}
                              transition={mo.full ? { type: 'spring', stiffness: 260, damping: 20, delay: 0.25 + ci * 0.12 + ri * 0.05 } : mo.enter}
                            >
                              {v}
                            </m.span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mo.full && (
                <m.div
                  aria-hidden="true"
                  data-decor
                  className="pointer-events-none absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-info-300/35 to-transparent"
                  initial={{ left: '-15%' }}
                  whileInView={{ left: '110%' }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 1.4, ease: [0.65, 0, 0.35, 1], delay: 0.15 }}
                />
              )}
            </div>
            <p className="px-4 pb-2 pt-3 text-xs text-ink-muted">Sample data for illustration, not a real class.</p>
          </div>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-5">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand-ink">
            <ScanLine className="h-4 w-4" aria-hidden="true" />
            Misconception X-ray
          </p>
          <h2 id="xray-h" className="t-h1">
            What your teacher sees.
          </h2>
          <p className="t-lead text-ink-muted">
            Every wrong answer is tagged with the idea behind it. The X-ray puts those ideas in columns, the most common on the left.
          </p>
          <p className="text-ink-muted">A teacher assigns practice for one idea to the students who hold it, then checks the same column again later.</p>
          <Link to="/auth" className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-brand-ink hover:underline">
            I teach a class
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
};

const HomeContent = () => {
  const { user } = useContext(AuthContext);
  const mo = useMotion();
  const ctaSheen = useSheen();
  const primaryTo = user ? '/dashboard' : '/auth';
  const primaryLabel = user ? 'Go to your dashboard' : 'Take the 8-question diagnostic';

  const fadeUp = (delay) => ({
    initial: mo.full ? { opacity: 0, y: 24, filter: 'blur(6px)' } : { opacity: mo.off ? 1 : 0 },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: mo.full ? { type: 'spring', stiffness: 140, damping: 20, delay } : mo.enter,
  });

  return (
    <div className="relative">

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 md:pt-24 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-14 lg:pb-28">
        <div className="flex flex-col gap-7">
          <m.span {...fadeUp(0)} className="glass inline-flex items-center gap-2.5 self-start rounded-full px-4 py-2 text-xs font-semibold sm:text-sm">
            <span className="text-brand-ink">
              <BrandMark size={14} />
            </span>
            Diagnostics, practice and an X-ray for STEM classes
          </m.span>
          <RevealHeadline
            className="font-display text-[clamp(2.5rem,4.6vw,4.1rem)] font-bold leading-[1.02] tracking-[-0.025em]"
            lines={[
              [{ text: 'Find' }, { text: 'the' }],
              [{ text: 'wrong idea', mark: true }],
              [{ text: 'before' }, { text: 'it' }, { text: 'sets.' }],
            ]}
          />
          <m.p {...fadeUp(0.75)} className="t-lead max-w-[34rem] text-ink-muted">
            A short diagnostic shows which physics idea a student really holds. Debug Arena puzzles then work on exactly that idea, in English or Turkish.
          </m.p>
          <m.div {...fadeUp(0.9)} className="flex flex-wrap items-center gap-3">
            <m.span whileHover={mo.full ? { scale: 1.03 } : undefined} whileTap={mo.full ? { scale: 0.97 } : undefined} transition={mo.spring}>
              <Link
                to={primaryTo}
                onPointerMove={ctaSheen}
                className="glass-brand group inline-flex h-14 items-center gap-2.5 rounded-full px-7 text-base font-semibold"
                data-testid="get-started-btn"
              >
                {primaryLabel}
                <ArrowRight className="h-5 w-5 transition-transform duration-enter group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </m.span>
            <Link
              to="/content"
              className="inline-flex h-14 items-center rounded-full px-6 font-semibold text-ink transition-colors hover:bg-surface/50"
              data-testid="explore-content-btn"
            >
              Browse content
            </Link>
          </m.div>
        </div>

        <ArenaDemo />
      </section>

      <HowItWorks />
      <XraySection />

      <section aria-labelledby="cta-h" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="glass glass-tint-brand relative overflow-hidden rounded-[32px] px-6 py-14 text-center sm:px-12 md:py-20" onPointerMove={ctaSheen}>
            <div className="mx-auto mb-6 w-fit text-brand-ink">
              <BrandMark size={34} />
            </div>
            <h2 id="cta-h" className="t-h1 mx-auto max-w-2xl">
              Start with one diagnostic.
            </h2>
            <p className="t-lead mx-auto mt-4 max-w-xl text-ink-muted">Eight questions. Then you know which idea to work on next.</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={primaryTo}
                className="glass-brand inline-flex h-14 items-center gap-2.5 rounded-full px-8 text-base font-semibold transition-transform duration-press active:scale-[0.97]"
                data-testid="join-now-btn"
              >
                {user ? 'Go to your dashboard' : 'Create your account'}
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-rule/70 px-4 py-8 text-sm text-ink-muted sm:px-6">
        <span className="inline-flex items-center gap-2 text-brand-ink">
          <BrandMark size={16} />
          <span className="text-ink-muted">STEAM Hub</span>
        </span>
        <span>Lite mode keeps it fast on slow school connections.</span>
        <nav aria-label="Footer" className="flex gap-5">
          <Link to="/content" className="hover:text-ink">
            Content
          </Link>
          <Link to="/auth" className="hover:text-ink">
            Sign in
          </Link>
        </nav>
      </footer>
    </div>
  );
};

const HomePage = () => (
  <MotionScope>
    <HomeContent />
  </MotionScope>
);

export default HomePage;
