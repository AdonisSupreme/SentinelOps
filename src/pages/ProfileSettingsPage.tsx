import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBook,
  FaCalendarAlt,
  FaCompass,
  FaIdBadge,
  FaShieldAlt,
  FaSignOutAlt,
  FaUsers,
  FaUserShield,
} from 'react-icons/fa';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { orgApi } from '../services/orgApi';
import { SECTION_MANUAL_ID } from '../content/sentinelManual';
import './ProfileSettingsPage.css';

const describeAccess = (role?: string) => {
  const normalizedRole = (role || '').toLowerCase();

  if (normalizedRole === 'admin') {
    return 'You can move across SentinelOps as a platform owner. Use that reach carefully: access, coverage, user placement, and template quality all cascade downstream.';
  }

  if (normalizedRole === 'manager' || normalizedRole === 'supervisor') {
    return 'You are operating in a leadership lane. Your best leverage comes from shaping coverage, cleaning execution flows, and turning weak repeat work into stronger structure.';
  }

  return 'You are working in the operator lane. Your highest value is clean execution, accurate handover, and keeping the live source of truth trustworthy for the next person.';
};

const ProfileSettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const [sectionName, setSectionName] = useState<string>('');

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const canManageTeam = ['admin', 'manager', 'supervisor'].includes(role);
  const hasSectionManual = user?.section_id === SECTION_MANUAL_ID;

  useEffect(() => {
    const loadSectionName = async () => {
      if (!user?.section_id) {
        setSectionName('');
        return;
      }

      try {
        const sections = await orgApi.listSections();
        const activeSection = sections.find((section) => section.id === user.section_id);
        setSectionName(activeSection?.section_name || '');
      } catch (error) {
        console.error('Failed to load section metadata for profile settings', error);
        setSectionName('');
      }
    };

    void loadSectionName();
  }, [user?.section_id]);

  const initials = `${user?.first_name?.[0] ?? 'S'}${user?.last_name?.[0] ?? 'O'}`.toUpperCase();

  const quickLinks = useMemo(
    () =>
      [
        {
          title: 'My Schedule',
          description: 'Confirm your next assignment, open days, and near-term deadlines before the shift starts moving.',
          to: '/schedule',
          icon: <FaCalendarAlt />,
          visible: true,
        },
        {
          title: 'Team Management',
          description: 'Jump straight into coverage planning, patterns, and exception handling when the roster needs attention.',
          to: '/team',
          icon: <FaUsers />,
          visible: canManageTeam,
        },
        {
          title: 'User Management',
          description: 'Open the identity control room for roles, placement, and access cleanup.',
          to: '/users',
          icon: <FaUserShield />,
          visible: isAdmin,
        },
        {
          title: 'SentinelOps Manual',
          description: 'Open the section playbook for the fastest way to work the platform with confidence.',
          to: '/manual',
          icon: <FaBook />,
          visible: hasSectionManual,
        },
      ].filter((item) => item.visible),
    [canManageTeam, hasSectionManual, isAdmin],
  );

  return (
    <div className="profile-settings-page">
      <section className="profile-settings-hero">
        <div className="profile-settings-copy">
          <span className="profile-settings-eyebrow">Operator Settings</span>
          <h1>Profile and command preferences</h1>
          <p>
            This is your control layer for identity context, access posture, visual mode, and the
            fastest paths back into the parts of SentinelOps you use most.
          </p>

          <div className="profile-settings-badges">
            <span>Role: {user?.role || 'User'}</span>
            <span>Theme: {theme} ({resolvedTheme})</span>
            {user?.section_id && <span>Section: {sectionName || user.section_id}</span>}
          </div>
        </div>

        <aside className="profile-identity-hero-card">
          <div className="profile-identity-avatar">{initials}</div>
          <div className="profile-identity-summary">
            <strong>
              {user?.first_name} {user?.last_name}
            </strong>
            <span>@{user?.username}</span>
            <small>{user?.email}</small>
          </div>
        </aside>
      </section>

      <section className="profile-settings-grid">
        <article className="settings-panel">
          <div className="settings-panel-heading">
            <FaIdBadge />
            <span>Identity Snapshot</span>
          </div>

          <div className="settings-stat-grid">
            <div className="settings-stat-card">
              <label>Department</label>
              <strong>{user?.department || 'Not assigned'}</strong>
            </div>
            <div className="settings-stat-card">
              <label>Position</label>
              <strong>{user?.position || 'Not assigned'}</strong>
            </div>
            <div className="settings-stat-card">
              <label>Section</label>
              <strong>{sectionName || user?.section_id || 'Not assigned'}</strong>
            </div>
            <div className="settings-stat-card">
              <label>Username</label>
              <strong>{user?.username || 'Unavailable'}</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel">
          <div className="settings-panel-heading">
            <FaShieldAlt />
            <span>Access Posture</span>
          </div>

          <p className="settings-panel-copy">{describeAccess(user?.role)}</p>

          <div className="settings-highlight-list">
            <div>
              <label>Current lane</label>
              <strong>{user?.role || 'User'}</strong>
            </div>
            <div>
              <label>Manual availability</label>
              <strong>{hasSectionManual ? 'Published for your section' : 'Not available for your section'}</strong>
            </div>
            <div>
              <label>Control rule</label>
              <strong>Fix the source, not the symptom</strong>
            </div>
          </div>
        </article>

        <article className="settings-panel">
          <div className="settings-panel-heading">
            <FaCompass />
            <span>Appearance and Focus</span>
          </div>

          <p className="settings-panel-copy">
            Switch the visual mode when you need clearer contrast for long sessions, bright-room
            readability, or a cleaner handover environment during shared-screen work.
          </p>

          <div className="settings-theme-toggle">
            <ThemeToggle />
          </div>
        </article>

        <article className="settings-panel">
          <div className="settings-panel-heading">
            <FaArrowRight />
            <span>Quick Returns</span>
          </div>

          <div className="settings-link-grid">
            {quickLinks.map((item) => (
              <Link key={item.to} to={item.to} className="settings-quick-link">
                <span className="settings-quick-link-icon">{item.icon}</span>
                <span className="settings-quick-link-copy">
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
                <FaArrowRight />
              </Link>
            ))}
          </div>
        </article>
      </section>

      <section className="settings-footer-panel">
        <div className="settings-footer-copy">
          <span className="profile-settings-eyebrow">Operational Discipline</span>
          <h2>Keep your profile aligned to the real operation</h2>
          <p>
            Role, section placement, and visual mode are not cosmetic here. They shape what you can
            see, how fast you can navigate, and whether the platform is helping you work cleanly.
          </p>
        </div>

        <div className="settings-footer-actions">
          {hasSectionManual && (
            <Link to="/manual" className="settings-footer-link">
              <FaBook />
              <span>Open SentinelOps Manual</span>
            </Link>
          )}

          <button
            type="button"
            className="settings-signout-btn"
            onClick={() => {
              void logout();
            }}
          >
            <FaSignOutAlt />
            <span>Sign out securely</span>
          </button>
        </div>
      </section>
    </div>
  );
};

export default ProfileSettingsPage;
