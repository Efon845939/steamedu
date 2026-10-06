import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useLiteMode } from '../hooks/use-lite-mode';

// Adds size/compression params so the CDN serves a small image instead of the
// multi-megabyte original. Existing query params win over the defaults.
const sized = (url, params) => {
  const [base, query = ''] = url.split('?');
  const search = new URLSearchParams(query);
  Object.entries(params).forEach(([key, value]) => {
    if (!search.has(key)) search.set(key, value);
  });
  return `${base}?${search.toString()}`;
};

const unsplash = (url, width) => sized(url, { w: String(width), q: '70', auto: 'format', fit: 'crop' });
const pexels = (url, width) => sized(url, { auto: 'compress', cs: 'tinysrgb', w: String(width) });

const HERO_IMAGE = {
  src: unsplash('https://images.unsplash.com/photo-1758685848662-0aad938fd19a', 1200),
  alt: 'Students in science lab',
  width: 1200,
  height: 800,
};

// Class names are written out in full so Tailwind's JIT can see them.
const SUBJECT_CARDS = [
  {
    key: 'science',
    letter: 'S',
    title: 'Science',
    description: 'Explore the natural world through observation, experimentation, and discovery.',
    circle: 'bg-gradient-to-br from-blue-500 to-blue-600',
    titleColor: 'text-blue-600',
    panel: 'border-blue-200 bg-blue-50',
    emoji: '🔬',
    image: { src: unsplash('https://images.unsplash.com/photo-1758685733987-54952cd1c8c6', 600), alt: 'Science education' },
  },
  {
    key: 'technology',
    letter: 'T',
    title: 'Technology',
    description: 'Master digital tools and understand how technology shapes our world.',
    circle: 'bg-gradient-to-br from-purple-500 to-purple-600',
    titleColor: 'text-purple-600',
    panel: 'border-purple-200 bg-purple-50',
    emoji: '💻',
    image: { src: pexels('https://images.pexels.com/photos/7269454/pexels-photo-7269454.jpeg', 600), alt: 'Technology learning' },
  },
  {
    key: 'engineering',
    letter: 'E',
    title: 'Engineering',
    description: 'Design solutions to real-world problems through creative problem-solving.',
    circle: 'bg-gradient-to-br from-green-500 to-green-600',
    titleColor: 'text-green-600',
    panel: 'border-green-200 bg-green-50',
    emoji: '⚙️',
    image: { src: unsplash('https://images.unsplash.com/photo-1758685848895-e724272475d2', 600), alt: 'Engineering education' },
  },
  {
    key: 'arts',
    letter: 'A',
    title: 'Arts',
    description: 'Express creativity and innovation through visual, performing, and digital arts.',
    circle: 'bg-gradient-to-br from-pink-500 to-pink-600',
    titleColor: 'text-pink-600',
    panel: 'border-pink-200 bg-pink-50',
    emoji: '🎨',
    image: { src: pexels('https://images.pexels.com/photos/7605825/pexels-photo-7605825.jpeg', 600), alt: 'Arts education' },
  },
  {
    key: 'mathematics',
    letter: 'M',
    title: 'Mathematics',
    description: 'Develop logical reasoning and analytical skills through mathematical concepts.',
    circle: 'bg-gradient-to-br from-orange-500 to-orange-600',
    titleColor: 'text-orange-600',
    panel: 'border-orange-200 bg-orange-50',
    emoji: '📐',
    image: { src: pexels('https://images.pexels.com/photos/5676744/pexels-photo-5676744.jpeg', 600), alt: 'Mathematics education' },
  },
  {
    key: 'integration',
    letter: '∞',
    title: 'Integration',
    description: 'Combine all disciplines to tackle complex, real-world challenges collaboratively.',
    circle: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
    titleColor: 'text-emerald-600',
    panel: null,
    emoji: null,
    image: null,
  },
];

