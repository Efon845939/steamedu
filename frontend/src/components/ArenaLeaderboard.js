import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../App';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';
import { formatApiError } from '../lib/steam';
import { cn } from '../lib/utils';

// Underlined tabs on a hairline (the shared Tabs primitive is a filled pill). ArenaPage uses them too.
export const TAB_LIST = 'flex h-auto w-full justify-start gap-6 overflow-x-auto rounded-none border-b border-rule bg-transparent p-0 text-ink-muted';
export const TAB_TRIGGER = '-mb-px h-11 shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-0.5 py-0 text-base font-semibold text-ink-muted shadow-none hover:text-ink data-[state=active]:border-brand-ink data-[state=active]:bg-transparent data-[state=active]:text-ink data-[state=active]:shadow-none';

// Segmented control (Made by, board scope).
export const SEG_GROUP = 'inline-flex flex-wrap gap-0.5 rounded-sm border border-rule-strong bg-bg p-0.5';
export const segButton = (selected) => cn(
  'inline-flex min-h-[38px] items-center justify-center rounded-[4px] px-3 text-sm transition-colors',
  selected ? 'bg-brand-tint font-semibold text-ink' : 'text-ink-muted hover:text-ink'
);

const SCOPES = [
  { value: 'all', label: 'Everyone' },
  { value: 'class', label: 'My class' },
];

const BOARDS = {
  hunters: {
    label: 'Bug hunters',
    caption: 'Bug hunters ranked by Debugger rating',
    blurb: 'Your Debugger rating rises more when you crack a scenario most people miss.',
    columns: [
      { key: 'debug_rating', label: 'Debugger rating' },
      { key: 'bugs', label: 'Bugs found / tried' },
    ],
  },
  authors: {
    label: 'Trap setters',
    caption: 'Trap setters ranked by author points',
    blurb: 'Trap setters earn points when classmates try their approved scenarios, plus a bonus when one is tough but fair.',
    columns: [
      { key: 'approved_scenarios', label: 'Approved' },
      { key: 'solvers', label: 'Solvers' },
      { key: 'calibrated', label: 'Calibrated' },
      { key: 'author_points', label: 'Author points' },
    ],
  },
};

const cellValue = (board, column, row) => {
  if (board === 'hunters' && column === 'bugs') {
    return (
      <>
        <span aria-hidden="true">{row.bugs_found} / {row.scenarios_attempted}</span>
        <span className="sr-only">{row.bugs_found} found out of {row.scenarios_attempted} tried</span>
      </>
    );
  }
  const value = row[column] ?? 0;
  return typeof value === 'number' ? value.toLocaleString() : value;
};

const emptyMessage = (board, scope, user) => {
  const isTeacher = user?.role === 'teacher';
  if (scope === 'class' && !isTeacher && !user?.teacher_id) {
    return "You're not in a class yet. Ask your teacher to add you, then your class board shows up here.";
  }
  if (board === 'hunters') {
    return isTeacher
      ? 'Students appear here after solving at least 3 challenges.'
      : 'Solve at least 3 challenges to appear here.';
  }
  return isTeacher
    ? "Students appear here once you've approved one of their scenarios."
    : 'No approved scenarios yet. Write one in the My scenarios tab. Once your teacher approves it, you show up here.';
};

