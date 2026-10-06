import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import axios from 'axios';
import { toast } from 'sonner';
import { Bug, PenLine, Globe, School, Trophy } from 'lucide-react';
import { formatApiError } from '../lib/steam';

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2';

const SCOPES = [
  { value: 'all', label: 'Everyone', Icon: Globe },
  { value: 'class', label: 'My class', Icon: School },
];

const BOARDS = {
  hunters: {
    label: 'Bug hunters',
    Icon: Bug,
    caption: 'Bug hunters ranked by Debugger rating',
    blurb: 'Your Debugger rating rises more when you crack a scenario most people miss.',
    columns: [
      { key: 'debug_rating', label: 'Debugger rating' },
      { key: 'bugs', label: 'Bugs found / tried' },
    ],
  },
  authors: {
    label: 'Trap setters',
    Icon: PenLine,
    caption: 'Trap setters ranked by author points',
    blurb: 'Trap setters earn points when classmates try their approved scenarios — plus a bonus when one is tough but fair.',
    columns: [
      { key: 'approved_scenarios', label: 'Approved' },
      { key: 'solvers', label: 'Solvers' },
      { key: 'calibrated', label: 'Calibrated' },
      { key: 'author_points', label: 'Author points' },
    ],
  },
};

const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

const cellValue = (board, column, row) => {
  if (board === 'hunters' && column === 'bugs') {
    return (
      <>
        <span aria-hidden="true">{row.bugs_found} / {row.scenarios_attempted}</span>
        <span className="sr-only">{row.bugs_found} found out of {row.scenarios_attempted} tried</span>
      </>
    );
  }
  return row[column] ?? 0;
};

const emptyMessage = (board, scope, user) => {
  const isTeacher = user?.role === 'teacher';
  if (scope === 'class' && !isTeacher && !user?.teacher_id) {
    return "You're not in a class yet — ask your teacher to add you, then your class board shows up here.";
  }
  if (board === 'hunters') {
    return isTeacher
      ? 'Students appear here after solving at least 3 challenges.'
      : 'Solve at least 3 challenges to appear here.';
  }
  return isTeacher
    ? "Students appear here once you've approved one of their scenarios."
    : 'No approved scenarios yet. Write one in the My scenarios tab — once your teacher approves it, you show up here.';
};

const BoardTable = ({ board, rows, userId }) => {
  const config = BOARDS[board];
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-gray-200 bg-white ${focusRing}`}
      role="region"
      aria-label={config.caption}
      tabIndex={0}
      data-testid={`leaderboard-table-${board}`}
    >
      <table className="w-full min-w-[480px] text-sm">
        <caption className="sr-only">{config.caption}</caption>
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
          <tr>
            <th scope="col" className="px-3 py-2 text-left w-16">Rank</th>
            <th scope="col" className="px-3 py-2 text-left">Name</th>
            {config.columns.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 text-right whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((r) => {
            const me = r.user_id === userId;
            return (
              <tr
                key={r.user_id}
                className={me ? 'bg-emerald-50 font-semibold' : 'hover:bg-gray-50'}
                aria-current={me ? 'true' : undefined}
                data-testid={`leaderboard-row-${r.rank}`}
              >
                <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                  {MEDALS[r.rank] && <span className="mr-1" aria-hidden="true">{MEDALS[r.rank]}</span>}
                  #{r.rank}
                </td>
                <th scope="row" className="px-3 py-2 text-left font-medium text-gray-900">
                  <span className="break-words">{r.full_name}</span>
                  {me && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-emerald-300 bg-emerald-100 text-emerald-900"
                      data-testid="leaderboard-you"
                    >
                      You
                    </Badge>
                  )}
                </th>
                {config.columns.map((c) => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
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
        <div className="text-center py-10 px-4" data-testid="leaderboard-empty">
          <Trophy className="w-10 h-10 mx-auto text-gray-300 mb-3" aria-hidden="true" />
          <p className="text-gray-600 max-w-md mx-auto">{emptyMessage(key, scope, user)}</p>
        </div>
      );
    }
    return <BoardTable board={key} rows={rows} userId={user?.id} />;
  };

  return (
    <Card className="bg-white/80 backdrop-blur-sm min-w-0" data-testid="arena-leaderboard">
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" aria-hidden="true" /> Debug Arena leaderboard
        </CardTitle>
        <CardDescription>Top 20 · {BOARDS[board].blurb}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={board} onValueChange={setBoard}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList className="w-full sm:w-auto">
              {Object.entries(BOARDS).map(([key, b]) => (
                <TabsTrigger
                  key={key}
                  value={key}
                  className={`flex-1 sm:flex-none gap-1 ${focusRing}`}
                  data-testid={`leaderboard-tab-${key}`}
                >
                  <b.Icon className="w-4 h-4" aria-hidden="true" /> {b.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div
              role="group"
              aria-label="Who to compare with"
              className="flex rounded-md border border-gray-200 bg-white p-0.5 w-full sm:w-auto"
            >
              {SCOPES.map((s) => {
                const selected = scope === s.value;
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setScope(s.value)}
                    aria-pressed={selected}
                    className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1 px-3 h-8 text-sm rounded font-medium transition-colors ${focusRing} ${
                      selected ? 'bg-emerald-600 text-white' : 'text-gray-700 hover:bg-emerald-50'
                    }`}
                    data-testid={`leaderboard-scope-${s.value}`}
                  >
                    <s.Icon className="w-3.5 h-3.5" aria-hidden="true" />
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
      </CardContent>
    </Card>
  );
};
