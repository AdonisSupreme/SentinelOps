const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const optionalUrl = (value: string | undefined): string => {
  const normalized = (value || '').trim();
  return normalized ? stripTrailingSlash(normalized) : '';
};

const toWebSocketUrl = (value: string): string => {
  if (/^wss?:\/\//i.test(value)) {
    return value;
  }
  if (/^https:\/\//i.test(value)) {
    return value.replace(/^https:/i, 'wss:');
  }
  if (/^http:\/\//i.test(value)) {
    return value.replace(/^http:/i, 'ws:');
  }

  const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${value}`;
};

export const API_BASE_URL = optionalUrl(process.env.REACT_APP_API_BASE_URL);
export const NEXUS_API_BASE_URL = optionalUrl(process.env.REACT_APP_NEXUS_API_BASE_URL);

export const DATABASE_TELEMETRY_ENDPOINT_LABEL = (
  process.env.REACT_APP_DATABASE_TELEMETRY_ENDPOINT_LABEL || 'backend-configured'
).trim();

export const resolveWebSocketBaseUrl = (): string => {
  const explicitBaseUrl = optionalUrl(process.env.REACT_APP_WS_BASE_URL);
  if (explicitBaseUrl) {
    return toWebSocketUrl(explicitBaseUrl);
  }

  if (API_BASE_URL && /^https?:\/\//i.test(API_BASE_URL)) {
    return toWebSocketUrl(API_BASE_URL);
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};
