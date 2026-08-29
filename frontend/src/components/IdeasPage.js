import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import axios from 'axios';

const IdeasPage = () => {
  const { user, API } = useContext(AuthContext);
  
  const [ideas, setIdeas] = useState([]);
  const [filteredIdeas, setFilteredIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newIdea, setNewIdea] = useState({
    title: '',
    description: '',
    category: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const categories = ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics'];

  useEffect(() => {
    fetchIdeas();
  }, []);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredIdeas(ideas);
    } else {
      setFilteredIdeas(ideas.filter(idea => idea.category.toLowerCase() === filter.toLowerCase()));
    }
  }, [ideas, filter]);

  const fetchIdeas = async () => {
    try {
      const response = await axios.get(`${API}/ideas`);
      setIdeas(response.data);
    } catch (error) {
      console.error('Failed to fetch ideas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitIdea = async (e) => {
    e.preventDefault();
    
    if (!newIdea.title.trim() || !newIdea.description.trim() || !newIdea.category) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await axios.post(`${API}/ideas`, {
        title: newIdea.title.trim(),
        description: newIdea.description.trim(),
        category: newIdea.category
      });

      setIdeas([response.data, ...ideas]);
      setNewIdea({ title: '', description: '', category: '' });
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Failed to submit idea:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeIdea = async (ideaId) => {
    try {
      await axios.post(`${API}/ideas/${ideaId}/like`);
      
      setIdeas(ideas.map(idea => 
        idea.id === ideaId 
          ? { ...idea, likes: idea.likes + 1 }
          : idea
      ));
    } catch (error) {
      console.error('Failed to like idea:', error);
    }
  };

  const getCategoryColor = (category) => {
    switch (category.toLowerCase()) {
      case 'science': return 'bg-blue-100 text-blue-800';
      case 'technology': return 'bg-purple-100 text-purple-800';
      case 'engineering': return 'bg-green-100 text-green-800';
      case 'arts': return 'bg-pink-100 text-pink-800';
      case 'mathematics': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryEmoji = (category) => {
    switch (category.toLowerCase()) {
      case 'science': return '🔬';
      case 'technology': return '💻';
      case 'engineering': return '⚙️';
      case 'arts': return '🎨';
      case 'mathematics': return '🔢';
      default: return '📚';
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
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Student Ideas Hub 💡</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Share your creative ideas, innovative projects, and inspire fellow students in the STEAM community.
          </p>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-8">
          <div className="flex flex-wrap gap-4">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-48" data-testid="ideas-filter-select">
                <SelectValue placeholder="Filter by category..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category.toLowerCase()}>
                    {getCategoryEmoji(category)} {category}
                  </SelectItem>
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
                <DialogDescription>
                  Tell us about your innovative project, experiment, or creative solution!
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitIdea} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="idea-title">Title</Label>
                  <Input
                    id="idea-title"
                    placeholder="What's your idea called?"
                    value={newIdea.title}
                    onChange={(e) => setNewIdea({...newIdea, title: e.target.value})}
                    required
                    data-testid="idea-title-input"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="idea-category">Category</Label>
                  <Select value={newIdea.category} onValueChange={(value) => setNewIdea({...newIdea, category: value})}>
                    <SelectTrigger data-testid="idea-category-select">
                      <SelectValue placeholder="Choose a STEAM category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {getCategoryEmoji(category)} {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="idea-description">Description</Label>
                  <Textarea
                    id="idea-description"
                    placeholder="Describe your idea, how it works, and what makes it special..."
                    value={newIdea.description}
                    onChange={(e) => setNewIdea({...newIdea, description: e.target.value})}
                    required
                    className="min-h-[120px]"
                    data-testid="idea-description-input"
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="cancel-idea-btn"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={submitting || !newIdea.title.trim() || !newIdea.description.trim() || !newIdea.category}
                    className="bg-emerald-600 hover:bg-emerald-700"
                    data-testid="submit-idea-btn"
                  >
                    {submitting ? (
                      <div className="flex items-center space-x-2">
                        <div className="spinner w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Sharing...</span>
                      </div>
                    ) : (
                      'Share Idea'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Ideas Grid */}
        {filteredIdeas.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">💡</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {filter === 'all' ? 'No Ideas Yet' : `No ${filter.charAt(0).toUpperCase() + filter.slice(1)} Ideas`}
              </h3>
              <p className="text-gray-600 mb-6">
                {filter === 'all' 
                  ? "Be the first to share your creative idea with the community!"
                  : `No ideas in the ${filter} category yet. Try a different filter or share your own!`
                }
              </p>
              {filter !== 'all' && (
                <Button 
                  onClick={() => setFilter('all')} 
                  variant="outline"
                  className="mr-3"
                >
                  Show All Ideas
                </Button>
              )}
              <Button 
                onClick={() => setIsDialogOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Share First Idea
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIdeas.map((idea) => (
              <Card 
                key={idea.id} 
                className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover"
                data-testid={`idea-card-${idea.id}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={getCategoryColor(idea.category)}>
                      {getCategoryEmoji(idea.category)} {idea.category}
                    </Badge>
                    <div className="flex items-center space-x-1 text-gray-500">
                      <button
                        onClick={() => handleLikeIdea(idea.id)}
                        className="flex items-center space-x-1 hover:text-red-500 transition-colors p-1 rounded"
                        data-testid={`like-idea-${idea.id}`}
                      >
                        <span className="text-lg">❤️</span>
                        <span className="text-sm font-medium">{idea.likes}</span>
                      </button>
                    </div>
                  </div>
                  
                  <CardTitle className="text-xl text-gray-900 line-clamp-2">
                    {idea.title}
                  </CardTitle>
                  
                  <CardDescription className="text-sm text-gray-500">
                    By {idea.author_name} • {new Date(idea.created_at).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  <p className="text-gray-700 line-clamp-4 mb-4">
                    {idea.description}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <span className="text-lg">👁️</span>
                      <span>View details</span>
                    </div>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-emerald-600 border-emerald-600 hover:bg-emerald-50"
                      data-testid={`view-idea-${idea.id}`}
                    >
                      Learn More
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Inspiration Section */}
        {ideas.length > 0 && (
          <div className="mt-16">
            <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="py-12 px-8 text-center">
                <h2 className="text-3xl font-bold mb-4">🌟 Keep Creating! 🌟</h2>
                <p className="text-xl mb-6 opacity-90">
                  Amazing ideas shared by our community: <strong>{ideas.length}</strong> creative projects and counting!
                </p>
                <p className="text-lg opacity-80">
                  Every idea matters. Share yours and inspire the next generation of innovators.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default IdeasPage;