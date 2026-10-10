import React, { useContext, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { formatApiError } from '../lib/steam';
import { FileDown, ClipboardList, ShieldCheck } from 'lucide-react';

// 0.42 -> "42%", null (withheld) -> "—"
const pctOrDash = (cell) => (cell && cell.rate !== null && cell.rate !== undefined ? `${Math.round(cell.rate * 100)}%` : '—');

// Anonymized class report for a pilot: misconception rates before and after the day you re-taught
export const PilotReport = () => {
  const { API } = useContext(AuthContext);
  const [range, setRange] = useState({ start: '', split: '', end: '' });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const params = () => Object.fromEntries(Object.entries(range).filter(([, v]) => v));

  const preview = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/teacher/pilot-report`, { params: params() });
      setReport(res.data);
      setError(null);
    } catch (e) {
      setError(formatApiError(e.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const download = async (format) => {
    try {
      const res = await axios.get(`${API}/teacher/pilot-report`, {
        params: { ...params(), format },
        responseType: 'blob',
      });
      const blob = format === 'json'
        ? new Blob([JSON.stringify(JSON.parse(await res.data.text()), null, 2)], { type: 'application/json' })
        : res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `steamedu-pilot-report-${range.start || 'all'}-to-${range.end || 'now'}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      setError(null);
    } catch (e) {
      let detail = e.response?.data?.detail;
      if (e.response?.data instanceof Blob) {
        try { detail = JSON.parse(await e.response.data.text()).detail; } catch { /* keep generic */ }
      }
      setError(formatApiError(detail));
    }
  };

  const field = (key, label, hint) => (
    <div className="space-y-1">
      <Label htmlFor={`pilot-${key}`}>{label}</Label>
      <Input
        id={`pilot-${key}`}
        type="date"
        value={range[key]}
        onChange={(e) => setRange((r) => ({ ...r, [key]: e.target.value }))}
        data-testid={`pilot-${key}-input`}
      />
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
  );

  const hasSplit = Boolean(report?.window?.split);
  const p = report?.participation;

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6">
        <CardTitle className="flex items-center gap-2 text-xl">
          <ClipboardList className="h-6 w-6 text-teal-600" aria-hidden="true" />
          Pilot report
        </CardTitle>
        <CardDescription className="mt-1">
          Did re-teaching work? Compare your class before and after the day you re-taught a concept.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
        <div className="grid gap-3 sm:grid-cols-3">
          {field('start', 'Pilot start', 'Leave empty for all data')}
          {field('split', 'Re-teach day', 'Before = earlier, after = this day on')}
          {field('end', 'Pilot end', 'Not included; empty = today')}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={preview} disabled={loading} data-testid="pilot-preview-btn">
            {loading ? 'Loading…' : 'Preview'}
          </Button>
          <Button type="button" variant="outline" onClick={() => download('csv')} data-testid="pilot-csv-btn">
            <FileDown aria-hidden="true" /> Download CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => download('json')} data-testid="pilot-json-btn">
            <FileDown aria-hidden="true" /> Download JSON
          </Button>
        </div>
        <p className="flex items-start gap-2 text-xs text-gray-600">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          No student names or ids leave the app. Numbers from fewer than 5 students are left blank.
        </p>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

        {report && (
          <div className="space-y-3" data-testid="pilot-preview">
            <p className="text-sm text-gray-700">
              {p.students_enrolled} enrolled · {p.overall.active_students} active · {p.overall.assessed_students} assessed
              {hasSplit && p.before && p.after && (
                <> · before: {p.before.active_students} active, after: {p.after.active_students} active</>
              )}
            </p>
            {report.misconceptions.length === 0 ? (
              <p className="text-sm text-gray-500">No misconception data in this window yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-2 pr-3">Misconception</th>
                      {hasSplit ? (
                        <>
                          <th className="py-2 pr-3">Before</th>
                          <th className="py-2 pr-3">After</th>
                          <th className="py-2 pr-3">Same students fixed</th>
                        </>
                      ) : (
                        <th className="py-2 pr-3">Holding</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.misconceptions.map((r) => (
                      <tr key={r.tag} className="border-b last:border-0">
                        <td className="py-2 pr-3">{r.description}</td>
                        {hasSplit ? (
                          <>
                            <td className="py-2 pr-3">{pctOrDash(r.before)} <span className="text-gray-400">({r.before.tested})</span></td>
                            <td className="py-2 pr-3">{pctOrDash(r.after)} <span className="text-gray-400">({r.after.tested})</span></td>
                            <td className="py-2 pr-3">
                              {r.paired.fixed === null ? '—' : `${r.paired.fixed} of ${r.paired.held_before}`}
                            </td>
                          </>
                        ) : (
                          <td className="py-2 pr-3">{pctOrDash(r.overall)} <span className="text-gray-400">({r.overall.tested})</span></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-gray-500">Brackets: students tested. — means too few students to show.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
