import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import api from '../services/api';
import registry from '../policies/modules.json';
import { EffectiveAccess, accessSignature } from '../types/access';
import { WorkspacePreview } from '../components/layout/WorkspacePreview';
export type { EffectiveAccess } from '../types/access';

export const pageModules = (path: string) => registry.filter(m => m.paths.some(p =>
  p === path || (p.includes('/:') && path.startsWith(p.split('/:')[0] + '/')))).map(m => m.module_key);
export const canOpenPage = (path: string, modules: string[], role = '') => {
  if (['/users', '/access'].includes(path)) return role.toUpperCase() === 'ADMIN';
  if (path === '/team' && !['ADMIN', 'MANAGER'].includes(role.toUpperCase())) return false;
  if (path === '/funds-custody' && role.toUpperCase() !== 'ADMIN') return false;
  const required = pageModules(path);
  return required.length === 0 || required.some(key => modules.includes(key));
};

const AccessContext = createContext({
  access: null as EffectiveAccess | null, loading: true, error: false,
  canAccessModule: (_key: string): boolean => false, canAccessPage: (_path: string): boolean => false,
  refresh: async () => {},
});

export const AccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, token, refreshUser } = useAuth();
  const [snapshot, setSnapshot] = useState<{token: string; access: EffectiveAccess} | null>(null);
  const [failedToken, setFailedToken] = useState<string | null>(null);
  const identity = useRef(token);
  const currentUser = useRef(user);
  const refreshProfile = useRef(refreshUser);
  const request = useRef<{token: string; promise: Promise<void>} | null>(null);
  const lastCheck = useRef(0);
  identity.current = token;
  currentUser.current = user;
  refreshProfile.current = refreshUser;
  const seed = user?.access;
  const userId = user?.id;

  const apply = useCallback((owner: string, data: EffectiveAccess) => {
    if (identity.current !== owner) return;
    // The static registry need not be copied/compared on every background refresh.
    const next = data;
    setSnapshot(previous => previous?.token === owner && accessSignature(previous.access) === accessSignature(next)
      ? previous : {token:owner, access:next});
    setFailedToken(null);
    lastCheck.current = Date.now();
  }, []);

  const refresh = useCallback(async () => {
    if (!token || !currentUser.current) return;
    if (request.current?.token === token) return request.current.promise;
    const promise = api.get<EffectiveAccess>('/api/v1/me/access').then(async ({data}) => {
      if (identity.current !== token) return;
      apply(token, data);
      const profile = currentUser.current;
      if (profile && (data.role.toUpperCase() !== profile.role.toUpperCase()
        || (data.section?.id || null) !== (profile.section_id || null))) await refreshProfile.current();
    }).catch(() => {
      // Keep the last server snapshot through transient failures; the API still
      // authorizes every operation. A 401 clears the identity via AuthContext.
      if (identity.current === token) setFailedToken(token);
    }).finally(() => {
      if (request.current?.token === token) request.current = null;
    });
    request.current = {token, promise};
    return promise;
  }, [token, apply]);

  useEffect(() => {
    if (!token || !userId) { setSnapshot(null); setFailedToken(null); return; }
    if (seed) apply(token, seed);
    else void refresh(); // Compatibility with an API rolling onto the new response.
  }, [token, userId, seed, apply, refresh]);

  useEffect(() => {
    if (!token) return;
    const whenStale = () => {
      if (document.visibilityState !== 'hidden' && Date.now() - lastCheck.current >= 30000) void refresh();
    };
    const changed = () => { void refresh(); };
    const interval = window.setInterval(whenStale, 30000);
    window.addEventListener('focus', whenStale);
    document.addEventListener('visibilitychange', whenStale);
    window.addEventListener('access-changed', changed);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', whenStale);
      document.removeEventListener('visibilitychange', whenStale);
      window.removeEventListener('access-changed', changed);
    };
  }, [token, refresh]);

  // Sign-in/profile permissions are available on the very first workspace render.
  const access = token && user ? (snapshot?.token === token ? snapshot.access : seed || null) : null;
  const error = Boolean(token && failedToken === token && !access);
  const loading = Boolean(token && !access && !error);
  const keys = useMemo(() => new Set(access?.modules), [access]);
  const canAccessModule = useCallback((key: string) => keys.has(key), [keys]);
  const canAccessPage = useCallback((path: string) => Boolean(access && canOpenPage(path, access.modules, access.role)), [access]);
  const value = useMemo(() => ({access, loading, error, refresh, canAccessModule, canAccessPage}),
    [access, loading, error, refresh, canAccessModule, canAccessPage]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
};

export const useAccess = () => useContext(AccessContext);
export const ModuleAccess: React.FC<{ module: string; children: React.ReactNode }> = ({ module, children }) => {
  const { canAccessModule } = useAccess();
  return canAccessModule(module) ? <>{children}</> : null;
};
export const AccessDenied = () => <section role="alert" style={{ padding: '3rem' }}><h1>403 — Access unavailable</h1><p>Your section is not assigned this workspace. Contact your system administrator.</p></section>;
export const PageAccess: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { access, canAccessPage, canAccessModule, loading, error, refresh } = useAccess();
  const { user } = useAuth();
  const location = useLocation();
  // Administration depends on the authenticated role, not business-module grants.
  if (['/access','/users'].includes(location.pathname) && user?.role.toUpperCase() === 'ADMIN') return <>{children}</>;
  if (loading) return <WorkspacePreview path={location.pathname} />;
  if (error) return <section role="alert" style={{padding:'2rem'}}><p>Unable to open this workspace. Please retry.</p><button onClick={() => void refresh()}>Retry</button></section>;
  if (location.pathname === '/' && !canAccessPage('/')) {
    const first = registry.flatMap(module => module.paths).find(path => path !== '/' && !path.includes(':') && canAccessPage(path));
    return first ? <Navigate to={first} replace /> : <section style={{padding:'3rem'}}><h1>No workspaces assigned</h1><p>Your account is active. A system administrator can assign workspaces to your section.</p></section>;
  }
  const params = new URLSearchParams(location.search);
  const workspace = params.get('workspace');
  let required: string | undefined;
  if (location.pathname === '/network-sentinel' && params.get('tab')) required = params.get('tab') === 'timeline' ? 'network_sentinel.outage_history' : 'network_sentinel.monitoring';
  if (location.pathname === '/reports' && workspace) required = 'reports.' + (workspace === 'hovering' ? 'hovering' : workspace === 'settings' ? 'hovering_settings' : 'crb');
  if (location.pathname === '/nexus' && workspace) required = 'nexus.' + workspace;
  if (location.pathname === '/trustlink' && params.get('tab')) required = ({pipeline:'trustlink.daily_extraction',history:'trustlink.run_history',rtgs:'trustlink.rtgs'} as Record<string,string>)[params.get('tab')!];
  if (!canAccessPage(location.pathname) || (required && !canAccessModule(required))) return <AccessDenied />;
  // A real grant change clears only the affected operational view, never the shell,
  // notification provider, theme or app configuration. Polling unchanged access is inert.
  return <React.Fragment key={user?.id + ':' + accessSignature(access)}>{children}</React.Fragment>;
};

