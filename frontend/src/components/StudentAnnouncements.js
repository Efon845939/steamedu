import React, { useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { Megaphone, CheckCircle2, Info } from 'lucide-react';
import { GlassPanel } from './lab';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { formatApiError } from '../lib/steam';

export const StudentAnnouncements = () => {
  const { API } = useContext(AuthContext);
  const [items, setItems] = useState([]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/announcements`);
      setItems(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [API]);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (id) => {
    try {
      await axios.post(`${API}/announcements/${id}/read`);
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const unread = items.filter((a) => !a.read).length;

  return (
    <GlassPanel
      className="h-full"
      icon={Megaphone}
      title="Class announcements"
      description="Messages your teacher sent to the whole class"
      aside={
        unread > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-info-rule bg-info-tint px-3 py-1 text-sm font-semibold text-info" data-testid="announcements-unread-badge">
            <Info className="h-4 w-4" aria-hidden="true" />
            {unread} new
          </span>
        ) : null
      }
      data-testid="student-announcements-card"
    >
      {items.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted" data-testid="no-announcements-msg">
          No announcements yet. Class news from your teacher shows up here.
        </p>
      ) : (
        <ul className="flex max-h-96 flex-col gap-2.5 overflow-y-auto pr-1">
          {items.map((a) => (
            <li
              key={a.id}
              className={cn('rounded-2xl border p-4', a.read ? 'border-rule/50 bg-surface/30' : 'border-info-rule bg-info-tint/70')}
              data-testid={`announcement-${a.id}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">{a.title}</span>
                  <p className="whitespace-pre-wrap text-sm text-ink-muted">{a.body}</p>
                  <span className="text-xs text-ink-muted">
                    {a.teacher_name}, {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
                {a.read ? (
                  <span className="flex shrink-0 items-center gap-1 text-sm text-success" data-testid={`announcement-read-${a.id}`}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Read
                  </span>
                ) : (
                  <button
                    type="button"
                    className="glass inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold"
                    onClick={() => markRead(a.id)}
                    data-testid={`mark-read-btn-${a.id}`}
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
};

export default StudentAnnouncements;
