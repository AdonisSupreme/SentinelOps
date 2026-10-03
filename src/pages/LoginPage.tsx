import React, { useMemo, useState } from 'react';
import {
  FaArrowRight,
  FaEnvelope,
  FaEye,
  FaEyeSlash,
  FaLock,
  FaSatelliteDish,
  FaShieldAlt,
  FaSyncAlt
} from 'react-icons/fa';
import { useAuth } from '../contexts/AuthContext';
import '../styles/LoginPage.css';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, adAvailability, refreshAdAvailability } = useAuth();

  const adStatusLabel = useMemo(() => {
    if (adAvailability === 'checking') return 'Checking';
    if (adAvailability === 'available') return 'Online';
    return 'Offline';
  }, [adAvailability]);

  const adStatusClass = useMemo(() => {
    if (adAvailability === 'checking') return 'status-checking';
    if (adAvailability === 'available') return 'status-online';
    return 'status-offline';
  }, [adAvailability]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (err: any) {
      const responseMessage = err?.response?.data?.message || err?.response?.data?.detail;
      const authSource = err?.response?.data?.context?.source;
      if (responseMessage) {
        setError(authSource ? `${responseMessage} (${authSource})` : responseMessage);
      } else if (err?.status === 401 || err?.response?.status === 401) {
        setError('Invalid email or password.');
      } else if (err?.message?.toLowerCase?.().includes('network')) {
        setError('Network issue detected. Please retry.');
      } else {
        setError(err?.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-shell">
      <div className="login-backdrop-grid" aria-hidden="true" />
      <div className="login-orb login-orb-a" aria-hidden="true" />
      <div className="login-orb login-orb-b" aria-hidden="true" />

      <section className="sops-login-panel">
        <aside className="sops-login-intel">
          <span className="sops-intel-kicker">Clarity. Continuity. Control.</span>
          <h1>Your operation.<br /><span>In focus.</span></h1>
          <p>
            A clear view of what matters. A connected team. Every shift ready for what comes next.
          </p>

          <div className="sops-login-visual" aria-hidden="true">
            <div className="sops-orbit orbit-outer" /><div className="sops-orbit orbit-inner" />
            <div className="sops-orbit-core"><FaShieldAlt /><span>SENTINEL<span>OPS</span></span></div>
            <span className="sops-orbit-node node-a">01 <b>Observe</b></span>
            <span className="sops-orbit-node node-b">02 <b>Coordinate</b></span>
            <span className="sops-orbit-node node-c">03 <b>Deliver</b></span>
          </div>

          <div className="sops-auth-route-card">
            <div className="sops-auth-route-header">
              <div className="sops-route-icon-wrap">
                <FaSatelliteDish />
              </div>
              <div>
                <div className="sops-route-label">Active Directory Gateway</div>
                <div className={`sops-route-status ${adStatusClass}`}>
                  <span className="sops-status-dot" />
                  <span>{adStatusLabel}</span>
                </div>
              </div>
            </div>
            <button
              className="sops-route-refresh"
              type="button"
              onClick={() => {
                void refreshAdAvailability();
              }}
              disabled={adAvailability === 'checking'}
            >
              <FaSyncAlt />
              Refresh AD status
            </button>
          </div>

          <div className="sops-auth-path-hint">
            <FaShieldAlt />
            <span>
              {adAvailability === 'available'
                ? 'Use Windows credentials'
                : 'Use SentinelOps credential'}
            </span>
          </div>
        </aside>

        <div className="sops-login-card">
          <div className="sops-card-head">
            <span className="sops-signin-eyebrow">Your workspace awaits</span>
            <h2>Welcome back.</h2>
            <p>Sign in to continue to SentinelOps.</p>
          </div>

          {error && <div role="alert" className="sops-alert sops-alert-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="sops-field-label" htmlFor="login-email">Email</label>
            <div className="sops-input-group">
              <FaEnvelope className="sops-input-icon" />
              <input
                id="login-email"
                type="email"
                placeholder="operator@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <label className="sops-field-label" htmlFor="login-password">Password</label>
            <div className="sops-input-group">
              <FaLock className="sops-input-icon" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button className="sops-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <FaEyeSlash /> : <FaEye />}</button>
            </div>

            <button
              type="submit"
              className="sops-btn-primary"
              disabled={isLoading}
            >
              <span>{isLoading ? 'Signing in…' : 'Sign in'}</span>
              {!isLoading && <FaArrowRight />}
            </button>
          </form>
          <div className="sops-login-assurance"><FaShieldAlt /><span>Your workspace access follows your assigned section.</span></div>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;
