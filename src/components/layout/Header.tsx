import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  FaArrowDown,
  FaBars,
  FaBook,
  FaBroadcastTower,
  FaClipboardList,
  FaRoute,
  FaShieldAlt,
  FaSignal,
  FaTasks,
  FaTachometerAlt,
  FaUserCircle,
  FaUsers,
  FaUserShield,
} from 'react-icons/fa';
import { useAuth } from '../../contexts/AuthContext';
import { SECTION_MANUAL_ID } from '../../content/sentinelManual';
import ThemeToggle from '../ui/ThemeToggle';
import NotificationCenter from '../notifications/NotificationCenter';
import Logo from '../../logo.png';
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
  hoverKicker: string;
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
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [hoveredNavItem, setHoveredNavItem] = useState<MenuItem | null>(null);
  const [hoveredProfileItem, setHoveredProfileItem] = useState<MenuItem | null>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role?.toLowerCase() === 'admin';
  const isManager = ['admin', 'manager', 'supervisor'].includes((user?.role || '').toLowerCase());
  const hasNexusAccess = user?.section_id === SECTION_MANUAL_ID;

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
    ],
    [],
  );

  const navItems: MenuItem[] = useMemo(
    () => baseNavItems.filter((item) => item.id !== 'nexus' || hasNexusAccess),
    [baseNavItems, hasNexusAccess],
  );

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
    ],
    [isAdmin, isManager],
  );

  useEffect(() => {
    if (!navMenuOpen) {
      setHoveredNavItem(null);
      return;
    }

    const currentItem = navItems.find((item) => isActiveItem(item)) ?? navItems[0] ?? null;
    setHoveredNavItem(currentItem);
  }, [location.pathname, navItems, navMenuOpen]);

  useEffect(() => {
    if (!profileMenuOpen) {
      setHoveredProfileItem(null);
      return;
    }

    const currentItem = profileItems.find((item) => isActiveItem(item)) ?? profileItems[0] ?? null;
    setHoveredProfileItem(currentItem);
  }, [location.pathname, profileItems, profileMenuOpen]);

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

  const renderMenuItem = (item: MenuItem, hoveredItemSetter: React.Dispatch<React.SetStateAction<MenuItem | null>>) => (
    <Link
      key={item.id}
      to={item.path || '/'}
      className={`dropdown-link ${isActiveItem(item) ? 'active' : ''}`}
      onClick={closeMenus}
      onMouseEnter={() => hoveredItemSetter(item)}
      onFocus={() => hoveredItemSetter(item)}
    >
      <span className="dropdown-link-icon">{item.icon}</span>
      <span className="dropdown-link-copy">
        <span className="dropdown-link-label">{item.label}</span>
        <span className="dropdown-link-caption">
          {isActiveItem(item) ? item.activeCaption || item.caption : item.caption}
        </span>
      </span>
      <span className="dropdown-link-intel" role="tooltip" aria-hidden="true">
        <span className="intel-title">{item.label}</span>
        <span className="intel-body">{item.description}</span>
      </span>
    </Link>
  );

  const renderDropdownMenu = (
    items: MenuItem[],
    hoveredItem: MenuItem | null,
    hoveredItemSetter: React.Dispatch<React.SetStateAction<MenuItem | null>>,
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
        <div className="user-status-orb" aria-hidden="true">
          <FaSignal />
        </div>
      </div>

      <div className="dropdown-hero">
        <span className="dropdown-hero-label">{config.heroLabel}</span>
        <p>{config.heroCopy}</p>
      </div>

      <div
        className={`menu-hover-panel ${hoveredItem ? 'visible' : ''}`}
        aria-hidden={hoveredItem ? 'false' : 'true'}
      >
        {hoveredItem && (
          <>
            <span className="menu-hover-kicker">{config.hoverKicker}</span>
            <div className="menu-hover-title-row">
              <span className="menu-hover-icon">{hoveredItem.icon}</span>
              <span className="menu-hover-title">{hoveredItem.label}</span>
            </div>
            <p className="menu-hover-copy">{hoveredItem.description}</p>
          </>
        )}
      </div>

      <div className="dropdown-body">
        <nav className="dropdown-nav">{items.map((item) => renderMenuItem(item, hoveredItemSetter))}</nav>

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
          <div className="brand-wrapper" onClick={() => navigate('/')}>
            <img src={Logo} alt="SentinelOps" className="header-logo" />
            <div className="brand-text">
              <span className="brand-primary">SENTINEL</span>
              <span className="brand-secondary">OPS</span>
            </div>
          </div>
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
                renderDropdownMenu(profileItems, hoveredProfileItem, setHoveredProfileItem, {
                  className: 'profile-dropdown-menu',
                  headerKicker: 'Operator Access Layer',
                  heroLabel: 'User features',
                  heroCopy:
                    'Open your personal tools, schedule, management surfaces, and section playbook without disturbing the main command menu.',
                  hoverKicker: 'Feature Intel',
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
                renderDropdownMenu(navItems, hoveredNavItem, setHoveredNavItem, {
                  className: 'nav-dropdown-menu',
                  headerKicker: 'Sentinel Command Grid',
                  heroLabel: 'Quick jump',
                  heroCopy:
                    'Move through SentinelOps with live context, clearer intent, and a sharper command experience.',
                  hoverKicker: 'Navigation Intel',
                })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
