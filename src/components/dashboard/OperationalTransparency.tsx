import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FaArrowRight,
  FaCheckCircle,
  FaExclamationTriangle,
  FaFingerprint,
  FaRobot,
  FaSyncAlt,
  FaUserCheck,
  FaWaveSquare,
} from 'react-icons/fa';
import clearingApi, { ClearingBatchSummary, ClearingOverview } from '../../services/clearingApi';
import centralizedWebSocketManager from '../../services/centralizedWebSocketManager';
import reportsApi, { HoveringOverview, HoveringPosture } from '../../services/reportsApi';

interface TransparencyState {
  clearingOverview: ClearingOverview | null;
  clearingBatches: ClearingBatchSummary[];
  hoveringOverview: HoveringOverview | null;
  clearingError: string | null;
  hoveringError: string | null;
  loading: boolean;
  refreshedAt: Date | null;
}

const initialState: TransparencyState = {
  clearingOverview: null,
  clearingBatches: [],
  hoveringOverview: null,
  clearingError: null,
  hoveringError: null,
  loading: true,
  refreshedAt: null,
};

const numberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

const number = (value?: number | null) => numberFormatter.format(value || 0);

const errorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { detail?: string; message?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
    if (response?.data?.message) return response.data.message;
  }
  return error instanceof Error && error.message ? error.message : 'Source unavailable';
};

