/** @type {import('tailwindcss').Config} */

// Theme tokens. The values are CSS variables set per age theme (html[data-age])
// and per mode (html.dark) in src/theme/tokens.css and src/index.css, so one class
// name paints correctly in all four themes. See frontend/DESIGN.md.
//
// Use the semantic names in new code: bg-bg, bg-surface, text-ink, text-ink-muted,
// border-rule, border-rule-strong, bg-brand text-on-brand, text-brand-ink,
// bg-brand-tint, text-success / bg-success-tint / border-success-rule (same for
// warning, danger, info).
//
// The old palette names still resolve, onto the theme instead of a fixed hue:
// gray/slate/zinc/stone -> neutral, emerald/teal/blue/indigo/violet/purple/
// fuchsia/pink -> brand, green/lime -> success, amber/yellow/orange -> warning,
// red/rose -> danger, sky/cyan -> info. So a leftover bg-purple-600 renders in
// the theme's one accent rather than purple.

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const scale = (name) => Object.fromEntries(STEPS.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));
const status = (name) => ({ DEFAULT: v(name), tint: v(`${name}-tint`), rule: v(`${name}-rule`), ...scale(name) });

const neutral = scale('neutral');
const brand = scale('brand');
const success = scale('success');
const warning = scale('warning');
const danger = scale('danger');
const info = scale('info');

// Type sizes follow the theme's scale (index.css sets --fs-*), so text-sm is the
// 13-15 caption (14px) in one theme and the teacher table size in another.
const fs = (name, lineHeight) => [`var(--fs-${name})`, { lineHeight }];

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        bg: v('bg'),
        surface: v('surface'),
        ink: { DEFAULT: v('ink'), muted: v('muted') },
        rule: { DEFAULT: v('rule'), strong: v('rule-strong') },
        brand: { DEFAULT: v('brand'), ink: v('brand-ink'), tint: v('brand-tint'), tint2: v('brand-tint2'), ...brand },
        'on-brand': v('on-brand'),
        'on-danger': v('on-danger'),
        success: status('success'),
        warning: status('warning'),
        danger: status('danger'),
        info: status('info'),
        neutral: { ...neutral, tint: v('neutral-tint') },
        ramp: Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, v(`ramp-${i}`)])),
        'ramp-ink': Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [i, v(`ramp-ink-${i}`)])),

        // Old palette names, mapped onto the theme.
        gray: neutral, slate: neutral, zinc: neutral, stone: neutral,
        emerald: brand, teal: brand, blue: brand, indigo: brand, violet: brand, purple: brand, fuchsia: brand, pink: brand,
        green: success, lime: success,
        amber: warning, yellow: warning, orange: warning,
        red: danger, rose: danger,
        sky: info, cyan: info,

        // shadcn/ui names, pointed at the same tokens.
        background: v('bg'),
        foreground: v('ink'),
        card: { DEFAULT: v('surface'), foreground: v('ink') },
        popover: { DEFAULT: v('surface'), foreground: v('ink') },
        primary: { DEFAULT: v('brand'), foreground: v('on-brand') },
        secondary: { DEFAULT: v('neutral-tint'), foreground: v('ink') },
        muted: { DEFAULT: v('neutral-tint'), foreground: v('muted') },
        accent: { DEFAULT: v('neutral-tint'), foreground: v('ink') },
        destructive: { DEFAULT: v('danger'), foreground: v('on-danger') },
        border: v('rule'),
        input: v('rule-strong'),
        ring: v('brand'),
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
        num: ['var(--font-num)'],
      },
      fontSize: {
        xs: fs('xs', '1.45'),
        sm: fs('sm', '1.5'),
        base: fs('base', 'var(--lh-body)'),
        lg: fs('lg', '1.45'),
        xl: fs('xl', '1.35'),
        '2xl': fs('2xl', '1.25'),
        '3xl': fs('3xl', 'var(--lh-display)'),
        '4xl': fs('4xl', 'var(--lh-display)'),
        '5xl': fs('5xl', 'var(--lh-display)'),
        '6xl': fs('5xl', 'var(--lh-display)'),
        '7xl': fs('5xl', 'var(--lh-display)'),
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        DEFAULT: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-md)',
        xl: 'var(--r-lg)',
        '2xl': 'var(--r-lg)',
        '3xl': 'var(--r-lg)',
        label: '4px',
      },
      boxShadow: {
        sm: 'var(--shadow-raised)',
        DEFAULT: 'var(--shadow-raised)',
        md: 'var(--shadow-raised)',
        lg: 'var(--shadow-float)',
        xl: 'var(--shadow-float)',
        '2xl': 'var(--shadow-float)',
        raised: 'var(--shadow-raised)',
        float: 'var(--shadow-float)',
      },
      transitionDuration: {
        DEFAULT: '120ms',
        press: 'var(--dur-press)',
        enter: 'var(--dur-enter)',
        exit: 'var(--dur-exit)',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(.2,.8,.2,1)',
        enter: 'var(--ease-enter)',
        exit: 'var(--ease-exit)',
        spring: 'var(--ease-spring)',
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        rise: { from: { opacity: '0', transform: 'translateY(var(--travel))' }, to: { opacity: '1', transform: 'none' } },
        pin: { from: { opacity: '0', transform: 'translateY(calc(var(--travel) * -1))' }, to: { opacity: '1', transform: 'none' } },
        fade: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        rise: 'rise var(--dur-enter) var(--ease-enter) both',
        pin: 'pin var(--dur-moment) var(--ease-spring) both',
        fade: 'fade var(--dur-enter) var(--ease-enter) both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
