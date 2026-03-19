import { useEffect, useMemo, useCallback, useRef } from 'react';
import { teamApi, Shift, ScheduledShift } from '../services/teamApi';
import { shiftSchedulingApi, ShiftPattern } from '../services/shiftSchedulingApi';
import { userApi, UserListItem } from '../services/userApi';
import { orgApi, Section } from '../services/orgApi';
import { format } from 'date-fns';

interface TeamDataCache {
  shifts: Shift[];
  scheduledShifts: ScheduledShift[];
  sectionUsers: UserListItem[];
  sections: Section[];
  patterns: ShiftPattern[];
  lastUpdated: Date;
  cacheKey: string;
}

interface UseTeamDataOptimizationProps {
  effectiveSectionId: string;
  dateRange: { start: Date; end: Date };
  canManageTeam: boolean;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 10; // Maximum number of cached datasets

const teamDataCache = new Map<string, TeamDataCache>();

const generateCacheKey = (sectionId: string, dateRange: { start: Date; end: Date }) => {
  return `${sectionId}-${format(dateRange.start, 'yyyy-MM-dd')}-${format(dateRange.end, 'yyyy-MM-dd')}`;
};

const cleanExpiredCache = () => {
  const now = new Date();
  const keysToDelete: string[] = [];
  
  teamDataCache.forEach((cache, key) => {
    if (now.getTime() - cache.lastUpdated.getTime() > CACHE_DURATION) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => teamDataCache.delete(key));
};

const cleanOldestCache = () => {
  if (teamDataCache.size <= MAX_CACHE_SIZE) return;
  
  const entries = Array.from(teamDataCache.entries());
  entries.sort((a, b) => a[1].lastUpdated.getTime() - b[1].lastUpdated.getTime());
  
  const toDelete = entries.slice(0, teamDataCache.size - MAX_CACHE_SIZE);
  toDelete.forEach(([key]) => teamDataCache.delete(key));
};

export const useTeamDataOptimization = ({ 
  effectiveSectionId, 
  dateRange, 
  canManageTeam 
}: UseTeamDataOptimizationProps) => {
  const loadingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const cacheKey = useMemo(() => {
    return generateCacheKey(effectiveSectionId, dateRange);
  }, [effectiveSectionId, dateRange]);

  const getCachedData = useCallback(() => {
    cleanExpiredCache();
    const cached = teamDataCache.get(cacheKey);
    
    if (cached) {
      const now = new Date();
      const cacheAge = now.getTime() - cached.lastUpdated.getTime();
      
      if (cacheAge < CACHE_DURATION) {
        return cached;
      } else {
        teamDataCache.delete(cacheKey);
      }
    }
    
    return null;
  }, [cacheKey]);

  const setCachedData = useCallback((data: Omit<TeamDataCache, 'lastUpdated' | 'cacheKey'>) => {
    cleanOldestCache();
    
    teamDataCache.set(cacheKey, {
      ...data,
      lastUpdated: new Date(),
      cacheKey
    });
  }, [cacheKey]);

  const loadBaseData = useCallback(async (forceRefresh = false) => {
    if (!canManageTeam || loadingRef.current) return;

    const cachedData = getCachedData();
    if (!forceRefresh && cachedData && cachedData.shifts.length > 0) {
      return cachedData;
    }

    loadingRef.current = true;
    
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();

    try {
      const [shiftsData, sectionsData, patternsData] = await Promise.all([
        teamApi.listShifts(),
        orgApi.listSections(),
        shiftSchedulingApi.listShiftPatterns(effectiveSectionId)
      ]);

      const baseData = {
        shifts: shiftsData,
        sections: sectionsData,
        patterns: patternsData,
        scheduledShifts: [],
        sectionUsers: []
      };

      setCachedData(baseData);
      return { ...baseData, lastUpdated: new Date(), cacheKey };

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return null;
      }
      console.error('Failed to load base team data:', error);
      throw error;
    } finally {
      loadingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [canManageTeam, effectiveSectionId, getCachedData, setCachedData, cacheKey]);

  const loadScheduledShifts = useCallback(async () => {
    if (!canManageTeam || !effectiveSectionId) return [];

    try {
      const schedData = await teamApi.listScheduledShifts({
        start_date: format(dateRange.start, 'yyyy-MM-dd'),
        end_date: format(dateRange.end, 'yyyy-MM-dd'),
        section_id: effectiveSectionId,
      });

      // Update cache with new scheduled shifts
      const existingCache = teamDataCache.get(cacheKey);
      if (existingCache) {
        setCachedData({
          ...existingCache,
          scheduledShifts: schedData
        });
      }

      return schedData;
    } catch (error) {
      console.error('Failed to load scheduled shifts:', error);
      return [];
    }
  }, [canManageTeam, effectiveSectionId, dateRange, cacheKey, setCachedData]);

  const loadUsers = useCallback(async () => {
    if (!effectiveSectionId) return [];

    try {
      const users = await userApi.listUsersBySection(effectiveSectionId);

      // Update cache with new users
      const existingCache = teamDataCache.get(cacheKey);
      if (existingCache) {
        setCachedData({
          ...existingCache,
          sectionUsers: users
        });
      }

      return users;
    } catch (error) {
      console.error('Failed to load users:', error);
      return [];
    }
  }, [effectiveSectionId, cacheKey, setCachedData]);

  const refreshData = useCallback(async () => {
    try {
      const baseData = await loadBaseData(true);
      const [scheduledShifts, sectionUsers] = await Promise.all([
        loadScheduledShifts(),
        loadUsers()
      ]);

      return {
        ...baseData,
        scheduledShifts,
        sectionUsers
      };
    } catch (error) {
      console.error('Failed to refresh data:', error);
      throw error;
    }
  }, [loadBaseData, loadScheduledShifts, loadUsers]);

  const clearCache = useCallback(() => {
    teamDataCache.clear();
  }, []);

  // Memoized current data
  const currentData = useMemo(() => {
    const cached = teamDataCache.get(cacheKey);
    return cached || {
      shifts: [],
      scheduledShifts: [],
      sectionUsers: [],
      sections: [],
      patterns: [],
      lastUpdated: new Date(),
      cacheKey
    };
  }, [cacheKey]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    data: currentData,
    loading: loadingRef.current,
    refreshData,
    loadBaseData,
    loadScheduledShifts,
    loadUsers,
    clearCache,
    isDataCached: teamDataCache.has(cacheKey)
  };
};
