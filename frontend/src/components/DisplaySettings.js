import React, { useEffect, useId, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDisplay } from '../lib/theme';
import { useLiteMode } from '../hooks/use-lite-mode';
import { cn } from '../lib/utils';

// Display settings. The theme itself is fixed by the account; these are the settings
// that never break it. Built from native radios and a disclosure (no popover library),
// because it ships in the main bundle on every page.

const Segmented = ({ name, label, value, options, onChange, note }) => {
  const id = useId();
  return (
    <fieldset className="grid grid-cols-[minmax(6.5rem,auto)_1fr] items-center gap-x-3 gap-y-1">
      <legend className="sr-only">{label}</legend>
      <span aria-hidden="true" className="text-sm text-ink-muted">
        {label}
      </span>
      <div className="inline-flex flex-wrap gap-0.5 justify-self-start rounded-md border border-rule-strong bg-bg p-0.5">
        {options.map((o) => {
          const inputId = `${id}-${o.value}`;
          return (
            <span key={o.value} className="relative">
              <input
                type="radio"
                id={inputId}
                name={`${name}-${id}`}
                value={o.value}
                checked={value === o.value}
                onChange={() => onChange(o.value)}
                className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
                data-testid={`display-${name}-${o.value}`}
              />
              <label
                htmlFor={inputId}
                className="pointer-events-none flex min-h-9 items-center rounded-[calc(var(--r-md)-2px)] px-3 text-sm text-ink-muted transition-colors peer-hover:text-ink peer-checked:bg-brand-tint peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1 peer-focus-visible:outline-[rgb(var(--brand))] [@media(pointer:coarse)]:min-h-11"
              >
                {o.label}
              </label>
            </span>
          );
        })}
      </div>
      {note ? <span className="col-start-2 text-xs text-ink-muted">{note}</span> : null}
    </fieldset>
  );
};

export const DisplayPanel = ({ className, liteTestId = 'lite-mode-toggle', headingId }) => {
  const { theme, settings, resolved, update } = useDisplay();
  const { lite, setLite } = useLiteMode();
  const liteLabelId = useId();

  const themeLine =
    theme === 'teacher'
      ? 'Your theme follows your teacher account.'
      : "Your theme follows your account's age group.";

  const toggleLite = () => {
    const next = !lite;
    setLite(next);
    if (next) toast.success('Lite mode is on. Web fonts, photos and motion are off.');
    else toast.info('Lite mode is off.');
  };

  const motionValue = lite ? 'off' : settings.motion === 'system' ? resolved.motion : settings.motion;
  let motionNote = null;
  if (lite) motionNote = 'Lite mode keeps motion off.';
  else if (settings.motion === 'system') motionNote = 'Following your device setting.';

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="t-h3 text-xl">
          Display
        </h2>
        <p className="text-sm text-ink-muted">{themeLine}</p>
      </div>
      <Segmented
        name="appearance"
        label="Appearance"
        value={settings.mode}
        onChange={(mode) => update({ mode })}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'system', label: 'System' },
        ]}
      />
      <Segmented
        name="text"
        label="Text size"
        value={settings.text}
        onChange={(text) => update({ text })}
        options={[
          { value: 's', label: 'S' },
          { value: 'm', label: 'M' },
          { value: 'l', label: 'L' },
        ]}
      />
      <Segmented
        name="motion"
        label="Motion"
        value={motionValue}
        onChange={(motion) => update({ motion })}
        note={motionNote}
        options={[
          { value: 'full', label: 'Full' },
          { value: 'reduced', label: 'Reduced' },
          { value: 'off', label: 'Off' },
        ]}
      />
      <Segmented
        name="density"
        label="Density"
        value={resolved.density}
        onChange={(density) => update({ density })}
        options={[
          { value: 'comfortable', label: 'Comfortable' },
          { value: 'compact', label: 'Compact' },
        ]}
      />
      <div className="flex items-start justify-between gap-4 border-t border-rule pt-4">
        <div className="flex flex-col gap-0.5">
          <span id={liteLabelId} className="text-sm font-semibold">
            Lite mode
          </span>
          <span className="text-xs text-ink-muted">For slow connections: no web fonts, photos or motion.</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={lite}
          aria-labelledby={liteLabelId}
          onClick={toggleLite}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
            lite ? 'border-brand bg-brand' : 'border-rule-strong bg-neutral-tint'
          )}
          data-testid={liteTestId}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-enter ease-spring',
              lite ? 'translate-x-5 bg-on-brand' : 'translate-x-0 bg-surface ring-1 ring-rule-strong'
            )}
          />
        </button>
      </div>
    </div>
  );
};

// Header button plus a small floating panel. Esc or a click outside closes it and
// focus goes back to the button.
const DisplaySettings = () => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const headingId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointer = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    panelRef.current?.querySelector('input:checked')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-ink transition-colors hover:bg-surface/50"
        data-testid="display-settings-btn"
      >
        <SlidersHorizontal className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
        Display
      </button>
      {open && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-labelledby={headingId}
          className="glass glass-strong animate-rise absolute right-0 top-[calc(100%+12px)] z-50 w-[min(26rem,calc(100vw-2rem))] rounded-2xl p-5"
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label="Close display settings"
            className="absolute right-2 top-2 inline-grid h-11 w-11 place-items-center rounded-md text-ink-muted hover:bg-neutral-tint hover:text-ink"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
          <DisplayPanel headingId={headingId} />
        </div>
      )}
    </div>
  );
};

export default DisplaySettings;
