import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaBook,
  FaCalendarAlt,
  FaChartLine,
  FaClock,
  FaCompass,
  FaDatabase,
  FaIdBadge,
  FaPalette,
  FaShieldAlt,
  FaSignOutAlt,
  FaUserShield,
  FaUsers,
} from 'react-icons/fa';
import ThemeToggle from '../components/ui/ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useTheme } from '../contexts/ThemeContext';
import { DEFAULT_APPLICATION_TIMEZONE, isValidTimeZone } from '../utils/time';
import { orgApi } from '../services/orgApi';
import './ProfileSettingsPage.css';

const describeAccess = (role?: string) => {
  const normalizedRole = (role || '').toLowerCase();

  if (normalizedRole === 'admin') {
    return 'Platform owner lane. Access, placement, templates, and system settings affect every downstream workflow.';
  }

  if (normalizedRole === 'manager' || normalizedRole === 'supervisor') {
    return 'Leadership lane. Coverage, execution quality, and handover structure are your highest-leverage controls.';
  }

  return 'Operator lane. Keep execution clean, handovers accurate, and the live source of truth ready for the next shift.';
};

const ProfileSettingsSkeleton: React.FC = () => (
  <div className="profile-settings-page settings-skeleton-page">
    <section className="settings-command-strip settings-skel-panel">
      <div className="settings-skel-command-copy">
        <div className="settings-skel-line settings-skel-kicker" />
        <div className="settings-skel-line settings-skel-title" />
        <div className="settings-skel-line settings-skel-meta" />
      </div>
      <div className="settings-skel-signal-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="settings-skel-signal">
            <div className="settings-skel-block settings-skel-icon" />
            <div>
              <div className="settings-skel-line settings-skel-label" />
              <div className="settings-skel-line settings-skel-value" />
              <div className="settings-skel-line settings-skel-meta" />
            </div>
          </div>
        ))}
      </div>
    </section>

    <section className="profile-settings-layout">
      <aside className="settings-skel-panel settings-skeleton-identity">
        <div className="settings-skel-avatar" />
        <div className="settings-skel-line settings-skel-title" />
        <div className="settings-skel-line settings-skel-meta" />
        <div className="settings-skel-line settings-skel-meta short" />
      </aside>

      <div className="settings-workspace">
        {Array.from({ length: 4 }).map((_, index) => (
          <article key={index} className="settings-skel-panel">
            <div className="settings-panel-heading">
              <div className="settings-skel-block settings-skel-small-icon" />
              <div className="settings-skel-line settings-skel-panel-title" />
            </div>
            <div className="settings-skel-grid">
              <div className="settings-skel-tile" />
              <div className="settings-skel-tile" />
              <div className="settings-skel-tile" />
              <div className="settings-skel-tile" />
            </div>
          </article>
        ))}
      </div>
    </section>
  </div>
);

