import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SUBJECTS, subjectBadgeColor, subjectEmoji, formatApiError } from '../lib/steam';
import { AlertTriangle, Eye, X, Check, ChevronDown, ChevronRight, Printer, ScanSearch, RefreshCw, Info } from 'lucide-react';

// 0.42 -> 42
const pct = (rate) => Math.round((Number(rate) || 0) * 100);

// "Alex Chen" -> "AC", "Madonna" -> "MA"
const initials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const worksheetLink = (tag) => `/arena/worksheet?tag=${encodeURIComponent(tag)}`;

// Same glyphs in the table and the legend, so the meaning never depends on colour alone
const CELL_STYLES = {
  holds: {
    label: 'holds',
    legend: 'Holds the misconception',
    className: 'bg-red-600 text-white border border-red-700',
    Icon: X,
  },
  clear: {
    label: 'clear',
    legend: 'Clear — tested and did not show it',
    className: 'bg-emerald-50 border border-emerald-300 text-emerald-800',
    Icon: Check,
  },
  untested: {
    label: 'not tested',
    legend: 'Not tested on this concept yet',
    className: 'bg-white border border-dashed border-gray-400 text-gray-500',
    Icon: null,
  },
};

const CellGlyph = ({ status }) => {
  const style = CELL_STYLES[status];
  const { Icon } = style;
  return (
    <span
      aria-hidden="true"
      className={`mx-auto flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${style.className}`}
    >
      {Icon ? <Icon className="h-4 w-4" strokeWidth={3} /> : '–'}
    </span>
  );
};

// Subjects in the app's usual order, anything unknown at the end
const subjectOrder = (subject) => {
  const i = SUBJECTS.indexOf(subject);
  return i === -1 ? SUBJECTS.length : i;
};

const namesOrNone = (names) => (names.length ? names.join(', ') : 'nobody');

