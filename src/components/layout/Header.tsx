// src/components/layout/Header.tsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaBars,
  FaChartLine,
  FaClipboardList,
  FaDatabase,
  FaNetworkWired,
  FaRoute,
  FaShieldAlt,
  FaSignal,
  FaTasks,
  FaTachometerAlt,
  FaUserCircle,
  FaUsers,
  FaUserShield,
  FaWrench
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationCenter from '../notifications/NotificationCenter';
import Logo from '../../logo.png';
import './Header.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<NavItem | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const baseNavItems: NavItem[] = useMemo(() => ([
    {
      path: '/',
      label: 'Dashboard',
      icon: <FaTachometerAlt />,
      description: 'Live mission overview with the pulse of active operations, system health, and critical momentum.'
    },
    {
      path: '/database-stats',
      label: 'Stats',
      icon: <FaDatabase />,
      description: 'Deep telemetry for data flow, storage health, and the numbers driving every operational decision.'
    },
    {
      path: '/checklists',
      label: 'Checklists',
      icon: <FaClipboardList />,
      description: 'Execution playbooks for shift handovers, task precision, and keeping every operator perfectly aligned.'
    },
    {
      path: '/tasks',
      label: 'Task Center',
      icon: <FaTasks />,
      description: 'Your tactical queue for assignments, progress tracking, and the next high-impact move across the board.'
    },
    {
      path: '/trustlink',
      label: 'Trustlink Ops',
      icon: <FaShieldAlt />,
      description: 'Security-focused operations space for trust workflows, controlled actions, and resilient oversight.'
    },
    {
      path: '/network-sentinel',
      label: 'Network Sentinel',
      icon: <FaNetworkWired />,
      description: 'Network visibility deck where anomalies surface fast and infrastructure signals turn into action.'
    },
    {
      path: '/templates',
      label: 'Templates',
      icon: <FaWrench />,
      description: 'Blueprint vault for reusable workflows, standardized checklists, and repeatable operational excellence.'
    },
    {
      path: '/schedule',
      label: 'Schedule',
      icon: <FaRoute />,
      description: 'Shift orchestration layer for coverage planning, workforce rhythm, and future-ready coordination.'
    },
    {
      path: '/performance',
      label: 'Performance',
      icon: <FaChartLine />,
      description: 'Performance intelligence hub for streaks, efficiency patterns, and the signals behind top-tier teams.'
    }
  ]), []);

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isManager = ['admin', 'manager'].includes((user?.role || '').toLowerCase());
  const navItems: NavItem[] = useMemo(() => (
    isAdmin
      ? [
        ...baseNavItems,
        {
          path: '/team',
          label: 'Team',
          icon: <FaUsers />,
          description: 'Command your crew with staffing visibility, structure updates, and cross-functional coordination.'
        },
        {
          path: '/users',
          label: 'Users',
          icon: <FaUserShield />,
          description: 'Identity control center for access, roles, and the people trusted to run SentinelOps.'
        }
      ]
      : isManager
        ? [
          ...baseNavItems,
          {
            path: '/team',
            label: 'Team',
            icon: <FaUsers />,
            description: 'Command your crew with staffing visibility, structure updates, and cross-functional coordination.'
          }
        ]
        : baseNavItems
  ), [baseNavItems, isAdmin, isManager]);

  useEffect(() => {
    if (!menuOpen) {
      setHoveredItem(null);
      return;
    }

    const currentItem = navItems.find((item) => item.path === location.pathname) ?? navItems[0] ?? null;
    setHoveredItem(currentItem);
  }, [location.pathname, menuOpen, navItems]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleAvatarClick = () => {
    setMenuOpen((prev) => !prev);
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

        {/* Right Controls */}
        <div className="header-controls">
          <div className="controls-desktop">
            <ThemeToggle />
          </div>

          <div className="header-utility-cluster">
            <React.Suspense fallback={<div>Loading...</div>}>
              <NotificationCenter />
            </React.Suspense>

            <div className="controls-mobile">
              <ThemeToggle />
            </div>
          </div>

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

            <button
              className={`mobile-menu-toggle ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={menuOpen}
              type="button"
            >
              <FaBars />
            </button>

            {menuOpen && (
              <div className="db-dropdown-menu">
                <div className="dropdown-shell-glow" />
                <div className="dropdown-header">
                  <div className="user-info">
                    <span className="user-kicker">Sentinel Command Grid</span>
                    <span className="dm-user-name">{user?.username}</span>
                    <span className="user-role">{user?.role?.toUpperCase()}</span>
                  </div>
                  <div className="user-status-orb" aria-hidden="true">
                    <FaSignal />
                  </div>
                </div>
                <div className="dropdown-hero">
                  <span className="dropdown-hero-label">Quick jump</span>
                  <p>Move through SentinelOps with live context, clearer intent, and a sharper command experience.</p>
                </div>
                <div
                  className={`menu-hover-panel ${hoveredItem ? 'visible' : ''}`}
                  aria-hidden={hoveredItem ? 'false' : 'true'}
                >
                  {hoveredItem && (
                    <>
                      <span className="menu-hover-kicker">Navigation Intel</span>
                      <div className="menu-hover-title-row">
                        <span className="menu-hover-icon">{hoveredItem.icon}</span>
                        <span className="menu-hover-title">{hoveredItem.label}</span>
                      </div>
                      <p className="menu-hover-copy">{hoveredItem.description}</p>
                    </>
                  )}
                </div>
                <div className="dropdown-body">
                  <nav className="dropdown-nav">
                    {navItems.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`dropdown-link ${location.pathname === item.path ? 'active' : ''}`}
                        onClick={() => setMenuOpen(false)}
                        onMouseEnter={() => setHoveredItem(item)}
                        onFocus={() => setHoveredItem(item)}
                      >
                        <span className="dropdown-link-icon">{item.icon}</span>
                        <span className="dropdown-link-copy">
                          <span className="dropdown-link-label">{item.label}</span>
                          <span className="dropdown-link-caption">
                            {location.pathname === item.path ? 'Current command view' : 'Open module'}
                          </span>
                        </span>
                        <span className="dropdown-link-intel" role="tooltip" aria-hidden="true">
                          <span className="intel-title">{item.label}</span>
                          <span className="intel-body">{item.description}</span>
                        </span>
                      </Link>
                    ))}
                  </nav>
                  <hr className="dropdown-divider" />
                  <div className="dropdown-actions">
                    <Link
                      to="/settings"
                      className="dropdown-link settings"
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="dropdown-link-icon"><FaUserCircle /></span>
                      <span className="dropdown-link-copy">
                        <span className="dropdown-link-label">Profile Settings</span>
                        <span className="dropdown-link-caption">Tune identity, preferences, and personal controls</span>
                      </span>
                      <span className="dropdown-link-intel" role="tooltip" aria-hidden="true">
                        <span className="intel-title">Profile Settings</span>
                        <span className="intel-body">Adjust the operator layer: your profile, visual preferences, and the way SentinelOps responds to you.</span>
                      </span>
                    </Link>
                    <button
                      className="logout-btn"
                      onClick={() => {
                        void logout();
                        setMenuOpen(false);
                      }}
                      type="button"
                    >
                      <span className="dropdown-link-icon"><FaShieldAlt /></span>
                      <span className="dropdown-link-copy">
                        <span className="dropdown-link-label">Logout</span>
                        <span className="dropdown-link-caption">Securely end this session</span>
                      </span>
                    </button>
                  </div>
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
