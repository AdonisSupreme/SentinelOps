import React, { createContext, useCallback, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setAuthToken, clearAuthToken, authService } from '../services/api';
import websocketService from '../services/websocketService';
import centralizedWebSocketManager from '../services/centralizedWebSocketManager';
import { checkAdAvailability, AdAvailability } from '../services/adGatewayAuth';
import type { SessionUser } from '../types/access';

export type User = SessionUser;
interface AuthContextType {
  user: SessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loading: boolean;
  refreshUser: () => Promise<void>;
  adAvailability: AdAvailability;
  refreshAdAvailability: () => Promise<void>;
  lastAuthMethod: 'ad+app' | 'app' | null;
}
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(Boolean(token));
  const [adAvailability, setAdAvailability] = useState<AdAvailability>('checking');
  const [lastAuthMethod, setLastAuthMethod] = useState<'ad+app' | 'app' | null>(null);
  const isLoggingOutRef = useRef(false);
  const tokenRef = useRef(token);
  const hydratedToken = useRef<string | null>(null);
  const profileRequest = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const forceLogout = useCallback(() => {
    tokenRef.current = null;
    hydratedToken.current = null;
    localStorage.removeItem('token');
    clearAuthToken();
    websocketService.setAuthToken('');
    centralizedWebSocketManager.disconnectAll();
    setToken(null);
    setUser(null);
    setLoading(false);
    navigate('/login');
  }, [navigate]);

  const refreshUser = useCallback(async () => {
    const identity = tokenRef.current;
    if (!identity) return;
    if (profileRequest.current?.token === identity) return profileRequest.current.promise;
    const promise = authService.getProfile().then(({ data }) => {
      if (tokenRef.current !== identity) return;
      hydratedToken.current = identity;
      setUser(previous => JSON.stringify(previous) === JSON.stringify(data) ? previous : data);
    }).finally(() => {
      if (profileRequest.current?.token === identity) profileRequest.current = null;
    });
    profileRequest.current = { token: identity, promise };
    return promise;
  }, []);

  useEffect(() => {
    tokenRef.current = token;
    if (!token) { setLoading(false); return; }
    setAuthToken(token);
    websocketService.setAuthToken(token);
    // Sign-in already supplies a validated profile and access: no duplicate fetch.
    if (hydratedToken.current === token) { setLoading(false); return; }
    setLoading(true);
    void refreshUser().catch(() => {
      if (tokenRef.current === token) forceLogout();
    }).finally(() => {
      if (tokenRef.current === token) setLoading(false);
    });
  }, [token, refreshUser, forceLogout]);

  useEffect(() => {
    const handleUnauthorized = () => forceLogout();
    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, [forceLogout]);

  useEffect(() => {
    let mounted = true;
    void checkAdAvailability().then(status => { if (mounted) setAdAvailability(status); });
    return () => { mounted = false; };
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await authService.login({ email, password });
    tokenRef.current = data.token;
    hydratedToken.current = data.token;
    localStorage.setItem('token', data.token);
    setAuthToken(data.token);
    websocketService.setAuthToken(data.token);
    setUser(data.user);
    setToken(data.token);
    setLoading(false);
    setLastAuthMethod((data as typeof data & { auth_source?: string }).auth_source === 'active_directory' ? 'ad+app' : 'app');
    const from = location.state?.from;
    navigate(from ? from.pathname + (from.search || '') : '/');
    void checkAdAvailability().then(setAdAvailability);
  };

  const logout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    try { await authService.logout(); }
    catch (error) { console.error('Logout API call failed (non-critical):', error); }
    finally { forceLogout(); isLoggingOutRef.current = false; }
  };
  const refreshAdAvailability = async () => {
    setAdAvailability('checking');
    setAdAvailability(await checkAdAvailability());
  };

  return <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, loading, login, logout,
    refreshUser, adAvailability, refreshAdAvailability, lastAuthMethod }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

