// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000',
  timeout: 10000, // 10 second timeout
});

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    // Only handle 401 if it's actually an auth error
    if (error.response?.status === 401) {
      // Check if not already logging out to avoid infinite loops
      const token = localStorage.getItem('token');
      if (token) {
        // Only clear token if it exists
        localStorage.removeItem('token');
        // Trigger logout event for AuthContext to handle
        window.dispatchEvent(new Event('unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: (email: string, password: string) =>
    api.post('/auth/signin', { email, password }),

  getProfile: () => api.get('/auth/me'),
};

export const useApi = () => {
  return api;
};

export default api;