const FEATURES = [
  {
    key: 'quizzes',
    emoji: '📝',
    circle: 'bg-gradient-to-br from-blue-500 to-blue-600',
    title: 'Interactive Quizzes',
    text: 'Test your knowledge with engaging multiple-choice quizzes across all STEAM subjects.',
  },
  {
    key: 'activities',
    emoji: '🎯',
    circle: 'bg-gradient-to-br from-green-500 to-green-600',
    title: 'Hands-on Activities',
    text: 'Experience drag-and-drop exercises and interactive simulations.',
  },
  {
    key: 'ideas',
    emoji: '💡',
    circle: 'bg-gradient-to-br from-purple-500 to-purple-600',
    title: 'Idea Sharing',
    text: 'Share your creative projects and learn from your classmates.',
  },
  {
    key: 'resources',
    emoji: '📚',
    circle: 'bg-gradient-to-br from-orange-500 to-orange-600',
    title: 'Learning Resources',
    text: 'Access curated articles, experiment guides, and educational materials.',
  },
];

const SubjectVisual = ({ card, lite }) => {
  if (!card.image) {
    return (
      <div className="rounded-lg w-full h-32 bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
        <span className="text-3xl font-bold text-emerald-600">STEAM</span>
      </div>
    );
  }
  if (lite) {
    // Same footprint as the photo so the grid doesn't jump when lite mode is toggled.
    return (
      <div
        className={`rounded-lg w-full h-32 border-2 border-dashed ${card.panel} flex flex-col items-center justify-center gap-1 px-3 text-center`}
        data-testid={`home-subject-lite-panel-${card.key}`}
      >
        <span className="text-3xl" aria-hidden="true">{card.emoji}</span>
        <span className="text-sm text-gray-600">{card.image.alt}</span>
        <span className="text-xs text-gray-500">Photo off in Lite mode</span>
      </div>
    );
  }
  return (
    <img
      src={card.image.src}
      alt={card.image.alt}
      width={600}
      height={400}
      loading="lazy"
      decoding="async"
      className="rounded-lg w-full h-32 object-cover"
      data-testid={`home-subject-img-${card.key}`}
    />
  );
};

const HomePage = () => {
  const { lite } = useLiteMode();

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/10 to-teal-600/10" data-decor aria-hidden="true"></div>
        <div className="relative max-w-7xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="lite-solid-text text-5xl md:text-7xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent mb-6 leading-tight">
              STEAM Learning Platform
            </h1>
            <p className="text-xl md:text-2xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              Learn Science, Technology, Engineering, Arts, and Mathematics through quizzes,
              hands-on activities, and shared student ideas, with progress your teacher can follow.
            </p>
          </div>

          <div className={`flex flex-col sm:flex-row gap-4 justify-center ${lite ? 'mb-4' : 'mb-16'}`}>
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

          {/* Hero Image: not rendered at all in lite mode (a CSS-hidden <img> still downloads). */}
          {!lite && (
            <div className="relative">
              <img
                src={HERO_IMAGE.src}
                alt={HERO_IMAGE.alt}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                loading="lazy"
                decoding="async"
                className="rounded-2xl shadow-2xl max-w-4xl mx-auto w-full h-auto"
                data-testid="home-hero-img"
              />
            </div>
          )}
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
            {SUBJECT_CARDS.map((card) => (
              <Card
                key={card.key}
                className="group hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-emerald-200 bg-white/70 backdrop-blur-sm"
                data-testid={`home-subject-card-${card.key}`}
              >
                <CardHeader>
                  <div className={`w-16 h-16 ${card.circle} rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <span className="text-2xl font-bold text-white" aria-hidden="true">{card.letter}</span>
                  </div>
                  <CardTitle className={`text-2xl ${card.titleColor}`}>{card.title}</CardTitle>
                  <CardDescription className="text-gray-600">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SubjectVisual card={card} lite={lite} />
                </CardContent>
              </Card>
            ))}
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
            {FEATURES.map((feature) => (
              <div key={feature.key} className="text-center group" data-testid={`home-feature-${feature.key}`}>
                <div className={`w-20 h-20 ${feature.circle} rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <span className="text-3xl" aria-hidden="true">{feature.emoji}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.text}</p>
              </div>
            ))}
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
