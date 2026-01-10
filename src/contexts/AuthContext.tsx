// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApi } from '../services/api';

// Update inside AuthContext or types.ts
export interface User {
  id: number;
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  position: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();

  const fetchUser = async () => {
    try {
      if (token) {
        const response = await api.get('/auth/me');
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
        logout();
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, api]);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      navigate(location.state?.from?.pathname || '/');
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const refreshUser = async () => {
    try {
      const userData = await fetchUser();
      return userData;
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