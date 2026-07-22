import React from 'react';
import { NetworkSample, NetworkServiceCard, ServiceHistoryRow } from '../services/networkSentinelApi';
import {
  formatDateTimeInApplicationTimeZone,
  formatTimeInApplicationTimeZone,
  parseSentinelTimestamp,
} from '../utils/time';

export type Status = 'UNKNOWN' | 'UP' | 'DEGRADED' | 'DOWN';

export const statusPriority: Record<Status, number> = {
  DOWN: 4,
  DEGRADED: 3,
  UNKNOWN: 2,
  UP: 1,
};

const healthScore: Record<Status, number> = {
  DOWN: 0,
  DEGRADED: 64,
  UNKNOWN: 35,
  UP: 100,
};

export const statusClass = (status?: string | null) => (status || 'UNKNOWN').toLowerCase();

const knownStatuses = new Set<Status>(['UP', 'DEGRADED', 'DOWN']);

const normalizeStatus = (value: unknown): Status | null => {
  const normalized = String(value || '').toUpperCase() as Status;
  return normalized === 'UP' || normalized === 'DEGRADED' || normalized === 'DOWN' || normalized === 'UNKNOWN'
    ? normalized
    : null;
};

const isEmptyUnknownStatus = (status?: NetworkServiceCard['status'] | null) => {
  if (!status || status.overall_status !== 'UNKNOWN') return false;
  return !status.last_checked_at
    && !status.reason
    && status.icmp_up == null
    && status.tcp_up == null
    && status.icmp_latency_ms == null
    && status.tcp_latency_ms == null
    && Number(status.consecutive_failures || 0) === 0;
};

export const stabilizeNetworkServices = (
  incomingServices: NetworkServiceCard[],
  previousServices: NetworkServiceCard[] = [],
): NetworkServiceCard[] => {
  const previousById = new Map(previousServices.map((service) => [service.id, service]));
  return incomingServices.map((service) => {
    const previous = previousById.get(service.id);
    if (!previous?.status || !knownStatuses.has(previous.status.overall_status)) {
      return service;
    }
    if (!isEmptyUnknownStatus(service.status)) {
      return service;
    }
    return {
      ...service,
      status: previous.status,
      active_outage: service.active_outage || previous.active_outage || null,
    };
  });
};

export const formatDateTime = (value?: string | null) => {
  return formatDateTimeInApplicationTimeZone(value, '--');
};

export const formatTime = (value?: string | null) => {
  return formatTimeInApplicationTimeZone(value, '--');
};

