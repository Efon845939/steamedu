import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import './App.css';

import HomePage from './components/HomePage';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import QuizPage from './components/QuizPage';
import ActivitiesPage from './components/ActivitiesPage';
import IdeasPage from './components/IdeasPage';
import IdeaDetailPage from './components/IdeaDetailPage';
import ContentHub from './components/ContentHub';
import LeaderboardPage from './components/LeaderboardPage';
import ChatPage from './components/ChatPage';
import TournamentsPage from './components/TournamentsPage';
import Navbar from './components/Navbar';
import { Toaster } from './components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const AuthContext = React.createContext();

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
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/auth" element={user ? <Navigate to="/dashboard" /> : <AuthPage />} />
            <Route path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/auth" />} />
            <Route path="/quiz/:id?" element={user ? <QuizPage /> : <Navigate to="/auth" />} />
            <Route path="/activities" element={user ? <ActivitiesPage /> : <Navigate to="/auth" />} />
            <Route path="/ideas" element={user ? <IdeasPage /> : <Navigate to="/auth" />} />
            <Route path="/ideas/:id" element={user ? <IdeaDetailPage /> : <Navigate to="/auth" />} />
            <Route path="/leaderboard" element={user ? <LeaderboardPage /> : <Navigate to="/auth" />} />
            <Route path="/chat" element={user ? <ChatPage /> : <Navigate to="/auth" />} />
            <Route path="/tournaments" element={user ? <TournamentsPage /> : <Navigate to="/auth" />} />
            <Route path="/content" element={<ContentHub />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors />
      </div>
    </AuthContext.Provider>
  );
}

export default App;
