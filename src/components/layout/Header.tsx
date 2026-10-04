import { useAccess } from '../../contexts/AccessContext';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  FaArrowDown,
  FaBars,
  FaBook,
  FaBalanceScale,
  FaBroadcastTower,
  FaClipboardList,
  FaFileCsv,
  FaRoute,
  FaShieldAlt,
  FaTimes,
  FaTasks,
  FaTachometerAlt,
  FaUserCircle,
  FaUsers,
  FaUserShield,
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationCenter from '../notifications/NotificationCenter';
import SentinelMark from './SentinelMark';
import './Header.css';

interface MenuItem {
  id: string;
  path?: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  caption: string;
  activeCaption?: string;
  matchPrefixes?: string[];
}

interface MenuShellConfig {
  className: string;
  headerKicker: string;
  heroLabel: string;
  heroCopy: string;

}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const { canAccessPage } = useAccess();
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isManager = ['admin', 'manager', 'supervisor'].includes((user?.role || '').toLowerCase());

  const isActiveItem = (item: MenuItem) => {
    if (!item.path) return false;
    if (item.path === '/') return location.pathname === '/';
    if (location.pathname === item.path) return true;
    return item.matchPrefixes?.some((prefix) => location.pathname.startsWith(prefix)) ?? false;
  };

  const baseNavItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'dashboard',
        path: '/',
        label: 'Dashboard',
        icon: <FaTachometerAlt />,
        description: 'Live mission overview with the pulse of active operations, system health, and critical momentum.',
        caption: 'Open module',
        activeCaption: 'Current command view',
      },
      {
        id: 'checklists',
        path: '/checklists',
        label: 'Checklists',
        icon: <FaClipboardList />,
        description: 'Execution playbooks for shift handovers, task precision, and keeping every operator perfectly aligned.',
        caption: 'Open module',
        activeCaption: 'Current command view',
        matchPrefixes: ['/checklists', '/checklist/'],
      },
      {
        id: 'tasks',
        path: '/tasks',
        label: 'Task Center',
        icon: <FaTasks />,
        description: 'Your tactical queue for assignments, progress tracking, and the next high-impact move across the board.',
        caption: 'Open module',
        activeCaption: 'Current command view',
      },
      {
        id: 'trustlink',
        path: '/trustlink',
        label: 'Trustlink Ops',
        icon: <FaShieldAlt />,
        description: 'Security-focused operations space for trust workflows, controlled actions, and resilient oversight.',
        caption: 'Open module',
        activeCaption: 'Current command view',
      },
      {
        id: 'nexus',
        path: '/nexus',
        label: 'Sentinel Nexus',
        icon: <FaBroadcastTower />,
        description: 'Incident intelligence deck for graph-aware correlation, log evidence, ranked causes, and controlled action approval.',
        caption: 'Open module',
        activeCaption: 'Current command view',
      },
      {
        id: 'funds-custody',
        path: '/funds-custody',
        label: 'Funds Custody',
        icon: <FaBalanceScale />,
        description: 'Controlled unauthorized-debit evidence, maker-checker custody, guarded execution, and immutable financial audit.',
        caption: 'Open custody workspace',
        activeCaption: 'Current custody view',
      },
      {
        id: 'reports',
        path: '/reports',
        label: 'Reports',
        icon: <FaFileCsv />,
        description: 'Controlled regulatory extracts, scheduled delivery, same-day artifact custody, and accountable reruns.',
        caption: 'Open reporting workspace',
        activeCaption: 'Current reporting view',
      },
    ],
    [],
  );

  const navItems: MenuItem[] = useMemo(() => baseNavItems.filter(item => !item.path || canAccessPage(item.path)), [baseNavItems, canAccessPage]);

  const profileItems: MenuItem[] = useMemo(
    () => [
      {
        id: 'settings',
        path: '/settings',
        label: 'Profile Settings',
        icon: <FaUserCircle />,
        description: 'Tune identity, access posture, appearance, and the quickest return paths into your daily workspace.',
        caption: 'Open personal controls',
        activeCaption: 'Current user hub',
      },
      {
        id: 'manual',
        path: '/manual',
        label: 'SentinelOps Manual',
        icon: <FaBook />,
        description: 'A guided operator manual with visual landmarks, checklist flow, exception rules, handover guidance, and a downloadable PDF.',
        caption: 'Open the user manual',
        activeCaption: 'Manual is open',
      },
      {
        id: 'schedule',
        path: '/schedule',
        label: 'Schedule',
        icon: <FaRoute />,
        description: 'Check your next assignments, recovery windows, open days, and the dates that deserve your attention first.',
        caption: 'Review your upcoming load',
        activeCaption: 'Current schedule view',
      },
      ...(isManager
        ? [
            {
              id: 'team',
              path: '/team',
              label: 'Team Management',
              icon: <FaUsers />,
              description: 'Shape coverage, apply patterns, handle exceptions, and rebalance the team without leaving the account menu.',
              caption: 'Plan coverage and patterns',
              activeCaption: 'Current team view',
            } satisfies MenuItem,
          ]
        : []),
      ...(isAdmin
        ? [
            {
              id: 'access',
              path: '/access',
              label: 'Section & Module Access',
              icon: <FaUserShield />,
              description: 'Assign shared workspaces to sections and inspect effective access.',
              caption: 'Manage section access',
              activeCaption: 'Current access workspace',
            } satisfies MenuItem,
            {
              id: 'users',
              path: '/users',
              label: 'User Management',
              icon: <FaUserShield />,
              description: 'Manage accounts, roles, placement, and access whenever the people structure needs to change.',
              caption: 'Manage roles and access',
              activeCaption: 'Current admin view',
            } satisfies MenuItem,
          ]
        : []),
    ].filter(item => canAccessPage(item.path)),
    [isAdmin, isManager, canAccessPage],
  );

  useEffect(() => {
    const detectStandalone = () => {
      const standaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

      setIsStandalone(standaloneMode);
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      detectStandalone();
    };

    detectStandalone();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setNavMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavMenuOpen(false);
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const closeMenus = () => {
    setNavMenuOpen(false);
    setProfileMenuOpen(false);
  };

  const handleAvatarClick = () => {
    setProfileMenuOpen((previous) => {
      const next = !previous;
      setNavMenuOpen(false);
      return next;
    });
  };

  const handleNavMenuClick = () => {
    setNavMenuOpen((previous) => {
      const next = !previous;
      setProfileMenuOpen(false);
      return next;
    });
  };

  const handleInstallApp = async () => {
    if (!deferredInstallPrompt) {
      return;
    }

    await deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;

    if (outcome === 'accepted') {
      setDeferredInstallPrompt(null);
    }
  };

  const renderMenuItem = (item: MenuItem) => (
    <Link
      key={item.id}
      to={item.path || '/'}
      className={`dropdown-link ${isActiveItem(item) ? 'active' : ''}`}
      onClick={closeMenus}
    >
      <span className="dropdown-link-icon">{item.icon}</span>
      <span className="dropdown-link-copy">
        <span className="dropdown-link-label">{item.label}</span>
        <span className="dropdown-link-caption">
          {isActiveItem(item) ? item.activeCaption || item.caption : item.caption}
        </span>
      </span>
    </Link>
  );

  const renderDropdownMenu = (
    items: MenuItem[],
    config: MenuShellConfig,
    includeLogoutAction = false,
  ) => (
    <div className={`db-dropdown-menu ${config.className}`}>
      <div className="dropdown-shell-glow" />
      <div className="dropdown-header">
        <div className="user-info">
          <span className="user-kicker">{config.headerKicker}</span>
          <span className="dm-user-name">{user?.username}</span>
          <span className="user-role">{user?.role?.toUpperCase()}</span>
        </div>
        <button className="shell-menu-close" type="button" onClick={closeMenus} aria-label="Close menu"><FaTimes /></button>
      </div>

      <div className="dropdown-hero">
        <span className="dropdown-hero-label">{config.heroLabel}</span>
        <p>{config.heroCopy}</p>
      </div>

      <div className="dropdown-body">
        <nav className="dropdown-nav">{items.map(renderMenuItem)}</nav>

        {includeLogoutAction && (
          <>
            <hr className="dropdown-divider" />
            <div className="dropdown-actions">
              <button
                className="logout-btn"
                onClick={() => {
                  void logout();
                  closeMenus();
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
          </>
        )}
      </div>
    </div>
  );

  return (
    <header className="app-header">
      <div className="header-container">
        <div className="header-brand">
          <Link className="brand-wrapper" to="/" aria-label="SentinelOps home" onClick={closeMenus}>
            <SentinelMark />
            <div className="brand-text">
              <span className="brand-primary">Sentinel</span>
              <span className="brand-secondary">Ops</span>
            </div>
          </Link>
        </div>

        <div className="header-controls">
          <div className="controls-desktop">
            <ThemeToggle />
          </div>

          <div className="header-utility-cluster">
            {!isStandalone && deferredInstallPrompt ? (
              <button
                type="button"
                className="install-app-btn"
                onClick={() => {
                  void handleInstallApp();
                }}
                aria-label="Install SentinelOps"
              >
                <FaArrowDown />
                <span>Install App</span>
              </button>
            ) : null}

            <React.Suspense fallback={<div>Loading...</div>}>
              <NotificationCenter />
            </React.Suspense>

            <div className="controls-mobile">
              <ThemeToggle />
            </div>
          </div>

          <div className="user-menu" ref={menuRef}>
            <div className="menu-shell profile-menu-shell">
              <button
                className={`user-avatar-btn ${profileMenuOpen ? 'active' : ''}`}
                onClick={handleAvatarClick}
                aria-label="User menu"
                aria-expanded={profileMenuOpen}
                title={user?.username || 'User'}
                type="button"
              >
                {user ? (
                  <div className="avatar-initials">
                    {user.first_name?.[0] ?? 'U'}
                    {user.last_name?.[0] ?? ''}
                  </div>
                ) : (
                  <FaUserCircle />
                )}
              </button>

              {profileMenuOpen &&
                renderDropdownMenu(profileItems, {
                  className: 'profile-dropdown-menu',
                  headerKicker: 'Operator Access Layer',
                  heroLabel: 'User features',
                  heroCopy:
                    'Your tools, people, and workspace access.',
                }, true)}
            </div>

            <div className="menu-shell nav-menu-shell">
              <button
                className={`mobile-menu-toggle ${navMenuOpen ? 'active' : ''}`}
                onClick={handleNavMenuClick}
                aria-label="Toggle navigation menu"
                aria-expanded={navMenuOpen}
                type="button"
              >
                <FaBars />
              </button>

              {navMenuOpen &&
                renderDropdownMenu(navItems, {
                  className: 'nav-dropdown-menu',
                  headerKicker: 'Sentinel Command Grid',
                  heroLabel: 'Quick jump',
                  heroCopy:
                    'Choose a workspace. Pick up where it matters.',
                })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
