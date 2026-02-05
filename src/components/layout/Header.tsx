// src/components/layout/Header.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaUserCircle, FaTh } from 'react-icons/fa';
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
  const [showNavTabs, setShowNavTabs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const baseNavItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/database-stats', label: 'DB Stats' },
    { path: '/checklists', label: 'Checklists' },
    { path: '/performance', label: 'Performance' }
  ];

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const navItems = isAdmin
    ? [...baseNavItems, { path: '/users', label: 'Users' }]
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

  return (
    <header className="app-header">
      <div className="header-container">

        <div className="header-left">
          <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
          <img src={Logo} alt="SentinelOps" className="header-logo" onClick={() => navigate('/')} />
          <span className="app-title">SENTINELOPS PORTAL</span>
        </div>

        {/* Navigation Tabs - Hidden on small screens, visible on wider screens */}
        <nav className="header-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-tab ${location.pathname === item.path ? 'active' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* View Tab Buttons Button - Only visible on small screens */}
        <button 
          className="view-tabs-btn" 
          onClick={() => setShowNavTabs(!showNavTabs)}
          aria-label="View navigation tabs"
        >
          <FaTh />
        </button>

        <div className="header-right">
          <NotificationContainer />
          <ThemeToggle />

          <div className="user-menu" ref={menuRef}>
            <div className="user-avatar" onClick={() => setMenuOpen(!menuOpen)}>
              {user ? (
                <div className="avatar-initials">
                  {user.first_name?.[0] ?? ''}{user.last_name?.[0] ?? ''}
                </div>
              ) : (
                <FaUserCircle />
              )}

            </div>

            {menuOpen && (
              <div className="dropdown-menu">
                <div className="nav-links">
                  {navItems.map((item) => (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <div className="user-actions">
                  <Link to="/settings" className="nav-link">Profile Settings</Link>
                  <button className="logout-btn" onClick={() => { void logout(); setMenuOpen(false); }}>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Navigation Overlay - Only shows when view tabs button is clicked on small screens */}
      {showNavTabs && (
        <div className="mobile-nav-overlay">
          <div className="mobile-nav-content">
            <button 
              className="close-mobile-nav" 
              onClick={() => setShowNavTabs(false)}
              aria-label="Close navigation"
            >
              <FaTimes />
            </button>
            <div className="mobile-nav-tabs">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`mobile-nav-tab ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => setShowNavTabs(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
