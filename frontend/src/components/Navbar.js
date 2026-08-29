import React, { useContext, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../App';
import { Button } from './ui/button';
import { BadgeCheck } from 'lucide-react';
import { firstName } from '../lib/steam';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const NavLink = ({ to, children, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`nav-link px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${
        isActive(to)
          ? 'bg-emerald-100 text-emerald-700'
          : 'text-gray-700 hover:text-emerald-600 hover:bg-emerald-50'
      }`}
      data-testid={`nav-${to.replace('/', '') || 'home'}`}
    >
      {children}
    </Link>
  );

  const links = (
    <>
      <NavLink to="/" onClick={() => setIsMenuOpen(false)}>Home</NavLink>
      <NavLink to="/content" onClick={() => setIsMenuOpen(false)}>Content</NavLink>
      {user && <NavLink to="/dashboard" onClick={() => setIsMenuOpen(false)}>Dashboard</NavLink>}
      {user && <NavLink to="/ideas" onClick={() => setIsMenuOpen(false)}>Ideas</NavLink>}
    </>
  );

  return (
    <nav className="bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">S</span>
            </div>
            <span className="font-bold text-xl text-gray-900">STEAM Hub</span>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {links}
            {user ? (
              <div className="flex items-center space-x-3 ml-6 pl-6 border-l border-gray-200">
                <span className="text-sm text-gray-700 flex items-center gap-1" data-testid="navbar-user-name">
                  Welcome, {firstName(user.full_name)}!
                  {user.role === 'teacher' && user.verified && (
                    <BadgeCheck className="w-4 h-4 text-sky-500" data-testid="navbar-verified-badge" />
                  )}
                  {user.role === 'teacher' && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Teacher</span>
                  )}
                </span>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="sm"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  data-testid="logout-btn"
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 ml-6 pl-6 border-l border-gray-200">
                <Link to="/auth">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                    data-testid="login-nav-btn"
                  >
                    Login
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 p-2"
              data-testid="mobile-menu-btn"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col space-y-2">
              {links}
              {user ? (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <p className="text-sm text-gray-700 mb-3 px-3">Welcome, {user.full_name}!</p>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg"
                    data-testid="logout-btn-mobile"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="block w-full text-center">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                      Login / Register
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
