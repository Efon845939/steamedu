import React, { useState, useContext } from 'react';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { formatApiError } from '../lib/steam';
import { ArrowRight, CircleAlert, GraduationCap, School } from 'lucide-react';
import { BrandMark, StatusWord } from './lab';
import { cn } from '../lib/utils';

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
      setError('Teachers need a signup code. Ask your school administrator for one.');
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

  const field = (id, label, props, hint) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input id={id} className="h-12 rounded-xl border-rule-strong/60 bg-surface/70 text-base" {...props} />
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : null}
    </div>
  );

  const errorBox = error ? (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-danger-rule bg-danger-tint/80 px-3.5 py-3 text-sm text-ink"
      data-testid="auth-error"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
      {error}
    </div>
  ) : null;

  const roleButton = (value, Icon, label, note, testid) => (
    <button
      type="button"
      onClick={() => setRole(value)}
      aria-pressed={role === value}
      className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-[background-color,border-color,transform] duration-enter active:scale-[0.98]',
        role === value ? 'border-brand-ink bg-brand-tint/80' : 'border-rule-strong/50 bg-surface/40 hover:bg-surface/70'
      )}
      data-testid={testid}
    >
      <Icon className={cn('h-5 w-5 shrink-0', role === value ? 'text-brand-ink' : 'text-ink-muted')} aria-hidden="true" />
      <span className="flex flex-col">
        <span className="text-sm font-semibold">{label}</span>
        <span className="text-xs text-ink-muted">{note}</span>
      </span>
    </button>
  );

  const submitClass = 'glass-brand mt-1 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold transition-transform duration-press active:scale-[0.98] disabled:opacity-60';

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:gap-20">
      <div className="hidden flex-col gap-8 lg:flex">
        <div className="animate-rise flex flex-col gap-5">
          <span className="text-brand-ink">
            <BrandMark size={34} />
          </span>
          <h1 className="font-display text-[clamp(2.4rem,4vw,3.6rem)] font-bold leading-[1.04] tracking-[-0.02em]">
            Every wrong idea is worth catching.
          </h1>
          <p className="t-lead max-w-md text-ink-muted">
            Sign in to pick up your diagnostic, your Debug Arena puzzles and your notebook of ideas, right where you left them.
          </p>
        </div>
        <ol className="flex max-w-md flex-col gap-3">
          {[
            ['Diagnose', 'Eight questions with a confidence check.', 'unsure'],
            ['Practise', 'Worked solutions with one broken step.', 'breaks'],
            ['See it fixed', 'Your teacher sees which ideas still hold.', 'holds'],
          ].map(([title, text, status], i) => (
            <li
              key={title}
              className="glass animate-rise flex items-center justify-between gap-4 rounded-2xl px-5 py-4"
              style={{ animationDelay: `${160 + i * 90}ms` }}
            >
              <span className="flex flex-col">
                <span className="font-semibold">{title}</span>
                <span className="text-sm text-ink-muted">{text}</span>
              </span>
              <StatusWord status={status} className="text-xs" />
            </li>
          ))}
        </ol>
      </div>

      <div className="glass glass-strong animate-rise w-full rounded-[28px] p-6 sm:p-8" style={{ animationDelay: '80ms' }}>
        <div className="mb-6 flex flex-col gap-1.5">
          <h2 className="t-h2">Welcome to STEAM Hub</h2>
          <p className="text-ink-muted">Sign in, or create an account in a minute.</p>
        </div>

        <Tabs defaultValue="login" className="w-full" onValueChange={() => setError('')}>
          <TabsList className="mb-6 grid h-12 w-full grid-cols-2 rounded-full border border-rule-strong/40 bg-surface/50 p-1">
            <TabsTrigger value="login" className="h-full rounded-full text-sm font-semibold data-[state=active]:bg-surface data-[state=active]:shadow-raised" data-testid="login-tab">
              Sign in
            </TabsTrigger>
            <TabsTrigger value="register" className="h-full rounded-full text-sm font-semibold data-[state=active]:bg-surface data-[state=active]:shadow-raised" data-testid="register-tab">
              Create account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-0">
            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              {field('login-username', 'Username', {
                type: 'text',
                autoComplete: 'username',
                value: loginData.username,
                onChange: (e) => setLoginData({ ...loginData, username: e.target.value }),
                required: true,
                'data-testid': 'login-username-input',
              })}
              {field('login-password', 'Password', {
                type: 'password',
                autoComplete: 'current-password',
                value: loginData.password,
                onChange: (e) => setLoginData({ ...loginData, password: e.target.value }),
                required: true,
                'data-testid': 'login-password-input',
              })}
              {errorBox}
              <button type="submit" className={submitClass} disabled={isLoading} data-testid="login-submit-btn">
                {isLoading ? 'Signing in' : 'Sign in'}
                {!isLoading && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              </button>
            </form>
          </TabsContent>

          <TabsContent value="register" className="mt-0">
            <form onSubmit={handleRegister} className="flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-semibold">I am a</legend>
                <div className="grid grid-cols-2 gap-3">
                  {roleButton('student', GraduationCap, 'Student', 'Ages 13 and up', 'role-student-btn')}
                  {roleButton('teacher', School, 'Teacher', 'With a school code', 'role-teacher-btn')}
                </div>
              </fieldset>

              {field('register-fullname', 'Full name', {
                type: 'text',
                autoComplete: 'name',
                value: registerData.full_name,
                onChange: (e) => setRegisterData({ ...registerData, full_name: e.target.value }),
                required: true,
                'data-testid': 'register-fullname-input',
              })}
              {field('register-email', 'Email', {
                type: 'email',
                autoComplete: 'email',
                value: registerData.email,
                onChange: (e) => setRegisterData({ ...registerData, email: e.target.value }),
                required: true,
                'data-testid': 'register-email-input',
              })}
              {field('register-username', 'Username', {
                type: 'text',
                autoComplete: 'username',
                value: registerData.username,
                onChange: (e) => setRegisterData({ ...registerData, username: e.target.value }),
                required: true,
                'data-testid': 'register-username-input',
              })}

              {role === 'student'
                ? field(
                    'register-age',
                    'Age',
                    {
                      type: 'number',
                      min: '10',
                      max: '100',
                      inputMode: 'numeric',
                      value: registerData.age,
                      onChange: (e) => setRegisterData({ ...registerData, age: e.target.value }),
                      required: true,
                      'data-testid': 'register-age-input',
                    },
                    'Quizzes, activities and articles are matched to age groups 13-15, 16-18 and 18+.'
                  )
                : field(
                    'register-teacher-code',
                    'Teacher signup code',
                    {
                      type: 'text',
                      value: registerData.teacher_code,
                      onChange: (e) => setRegisterData({ ...registerData, teacher_code: e.target.value }),
                      required: true,
                      'data-testid': 'register-teacher-code-input',
                    },
                    'Only verified educators receive this code. Students cannot sign up as teachers.'
                  )}

              <div className="grid gap-4 sm:grid-cols-2">
                {field('register-password', 'Password', {
                  type: 'password',
                  autoComplete: 'new-password',
                  placeholder: 'At least 6 characters',
                  value: registerData.password,
                  onChange: (e) => setRegisterData({ ...registerData, password: e.target.value }),
                  required: true,
                  'data-testid': 'register-password-input',
                })}
                {field('register-confirm-password', 'Confirm password', {
                  type: 'password',
                  autoComplete: 'new-password',
                  value: registerData.confirmPassword,
                  onChange: (e) => setRegisterData({ ...registerData, confirmPassword: e.target.value }),
                  required: true,
                  'data-testid': 'register-confirm-password-input',
                })}
              </div>

              {errorBox}

              <button type="submit" className={submitClass} disabled={isLoading} data-testid="register-submit-btn">
                {isLoading ? 'Creating your account' : `Create ${role === 'teacher' ? 'teacher' : 'student'} account`}
                {!isLoading && <ArrowRight className="h-5 w-5" aria-hidden="true" />}
              </button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AuthPage;
