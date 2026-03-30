import api from './api';

export type AdAvailability = 'checking' | 'available' | 'unavailable';

interface AdStatusResponse {
  available: boolean;
  source?: string;
  checked_at?: string;
  reason?: string;
}

export const checkAdAvailability = async (): Promise<AdAvailability> => {
  try {
    const response = await api.get<AdStatusResponse>('/auth/ad/status');
    return response.data?.available ? 'available' : 'unavailable';
  } catch {
    return 'unavailable';
  }
};
