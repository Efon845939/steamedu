import React from 'react';
import { CircleAlert, CircleCheck, CircleHelp, CircleX, Info, Lightbulb, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';

// The shared marks of the "misconception lab" (frontend/DESIGN.md). One focal mark per
// screen: the specimen label, the correction mark, the trace or graph paper. The rest
// stay absent or quiet.

// Brand mark: a step trace with one kink (the wrong idea) before it steps up.
export const BrandMark = ({ size = 24, title, className, strokeWidth = 2.5 }) => (
  <svg
    width={Math.round((size * 34) / 24)}
    height={size}
    viewBox="0 0 34 24"
    fill="none"
    className={cn('shrink-0', className)}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    <path d="M2 16H13L16 20.5L20 5H32" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Wordmark = ({ className, size = 22 }) => (
  <span className={cn('inline-flex items-center gap-2.5 whitespace-nowrap text-brand-ink', className)}>
    <BrandMark size={size} />
    <span className="font-display text-lg text-ink" style={{ fontStretch: 'var(--display-stretch)', fontWeight: 'var(--display-weight)' }}>
      STEAM Hub
    </span>
  </span>
);

// Specimen label: a misconception, caught and filed. `code` (a catalogue id) only where
// filing or lookup matters.
export const SpecimenLabel = ({ name, code, lang, className, ...rest }) => (
  <span className={cn('specimen', className)} lang={lang} {...rest}>
    {code ? <span className="specimen-code">{code}</span> : null}
    <span className="min-w-0 truncate">{name}</span>
  </span>
);

// Status words. Colour is never the only signal: every state has a fixed glyph and word.
const STATUS = {
  holds: { Icon: CircleCheck, tone: 'text-success', label: 'Holds' },
  correct: { Icon: CircleCheck, tone: 'text-success', label: 'Correct' },
  approved: { Icon: CircleCheck, tone: 'text-success', label: 'Approved' },
  unsure: { Icon: CircleHelp, tone: 'text-warning', label: 'Unsure' },
  review: { Icon: CircleHelp, tone: 'text-warning', label: 'Needs review' },
  changes: { Icon: PenLine, tone: 'text-warning', label: 'Changes asked' },
  breaks: { Icon: CircleAlert, tone: 'text-danger', label: 'Breaks here' },
  wrong: { Icon: CircleAlert, tone: 'text-danger', label: 'Not quite' },
  returned: { Icon: CircleX, tone: 'text-danger', label: 'Returned' },
  given: { Icon: Info, tone: 'text-info', label: 'Given' },
  hint: { Icon: Lightbulb, tone: 'text-info', label: 'Hint' },
  new: { Icon: Info, tone: 'text-info', label: 'New' },
};

export const STATUS_KINDS = Object.keys(STATUS);

export const StatusWord = ({ status, children, className, size = 'sm', ...rest }) => {
  const s = STATUS[status] || STATUS.given;
  const { Icon } = s;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-semibold', s.tone, size === 'sm' ? 'text-sm' : 'text-base', className)}
      {...rest}
    >
      <Icon aria-hidden="true" className="h-[1.15em] w-[1.15em] shrink-0" />
      {children ?? s.label}
    </span>
  );
};

// Trace: a flat line that steps down at each wrong idea and back up when it is fixed.
// levels: array of 'holds' | 'unsure' | 'breaks'. Draws in once when `draw` is set
// (the screen's orchestrated moment); reduced and off motion show it complete.
const LEVEL_Y = { holds: 0.22, unsure: 0.5, breaks: 0.78 };

export const Trace = ({ levels = [], height = 40, draw = false, className, label }) => {
  const n = Math.max(levels.length, 1);
  const w = n * 100;
  const y = (l) => (LEVEL_Y[l] ?? LEVEL_Y.holds) * height;
  let d = `M1 ${y(levels[0])}`;
  levels.forEach((l, i) => {
    if (i > 0) d += ` V${y(l)}`;
    d += ` H${i === n - 1 ? w - 1 : (i + 1) * 100}`;
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={cn('block overflow-visible text-brand-ink', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        className={draw ? 'trace-draw' : undefined}
        style={{ strokeWidth: 'var(--trace)' }}
      />
    </svg>
  );
};

// Correction mark: wavy danger underline on the first wrong step. `draw` reveals it left
// to right (block-level text only, so the overlay wraps exactly like the text).
export const CorrectionMark = ({ children, draw = false, className }) => {
  if (!draw) return <span className={cn('wavy', className)}>{children}</span>;
  return (
    <span className={cn('relative block', className)}>
      {children}
      <span aria-hidden="true" className="wavy wavy-draw">
        {children}
      </span>
    </span>
  );
};

// Graph paper: only inside real work areas (a question diagram, a worked solution,
// a scenario preview). Square corners, because paper has corners.
export const GraphPaper = ({ as: Comp = 'div', className, ...rest }) => (
  <Comp className={cn('graph-paper border border-rule', className)} {...rest} />
);
