import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { Compass } from 'lucide-react';

const NotFoundPage = () => (
  <div className="min-h-[80vh] bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center px-6">
    <div className="max-w-lg text-left" data-testid="not-found-page">
      <p className="text-sm font-semibold tracking-widest text-emerald-700 mb-3">ERROR 404</p>
      <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">This lab doesn't exist</h1>
      <p className="text-base text-gray-600 mb-8">
        The page you were looking for was moved, renamed, or never built. Head back and keep exploring
        quizzes, activities and contests.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild className="bg-emerald-600 hover:bg-emerald-700" data-testid="not-found-home-btn">
          <Link to="/">Back to home</Link>
        </Button>
        <Button asChild variant="outline" data-testid="not-found-content-btn">
          <Link to="/content" className="flex items-center gap-2">
            <Compass className="w-4 h-4" /> Browse content
          </Link>
        </Button>
      </div>
    </div>
  </div>
);

export default NotFoundPage;
