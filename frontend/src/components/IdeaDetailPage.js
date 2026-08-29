import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import axios from 'axios';
import { toast } from 'sonner';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { ArrowLeft, Heart, Send, BadgeCheck } from 'lucide-react';

const IdeaDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { API } = useContext(AuthContext);
  const [idea, setIdea] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchIdea = async () => {
    try {
      const res = await axios.get(`${API}/ideas/${id}`);
      setIdea(res.data);
    } catch (e) {
      toast.error('Idea not found');
      navigate('/ideas');
    }
  };

  useEffect(() => {
    fetchIdea();
  }, [id]);

  const toggleLike = async () => {
    try {
      const res = await axios.post(`${API}/ideas/${id}/like`);
      setIdea({ ...idea, likes: res.data.likes, liked: res.data.liked });
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const postComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setPosting(true);
    try {
      const res = await axios.post(`${API}/ideas/${id}/comments`, { text: commentText.trim() });
      setIdea({ ...idea, comments: [...idea.comments, res.data] });
      setCommentText('');
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail));
    } finally {
      setPosting(false);
    }
  };

  if (!idea) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Button variant="ghost" onClick={() => navigate('/ideas')} className="mb-4 text-gray-600" data-testid="back-to-ideas-btn">
          <ArrowLeft className="w-4 h-4 mr-2" /> All ideas
        </Button>

        <Card className="bg-white/90 backdrop-blur-sm shadow-xl mb-8" data-testid="idea-detail-card">
          <CardHeader>
            <div className="flex items-center justify-between mb-2">
              <Badge className={subjectBadgeColor(idea.category)}>
                {subjectEmoji(idea.category)} {idea.category}
              </Badge>
              <button
                onClick={toggleLike}
                className={`flex items-center space-x-1 transition-colors p-2 rounded-lg ${idea.liked ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-red-500'}`}
                data-testid="idea-detail-like-btn"
              >
                <Heart className={`w-6 h-6 ${idea.liked ? 'fill-red-500' : ''}`} />
                <span className="font-semibold" data-testid="idea-detail-likes-count">{idea.likes}</span>
              </button>
            </div>
            <CardTitle className="text-3xl text-gray-900" data-testid="idea-detail-title">{idea.title}</CardTitle>
            <CardDescription>
              By {idea.author_name} • {new Date(idea.created_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap" data-testid="idea-detail-description">
              {idea.description}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/90 backdrop-blur-sm shadow-xl" data-testid="idea-comments-card">
          <CardHeader>
            <CardTitle className="text-xl">💬 Discussion ({idea.comments.length})</CardTitle>
            <CardDescription>Help improve this idea — ask questions, suggest iterations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {idea.comments.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">No comments yet. Start the discussion!</p>
            ) : (
              idea.comments.map((c) => (
                <div key={c.id} className="p-4 bg-gray-50 rounded-lg" data-testid={`comment-${c.id}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{c.author_name}</span>
                    {c.author_role === 'teacher' && (
                      <Badge className="bg-amber-100 text-amber-800 text-[10px] flex items-center gap-0.5">
                        <BadgeCheck className="w-3 h-3" /> Teacher
                      </Badge>
                    )}
                    <span className="text-xs text-gray-400">{new Date(c.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-gray-700">{c.text}</p>
                </div>
              ))
            )}

            <form onSubmit={postComment} className="pt-4 border-t space-y-3">
              <Textarea
                placeholder="Add your thoughts..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[80px]"
                data-testid="comment-input"
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={posting || !commentText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700"
                  data-testid="post-comment-btn"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {posting ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default IdeaDetailPage;
