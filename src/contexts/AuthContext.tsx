// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi, setAuthToken, clearAuthToken, authService } from '../services/api';
import websocketService from '../services/websocketService';
import {
  SignInRequest,
  SignInResponse,
  MeResponse,
  LogoutResponse,
  BackendError,
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
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const isLoggingOutRef = useRef(false);
  const api = useApi();
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
    console.log(' [AuthContext] Login attempt started', { email, passwordLength: password.length });
    
    try {
      console.log(' [AuthContext] Calling authService.login...');
      const response = await authService.login({ email, password });
      console.log(' [AuthContext] Login response received:', { 
        status: response.status, 
        hasToken: !!response.data.token,
        hasUser: !!response.data.user,
        userKeys: response.data.user ? Object.keys(response.data.user) : null
      });
      
      const newToken = response.data.token;
      const userData = response.data.user;

      console.log(' [AuthContext] Storing token and user data...');
      localStorage.setItem('token', newToken);
      setAuthToken(newToken);
      setToken(newToken);

      // Use user data from signin response instead of separate API call
      console.log(' [AuthContext] Setting user data:', userData);
      setUser(userData);

      console.log(' [AuthContext] Navigating to:', location.state?.from?.pathname || '/');
      navigate(location.state?.from?.pathname || '/');
      
      console.log(' [AuthContext] Login completed successfully');
    } catch (error: any) {
      console.error(' [AuthContext] Login failed:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers
        }
      });
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

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token,
      login,
      logout,
      loading,
      refreshUser
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