export const formatSince = (value?: string | null) => {
  if (!value) return '--';
  const parsed = parseSentinelTimestamp(value);
  const diff = parsed ? Date.now() - parsed.getTime() : Number.NaN;
  if (Number.isNaN(diff) || diff < 0) return '--';
  const seconds = Math.floor(diff / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

export const formatDuration = (seconds?: number | null) => {
  if (seconds == null || Number.isNaN(seconds)) return '--';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor(seconds % 60)}s`;
};

export const formatLatency = (value?: number | null) => (value == null ? '--' : `${Math.round(value)}ms`);
export const formatPercent = (value?: number | null) => (value == null ? '--' : `${value.toFixed(1)}%`);

export const deriveOverview = (services: NetworkServiceCard[]) => {
  const enabled = services.filter((service) => service.enabled);
  const counts = { up: 0, degraded: 0, down: 0, unknown: 0 };

  services.forEach((service) => {
    const status = (service.status?.overall_status || 'UNKNOWN') as Status;
    if (status === 'UP') counts.up += 1;
    else if (status === 'DEGRADED') counts.degraded += 1;
    else if (status === 'DOWN') counts.down += 1;
    else counts.unknown += 1;
  });

  const fleetPulse = enabled.length
    ? Math.round(
        enabled.reduce((total, service) => total + healthScore[(service.status?.overall_status || 'UNKNOWN') as Status], 0) /
          enabled.length
      )
    : 0;
  const averageInterval = enabled.length
    ? Number((enabled.reduce((total, service) => total + (service.interval_seconds || 0), 0) / enabled.length).toFixed(1))
    : null;

  return {
    total_services: services.length,
    enabled_services: enabled.length,
    up_services: counts.up,
    degraded_services: counts.degraded,
    down_services: counts.down,
    unknown_services: counts.unknown,
    impaired_services: counts.down + counts.degraded,
    active_incidents: services.filter((service) => Boolean(service.active_outage)).length,
    fleet_pulse: fleetPulse,
    average_interval_seconds: averageInterval,
    recent_event_count: 0,
  };
};

export const patchLiveService = (service: NetworkServiceCard, update: Record<string, unknown>): NetworkServiceCard => {
  const incomingStatus = normalizeStatus(update.overall_status);
  const hasRealSample =
    Boolean(update.last_checked_at)
    || update.icmp_up != null
    || update.tcp_up != null
    || update.icmp_latency_ms != null
    || update.tcp_latency_ms != null
    || Number(update.consecutive_failures || 0) > 0;
  const previousStatus = service.status;
  const preservePreviousStatus = incomingStatus === 'UNKNOWN'
    && previousStatus
    && knownStatuses.has(previousStatus.overall_status)
    && !hasRealSample;
  const overallStatus = preservePreviousStatus
    ? previousStatus.overall_status
    : incomingStatus || service.status?.overall_status || 'UNKNOWN';
  return {
    ...service,
    status: {
      last_checked_at: preservePreviousStatus
        ? previousStatus?.last_checked_at ?? null
        : (update.last_checked_at as string | null) ?? service.status?.last_checked_at ?? null,
      icmp_up: preservePreviousStatus ? previousStatus?.icmp_up ?? null : (update.icmp_up as boolean | null) ?? service.status?.icmp_up ?? null,
      icmp_bytes: preservePreviousStatus ? previousStatus?.icmp_bytes ?? null : (update.icmp_bytes as number | null) ?? service.status?.icmp_bytes ?? null,
      icmp_latency_ms: preservePreviousStatus ? previousStatus?.icmp_latency_ms ?? null : (update.icmp_latency_ms as number | null) ?? service.status?.icmp_latency_ms ?? null,
      icmp_ttl: preservePreviousStatus ? previousStatus?.icmp_ttl ?? null : (update.icmp_ttl as number | null) ?? service.status?.icmp_ttl ?? null,
      tcp_up: preservePreviousStatus ? previousStatus?.tcp_up ?? null : (update.tcp_up as boolean | null) ?? service.status?.tcp_up ?? null,
      tcp_latency_ms: preservePreviousStatus ? previousStatus?.tcp_latency_ms ?? null : (update.tcp_latency_ms as number | null) ?? service.status?.tcp_latency_ms ?? null,
      overall_status: overallStatus,
      reason: preservePreviousStatus ? previousStatus?.reason ?? null : (update.reason as string | null) ?? service.status?.reason ?? null,
      consecutive_failures: preservePreviousStatus ? previousStatus?.consecutive_failures ?? 0 : (update.consecutive_failures as number | undefined) ?? service.status?.consecutive_failures ?? 0,
      last_state_change_at: preservePreviousStatus
        ? previousStatus?.last_state_change_at ?? null
        : (update.last_state_change_at as string | null) ?? service.status?.last_state_change_at ?? null,
    },
    active_outage:
      overallStatus === 'DOWN'
        ? service.active_outage || {
            started_at:
              (update.last_state_change_at as string | null) ||
              (update.last_checked_at as string | null) ||
              new Date().toISOString(),
            cause: (update.reason as string | null) ?? null,
            duration_seconds: 0,
          }
        : overallStatus === 'UP'
        ? null
        : service.active_outage,
  };
};

const parseMetricNumber = (value?: string) => {
  if (!value) return null;
  const normalized = Number.parseInt(value, 10);
  return Number.isNaN(normalized) ? null : normalized;
};

export const deriveSamplesFromRawRows = (rows: ServiceHistoryRow[]): NetworkSample[] =>
  rows
    .reduce<NetworkSample[]>((samples, row) => {
      let overall_status: Status | null = null;
      if (row.kind === 'UP' || row.kind === 'DOWN' || row.kind === 'DEGRADED') {
        overall_status = row.kind;
      } else if (row.kind === 'OUTAGE_DETECTED') {
        overall_status = 'DOWN';
      } else if (row.kind === 'RECOVERED') {
        overall_status = 'UP';
      }

      if (!overall_status) return samples;

      samples.push({
        timestamp: row.timestamp || null,
        overall_status,
        icmp_up: overall_status === 'UP' ? true : overall_status === 'DOWN' ? false : null,
        icmp_bytes: parseMetricNumber(row.bytes),
        icmp_latency_ms: parseMetricNumber(row.icmp_latency),
        icmp_ttl: parseMetricNumber(row.ttl),
        tcp_up: overall_status === 'UP' ? true : overall_status === 'DOWN' ? false : null,
        tcp_latency_ms: parseMetricNumber(row.tcp_latency),
        reason: row.kind === 'OUTAGE_DETECTED' ? 'Outage detected from retained evidence.' : null,
        consecutive_failures: overall_status === 'DOWN' ? 1 : 0,
      });
      return samples;
    }, [])
    .slice(-72);

export const SignalBand: React.FC<{ samples: NetworkSample[] }> = ({ samples }) => {
  if (!samples.length) return <div className="signal-empty">Awaiting sampled telemetry.</div>;
  return (
    <div className="signal-band">
      {samples.slice(-72).map((sample, index) => (
        <span
          key={`${sample.timestamp || index}-${index}`}
          className={`signal-cell ${statusClass(sample.overall_status)}`}
          title={`${sample.overall_status} - ${formatDateTime(sample.timestamp)}`}
        />
      ))}
    </div>
  );
};

export const LatencyChart: React.FC<{ samples: NetworkSample[] }> = ({ samples }) => {
  const visible = samples.slice(-72);
  const series = visible.map((sample) => Math.max(sample.icmp_latency_ms || 0, sample.tcp_latency_ms || 0));
  const positives = series.filter((value) => value > 0);
  if (!positives.length) return <div className="signal-empty">No latency samples in the selected window.</div>;

  const width = 320;
  const height = 120;
  const max = Math.max(...positives, 1);
  const step = width / Math.max(1, series.length - 1);
  const polyline = series
    .map((value, index) => `${index * step},${height - (Math.max(value, 0) / max) * (height - 16) - 8}`)
    .join(' ');

  return (
    <svg className="latency-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
};
