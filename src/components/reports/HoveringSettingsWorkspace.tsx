import React, { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FaCheck,
  FaCog,
  FaExclamationTriangle,
  FaFingerprint,
  FaHistory,
  FaKey,
  FaLock,
  FaSave,
  FaSyncAlt,
  FaTimes,
  FaUserShield,
} from 'react-icons/fa';
import { useNotifications } from '../../contexts/NotificationContext';
import reportsApi, {
  HoveringGeneralConfiguration,
  HoveringRobotSetting,
  HoveringSettingsOverview,
} from '../../services/reportsApi';

interface HoveringSettingsWorkspaceProps {
  isAdmin: boolean;
  refreshNonce: number;
}

const dateTime = (value?: string | null) => {
  if (!value) return 'No rotation recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const readError = (error: unknown) => {
  const candidate = error as { response?: { data?: { detail?: string } }; message?: string };
  return candidate.response?.data?.detail || candidate.message || 'Robot controls are temporarily unavailable.';
};

const labelFor = (key: string) => key
  .toLowerCase()
  .split('_')
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const HoveringSettingsSkeleton: React.FC = () => (
  <div className="hovering-settings-skeleton" aria-label="Loading robot controls">
    <span /><span /><span /><span />
  </div>
);

const HoveringSettingsWorkspace: React.FC<HoveringSettingsWorkspaceProps> = ({ isAdmin, refreshNonce }) => {
  const { addNotification } = useNotifications();
  const [overview, setOverview] = useState<HoveringSettingsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<HoveringRobotSetting | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [configurationDrafts, setConfigurationDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const payload = await reportsApi.getHoveringSettings();
      setOverview(payload);
      setConfigurationDrafts(Object.fromEntries(payload.configurations.map((item) => [item.key, item.value])));
      setError(null);
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshNonce]);

  const closeRotation = () => {
    if (busy) return;
    setSelectedRobot(null);
    setPassword('');
    setConfirmation('');
  };

  const rotatePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedRobot || !password || password !== confirmation) return;
    setBusy(`robot-${selectedRobot.key}`);
    try {
      await reportsApi.rotateHoveringRobotPassword(selectedRobot.key, password);
      addNotification({
        type: 'success',
        message: `${selectedRobot.key} authentication was rotated and sealed in custody.`,
        priority: 'high',
      });
      setSelectedRobot(null);
      setPassword('');
      setConfirmation('');
      await load(true);
    } catch (rotationError) {
      const message = readError(rotationError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setBusy(null);
    }
  };

  const saveConfiguration = async (configuration: HoveringGeneralConfiguration) => {
    const nextValue = configurationDrafts[configuration.key] ?? '';
    if (nextValue === configuration.value) return;
    setBusy(`configuration-${configuration.key}`);
    try {
      await reportsApi.updateHoveringConfiguration(configuration.key, nextValue);
      addNotification({
        type: 'success',
        message: `${labelFor(configuration.key)} was updated.`,
        priority: 'medium',
      });
      await load(true);
    } catch (configurationError) {
      const message = readError(configurationError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setBusy(null);
    }
  };

  const recentByRobot = useMemo(() => new Map(
    (overview?.recent_actions || [])
      .filter((action) => action.setting_kind === 'ROBOT_PASSWORD' && action.status === 'COMPLETED')
      .map((action) => [action.setting_key, action]),
  ), [overview]);

  if (loading && !overview) return <HoveringSettingsSkeleton />;

  return (
    <section className="hovering-settings-workspace">
      {error ? (
        <div className="reports-error hovering-error">
          <FaExclamationTriangle />
          <span><strong>Robot control needs attention</strong><small>{error}</small></span>
          <button type="button" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      <header className="hovering-settings-command">
        <div>
          <span><FaUserShield /> Robot authentication custody</span>
          <h2>Capture identities without exposing credentials</h2>
          <p>{overview?.robots.length || 0} configured robot users / protected encryption handoff</p>
        </div>
        <div className={`hovering-encryption-posture ${overview?.encryption_configured ? 'ready' : 'blocked'}`}>
          {overview?.encryption_configured ? <FaCheck /> : <FaLock />}
          <span><small>Encryption lane</small><strong>{overview?.encryption_configured ? 'Ready' : 'Not configured'}</strong></span>
        </div>
      </header>

      <div className={`hovering-settings-grid ${isAdmin ? '' : 'credentials-only'}`}>
        <section className="hovering-robot-roster">
          <header><span><FaFingerprint /> Capture identities</span><em>{overview?.robots.length || 0}</em></header>
          <div>
            {overview?.robots.map((robot) => {
              const action = recentByRobot.get(robot.key);
              return (
                <article key={robot.id}>
                  <i><FaKey /></i>
                  <span><small>Core capture user</small><strong>{robot.key}</strong><time>{action ? `Rotated ${dateTime(action.created_at)}` : `Source updated ${dateTime(robot.updated)}`}</time></span>
                  <em className={robot.credential_configured ? 'ready' : 'missing'}>{robot.credential_configured ? 'Configured' : 'Missing'}</em>
                  <button type="button" onClick={() => setSelectedRobot(robot)} disabled={!overview?.encryption_configured || Boolean(busy)} title={`Rotate ${robot.key} password`}><FaKey /> Rotate</button>
                </article>
              );
            })}
            {!overview?.robots.length ? <p className="hovering-settings-empty">No active ROBHOV identities were returned by txn-bot.</p> : null}
          </div>
        </section>

        {isAdmin ? (
          <section className="hovering-general-configurations">
            <header><span><FaCog /> General controls</span><em>Admin</em></header>
            <div>
              {overview?.configurations.map((configuration) => {
                const changed = (configurationDrafts[configuration.key] ?? '') !== configuration.value;
                const saving = busy === `configuration-${configuration.key}`;
                return (
                  <label key={configuration.id}>
                    <span><small>{configuration.key}</small><strong>{labelFor(configuration.key)}</strong><time>Updated {dateTime(configuration.updated)}</time></span>
                    <input value={configurationDrafts[configuration.key] ?? ''} maxLength={255} onChange={(event) => setConfigurationDrafts((current) => ({ ...current, [configuration.key]: event.target.value }))} />
                    <button type="button" disabled={!changed || Boolean(busy)} onClick={() => void saveConfiguration(configuration)} title={`Save ${labelFor(configuration.key)}`}>{saving ? <FaSyncAlt className="spin" /> : <FaSave />}</button>
                  </label>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <section className="hovering-setting-custody">
        <header><span><FaHistory /> Setting custody</span><em>No values retained</em></header>
        <div>
          {overview?.recent_actions.map((action) => (
            <article key={action.action_id} className={`status-${action.status.toLowerCase()}`}>
              <i>{action.setting_kind === 'ROBOT_PASSWORD' ? <FaKey /> : <FaCog />}</i>
              <span><small>{action.setting_kind === 'ROBOT_PASSWORD' ? 'Credential rotation' : 'Configuration change'}</small><strong>{action.setting_key}</strong></span>
              <span><small>{action.actor}</small><time>{dateTime(action.created_at)}</time></span>
              <em>{action.status}</em>
            </article>
          ))}
          {!overview?.recent_actions.length ? <p className="hovering-settings-empty">The first controlled setting change will begin this trail.</p> : null}
        </div>
      </section>

      {selectedRobot ? (
        <div className="hovering-credential-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeRotation()}>
          <form className="hovering-credential-dialog" role="dialog" aria-modal="true" aria-labelledby="hovering-credential-title" onSubmit={rotatePassword}>
            <header><span><FaKey /> Credential rotation</span><button type="button" onClick={closeRotation} title="Close credential rotation"><FaTimes /></button></header>
            <div className="hovering-credential-identity"><small>Core capture user</small><h2 id="hovering-credential-title">{selectedRobot.key}</h2><p>Encryption handoff ready</p></div>
            <label><span>New core-system password</span><input type="password" value={password} maxLength={255} autoComplete="new-password" onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
            <label><span>Confirm password</span><input type="password" value={confirmation} maxLength={255} autoComplete="new-password" onChange={(event) => setConfirmation(event.target.value)} /></label>
            {confirmation && password !== confirmation ? <p className="hovering-password-mismatch"><FaExclamationTriangle /> Passwords do not match.</p> : null}
            <div className="hovering-password-boundary"><FaLock /><span><strong>Protected handoff</strong><small>The current hash is never displayed and the replacement password is not retained by SentinelOps.</small></span></div>
            <footer><button type="button" onClick={closeRotation}>Cancel</button><button type="submit" className="primary" disabled={!password || password !== confirmation || Boolean(busy)}>{busy ? <FaSyncAlt className="spin" /> : <FaKey />} Encrypt and rotate</button></footer>
          </form>
        </div>
      ) : null}
    </section>
  );
};

export default HoveringSettingsWorkspace;
