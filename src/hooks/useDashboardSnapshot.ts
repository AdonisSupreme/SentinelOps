// src/hooks/useDashboardSnapshot.ts
// Treat dashboard responses as immutable snapshots and refresh on effects

import { useState, useEffect, useCallback } from 'react';
import { checklistApi } from '../services/checklistApi';
import { DashboardSummary } from '../contracts/generated/api.types';
import { useEffectListener } from '../effects/effectInterpreter';

export const useDashboardSnapshot = () => {
  const [snapshot, setSnapshot] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checklistApi.getDashboardSummary();
      setSnapshot(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load dashboard';
      setError(message);
      console.error('Dashboard refresh error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh on relevant effects
  useEffectListener('dashboard_refresh', () => {
    refresh();
  });

  useEffectListener('checklist_completed', () => {
    refresh();
  });

  useEffectListener('checklist_exception', () => {
    refresh();
  });

  useEffectListener('points_awarded', () => {
    refresh();
  });

  useEffectListener('badge_earned', () => {
    refresh();
  });

  return {
    snapshot,
    loading,
    error,
    refresh,
  };
};
