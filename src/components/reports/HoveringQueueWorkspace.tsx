import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaBolt,
  FaCalendarAlt,
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaCog,
  FaExclamationTriangle,
  FaFingerprint,
  FaHistory,
  FaLock,
  FaPause,
  FaRobot,
  FaSearch,
  FaSyncAlt,
  FaTimes,
  FaWaveSquare,
} from 'react-icons/fa';
import { useNotifications } from '../../contexts/NotificationContext';
import HoveringSettingsWorkspace from './HoveringSettingsWorkspace';
import reportsApi, {
  HoveringDateAction,
  HoveringOverview,
  HoveringPolicyAudit,
  HoveringPosture,
  HoveringQueueStatus,
  HoveringRecord,
  HoveringRecordPage,
} from '../../services/reportsApi';

interface HoveringQueueWorkspaceProps {
  isAdmin: boolean;
  canOperate: boolean;
  canManagePasswords: boolean;
  refreshNonce: number;
}

const number = (value?: number | null) => new Intl.NumberFormat().format(value || 0);

const dateTime = (value?: string | null, empty = 'Not observed') => {
  if (!value) return empty;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const money = (amount?: number | null, currency?: string | null) => {
  if (amount === null || amount === undefined) return 'Amount unavailable';
  return `${currency || ''} ${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)}`.trim();
};

const errorMessage = (error: unknown) => {
  const candidate = error as { response?: { data?: { detail?: string; error?: { message?: string } } }; message?: string };
  return candidate.response?.data?.detail
    || candidate.response?.data?.error?.message
    || candidate.message
    || 'The hovering queue is temporarily unavailable.';
};

const postureCopy: Record<HoveringPosture, { title: string; body: string; icon: React.ReactNode }> = {
  CLEAR: { title: 'Queue clear', body: 'No pending loan-ledger fees remain.', icon: <FaCheck /> },
  MOVING: { title: 'Bots are moving', body: 'Robot throughput is active inside the operating window.', icon: <FaWaveSquare /> },
  STALLED: { title: 'Movement not detected', body: 'No processed records have been observed while bots should be active.', icon: <FaExclamationTriangle /> },
  OBSERVING: { title: 'Establishing rate', body: 'SentinelOps is collecting enough active-window evidence.', icon: <FaClock /> },
  PAUSED: { title: 'Bots are paused', body: 'The queue is outside the expected operating window.', icon: <FaPause /> },
};

const HoveringSkeleton: React.FC = () => (
  <div className="hovering-skeleton" aria-label="Loading hovering queue">
    <span /><span /><span />
    <div><i /><i /><i /><i /><i /></div>
  </div>
);

const HoveringQueueWorkspace: React.FC<HoveringQueueWorkspaceProps> = ({
  isAdmin,
  canOperate,
  canManagePasswords,
  refreshNonce,
}) => {
  const { addNotification } = useNotifications();
  const [overview, setOverview] = useState<HoveringOverview | null>(null);
  const [records, setRecords] = useState<HoveringRecordPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<HoveringRecord | null>(null);
  const [page, setPage] = useState(1);
  const [surface, setSurface] = useState<'queue' | 'settings'>('queue');
  const [status, setStatus] = useState<HoveringQueueStatus | ''>('PENDING');
  const [lookupDraft, setLookupDraft] = useState('');
  const [lookup, setLookup] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [liveNow, setLiveNow] = useState(() => Date.now());
  const overviewRequest = useRef(false);
  const recordsRequest = useRef(false);

  const loadOverview = useCallback(async (quiet = false) => {
    if (overviewRequest.current) return null;
    overviewRequest.current = true;
    if (!quiet) setLoading(true);
    try {
      const payload = await reportsApi.getHoveringOverview();
      setOverview(payload);
      setError(null);
      return payload;
    } catch (loadError) {
      setError(errorMessage(loadError));
      return null;
    } finally {
      overviewRequest.current = false;
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadRecords = useCallback(async (quiet = false) => {
    if (recordsRequest.current) return null;
    recordsRequest.current = true;
    if (!quiet) setRecordsLoading(true);
    try {
      const payload = await reportsApi.getHoveringRecords({
        page,
        page_size: 25,
        status: status || undefined,
        lookup: lookup || undefined,
        created_from: createdFrom ? new Date(createdFrom).toISOString() : undefined,
        created_to: createdTo ? new Date(createdTo).toISOString() : undefined,
      });
      setRecords(payload);
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      recordsRequest.current = false;
      if (!quiet) setRecordsLoading(false);
    }
  }, [createdFrom, createdTo, lookup, page, status]);

  const refresh = useCallback(async (quiet = false) => {
    const currentOverview = await loadOverview(quiet);
    if (currentOverview?.configured && !currentOverview.source_error) {
      await loadRecords(quiet);
      return;
    }
    setRecords(null);
    setRecordsLoading(false);
  }, [loadOverview, loadRecords]);

  useEffect(() => {
    void refresh();
  }, [refresh, refreshNonce]);

  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (surface === 'queue' && document.visibilityState === 'visible') void loadOverview(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadOverview, surface]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (surface === 'queue' && document.visibilityState === 'visible') void loadRecords(true);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [loadRecords, surface]);

  useEffect(() => {
    const resumeLiveView = () => {
      if (surface !== 'queue' || document.visibilityState !== 'visible') return;
      void loadOverview(true);
      void loadRecords(true);
    };
    document.addEventListener('visibilitychange', resumeLiveView);
    window.addEventListener('focus', resumeLiveView);
    return () => {
      document.removeEventListener('visibilitychange', resumeLiveView);
      window.removeEventListener('focus', resumeLiveView);
    };
  }, [loadOverview, loadRecords, surface]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setLookup(lookupDraft.trim());
  };

  const changePolicy = async () => {
    if (!overview?.policy || !isAdmin) return;
    setBusy('policy');
    try {
      const policy = await reportsApi.setHoveringPolicy(!overview.policy.enabled);
      setOverview((current) => current ? { ...current, policy } : current);
      addNotification({
        type: 'success',
        message: `Midnight installment-date repair ${policy.enabled ? 'enabled' : 'disabled'}.`,
        priority: 'medium',
      });
      await loadOverview(true);
    } catch (policyError) {
      const message = errorMessage(policyError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setBusy(null);
    }
  };

  const resolveDates = async (recordIds?: string[]) => {
    if (!canOperate) return;
    setBusy(recordIds?.length ? `record-${recordIds[0]}` : 'all-dates');
    try {
      const action = await reportsApi.resolveHoveringDates(recordIds);
      addNotification({
        type: 'success',
        message: `${number(action.updated_count)} stale installment date${action.updated_count === 1 ? '' : 's'} moved to today.`,
        priority: 'medium',
      });
      setSelected(null);
      await refresh(true);
    } catch (resolveError) {
      const message = errorMessage(resolveError);
      setError(message);
      addNotification({ type: 'error', message, priority: 'high' });
    } finally {
      setBusy(null);
    }
  };

  const mergedCustody = useMemo(() => {
    const actions = (overview?.date_actions || []).map((item) => ({
      id: item.action_id,
      at: item.created_at,
      type: 'action' as const,
      item,
    }));
    const audits = (overview?.policy_audit || []).map((item) => ({
      id: item.audit_id,
      at: item.changed_at,
      type: 'policy' as const,
      item,
    }));
    return [...actions, ...audits]
      .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
      .slice(0, 8);
  }, [overview]);

  if (loading && !overview) return <HoveringSkeleton />;

  const counts = overview?.counts;
  const movement = overview?.movement;
  const posture = postureCopy[movement?.posture || 'OBSERVING'];
  const sourceReady = Boolean(overview?.configured && !overview?.source_error);
  const refreshedSeconds = overview?.refreshed_at
    ? Math.max(0, Math.floor((liveNow - new Date(overview.refreshed_at).getTime()) / 1000))
    : null;
  const netChange = movement?.net_change || 0;
  const netQueueCopy = netChange > 0
    ? `+${number(netChange)} net growth`
    : netChange < 0
      ? `${number(Math.abs(netChange))} net reduction`
      : 'Queue held level';
  const selectedStale = selected?.status === 'PENDING'
    && selected.installment_date
    && new Date(selected.installment_date).getTime() < new Date(new Date().toDateString()).getTime();

  return (
    <section className="hovering-shell">
      <nav className="hovering-surface-rail" aria-label="Loan hovering controls">
        <button type="button" className={surface === 'queue' ? 'active' : ''} aria-current={surface === 'queue' ? 'page' : undefined} onClick={() => setSurface('queue')}><FaWaveSquare /><span><strong>Queue command</strong><small>Movement and recovery</small></span></button>
        {canManagePasswords ? <button type="button" className={surface === 'settings' ? 'active' : ''} aria-current={surface === 'settings' ? 'page' : undefined} onClick={() => setSurface('settings')}><FaCog /><span><strong>Robot controls</strong><small>Identities and limits</small></span></button> : null}
      </nav>

      {surface === 'settings' && canManagePasswords ? (
        <HoveringSettingsWorkspace isAdmin={isAdmin} refreshNonce={refreshNonce} />
      ) : (
      <section className="hovering-workspace">
      {error ? (
        <div className="reports-error hovering-error">
          <FaExclamationTriangle />
          <span><strong>Queue control needs attention</strong><small>{error}</small></span>
          <button type="button" onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}

      <section className="hovering-command-deck">
        <header>
          <div>
            <span><FaRobot /> Loan hovering monitor</span>
            <h2>{sourceReady ? posture.title : 'Source connection required'}</h2>
            <p>{sourceReady ? posture.body : 'Configure the isolated txn-bot PostgreSQL identity to begin observation.'}</p>
          </div>
          {sourceReady ? <div className="hovering-live-state"><i /><span><strong>Live</strong><small>{refreshedSeconds === null ? 'Connecting' : `Source read ${refreshedSeconds}s ago`}</small></span></div> : null}
        </header>

        {!sourceReady ? (
          <div className="reports-setup-required hovering-setup">
            <FaLock />
            <span><strong>txn-bot is outside the evidence plane</strong><small>{overview?.source_error || 'Set TXN_BOT_DATABASE_URL on Nexus. No browser receives database credentials.'}</small></span>
          </div>
        ) : (
          <div className={`hovering-signal-line posture-${movement?.posture.toLowerCase()}`}>
            <article>
              <small>Pending queue</small>
              <strong>{number(counts?.pending_count)}</strong>
              <p>{netQueueCopy} / {number(counts?.overdue_count)} stale date{counts?.overdue_count === 1 ? '' : 's'}</p>
            </article>
            <article className="hovering-flow">
              <div className="hovering-flow-heading">
                <span className="hovering-posture-mark">{posture.icon}</span>
                <span><small>Observed flow</small><strong>{posture.title}</strong></span>
              </div>
              <div className="hovering-flow-equation" aria-label="Queue arrivals and processed records">
                <span><small>Arrived</small><strong>+{number(movement?.arrived_count)}</strong><em>{number(movement?.arrival_rate_per_hour)} / hour</em></span>
                <i>−</i>
                <span><small>Processed</small><strong>{number(movement?.processed_count)}</strong><em>{number(movement?.rate_per_hour)} / hour</em></span>
                <i>=</i>
                <span className={netChange > 0 ? 'growing' : netChange < 0 ? 'draining' : 'balanced'}><small>Net queue</small><strong>{netChange > 0 ? '+' : ''}{number(netChange)}</strong><em>{netQueueCopy}</em></span>
              </div>
              <p>{movement?.active_hours_to_clear
                ? `${movement.active_hours_to_clear} active hours to clear at the current net drain`
                : movement?.posture === 'STALLED' && movement.last_movement_at
                  ? `Last processed movement ${dateTime(movement.last_movement_at)}`
                  : `${movement?.observed_active_minutes || 0} active minutes observed`}</p>
            </article>
            <article className="hovering-window">
              <div><small>{overview?.window.mode === 'WEEKEND' ? 'Weekend lane' : 'Weekday lane'}</small><strong>{overview?.window.start}–{overview?.window.end}</strong></div>
              <div className="hovering-window-track" aria-label={`${movement?.window_progress || 0}% of bot window elapsed`}>
                <span style={{ width: `${movement?.window_progress || 0}%` }} />
              </div>
              <p>{movement?.window_open ? 'Window open now' : `Next opening ${dateTime(overview?.window.next_start_at)}`}</p>
              <small className="hovering-window-rule">Weekdays end {overview?.window.weekday_end} / weekends {overview?.window.weekend_end}</small>
            </article>
          </div>
        )}
      </section>

      <div className="hovering-operating-grid">
        <section className="hovering-ledger">
          <header className="hovering-ledger-head">
            <div><span>Bounded queue view</span><h3>Loan ledger fees</h3><p>{number(records?.total)} records match this operating view.</p></div>
            <em>{overview?.credit_account} / {overview?.queue_type.replaceAll('_', ' ')}</em>
          </header>

          <form className="hovering-filters" onSubmit={submitSearch}>
            <label className="hovering-search"><FaSearch /><input value={lookupDraft} onChange={(event) => setLookupDraft(event.target.value)} placeholder="Debit account or reference" /><button type="submit">Search</button></label>
            <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value as HoveringQueueStatus | ''); setPage(1); }}><option value="PENDING">Pending</option><option value="AWAITING_AUTHORIZATION">Awaiting authorization</option><option value="FAILED">Failed</option><option value="AUTHORIZED">Authorized</option><option value="">All statuses</option></select></label>
            <label><span>Created from</span><input type="datetime-local" value={createdFrom} onChange={(event) => { setCreatedFrom(event.target.value); setPage(1); }} /></label>
            <label><span>Created before</span><input type="datetime-local" value={createdTo} onChange={(event) => { setCreatedTo(event.target.value); setPage(1); }} /></label>
          </form>

          <div className={`hovering-record-table ${recordsLoading ? 'loading' : ''}`}>
            <div className="hovering-record-head"><span>Account</span><span>Reference</span><span>Value</span><span>Installment</span><span>Status</span></div>
            {recordsLoading ? Array.from({ length: 6 }, (_, index) => <span className="hovering-row-skeleton" key={index} />) : null}
            {!recordsLoading && records?.items.map((record) => (
              <button type="button" className="hovering-record-row" key={record.id} onClick={() => setSelected(record)}>
                <span><strong>{record.debit_account || 'No debit account'}</strong><small>{record.beneficiary || record.branch || 'Beneficiary not supplied'}</small></span>
                <span><strong>{record.reference || 'No reference'}</strong><small>{record.external_reference || record.id}</small></span>
                <span><strong>{money(record.amount, record.currency)}</strong><small>{record.extended_type || record.type?.replaceAll('_', ' ')}</small></span>
                <span><strong>{dateTime(record.installment_date, 'No date')}</strong><small>Created {dateTime(record.created)}</small></span>
                <span><em className={`hovering-status status-${(record.status || 'unknown').toLowerCase()}`}>{record.status || 'Unknown'}</em><FaChevronRight /></span>
              </button>
            ))}
            {!recordsLoading && !records?.items.length ? <div className="hovering-empty"><FaCheck /><strong>No records match this view.</strong><small>Adjust the queue filters or wait for new bot work.</small></div> : null}
          </div>

          <footer className="hovering-pagination">
            <span>Page {records?.page || 1} of {records?.pages || 1}</span>
            <div>
              <button type="button" disabled={(records?.page || 1) <= 1 || recordsLoading} onClick={() => setPage((value) => Math.max(1, value - 1))} title="Previous page"><FaChevronLeft /></button>
              <strong>{records?.items.length || 0} shown / {number(records?.total)}</strong>
              <button type="button" disabled={(records?.page || 1) >= (records?.pages || 1) || recordsLoading} onClick={() => setPage((value) => value + 1)} title="Next page"><FaChevronRight /></button>
            </div>
          </footer>
        </section>

        <aside className="hovering-custody-column">
          <section className="hovering-date-bridge">
            <header><span><FaCalendarAlt /> Date bridge</span><em>{overview?.policy.enabled ? 'Automatic' : 'Operator held'}</em></header>
            <div className="hovering-midnight-rule"><span>{overview?.window.end}</span><i /><strong>00:00</strong><i /><span>{overview?.window.start}</span></div>
            <h3>Carry stale installments into today</h3>
            <p>The bridge touches only qualifying pending loan-ledger fees after the bot pause.</p>
            <button type="button" className={`hovering-policy-switch ${overview?.policy.enabled ? 'enabled' : ''}`} onClick={() => void changePolicy()} disabled={!isAdmin || busy === 'policy'}>
              <span><i /></span><strong>{overview?.policy.enabled ? 'Midnight repair on' : 'Midnight repair off'}</strong><small>{isAdmin ? 'Administrator control' : 'Admin control required'}</small>
            </button>
            <button type="button" className="hovering-resolve-command" disabled={!canOperate || !counts?.overdue_count || busy === 'all-dates'} onClick={() => void resolveDates()}>
              {busy === 'all-dates' ? <FaSyncAlt className="spin" /> : <FaBolt />}
              <span><strong>Resolve stale dates now</strong><small>{number(counts?.overdue_count)} currently eligible</small></span>
            </button>
            <div className="hovering-last-run"><small>Last automatic handoff</small><strong>{dateTime(overview?.policy.last_run_at, 'No automatic run yet')}</strong><span>{overview?.policy.last_run_status} / {number(overview?.policy.last_updated_count)} updated</span></div>
          </section>

          <section className="hovering-custody-marks">
            <header><span><FaHistory /> Custody marks</span><strong>{mergedCustody.length}</strong></header>
            <div>
              {mergedCustody.map((entry) => entry.type === 'action'
                ? <DateActionRow key={entry.id} action={entry.item as HoveringDateAction} />
                : <PolicyAuditRow key={entry.id} audit={entry.item as HoveringPolicyAudit} />)}
              {!mergedCustody.length ? <p className="hovering-no-history">The first date action or policy change will begin this trail.</p> : null}
            </div>
          </section>
        </aside>
      </div>

      {selected ? (
        <div className="hovering-drawer-layer" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <aside className="hovering-record-drawer" role="dialog" aria-modal="true" aria-labelledby="hovering-record-title">
            <header><span><FaFingerprint /> Queue record</span><button type="button" onClick={() => setSelected(null)} title="Close record"><FaTimes /></button></header>
            <div className="hovering-record-identity"><small>{selected.status || 'UNKNOWN'}</small><h2 id="hovering-record-title">{selected.debit_account || 'Unmapped debit account'}</h2><p>{selected.reference || selected.id}</p></div>
            <dl>
              <div><dt>Amount</dt><dd>{money(selected.amount, selected.currency)}</dd></div>
              <div><dt>Beneficiary</dt><dd>{selected.beneficiary || 'Not supplied'}</dd></div>
              <div><dt>Credit account</dt><dd>{selected.credit_account || 'Not supplied'}</dd></div>
              <div><dt>Branch</dt><dd>{selected.branch || 'Not supplied'}</dd></div>
              <div><dt>External reference</dt><dd>{selected.external_reference || 'Not supplied'}</dd></div>
              <div><dt>Extended type</dt><dd>{selected.extended_type || 'Not supplied'}</dd></div>
              <div><dt>Created</dt><dd>{dateTime(selected.created)}</dd></div>
              <div><dt>Last update</dt><dd>{dateTime(selected.updated)}</dd></div>
              <div className="wide"><dt>Installment date</dt><dd>{dateTime(selected.installment_date, 'Not supplied')}</dd></div>
              <div className="wide"><dt>Description</dt><dd>{selected.description || 'No description supplied.'}</dd></div>
              <div className="wide"><dt>Record ID</dt><dd>{selected.id}</dd></div>
            </dl>
            <footer>
              <button type="button" onClick={() => setSelected(null)}>Close</button>
              <button type="button" className="primary" disabled={!canOperate || !selectedStale || busy === `record-${selected.id}`} onClick={() => void resolveDates([selected.id])}>
                <FaCalendarAlt /> {selectedStale ? 'Resolve this date' : 'Date is already current'}
              </button>
            </footer>
          </aside>
        </div>
      ) : null}
      </section>
      )}
    </section>
  );
};

const DateActionRow: React.FC<{ action: HoveringDateAction }> = ({ action }) => (
  <article className={`hovering-custody-event action-${action.status.toLowerCase()}`}>
    <i><FaCalendarAlt /></i><span><small>{action.trigger === 'SCHEDULED' ? 'System date bridge' : 'Operator date repair'}</small><strong>{number(action.updated_count)} records updated</strong><time>{action.actor} / {dateTime(action.created_at)}</time></span>
  </article>
);

const PolicyAuditRow: React.FC<{ audit: HoveringPolicyAudit }> = ({ audit }) => (
  <article className="hovering-custody-event policy-event">
    <i>{audit.enabled ? <FaBolt /> : <FaPause />}</i><span><small>Automation policy</small><strong>{audit.enabled ? 'Midnight repair enabled' : 'Midnight repair disabled'}</strong><time>{audit.changed_by} / {dateTime(audit.changed_at)}</time></span>
  </article>
);

export default HoveringQueueWorkspace;
