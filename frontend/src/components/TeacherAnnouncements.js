import React, { useContext, useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from './ui/alert-dialog';
import { Megaphone, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatApiError } from '../lib/steam';

export const TeacherAnnouncements = ({ studentsCount }) => {
  const { API } = useContext(AuthContext);
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '' });
  const [sending, setSending] = useState(false);

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

  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await axios.post(`${API}/announcements`, form);
      toast.success(`Announcement sent to ${res.data.recipients} student${res.data.recipients !== 1 ? 's' : ''}`);
      setForm({ title: '', body: '' });
      setOpen(false);
      load();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    try {
      await axios.delete(`${API}/announcements/${id}`);
      toast.success('Announcement deleted');
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  return (
    <Card className="bg-white/70 backdrop-blur-sm" data-testid="teacher-announcements-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-sky-600" />
              Class Announcements
            </CardTitle>
            <CardDescription>Broadcast one message to all of your students at once</CardDescription>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-sky-600 hover:bg-sky-700 shrink-0" data-testid="new-announcement-btn">
                New Announcement
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send a Class Announcement</DialogTitle>
                <DialogDescription>
                  {studentsCount > 0
                    ? `This will be delivered to all ${studentsCount} of your students instantly.`
                    : 'Add students via Chat first — announcements go to your own students.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={send} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                    placeholder="e.g. Lab report due Friday"
                    data-testid="announcement-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <Textarea
                    value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })}
                    required
                    rows={5}
                    placeholder="Write what the whole class needs to know..."
                    data-testid="announcement-body-input"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={sending}
                  className="w-full bg-sky-600 hover:bg-sky-700"
                  data-testid="send-announcement-btn"
                >
                  {sending ? 'Sending...' : 'Send to All Students'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center" data-testid="no-teacher-announcements-msg">
            No announcements yet — send your first one above.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((a) => (
              <div key={a.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`teacher-announcement-${a.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-semibold text-sm text-gray-900">{a.title}</h4>
                    <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-[11px] text-gray-400 mt-2">{new Date(a.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="flex items-center gap-1" data-testid={`announcement-reads-${a.id}`}>
                      <Users className="w-3 h-3" />{a.read_count}/{a.recipients} read
                    </Badge>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          data-testid={`delete-announcement-btn-${a.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this announcement?</AlertDialogTitle>
                          <AlertDialogDescription>
                            "{a.title}" will be removed from every student's feed along with its read receipts.
                            This can't be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel data-testid={`cancel-delete-announcement-${a.id}`}>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => remove(a.id)}
                            data-testid={`confirm-delete-announcement-${a.id}`}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeacherAnnouncements;
