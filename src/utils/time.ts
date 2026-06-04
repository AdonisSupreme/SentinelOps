export const DEFAULT_APPLICATION_TIMEZONE = 'Africa/Harare';

const STORAGE_KEY = 'sentinelops.applicationTimezone';
const OFFSET_SUFFIX_RE = /(z|[+-]\d{2}:?\d{2})$/i;
const ISO_LIKE_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/;

let applicationTimeZone = localStorage.getItem(STORAGE_KEY) || DEFAULT_APPLICATION_TIMEZONE;

export const isValidTimeZone = (timeZone: string) => {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const getApplicationTimeZone = () => applicationTimeZone;

export const setApplicationTimeZone = (timeZone: string) => {
  const nextTimeZone = isValidTimeZone(timeZone) ? timeZone : DEFAULT_APPLICATION_TIMEZONE;
  applicationTimeZone = nextTimeZone;
  localStorage.setItem(STORAGE_KEY, nextTimeZone);
  return nextTimeZone;
};

export const normalizeSentinelTimestamp = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (ISO_LIKE_RE.test(trimmed) && !OFFSET_SUFFIX_RE.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}Z`;
  }
  return trimmed;
};

export const parseSentinelTimestamp = (value?: string | null) => {
  const normalized = normalizeSentinelTimestamp(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatInApplicationTimeZone = (
  value?: string | Date | null,
  options: Intl.DateTimeFormatOptions = {},
  fallback = '--',
) => {
  const date = value instanceof Date ? value : parseSentinelTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(undefined, {
    timeZone: applicationTimeZone,
    ...options,
  }).format(date);
};

export const formatDateTimeInApplicationTimeZone = (value?: string | Date | null, fallback = '--') =>
  formatInApplicationTimeZone(
    value,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
    fallback,
  );

export const formatTimeInApplicationTimeZone = (value?: string | Date | null, fallback = '--') =>
  formatInApplicationTimeZone(
    value,
    {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    },
    fallback,
  );

export const formatRelativeFromNow = (value?: string | Date | null, fallback = 'Unknown') => {
  const date = value instanceof Date ? value : parseSentinelTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return fallback;
  const diff = Math.round((Date.now() - date.getTime()) / 60000);
  if (Math.abs(diff) < 1) return 'Just now';
  if (diff < 0) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  return `${Math.round(diff / 60)}h ago`;
};

const datePartFormatter = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: applicationTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

export const getApplicationDateBucket = (value?: string | Date | null) => {
  const date = value instanceof Date ? value : parseSentinelTimestamp(value);
  if (!date || Number.isNaN(date.getTime())) return 'unknown';
  const parts = datePartFormatter().formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = part.value;
    }
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export const formatApplicationDateBucket = (bucket: string) => {
  if (!bucket || bucket === 'unknown') return 'Unknown date';
  const parsed = parseSentinelTimestamp(`${bucket}T00:00:00Z`);
  return formatInApplicationTimeZone(parsed, { year: 'numeric', month: 'short', day: 'numeric' }, bucket);
};
