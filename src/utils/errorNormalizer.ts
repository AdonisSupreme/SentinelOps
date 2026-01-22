// src/utils/errorNormalizer.ts
// Normalize backend errors to code/message/context contract

import { BackendError } from '../contracts/generated/api.types';

export interface NormalizedError {
  code: string;
  message: string;
  context?: Record<string, any>;
  isKnown: boolean;
}

export const normalizeError = (err: unknown): NormalizedError => {
  // Axios error with backend response
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as any;
    const data = axiosErr.response?.data;

    if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
      return {
        code: data.code,
        message: data.message,
        context: data.context,
        isKnown: true,
      };
    }

    // HTTP status fallbacks
    if (axiosErr.response?.status) {
      const status = axiosErr.response.status;
      switch (status) {
        case 401:
          return {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            isKnown: true,
          };
        case 403:
          return {
            code: 'FORBIDDEN',
            message: 'Access denied',
            isKnown: true,
          };
        case 404:
          return {
            code: 'NOT_FOUND',
            message: 'Resource not found',
            isKnown: true,
          };
        case 422:
          return {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            context: data?.errors || undefined,
            isKnown: true,
          };
        case 429:
          return {
            code: 'RATE_LIMIT',
            message: 'Too many requests',
            isKnown: true,
          };
        case 500:
          return {
            code: 'INTERNAL_ERROR',
            message: 'Server error',
            isKnown: true,
          };
        default:
          return {
            code: `HTTP_${status}`,
            message: `HTTP error ${status}`,
            isKnown: false,
          };
      }
    }
  }

  // WebSocket error with BackendError shape
  if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
    const wsErr = err as BackendError;
    return {
      code: wsErr.code,
      message: wsErr.message,
      context: wsErr.context,
      isKnown: true,
    };
  }

  // Network error
  if (err && typeof err === 'object' && 'code' in err) {
    const netErr = err as any;
    if (netErr.code === 'ECONNABORTED') {
      return {
        code: 'NETWORK_ABORTED',
        message: 'Request was aborted',
        isKnown: true,
      };
    }
    if (netErr.code === 'ETIMEDOUT') {
      return {
        code: 'NETWORK_TIMEOUT',
        message: 'Request timed out',
        isKnown: true,
      };
    }
  }

  // Generic Error object
  if (err instanceof Error) {
    return {
      code: 'GENERIC_ERROR',
      message: err.message,
      isKnown: false,
    };
  }

  // Unknown error type
  return {
    code: 'UNKNOWN_ERROR',
    message: typeof err === 'string' ? err : 'An unexpected error occurred',
    isKnown: false,
  };
};

export const getErrorMessage = (err: unknown): string => {
  const normalized = normalizeError(err);
  return normalized.isKnown ? normalized.message : 'Something went wrong. Please try again.';
};

export const getErrorCode = (err: unknown): string => {
  const normalized = normalizeError(err);
  return normalized.code;
};

export const getErrorContext = (err: unknown): Record<string, any> | undefined => {
  const normalized = normalizeError(err);
  return normalized.context;
};