export const MisconceptionHeatmap = () => {
  const { API } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openRows, setOpenRows] = useState({});

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/diagnostics`);
      setData(res.data);
      setError(null);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchDiagnostics();
  }, [fetchDiagnostics]);

  const roster = useMemo(() => data?.roster || [], [data]);

  // Concepts grouped by subject, each with fast lookups for the cells
  const groups = useMemo(() => {
    const bySubject = {};
    (data?.concepts || []).forEach((c) => {
      const subject = c.subject || 'Other';
      if (!bySubject[subject]) bySubject[subject] = [];
      bySubject[subject].push({
        ...c,
        holding: new Set(c.holding_ids || []),
        tested: new Set(c.tested_ids || []),
      });
    });
    return Object.keys(bySubject)
      .sort((a, b) => subjectOrder(a) - subjectOrder(b) || a.localeCompare(b))
      .map((subject) => ({ subject, concepts: bySubject[subject] }));
  }, [data]);

  const toggleRow = (tag) => setOpenRows((prev) => ({ ...prev, [tag]: !prev[tag] }));

  const cellStatus = (concept, studentId) => {
    if (concept.holding.has(studentId)) return 'holds';
    if (concept.tested.has(studentId)) return 'clear';
    return 'untested';
  };

  const header = (
    <CardHeader className="p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-xl">
            <ScanSearch className="h-6 w-6 text-teal-600" aria-hidden="true" />
            Misconception X-ray
          </CardTitle>
          <CardDescription className="mt-1">What your class misunderstands — not what it scored</CardDescription>
        </div>
        {data && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchDiagnostics}
            disabled={loading}
            className="self-start"
            data-testid="heatmap-refresh-btn"
          >
            <RefreshCw className={loading ? 'animate-spin' : ''} aria-hidden="true" />
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        )}
      </div>
    </CardHeader>
  );

  if (!data) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm" data-testid="heatmap-card" aria-busy={loading}>
        {header}
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {loading ? (
            <p className="text-sm text-gray-500" role="status" data-testid="heatmap-loading">Loading the X-ray…</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 sm:flex-row sm:items-center sm:justify-between" data-testid="heatmap-error">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Couldn't load the Misconception X-ray. {error}</span>
              </p>
              <Button type="button" size="sm" variant="outline" onClick={fetchDiagnostics} data-testid="heatmap-retry-btn">
                Try again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  const concepts = data.concepts || [];
  const alerts = data.alerts || [];
  const rule = data.alert_rule || {};
  const mostCommon = (data.misconceptions || []).slice(0, 5);

  return (
    <Card className="bg-white/80 backdrop-blur-sm" data-testid="heatmap-card" aria-busy={loading}>
      {header}
      <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
        <p className="text-sm text-gray-700" data-testid="heatmap-summary">
          <span className="font-semibold">{data.students_tested} of {data.students_total}</span> students tested
          {' · '}latest attempt per quiz/challenge counts
        </p>

        {concepts.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-teal-200 bg-teal-50/60 p-5 text-sm text-gray-700" data-testid="heatmap-empty">
            <p className="mb-2 font-semibold text-gray-900">Nothing to X-ray yet</p>
            <p className="mb-2">
              This view fills in from your students' real attempts: every answer that can reveal a misconception
              is checked, and each student's latest attempt per quiz or challenge counts.
              {data.students_total === 0 && ' Start by adding students to your class.'}
            </p>
            <p className="mb-4">
              Assign the <span className="font-semibold">"Forces & Motion: Misconception Check"</span> quiz or send your
              class to the Debug Arena. No demo data is shown here — what you see will always be your class.
            </p>
            <Button asChild variant="outline" size="sm" className="border-teal-600 text-teal-700" data-testid="heatmap-empty-arena-link">
              <Link to="/arena">Open the Debug Arena</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Alerts */}
            {alerts.length > 0 ? (
              <div className="space-y-3" data-testid="heatmap-alerts">
                {alerts.map((a) => {
                  const red = a.level === 'red';
                  const Icon = red ? AlertTriangle : Eye;
                  return (
                    <div
                      key={a.tag}
                      role="status"
                      className={`flex flex-col gap-3 rounded-lg border-2 p-3 sm:flex-row sm:items-center sm:justify-between ${red ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900'}`}
                      data-testid={`heatmap-alert-${a.tag}`}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                        <div className="text-sm">
                          <p className="font-semibold">
                            {red ? 'Alert' : 'Watch'} · {subjectEmoji(a.subject)} {a.subject || 'Other'}
                          </p>
                          <p className="break-words">
                            {pct(a.rate)}% of tested students ({a.holding_count} of {a.tested_count}) hold: {a.description}
                          </p>
                        </div>
                      </div>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className={`shrink-0 self-start bg-white sm:self-center ${red ? 'border-red-400 text-red-800' : 'border-amber-400 text-amber-900'}`}
                      >
                        <Link to={worksheetLink(a.tag)} data-testid={`heatmap-alert-worksheet-${a.tag}`}>
                          <Printer aria-hidden="true" />
                          Print a targeted worksheet
                        </Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex items-start gap-2 rounded-lg bg-gray-50 p-3 text-sm text-gray-700" data-testid="heatmap-no-alerts">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                <span>
                  No class-wide alerts right now. Alerts appear when at least {rule.min_tested} students were tested on a
                  concept and {pct(rule.red_rate)}% or more hold the misconception
                  {rule.min_holding ? ` (at least ${rule.min_holding} students)` : ''}
                  {rule.watch_rate != null ? `; from ${pct(rule.watch_rate)}% it is marked to watch` : ''}.
                </span>
              </p>
            )}

            {/* Legend */}
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-gray-700" aria-label="Heatmap legend" data-testid="heatmap-legend">
              {Object.keys(CELL_STYLES).map((key) => (
                <li key={key} className="flex items-center gap-2">
                  <span className="w-7"><CellGlyph status={key} /></span>
                  {CELL_STYLES[key].legend}
                </li>
              ))}
            </ul>

            {/* Heatmap */}
            <div className="max-w-full overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table
                className="min-w-full border-separate border-spacing-0 text-sm"
                style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}
                data-testid="heatmap-table"
              >
                <caption className="sr-only">
                  Misconception heatmap: one row per concept, grouped by subject, and one column per student.
                  Each cell says whether the student holds the misconception, is clear of it, or was not tested on it.
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-20 border-b border-r border-gray-200 bg-white p-2 text-left text-xs font-semibold text-gray-700">
                      Concept
                    </th>
                    {roster.map((s) => (
                      <th
                        key={s.id}
                        scope="col"
                        className="w-10 min-w-[2.5rem] max-w-[3rem] border-b border-gray-200 bg-white px-1 py-2 text-center text-xs font-semibold text-gray-700"
                      >
                        <abbr title={s.name} className="cursor-help no-underline" aria-hidden="true">{initials(s.name)}</abbr>
                        <span className="sr-only">{s.name}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                {groups.map((group) => (
                  <tbody key={group.subject}>
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={roster.length + 1}
                        className="border-b border-gray-200 bg-gray-50 p-0 text-left text-xs font-semibold uppercase tracking-wide text-gray-600"
                      >
                        <span className="sticky left-0 inline-block px-2 py-1.5">
                          <Badge className={`${subjectBadgeColor(group.subject)} mr-1 border-transparent px-1.5 shadow-none`} aria-hidden="true">
                            {subjectEmoji(group.subject)}
                          </Badge>
                          {group.subject}
                        </span>
                      </th>
                    </tr>
                    {group.concepts.map((c) => {
                      const open = Boolean(openRows[c.tag]);
                      const detailId = `heatmap-detail-${c.tag}`;
                      const holds = roster.filter((s) => c.holding.has(s.id)).map((s) => s.name);
                      const clear = roster.filter((s) => !c.holding.has(s.id) && c.tested.has(s.id)).map((s) => s.name);
                      const untested = roster.filter((s) => !c.tested.has(s.id)).map((s) => s.name);
                      return (
                        <React.Fragment key={c.tag}>
                          <tr>
                            <th
                              scope="row"
                              className="sticky left-0 z-10 min-w-[9.5rem] max-w-[11rem] border-b border-r border-gray-200 bg-white p-1.5 text-left align-middle font-normal sm:min-w-[14rem] sm:max-w-[20rem]"
                            >
                              <button
                                type="button"
                                onClick={() => toggleRow(c.tag)}
                                aria-expanded={open}
                                aria-controls={detailId}
                                className="flex w-full items-start gap-1 rounded p-0.5 text-left hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                data-testid={`heatmap-row-toggle-${c.tag}`}
                              >
                                {open
                                  ? <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />
                                  : <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" aria-hidden="true" />}
                                <span className="min-w-0">
                                  <span className="block break-words text-xs font-medium text-gray-900 sm:text-sm">{c.description}</span>
                                  <span className="block text-xs text-gray-600" aria-hidden="true">
                                    {c.holding_count}/{c.tested_count} · {pct(c.rate)}%
                                  </span>
                                  <span className="sr-only">
                                    {c.holding_count} of {c.tested_count} tested students hold this ({pct(c.rate)}%)
                                  </span>
                                </span>
                              </button>
                            </th>
                            {roster.map((s) => {
                              const status = cellStatus(c, s.id);
                              const text = `${s.name}: ${CELL_STYLES[status].label} — ${c.description}`;
                              return (
                                <td
                                  key={s.id}
                                  aria-label={text}
                                  title={text}
                                  className="border-b border-gray-100 p-0.5 text-center align-middle"
                                  data-testid={`heatmap-cell-${c.tag}-${s.id}`}
                                  data-status={status}
                                >
                                  <CellGlyph status={status} />
                                  <span className="sr-only">{CELL_STYLES[status].label}</span>
                                </td>
                              );
                            })}
                          </tr>
                          <tr id={detailId} hidden={!open} data-testid={`heatmap-row-detail-${c.tag}`}>
                            <td colSpan={roster.length + 1} className="border-b border-gray-200 bg-gray-50 p-0">
                              <div className="sticky left-0 w-[17rem] max-w-full space-y-2 p-3 text-xs text-gray-700 sm:w-auto sm:max-w-2xl">
                                <p className="break-words">
                                  <span className="font-semibold text-red-700">Holds ({holds.length}):</span> {namesOrNone(holds)}
                                  {' · '}
                                  <span className="font-semibold text-emerald-700">Clear ({clear.length}):</span> {namesOrNone(clear)}
                                  {' · '}
                                  <span className="font-semibold text-gray-600">Not tested ({untested.length}):</span> {namesOrNone(untested)}
                                </p>
                                {c.holding_count > 0 && (
                                  <Link
                                    to={worksheetLink(c.tag)}
                                    className="inline-flex items-center gap-1 rounded font-medium text-teal-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                                    data-testid={`heatmap-row-worksheet-${c.tag}`}
                                  >
                                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                                    Print a targeted worksheet
                                  </Link>
                                )}
                              </div>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>

            {/* Most common */}
            {mostCommon.length > 0 && (
              <section aria-labelledby="heatmap-common-heading" data-testid="heatmap-most-common">
                <h3 id="heatmap-common-heading" className="mb-3 text-sm font-semibold text-gray-900">Most common</h3>
                <ol className="space-y-3">
                  {mostCommon.map((m) => {
                    const share = m.tested_count ? Math.min(100, Math.round((m.holding_count / m.tested_count) * 100)) : 0;
                    return (
                      <li key={m.tag} data-testid={`heatmap-common-${m.tag}`}>
                        <div className="mb-1 flex flex-col gap-0.5 text-xs sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                          <span className="break-words font-medium text-gray-900">
                            {subjectEmoji(m.subject)} {m.description}
                          </span>
                          <span className="shrink-0 text-gray-600">
                            {m.holding_count} of {m.tested_count} tested students ({share}%)
                          </span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${share}%` }} />
                        </div>
                        {m.peer_occurrences > 0 && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Peer: {m.peer_occurrences} {m.peer_occurrences === 1 ? 'answer' : 'answers'} showing this
                            came from classmates' approved scenarios
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
