import { useState, useEffect, useCallback, useRef } from 'react';
import { checklistApi, OperationalDashboardSummary } from '../services/checklistApi';
import { useEffectListener } from '../effects/effectInterpreter';

interface RefreshOptions {
  background?: boolean;
}

const DEFAULT_POLL_INTERVAL_MS = 30000;

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

    const refreshPromise = checklistApi
      .getDashboardSummary()
      .then((data) => {
        snapshotRef.current = data;
        setSnapshot(data);
        return data;
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : 'Failed to load dashboard';
        setError(message);
        console.error('Dashboard refresh error:', err);
        throw err;
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
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (pollIntervalMs <= 0) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void refresh({ background: true });
    }, pollIntervalMs);

    return () => window.clearInterval(interval);
  }, [pollIntervalMs, refresh]);

  useEffectListener('dashboard_refresh', () => {
    void refresh({ background: true });
  });

  useEffectListener('checklist_started', () => {
    void refresh({ background: true });
  });

  useEffectListener('checklist_completed', () => {
    void refresh({ background: true });
  });

  useEffectListener('checklist_exception', () => {
    void refresh({ background: true });
  });

  useEffectListener('handover_note_created', () => {
    void refresh({ background: true });
  });

  useEffectListener('notification_created', () => {
    void refresh({ background: true });
  });

  useEffectListener('points_awarded', () => {
    void refresh({ background: true });
  });

  useEffectListener('badge_earned', () => {
    void refresh({ background: true });
  });

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
  };
};
