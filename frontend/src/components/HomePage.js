import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { ClipboardCheck, MousePointerClick, Lightbulb, BookOpen, ArrowRight, Check } from 'lucide-react';
import { useLiteMode } from '../hooks/use-lite-mode';
import { useReveal } from '../hooks/use-reveal';

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
    circle: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100',
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
    circle: 'bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-100',
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
    circle: 'bg-green-50 text-green-600 ring-1 ring-inset ring-green-100',
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
    circle: 'bg-pink-50 text-pink-600 ring-1 ring-inset ring-pink-100',
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
    circle: 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100',
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
    circle: 'bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100',
    titleColor: 'text-emerald-600',
    panel: null,
    emoji: null,
    image: null,
  },
];

const FEATURES = [
  {
    key: 'quizzes',
    icon: ClipboardCheck,
    circle: 'bg-blue-50 text-blue-600 ring-1 ring-inset ring-blue-100',
    title: 'Interactive Quizzes',
    text: 'Test your knowledge with engaging multiple-choice quizzes across all STEAM subjects.',
  },
  {
    key: 'activities',
    icon: MousePointerClick,
    circle: 'bg-green-50 text-green-600 ring-1 ring-inset ring-green-100',
    title: 'Hands-on Activities',
    text: 'Experience drag-and-drop exercises and interactive simulations.',
  },
  {
    key: 'ideas',
    icon: Lightbulb,
    circle: 'bg-purple-50 text-purple-600 ring-1 ring-inset ring-purple-100',
    title: 'Idea Sharing',
    text: 'Share your creative projects and learn from your classmates.',
  },
  {
    key: 'resources',
    icon: BookOpen,
    circle: 'bg-orange-50 text-orange-600 ring-1 ring-inset ring-orange-100',
    title: 'Learning Resources',
    text: 'Access curated articles, experiment guides, and educational materials.',
  },
];

