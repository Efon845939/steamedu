import React, { useContext, useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { AuthContext } from '../App';
import axios from 'axios';
import { PageFallback } from './ChunkErrorBoundary';

// Students never download the teacher dashboard and vice versa
const StudentDashboard = lazy(() => import('./StudentDashboard'));
const TeacherDashboard = lazy(() => import('./TeacherDashboard'));

const Dashboard = () => {
  const { user, API } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/stats/me`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !stats) {
    return <PageFallback />;
  }

  return (
    <Suspense fallback={<PageFallback />}>
      {user.role === 'teacher'
        ? <TeacherDashboard stats={stats} refreshStats={fetchStats} />
        : <StudentDashboard stats={stats} refreshStats={fetchStats} />}
    </Suspense>
  );
};

export default Dashboard;