const ProfileSettingsPage: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const { applicationTimeZone, setting: timezoneSetting, updateApplicationTimeZone } = useAppConfig();
  const [sectionName, setSectionName] = useState<string>('');
  const [sectionLoading, setSectionLoading] = useState(Boolean(user?.section_id));
  const [timeZoneDraft, setTimeZoneDraft] = useState(applicationTimeZone);
  const [timeZoneBusy, setTimeZoneBusy] = useState(false);
  const [timeZoneMessage, setTimeZoneMessage] = useState<string | null>(null);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  const canManageTeam = ['admin', 'manager', 'supervisor'].includes(role);

  useEffect(() => {
    const loadSectionName = async () => {
      if (!user?.section_id) {
        setSectionName('');
        setSectionLoading(false);
        return;
      }

      setSectionLoading(true);
      try {
        const sections = await orgApi.listSections();
        const activeSection = sections.find((section) => section.id === user.section_id);
        setSectionName(activeSection?.section_name || '');
      } catch (error) {
        console.error('Failed to load section metadata for profile settings', error);
        setSectionName('');
      } finally {
        setSectionLoading(false);
      }
    };

    void loadSectionName();
  }, [user?.section_id]);

  useEffect(() => {
    setTimeZoneDraft(applicationTimeZone);
  }, [applicationTimeZone]);

  const initials = `${user?.first_name?.[0] ?? 'S'}${user?.last_name?.[0] ?? 'O'}`.toUpperCase();
  const displayName = `${user?.first_name || 'Sentinel'} ${user?.last_name || 'Operator'}`.trim();
  const activeSectionLabel = sectionName || user?.section_id || 'Not assigned';
  const timezoneUpdatedBy = timezoneSetting?.updated_by || 'Default';

  const quickLinks = useMemo(
    () =>
      [
        {
          title: 'My Schedule',
          description: 'Next assignment, open days, and shift timing.',
          to: '/schedule',
          icon: <FaCalendarAlt />,
          visible: true,
        },
        {
          title: 'Performance',
          description: 'Score signals, streaks, and team momentum.',
          to: '/performance',
          icon: <FaChartLine />,
          visible: true,
        },
        {
          title: 'Team Management',
          description: 'Coverage planning, patterns, and exceptions.',
          to: '/team',
          icon: <FaUsers />,
          visible: canManageTeam,
        },
        {
          title: 'User Management',
          description: 'Roles, placement, and access cleanup.',
          to: '/users',
          icon: <FaUserShield />,
          visible: isAdmin,
        },
        {
          title: 'SentinelOps Manual',
          description: 'Operating rules, checklist flow, and handover guidance.',
          to: '/manual',
          icon: <FaBook />,
          visible: true,
        },
      ].filter((item) => item.visible),
    [canManageTeam, isAdmin],
  );

  const settingsSignals = useMemo(
    () => [
      {
        label: 'Access lane',
        value: user?.role || 'User',
        detail: isAdmin ? 'Admin controls enabled' : canManageTeam ? 'Team controls enabled' : 'Operator controls',
        icon: <FaShieldAlt />,
        tone: isAdmin ? 'watch' : 'ok',
      },
      {
        label: 'Section',
        value: activeSectionLabel,
        detail: user?.department || 'Department pending',
        icon: <FaIdBadge />,
        tone: user?.section_id ? 'ok' : 'neutral',
      },
      {
        label: 'Clock',
        value: applicationTimeZone,
        detail: `Updated by ${timezoneUpdatedBy}`,
        icon: <FaClock />,
        tone: 'ok',
      },
      {
        label: 'Theme',
        value: resolvedTheme,
        detail: `Preference ${theme}`,
        icon: <FaPalette />,
        tone: 'neutral',
      },
    ],
    [activeSectionLabel, applicationTimeZone, canManageTeam, isAdmin, resolvedTheme, theme, timezoneUpdatedBy, user?.department, user?.role, user?.section_id],
  );

  const recommendedTimeZones = timezoneSetting?.recommended_timezones?.length
    ? timezoneSetting.recommended_timezones
    : [DEFAULT_APPLICATION_TIMEZONE, 'Africa/Johannesburg', 'UTC'];

  const saveApplicationTimezone = async () => {
    if (!isAdmin) {
      return;
    }
    const nextTimeZone = timeZoneDraft.trim();
    if (!isValidTimeZone(nextTimeZone)) {
      setTimeZoneMessage('Use a valid IANA timezone such as Africa/Harare or UTC.');
      return;
    }
    setTimeZoneBusy(true);
    setTimeZoneMessage(null);
    try {
      await updateApplicationTimeZone(nextTimeZone);
      setTimeZoneMessage(`Display timezone updated to ${nextTimeZone}.`);
    } catch (error: any) {
      setTimeZoneMessage(error?.response?.data?.detail || error?.message || 'Timezone update failed.');
    } finally {
      setTimeZoneBusy(false);
    }
  };

  if (authLoading || !user || sectionLoading) {
    return <ProfileSettingsSkeleton />;
  }

  return (
    <div className="profile-settings-page">
      <section className="settings-command-strip">
        <div className="settings-command-title">
          <span><FaCompass /> Operator settings</span>
          <strong>{displayName}</strong>
          <small>{user.email || user.username || 'Authenticated SentinelOps user'}</small>
        </div>

        <div className="settings-signal-grid">
          {settingsSignals.map((signal) => (
            <article key={signal.label} className={`settings-signal-card tone-${signal.tone}`}>
              <span className="settings-signal-icon">{signal.icon}</span>
              <span className="settings-signal-copy">
                <small>{signal.label}</small>
                <strong>{signal.value}</strong>
                <em>{signal.detail}</em>
              </span>
            </article>
          ))}
        </div>
      </section>

      <section className="profile-settings-layout">
        <aside className="settings-identity-panel">
          <div className="settings-avatar">{initials}</div>
          <div className="settings-identity-copy">
            <span>Signed in as</span>
            <strong>{displayName}</strong>
            <small>@{user.username}</small>
          </div>

          <div className="settings-identity-ledger">
            <div>
              <label>Department</label>
              <strong>{user.department || 'Not assigned'}</strong>
            </div>
            <div>
              <label>Position</label>
              <strong>{user.position || 'Not assigned'}</strong>
            </div>
            <div>
              <label>Section</label>
              <strong>{activeSectionLabel}</strong>
            </div>
          </div>

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
        </aside>

        <div className="settings-workspace">
          <article className="settings-panel access-panel">
            <div className="settings-panel-heading">
              <FaShieldAlt />
              <span>Access Posture</span>
            </div>
            <p className="settings-panel-copy">{describeAccess(user.role)}</p>
            <div className="settings-lane-list">
              <div>
                <label>Current lane</label>
                <strong>{user.role || 'User'}</strong>
              </div>
              <div>
                <label>Team controls</label>
                <strong>{canManageTeam ? 'Available' : 'Restricted'}</strong>
              </div>
              <div>
                <label>Platform controls</label>
                <strong>{isAdmin ? 'Available' : 'Restricted'}</strong>
              </div>
            </div>
          </article>

          <article className="settings-panel">
            <div className="settings-panel-heading">
              <FaPalette />
              <span>Appearance</span>
            </div>
            <div className="settings-control-row">
              <div>
                <label>Visual mode</label>
                <strong>{resolvedTheme}</strong>
                <small>Preference: {theme}</small>
              </div>
              <ThemeToggle />
            </div>
          </article>

          <article className="settings-panel timezone-panel">
            <div className="settings-panel-heading">
              <FaClock />
              <span>Application Clock</span>
            </div>
            <p className="settings-panel-copy">
              Operational timestamps render in the application timezone. UTC remains the storage baseline.
            </p>

            <div className="settings-timezone-control">
              <label>
                <span>Display timezone</span>
                <input
                  list="sentinelops-timezone-options"
                  value={timeZoneDraft}
                  onChange={(event) => setTimeZoneDraft(event.target.value)}
                  disabled={!isAdmin}
                  placeholder="Africa/Harare"
                />
                <datalist id="sentinelops-timezone-options">
                  {recommendedTimeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone} />
                  ))}
                </datalist>
              </label>

              <div className="settings-lane-list compact">
                <div>
                  <label>Current display</label>
                  <strong>{applicationTimeZone}</strong>
                </div>
                <div>
                  <label>Last updated</label>
                  <strong>{timezoneUpdatedBy}</strong>
                </div>
              </div>

              {isAdmin ? (
                <button type="button" className="settings-save-btn" onClick={() => void saveApplicationTimezone()} disabled={timeZoneBusy}>
                  {timeZoneBusy ? 'Saving timezone...' : 'Save timezone'}
                </button>
              ) : (
                <span className="settings-readonly-note">Only administrators can change the application timezone.</span>
              )}
              {timeZoneMessage ? <p className="settings-timezone-message">{timeZoneMessage}</p> : null}
            </div>
          </article>

          <article className="settings-panel quick-return-panel">
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

          <section className="settings-footer-panel">
            <div>
              <span className="settings-footer-kicker"><FaDatabase /> Control discipline</span>
              <strong>Keep identity, clock, and access aligned with the live operation.</strong>
            </div>
            <Link to="/manual" className="settings-footer-link">
              <FaBook />
              <span>Open Manual</span>
            </Link>
          </section>
        </div>
      </section>
    </div>
  );
};

export default ProfileSettingsPage;
