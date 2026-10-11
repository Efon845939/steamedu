import React from 'react';
import { Check, Monitor, Moon, Palette, RotateCcw, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from './ui/sheet';
import { ACCENTS, AGE_THEMES, useTheme } from '../lib/theme';
import { useLiteMode } from '../hooks/use-lite-mode';

// "Appearance" panel: age theme, accent colour, light/dark, text size, motion.
// Every choice applies instantly and is remembered in this browser.

const Section = ({ title, hint, children }) => (
  <section className="space-y-3">
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
    {children}
  </section>
);

// A row of equal buttons where exactly one is selected.
const Segmented = ({ label, options, value, onChange, testId }) => (
  <div role="radiogroup" aria-label={label} className="grid grid-flow-col auto-cols-fr gap-1 rounded-xl bg-gray-100 p-1">
    {options.map(({ value: v, label: text, icon: Icon }) => {
      const selected = v === value;
      return (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={selected}
          onClick={() => onChange(v)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium transition-all duration-200 ${
            selected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
          data-testid={`${testId}-${v}`}
        >
          {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
          {text}
        </button>
      );
    })}
  </div>
);

// Mini preview of an age theme: its corner radius, accent and type.
const AgePreview = ({ id }) => {
  const theme = AGE_THEMES[id];
  const radius = { explorer: '0.9rem', lab: '0.6rem', pro: '0.3rem' }[id];
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span
        className="h-9 w-9 flex items-center justify-center text-sm font-bold text-white"
        style={{ borderRadius: radius, background: ACCENTS[theme.accent].swatch }}
      >
        Aa
      </span>
      <span className="flex flex-col gap-1">
        <span className="h-1.5 w-14 bg-gray-300" style={{ borderRadius: radius }} />
        <span className="h-1.5 w-9 bg-gray-200" style={{ borderRadius: radius }} />
      </span>
    </div>
  );
};

const ThemeCustomizer = ({ triggerClassName = '', testId = 'theme-customizer-btn' }) => {
  const { settings, resolved, update, reset } = useTheme();
  const { lite, setLite } = useLiteMode();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          title="Appearance"
          aria-label="Appearance settings"
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition-colors duration-200 hover:border-emerald-300 hover:text-emerald-700 ${triggerClassName}`}
          data-testid={testId}
        >
          <Palette className="h-4 w-4" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0" data-testid="theme-panel">
        <div className="p-6 space-y-7">
          <SheetHeader className="text-left">
            <SheetTitle className="text-xl">Appearance</SheetTitle>
            <SheetDescription>Make STEAM Hub comfortable for you. Changes apply right away and are saved on this device.</SheetDescription>
          </SheetHeader>

          <Section title="Age theme" hint={settings.age === 'auto' ? 'Following your account age group.' : 'Picked by you.'}>
            <div className="space-y-2" role="radiogroup" aria-label="Age theme">
              {Object.entries(AGE_THEMES).map(([id, theme]) => {
                const selected = resolved.age === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update({ age: id, accent: 'auto' })}
                    className={`w-full flex items-center gap-4 rounded-xl border p-3 text-left transition-all duration-200 ${
                      selected
                        ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    data-testid={`theme-age-${id}`}
                  >
                    <AgePreview id={id} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="font-semibold text-gray-900">{theme.label}</span>
                        <span className="text-xs text-gray-500">{theme.short}</span>
                      </span>
                      <span className="block text-xs text-gray-600 mt-0.5">{theme.description}</span>
                    </span>
                    {selected && <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            {settings.age !== 'auto' && (
              <button
                type="button"
                onClick={() => update({ age: 'auto', accent: 'auto' })}
                className="text-xs font-medium text-emerald-700 hover:underline"
                data-testid="theme-age-auto"
              >
                Use my account's age group instead
              </button>
            )}
          </Section>

          <Section title="Accent colour">
            <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Accent colour">
              {Object.entries(ACCENTS).map(([id, accent]) => {
                const selected = resolved.accent === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={accent.label}
                    title={accent.label}
                    onClick={() => update({ accent: id })}
                    className={`h-9 w-9 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-110 ${
                      selected ? 'ring-2 ring-offset-2 ring-gray-900 ring-offset-white' : ''
                    }`}
                    style={{ background: accent.swatch }}
                    data-testid={`theme-accent-${id}`}
                  >
                    {selected && <Check className="h-4 w-4 text-white" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Mode">
            <Segmented
              label="Colour mode"
              value={settings.mode}
              onChange={(mode) => update({ mode })}
              testId="theme-mode"
              options={[
                { value: 'light', label: 'Light', icon: Sun },
                { value: 'dark', label: 'Dark', icon: Moon },
                { value: 'system', label: 'Auto', icon: Monitor },
              ]}
            />
          </Section>

          <Section title="Text size">
            <Segmented
              label="Text size"
              value={settings.text}
              onChange={(text) => update({ text })}
              testId="theme-text"
              options={[
                { value: 'md', label: 'Normal' },
                { value: 'lg', label: 'Larger' },
              ]}
            />
          </Section>

          <Section title="Motion" hint="Calm turns off movement for students who find it distracting.">
            <Segmented
              label="Motion"
              value={settings.motion}
              onChange={(motion) => update({ motion })}
              testId="theme-motion"
              options={[
                { value: 'full', label: 'Smooth' },
                { value: 'calm', label: 'Calm' },
              ]}
            />
          </Section>

          <Section title="Lite mode" hint="For slow connections: no photos, animations or web fonts.">
            <Segmented
              label="Lite mode"
              value={lite ? 'on' : 'off'}
              onChange={(v) => setLite(v === 'on')}
              testId="theme-lite"
              options={[
                { value: 'off', label: 'Off' },
                { value: 'on', label: 'On' },
              ]}
            />
          </Section>

          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900"
            data-testid="theme-reset"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Reset to defaults
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ThemeCustomizer;
