// src/components/layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaUserCircle } from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationContainer from '../ui/NotificationContainer';
import Logo from '../../logo.svg';
import './Header.css';

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { resolvedTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const baseNavItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/database-stats', label: 'Stats' },
    { path: '/checklists', label: 'Checklists' },
    { path: '/tasks', label: 'Task Center' },
    { path: '/templates', label: 'Templates' },
    { path: '/schedule', label: 'Schedule' },
    { path: '/performance', label: 'Performance' }
  ];

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isManager = ['admin', 'manager'].includes((user?.role || '').toLowerCase());
  const navItems = isAdmin
    ? [...baseNavItems, { path: '/team', label: 'Team' }, { path: '/users', label: 'Users' }]
    : isManager
    ? [...baseNavItems, { path: '/team', label: 'Team' }]
    : baseNavItems;

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleAvatarClick = () => {
    setMenuOpen(!menuOpen);
  };

  return (
    <header className="app-header">
      <div className="header-container">
        
        {/* Brand Section - Left */}
        <div className="header-brand">
          <div className="brand-wrapper" onClick={() => navigate('/')}>
            <img src={Logo} alt="SentinelOps" className="header-logo" />
            <div className="brand-text">
              <span className="brand-primary">SENTINEL</span>
              <span className="brand-secondary">OPS</span>
            </div>
          </div>
        </div>

        {/* Desktop Navigation - Center 
        <nav className="header-nav-desktop">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link-desktop ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span>{item.label}</span>
              {location.pathname === item.path && <span className="nav-indicator" />}
            </Link>
          ))}
        </nav>*/}

        {/* Right Controls */}
        <div className="header-controls">
          {/* Desktop Only - Notifications and Theme */}
          <div className="controls-desktop">
            <React.Suspense fallback={<div>Loading...</div>}>
              <NotificationContainer />
            </React.Suspense>
            <ThemeToggle />
          </div>

          {/* User Menu */}
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-avatar-btn"
              onClick={handleAvatarClick}
              aria-label="User menu"
              title={user?.username || 'User'}
            >
              {user ? (
                <div className="avatar-initials">
                  {user.first_name?.[0] ?? 'U'}{user.last_name?.[0] ?? ''}
                </div>
              ) : (
                <FaUserCircle />
              )}
            </button>

            {menuOpen && (
              <div className="dropdown-menu">
                <div className="dropdown-header">
                  <div className="user-info">
                    <span className="user-name">{user?.username}</span>
                    <span className="user-role">{user?.role?.toUpperCase()}</span>
                  </div>
                </div>
                <hr className="dropdown-divider" />
                <nav className="dropdown-nav">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`dropdown-link ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                <hr className="dropdown-divider" />
                <div className="dropdown-actions">
                  <Link to="/settings" className="dropdown-link settings">
                    Profile Settings
                  </Link>
                  <button
                    className="logout-btn"
                    onClick={() => {
                      void logout();
                      setMenuOpen(false);
                    }}
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={handleAvatarClick}
            aria-label="Toggle mobile menu"
          >
            {mobileMenuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu-drawer">
          <nav className="mobile-nav">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`mobile-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mobile-menu-footer">
            <Link to="/settings" className="mobile-nav-link settings">
              Profile Settings
            </Link>
            <button
              className="logout-btn"
              onClick={() => {
                void logout();
                setMobileMenuOpen(false);
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
