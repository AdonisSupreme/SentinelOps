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
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard' }
  ];

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

        <div className="header-center">
          <div className="left">
          <button className="mobile-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
          <img src={Logo} alt="SentinelOps" className="header-logo" onClick={() => navigate('/')} />
        </div>
          <h1 className="app-title">SentinelOps Portal</h1>
        </div>

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
                  <button className="logout-btn" onClick={() => { logout(); setMenuOpen(false); }}>
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
