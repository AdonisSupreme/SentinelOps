import { useAccess, ModuleAccess } from '../contexts/AccessContext';
import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FaBolt,
  FaBroadcastTower,
  FaDownload,
  FaPlus,
  FaSearch,
  FaShieldAlt,
  FaSignal,
  FaSyncAlt,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useAuth } from '../contexts/AuthContext';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useNotifications } from '../contexts/NotificationContext';
import { getApplicationDateBucket, parseSentinelTimestamp } from '../utils/time';
import { resolveWebSocketBaseUrl } from '../config/env';
import {
  NetworkCommandCenterResponse,
  NetworkEvent,
  NetworkInvestigationResponse,
  NetworkServiceCard,
  ServiceHistoryRow,
  networkSentinelApi,
} from '../services/networkSentinelApi';
import {
  LatencyChart,
  SignalBand,
  Status,
  deriveSamplesFromRawRows,
  deriveOverview,
  formatDateTime,
  formatDuration,
  formatLatency,
  formatPercent,
  formatSince,
  patchLiveService,
  stabilizeNetworkServices,
  statusClass,
  statusPriority,
} from './NetworkSentinelPage.helpers';
import './NetworkSentinelPage.css';
import './NetworkSentinelRefresh.css';
import NetworkDialog from './NetworkDialog';
import { connectNetworkStream, NetworkConnectionState } from '../services/networkLive';

type DetailTab = 'signal' | 'timeline' | 'evidence';

const ALL_GROUPS = '__ALL_GROUPS__';
const UNGROUPED_GROUP = '__UNGROUPED__';
const isDetailTab = (value: string | null): value is DetailTab => value === 'signal' || value === 'timeline' || value === 'evidence';

const formatTargetKindLabel = (targetKind?: string | null) => {
  switch ((targetKind || 'SERVICE').toUpperCase()) {
    case 'CHANNEL':
      return 'Channel';
    case 'VPN':
      return 'VPN';
    case 'NETWORK':
      return 'Network';
    default:
      return 'Service';
  }
};

const normalizeGroupValue = (groupName?: string | null) => (groupName && groupName.trim() ? groupName : UNGROUPED_GROUP);
const formatGroupLabel = (groupName?: string | null) => (groupName && groupName.trim() ? groupName : 'Ungrouped');
const formatNetworkEndpoint = (service: NetworkServiceCard) => `${service.address}${service.port ? `:${service.port}` : ''}`;
const formatMonitorMode = (service: NetworkServiceCard) => {
  if (service.check_icmp && service.check_tcp) return 'ICMP + TCP';
  if (service.check_tcp) return 'TCP only';
  if (service.check_icmp) return 'ICMP only';
  return 'Passive';
};
const formatLatencyPair = (service: NetworkServiceCard) => {
  const icmp = service.check_icmp ? formatLatency(service.status?.icmp_latency_ms) : null;
  const tcp = service.check_tcp ? formatLatency(service.status?.tcp_latency_ms) : null;
  if (icmp && tcp) return `${icmp} / ${tcp}`;
  if (tcp) return tcp;
  if (icmp) return icmp;
  return 'No probe';
};
const formatServicePosture = (service: NetworkServiceCard) => {
  const status = service.status?.overall_status || 'UNKNOWN';
  if (!service.enabled) return 'Disabled';
  if (service.active_outage) return 'Incident active';
  if (status === 'DOWN' || status === 'DEGRADED') return 'Needs review';
  if (service.allow_ttl_expired) return 'Tunnel aware';
  if (status === 'UP') return 'Nominal';
  return 'Awaiting signal';
};
const sortNetworkServices = (services: NetworkServiceCard[]) => [...services].sort((left, right) => {
  const leftPriority = statusPriority[(left.status?.overall_status || 'UNKNOWN') as Status];
  const rightPriority = statusPriority[(right.status?.overall_status || 'UNKNOWN') as Status];
  return leftPriority === rightPriority ? left.name.localeCompare(right.name) : rightPriority - leftPriority;
});