const relativeAge = (value?: string | null) => {
  if (!value) return 'time pending';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'time pending';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const sourceKind = (batch: ClearingBatchSummary) => (
  batch.source_kind === 'ACCOUNT_EXPLORER' ? 'Account decision' : 'Controlled batch'
);

const postureCopy: Record<HoveringPosture, { label: string; detail: string; tone: string }> = {
  CLEAR: { label: 'Queue clear', detail: 'No pending loan-ledger fees remain.', tone: 'ok' },
  MOVING: { label: 'Robots moving', detail: 'Pending work is being processed inside the active window.', tone: 'ok' },
  STALLED: { label: 'Movement stalled', detail: 'The queue is not reducing while robots should be active.', tone: 'danger' },
  OBSERVING: { label: 'Rate observing', detail: 'SentinelOps is establishing a reliable movement rate.', tone: 'neutral' },
  PAUSED: { label: 'Window paused', detail: 'Robots are outside their scheduled operating period.', tone: 'watch' },
};

const TransparencySkeleton: React.FC<{ rows?: number }> = ({ rows = 3 }) => (
  <div className="transparency-skeleton" role="status" aria-label="Loading operational transparency">
    <span />
    {Array.from({ length: rows }).map((_, index) => <i key={index} />)}
  </div>
);

const OperationalTransparency: React.FC = () => {
  const [state, setState] = useState<TransparencyState>(initialState);
  const [refreshing, setRefreshing] = useState(false);
  const requestInFlight = useRef(false);
  const mounted = useRef(true);

  const refresh = useCallback(async (quiet = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (!quiet) setRefreshing(true);

    const [overviewResult, batchesResult, hoveringResult] = await Promise.allSettled([
      clearingApi.overview(),
      clearingApi.listBatches(50),
      reportsApi.getHoveringOverview(),
    ]);

    if (mounted.current) {
      setState((current) => ({
        clearingOverview: overviewResult.status === 'fulfilled' ? overviewResult.value : current.clearingOverview,
        clearingBatches: batchesResult.status === 'fulfilled' ? batchesResult.value : current.clearingBatches,
        hoveringOverview: hoveringResult.status === 'fulfilled' ? hoveringResult.value : current.hoveringOverview,
        clearingError: overviewResult.status === 'rejected'
          ? errorMessage(overviewResult.reason)
          : batchesResult.status === 'rejected'
            ? errorMessage(batchesResult.reason)
            : null,
        hoveringError: hoveringResult.status === 'rejected' ? errorMessage(hoveringResult.reason) : null,
        loading: false,
        refreshedAt: new Date(),
      }));
      setRefreshing(false);
    }
    requestInFlight.current = false;
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh(false);
    let custodyRefreshTimer: number | null = null;

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(true);
    }, 10000);
    const unsubscribeCustody = centralizedWebSocketManager.subscribe('funds-custody', (event) => {
      if (event?.type !== 'CUSTODY_UPDATE' || event?.event_type === 'selection_changed') return;
      if (custodyRefreshTimer) window.clearTimeout(custodyRefreshTimer);
      custodyRefreshTimer = window.setTimeout(() => void refresh(true), 250);
    });
    const resume = () => {
      if (document.visibilityState === 'visible') void refresh(true);
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);

    return () => {
      mounted.current = false;
      window.clearInterval(timer);
      if (custodyRefreshTimer) window.clearTimeout(custodyRefreshTimer);
      unsubscribeCustody();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [refresh]);

  const pendingBatches = useMemo(
    () => state.clearingBatches
      .filter((batch) => batch.status === 'PENDING_APPROVAL')
      .sort((left, right) => (right.submitted_at || right.updated_at).localeCompare(left.submitted_at || left.updated_at)),
    [state.clearingBatches],
  );

  const clearingCount = state.clearingOverview?.awaiting_approval ?? pendingBatches.length;
  const hovering = state.hoveringOverview;
  const movement = hovering?.movement;
  const counts = hovering?.counts;
  const posture = postureCopy[movement?.posture || 'OBSERVING'];
  const netChange = movement?.net_change || 0;
  const netTone = netChange > 0 ? 'growing' : netChange < 0 ? 'draining' : 'balanced';
  const refreshedLabel = state.refreshedAt
    ? state.refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'connecting';

  return (
    <section className="operations-transparency-board" aria-labelledby="operations-transparency-title" aria-busy={state.loading || refreshing}>
      <header className="transparency-board-head">
        <div className='fine-div'>
          <span><FaWaveSquare /> Custody + automation</span>
          <h2 id="operations-transparency-title">Funds movement transparency</h2>
          <p>See decisions awaiting human authority and the live movement of the loan-hovering queue.</p>
        </div>
        <div className="transparency-live-mark" aria-live="polite">
          <i />
          <span><strong>Live operating view</strong><small>Refreshed {refreshedLabel}</small></span>
          <button type="button" onClick={() => void refresh(false)} disabled={refreshing} title="Refresh custody and hovering signals">
            <FaSyncAlt className={refreshing ? 'spinning' : ''} />
          </button>
        </div>
      </header>

      <div className="transparency-lanes">
        <article className="transparency-lane clearing-transparency-lane">
          <header>
            <span className="transparency-lane-icon"><FaUserCheck /></span>
            <div className='fine-div'>
              <small>Clearing execution desk</small>
              <h3>{clearingCount ? `${number(clearingCount)} awaiting authorization` : 'Authorization queue clear'}</h3>
              <p>{clearingCount
                ? 'Sealed Oracle intentions waiting for a checker decision.'
                : 'No sealed mutation is waiting for checker custody.'}</p>
            </div>
            <em className={clearingCount ? 'attention' : 'clear'}>{number(clearingCount)}</em>
          </header>

          {state.loading && !state.clearingOverview ? <TransparencySkeleton /> : null}

          {!state.loading && state.clearingError && !state.clearingOverview ? (
            <div className="transparency-source-state">
              <FaExclamationTriangle />
              <span><strong>Execution Desk is reconnecting</strong><small>{state.clearingError}</small></span>
            </div>
          ) : null}

          {state.clearingOverview ? (
            <>
              <div className="clearing-transparency-posture">
                <span><small>Open controlled work</small><strong>{number(state.clearingOverview.open_batches)}</strong></span>
                <span><small>Oracle mutation gate</small><strong>{state.clearingOverview.writes_enabled ? 'Enabled' : 'Locked'}</strong></span>
                <span><small>Operating window</small><strong>{state.clearingOverview.operating_window.blocked ? 'Batch limit active' : 'Unrestricted'}</strong></span>
              </div>

              <div className="clearing-transparency-queue">
                {pendingBatches.slice(0, 3).map((batch) => (
                  <Link key={batch.batch_id} to="/funds-custody?workspace=execution" className="clearing-transparency-item">
                    <span><FaFingerprint /></span>
                    <div>
                      <small>{sourceKind(batch)}</small>
                      <strong>{batch.batch_name}</strong>
                      <p>{number(batch.selected_count)} custody item{batch.selected_count === 1 ? '' : 's'} / maker {batch.submitted_by || batch.created_by}</p>
                    </div>
                    <time>{relativeAge(batch.submitted_at || batch.updated_at)}</time>
                    <FaArrowRight />
                  </Link>
                ))}
                {!pendingBatches.length && !state.clearingError ? (
                  <div className="transparency-clear-state"><FaCheckCircle /><span><strong>Nothing is waiting</strong><small>New maker submissions will surface here on the next live read.</small></span></div>
                ) : null}
                {state.clearingError && state.clearingOverview ? (
                  <div className="transparency-inline-warning"><FaExclamationTriangle /> Queue details are reconnecting; the aggregate count is retained.</div>
                ) : null}
              </div>
            </>
          ) : null}

          <Link to="/funds-custody?workspace=execution" className="transparency-open-command">
            Open Execution Desk <FaArrowRight />
          </Link>
        </article>

        <article className={`transparency-lane hovering-transparency-lane tone-${posture.tone}`}>
          <header>
            <span className="transparency-lane-icon"><FaRobot /></span>
            <div className='fine-div'>
              <small>Loan hovering monitor</small>
              <h3>{posture.label}</h3>
              <p>{posture.detail}</p>
            </div>
            <em className={`posture-${(movement?.posture || 'OBSERVING').toLowerCase()}`}><i />{movement?.posture || 'OBSERVING'}</em>
          </header>

          {state.loading && !hovering ? <TransparencySkeleton rows={4} /> : null}

          {!state.loading && state.hoveringError && !hovering ? (
            <div className="transparency-source-state">
              <FaExclamationTriangle />
              <span><strong>Hovering monitor is reconnecting</strong><small>{state.hoveringError}</small></span>
            </div>
          ) : null}

          {hovering && (!hovering.configured || hovering.source_error) ? (
            <div className="transparency-source-state">
              <FaExclamationTriangle />
              <span><strong>txn-bot is outside the evidence plane</strong><small>{hovering.source_error || 'The hovering data source is not configured.'}</small></span>
            </div>
          ) : null}

          {hovering?.configured && !hovering.source_error ? (
            <>
              <div className="hovering-transparency-flow" aria-label="Hovering queue movement">
                <span className="pending"><small>Pending now</small><strong>{number(counts?.pending_count)}</strong><em>{number(counts?.overdue_count)} date overdue</em></span>
                <span className="arrived"><small>Arrived</small><strong>+{number(movement?.arrived_count)}</strong><em>{number(movement?.arrival_rate_per_hour)} / hour</em></span>
                <b aria-hidden="true">−</b>
                <span className="processed"><small>Processed</small><strong>{number(movement?.processed_count)}</strong><em>{number(movement?.rate_per_hour)} / hour</em></span>
                <b aria-hidden="true">=</b>
                <span className={`net ${netTone}`}><small>Net movement</small><strong>{netChange > 0 ? '+' : ''}{number(netChange)}</strong><em>{netChange > 0 ? 'queue growing' : netChange < 0 ? 'queue draining' : 'queue balanced'}</em></span>
              </div>

              <div className="hovering-transparency-window">
                <span><small>{hovering.window.mode === 'WEEKEND' ? 'Weekend robot lane' : 'Weekday robot lane'}</small><strong>{hovering.window.start}–{hovering.window.end}</strong></span>
                <div className="hovering-window-progress"><i style={{ width: `${movement?.window_progress || 0}%` }} /></div>
                <span><small>Window state</small><strong>{movement?.window_open ? 'Open now' : 'Paused'}</strong></span>
              </div>
              {state.hoveringError ? <div className="transparency-inline-warning"><FaExclamationTriangle /> Showing the last confirmed hovering read.</div> : null}
            </>
          ) : null}

          <Link to="/reports?workspace=hovering" className="transparency-open-command">
            Open Hovering Monitor <FaArrowRight />
          </Link>
        </article>
      </div>
    </section>
  );
};

export default OperationalTransparency;
