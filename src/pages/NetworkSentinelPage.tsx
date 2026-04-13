import React, { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FaBolt,
  FaBroadcastTower,
  FaClock,
  FaDownload,
  FaExclamationTriangle,
  FaPlus,
  FaSearch,
  FaShieldAlt,
  FaSignal,
  FaStream,
  FaSyncAlt,
} from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
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
  statusClass,
  statusPriority,
} from './NetworkSentinelPage.helpers';
import './NetworkSentinelPage.css';

type DetailTab = 'signal' | 'timeline' | 'evidence';

const NetworkSentinelPage: React.FC = () => {
  const { user } = useAuth();
  const { addNotification } = useNotifications();
  const [searchParams, setSearchParams] = useSearchParams();
  const isManagerOrAdmin = ['admin', 'manager'].includes((user?.role || '').toLowerCase());
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';

  const [snapshot, setSnapshot] = useState<NetworkCommandCenterResponse | null>(null);
  const [investigation, setInvestigation] = useState<NetworkInvestigationResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [investigationLoading, setInvestigationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>('signal');
  const [serviceQuery, setServiceQuery] = useState('');
  const [environmentFilter, setEnvironmentFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | Status>('ALL');
  const [rawSearch, setRawSearch] = useState('');
  const [evidenceDownloading, setEvidenceDownloading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [checkNowBusy, setCheckNowBusy] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [todayEventsOpen, setTodayEventsOpen] = useState(false);
  const [outageLedgerOpen, setOutageLedgerOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState({
    name: '', address: '', port: '', environment: '', group_name: '', tags: '',
    timeout_ms: '3000', interval_seconds: '10', check_icmp: true, check_tcp: true, enabled: true, notes: '',
  });
  const requestedServiceId = searchParams.get('service');
  const requestedTab = searchParams.get('tab');

  const deferredQuery = useDeferredValue(serviceQuery);
  const detailRefreshTimerRef = useRef<number | null>(null);
  const snapshotRefreshTimerRef = useRef<number | null>(null);

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
    if (showSpinner) setLoading(true);
    const data = await networkSentinelApi.getCommandCenter();
    setSnapshot(data);
    setSelectedId((current) => {
      if (requestedServiceId && data.services.some((service) => service.id === requestedServiceId)) {
        return requestedServiceId;
      }
      return current && data.services.some((service) => service.id === current) ? current : data.services[0]?.id || null;
    });
    setError(null);
    setLoading(false);
    return data;
  }, [requestedServiceId]);

  const loadInvestigation = useCallback(async (serviceId: string, silent = false) => {
    if (!silent) setInvestigationLoading(true);
    try {
      setInvestigation(await networkSentinelApi.getServiceInvestigation(serviceId));
    } finally {
      setInvestigationLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCommandCenter(true).catch(() => {
      setError('Network Sentinel could not load its command-center snapshot.');
      setLoading(false);
    });
  }, [loadCommandCenter]);

  useEffect(() => {
    if (selectedId) loadInvestigation(selectedId).catch(() => undefined);
  }, [loadInvestigation, selectedId]);

  useEffect(() => {
    if (!requestedTab) return;
    if (requestedTab === 'signal' || requestedTab === 'timeline' || requestedTab === 'evidence') {
      setTab((current) => (current === requestedTab ? current : requestedTab));
    }
  }, [requestedTab]);

  useEffect(() => {
    if (!snapshot?.services?.length || !requestedServiceId) return;
    if (!snapshot.services.some((service) => service.id === requestedServiceId)) return;
    setSelectedId((current) => (current === requestedServiceId ? current : requestedServiceId));
  }, [requestedServiceId, snapshot?.services]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);
    if (selectedId) nextParams.set('service', selectedId);
    else nextParams.delete('service');
    if (tab !== 'signal') nextParams.set('tab', tab);
    else nextParams.delete('tab');

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, selectedId, setSearchParams, tab]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const poller = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      loadInvestigation(selectedId, true).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(poller);
  }, [loadInvestigation, selectedId]);

  const scheduleSnapshotRefresh = useCallback(() => {
    if (snapshotRefreshTimerRef.current) return;
    snapshotRefreshTimerRef.current = window.setTimeout(() => {
      snapshotRefreshTimerRef.current = null;
      loadCommandCenter().catch(() => undefined);
    }, 1800);
  }, [loadCommandCenter]);

  const scheduleInvestigationRefresh = useCallback((serviceId: string) => {
    if (detailRefreshTimerRef.current) window.clearTimeout(detailRefreshTimerRef.current);
    detailRefreshTimerRef.current = window.setTimeout(() => {
      detailRefreshTimerRef.current = null;
      loadInvestigation(serviceId, true).catch(() => undefined);
    }, 1200);
  }, [loadInvestigation]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' && window.location.port === '3000' ? 'localhost:8000' : window.location.host;
    const socket = new WebSocket(`${protocol}//${host}/api/v1/network-sentinel/ws?token=${encodeURIComponent(token)}&min_interval_seconds=0.6`);

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type !== 'SERVICE_STATUS_UPDATED') return;
      const update = message.data || {};
      setSnapshot((current) => {
        if (!current) return current;
        const services = current.services.map((service) => (service.id === update.service_id ? patchLiveService(service, update) : service));
        return { ...current, services, overview: { ...deriveOverview(services), recent_event_count: current.overview.recent_event_count } };
      });
      if (selectedId === update.service_id) {
        setInvestigation((current) => current && current.service.id === update.service_id ? { ...current, service: patchLiveService(current.service, update) } : current);
        scheduleInvestigationRefresh(update.service_id);
      }
      scheduleSnapshotRefresh();
    };

    return () => {
      socket.close();
      if (detailRefreshTimerRef.current) window.clearTimeout(detailRefreshTimerRef.current);
      if (snapshotRefreshTimerRef.current) window.clearTimeout(snapshotRefreshTimerRef.current);
    };
  }, [scheduleInvestigationRefresh, scheduleSnapshotRefresh, selectedId]);

  const environments = useMemo(() => Array.from(new Set((snapshot?.services || []).map((service) => service.environment).filter(Boolean) as string[])).sort(), [snapshot?.services]);
  const groups = useMemo(() => Array.from(new Set((snapshot?.services || []).map((service) => service.group_name).filter(Boolean) as string[])).sort(), [snapshot?.services]);

  const filteredServices = useMemo(() => (snapshot?.services || []).filter((service) => {
    const status = (service.status?.overall_status || 'UNKNOWN') as Status;
    if (statusFilter !== 'ALL' && status !== statusFilter) return false;
    if (environmentFilter && service.environment !== environmentFilter) return false;
    if (groupFilter && service.group_name !== groupFilter) return false;
    if (!deferredQuery.trim()) return true;
    const haystack = `${service.name} ${service.address} ${service.notes || ''} ${(service.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(deferredQuery.toLowerCase());
  }).sort((left, right) => {
    const leftPriority = statusPriority[(left.status?.overall_status || 'UNKNOWN') as Status];
    const rightPriority = statusPriority[(right.status?.overall_status || 'UNKNOWN') as Status];
    return leftPriority === rightPriority ? left.name.localeCompare(right.name) : rightPriority - leftPriority;
  }), [deferredQuery, environmentFilter, groupFilter, snapshot?.services, statusFilter]);

  const selectedCard = useMemo<NetworkServiceCard | null>(() => {
    if (investigation?.service.id === selectedId) return investigation.service;
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
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dayEnd = dayStart + (24 * 60 * 60 * 1000);
    const startMs = new Date(startedAt).getTime();
    const endMs = endedAt ? new Date(endedAt).getTime() : now.getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) return false;
    return startMs < dayEnd && endMs >= dayStart;
  }, []);

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
      await networkSentinelApi.checkNow(selectedId);
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

  const openCreate = () => { setEditorMode('create'); setServiceForm({ name: '', address: '', port: '', environment: '', group_name: '', tags: '', timeout_ms: '3000', interval_seconds: '10', check_icmp: true, check_tcp: true, enabled: true, notes: '' }); setEditorOpen(true); };
  const openEdit = () => {
    if (!selectedCard) return;
    setEditorMode('edit');
    setServiceForm({
      name: selectedCard.name, address: selectedCard.address, port: selectedCard.port ? String(selectedCard.port) : '',
      environment: selectedCard.environment || '', group_name: selectedCard.group_name || '', tags: (selectedCard.tags || []).join(', '),
      timeout_ms: String(selectedCard.timeout_ms || 3000), interval_seconds: String(selectedCard.interval_seconds || 10),
      check_icmp: !!selectedCard.check_icmp, check_tcp: !!selectedCard.check_tcp, enabled: !!selectedCard.enabled, notes: selectedCard.notes || '',
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
    <div className="network-sentinel-page">
      <div className="network-surface" />
      <section className="network-hero-panel network-shell">
        <div className="hero-copy"><div className="eyebrow"><FaSignal />Network Sentinel</div><p>Live posture, sampled diagnostics, and major-event retention now move through one purpose-built command-center path.</p><div className="hero-actions"><button className="primary-action" onClick={runRefresh}><FaSyncAlt /> Refresh</button>{isManagerOrAdmin ? <button className="secondary-action" onClick={openCreate}><FaPlus /> Add Service</button> : null}</div></div>
        <div className="hero-metrics"><div className="pulse-orb"><strong>{snapshot?.overview.fleet_pulse ?? 0}%</strong><span>Fleet Pulse</span></div><div className="metric-stack"><div className="metric-tile"><span>Engine</span><strong>{snapshot?.engine.online ? 'ONLINE' : 'OFFLINE'}</strong><small>{snapshot?.engine.active_service_workers ?? 0} workers</small></div><div className="metric-tile"><span>Active Incidents</span><strong>{snapshot?.overview.active_incidents ?? 0}</strong><small>{snapshot?.overview.impaired_services ?? 0} impaired services</small></div><div className="metric-tile"><span>Retention</span><strong>{snapshot?.retention.raw_history_days ?? 2}d raw / {snapshot?.retention.event_history_days ?? 14}d major</strong><small>{snapshot?.retention.sample_interval_seconds ?? 60}s sample cadence</small></div></div></div>
      </section>

      <section className="top-strip">
        <div className="strip-card network-shell"><FaBroadcastTower /><div><span>Coverage</span><strong>{snapshot?.overview.enabled_services ?? 0}/{snapshot?.overview.total_services ?? 0}</strong></div></div>
        <div className="strip-card network-shell"><FaExclamationTriangle /><div><span>Degraded + Down</span><strong>{snapshot?.overview.impaired_services ?? 0}</strong></div></div>
        <div className="strip-card network-shell"><FaClock /><div><span>Average Cadence</span><strong>{snapshot?.overview.average_interval_seconds ? `${snapshot.overview.average_interval_seconds}s` : '--'}</strong></div></div>
        <div className="strip-card network-shell"><FaStream /><div><span>Recent Events</span><strong>{snapshot?.recent_events.length ?? 0}</strong></div></div>
      </section>

      {error ? <div className="network-shell status-banner error-banner">{error}</div> : null}

      <section className="network-toolbar network-shell">
        <label className="toolbar-search"><FaSearch /><input value={serviceQuery} onChange={(event) => setServiceQuery(event.target.value)} placeholder="Search service, address, tag or note..." /></label>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'ALL' | Status)}><option value="ALL">All status</option><option value="UP">UP</option><option value="DEGRADED">DEGRADED</option><option value="DOWN">DOWN</option><option value="UNKNOWN">UNKNOWN</option></select>
        <select value={environmentFilter} onChange={(event) => setEnvironmentFilter(event.target.value)}><option value="">All environments</option>{environments.map((environment) => <option key={environment} value={environment}>{environment}</option>)}</select>
        <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}><option value="">All groups</option>{groups.map((group) => <option key={group} value={group}>{group}</option>)}</select>
      </section>

      <div className="network-layout">
        <section className="fleet-column">
          <div className="service-grid">
            {loading ? <div className="network-shell placeholder-card">Loading network command center...</div> : null}
            {filteredServices.map((service) => {
              const status = service.status?.overall_status || 'UNKNOWN';
              return <button key={service.id} className={`service-node network-shell ${statusClass(status)} ${selectedId === service.id ? 'selected' : ''}`} onClick={() => startTransition(() => { setSelectedId(service.id); setTab('signal'); })}><div className="service-node-head"><div><span>{service.group_name || service.environment || 'Unscoped'}</span><h3>{service.name}</h3></div><strong className={`status-pill ${statusClass(status)}`}>{status}</strong></div><p>{service.address}{service.port ? `:${service.port}` : ''}</p><div className="service-node-meta"><span>ICMP {formatLatency(service.status?.icmp_latency_ms)}</span><span>TCP {formatLatency(service.status?.tcp_latency_ms)}</span><span>{formatPercent(service.metrics.uptime_percent_24h)} uptime</span></div><div className="service-node-footer"><span>Since {formatSince(service.status?.last_state_change_at)}</span>{service.active_outage ? <em>Incident active</em> : <em>Nominal</em>}</div></button>;
            })}
          </div>

          <div className="subpanels">
            <div className="network-shell subpanel"><div className="subpanel-head"><h2>Active Incidents</h2><span>{snapshot?.active_outages.length ?? 0}</span></div><div className="subpanel-list">{(snapshot?.active_outages || []).map((outage) => <button key={outage.id} className="list-row" onClick={() => outage.service_id && setSelectedId(outage.service_id)}><div><strong>{outage.service_name || 'Unknown service'}</strong><span>{formatDateTime(outage.started_at)}</span></div><em>{formatDuration(outage.duration_seconds)}</em></button>)}{!snapshot?.active_outages.length ? <div className="list-empty">No live incidents right now.</div> : null}</div></div>
            <div className="network-shell subpanel"><div className="subpanel-head"><h2>Major Events</h2><span>{snapshot?.recent_events.length ?? 0}</span></div><div className="subpanel-list">{(snapshot?.recent_events || []).slice(0, 8).map((event: NetworkEvent) => <div key={event.id} className={`list-row event-row ${event.severity.toLowerCase()}`}><div><strong>{event.title}</strong><span>{event.service_name || 'Fleet'} - {formatDateTime(event.created_at)}</span></div><em>{event.severity}</em></div>)}{!snapshot?.recent_events.length ? <div className="list-empty">Major events will appear here.</div> : null}</div></div>
          </div>
        </section>

        <aside className="detail-column network-shell">
          {!selectedCard ? <div className="placeholder-card detail-placeholder"><FaShieldAlt /><p>Select a service to open its investigation deck.</p></div> : <>
            <div className="detail-head"><div><span>{selectedCard.group_name || selectedCard.environment || 'Focused asset'}</span><h2>{selectedCard.name}</h2><p>{selectedCard.address}{selectedCard.port ? `:${selectedCard.port}` : ''}</p></div><strong className={`status-pill ${statusClass(selectedCard.status?.overall_status)}`}>{selectedCard.status?.overall_status || 'UNKNOWN'}</strong></div>
            <div className="detail-actions">{isManagerOrAdmin ? <button onClick={runCheckNow} disabled={checkNowBusy}><FaBolt /> {checkNowBusy ? 'Checking...' : 'Check now'}</button> : null}{isManagerOrAdmin ? <button onClick={toggleEnabled} disabled={toggleBusy}>{toggleBusy ? 'Working...' : selectedCard.enabled ? 'Disable' : 'Enable'}</button> : null}{isManagerOrAdmin ? <button onClick={openEdit}>Edit</button> : null}<button onClick={downloadEvidenceText} disabled={evidenceDownloading}><FaDownload /> {evidenceDownloading ? 'Preparing...' : 'Evidence TXT'}</button>{isAdmin ? <button className="danger-action" onClick={deleteService} disabled={deleteBusy}>{deleteBusy ? 'Deleting...' : 'Delete'}</button> : null}</div>
            <div className="detail-metrics"><div><label>Availability 24h</label><strong>{formatPercent(investigation?.metrics.availability_percent_24h)}</strong></div><div><label>ICMP Latency</label><strong>{formatLatency(selectedCard.status?.icmp_latency_ms)}</strong></div><div><label>TCP Latency</label><strong>{formatLatency(selectedCard.status?.tcp_latency_ms)}</strong></div><div><label>State Since</label><strong>{formatSince(selectedCard.status?.last_state_change_at)}</strong></div><div><label>Diagnostic Incidents</label><strong>{investigation?.metrics.outage_count_diagnostic_window ?? 0}</strong></div><div><label>Raw Retention</label><strong>{investigation?.retention.raw_history_days ?? snapshot?.retention.raw_history_days ?? 2} days</strong></div></div>
            <div className="detail-tabs"><button className={tab === 'signal' ? 'active' : ''} onClick={() => setTab('signal')}>Signal</button><button className={tab === 'timeline' ? 'active' : ''} onClick={() => setTab('timeline')}>Timeline</button><button className={tab === 'evidence' ? 'active' : ''} onClick={() => setTab('evidence')}>Evidence</button></div>
            {investigationLoading ? <div className="network-shell inner-loading">Refreshing diagnostics...</div> : null}
            {tab === 'signal' ? <div className="tab-content"><div className="signal-panel"><div className="panel-head"><h3>Sampled Availability</h3><span>{signalLabel}</span></div><SignalBand samples={normalizedSamples} /></div><div className="signal-panel"><div className="panel-head"><h3>Latency Envelope</h3><span>{formatLatency(investigation?.metrics.avg_icmp_latency_ms_24h || investigation?.metrics.avg_tcp_latency_ms_24h)}</span></div><LatencyChart samples={normalizedSamples} /></div></div> : null}
            {tab === 'timeline' ? <div className="tab-content two-column"><div className="timeline-panel"><div className="panel-head"><div className="timeline-panel-title"><h3>Major Events Archive</h3><span>{historicalEvents.length}</span></div><button className="timeline-focus-button" onClick={() => setTodayEventsOpen(true)} type="button"><span>View today's events</span><strong>{todaysEvents.length}</strong></button></div><div className="timeline-list">{historicalEvents.map((event) => <div key={event.id} className={`timeline-entry ${event.severity.toLowerCase()}`}><strong>{event.title}</strong><span>{formatDateTime(event.created_at)}</span><p>{event.summary || 'No summary provided.'}</p></div>)}{!historicalEvents.length ? <div className="list-empty">Older retained major events will appear here after today's activity rolls over.</div> : null}</div></div><div className="timeline-panel"><div className="panel-head"><div className="timeline-panel-title"><h3>Outage Ledger Archive</h3><span>{historicalOutages.length}</span></div><button className="timeline-focus-button" onClick={() => setOutageLedgerOpen(true)} type="button"><span>View today's outages</span><strong>{todaysOutages.length}</strong></button></div><div className="timeline-list">{historicalOutages.map((outage) => <div key={outage.id} className={`timeline-entry ${outage.ended_at ? 'info' : 'critical'}`}><strong>{outage.ended_at ? 'Resolved incident' : 'Active incident'}</strong><span>{formatDateTime(outage.started_at)}</span><p>{outage.ended_at ? `Resolved in ${formatDuration(outage.duration_seconds)}` : `Ongoing for ${formatSince(outage.started_at)}`}</p></div>)}{!historicalOutages.length ? <div className="list-empty">Older retained outages will appear here once today's incidents roll over.</div> : null}</div></div></div> : null}
            {tab === 'evidence' ? <div className="tab-content"><div className="panel-head"><h3>Raw Evidence Window</h3><span>{investigation?.retention.raw_history_days ?? snapshot?.retention.raw_history_days ?? 2} day retention{latestEvidenceAt ? ` / Updated ${formatDateTime(latestEvidenceAt)}` : ''}</span></div><label className="toolbar-search compact"><FaSearch /><input value={rawSearch} onChange={(event) => setRawSearch(event.target.value)} placeholder="Filter raw evidence..." /></label><div className="evidence-list">{rawRows.slice(-180).reverse().map((row: ServiceHistoryRow, index) => <div key={`${row.timestamp}-${index}`} className={`evidence-row ${statusClass(row.kind === 'OUTAGE_DETECTED' ? 'DOWN' : row.kind)}`}><span>{formatDateTime(row.timestamp)}</span><strong>{row.kind}</strong><code>{row.raw}</code></div>)}{!rawRows.length ? <div className="list-empty">No raw evidence retained in the current window.</div> : null}</div></div> : null}
          </>}
        </aside>
      </div>

      {todayEventsOpen ? <div className="editor-backdrop" onClick={() => setTodayEventsOpen(false)}><div className="editor-card network-shell outage-ledger-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><h3>Today's Major Events</h3><span>{selectedCard?.name || 'Focused asset'}</span></div><button type="button" onClick={() => setTodayEventsOpen(false)}>Close</button></div><div className="timeline-list outage-ledger-list">{todaysEvents.map((event) => <div key={event.id} className={`timeline-entry ${event.severity.toLowerCase()}`}><strong>{event.title}</strong><span>{formatDateTime(event.created_at)}</span><p>{event.summary || 'No summary provided.'}</p></div>)}{!todaysEvents.length ? <div className="list-empty">No major events recorded today for this service.</div> : null}</div></div></div> : null}
      {outageLedgerOpen ? <div className="editor-backdrop" onClick={() => setOutageLedgerOpen(false)}><div className="editor-card network-shell outage-ledger-modal" onClick={(event) => event.stopPropagation()}><div className="panel-head"><div><h3>Today's Outages</h3><span>{selectedCard?.name || 'Focused asset'}</span></div><button type="button" onClick={() => setOutageLedgerOpen(false)}>Close</button></div><div className="timeline-list outage-ledger-list">{todaysOutages.map((outage) => <div key={outage.id} className={`timeline-entry ${outage.ended_at ? 'info' : 'critical'}`}><strong>{outage.ended_at ? 'Resolved incident' : 'Active incident'}</strong><span>{formatDateTime(outage.started_at)}</span><p>{outage.ended_at ? `Resolved in ${formatDuration(outage.duration_seconds)}` : `Ongoing for ${formatSince(outage.started_at)}`}</p></div>)}{!todaysOutages.length ? <div className="list-empty">No outages recorded today for this service.</div> : null}</div></div></div> : null}

      {editorOpen ? <div className="editor-backdrop" onClick={() => setEditorOpen(false)}><div className="editor-card network-shell" onClick={(event) => event.stopPropagation()}><h3>{editorMode === 'create' ? 'Add Service' : 'Edit Service'}</h3><div className="editor-grid"><input placeholder="Name" value={serviceForm.name} onChange={(event) => setServiceForm((state) => ({ ...state, name: event.target.value }))} /><input placeholder="Address / Hostname" value={serviceForm.address} onChange={(event) => setServiceForm((state) => ({ ...state, address: event.target.value }))} /><input placeholder="Port" value={serviceForm.port} onChange={(event) => setServiceForm((state) => ({ ...state, port: event.target.value }))} /><input placeholder="Environment" value={serviceForm.environment} onChange={(event) => setServiceForm((state) => ({ ...state, environment: event.target.value }))} /><input placeholder="Group" value={serviceForm.group_name} onChange={(event) => setServiceForm((state) => ({ ...state, group_name: event.target.value }))} /><input placeholder="Tags comma-separated" value={serviceForm.tags} onChange={(event) => setServiceForm((state) => ({ ...state, tags: event.target.value }))} /><input placeholder="Timeout ms" value={serviceForm.timeout_ms} onChange={(event) => setServiceForm((state) => ({ ...state, timeout_ms: event.target.value }))} /><input placeholder="Interval seconds" value={serviceForm.interval_seconds} onChange={(event) => setServiceForm((state) => ({ ...state, interval_seconds: event.target.value }))} /><textarea placeholder="Notes" value={serviceForm.notes} onChange={(event) => setServiceForm((state) => ({ ...state, notes: event.target.value }))} /><label><input type="checkbox" checked={serviceForm.check_icmp} onChange={(event) => setServiceForm((state) => ({ ...state, check_icmp: event.target.checked }))} /> ICMP</label><label><input type="checkbox" checked={serviceForm.check_tcp} onChange={(event) => setServiceForm((state) => ({ ...state, check_tcp: event.target.checked }))} /> TCP</label><label><input type="checkbox" checked={serviceForm.enabled} onChange={(event) => setServiceForm((state) => ({ ...state, enabled: event.target.checked }))} /> Enabled</label></div><div className="editor-actions"><button onClick={() => setEditorOpen(false)} disabled={saveBusy}>Cancel</button><button className="primary-action" onClick={submitServiceForm} disabled={saveBusy}>{saveBusy ? 'Saving...' : 'Save'}</button></div></div></div> : null}
      <PageGuide guide={pageGuides.networkSentinel} />
    </div>
  );
};

export default NetworkSentinelPage;