const BoardTable = ({ board, rows, userId }) => {
  const config = BOARDS[board];
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label={config.caption}
      tabIndex={0}
      data-testid={`leaderboard-table-${board}`}
    >
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{config.caption}</caption>
        <thead>
          <tr className="border-b border-rule-strong text-left text-ink-muted">
            <th scope="col" className="w-16 py-2.5 pr-3 font-semibold">Rank</th>
            <th scope="col" className="py-2.5 pr-3 font-semibold">Name</th>
            {config.columns.map((c) => (
              <th key={c.key} scope="col" className="whitespace-nowrap py-2.5 pl-3 text-right font-semibold">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const me = r.user_id === userId;
            return (
              <tr
                key={r.user_id}
                className={cn('border-b border-rule', me ? 'bg-brand-tint' : 'hover:bg-neutral-tint')}
                aria-current={me ? 'true' : undefined}
                data-testid={`leaderboard-row-${r.rank}`}
              >
                <td className={cn('whitespace-nowrap py-2.5 pr-3 t-num', me && 'pl-2')}>{r.rank}</td>
                <th scope="row" className="py-2.5 pr-3 text-left font-normal text-ink">
                  <span className={cn('break-words', me && 'font-semibold')}>{r.full_name}</span>
                  {me && (
                    <span
                      className="ml-2 inline-flex items-center rounded-sm border border-brand-ink px-1.5 text-xs font-semibold text-brand-ink"
                      data-testid="leaderboard-you"
                    >
                      You
                    </span>
                  )}
                </th>
                {config.columns.map((c) => (
                  <td key={c.key} className={cn('whitespace-nowrap py-2.5 pl-3 text-right tnum', me && 'pr-2')}>
                    {cellValue(board, c.key, r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const ArenaLeaderboard = () => {
  const { user, API } = useContext(AuthContext);
  const [board, setBoard] = useState('hunters');
  const [scope, setScope] = useState('all');
  // Rows are stored with the board/scope they belong to, so a slow response never fills the wrong table
  const [result, setResult] = useState(null);
  const requestRef = useRef(0);

  const fetchBoard = useCallback(async () => {
    requestRef.current += 1;
    const requestId = requestRef.current;
    try {
      const res = await axios.get(`${API}/arena/leaderboard`, { params: { board, scope } });
      if (requestId !== requestRef.current) return;
      setResult({ board, scope, rows: Array.isArray(res.data) ? res.data : [] });
    } catch (e) {
      if (requestId !== requestRef.current) return;
      toast.error(formatApiError(e.response?.data?.detail));
      setResult({ board, scope, rows: [] });
    }
  }, [API, board, scope]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  const ready = result && result.board === board && result.scope === scope;
  const rows = ready ? result.rows : [];
  const isTeacher = user?.role === 'teacher';

  const renderBoard = (key) => {
    if (!ready) {
      return (
        <div className="flex justify-center py-10" data-testid="leaderboard-loading">
          <div className="spinner" />
        </div>
      );
    }
    if (rows.length === 0) {
      return (
        <p className="max-w-prose border-b border-rule py-8 text-ink-muted" data-testid="leaderboard-empty">
          {emptyMessage(key, scope, user)}
        </p>
      );
    }
    return <BoardTable board={key} rows={rows} userId={user?.id} />;
  };

  return (
    <section className="min-w-0" aria-labelledby="arena-leaderboard-heading" data-testid="arena-leaderboard">
      <h2 id="arena-leaderboard-heading" className="t-h3">Debug Arena leaderboard</h2>
      <p className="mt-1.5 max-w-prose text-ink-muted">
        <span className="tnum">Top 20.</span> {BOARDS[board].blurb}
      </p>
      <Tabs value={board} onValueChange={setBoard} className="mt-5">
        <div className="flex flex-col-reverse gap-3 border-b border-rule sm:flex-row sm:items-end sm:justify-between">
          <TabsList className={cn(TAB_LIST, 'w-auto border-b-0')}>
            {Object.entries(BOARDS).map(([key, b]) => (
              <TabsTrigger key={key} value={key} className={TAB_TRIGGER} data-testid={`leaderboard-tab-${key}`}>
                {b.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div role="group" aria-label="Who to compare with" className={cn(SEG_GROUP, 'flex w-full sm:mb-1.5 sm:inline-flex sm:w-auto')}>
            {SCOPES.map((s) => {
              const selected = scope === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  aria-pressed={selected}
                  className={cn(segButton(selected), 'flex-1 sm:flex-none')}
                  data-testid={`leaderboard-scope-${s.value}`}
                >
                  {s.value === 'class' && isTeacher ? 'My students' : s.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="sr-only" aria-live="polite">
          {ready ? `${BOARDS[board].label}, ${scope === 'class' ? 'class' : 'everyone'}: ${rows.length} shown` : ''}
        </p>

        {Object.keys(BOARDS).map((key) => (
          <TabsContent key={key} value={key} className="mt-0">
            {renderBoard(key)}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
};