const SubjectVisual = ({ card, lite }) => {
  if (!card.image) {
    return (
      <div className="rounded-lg w-full h-32 bg-emerald-50 ring-1 ring-inset ring-emerald-100 flex items-center justify-center">
        <span className="font-display text-2xl font-bold tracking-[0.3em] text-emerald-600">STEAM</span>
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
    <div className="overflow-hidden rounded-lg">
      <img
        src={card.image.src}
        alt={card.image.alt}
        width={600}
        height={400}
        loading="lazy"
        decoding="async"
        className="w-full h-32 object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        data-testid={`home-subject-img-${card.key}`}
      />
    </div>
  );
};

// Small letter tiles that drift around the hero photo. Purely decorative.
const FLOATING_TILES = [
  { letter: 'S', className: 'left-[-1rem] top-8 bg-blue-50 text-blue-600 ring-blue-100', delay: '0s' },
  { letter: 'T', className: 'right-[-0.75rem] top-[-0.75rem] bg-purple-50 text-purple-600 ring-purple-100', delay: '1.2s' },
  { letter: 'E', className: 'right-[-1.25rem] bottom-16 bg-green-50 text-green-600 ring-green-100', delay: '2.1s' },
  { letter: 'A', className: 'left-10 bottom-[-1rem] bg-pink-50 text-pink-600 ring-pink-100', delay: '0.6s' },
  { letter: 'M', className: 'left-[-1.25rem] bottom-24 bg-orange-50 text-orange-600 ring-orange-100', delay: '3s' },
];

const HERO_POINTS = ['Free for classes', 'Works on slow school Wi-Fi', 'Teacher sees what each student believes'];

const HomePage = () => {
  const { lite } = useLiteMode();
  const pageRef = useRef(null);
  useReveal(pageRef);

  return (
    <div ref={pageRef} className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50">
      {/* Hero */}
      <section className="relative px-4 pt-14 pb-16 md:pt-20 md:pb-24 overflow-hidden">
        <div className="hero-aurora" data-decor aria-hidden="true" />
        <div className="hero-grid" data-decor aria-hidden="true" />
        <div className={`relative max-w-6xl mx-auto grid items-center gap-12 ${lite ? '' : 'lg:grid-cols-[1.05fr_1fr]'}`}>
          <div className={`hero-in ${lite ? 'text-center' : 'text-center lg:text-left'}`}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200 mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              For students and teachers
            </span>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-[1.08]">
              STEAM learning that shows{' '}
              <span className="lite-solid-text text-sheen bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-600 bg-clip-text text-transparent">
                what students really think
              </span>
            </h1>
            <p className={`text-lg md:text-xl text-gray-600 leading-relaxed mb-8 max-w-xl ${lite ? 'mx-auto' : 'mx-auto lg:mx-0'}`}>
              Learn Science, Technology, Engineering, Arts, and Mathematics through quizzes,
              hands-on activities, and shared student ideas, with progress your teacher can follow.
            </p>

            <div className={`flex flex-col sm:flex-row gap-3 mb-8 ${lite ? 'justify-center' : 'justify-center lg:justify-start'}`}>
              <Link to="/auth">
                <Button
                  size="lg"
                  className="group w-full sm:w-auto h-12 px-7 rounded-xl text-base font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  data-testid="get-started-btn"
                >
                  Get Started
                  <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </Button>
              </Link>
              <Link to="/content">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto h-12 px-7 rounded-xl text-base font-semibold bg-white border-gray-300 text-gray-800 hover:bg-gray-50 hover:text-gray-900"
                  data-testid="explore-content-btn"
                >
                  Explore Content
                </Button>
              </Link>
            </div>

            <ul className={`flex flex-col sm:flex-row flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 ${lite ? 'items-center justify-center' : 'items-center lg:items-start justify-center lg:justify-start'}`}>
              {HERO_POINTS.map((point) => (
                <li key={point} className="inline-flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </div>

          {/* Hero image: not rendered at all in lite mode (a CSS-hidden <img> still downloads). */}
          {!lite && (
            <div className="relative mx-auto w-full max-w-xl animate-page-in [animation-delay:200ms]">
              <div className="absolute -inset-4 rounded-[2rem] bg-emerald-100/60 blur-2xl" data-decor aria-hidden="true" />
              <img
                src={HERO_IMAGE.src}
                alt={HERO_IMAGE.alt}
                width={HERO_IMAGE.width}
                height={HERO_IMAGE.height}
                loading="lazy"
                decoding="async"
                className="relative rounded-3xl shadow-xl ring-1 ring-black/5 w-full h-auto"
                data-testid="home-hero-img"
              />
              {FLOATING_TILES.map((tile) => (
                <span
                  key={tile.letter}
                  className={`absolute hidden sm:flex h-11 w-11 items-center justify-center rounded-xl font-display text-lg font-bold shadow-md ring-1 ring-inset animate-float ${tile.className}`}
                  style={{ animationDelay: tile.delay }}
                  data-decor
                  aria-hidden="true"
                >
                  {tile.letter}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* STEAM overview */}
      <section className="py-16 md:py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 reveal">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              What is STEAM Education?
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              STEAM education integrates Science, Technology, Engineering, Arts, and Mathematics
              to foster critical thinking, creativity, and innovation in the 21st century.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {SUBJECT_CARDS.map((card, i) => (
              <Card
                key={card.key}
                className="group reveal card-hover bg-white hover:shadow-md hover:border-gray-300"
                style={{ '--reveal-delay': `${(i % 3) * 70}ms` }}
                data-testid={`home-subject-card-${card.key}`}
              >
                <CardHeader className="pb-4">
                  <div className={`w-11 h-11 ${card.circle} rounded-xl flex items-center justify-center mb-3`}>
                    <span className="font-display text-lg font-bold" aria-hidden="true">{card.letter}</span>
                  </div>
                  <CardTitle className="text-xl text-gray-900">{card.title}</CardTitle>
                  <CardDescription className="text-gray-600 leading-relaxed">{card.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <SubjectVisual card={card} lite={lite} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 md:py-24 px-4 bg-white border-y border-gray-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 reveal">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Interactive Learning Features
            </h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Engage with dynamic content designed to make learning fun, interactive, and meaningful.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.key}
                  className="reveal text-center sm:text-left"
                  style={{ '--reveal-delay': `${i * 70}ms` }}
                  data-testid={`home-feature-${feature.key}`}
                >
                  <div className={`w-12 h-12 ${feature.circle} rounded-xl flex items-center justify-center mx-auto sm:mx-0 mb-4`}>
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="py-16 md:py-24 px-4">
        <div className="reveal relative max-w-5xl mx-auto overflow-hidden rounded-3xl bg-emerald-600 px-6 py-14 text-center text-white">
          <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" data-decor aria-hidden="true" />
          <div className="absolute -left-10 -bottom-20 h-48 w-48 rounded-full bg-teal-400/30" data-decor aria-hidden="true" />
          <h2 className="relative text-3xl md:text-4xl font-bold mb-4">
            Ready to Start Your STEAM Journey?
          </h2>
          <p className="relative text-lg mb-8 text-white/85">
            Sign up as a student or teacher and start with your first quiz.
          </p>
          <Link to="/auth" className="relative inline-block">
            <Button
              size="lg"
              className="h-12 px-8 rounded-xl text-base font-semibold bg-white text-emerald-700 hover:bg-emerald-50 shadow-sm"
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
