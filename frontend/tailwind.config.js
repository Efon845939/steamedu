/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');
const tw = require('tailwindcss/colors');

// ---------------------------------------------------------------------------
// Theme tokens
// Components keep using ordinary Tailwind names (bg-emerald-600, text-gray-700,
// bg-amber-50 ...). Here every one of those palettes points at a CSS variable,
// so a theme can repaint the whole app without touching each component:
//   - emerald / teal are the brand pair: they follow the chosen accent
//     (html[data-accent], see src/lib/theme.js).
//   - In dark mode (html.dark) light shades and dark shades swap, so
//     "bg-amber-50 text-amber-800" stays a readable soft panel.
// ---------------------------------------------------------------------------

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];
// Mid shades (400-600) are what buttons and badges use with white text, so they stay put.
const DARK_SWAP = { 50: '950', 100: '900', 200: '800', 300: '700', 400: '400', 500: '500', 600: '600', 700: '300', 800: '200', 900: '100', 950: '50' };

const STATUS_PALETTES = ['amber', 'rose', 'red', 'sky', 'purple', 'orange', 'cyan', 'blue', 'yellow', 'green', 'pink', 'indigo', 'violet', 'lime', 'fuchsia', 'slate'];

// Accent choices: [main, partner]. The partner replaces teal in gradients.
const ACCENTS = {
  emerald: ['emerald', 'teal'],
  teal: ['teal', 'cyan'],
  sky: ['sky', 'blue'],
  indigo: ['indigo', 'violet'],
  violet: ['violet', 'fuchsia'],
  rose: ['rose', 'orange'],
  orange: ['orange', 'amber'],
};

// Neutrals for dark mode: a calm blue-grey instead of a plain inversion, so cards
// (bg-white -> --surface) sit a step above the page background.
const DARK_GRAY = {
  50: '22 28 41', 100: '30 37 53', 200: '43 52 71', 300: '62 72 93', 400: '113 122 140',
  500: '148 156 172', 600: '176 183 196', 700: '204 209 218', 800: '226 230 236', 900: '241 243 247', 950: '249 250 251',
};

const rgb = (hex) => {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
};

const varPalette = (name) =>
  Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--c-${name}-${s}) / <alpha-value>)`]));

const themeTokens = plugin(({ addBase }) => {
  const raw = {};
  const lightMap = {};
  const darkMap = {};
  const rawPalettes = new Set(['gray', 'emerald', 'teal', ...STATUS_PALETTES]);
  Object.values(ACCENTS).forEach(([a, b]) => { rawPalettes.add(a); rawPalettes.add(b); });

  rawPalettes.forEach((name) => {
    SHADES.forEach((s) => { raw[`--p-${name}-${s}`] = rgb(tw[name][s]); });
  });
  ['gray', ...STATUS_PALETTES].forEach((name) => {
    SHADES.forEach((s) => {
      lightMap[`--c-${name}-${s}`] = `var(--p-${name}-${s})`;
      darkMap[`--c-${name}-${s}`] = name === 'gray' ? DARK_GRAY[s] : `var(--p-${name}-${DARK_SWAP[s]})`;
    });
  });
  ['brand', 'brand2'].forEach((name) => {
    SHADES.forEach((s) => {
      lightMap[`--c-${name}-${s}`] = `var(--${name}-${s})`;
      darkMap[`--c-${name}-${s}`] = `var(--${name}-${DARK_SWAP[s]})`;
    });
  });

  const accentRules = {};
  Object.entries(ACCENTS).forEach(([key, [main, partner]]) => {
    const vars = {};
    SHADES.forEach((s) => {
      vars[`--brand-${s}`] = `var(--p-${main}-${s})`;
      vars[`--brand2-${s}`] = `var(--p-${partner}-${s})`;
    });
    const selector = key === 'emerald' ? ':root, :root[data-accent="emerald"]' : `:root[data-accent="${key}"]`;
    accentRules[selector] = vars;
  });

  addBase({ ':root': { ...raw, ...lightMap } });
  addBase(accentRules);
  addBase({ ':root.dark': darkMap });
});

const scaled = (rem) => `calc(${rem}rem * var(--radius-k, 1))`;

module.exports = {
  darkMode: ['class'],
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      boxShadow: {
        soft: 'var(--shadow-soft)',
      },
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
      borderRadius: {
        DEFAULT: scaled(0.25),
        md: scaled(0.375),
        lg: scaled(0.5),
        xl: scaled(0.75),
        '2xl': scaled(1),
        '3xl': scaled(1.5),
      },
      colors: {
        gray: varPalette('gray'),
        emerald: varPalette('brand'),
        teal: varPalette('brand2'),
        ...Object.fromEntries(STATUS_PALETTES.map((p) => [p, varPalette(p)])),
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'rgb(var(--c-brand-600) / <alpha-value>)', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'rgb(var(--c-brand-500) / <alpha-value>)',
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        'page-in': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'page-in': 'page-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) both',
        float: 'float 6s ease-in-out infinite',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), themeTokens],
};
