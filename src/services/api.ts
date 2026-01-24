// src/services/api.ts
import axios, { AxiosResponse } from 'axios';
import {
  SignInRequest,
  SignInResponse,
  MeResponse,
  LogoutResponse,
  BackendError,
} from '../contracts/generated/api.types';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000',
});

let unauthorizedDispatched = false;

export const setAuthToken = (token: string) => {
  api.defaults.headers.common.Authorization = `Bearer ${token}`;
  unauthorizedDispatched = false;
};

export const clearAuthToken = () => {
  delete api.defaults.headers.common.Authorization;
};

// Request interceptor for auth token
api.interceptors.request.use((config) => {
  console.log(' [API] Request:', {
    method: config.method?.toUpperCase(),
    url: config.url,
    hasAuth: !!config.headers.Authorization,
    baseURL: config.baseURL
  });
  
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }
  
  console.log(' [API] Request headers:', {
    hasAuthorization: !!config.headers.Authorization,
    authHeader: config.headers.Authorization ? 'Bearer ***' : 'none'
  });
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => {
    console.log(' [API] Response:', {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });
    return response;
  },
  error => {
    console.error(' [API] Error:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    });
    // Only handle 401 if it's actually an auth error
    if (error.response?.status === 401) {
      // Check if not already logging out to avoid infinite loops
      const token = localStorage.getItem('token');
      if (token && !unauthorizedDispatched) {
        unauthorizedDispatched = true;
        // Only clear token if it exists
        localStorage.removeItem('token');
        clearAuthToken();
        // Trigger logout event for AuthContext to handle
        window.dispatchEvent(new Event('unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

// Auth Service
export const authService = {
  login: (payload: SignInRequest): Promise<AxiosResponse<SignInResponse>> =>
    api.post<SignInResponse>('/auth/signin', payload),

  getProfile: (): Promise<AxiosResponse<MeResponse>> =>
    api.get<MeResponse>('/auth/me'),

  logout: (): Promise<AxiosResponse<LogoutResponse>> =>
    api.post<LogoutResponse>('/auth/logout'),
};

export const useApi = () => {
  return api;
};

export default api;