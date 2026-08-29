import React, { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Megaphone, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatApiError } from '../lib/steam';

export const StudentAnnouncements = () => {
  const { API } = useContext(AuthContext);
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const res = await axios.get(`${API}/announcements`);
      setItems(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
    <Card className="bg-white/70 backdrop-blur-sm" data-testid="student-announcements-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-sky-600" />
          <span>Class Announcements</span>
          {unread > 0 && (
            <Badge className="bg-red-100 text-red-700" data-testid="announcements-unread-badge">{unread} new</Badge>
          )}
        </CardTitle>
        <CardDescription>Messages your teacher sent to the whole class</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center" data-testid="no-announcements-msg">
            No announcements yet — your teacher's class news will show up here.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((a) => (
              <div
                key={a.id}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  a.read ? 'border-gray-200 bg-white' : 'border-sky-300 bg-sky-50'
                }`}
                data-testid={`announcement-${a.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{a.title}</h4>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[11px] text-gray-400 mt-2">
                      {a.teacher_name} • {new Date(a.created_at).toLocaleString()}
                    </p>
                  </div>
                  {a.read ? (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 shrink-0" data-testid={`announcement-read-${a.id}`}>
                      <CheckCircle2 className="w-4 h-4" /> Read
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-sky-600 text-sky-600 shrink-0"
                      onClick={() => markRead(a.id)}
                      data-testid={`mark-read-btn-${a.id}`}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentAnnouncements;