const NetworkSentinelPage: React.FC = () => {
  const { user } = useAuth();
  const { canAccessModule } = useAccess();
  const canMonitoring = canAccessModule('network_sentinel.monitoring');
  const canHistory = canAccessModule('network_sentinel.outage_history');
  const { applicationTimeZone } = useAppConfig();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const isManagerOrAdmin = canAccessModule('network_sentinel.configuration') && ['admin', 'manager'].includes((user?.role || '').toLowerCase());
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [snapshot, setSnapshot] = useState<NetworkCommandCenterResponse | null>(null);
  const [investigation, setInvestigation] = useState<NetworkInvestigationResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<NetworkConnectionState>('connecting');
  const [clock, setClock] = useState(Date.now());
  const [detailError, setDetailError] = useState<string | null>(null);
  const snapshotInFlight = useRef<Promise<NetworkCommandCenterResponse> | null>(null);
  const connectionRef = useRef(connection);
  connectionRef.current = connection;
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(canMonitoring ? 'signal' : 'timeline');
  const [serviceQuery, setServiceQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>(ALL_GROUPS);
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL');
  const [rawSearch, setRawSearch] = useState('');
  const [evidenceDownloading, setEvidenceDownloading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [checkNowBusy, setCheckNowBusy] = useState(false);
  const [manualResult, setManualResult] = useState<{serviceId:string; status:string; reason:string | null; checkedAt:string} | null>(null);
  const investigationSequence = useRef(0);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [todayEventsOpen, setTodayEventsOpen] = useState(false);
  const [outageLedgerOpen, setOutageLedgerOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '', address: '', port: '', environment: '', group_name: '', tags: '',
    timeout_ms: '3000', interval_seconds: '10', check_icmp: true, check_tcp: true, enabled: true, notes: '',
    target_kind: 'SERVICE', allow_ttl_expired: false,
  });
  const requestedServiceId = searchParams.get('service');
  const requestedTab = searchParams.get('tab');

  const deferredQuery = useDeferredValue(serviceQuery);
  const detailRefreshTimerRef = useRef<number | null>(null);
  const snapshotRefreshTimerRef = useRef<number | null>(null);
  const hasInitializedGroupRef = useRef(false);
  const lastLocallySyncedServiceRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const investigationInFlightRef = useRef<string | null>(null);
  const lastInvestigationLoadedAtRef = useRef<{ serviceId: string; at: number } | null>(null);
  const scheduleSnapshotRefreshRef = useRef<() => void>(() => undefined);
  const scheduleInvestigationRefreshRef = useRef<(serviceId: string) => void>(() => undefined);

  const getRequestErrorMessage = useCallback((err: any, fallback: string) => {
    const detail = err?.response?.data?.detail;
    const message = err?.response?.data?.message;
    const errorText = err?.response?.data?.error;

    if (typeof detail === 'string' && detail.trim()) return detail.trim();
    if (typeof message === 'string' && message.trim()) return message.trim();
    if (typeof errorText === 'string' && errorText.trim()) return errorText.trim();
    if (err?.response?.status === 403) return 'You do not have permission to perform that Network Sentinel action.';
    if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
    return fallback;
  }, []);

  const loadCommandCenter = useCallback(async (showSpinner = false) => {
    if (snapshotInFlight.current) return snapshotInFlight.current;
    if (showSpinner) setLoading(true);
    const request = networkSentinelApi.getCommandCenter(!showSpinner).then(data => {
      setSnapshot(current => {
        const services = stabilizeNetworkServices(data.services, current?.services || []);
        return { ...data, services, overview: { ...deriveOverview(services), recent_event_count: data.overview.recent_event_count } };
      });
      setSelectedId(current => current && data.services.some(service => service.id === current) ? current : data.services[0]?.id || null);
      setError(null);
      return data;
    }).finally(() => { snapshotInFlight.current = null; setLoading(false); });
    snapshotInFlight.current = request;
    return request;
  }, []);

  const loadInvestigation = useCallback(async (serviceId: string, silent = false) => {
    if (!canMonitoring && !canHistory) return;
    const now = Date.now();
    if (silent && investigationInFlightRef.current === serviceId) return;
    if (
      silent
      && lastInvestigationLoadedAtRef.current?.serviceId === serviceId
      && now - lastInvestigationLoadedAtRef.current.at < 1800
    ) {
      return;
    }

    const requestSequence = ++investigationSequence.current;
    investigationInFlightRef.current = serviceId;
    if (!silent) setInvestigationLoading(true);
    try {
      const data = await networkSentinelApi.getServiceInvestigation(serviceId);
      if (selectedIdRef.current !== serviceId || requestSequence !== investigationSequence.current) return;
      setInvestigation(current => ({ ...data, service: stabilizeNetworkServices([data.service], current?.service.id === serviceId ? [current.service] : [])[0] }));
      setDetailError(null);
      lastInvestigationLoadedAtRef.current = { serviceId, at: Date.now() };
    } catch (err) {
      if (selectedIdRef.current === serviceId && requestSequence === investigationSequence.current) setDetailError('Diagnostics could not refresh. Last received evidence is retained.');
    } finally {
      if (requestSequence === investigationSequence.current) {
        investigationInFlightRef.current = null;
      }
      if (requestSequence === investigationSequence.current) setInvestigationLoading(false);
    }
  }, [canMonitoring, canHistory]);

  useEffect(() => {
    loadCommandCenter(true).catch(() => {
      setError('Network Sentinel could not load its command-center snapshot.');
      setLoading(false);
    });
  }, [loadCommandCenter]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    setInvestigation(null);
    setDetailError(null);
    if (selectedId) loadInvestigation(selectedId).catch(() => undefined);
  }, [loadInvestigation, selectedId]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!requestedTab) return;
    if (requestedTab === 'signal' || requestedTab === 'timeline' || requestedTab === 'evidence') {
      setTab((current) => (current === requestedTab ? current : requestedTab));
    }
  }, [requestedTab]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedId) nextParams.set('service', selectedId);
    else nextParams.delete('service');
    if (tab !== 'signal' && canHistory) nextParams.set('tab', tab);
    else nextParams.delete('tab');

    if (nextParams.toString() !== searchParams.toString()) {
      lastLocallySyncedServiceRef.current = selectedId;
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedId, setSearchParams, tab, canHistory]);

  useEffect(() => {
    const poller = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      if (!selectedIdRef.current) return;
      loadInvestigation(selectedIdRef.current, true).catch(() => undefined);
    }, 30000);
    return () => window.clearInterval(poller);
  }, [loadInvestigation]);

  const scheduleSnapshotRefresh = useCallback(() => {
    if (snapshotRefreshTimerRef.current) return;
    snapshotRefreshTimerRef.current = window.setTimeout(() => {
      snapshotRefreshTimerRef.current = null;
      loadCommandCenter().catch(() => undefined);
    }, 1800);
  }, [loadCommandCenter]);

  const scheduleInvestigationRefresh = useCallback((serviceId: string) => {
    if (detailRefreshTimerRef.current) return;
    detailRefreshTimerRef.current = window.setTimeout(() => {
      detailRefreshTimerRef.current = null;
      if (selectedIdRef.current !== serviceId) return;
      loadInvestigation(serviceId, true).catch(() => undefined);
    }, 4000);
  }, [loadInvestigation]);

  useEffect(() => {
    scheduleSnapshotRefreshRef.current = scheduleSnapshotRefresh;
  }, [scheduleSnapshotRefresh]);

  useEffect(() => {
    scheduleInvestigationRefreshRef.current = scheduleInvestigationRefresh;
  }, [scheduleInvestigationRefresh]);

  useEffect(() => {
    const ticker = window.setInterval(() => setClock(Date.now()), 5000);
    let lastSync = Date.now();
    const reconcile = () => {
      if (document.visibilityState === 'hidden') return;
      const fallback = connectionRef.current !== 'live';
      if (Date.now() - lastSync >= (fallback ? 15000 : 60000)) {
        lastSync = Date.now();
        loadCommandCenter().catch(() => setError('Fleet refresh failed. Displaying the last received readings.'));
      }
    };
    const timer = window.setInterval(reconcile, 5000);
    const resume = () => { if (document.visibilityState === 'visible') { lastSync = 0; reconcile(); } };
    document.addEventListener('visibilitychange', resume);
    return () => { window.clearInterval(timer); window.clearInterval(ticker); document.removeEventListener('visibilitychange', resume); };
  }, [loadCommandCenter]);

  useEffect(() => {
    if (!canMonitoring) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const stop = connectNetworkStream(`${resolveWebSocketBaseUrl()}/api/v1/network-sentinel/ws?token=${encodeURIComponent(token)}`, message => {
      if (message.data?.engine_health) setSnapshot(current => current ? { ...current, engine: message.data.engine_health } : current);
      if (message.type === 'CONNECTION_ESTABLISHED') scheduleSnapshotRefreshRef.current();
      if (message.type === 'SERVICE_EVIDENCE_UPDATED') {
        scheduleSnapshotRefreshRef.current();
        if (selectedIdRef.current === message.data?.service_id) scheduleInvestigationRefreshRef.current(message.data.service_id);
      }
      if (message.type !== 'SERVICE_STATUS_UPDATED') return;
      const update = message.data || {};
      setSnapshot(current => {
        if (!current) return current;
        const services = current.services.map(service => service.id === update.service_id ? patchLiveService(service, update) : service);
        return { ...current, services, overview: { ...deriveOverview(services), recent_event_count: current.overview.recent_event_count } };
      });
      if (selectedIdRef.current === update.service_id) {
        setInvestigation(current => current && current.service.id === update.service_id ? { ...current, service: patchLiveService(current.service, update) } : current);
        // Refresh retained evidence at a bounded cadence, not once per probe.
        if (Date.now() - (lastInvestigationLoadedAtRef.current?.at || 0) > 15000) scheduleInvestigationRefreshRef.current(update.service_id);
      }
    }, setConnection);
    return () => {
      stop();
      if (detailRefreshTimerRef.current) window.clearTimeout(detailRefreshTimerRef.current);
      if (snapshotRefreshTimerRef.current) window.clearTimeout(snapshotRefreshTimerRef.current);
    };
  }, [canMonitoring]);

  const environments = useMemo(() => Array.from(new Set((snapshot?.services || []).map((service) => service.environment).filter(Boolean) as string[])).sort(), [snapshot?.services]);
  const environmentScopedServices = useMemo(
    () => (snapshot?.services || []).filter((service) => !environmentFilter || service.environment === environmentFilter),
    [environmentFilter, snapshot?.services],
  );
  const groups = useMemo(
    () => Array.from(new Set(environmentScopedServices.map((service) => normalizeGroupValue(service.group_name)))).sort(),
    [environmentScopedServices],
  );

  const filterServices = useCallback((services: NetworkServiceCard[], options?: {
    status?: 'ALL' | Status;
    environment?: string;
    group?: string;
    query?: string;
  }) => {
    const nextStatus = options?.status ?? statusFilter;
    const nextEnvironment = options?.environment ?? environmentFilter;
    const nextGroup = options?.group ?? groupFilter;
    const nextQuery = (options?.query ?? deferredQuery).trim().toLowerCase();

    return sortNetworkServices(
      services.filter((service) => {
        const status = (service.status?.overall_status || 'UNKNOWN') as Status;
        if (nextStatus !== 'ALL' && status !== nextStatus) return false;
        if (nextEnvironment && service.environment !== nextEnvironment) return false;
        if (nextGroup !== ALL_GROUPS && normalizeGroupValue(service.group_name) !== nextGroup) return false;
        if (!nextQuery) return true;
        const haystack = `${service.name} ${service.address} ${service.notes || ''} ${(service.tags || []).join(' ')}`.toLowerCase();
        return haystack.includes(nextQuery);
      }),
    );
  }, [deferredQuery, environmentFilter, groupFilter, statusFilter]);

  const resolveNextSelectedId = useCallback((
    services: NetworkServiceCard[],
    preferredCurrentId?: string | null,
    preferredRequestedId?: string | null,
  ) => {
    if (preferredCurrentId && services.some((service) => service.id === preferredCurrentId)) {
      return preferredCurrentId;
    }
    if (preferredRequestedId && services.some((service) => service.id === preferredRequestedId)) {
      return preferredRequestedId;
    }
    return services[0]?.id || null;
  }, []);

  const handleEnvironmentFilterChange = useCallback((nextEnvironment: string) => {
    hasInitializedGroupRef.current = true;
    setEnvironmentFilter(nextEnvironment);
    const scopedServices = (snapshot?.services || []).filter((service) => !nextEnvironment || service.environment === nextEnvironment);
    const scopedGroups = Array.from(new Set(scopedServices.map((service) => normalizeGroupValue(service.group_name)))).sort();
    const nextGroup = groupFilter !== ALL_GROUPS && scopedGroups.includes(groupFilter)
      ? groupFilter
      : ALL_GROUPS;
    setGroupFilter(nextGroup);
    const visibleServices = filterServices(snapshot?.services || [], { environment: nextEnvironment, group: nextGroup });
    const nextSelectedId = resolveNextSelectedId(visibleServices, selectedId, requestedServiceId);
    if (nextSelectedId) {
      lastLocallySyncedServiceRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
    }
  }, [filterServices, groupFilter, requestedServiceId, resolveNextSelectedId, selectedId, snapshot?.services]);

  const handleGroupFilterChange = useCallback((nextGroup: string) => {
    hasInitializedGroupRef.current = true;
    setGroupFilter(nextGroup);
    const visibleServices = filterServices(snapshot?.services || [], { group: nextGroup });
    const nextSelectedId = resolveNextSelectedId(visibleServices, selectedId, requestedServiceId);
    if (nextSelectedId) {
      lastLocallySyncedServiceRef.current = nextSelectedId;
      setSelectedId(nextSelectedId);
    }
  }, [filterServices, requestedServiceId, resolveNextSelectedId, selectedId, snapshot?.services]);

  const focusService = useCallback((serviceId: string, nextTab: DetailTab = 'signal') => {
    const service = snapshot?.services.find((entry) => entry.id === serviceId);
    if (!service) return;
    const nextGroup = normalizeGroupValue(service.group_name);
    lastLocallySyncedServiceRef.current = serviceId;
    if ((service.environment || '') !== environmentFilter) {
      setEnvironmentFilter(service.environment || '');
    }
    setGroupFilter(nextGroup);
    hasInitializedGroupRef.current = true;
    setSelectedId(serviceId);
    setTab(nextTab);
  }, [environmentFilter, snapshot?.services]);

  useEffect(() => {
    if (!snapshot?.services?.length || !requestedServiceId) return;
    if (requestedServiceId === selectedIdRef.current) return;
    if (requestedServiceId === lastLocallySyncedServiceRef.current) return;
    if (!snapshot.services.some((service) => service.id === requestedServiceId)) return;
    focusService(requestedServiceId, isDetailTab(requestedTab) ? requestedTab : 'signal');
  }, [focusService, requestedServiceId, requestedTab, snapshot?.services]);

  useEffect(() => {
    if (!environmentScopedServices.length) {
      setGroupFilter(ALL_GROUPS);
      hasInitializedGroupRef.current = false;
      return;
    }

    const requestedService = requestedServiceId
      ? environmentScopedServices.find((service) => service.id === requestedServiceId) || null
      : null;
    const requestedGroup = requestedService ? normalizeGroupValue(requestedService.group_name) : null;

    if (!hasInitializedGroupRef.current) {
      setGroupFilter(requestedGroup && groups.includes(requestedGroup) ? requestedGroup : ALL_GROUPS);
      hasInitializedGroupRef.current = true;
      return;
    }

    if (groupFilter !== ALL_GROUPS && !groups.includes(groupFilter)) {
      setGroupFilter(requestedGroup && groups.includes(requestedGroup) ? requestedGroup : ALL_GROUPS);
    }
  }, [environmentScopedServices, groupFilter, groups, requestedServiceId]);

  const filteredServices = useMemo(
    () => filterServices(snapshot?.services || []),
    [filterServices, snapshot?.services],
  );

  useEffect(() => {
    if (!filteredServices.length) return;
    if (selectedId && filteredServices.some((service) => service.id === selectedId)) return;
    if (requestedServiceId && filteredServices.some((service) => service.id === requestedServiceId)) {
      setSelectedId(requestedServiceId);
      return;
    }
    lastLocallySyncedServiceRef.current = filteredServices[0].id;
    setSelectedId(filteredServices[0].id);
  }, [filteredServices, requestedServiceId, selectedId]);

  const selectedCard = useMemo<NetworkServiceCard | null>(() => {
    if (investigation?.service.id === selectedId) {
      const latest = snapshot?.services.find(service => service.id === selectedId);
      return stabilizeNetworkServices([investigation.service], latest ? [latest] : [])[0];
    }
    return snapshot?.services.find((service) => service.id === selectedId) || null;
  }, [investigation?.service, selectedId, snapshot?.services]);

  const rawRows = useMemo(() => {
    const rows = investigation?.raw_rows || [];
    return rawSearch.trim() ? rows.filter((row) => row.raw.toLowerCase().includes(rawSearch.toLowerCase())) : rows;
  }, [investigation?.raw_rows, rawSearch]);

  const normalizedSamples = useMemo(() => {
    const sampled = investigation?.samples || [];
    return sampled.length ? sampled : deriveSamplesFromRawRows(investigation?.raw_rows || []);
  }, [investigation?.raw_rows, investigation?.samples]);

  const signalLabel = useMemo(() => {
    if (investigation?.samples.length) return `${investigation.samples.length} sampled points`;
    if (normalizedSamples.length) return `${normalizedSamples.length} evidence-derived points`;
    return '0 points';
  }, [investigation?.samples, normalizedSamples.length]);

  const latestEvidenceAt = useMemo(() => {
    const rows = investigation?.raw_rows || [];
    const latestRow = rows[rows.length - 1];
    return latestRow?.timestamp || null;
  }, [investigation?.raw_rows]);

  const isInTodayWindow = useCallback((startedAt?: string | null, endedAt?: string | null) => {
    if (!startedAt) return false;
    const activeDisplayTimeZone = applicationTimeZone;
    if (!activeDisplayTimeZone) return false;
    const todayBucket = getApplicationDateBucket(new Date());
    const start = parseSentinelTimestamp(startedAt);
    const end = endedAt ? parseSentinelTimestamp(endedAt) : new Date();
    if (!start || !end) return false;
    return getApplicationDateBucket(start) <= todayBucket && getApplicationDateBucket(end) >= todayBucket;
  }, [applicationTimeZone]);

  const todaysOutages = useMemo(() => {
    return (investigation?.outages || []).filter((outage) => isInTodayWindow(outage.started_at, outage.ended_at));
  }, [investigation?.outages, isInTodayWindow]);

  const historicalOutages = useMemo(() => {
    const todayIds = new Set(todaysOutages.map((outage) => outage.id));
    return (investigation?.outages || []).filter((outage) => !todayIds.has(outage.id));
  }, [investigation?.outages, todaysOutages]);

  const todaysEvents = useMemo(() => {
    return (investigation?.events || []).filter((event) => isInTodayWindow(event.created_at, event.created_at));
  }, [investigation?.events, isInTodayWindow]);

  const historicalEvents = useMemo(() => {
    const todayIds = new Set(todaysEvents.map((event) => event.id));
    return (investigation?.events || []).filter((event) => !todayIds.has(event.id));
  }, [investigation?.events, todaysEvents]);

  const runRefresh = async () => {
    try {
      const data = await loadCommandCenter();
      const focusId = selectedId || data.services[0]?.id;
      if (focusId) await loadInvestigation(focusId, true);
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Network Sentinel could not refresh right now.'),
        priority: 'high',
      });
    }
  };

  const runCheckNow = async () => {
    if (!selectedId || checkNowBusy) return;
    setCheckNowBusy(true);
    try {
      const result = await networkSentinelApi.checkNow(selectedId);
      setManualResult({ serviceId:selectedId, status:result.overall_status, reason:result.reason, checkedAt:result.checked_at });
      addNotification({
        type: 'success',
        message: 'Manual network check recorded successfully.',
        priority: 'medium',
      });
      await runRefresh();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Manual check failed.'),
        priority: 'high',
      });
    } finally {
      setCheckNowBusy(false);
    }
  };

  const toggleEnabled = async () => {
    if (!selectedCard || toggleBusy) return;
    setToggleBusy(true);
    try {
      await networkSentinelApi.setEnabled(selectedCard.id, !selectedCard.enabled);
      addNotification({
        type: 'success',
        message: `${selectedCard.name} ${selectedCard.enabled ? 'disabled' : 'enabled'} successfully.`,
        priority: 'medium',
      });
      await runRefresh();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Failed to update monitoring state.'),
        priority: 'high',
      });
    } finally {
      setToggleBusy(false);
    }
  };

  const downloadEvidenceText = async () => {
    if (!selectedId || evidenceDownloading) return;
    setEvidenceDownloading(true);
    try {
      await networkSentinelApi.downloadHistoryText(selectedId);
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Failed to prepare the evidence extract.'),
        priority: 'high',
      });
    } finally {
      setEvidenceDownloading(false);
    }
  };

  const openCreate = () => {
    setEditorMode('create');
    setServiceForm({
      name: '',
      address: '',
      port: '',
      environment: '',
      group_name: '',
      tags: '',
      timeout_ms: '3000',
      interval_seconds: '10',
      check_icmp: true,
      check_tcp: true,
      enabled: true,
      notes: '',
      target_kind: 'SERVICE',
      allow_ttl_expired: false,
    });
    setEditorOpen(true);
  };
  const openEdit = () => {
    if (!selectedCard) return;
    setEditorMode('edit');
    setServiceForm({
      name: selectedCard.name, address: selectedCard.address, port: selectedCard.port ? String(selectedCard.port) : '',
      environment: selectedCard.environment || '', group_name: selectedCard.group_name || '', tags: (selectedCard.tags || []).join(', '),
      timeout_ms: String(selectedCard.timeout_ms || 3000), interval_seconds: String(selectedCard.interval_seconds || 10),
      check_icmp: !!selectedCard.check_icmp, check_tcp: !!selectedCard.check_tcp, enabled: !!selectedCard.enabled, notes: selectedCard.notes || '',
      target_kind: selectedCard.target_kind || 'SERVICE', allow_ttl_expired: !!selectedCard.allow_ttl_expired,
    });
    setEditorOpen(true);
  };

  const submitServiceForm = async () => {
    if (saveBusy) return;
    const payload = {
      name: serviceForm.name.trim(), address: serviceForm.address.trim(), port: serviceForm.port ? Number(serviceForm.port) : null,
      environment: serviceForm.environment || null, group_name: serviceForm.group_name || null,
      tags: serviceForm.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      timeout_ms: Number(serviceForm.timeout_ms || 3000), interval_seconds: Number(serviceForm.interval_seconds || 10),
      check_icmp: serviceForm.check_icmp, check_tcp: serviceForm.check_tcp, enabled: serviceForm.enabled, notes: serviceForm.notes || null,
      target_kind: serviceForm.target_kind,
      allow_ttl_expired: serviceForm.allow_ttl_expired,
    };
    setSaveBusy(true);
    try {
      if (editorMode === 'create') {
        await networkSentinelApi.createService(payload);
        addNotification({ type: 'success', message: 'Service added to Network Sentinel.', priority: 'medium' });
      } else if (selectedCard) {
        await networkSentinelApi.updateService(selectedCard.id, payload);
        addNotification({ type: 'success', message: 'Service configuration updated.', priority: 'medium' });
      }
      setEditorOpen(false);
      await runRefresh();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Failed to save the service configuration.'),
        priority: 'high',
      });
    } finally {
      setSaveBusy(false);
    }
  };

  const deleteService = async () => {
    if (!selectedCard || !isAdmin || !window.confirm(`Delete ${selectedCard.name}?`)) return;
    if (deleteBusy) return;
    setDeleteBusy(true);
    try {
      await networkSentinelApi.deleteService(selectedCard.id);
      addNotification({ type: 'success', message: 'Service removed from Network Sentinel.', priority: 'medium' });
      setInvestigation(null);
      setSelectedId(null);
      await loadCommandCenter();
    } catch (err: any) {
      addNotification({
        type: 'error',
        message: getRequestErrorMessage(err, 'Failed to delete the service.'),
        priority: 'high',
      });
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="network-sentinel-page network-modern">
      <div className="network-surface" />
      <section className="network-hero-panel network-shell">
        <div className="hero-copy">
          <div className="eyebrow"><FaSignal />Network Sentinel</div>
          <h1>Every signal. In focus.</h1>
          <p>Monitor reachability, investigate changes, and follow the evidence.</p>
          <div className="hero-actions">
            <button className="primary-action" onClick={runRefresh}><FaSyncAlt /> Refresh</button>
            {isManagerOrAdmin ? <button className="secondary-action" onClick={openCreate}><FaPlus /> Add Service</button> : null}
          </div>
        </div>
        <div className="network-command-rail">
          <div>
            <span>Engine</span>
            <strong>{loading ? 'Connecting' : snapshot?.engine.online ? 'Online' : 'Offline'}</strong>
          </div>
          <div>
            <span>Live connection</span>
            <strong className={`connection-state ${connection}`}>{canMonitoring ? ({live:'Streaming', connecting:'Connecting', reconnecting:'Reconnecting  -  polling', offline:'Engine offline', denied:'Access changed'})[connection] : 'History view'}</strong>
          </div>
          <div>
            <span>Evidence window</span>
            <strong>{snapshot?.retention.raw_history_days ?? 2}d raw / {snapshot?.retention.event_history_days ?? 14}d events</strong>
          </div>
        </div>
      </section>

      {error ? <div className="network-shell status-banner error-banner">{error}</div> : null}

      <section className="network-toolbar network-shell">
        <label className="toolbar-search"><FaSearch /><input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search service, address, tag or note..." /></label>
        <select aria-label="Status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | Status)}><option value="ALL">All status</option><option value="UP">UP</option><option value="DEGRADED">DEGRADED</option><option value="DOWN">DOWN</option><option value="UNKNOWN">UNKNOWN</option></select>
        <select aria-label="Environment" value={environmentFilter} onChange={(event) => handleEnvironmentFilterChange(event.target.value)}><option value="">All environments</option>{environments.map((environment) => <option key={environment} value={environment}>{environment}</option>)}</select>
        <select aria-label="Service group" value={groupFilter} onChange={(event) => handleGroupFilterChange(event.target.value)}><option value={ALL_GROUPS}>All groups</option>{groups.map((group) => <option key={group} value={group}>{group === UNGROUPED_GROUP ? 'Ungrouped' : group}</option>)}</select>
      </section>

      <section className="network-pulse" aria-label="Fleet status filters">
        {([['ALL', 'All services', snapshot?.overview.total_services], ['UP', 'Healthy', snapshot?.overview.up_services], ['DEGRADED', 'Degraded', snapshot?.overview.degraded_services], ['DOWN', 'Down', snapshot?.overview.down_services], ['UNKNOWN', 'Awaiting signal', snapshot?.overview.unknown_services]] as const).map(([value, label, count]) => <button key={value} className={`${value.toLowerCase()} ${statusFilter === value ? 'active' : ''}`} onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value}><span>{label}</span><strong>{loading ? '...' : count ?? 0}</strong></button>)}
      </section>

      <div className="network-layout">
        <section className="fleet-column">
          <div className="service-grid">
            {loading ? <div className="network-skeleton" role="status" aria-label="Loading network services"><i /><i /><i /><i /></div> : null}
            {!loading && !filteredServices.length ? <div className="list-empty">{snapshot?.services.length ? 'No services match these filters.' : 'No services configured yet.'}</div> : null}
            {filteredServices.map((service) => {
              const checkedAt = parseSentinelTimestamp(service.status?.last_checked_at);
              const stale = service.enabled && (!checkedAt || clock - checkedAt.getTime() > Math.max(30000, service.interval_seconds * 3000 + service.timeout_ms));
              const status = !service.enabled ? 'PAUSED' : stale ? 'STALE' : service.status?.overall_status || 'UNKNOWN';
              return (
                <button
                  key={service.id}
                  className={`service-node network-shell ${statusClass(status)} ${selectedId === service.id ? 'selected' : ''}`}
                  onClick={() => focusService(service.id)}
                >
                  <div className="network-service-command">
                    <span className={`network-service-dot ${statusClass(status)}`} />
                    <div>
                      <span>{formatGroupLabel(service.group_name)} / {formatTargetKindLabel(service.target_kind)}</span>
                      <h3>{service.name}</h3>
                    </div>
                    <strong className={`status-pill ${statusClass(status)}`}>{status}</strong>
                  </div>
                  <div className="network-service-endpoint">
                    <code>{formatNetworkEndpoint(service)}</code>
                    <span>{formatMonitorMode(service)}</span>
                  </div>
                  <ModuleAccess module="network_sentinel.monitoring"><div className="network-service-facts">
                    <div><span>Signal</span><strong>{formatLatencyPair(service)}</strong></div>
                    <div><span>24h sampled availability</span><strong>{formatPercent(service.metrics.uptime_percent_24h)}</strong></div>
                    <div><span>Last probe</span><strong>{service.status?.last_checked_at ? `${formatSince(service.status.last_checked_at)} ago` : 'Awaiting probe'}</strong></div>
                  </div></ModuleAccess>
                </button>
              );
            })}
          </div>

          <ModuleAccess module="network_sentinel.outage_history"><div className="subpanels">
            <div className="network-shell subpanel">
              <div className="network-subpanel-command">
                <div><span>Incident lane</span><h2>Active Incidents</h2></div>
                <strong>{snapshot?.active_outages.length ? `${snapshot.active_outages.length} open` : 'Clear'}</strong>
              </div>
              <div className="subpanel-list">
                {(snapshot?.active_outages || []).map((outage) => (
                  <button key={outage.id} className="list-row" onClick={() => outage.service_id && focusService(outage.service_id)}>
                    <div><strong>{outage.service_name || 'Unknown service'}</strong><span>{formatDateTime(outage.started_at)}</span></div>
                    <em>{formatDuration(outage.duration_seconds)}</em>
                  </button>
                ))}
                {!snapshot?.active_outages.length ? <div className="list-empty">No live incidents right now.</div> : null}
              </div>
            </div>
            <div className="network-shell subpanel">
              <div className="network-subpanel-command">
                <div><span>Event lane</span><h2>Major Events</h2></div>
                <strong>{snapshot?.recent_events.length ? `${snapshot.recent_events.length} retained` : 'Quiet'}</strong>
              </div>
              <div className="subpanel-list">
                {(snapshot?.recent_events || []).slice(0, 8).map((event: NetworkEvent) => (
                  <div key={event.id} className={`list-row event-row ${event.severity.toLowerCase()}`}>
                    <div><strong>{event.title}</strong><span>{event.service_name || 'Fleet'} - {formatDateTime(event.created_at)}</span></div>
                    <em>{event.severity}</em>
                  </div>
                ))}
                {!snapshot?.recent_events.length ? <div className="list-empty">Major events will appear here.</div> : null}
              </div>
            </div>
          </div></ModuleAccess>
        </section>

        <aside className="detail-column network-shell">
          {!selectedCard ? <div className="placeholder-card detail-placeholder"><FaShieldAlt /><p>Select a service to open its investigation deck.</p></div> : <>
            <div className="detail-head">
              <div>
                <span>{formatGroupLabel(selectedCard.group_name)} / {formatTargetKindLabel(selectedCard.target_kind)}</span>
                <h2>{selectedCard.name}</h2>
                <p>{formatNetworkEndpoint(selectedCard)}</p>
              </div>
              <strong className={`status-pill ${statusClass(selectedCard.status?.overall_status)}`}>{selectedCard.status?.overall_status || 'UNKNOWN'}</strong>
            </div>
            <div className="detail-actions">{isManagerOrAdmin ? <button onClick={runCheckNow} disabled={checkNowBusy}><FaBolt /> {checkNowBusy ? 'Checking...' : 'Check now'}</button> : null}{isManagerOrAdmin ? <button onClick={toggleEnabled} disabled={toggleBusy}>{toggleBusy ? 'Working...' : selectedCard.enabled ? 'Disable' : 'Enable'}</button> : null}{isManagerOrAdmin ? <button onClick={openEdit}>Edit</button> : null}{canMonitoring && (<button onClick={downloadEvidenceText} disabled={evidenceDownloading}><FaDownload /> {evidenceDownloading ? 'Preparing...' : 'Evidence TXT'}</button>)}{isAdmin ? <button className="danger-action" onClick={deleteService} disabled={deleteBusy}>{deleteBusy ? 'Deleting...' : 'Delete'}</button> : null}</div>
            {manualResult?.serviceId === selectedCard.id ? <div className="manual-probe-result" role="status"><strong>Manual check  -  {manualResult.status}</strong><span>{formatDateTime(manualResult.checkedAt)}{manualResult.reason ? `  -  ${manualResult.reason}` : ''}</span><button aria-label="Dismiss manual check result" onClick={() => setManualResult(null)}>Dismiss</button></div> : null}
            <ModuleAccess module="network_sentinel.monitoring"><div className="network-detail-strip">
              <div>
                <span><FaSignal /> Signal</span>
                <strong>{formatPercent(investigation?.metrics.availability_percent_24h ?? selectedCard.metrics.uptime_percent_24h)}</strong>
                <small>{formatLatencyPair(selectedCard)}</small>
              </div>
              <div>
                <span><FaBroadcastTower /> Probe</span>
                <strong>{formatMonitorMode(selectedCard)}</strong>
                <small>{selectedCard.allow_ttl_expired ? 'Transit TTL accepted' : 'Strict endpoint reply'}</small>
              </div>
              <div>
                <span><FaShieldAlt /> Posture</span>
                <strong>{formatServicePosture(selectedCard)}</strong>
                <small>Since {formatSince(selectedCard.status?.last_state_change_at)}</small>
              </div>
            </div></ModuleAccess>
            {(canMonitoring || canHistory) && <div className="detail-tabs">
              {canMonitoring && <button className={tab === 'signal' ? 'active' : ''} onClick={() => setTab('signal')}>Signal</button>}
              {canHistory && <button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button>}
              {canMonitoring && <button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}>Evidence</button>}
            </div>}
            {detailError ? <div className="status-banner error-banner" role="status">{detailError} <button onClick={() => selectedId && loadInvestigation(selectedId)}>Retry</button></div> : null}
            {investigationLoading ? <div className="network-shell inner-loading" role="status">Loading retained evidence...</div> : null}
            <div className="probe-freshness">Last probe: {selectedCard.status?.last_checked_at ? `${formatDateTime(selectedCard.status.last_checked_at)}  -  ${formatSince(selectedCard.status.last_checked_at)} ago` : 'No reading yet'}{selectedCard.status?.reason ? <span>{selectedCard.status.reason}</span> : null}</div>
            {tab === 'signal' ? <div className="tab-content"><div className="signal-panel"><div className="panel-head"><h3>Sampled Availability</h3><span>{signalLabel}</span></div><SignalBand samples={normalizedSamples} /></div><div className="signal-panel"><div className="panel-head"><h3>Latency Envelope</h3><span>{formatLatency(investigation?.metrics.avg_icmp_latency_ms_24h || investigation?.metrics.avg_tcp_latency_ms_24h)}</span></div><LatencyChart samples={normalizedSamples} /></div></div> : null}
            {tab === 'timeline' ? <div className="tab-content two-column"><div className="timeline-panel"><div className="panel-head"><div className="timeline-panel-title"><h3>Major Events Archive</h3><span>{historicalEvents.length}</span></div><button className="timeline-focus-button" onClick={() => setTodayEventsOpen(true)} type="button"><span>View today's events</span><strong>{todaysEvents.length}</strong></button></div><div className="timeline-list">{historicalEvents.map((event) => <div key={event.id} className={`timeline-entry ${event.severity.toLowerCase()}`}><strong>{event.title}</strong><span>{formatDateTime(event.created_at)}</span><p>{event.summary || 'No summary provided.'}</p></div>)}{!historicalEvents.length ? <div className="list-empty">Older retained major events will appear here after today's activity rolls over.</div> : null}</div></div><div className="timeline-panel"><div className="panel-head"><div className="timeline-panel-title"><h3>Outage Ledger Archive</h3><span>{historicalOutages.length}</span></div><button className="timeline-focus-button" onClick={() => setOutageLedgerOpen(true)} type="button"><span>View today's outages</span><strong>{todaysOutages.length}</strong></button></div><div className="timeline-list">{historicalOutages.map((outage) => <div key={outage.id} className={`timeline-entry ${outage.ended_at ? 'info' : 'critical'}`}><strong>{outage.ended_at ? 'Resolved incident' : 'Active incident'}</strong><span>{formatDateTime(outage.started_at)}</span><p>{outage.ended_at ? `Resolved in ${formatDuration(outage.duration_seconds)}` : `Ongoing for ${formatSince(outage.started_at)}`}</p></div>)}{!historicalOutages.length ? <div className="list-empty">Older retained outages will appear here once today's incidents roll over.</div> : null}</div></div></div> : null}
            {tab === 'evidence' ? <div className="tab-content"><div className="panel-head"><h3>Raw Evidence Window</h3><span>{investigation?.retention.raw_history_days ?? snapshot?.retention.raw_history_days ?? 2} day retention{latestEvidenceAt ? ` / Updated ${formatDateTime(latestEvidenceAt)}` : ''}</span></div><label className="toolbar-search compact"><FaSearch /><input value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} placeholder="Filter raw evidence..." /></label><div className="evidence-list">{rawRows.slice(-180).reverse().map((row: ServiceHistoryRow, index) => <div key={`${row.timestamp}-${index}`} className={`evidence-row ${statusClass(row.kind === 'OUTAGE_DETECTED' ? 'DOWN' : row.kind)}`}><span>{formatDateTime(row.timestamp)}</span><strong>{row.kind}</strong><code>{row.raw}</code></div>)}{!rawRows.length ? <div className="list-empty">No raw evidence retained in the current window.</div> : null}</div></div> : null}
          </>}
        </aside>
      </div>

      {canHistory && todayEventsOpen ? <NetworkDialog label="Today's major events" onClose={() => setTodayEventsOpen(false)}><div className="editor-card network-shell outage-ledger-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div className='my-div'><h3>Today's Major Events</h3><span>{selectedCard?.name || 'Focused asset'}</span></div><button type="button" onClick={() => setTodayEventsOpen(false)}>Close</button></div><div className="timeline-list outage-ledger-list">{todaysEvents.map((event) => <div key={event.id} className={`timeline-entry ${event.severity.toLowerCase()}`}><strong>{event.title}</strong><span>{formatDateTime(event.created_at)}</span><p>{event.summary || 'No summary provided.'}</p></div>)}{!todaysEvents.length ? <div className="list-empty">No major events recorded today for this service.</div> : null}</div></div></NetworkDialog> : null}
      {canHistory && outageLedgerOpen ? <NetworkDialog label="Today's outages" onClose={() => setOutageLedgerOpen(false)}><div className="editor-card network-shell outage-ledger-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div className='my-div'><h3>Today's Outages</h3><span>{selectedCard?.name || 'Focused asset'}</span></div><button type="button" onClick={() => setOutageLedgerOpen(false)}>Close</button></div><div className="timeline-list outage-ledger-list">{todaysOutages.map((outage) => <div key={outage.id} className={`timeline-entry ${outage.ended_at ? 'info' : 'critical'}`}><strong>{outage.ended_at ? 'Resolved incident' : 'Active incident'}</strong><span>{formatDateTime(outage.started_at)}</span><p>{outage.ended_at ? `Resolved in ${formatDuration(outage.duration_seconds)}` : `Ongoing for ${formatSince(outage.started_at)}`}</p></div>)}{!todaysOutages.length ? <div className="list-empty">No outages recorded today for this service.</div> : null}</div></div></NetworkDialog> : null}

      {editorOpen ? (
        <NetworkDialog label={editorMode === 'create' ? 'Add monitored service' : 'Edit monitored service'} onClose={() => { if (!saveBusy) setEditorOpen(false); }}>
          <div className="editor-card network-shell" onClick={(event) => event.stopPropagation()}>
            <div className="editor-card-head">
              <span>{editorMode === 'create' ? 'New monitor' : 'Monitor profile'}</span>
              <h3>{editorMode === 'create' ? 'Add Service' : 'Edit Service'}</h3>
              <p>{serviceForm.group_name || 'Network Sentinel'} / {serviceForm.target_kind.toLowerCase()}</p>
            </div>
            <div className="network-editor-strip">
              <div>
                <span>Monitor posture</span>
                <strong>{serviceForm.enabled ? 'Enabled' : 'Paused'}</strong>
                <small>{editorMode === 'create' ? 'New monitor profile' : 'Existing monitor profile'}</small>
              </div>
              <div>
                <span>Probe plan</span>
                <strong>{[serviceForm.check_icmp ? 'ICMP' : '', serviceForm.check_tcp ? 'TCP' : ''].filter(Boolean).join(' + ') || 'No probes'}</strong>
                <small>{serviceForm.allow_ttl_expired ? 'Transit TTL accepted' : 'Strict endpoint reply'}</small>
              </div>
              <div>
                <span>Cadence</span>
                <strong>{serviceForm.interval_seconds || 'Default'}{serviceForm.interval_seconds ? 's' : ''}</strong>
                <small>{serviceForm.timeout_ms || 'Default'} ms timeout</small>
              </div>
            </div>
            <div className="editor-grid">
              <label><span>Name</span><input placeholder="Name" value={serviceForm.name} onChange={(event) => setServiceForm((state) => ({ ...state, name: event.target.value }))} /></label>
              <label><span>Address</span><input placeholder="Address / Hostname" value={serviceForm.address} onChange={(event) => setServiceForm((state) => ({ ...state, address: event.target.value }))} /></label>
              <label><span>Port</span><input placeholder="Port" value={serviceForm.port} onChange={(event) => setServiceForm((state) => ({ ...state, port: event.target.value }))} /></label>
              <label><span>Kind</span><select value={serviceForm.target_kind} onChange={(event) => setServiceForm((state) => ({ ...state, target_kind: event.target.value }))}><option value="SERVICE">Service</option><option value="CHANNEL">Channel</option><option value="VPN">VPN</option><option value="NETWORK">Network Path</option></select></label>
              <label><span>Environment</span><input placeholder="Environment" value={serviceForm.environment} onChange={(event) => setServiceForm((state) => ({ ...state, environment: event.target.value }))} /></label>
              <label><span>Group</span><input placeholder="Group" value={serviceForm.group_name} onChange={(event) => setServiceForm((state) => ({ ...state, group_name: event.target.value }))} /></label>
              <label><span>Tags</span><input placeholder="Tags comma-separated" value={serviceForm.tags} onChange={(event) => setServiceForm((state) => ({ ...state, tags: event.target.value }))} /></label>
              <label><span>Timeout</span><input placeholder="Timeout ms" value={serviceForm.timeout_ms} onChange={(event) => setServiceForm((state) => ({ ...state, timeout_ms: event.target.value }))} /></label>
              <label><span>Interval</span><input placeholder="Interval seconds" value={serviceForm.interval_seconds} onChange={(event) => setServiceForm((state) => ({ ...state, interval_seconds: event.target.value }))} /></label>
              <label className="editor-notes"><span>Notes</span><textarea placeholder="Notes" value={serviceForm.notes} onChange={(event) => setServiceForm((state) => ({ ...state, notes: event.target.value }))} /></label>
              <div className="editor-switches">
                <label><input type="checkbox" checked={serviceForm.check_icmp} onChange={(event) => setServiceForm((state) => ({ ...state, check_icmp: event.target.checked }))} /> ICMP</label>
                <label><input type="checkbox" checked={serviceForm.check_tcp} onChange={(event) => setServiceForm((state) => ({ ...state, check_tcp: event.target.checked }))} /> TCP</label>
                <label><input type="checkbox" checked={serviceForm.enabled} onChange={(event) => setServiceForm((state) => ({ ...state, enabled: event.target.checked }))} /> Enabled</label>
                <label><input type="checkbox" checked={serviceForm.allow_ttl_expired} onChange={(event) => setServiceForm((state) => ({ ...state, allow_ttl_expired: event.target.checked }))} /> Transit TTL valid</label>
              </div>
            </div>
            <div className="editor-actions"><button onClick={() => setEditorOpen(false)} disabled={saveBusy}>Cancel</button><button className="primary-action" onClick={submitServiceForm} disabled={saveBusy}>{saveBusy ? 'Saving...' : 'Save'}</button></div>
          </div>
        </NetworkDialog>
      ) : null}
      <PageGuide guide={pageGuides.networkSentinel} />
    </div>
  );
};

export default NetworkSentinelPage;
