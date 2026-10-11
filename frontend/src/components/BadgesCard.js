import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { Award, Lock } from 'lucide-react';
import { AuthContext } from '../App';
import { badgeIcon } from '../lib/badges';
import { GlassPanel } from './lab';
import { cn } from '../lib/utils';

// Badges: earned ones glow in the accent, locked ones stay quiet with their progress.
export const BadgesCard = ({ reloadKey }) => {
  const { API } = useContext(AuthContext);
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/badges`).then((r) => setData(r.data)).catch(() => setData(null));
  }, [API, reloadKey]);

  if (!data) return null;

  const pct = Math.round((data.earned_count / data.total) * 100);
  const badges = [...data.badges].sort((a, b) => Number(b.earned) - Number(a.earned));

  return (
    <GlassPanel
      icon={Award}
      title="My badges"
      description="Collect badges by learning, creating and competing"
      aside={
        <span className="t-num rounded-full border border-rule-strong/40 bg-surface/50 px-3 py-1 text-sm" data-testid="badges-earned-count">
          {data.earned_count}/{data.total}
        </span>
      }
      data-testid="badges-card"
    >
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-neutral-tint" aria-hidden="true">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {badges.map((b) => {
          const Icon = badgeIcon(b.icon);
          return (
            <li
              key={b.key}
              title={`${b.name}: ${b.description}`}
              className={cn(
                'flex flex-col items-start gap-2 rounded-2xl border p-3.5 transition-transform duration-enter',
                b.earned ? 'glass border-transparent hover:-translate-y-1' : 'border-rule/50 bg-surface/25'
              )}
              data-testid={`badge-${b.key}`}
            >
              <span
                className={cn(
                  'inline-grid h-10 w-10 place-items-center rounded-xl',
                  b.earned ? 'bg-brand-tint text-brand-ink shadow-[0_0_24px_-6px_rgb(var(--brand)/0.7)]' : 'text-ink-muted'
                )}
              >
                {b.earned ? <Icon className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-4 w-4" aria-hidden="true" />}
              </span>
              <span className={cn('text-sm font-semibold leading-tight', !b.earned && 'text-ink-muted')}>{b.name}</span>
              {b.earned ? (
                <span className="text-xs text-success" data-testid={`badge-earned-${b.key}`}>
                  {new Date(b.earned_at).toLocaleDateString()}
                </span>
              ) : (
                <span className="t-num text-xs text-ink-muted" data-testid={`badge-progress-${b.key}`}>
                  {b.progress}/{b.goal}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </GlassPanel>
  );
};

export default BadgesCard;
