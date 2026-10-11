import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

import AuthPage from './components/AuthPage';
import NotFoundPage from './components/NotFoundPage';
import Navbar from './components/Navbar';
import { ChunkErrorBoundary, PageFallback } from './components/ChunkErrorBoundary';
import { Toaster } from './components/ui/sonner';
import { BrandMark } from './components/lab';
import Ambient from './components/Ambient';
import { DisplayProvider } from './lib/theme';

// Every page past login loads on demand, so a slow connection only downloads the code
// for the page the student actually opens. The landing is lazy too: it carries the
// motion library for its animations, which keeps that out of the main bundle.
const HomePage = lazy(() => import('./components/HomePage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const QuizPage = lazy(() => import('./components/QuizPage'));
const ActivitiesPage = lazy(() => import('./components/ActivitiesPage'));
const IdeasPage = lazy(() => import('./components/IdeasPage'));
const IdeaDetailPage = lazy(() => import('./components/IdeaDetailPage'));
const ContentHub = lazy(() => import('./components/ContentHub'));
const LeaderboardPage = lazy(() => import('./components/LeaderboardPage'));
const ContestsPage = lazy(() => import('./components/ContestsPage'));
const ArenaPage = lazy(() => import('./components/ArenaPage'));
const WorksheetPage = lazy(() => import('./components/WorksheetPage'));

// Unset on Vercel: the frontend and the /api backend share one domain, so requests stay relative
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

// Reset the error boundary on navigation, so one failed page doesn't block the rest of the app.
// Each page fades in with a CSS animation (opacity only, never blocking input, no wait for
// JavaScript); reduced and off motion settings shorten or skip it.
const RouteBoundary = ({ children }) => {
  const location = useLocation();
  return (
    <ChunkErrorBoundary key={location.pathname}>
      <main id="main" tabIndex={-1} className="animate-fade outline-none">
        {children}
      </main>
    </ChunkErrorBoundary>
  );
};

// The light field is strongest on the landing and sign-in pages and quieter inside the app.
const RouteAmbient = () => {
  const { pathname } = useLocation();
  return <Ambient quiet={!(pathname === '/' || pathname === '/auth')} />;
};

// Points and streaks change as students play; refresh the signed-in user on navigation
// (at most every 20 seconds) so the header never shows a stale total.
const UserRefresher = ({ refreshUser, enabled }) => {
  const location = useLocation();
  const last = useRef(Date.now());
  useEffect(() => {
    if (!enabled || Date.now() - last.current < 20000) return;
    last.current = Date.now();
    refreshUser();
  }, [location.pathname, enabled, refreshUser]);
  return null;
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchCurrentUser();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      localStorage.removeItem('token');
      delete axios.defaults.headers.common['Authorization'];
    } finally {
      setLoading(false);
    }
  };

  // Quiet refresh: a failed request keeps the current user rather than logging out.
  const refreshUser = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      if (error?.response?.status === 401) {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        setUser(null);
      }
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3 text-brand-ink">
          <BrandMark size={32} />
          <p className="text-sm text-ink-muted">Loading</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser, login, logout, API }}>
      <DisplayProvider user={user}>
      <div className="App min-h-screen text-ink">
        <BrowserRouter>
          <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-ink focus:shadow-float">
            Skip to content
          </a>
          <RouteAmbient />
          <UserRefresher refreshUser={refreshUser} enabled={Boolean(user)} />
          <Navbar />
          <RouteBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
                <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
                <Route path="/quiz/:id?" element={user ? <QuizPage /> : <Navigate to="/auth" />} />
                <Route path="/activities" element={user ? <ActivitiesPage /> : <Navigate to="/auth" />} />
                <Route path="/ideas" element={user ? <IdeasPage /> : <Navigate to="/auth" />} />
                <Route path="/ideas/:id" element={user ? <IdeaDetailPage /> : <Navigate to="/auth" />} />
                <Route path="/leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/auth" />} />
                <Route path="/contests" element={user ? <ContestsPage /> : <Navigate to="/auth" />} />
                <Route path="/tournaments" element={<Navigate to="/contests" />} />
                <Route
                  path="/arena/worksheet"
                  element={user ? (user.role === 'teacher' ? <WorksheetPage /> : <Navigate to="/arena" />) : <Navigate to="/auth" />}
                />
                <Route path="/arena/:id?" element={user ? <ArenaPage /> : <Navigate to="/auth" />} />
                <Route path="/content" element={<ContentHub />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </RouteBoundary>
        </BrowserRouter>
        <Toaster position="top-center" />
      </div>
      </DisplayProvider>
    </AuthContext.Provider>
  );
}

export default App;
