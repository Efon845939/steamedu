import React, { useContext, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, LogOut, Menu, X } from 'lucide-react';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import DisplaySettings, { DisplayPanel } from './DisplaySettings';
import { Wordmark } from './lab';
import { firstName } from '../lib/steam';
import { useAgeTheme } from '../lib/theme';
import { cn } from '../lib/utils';

// Flat bar on the page colour with one hairline. Points sit here only for 13-15;
// 16-18 shows them in the dashboard side column and 18+ only in the profile.

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useAgeTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const items = [
    { to: '/', label: 'Home' },
    { to: '/content', label: 'Content' },
    ...(user
      ? [
          { to: '/dashboard', label: 'Dashboard' },
          { to: '/arena', label: 'Debug Arena' },
          { to: '/ideas', label: 'Ideas' },
          { to: '/contests', label: 'Contests' },
        ]
      : []),
  ];

  const renderLink = (item, mobile = false) => {
    const active = isActive(item.to);
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'inline-flex items-center whitespace-nowrap rounded-full text-sm transition-colors duration-enter',
          mobile ? 'min-h-11 px-4' : 'h-10 px-3',
          active ? 'bg-brand-tint/80 font-semibold text-ink' : 'text-ink-muted hover:bg-surface/50 hover:text-ink'
        )}
        data-testid={`nav-${item.to.replace('/', '') || 'home'}`}
      >
        {item.label}
      </Link>
    );
  };

  const showPoints = user && user.role === 'student' && theme === '13-15';

  return (
    <header className="sticky top-0 z-40 px-3 pt-3">
      <nav aria-label="Main" className="glass mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 rounded-2xl pl-4 pr-2 sm:pl-5">
        <div className="flex min-w-0 items-center gap-4 xl:gap-6">
          <Link to="/" className="rounded-sm" aria-label="STEAM Hub home">
            <Wordmark />
          </Link>
          <div className="hidden items-center gap-1 lg:flex">{items.map((i) => renderLink(i))}</div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {showPoints && (
            <span className="inline-flex items-baseline gap-1.5 rounded-full border border-rule-strong/60 bg-surface/50 px-3 py-1 text-sm" data-testid="navbar-points">
              <span className="t-num">{(user.points || 0).toLocaleString()}</span>
              <span className="text-ink-muted">points</span>
            </span>
          )}
          <DisplaySettings />
          {user ? (
            <div className="ml-2 flex items-center gap-3 border-l border-rule pl-4">
              <span className="flex items-center gap-1.5 whitespace-nowrap text-sm" data-testid="navbar-user-name">
                {firstName(user.full_name)}
                {user.role === 'teacher' && user.verified && (
                  <BadgeCheck className="h-4 w-4 text-info" aria-label="Verified teacher" data-testid="navbar-verified-badge" />
                )}
                {user.role === 'teacher' && <span className="rounded-sm bg-neutral-tint px-1.5 py-0.5 text-xs text-ink-muted">Teacher</span>}
              </span>
              <Button onClick={handleLogout} variant="ghost" size="sm" data-testid="logout-btn">
                <LogOut aria-hidden="true" />
                Log out
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" size="sm" className="ml-1 rounded-full px-4">
              <Link to="/auth" data-testid="login-nav-btn">
                Sign in
              </Link>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          {showPoints && (
            <span className="inline-flex items-baseline gap-1 rounded-sm border border-rule-strong px-2 py-0.5 text-sm">
              <span className="t-num">{(user.points || 0).toLocaleString()}</span>
              <span className="sr-only">points</span>
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="inline-grid h-11 w-11 place-items-center rounded-md text-ink hover:bg-neutral-tint"
            data-testid="mobile-menu-btn"
          >
            {isMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {isMenuOpen && (
        <div id="mobile-menu" className="glass glass-strong mx-auto mt-2 max-h-[calc(100vh-6rem)] max-w-6xl overflow-y-auto rounded-2xl animate-rise lg:hidden">
          <div className="flex flex-col gap-1 p-3">
            {items.map((i) => renderLink(i, true))}
            <div className="mt-3 border-t border-rule pt-4">
              <DisplayPanel liteTestId="lite-mode-toggle-mobile" />
            </div>
            <div className="mt-3 border-t border-rule pt-4">
              {user ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm">{user.full_name}</span>
                  <Button onClick={handleLogout} variant="outline" size="sm" data-testid="logout-btn-mobile">
                    Log out
                  </Button>
                </div>
              ) : (
                <Button asChild className="w-full">
                  <Link to="/auth">Sign in or create an account</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
