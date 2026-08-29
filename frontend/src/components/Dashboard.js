import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../App';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import axios from 'axios';

const Dashboard = () => {
  const { user, API } = useContext(AuthContext);
  const [stats, setStats] = useState({
    quizzesCompleted: 0,
    totalQuizzes: 0,
    activitiesCompleted: 0,
    ideasShared: 0,
    recentQuizzes: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [quizzesResponse, ideasResponse] = await Promise.all([
        axios.get(`${API}/quizzes`),
        axios.get(`${API}/ideas`)
      ]);

      const userIdeas = ideasResponse.data.filter(idea => idea.author_id === user.id);

      setStats({
        quizzesCompleted: 0, // We'll implement quiz attempts tracking later
        totalQuizzes: quizzesResponse.data.length,
        activitiesCompleted: 0, // We'll implement activity tracking later
        ideasShared: userIdeas.length,
        recentQuizzes: quizzesResponse.data.slice(0, 3)
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 pt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="mb-8" data-testid="dashboard-header">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back, {user.full_name.split(' ')[0]}! 👋
          </h1>
          <p className="text-xl text-gray-600">
            Ready to continue your STEAM learning journey?
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quizzes Available</CardTitle>
              <span className="text-2xl">📝</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600" data-testid="total-quizzes">
                {stats.totalQuizzes}
              </div>
              <p className="text-xs text-muted-foreground">Ready to test your knowledge</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ideas Shared</CardTitle>
              <span className="text-2xl">💡</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600" data-testid="ideas-shared">
                {stats.ideasShared}
              </div>
              <p className="text-xs text-muted-foreground">Your creative contributions</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Learning Progress</CardTitle>
              <span className="text-2xl">📊</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">65%</div>
              <Progress value={65} className="mt-2" />
              <p className="text-xs text-muted-foreground mt-1">Keep going!</p>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm border-2 border-transparent hover:border-emerald-200 transition-all duration-300">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Streak</CardTitle>
              <span className="text-2xl">🔥</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">7</div>
              <p className="text-xs text-muted-foreground">Days learning</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-2xl">🚀</span>
                <span>Quick Actions</span>
              </CardTitle>
              <CardDescription>
                Jump into your learning activities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Link to="/quiz">
                <Button className="w-full justify-start bg-emerald-600 hover:bg-emerald-700" data-testid="take-quiz-btn">
                  <span className="mr-3">📝</span>
                  Take a Quiz
                </Button>
              </Link>
              <Link to="/activities">
                <Button variant="outline" className="w-full justify-start border-purple-600 text-purple-600 hover:bg-purple-50" data-testid="explore-activities-btn">
                  <span className="mr-3">🎯</span>
                  Explore Activities
                </Button>
              </Link>
              <Link to="/ideas">
                <Button variant="outline" className="w-full justify-start border-blue-600 text-blue-600 hover:bg-blue-50" data-testid="share-ideas-btn">
                  <span className="mr-3">💡</span>
                  Share an Idea
                </Button>
              </Link>
              <Link to="/content">
                <Button variant="outline" className="w-full justify-start border-green-600 text-green-600 hover:bg-green-50" data-testid="browse-content-btn">
                  <span className="mr-3">📚</span>
                  Browse Content
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="bg-white/70 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <span className="text-2xl">📚</span>
                <span>Available Quizzes</span>
              </CardTitle>
              <CardDescription>
                Test your knowledge in different subjects
              </CardDescription>
            </CardHeader>
            <CardContent>
              {stats.recentQuizzes.length > 0 ? (
                <div className="space-y-4">
                  {stats.recentQuizzes.map((quiz) => (
                    <div key={quiz.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <div>
                        <h4 className="font-semibold text-sm">{quiz.title}</h4>
                        <p className="text-xs text-gray-600">{quiz.description}</p>
                      </div>
                      <Link to={`/quiz/${quiz.id}`}>
                        <Button size="sm" variant="outline" data-testid={`quiz-${quiz.id}-btn`}>
                          Start
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No quizzes available yet.</p>
                  <p className="text-sm">Check back later for new content!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Learning Path */}
        <Card className="bg-white/70 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span className="text-2xl">🎯</span>
              <span>Your Learning Path</span>
            </CardTitle>
            <CardDescription>
              Personalized recommendations based on your interests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
              {['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics'].map((subject, index) => (
                <div key={subject} className="text-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg hover:shadow-md transition-all duration-300">
                  <div className={`w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white font-bold ${
                    index === 0 ? 'bg-blue-500' :
                    index === 1 ? 'bg-purple-500' :
                    index === 2 ? 'bg-green-500' :
                    index === 3 ? 'bg-pink-500' :
                    'bg-orange-500'
                  }`}>
                    {subject[0]}
                  </div>
                  <h3 className="font-semibold text-sm text-gray-900">{subject}</h3>
                  <Progress value={Math.random() * 100} className="mt-2 h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;