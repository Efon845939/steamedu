import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { formatApiError } from '../lib/steam';
import { BadgeCheck, Send, UserPlus, Search } from 'lucide-react';

const ChatPage = () => {
  const { user, API } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activePartner, setActivePartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const bottomRef = useRef(null);
  const activeIdRef = useRef(null);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/chat/conversations`);
      setConversations(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [API]);

  const openThread = useCallback(async (partnerId) => {
    try {
      const res = await axios.get(`${API}/chat/with/${partnerId}`);
      setActivePartner(res.data.partner);
      setMessages(res.data.messages);
      activeIdRef.current = partnerId;
    } catch (e) {
      console.error(e);
    }
  }, [API]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(() => {
      fetchConversations();
      if (activeIdRef.current) openThread(activeIdRef.current);
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchConversations, openThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/users/search`, { params: { q: searchQuery } });
        setSearchResults(res.data);
      } catch (e) {
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activePartner) return;
    try {
      const res = await axios.post(`${API}/chat/send`, { recipient_id: activePartner.id, text: text.trim() });
      setMessages([...messages, res.data]);
      setText('');
      fetchConversations();
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const addAsStudent = async () => {
    try {
      const res = await axios.post(`${API}/teacher/add-student/${activePartner.id}`);
      toast.success(`${res.data.full_name} is now your student! 🎓`);
      setActivePartner({ ...activePartner, teacher_id: user.id });
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    }
  };

  const PartnerRow = ({ p, onClick, extra }) => (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${
        activePartner?.id === p.id ? 'bg-emerald-100' : 'hover:bg-gray-100'
      }`}
      data-testid={`chat-partner-${p.username}`}
    >
      <div>
        <h4 className="font-semibold text-sm flex items-center gap-1">
          {p.full_name}
          {p.role === 'teacher' && p.verified && <BadgeCheck className="w-4 h-4 text-sky-500" />}
          <Badge variant="outline" className="text-[10px] ml-1">{p.role}</Badge>
        </h4>
        {extra}
      </div>
      {p.unread > 0 && <Badge className="bg-emerald-600 text-white">{p.unread}</Badge>}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Messages 💬</h1>
        <p className="text-gray-600 mb-8">
          {user.role === 'teacher'
            ? 'Reach out to students and add them as your mentees.'
            : 'Talk with teachers — a teacher can add you as their student.'}
        </p>

        <div className="grid md:grid-cols-3 gap-6" style={{ minHeight: '60vh' }}>
          {/* Sidebar */}
          <Card className="bg-white/80 backdrop-blur-sm md:col-span-1">
            <CardContent className="pt-4">
              <div className="relative mb-4">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <Input
                  placeholder={user.role === 'teacher' ? 'Search students...' : 'Search teachers...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="chat-search-input"
                />
              </div>

              {searchResults.length > 0 && (
                <div className="mb-4 border-b pb-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2 px-1">SEARCH RESULTS</p>
                  {searchResults.map((p) => (
                    <PartnerRow
                      key={p.id}
                      p={p}
                      onClick={() => { openThread(p.id); setSearchQuery(''); }}
                      extra={<p className="text-xs text-gray-500">@{p.username}</p>}
                    />
                  ))}
                </div>
              )}

              <p className="text-xs font-semibold text-gray-500 mb-2 px-1">CONVERSATIONS</p>
              {conversations.length === 0 ? (
                <p className="text-sm text-gray-500 p-3" data-testid="no-conversations-msg">
                  No conversations yet. Search above to start one!
                </p>
              ) : (
                conversations.map((c) => (
                  <PartnerRow
                    key={c.id}
                    p={c}
                    onClick={() => openThread(c.id)}
                    extra={<p className="text-xs text-gray-500 truncate max-w-[180px]">{c.last_message}</p>}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Thread */}
          <Card className="bg-white/80 backdrop-blur-sm md:col-span-2 flex flex-col">
            {!activePartner ? (
              <CardContent className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center py-16">
                  <div className="text-6xl mb-4">💬</div>
                  <p>Select a conversation or search for someone to chat with.</p>
                </div>
              </CardContent>
            ) : (
              <>
                <div className="border-b px-6 py-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold flex items-center gap-1" data-testid="chat-thread-header">
                      {activePartner.full_name}
                      {activePartner.role === 'teacher' && activePartner.verified && <BadgeCheck className="w-4 h-4 text-sky-500" />}
                    </h3>
                    <p className="text-xs text-gray-500">@{activePartner.username} • {activePartner.role}</p>
                  </div>
                  {user.role === 'teacher' && activePartner.role === 'student' && activePartner.teacher_id !== user.id && (
                    <Button size="sm" onClick={addAsStudent} className="bg-emerald-600 hover:bg-emerald-700" data-testid="add-as-student-btn">
                      <UserPlus className="w-4 h-4 mr-2" />Add as my student
                    </Button>
                  )}
                  {user.role === 'teacher' && activePartner.role === 'student' && activePartner.teacher_id === user.id && (
                    <Badge className="bg-emerald-100 text-emerald-800" data-testid="my-student-badge">🎓 Your student</Badge>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ maxHeight: '45vh' }} data-testid="chat-messages-area">
                  {messages.length === 0 && (
                    <p className="text-center text-sm text-gray-400 py-8">Say hello! 👋</p>
                  )}
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${
                        m.sender_id === user.id
                          ? 'bg-emerald-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}>
                        {m.text}
                        <div className={`text-[10px] mt-1 ${m.sender_id === user.id ? 'text-emerald-100' : 'text-gray-400'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <form onSubmit={sendMessage} className="border-t px-6 py-4 flex gap-3">
                  <Input
                    placeholder="Type a message..."
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    data-testid="chat-message-input"
                  />
                  <Button type="submit" disabled={!text.trim()} className="bg-emerald-600 hover:bg-emerald-700" data-testid="chat-send-btn">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
