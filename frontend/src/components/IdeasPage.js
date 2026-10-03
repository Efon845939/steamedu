import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import axios from 'axios';
import { toast } from 'sonner';
import { subjectEmoji, subjectBadgeColor, formatApiError } from '../lib/steam';
import { Heart, MessageSquare, Star } from 'lucide-react';
import { notifyNewBadges } from '../lib/badges';

const IdeasPage = () => {
  const { user, API } = useContext(AuthContext);
  const navigate = useNavigate();

  const [ideas, setIdeas] = useState([]);
  const [spotlights, setSpotlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState('new');
  const [category, setCategory] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({ title: '', description: '', category: '' });
  const [submitting, setSubmitting] = useState(false);

  const categories = ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics'];

  const fetchIdeas = useCallback(async () => {
    try {
      const params = { sort };
      if (category !== 'all') params.category = category;
      const response = await axios.get(`${API}/ideas`, { params });
      setIdeas(response.data);
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setLoading(false);
    }
  }, [API, sort, category]);

  const fetchSpotlights = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/ideas/spotlights`);
      setSpotlights(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [API]);

  useEffect(() => {
    fetchIdeas();
  }, [fetchIdeas]);

  useEffect(() => {
    fetchSpotlights();
  }, [fetchSpotlights]);

  const toggleSpotlight = async (ideaId) => {
    try {
      const res = await axios.post(`${API}/ideas/${ideaId}/spotlight`);
      toast.success(res.data.spotlighted ? "Pinned as your Teacher's Pick! 🌟" : "Teacher's Pick removed");
      fetchIdeas();
      fetchSpotlights();
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail));
    }
  };

  const handleSubmitIdea = async (e) => {
    e.preventDefault();
    if (!newIdea.title.trim() || !newIdea.description.trim() || !newIdea.category) return;
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/ideas`, {
        title: newIdea.title.trim(),
        description: newIdea.description.trim(),
        category: newIdea.category,
      });
      setNewIdea({ title: '', description: '', category: '' });
      setIsDialogOpen(false);
      toast.success('Idea shared with the community! 💡');
      notifyNewBadges(res.data.new_badges);
      fetchIdeas();
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeIdea = async (ideaId) => {
    try {
      const res = await axios.post(`${API}/ideas/${ideaId}/like`);
      setIdeas(ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, likes: res.data.likes, liked: res.data.liked } : idea
      ));
    } catch (error) {
      toast.error(formatApiError(error.response?.data?.detail));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading ideas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Student Ideas Hub 💡</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Share your creative ideas, discuss them in the comments, and support your favorites — each student can like an idea once.
          </p>
        </div>

        {spotlights.length > 0 && (
          <div className="mb-10" data-testid="teachers-picks-section">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500 fill-amber-500" /> Teacher's Picks
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {spotlights.map((idea) => (
                <button
                  key={idea.id}
                  onClick={() => navigate(`/ideas/${idea.id}`)}
                  className="text-left p-4 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 hover:shadow-lg transition-shadow"
                  data-testid={`spotlight-idea-${idea.id}`}
                >
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge className="bg-amber-200 text-amber-900 text-xs">🌟 Teacher's Pick</Badge>
                    <Badge className={subjectBadgeColor(idea.category)}>{subjectEmoji(idea.category)} {idea.category}</Badge>
                  </div>
                  <h3 className="font-bold text-gray-900">{idea.title}</h3>
                  <p className="text-xs text-gray-600 mt-1">
                    By {idea.author_name} • picked by {idea.spotlight?.teacher_name} • ❤️ {idea.likes} • 💬 {idea.comments_count}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex flex-wrap items-center gap-4">
            <Tabs value={sort} onValueChange={setSort}>
              <TabsList>
                <TabsTrigger value="new" data-testid="ideas-sort-new">🕐 New</TabsTrigger>
                <TabsTrigger value="popular" data-testid="ideas-sort-popular">🔥 Popular</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-48" data-testid="ideas-filter-select">
                <SelectValue placeholder="Filter by category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{subjectEmoji(c)} {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700" data-testid="share-idea-btn">
                <span className="mr-2">💡</span>
                Share Your Idea
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Share Your Creative Idea</DialogTitle>
                <DialogDescription>Tell us about your innovative project, experiment, or creative solution!</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitIdea} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="idea-title">Title</Label>
                  <Input
                    id="idea-title"
                    placeholder="What's your idea called?"
                    value={newIdea.title}
                    onChange={(e) => setNewIdea({ ...newIdea, title: e.target.value })}
                    required
                    data-testid="idea-title-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idea-category">Category <span className="text-red-500">*</span></Label>
                  <Select value={newIdea.category} onValueChange={(value) => setNewIdea({ ...newIdea, category: value })}>
                    <SelectTrigger data-testid="idea-category-select">
                      <SelectValue placeholder="Choose a STEAM category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>{subjectEmoji(c)} {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!newIdea.category && (
                    <p className="text-xs text-gray-500" data-testid="idea-category-hint">
                      Pick a category to enable sharing.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="idea-description">Description</Label>
                  <Textarea
                    id="idea-description"
                    placeholder="Describe your idea, how it works, and what makes it special..."
                    value={newIdea.description}
                    onChange={(e) => setNewIdea({ ...newIdea, description: e.target.value })}
                    required
                    className="min-h-[120px]"
                    data-testid="idea-description-input"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-testid="cancel-idea-btn">
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting || !newIdea.title.trim() || !newIdea.description.trim() || !newIdea.category}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="submit-idea-btn"
                  >
                    {submitting ? 'Sharing...' : 'Share Idea'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {ideas.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">💡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Ideas Yet</h3>
              <p className="text-gray-600 mb-6">Be the first to share your creative idea with the community!</p>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                Share First Idea
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ideas.map((idea) => (
              <Card
                key={idea.id}
                className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover flex flex-col"
                data-testid={`idea-card-${idea.id}`}
              >
                <CardHeader className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={subjectBadgeColor(idea.category)}>
                        {subjectEmoji(idea.category)} {idea.category}
                      </Badge>
                      {idea.spotlight && (
                        <Badge className="bg-amber-200 text-amber-900 text-xs" data-testid={`spotlight-badge-${idea.id}`}>🌟 Teacher's Pick</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {user?.role === 'teacher' && (
                        <button
                          onClick={() => toggleSpotlight(idea.id)}
                          title={idea.spotlight?.teacher_id === user.id ? "Remove your Teacher's Pick" : "Pin as your Teacher's Pick"}
                          className={`p-1 rounded transition-colors ${idea.spotlight?.teacher_id === user.id ? 'text-amber-500' : 'text-gray-300 hover:text-amber-500'}`}
                          data-testid={`spotlight-btn-${idea.id}`}
                        >
                          <Star className={`w-5 h-5 ${idea.spotlight?.teacher_id === user.id ? 'fill-amber-500' : ''}`} />
                        </button>
                      )}
                      <button
                        onClick={() => handleLikeIdea(idea.id)}
                        className={`flex items-center space-x-1 transition-colors p-1 rounded ${idea.liked ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}
                        data-testid={`like-idea-${idea.id}`}
                      >
                        <Heart className={`w-5 h-5 ${idea.liked ? 'fill-red-500' : ''}`} />
                        <span className="text-sm font-medium">{idea.likes}</span>
                      </button>
                    </div>
                  </div>
                  <CardTitle className="text-xl text-gray-900 line-clamp-2">{idea.title}</CardTitle>
                  <CardDescription className="text-sm text-gray-500">
                    By {idea.author_name} • {new Date(idea.created_at).toLocaleDateString()}
                  </CardDescription>
                  <p className="text-gray-700 line-clamp-3 text-sm pt-2">{idea.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-sm text-gray-500">
                      <MessageSquare className="w-4 h-4" />
                      <span>{idea.comments_count} comment{idea.comments_count !== 1 && 's'}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                      onClick={() => navigate(`/ideas/${idea.id}`)}
                      data-testid={`view-idea-${idea.id}`}
                    >
                      Discuss
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeasPage;
