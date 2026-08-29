import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ContentHub = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = ['all', 'science', 'technology', 'engineering', 'arts', 'mathematics'];

  const articles = [
    {
      id: 1,
      title: "The Science Behind Solar Panels",
      description: "Understand how photovoltaic cells convert sunlight into electricity and their environmental impact.",
      category: "science",
      type: "article",
      readTime: "8 min",
      difficulty: "Medium",
      image: "https://images.unsplash.com/photo-1758685848662-0aad938fd19a"
    },
    {
      id: 2,
      title: "Introduction to Machine Learning",
      description: "A beginner's guide to understanding artificial intelligence and machine learning algorithms.",
      category: "technology",
      type: "article", 
      readTime: "12 min",
      difficulty: "Hard",
      image: "https://images.pexels.com/photos/7269454/pexels-photo-7269454.jpeg"
    },
    {
      id: 3,
      title: "Bridge Design Fundamentals",
      description: "Learn the engineering principles behind building strong and efficient bridge structures.",
      category: "engineering",
      type: "article",
      readTime: "10 min", 
      difficulty: "Medium",
      image: "https://images.unsplash.com/photo-1758685848895-e724272475d2"
    },
    {
      id: 4,
      title: "Color Theory in Digital Art",
      description: "Master the use of color palettes, contrast, and harmony in digital design and artwork.",
      category: "arts",
      type: "article",
      readTime: "6 min",
      difficulty: "Easy",
      image: "https://images.pexels.com/photos/7605825/pexels-photo-7605825.jpeg"
    },
    {
      id: 5,
      title: "Calculus in Real Life Applications", 
      description: "Discover how calculus is used in physics, economics, and engineering problem-solving.",
      category: "mathematics",
      type: "article",
      readTime: "15 min",
      difficulty: "Hard",
      image: "https://images.pexels.com/photos/5676744/pexels-photo-5676744.jpeg"
    }
  ];

  const experiments = [
    {
      id: 1,
      title: "Volcano Eruption Model",
      description: "Create a safe chemical reaction that mimics a volcanic eruption using household materials.",
      category: "science",
      type: "experiment",
      duration: "45 min",
      materials: ["Baking soda", "Vinegar", "Food coloring", "Dishwashing soap"],
      difficulty: "Easy"
    },
    {
      id: 2,
      title: "Build a Simple Robot",
      description: "Construct a basic robot using Arduino components and program it to follow simple commands.",
      category: "technology", 
      type: "experiment",
      duration: "2 hours",
      materials: ["Arduino Uno", "Servo motors", "Sensors", "Breadboard"],
      difficulty: "Medium"
    },
    {
      id: 3,
      title: "Paper Bridge Challenge",
      description: "Design and build the strongest bridge using only paper and tape to hold maximum weight.",
      category: "engineering",
      type: "experiment", 
      duration: "60 min",
      materials: ["Paper", "Tape", "Scissors", "Weights for testing"],
      difficulty: "Medium"
    },
    {
      id: 4,
      title: "Natural Dye Making",
      description: "Extract vibrant colors from fruits, vegetables, and flowers to create natural art supplies.",
      category: "arts",
      type: "experiment",
      duration: "90 min", 
      materials: ["Various fruits/vegetables", "Water", "Fabric/paper", "Salt"],
      difficulty: "Easy"
    },
    {
      id: 5,
      title: "Fibonacci in Nature Hunt",
      description: "Find and photograph examples of Fibonacci sequences in natural patterns around you.",
      category: "mathematics",
      type: "experiment",
      duration: "30 min",
      materials: ["Camera/phone", "Measuring tools", "Notebook"],
      difficulty: "Easy"
    }
  ];

  const mathProblems = [
    {
      id: 1,
      title: "Optimization Challenge",
      description: "Find the maximum area of a rectangle with a given perimeter constraint.",
      category: "mathematics",
      type: "problem",
      level: "Advanced",
      topic: "Calculus & Optimization",
      difficulty: "Hard"
    },
    {
      id: 2, 
      title: "Probability Puzzle",
      description: "Calculate the odds of winning various games and understand expected value.",
      category: "mathematics", 
      type: "problem",
      level: "Intermediate",
      topic: "Statistics & Probability", 
      difficulty: "Medium"
    },
    {
      id: 3,
      title: "Geometry in Architecture",
      description: "Use geometric principles to design a stable and aesthetically pleasing building.",
      category: "mathematics",
      type: "problem", 
      level: "Intermediate",
      topic: "Geometry & Trigonometry",
      difficulty: "Medium"
    },
    {
      id: 4,
      title: "Linear Equations System",
      description: "Solve real-world problems involving multiple variables and constraints.",
      category: "mathematics",
      type: "problem",
      level: "Beginner", 
      topic: "Algebra",
      difficulty: "Easy"
    }
  ];

  const getDifficultyColor = (difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800'; 
      case 'hard': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryEmoji = (category) => {
    switch (category?.toLowerCase()) {
      case 'science': return '🔬';
      case 'technology': return '💻'; 
      case 'engineering': return '⚙️';
      case 'arts': return '🎨';
      case 'mathematics': return '🔢';
      default: return '📚';
    }
  };

  const filterContent = (items) => {
    return items.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">STEAM Content Hub 📚</h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore curated articles, hands-on experiments, and challenging problems across all STEAM disciplines.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8 justify-center">
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
            data-testid="content-search-input"
          />
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="science">🔬 Science</SelectItem>
              <SelectItem value="technology">💻 Technology</SelectItem>
              <SelectItem value="engineering">⚙️ Engineering</SelectItem>
              <SelectItem value="arts">🎨 Arts</SelectItem>
              <SelectItem value="mathematics">🔢 Mathematics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="articles" className="w-full">
          <TabsList className="grid w-full max-w-lg mx-auto grid-cols-3 mb-8">
            <TabsTrigger value="articles" data-testid="articles-tab">Articles</TabsTrigger>
            <TabsTrigger value="experiments" data-testid="experiments-tab">Experiments</TabsTrigger>
            <TabsTrigger value="math-problems" data-testid="math-problems-tab">Math Problems</TabsTrigger>
          </TabsList>

          {/* Articles Tab */}
          <TabsContent value="articles">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterContent(articles).map((article) => (
                <Card key={article.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                  <div className="aspect-video overflow-hidden rounded-t-lg">
                    <img 
                      src={article.image} 
                      alt={article.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getDifficultyColor(article.difficulty)}>
                        {article.difficulty}
                      </Badge>
                      <span className="text-2xl">{getCategoryEmoji(article.category)}</span>
                    </div>
                    <CardTitle className="text-xl text-gray-900">{article.title}</CardTitle>
                    <CardDescription className="text-gray-600">
                      {article.description}
                    </CardDescription>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>📖 {article.readTime}</span>
                      <span>• {article.category.charAt(0).toUpperCase() + article.category.slice(1)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      data-testid={`read-article-${article.id}`}
                    >
                      Read Article
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Experiments Tab */}
          <TabsContent value="experiments">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterContent(experiments).map((experiment) => (
                <Card key={experiment.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getDifficultyColor(experiment.difficulty)}>
                        {experiment.difficulty}
                      </Badge>
                      <span className="text-2xl">{getCategoryEmoji(experiment.category)}</span>
                    </div>
                    <CardTitle className="text-xl text-gray-900">{experiment.title}</CardTitle>
                    <CardDescription className="text-gray-600">
                      {experiment.description}
                    </CardDescription>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                      <span>⏱️ {experiment.duration}</span>
                      <span>• {experiment.category.charAt(0).toUpperCase() + experiment.category.slice(1)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <h4 className="font-semibold text-sm text-gray-700 mb-2">Materials needed:</h4>
                      <div className="flex flex-wrap gap-1">
                        {experiment.materials.slice(0, 3).map((material, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {material}
                          </Badge>
                        ))}
                        {experiment.materials.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{experiment.materials.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      data-testid={`try-experiment-${experiment.id}`}
                    >
                      Try Experiment
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Math Problems Tab */}
          <TabsContent value="math-problems">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filterContent(mathProblems).map((problem) => (
                <Card key={problem.id} className="bg-white/70 backdrop-blur-sm hover:shadow-xl transition-all duration-300 card-hover">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getDifficultyColor(problem.difficulty)}>
                        {problem.difficulty}
                      </Badge>
                      <span className="text-2xl">🔢</span>
                    </div>
                    <CardTitle className="text-xl text-gray-900">{problem.title}</CardTitle>
                    <CardDescription className="text-gray-600">
                      {problem.description}
                    </CardDescription>
                    <div className="space-y-2 text-sm text-gray-500">
                      <div>📊 Level: {problem.level}</div>
                      <div>📐 Topic: {problem.topic}</div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      data-testid={`solve-problem-${problem.id}`}
                    >
                      Solve Problem
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* No Results */}
        {(filterContent(articles).length === 0 && filterContent(experiments).length === 0 && filterContent(mathProblems).length === 0) && (
          <Card className="bg-white/70 backdrop-blur-sm max-w-md mx-auto mt-8">
            <CardContent className="text-center py-12">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Content Found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your search terms or category filter.
              </p>
              <Button 
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Clear Filters
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Featured Section */}
        <div className="mt-16">
          <Card className="bg-gradient-to-r from-purple-500 to-blue-600 text-white">
            <CardContent className="py-12 px-8 text-center">
              <h2 className="text-3xl font-bold mb-4">🚀 Ready to Explore? 🚀</h2>
              <p className="text-xl mb-6 opacity-90">
                Dive into interactive learning with our hands-on activities and challenging problems!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  className="bg-white text-purple-600 hover:bg-gray-100 px-8 py-3"
                  onClick={() => {/* Navigate to activities */}}
                >
                  Try Activities
                </Button>
                <Button 
                  variant="outline" 
                  className="border-white text-white hover:bg-white hover:text-purple-600 px-8 py-3"
                  onClick={() => {/* Navigate to quizzes */}}
                >
                  Take Quizzes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ContentHub;