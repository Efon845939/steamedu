import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-6 leading-tight">
              STEAM Learning Platform
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Learn Science, Technology, Engineering, Arts, and Mathematics through quizzes, 
              hands-on activities, and shared student ideas, with progress your teacher can follow.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/auth">
              <Button 
                size="lg" 
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
                data-testid="get-started-btn"
              >
                Get Started
              </Button>
            </Link>
            <Link to="/content">
              <Button 
                variant="outline" 
                size="lg"
                className="border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300"
                data-testid="explore-content-btn"
              >
                Explore Content
              </Button>
            </Link>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1758685848662-0aad938fd19a" 
              alt="Students in science lab"
              className="rounded-2xl shadow-2xl max-w-4xl mx-auto w-full"
            />
          </div>
        </div>
      </section>

      {/* STEAM Overview Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              What is STEAM Education?
            </h2>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto">
              STEAM education integrates Science, Technology, Engineering, Arts, and Mathematics 
              to foster critical thinking, creativity, and innovation in the 21st century.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Science */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">S</span>
                </div>
                <CardTitle className="text-2xl text-blue-600">Science</CardTitle>
                <CardDescription className="text-gray-600">
                  Explore the natural world through observation, experimentation, and discovery.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <img 
                  src="https://images.unsplash.com/photo-1758685733987-54952cd1c8c6" 
                  alt="Science education"
                  className="rounded-lg w-full h-32 object-cover"
                />
              </CardContent>
            </Card>

            {/* Technology */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">T</span>
                </div>
                <CardTitle className="text-2xl text-purple-600">Technology</CardTitle>
                <CardDescription className="text-gray-600">
                  Master digital tools and understand how technology shapes our world.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <img 
                  src="https://images.pexels.com/photos/7269454/pexels-photo-7269454.jpeg" 
                  alt="Technology learning"
                  className="rounded-lg w-full h-32 object-cover"
                />
              </CardContent>
            </Card>

            {/* Engineering */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">E</span>
                </div>
                <CardTitle className="text-2xl text-green-600">Engineering</CardTitle>
                <CardDescription className="text-gray-600">
                  Design solutions to real-world problems through creative problem-solving.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <img 
                  src="https://images.unsplash.com/photo-1758685848895-e724272475d2" 
                  alt="Engineering education"
                  className="rounded-lg w-full h-32 object-cover"
                />
              </CardContent>
            </Card>

            {/* Arts */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">A</span>
                </div>
                <CardTitle className="text-2xl text-pink-600">Arts</CardTitle>
                <CardDescription className="text-gray-600">
                  Express creativity and innovation through visual, performing, and digital arts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <img 
                  src="https://images.pexels.com/photos/7605825/pexels-photo-7605825.jpeg" 
                  alt="Arts education"
                  className="rounded-lg w-full h-32 object-cover"
                />
              </CardContent>
            </Card>

            {/* Mathematics */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">M</span>
                </div>
                <CardTitle className="text-2xl text-orange-600">Mathematics</CardTitle>
                <CardDescription className="text-gray-600">
                  Develop logical reasoning and analytical skills through mathematical concepts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <img 
                  src="https://images.pexels.com/photos/5676744/pexels-photo-5676744.jpeg" 
                  alt="Mathematics education"
                  className="rounded-lg w-full h-32 object-cover"
                />
              </CardContent>
            </Card>

            {/* Integration */}
            <Card className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-2xl font-bold text-white">∞</span>
                </div>
                <CardTitle className="text-2xl text-emerald-600">Integration</CardTitle>
                <CardDescription className="text-gray-600">
                  Combine all disciplines to tackle complex, real-world challenges collaboratively.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg w-full h-32 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  <span className="text-3xl font-bold text-emerald-600">STEAM</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Interactive Learning Features
            </h2>
            <p className="text-xl text-gray-700 max-w-4xl mx-auto">
              Engage with dynamic content designed to make learning fun, interactive, and meaningful.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📝</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Interactive Quizzes</h3>
              <p className="text-gray-600">Test your knowledge with engaging multiple-choice quizzes across all STEAM subjects.</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">🎯</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Hands-on Activities</h3>
              <p className="text-gray-600">Experience drag-and-drop exercises and interactive simulations.</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">💡</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Idea Sharing</h3>
              <p className="text-gray-600">Share your creative projects and learn from your classmates.</p>
            </div>

            <div className="text-center group">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="text-3xl">📚</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Learning Resources</h3>
              <p className="text-gray-600">Access curated articles, experiment guides, and educational materials.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="py-20 px-4 bg-gradient-to-r from-emerald-600 to-teal-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Start Your STEAM Journey?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Sign up as a student or teacher and start with your first quiz.
          </p>
          <Link to="/auth">
            <Button 
              size="lg"
              className="bg-white text-emerald-600 hover:bg-gray-100 px-8 py-4 rounded-xl text-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg"
              data-testid="join-now-btn"
            >
              Join Now - It's Free!
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default HomePage;