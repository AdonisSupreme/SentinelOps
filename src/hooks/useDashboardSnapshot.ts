import { useState, useEffect, useCallback, useRef } from 'react';
import { checklistApi, OperationalDashboardSummary } from '../services/checklistApi';
import { useEffectListener } from '../effects/effectInterpreter';
import { getErrorMessage, normalizeError } from '../utils/errorNormalizer';

interface RefreshOptions {
  background?: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 30000;
const NETWORK_RETRY_DELAYS_MS = [1200, 3000];

const wait = (delayMs: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, delayMs);
  });

const isNetworkBootstrapError = (err: unknown) => {
  const normalized = normalizeError(err);
  return (
    normalized.code === 'NETWORK_ABORTED' ||
    normalized.code === 'NETWORK_TIMEOUT' ||
    normalized.code === 'GENERIC_ERROR' ||
    (normalized.message || '').includes('Network Error')
  );
};

export const useDashboardSnapshot = (pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS) => {
  const [snapshot, setSnapshot] = useState<OperationalDashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlightRefreshRef = useRef<Promise<OperationalDashboardSummary> | null>(null);
  const snapshotRef = useRef<OperationalDashboardSummary | null>(null);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const refresh = useCallback(async ({ background = false }: RefreshOptions = {}) => {
    if (inFlightRefreshRef.current) {
      return inFlightRefreshRef.current;
    }

    if (snapshotRef.current && background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError(null);

    const runRefresh = async () => {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= NETWORK_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          return await checklistApi.getDashboardSummary();
        } catch (err) {
          lastError = err;
          if (!isNetworkBootstrapError(err) || attempt === NETWORK_RETRY_DELAYS_MS.length) {
            throw err;
          }
          await wait(NETWORK_RETRY_DELAYS_MS[attempt]);
        }
      }

      throw lastError instanceof Error ? lastError : new Error('Failed to load dashboard');
    };

    const refreshPromise = runRefresh()
      .then((data) => {
        snapshotRef.current = data;
        setSnapshot(data);
        setError(null);
        return data;
      })
      .catch((err) => {
        const message = isNetworkBootstrapError(err)
          ? 'SentinelOps is reconnecting to the backend. The dashboard will come online automatically.'
          : getErrorMessage(err);
        setError(message);
        console.error('Dashboard refresh error:', err);
        return snapshotRef.current as OperationalDashboardSummary;
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        inFlightRefreshRef.current = null;
      });

    inFlightRefreshRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, [refresh]);

  useEffect(() => {
    if (pollIntervalMs <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refresh({ background: true }).catch(() => undefined);
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [pollIntervalMs, refresh]);

  useEffectListener('dashboard_refresh', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('checklist_started', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('checklist_completed', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('checklist_exception', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('handover_note_created', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('notification_created', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('points_awarded', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  useEffectListener('badge_earned', () => {
    void refresh({ background: true }).catch(() => undefined);
  });

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
  };
};
