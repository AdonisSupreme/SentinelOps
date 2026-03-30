import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaBolt,
  FaBroadcastTower,
  FaCrosshairs,
  FaDownload,
  FaExclamationTriangle,
  FaFilter,
  FaGlobeAfrica,
  FaLayerGroup,
  FaPlus,
  FaSearch,
  FaSignal,
  FaStream,
} from 'react-icons/fa';
import { networkSentinelApi, NetworkOutage, NetworkService, ServiceHistoryRow } from '../services/networkSentinelApi';
import PageGuide from '../components/ui/PageGuide';
import { useAuth } from '../contexts/AuthContext';
import { pageGuides } from '../content/pageGuides';
import './NetworkSentinelPage.css';

type Status = 'UNKNOWN' | 'UP' | 'DEGRADED' | 'DOWN';

type EngineHealth = {
  online: boolean;
  reason?: string | null;
  active_service_workers?: number;
};

const statusPriority: Record<Status, number> = {
  DOWN: 4,
  DEGRADED: 3,
  UNKNOWN: 2,
  UP: 1,
};

const statusClass = (status?: string | null) => (status || 'UNKNOWN').toLowerCase();

const prettyStatus = (status?: string | null) => status || 'UNKNOWN';

const formatSince = (iso?: string | null) => {
  if (!iso) return '--';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 0) return '--';
  const sec = Math.floor(diff / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const formatDuration = (seconds?: number | null) => {
  if (seconds == null || Number.isNaN(seconds)) return '--';
  if (seconds < 60) return `${Math.max(0, Math.floor(seconds))}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '--';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '--';
  return dt.toLocaleString();
};

const formatLatency = (value?: number | null) => (value == null ? '--' : `${value}ms`);

const formatCheckState = (value?: boolean | null) => {
  if (value === true) return 'UP';
  if (value === false) return 'DOWN';
  return 'UNKNOWN';
};

const Sparkline: React.FC<{ rows: ServiceHistoryRow[] }> = ({ rows }) => {
  const values = rows.slice(-40).map((r) => {
    if (r.kind === 'UP') return 1;
    if (r.kind === 'DEGRADED') return 0.6;
    if (r.kind === 'DOWN') return 0.2;
    return 0.4;
  });
  if (!values.length) return <div className="sparkline-empty">No samples</div>;
  const width = 220;
  const height = 56;
  const step = width / Math.max(1, values.length - 1);
  const points = values.map((v, i) => `${i * step},${height - v * height + 2}`).join(' ');
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};

const NetworkSentinelPage: React.FC = () => {
  const { user } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager'].includes((user?.role || '').toLowerCase());
  const isAdmin = (user?.role || '').toLowerCase() === 'admin';
  const [services, setServices] = useState<NetworkService[]>([]);
  const [outages, setOutages] = useState<NetworkOutage[]>([]);
  const [engineHealth, setEngineHealth] = useState<EngineHealth | null>(null);
  const [selected, setSelected] = useState<NetworkService | null>(null);
  const [historyRows, setHistoryRows] = useState<ServiceHistoryRow[]>([]);
  const [historySearch, setHistorySearch] = useState('');
  const [filter, setFilter] = useState<{ status?: Status | 'ALL'; environment?: string; group?: string; query?: string }>({
    status: 'ALL',
  });
  const [muted, setMuted] = useState<Record<string, boolean>>({});
  const [highContrast, setHighContrast] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [csvDownloading, setCsvDownloading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const historyRefreshRef = useRef<Record<string, number>>({});
  const [serviceForm, setServiceForm] = useState({
    name: '',
    address: '',
    port: '',
    environment: '',
    group_name: '',
    tags: '',
    timeout_ms: '3000',
    interval_seconds: '2',
    check_icmp: true,
    check_tcp: true,
    enabled: true,
    notes: '',
  });

  const loadCore = async () => {
    const [svcResult, outagesResult, healthResult] = await Promise.allSettled([
      networkSentinelApi.listServices(),
      networkSentinelApi.getOutages({ limit: 300 }),
      networkSentinelApi.health(),
    ]);

    const warnings: string[] = [];

    if (svcResult.status === 'fulfilled') {
      setServices(svcResult.value);
      setSelected((prev) => (prev ? svcResult.value.find((s) => s.id === prev.id) || null : prev));
    } else {
      warnings.push('Service inventory could not be refreshed.');
    }

    if (outagesResult.status === 'fulfilled') {
      setOutages(outagesResult.value);
    } else {
      setOutages([]);
      warnings.push('Active outage feed is temporarily unavailable.');
    }

    if (healthResult.status === 'fulfilled') {
      setEngineHealth(healthResult.value);
    } else {
      setEngineHealth((prev) => prev ?? { online: false, reason: 'health_unavailable', active_service_workers: 0 });
      warnings.push('Engine health could not be refreshed.');
    }

    setLoadWarnings(warnings);
  };

  useEffect(() => {
    let active = true;
    const boot = async () => {
      try {
        await loadCore();
      } finally {
        if (active) setLoading(false);
      }
    };
    boot();
    const timer = window.setInterval(() => {
      loadCore().catch(() => undefined);
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshHistory = useCallback(async (serviceId: string, limit = 1200) => {
    try {
      const res = await networkSentinelApi.getHistory(serviceId, { limit });
      setHistoryRows(res.rows || []);
    } catch {
      setHistoryRows([]);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host =
      window.location.hostname === 'localhost' && window.location.port === '3000'
        ? 'localhost:8000'
        : window.location.host;
    const ws = new WebSocket(
      `${protocol}//${host}/api/v1/network-sentinel/ws?token=${encodeURIComponent(token)}&min_interval_seconds=0.75`
    );
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type !== 'SERVICE_STATUS_UPDATED') return;
      const data = msg.data || {};
      setServices((prev) =>
        prev.map((svc) =>
          svc.id === data.service_id
            ? {
                ...svc,
                status: {
                  ...svc.status,
                  last_checked_at: data.last_checked_at,
                  icmp_up: data.icmp_up,
                  icmp_bytes: data.icmp_bytes,
                  icmp_latency_ms: data.icmp_latency_ms,
                  icmp_ttl: data.icmp_ttl,
                  tcp_up: data.tcp_up,
                  tcp_latency_ms: data.tcp_latency_ms,
                  overall_status: data.overall_status,
                  reason: data.reason,
                  consecutive_failures: data.consecutive_failures,
                  last_state_change_at: data.last_state_change_at,
                },
              }
            : svc
        )
      );
      if (selected?.id === data.service_id) {
        setSelected((prev) =>
          prev
            ? {
                ...prev,
                status: {
                  ...prev.status,
                  last_checked_at: data.last_checked_at,
                  icmp_up: data.icmp_up,
                  icmp_bytes: data.icmp_bytes,
                  icmp_latency_ms: data.icmp_latency_ms,
                  icmp_ttl: data.icmp_ttl,
                  tcp_up: data.tcp_up,
                  tcp_latency_ms: data.tcp_latency_ms,
                  overall_status: data.overall_status,
                  reason: data.reason,
                  consecutive_failures: data.consecutive_failures,
                  last_state_change_at: data.last_state_change_at,
                },
              }
            : prev
        );
        const now = Date.now();
        const last = historyRefreshRef.current[data.service_id] || 0;
        if (now - last > 1500) {
          historyRefreshRef.current[data.service_id] = now;
          refreshHistory(data.service_id).catch(() => undefined);
          loadCore().catch(() => undefined);
        }
      }
    };
    return () => ws.close();
  }, [refreshHistory, selected?.id]);

  useEffect(() => {
    if (!selected) return;
    refreshHistory(selected.id).catch(() => undefined);
    const timer = window.setInterval(() => {
      refreshHistory(selected.id).catch(() => undefined);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [refreshHistory, selected]);

  const filteredServices = useMemo(() => {
    return [...services]
      .filter((s) => {
        const st = (s.status?.overall_status || 'UNKNOWN') as Status;
        if (filter.status && filter.status !== 'ALL' && st !== filter.status) return false;
        if (filter.environment && s.environment !== filter.environment) return false;
        if (filter.group && s.group_name !== filter.group) return false;
        if (filter.query) {
          const q = filter.query.toLowerCase();
          const blob = `${s.name} ${s.address} ${s.notes || ''} ${(s.tags || []).join(' ')}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ap = statusPriority[(a.status?.overall_status || 'UNKNOWN') as Status];
        const bp = statusPriority[(b.status?.overall_status || 'UNKNOWN') as Status];
        return bp - ap;
      });
  }, [services, filter]);

  const summary = useMemo(() => {
    const acc = { total: services.length, up: 0, degraded: 0, down: 0, unknown: 0 };
    services.forEach((s) => {
      const st = (s.status?.overall_status || 'UNKNOWN') as Status;
      if (st === 'UP') acc.up += 1;
      else if (st === 'DEGRADED') acc.degraded += 1;
      else if (st === 'DOWN') acc.down += 1;
      else acc.unknown += 1;
    });
    return acc;
  }, [services]);

  const detailsRows = useMemo(
    () =>
      historyRows
        .filter((r) => (historySearch.trim() ? r.raw.toLowerCase().includes(historySearch.toLowerCase()) : true))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [historyRows, historySearch]
  );

  const environments = useMemo(
    () => Array.from(new Set(services.map((s) => s.environment).filter(Boolean) as string[])).sort(),
    [services]
  );

  const groups = useMemo(
    () => Array.from(new Set(services.map((s) => s.group_name).filter(Boolean) as string[])).sort(),
    [services]
  );

  const criticalServices = useMemo(
    () => services.filter((s) => (s.status?.overall_status || 'UNKNOWN') === 'DOWN').slice(0, 3),
    [services]
  );

  const selectedOutage = useMemo(() => {
    if (!selected) return null;
    return outages.find((outage) => outage.service_id === selected.id && !outage.ended_at) || null;
  }, [outages, selected]);

  const selectedServiceOutageHistory = useMemo(() => {
    if (!selected) return [];
    return outages
      .filter((outage) => outage.service_id === selected.id)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
      .slice(0, 8);
  }, [outages, selected]);

  const fleetPulse = useMemo(() => {
    if (!summary.total) return 0;
    return Math.round(((summary.up + summary.degraded * 0.55) / summary.total) * 100);
  }, [summary]);

  const averageInterval = useMemo(() => {
    if (!services.length) return '--';
    const total = services.reduce((acc, service) => acc + (service.interval_seconds || 0), 0);
    return `${(total / services.length).toFixed(1)}s cadence`;
  }, [services]);

  const engineTone = engineHealth?.online ? 'online' : 'offline';

  const runCheckNow = async () => {
    if (!selected) return;
    await networkSentinelApi.checkNow(selected.id);
    await loadCore();
  };

  const toggleEnabled = async () => {
    if (!selected) return;
    await networkSentinelApi.setEnabled(selected.id, !selected.enabled);
    await loadCore();
  };

  const downloadHistoryCsv = async () => {
    if (!selected || csvDownloading) return;
    setCsvDownloading(true);
    try {
      await networkSentinelApi.downloadHistoryCsv(selected.id);
    } finally {
      setCsvDownloading(false);
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
      interval_seconds: '2',
      check_icmp: true,
      check_tcp: true,
      enabled: true,
      notes: '',
    });
    setEditorOpen(true);
  };

  const openEdit = () => {
    if (!selected) return;
    setEditorMode('edit');
    setServiceForm({
      name: selected.name || '',
      address: selected.address || '',
      port: selected.port ? String(selected.port) : '',
      environment: selected.environment || '',
      group_name: selected.group_name || '',
      tags: (selected.tags || []).join(', '),
      timeout_ms: String(selected.timeout_ms || 3000),
      interval_seconds: String(selected.interval_seconds || 2),
      check_icmp: !!selected.check_icmp,
      check_tcp: !!selected.check_tcp,
      enabled: !!selected.enabled,
      notes: selected.notes || '',
    });
    setEditorOpen(true);
  };

  const submitServiceForm = async () => {
    const payload = {
      name: serviceForm.name.trim(),
      address: serviceForm.address.trim(),
      port: serviceForm.port ? Number(serviceForm.port) : null,
      environment: serviceForm.environment || null,
      group_name: serviceForm.group_name || null,
      tags: serviceForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      timeout_ms: Number(serviceForm.timeout_ms || 3000),
      interval_seconds: Number(serviceForm.interval_seconds || 2),
      check_icmp: serviceForm.check_icmp,
      check_tcp: serviceForm.check_tcp,
      enabled: serviceForm.enabled,
      notes: serviceForm.notes || null,
    };
    if (editorMode === 'create') {
      await networkSentinelApi.createService(payload);
    } else if (selected) {
      await networkSentinelApi.updateService(selected.id, payload);
    }
    setEditorOpen(false);
    await loadCore();
  };

  const deleteService = async () => {
    if (!selected || !isAdmin) return;
    const ok = window.confirm(`Delete ${selected.name}?`);
    if (!ok) return;
    await networkSentinelApi.deleteService(selected.id);
    setSelected(null);
    setEditorOpen(false);
    await loadCore();
  };

  return (
    <div className={`network-sentinel-page ${highContrast ? 'high-contrast' : ''}`}>
      <div className="network-ambient">
        <div className="ambient-ring ring-one" />
        <div className="ambient-ring ring-two" />
        <div className="ambient-grid" />
      </div>

      <section className="network-hero glass">
        <div className="hero-copy">
          <div className="hero-kicker">
            <FaSignal />
            SentinelOps Network Sentinel
          </div>
          <p>
            Track every monitored surface like a live operational theater with instant state awareness, evidence trails,
            and precision control over recovery actions.
          </p>
          <div className="hero-actions">
            <button className="contrast-btn" onClick={() => setHighContrast((v) => !v)}>
              {highContrast ? 'Standard View' : 'High Contrast'}
            </button>
            {isManagerOrAdmin ? (
              <button className="create-btn" onClick={openCreate}>
                <FaPlus /> Add Service
              </button>
            ) : null}
          </div>
        </div>
        <div className="hero-telemetry">
          <div className="hero-orb">
            <div className="hero-orb-core">
              <strong>{fleetPulse}%</strong>
              <span>Fleet Pulse</span>
            </div>
          </div>
          <div className="hero-meta-grid">
            <div className={`hero-meta-card ${engineTone}`}>
              <span>Engine Status</span>
              <strong>{engineHealth?.online ? 'ONLINE' : 'OFFLINE'}</strong>
              <small>{engineHealth?.active_service_workers ?? 0} active workers</small>
            </div>
            <div className="hero-meta-card">
              <span>Active Incidents</span>
              <strong>{outages.length}</strong>
              <small>{outages.length ? 'Escalation required' : 'No live incidents'}</small>
            </div>
            <div className="hero-meta-card">
              <span>Scan Rhythm</span>
              <strong>{averageInterval}</strong>
              <small>Distributed service cadence</small>
            </div>
          </div>
        </div>
      </section>

      <section className="network-command-grid">
        <div className="network-summary-bar glass">
          <div className="summary-title">
            <FaBroadcastTower />
            <div>
              <h2>Command Deck</h2>
              <p>Advanced visibility across service posture and event velocity</p>
            </div>
          </div>
          <div className="summary-stats">
            <span>Total {summary.total}</span>
            <span className="up">UP {summary.up}</span>
            <span className="degraded">DEGRADED {summary.degraded}</span>
            <span className="down">DOWN {summary.down}</span>
          </div>
          <div className={`incident-banner ${outages.length ? 'active' : ''}`}>
            <FaExclamationTriangle />
            {outages.length ? `${outages.length} active outage(s)` : 'No active incidents'}
          </div>
        </div>

        <div className="network-side-panel glass">
          <div className="side-panel-head">
            <span>Priority Watchlist</span>
            <strong>{criticalServices.length ? 'Actionable' : 'Stable'}</strong>
          </div>
          <div className="priority-list">
            {(criticalServices.length ? criticalServices : services.slice(0, 3)).map((service) => {
              const status = service.status?.overall_status || 'UNKNOWN';
              return (
                <div key={service.id} className={`priority-item ${statusClass(status)}`}>
                  <div>
                    <strong>{service.name}</strong>
                    <span>{service.address}{service.port ? `:${service.port}` : ''}</span>
                  </div>
                  <em>{prettyStatus(status)}</em>
                </div>
              );
            })}
            {!services.length ? <div className="priority-empty">No monitored services yet.</div> : null}
          </div>
        </div>
      </section>

      {loadWarnings.length ? (
        <div className="glass placeholder">
          {loadWarnings.join(' ')}
        </div>
      ) : null}

      <div className="filter-row glass">
        <div className="filter-cluster">
          <div className="filter-item">
            <FaFilter />
            <select value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value as any }))}>
              <option value="ALL">All Status</option>
              <option value="UP">UP</option>
              <option value="DEGRADED">DEGRADED</option>
              <option value="DOWN">DOWN</option>
              <option value="UNKNOWN">UNKNOWN</option>
            </select>
          </div>
          <div className="filter-item">
            <FaGlobeAfrica />
            <select
              value={filter.environment || ''}
              onChange={(e) => setFilter((f) => ({ ...f, environment: e.target.value || undefined }))}
            >
              <option value="">All Environments</option>
              {environments.map((environment) => (
                <option key={environment} value={environment}>
                  {environment}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-item">
            <FaLayerGroup />
            <select value={filter.group || ''} onChange={(e) => setFilter((f) => ({ ...f, group: e.target.value || undefined }))}>
              <option value="">All Groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {group}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-item search">
          <FaSearch />
          <input
            placeholder="Search service, address, note, tag..."
            value={filter.query || ''}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
          />
        </div>
        <div className={`engine-pill ${engineTone}`}>
          <span>Engine {engineHealth?.online ? 'ONLINE' : 'OFFLINE'}</span>
          <strong>{engineHealth?.active_service_workers ?? 0} workers</strong>
        </div>
      </div>

      <div className="network-layout">
        <section className="services-grid">
          {loading ? <div className="glass placeholder">Loading network topology...</div> : null}
          {filteredServices.map((service) => {
            const status = service.status?.overall_status || 'UNKNOWN';
            const serviceRows = selected?.id === service.id ? historyRows : [];
            return (
              <article
                key={service.id}
                className={`service-card glass ${statusClass(status)} ${status === 'DOWN' ? 'urgent-card' : ''} ${status === 'DEGRADED' ? 'degraded-card' : ''}`}
                onClick={() => setSelected(service)}
              >
                <div className="service-card-glow" />
                <div className="service-head">
                  <div>
                    <span className="service-label">{service.group_name || service.environment || 'Network Service'}</span>
                    <h3>{service.name}</h3>
                  </div>
                  <span className={`status-pill ${statusClass(status)}`}>{prettyStatus(status)}</span>
                </div>
                <div className="service-address">{service.address}{service.port ? `:${service.port}` : ''}</div>
                <div className="service-tags">
                  <span>{service.environment || 'Unscoped'}</span>
                  <span>{service.check_icmp ? 'ICMP' : 'No ICMP'}</span>
                  <span>{service.check_tcp ? `TCP${service.port ? `:${service.port}` : ''}` : 'No TCP'}</span>
                </div>
                <div className="mini-metrics">
                  <span>ICMP {formatLatency(service.status?.icmp_latency_ms)}</span>
                  <span>TCP {formatLatency(service.status?.tcp_latency_ms)}</span>
                  <span>TTL {service.status?.icmp_ttl ?? '-'}</span>
                  <span>Last {service.status?.last_checked_at ? new Date(service.status.last_checked_at).toLocaleTimeString() : '--'}</span>
                </div>
                <div className="since-line">Since {formatSince(service.status?.last_state_change_at)}</div>
                <Sparkline rows={serviceRows} />
              </article>
            );
          })}
        </section>

        <aside className="details-drawer glass">
          {!selected ? (
            <div className="placeholder">
              <FaCrosshairs />
              <p>Select a service node to open deep telemetry and investigation artifacts.</p>
            </div>
          ) : (
            <>
              <div className="drawer-head">
                <div>
                  <span className="drawer-kicker">{selected.group_name || selected.environment || 'Focused Asset'}</span>
                  <h2>{selected.name}</h2>
                </div>
                <span className={`status-pill ${statusClass(selected.status?.overall_status)}`}>
                  {selected.status?.overall_status || 'UNKNOWN'}
                </span>
              </div>
              <p className="service-address">{selected.address}{selected.port ? `:${selected.port}` : ''}</p>
              <div className="selected-service-meta">
                <span>{selected.environment || 'No environment'}</span>
                <span>{selected.group_name || 'No group'}</span>
                <span>{selected.owner_team || 'No owner team'}</span>
              </div>
              <div className="actions-row">
                <button onClick={runCheckNow}><FaBolt /> Run Check</button>
                <button onClick={toggleEnabled}>{selected.enabled ? 'Disable' : 'Enable'}</button>
                {isManagerOrAdmin ? <button onClick={openEdit}>Edit</button> : null}
                <button onClick={() => setMuted((m) => ({ ...m, [selected.id]: !m[selected.id] }))}>
                  {muted[selected.id] ? 'Unmute' : 'Mute'}
                </button>
                {isAdmin ? <button className="danger" onClick={deleteService}>Delete</button> : null}
              </div>
                <div className="metric-grid">
                  <div><label>ICMP</label><strong>{formatCheckState(selected.status?.icmp_up)}</strong></div>
                  <div><label>TCP</label><strong>{formatCheckState(selected.status?.tcp_up)}</strong></div>
                  <div><label>Failures</label><strong>{selected.status?.consecutive_failures ?? 0}</strong></div>
                  <div><label>State Since</label><strong>{formatSince(selected.status?.last_state_change_at)}</strong></div>
                  <div><label>Downtime Began</label><strong>{formatDateTime(selectedOutage?.started_at || selected.status?.last_state_change_at)}</strong></div>
                  <div><label>Current Downtime</label><strong>{selectedOutage ? formatSince(selectedOutage.started_at) : '--'}</strong></div>
                  <div><label>ICMP Latency</label><strong>{formatLatency(selected.status?.icmp_latency_ms)}</strong></div>
                  <div><label>TCP Latency</label><strong>{formatLatency(selected.status?.tcp_latency_ms)}</strong></div>
                </div>

              <div className="insight-band">
                <div className="insight-card">
                  <span><FaStream /> Investigation Signal</span>
                  <strong>{detailsRows.length} evidence rows</strong>
                </div>
                <div className="insight-card">
                  <span><FaLayerGroup /> Failure Pressure</span>
                  <strong>{selected.status?.reason || 'No active impairment reason'}</strong>
                </div>
              </div>

                <div className="history-panel">
                  <div className="history-head">
                    <h3>Investigation Mode</h3>
                    <button onClick={downloadHistoryCsv} className="csv-link" disabled={csvDownloading}>
                      <FaDownload /> {csvDownloading ? 'Preparing CSV...' : 'CSV'}
                    </button>
                  </div>
                {selectedOutage ? (
                  <div className="active-outage-banner">
                    <strong>ACTIVE OUTAGE</strong>
                    <span>Started {formatDateTime(selectedOutage.started_at)} ({formatSince(selectedOutage.started_at)} ago)</span>
                  </div>
                ) : null}
                {selectedServiceOutageHistory.length ? (
                  <div className="incident-history">
                    {selectedServiceOutageHistory.map((outage) => (
                      <div key={outage.id} className={`incident-row ${outage.ended_at ? 'resolved' : 'active'}`}>
                        <span>{formatDateTime(outage.started_at)}</span>
                        <strong>{outage.ended_at ? `Resolved in ${formatDuration(outage.duration_seconds)}` : `Active for ${formatSince(outage.started_at)}`}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
                <input
                  className="history-search"
                  placeholder="Filter raw logs..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                />
                <div className="history-list">
                  {detailsRows.slice(0, 200).map((row, idx) => (
                    <div
                      key={`${row.timestamp}-${idx}`}
                      className={`history-row ${row.kind === 'OUTAGE_DETECTED' || row.kind === 'RECOVERED' ? 'boundary' : ''}`}
                    >
                      <span>{formatDateTime(row.timestamp)}</span>
                      <span className={`kind ${statusClass(row.kind === 'OUTAGE_DETECTED' ? 'DOWN' : row.kind)}`}>{row.kind}</span>
                      <code>{row.raw}</code>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {editorOpen ? (
        <div className="editor-modal-backdrop" onClick={() => setEditorOpen(false)}>
          <div className="editor-modal glass" onClick={(e) => e.stopPropagation()}>
            <h3>{editorMode === 'create' ? 'Add Service' : 'Edit Service'}</h3>
            <div className="editor-grid">
              <input placeholder="Name" value={serviceForm.name} onChange={(e) => setServiceForm((s) => ({ ...s, name: e.target.value }))} />
              <input placeholder="Address / Hostname" value={serviceForm.address} onChange={(e) => setServiceForm((s) => ({ ...s, address: e.target.value }))} />
              <input placeholder="Port (optional)" value={serviceForm.port} onChange={(e) => setServiceForm((s) => ({ ...s, port: e.target.value }))} />
              <input placeholder="Environment" value={serviceForm.environment} onChange={(e) => setServiceForm((s) => ({ ...s, environment: e.target.value }))} />
              <input placeholder="Group" value={serviceForm.group_name} onChange={(e) => setServiceForm((s) => ({ ...s, group_name: e.target.value }))} />
              <input placeholder="Tags comma-separated" value={serviceForm.tags} onChange={(e) => setServiceForm((s) => ({ ...s, tags: e.target.value }))} />
              <input placeholder="Timeout ms" value={serviceForm.timeout_ms} onChange={(e) => setServiceForm((s) => ({ ...s, timeout_ms: e.target.value }))} />
              <input placeholder="Interval seconds" value={serviceForm.interval_seconds} onChange={(e) => setServiceForm((s) => ({ ...s, interval_seconds: e.target.value }))} />
              <textarea placeholder="Notes" value={serviceForm.notes} onChange={(e) => setServiceForm((s) => ({ ...s, notes: e.target.value }))} />
              <label><input type="checkbox" checked={serviceForm.check_icmp} onChange={(e) => setServiceForm((s) => ({ ...s, check_icmp: e.target.checked }))} /> ICMP</label>
              <label><input type="checkbox" checked={serviceForm.check_tcp} onChange={(e) => setServiceForm((s) => ({ ...s, check_tcp: e.target.checked }))} /> TCP</label>
              <label><input type="checkbox" checked={serviceForm.enabled} onChange={(e) => setServiceForm((s) => ({ ...s, enabled: e.target.checked }))} /> Enabled</label>
            </div>
            <div className="editor-actions">
              <button onClick={() => setEditorOpen(false)}>Cancel</button>
              <button onClick={submitServiceForm}>Save</button>
            </div>
          </div>
        </div>
      ) : null}
      <PageGuide guide={pageGuides.networkSentinel} />
    </div>
  );
};

export default NetworkSentinelPage;

