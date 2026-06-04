import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import appSettingsApi, { ApplicationTimezoneSetting } from '../services/appSettingsApi';
import { DEFAULT_APPLICATION_TIMEZONE, getApplicationTimeZone, setApplicationTimeZone } from '../utils/time';
import { useAuth } from './AuthContext';

interface AppConfigContextValue {
  applicationTimeZone: string;
  setting: ApplicationTimezoneSetting | null;
  loading: boolean;
  refreshApplicationTimeZone: () => Promise<void>;
  updateApplicationTimeZone: (timeZone: string) => Promise<ApplicationTimezoneSetting>;
}

const AppConfigContext = createContext<AppConfigContextValue | undefined>(undefined);

export const AppConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [applicationTimeZone, setApplicationTimeZoneState] = useState(getApplicationTimeZone());
  const [setting, setSetting] = useState<ApplicationTimezoneSetting | null>(null);
  const [loading, setLoading] = useState(false);

  const applySetting = useCallback((nextSetting: ApplicationTimezoneSetting) => {
    const nextTimeZone = setApplicationTimeZone(nextSetting.timezone || DEFAULT_APPLICATION_TIMEZONE);
    setApplicationTimeZoneState(nextTimeZone);
    setSetting({ ...nextSetting, timezone: nextTimeZone });
  }, []);

  const refreshApplicationTimeZone = useCallback(async () => {
    if (!user) {
      const fallback = setApplicationTimeZone(getApplicationTimeZone() || DEFAULT_APPLICATION_TIMEZONE);
      setApplicationTimeZoneState(fallback);
      return;
    }
    setLoading(true);
    try {
      const nextSetting = await appSettingsApi.getTimezone();
      applySetting(nextSetting);
    } catch (error) {
      const fallback = setApplicationTimeZone(getApplicationTimeZone() || DEFAULT_APPLICATION_TIMEZONE);
      setApplicationTimeZoneState(fallback);
    } finally {
      setLoading(false);
    }
  }, [applySetting, user]);

  const updateApplicationTimeZone = useCallback(
    async (timeZone: string) => {
      const nextSetting = await appSettingsApi.updateTimezone(timeZone);
      applySetting(nextSetting);
      return nextSetting;
    },
    [applySetting],
  );

  useEffect(() => {
    void refreshApplicationTimeZone();
  }, [refreshApplicationTimeZone]);

  const value = useMemo(
    () => ({
      applicationTimeZone,
      setting,
      loading,
      refreshApplicationTimeZone,
      updateApplicationTimeZone,
    }),
    [applicationTimeZone, loading, refreshApplicationTimeZone, setting, updateApplicationTimeZone],
  );

  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
};

export const useAppConfig = () => {
  const context = useContext(AppConfigContext);
  if (!context) {
    throw new Error('useAppConfig must be used inside AppConfigProvider.');
  }
  return context;
};
