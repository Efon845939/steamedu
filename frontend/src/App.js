import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './App.css';

import HomePage from './components/HomePage';
import AuthPage from './components/AuthPage';
import NotFoundPage from './components/NotFoundPage';
import Navbar from './components/Navbar';
import { ChunkErrorBoundary, PageFallback } from './components/ChunkErrorBoundary';
import { Toaster } from './components/ui/sonner';

// Everything past the landing and login pages loads on demand, so a slow connection
// only downloads the code for the page the student actually opens.
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

// Reset the error boundary on navigation, so one failed page doesn't block the rest of the app
const RouteBoundary = ({ children }) => {
  const location = useLocation();
  return <ChunkErrorBoundary key={location.pathname}>{children}</ChunkErrorBoundary>;
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, API }}>
      <div className="App">
        <BrowserRouter>
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
        <Toaster position="top-center" richColors />
      </div>
    </AuthContext.Provider>
  );
}

export default App;
