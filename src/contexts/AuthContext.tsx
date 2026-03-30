// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { setAuthToken, clearAuthToken, authService } from '../services/api';
import websocketService from '../services/websocketService';
import { checkAdAvailability, AdAvailability } from '../services/adGatewayAuth';
import {
  MeResponse,
} from '../contracts/generated/api.types';

// Export MeResponse as User for backward compatibility
export type User = MeResponse;

interface AuthContextType {
  user: MeResponse | null;
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
  const [user, setUser] = useState<MeResponse | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [adAvailability, setAdAvailability] = useState<AdAvailability>('checking');
  const [lastAuthMethod, setLastAuthMethod] = useState<'ad+app' | 'app' | null>(null);
  const isLoggingOutRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (token) {
      setAuthToken(token);
      // Keep WebSocket auth token in sync with HTTP token
      websocketService.setAuthToken(token);
      return;
    }

    clearAuthToken();
    // On logout, WebSocket connections are cleaned up by providers/components
  }, [token]);

  const forceLogout = () => {
    localStorage.removeItem('token');
    clearAuthToken();
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const fetchUser = async () => {
    try {
      if (token) {
        const response = await authService.getProfile();
        setUser(response.data);
        return response.data;
      }
    } catch (error) {
      console.error('Failed to fetch user data', error);
      throw error;
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;

    const loadAdAvailability = async () => {
      if (!isMounted) return;
      setAdAvailability('checking');
      const status = await checkAdAvailability();
      if (isMounted) {
        setAdAvailability(status);
      }
    };

    void loadAdAvailability();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const validateToken = async () => {
      try {
        await fetchUser();
      } catch (error) {
        forceLogout();
      } finally {
        setLoading(false);
      }
    };

    // Only validate on mount or when token changes, not on api object changes
    if (token) {
      validateToken();
    } else {
      setLoading(false);
    }
  }, [token]); // Removed api from dependencies

  // Handle unauthorized events from API interceptor
  useEffect(() => {
    const handleUnauthorized = () => {
      forceLogout();
    };

    window.addEventListener('unauthorized', handleUnauthorized);
    return () => window.removeEventListener('unauthorized', handleUnauthorized);
  }, []);

  const login = async (email: string, password: string) => {
    const finalizeLogin = (newToken: string, userData: MeResponse) => {
      localStorage.setItem('token', newToken);
      setAuthToken(newToken);
      setToken(newToken);
      setUser(userData);
      navigate(location.state?.from?.pathname || '/');
    };

    try {
      // Backend is source-of-truth for AD-vs-local route selection.
      const response = await authService.login({ email, password });
      finalizeLogin(response.data.token, response.data.user);

      const authSource = (response.data as any)?.auth_source;
      setLastAuthMethod(authSource === 'active_directory' ? 'ad+app' : 'app');
      setAdAvailability(await checkAdAvailability());
    } catch (error: any) {
      throw error;
    }
  };

  const logout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;

    // Best-effort audit call to backend; do not branch on response
    try {
      await authService.logout();
    } catch (error) {
      // Ignore: logout is idempotent and cleanup must always happen
      console.error('Logout API call failed (non-critical):', error);
    } finally {
      // Always perform full cleanup regardless of API response
      localStorage.removeItem('token');
      clearAuthToken();
      setToken(null);
      setUser(null);
      navigate('/login');
      isLoggingOutRef.current = false;
    }
  };

  const refreshUser = async () => {
    try {
      await fetchUser();
    } catch (error) {
      console.error('Failed to refresh user data', error);
      throw error;
    }
  };

  const refreshAdAvailability = async () => {
    setAdAvailability('checking');
    const status = await checkAdAvailability();
    setAdAvailability(status);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      login,
      logout,
      loading,
      refreshUser,
      adAvailability,
      refreshAdAvailability,
      lastAuthMethod
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
