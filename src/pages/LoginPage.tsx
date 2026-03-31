import React, { useMemo, useState } from 'react';
import {
  FaArrowRight,
  FaEnvelope,
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
          <span className="sops-intel-kicker">SentinelOps Command Layer</span>
          <h1>One place to see the operation clearly.</h1>
          <p>
            SentinelOps brings live oversight, shift continuity, task execution, and operational accountability into a
            single command space so every team starts informed, responds faster, and leaves a cleaner handover behind.
          </p>

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
            <h2>Sign In</h2>
            <p>Continue into the workspace where people, priorities, and proof stay aligned.</p>
          </div>

          {error && <div className="sops-alert sops-alert-error">{error}</div>}

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
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="sops-btn-primary"
              disabled={isLoading}
            >
              <span>{isLoading ? 'Authenticating...' : 'Access SentinelOps'}</span>
              {!isLoading && <FaArrowRight />}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;
