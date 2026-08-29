import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatApiError } from '../lib/steam';
import { GraduationCap, School } from 'lucide-react';

const AuthPage = () => {
  const { login, API } = useContext(AuthContext);
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('student');

  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [registerData, setRegisterData] = useState({
    email: '', username: '', password: '', full_name: '', confirmPassword: '', age: '', teacher_code: '',
  });

  const finishLogin = async (username, password) => {
    const loginResponse = await axios.post(`${API}/auth/login`, { username, password });
    const token = loginResponse.data.access_token;
    const userResponse = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    login(token, userResponse.data);
    navigate('/dashboard');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await finishLogin(loginData.username, loginData.password);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (registerData.password !== registerData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (registerData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }
    if (role === 'student' && !registerData.age) {
      setError('Please enter your age');
      return;
    }
    if (role === 'teacher' && !registerData.teacher_code.trim()) {
      setError('Teachers need a signup code — ask your school administrator');
      return;
    }
    setIsLoading(true);
    try {
      await axios.post(`${API}/auth/register`, {
        email: registerData.email,
        username: registerData.username,
        password: registerData.password,
        full_name: registerData.full_name,
        role,
        age: role === 'student' ? parseInt(registerData.age, 10) : null,
        teacher_code: role === 'teacher' ? registerData.teacher_code.trim() : null,
      });
      await finishLogin(registerData.username, registerData.password);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to STEAM Hub</h1>
          <p className="text-gray-600">Join the learning community</p>
        </div>

        <Card className="shadow-xl border-0 backdrop-blur-sm bg-white/90">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-gray-900">Get Started</CardTitle>
            <CardDescription>Login to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" data-testid="login-tab">Login</TabsTrigger>
                <TabsTrigger value="register" data-testid="register-tab">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-username">Username</Label>
                    <Input
                      id="login-username"
                      type="text"
                      placeholder="Enter your username"
                      value={loginData.username}
                      onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                      required
                      data-testid="login-username-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="Enter your password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                      data-testid="login-password-input"
                    />
                  </div>
                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg" data-testid="auth-error">
                      {error}
                    </div>
                  )}
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isLoading}
                    data-testid="login-submit-btn"
                  >
                    {isLoading ? 'Logging in...' : 'Login'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label>I am a...</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          role === 'student'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-gray-200 text-gray-600 hover:border-emerald-200'
                        }`}
                        data-testid="role-student-btn"
                      >
                        <GraduationCap className="w-6 h-6" />
                        <span className="font-semibold text-sm">Student</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${
                          role === 'teacher'
                            ? 'border-amber-500 bg-amber-50 text-amber-700'
                            : 'border-gray-200 text-gray-600 hover:border-amber-200'
                        }`}
                        data-testid="role-teacher-btn"
                      >
                        <School className="w-6 h-6" />
                        <span className="font-semibold text-sm">Teacher</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="register-fullname">Full Name</Label>
                    <Input
                      id="register-fullname"
                      type="text"
                      placeholder="Enter your full name"
                      value={registerData.full_name}
                      onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                      required
                      data-testid="register-fullname-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input
                      id="register-email"
                      type="email"
                      placeholder="Enter your email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                      data-testid="register-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-username">Username</Label>
                    <Input
                      id="register-username"
                      type="text"
                      placeholder="Choose a username"
                      value={registerData.username}
                      onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                      required
                      data-testid="register-username-input"
                    />
                  </div>

                  {role === 'student' ? (
                    <div className="space-y-2">
                      <Label htmlFor="register-age">Age</Label>
                      <Input
                        id="register-age"
                        type="number"
                        min="10"
                        max="100"
                        placeholder="Your age (content is matched to your age group)"
                        value={registerData.age}
                        onChange={(e) => setRegisterData({ ...registerData, age: e.target.value })}
                        required
                        data-testid="register-age-input"
                      />
                      <p className="text-xs text-gray-500">
                        Quizzes, activities and articles are tailored to age groups 13-15, 16-18 and 18+.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="register-teacher-code">Teacher Signup Code</Label>
                      <Input
                        id="register-teacher-code"
                        type="text"
                        placeholder="Enter your teacher access code"
                        value={registerData.teacher_code}
                        onChange={(e) => setRegisterData({ ...registerData, teacher_code: e.target.value })}
                        required
                        data-testid="register-teacher-code-input"
                      />
                      <p className="text-xs text-gray-500">
                        Only verified educators receive this code. Students cannot sign up as teachers.
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input
                      id="register-password"
                      type="password"
                      placeholder="Create a password (min 6 characters)"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                      data-testid="register-password-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-confirm-password">Confirm Password</Label>
                    <Input
                      id="register-confirm-password"
                      type="password"
                      placeholder="Confirm your password"
                      value={registerData.confirmPassword}
                      onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                      required
                      data-testid="register-confirm-password-input"
                    />
                  </div>

                  {error && (
                    <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg" data-testid="auth-error">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isLoading}
                    data-testid="register-submit-btn"
                  >
                    {isLoading ? 'Creating account...' : `Create ${role === 'teacher' ? 'Teacher' : 'Student'} Account`}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
