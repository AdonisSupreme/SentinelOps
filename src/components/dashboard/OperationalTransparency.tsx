import { useAccess, ModuleAccess } from '../../contexts/AccessContext';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaArrowRight, FaRobot, FaSyncAlt, FaUserCheck, FaWaveSquare } from 'react-icons/fa';
import clearingApi, { ClearingOverview } from '../../services/clearingApi';
import centralizedWebSocketManager from '../../services/centralizedWebSocketManager';
import reportsApi, { HoveringOverview, HoveringPosture } from '../../services/reportsApi';

interface TransparencyState {
  clearing: ClearingOverview | null;
  hovering: HoveringOverview | null;
  clearingError: boolean;
  hoveringError: boolean;
  loading: boolean;
  refreshedAt: Date | null;
}
const number = (value?: number | null) => new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value || 0);
const postureLabels: Record<HoveringPosture, string> = { CLEAR: 'Queue clear', MOVING: 'Robots moving', STALLED: 'Movement stalled', OBSERVING: 'Observing movement', PAUSED: 'Window paused' };

const OperationalTransparency: React.FC = () => {
  const { canAccessModule } = useAccess();
  const [state, setState] = useState<TransparencyState>({ clearing: null, hovering: null, clearingError: false, hoveringError: false, loading: true, refreshedAt: null });
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const refresh = useCallback(async (quiet = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (!quiet) setRefreshing(true);
    const [clearing, hovering] = await Promise.allSettled([
      canAccessModule('funds_custody.workspace') ? clearingApi.overview() : Promise.resolve(null),
      canAccessModule('reports.hovering') ? reportsApi.getHoveringOverview() : Promise.resolve(null),
    ]);
    if (mounted.current) {
      setState(previous => ({
        clearing: clearing.status === 'fulfilled' ? clearing.value : previous.clearing,
        hovering: hovering.status === 'fulfilled' ? hovering.value : previous.hovering,
        clearingError: clearing.status === 'rejected', hoveringError: hovering.status === 'rejected',
        loading: false, refreshedAt: new Date(),
      }));
      setRefreshing(false);
    }
    inFlight.current = false;
  }, [canAccessModule]);

  useEffect(() => {
    if (!canAccessModule('funds_custody.workspace') && !canAccessModule('reports.hovering')) return;
    mounted.current = true;
    void refresh();
    let custodyTimer: number | undefined;
    const resume = () => { if (document.visibilityState === 'visible') void refresh(true); };
    const interval = window.setInterval(resume, 10000);
    const unsubscribe = canAccessModule('funds_custody.workspace') ? centralizedWebSocketManager.subscribe('funds-custody', event => {
      if (event?.type !== 'CUSTODY_UPDATE' || event?.event_type === 'selection_changed') return;
      window.clearTimeout(custodyTimer);
      custodyTimer = window.setTimeout(resume, 250);
    }) : () => {};
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => { mounted.current = false; window.clearInterval(interval); window.clearTimeout(custodyTimer); unsubscribe(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('focus', resume); };
  }, [canAccessModule, refresh]);

  if (!canAccessModule('funds_custody.workspace') && !canAccessModule('reports.hovering')) return null;
  const { clearing, hovering } = state;
  const unavailable = state.hoveringError || Boolean(hovering?.source_error) || Boolean(hovering && !hovering.configured);
  const posture = hovering?.movement?.posture || 'OBSERVING';
  return (
    <section className="ops-watch-strip" aria-label="Custody and automation" aria-busy={state.loading || refreshing}>
      <div className="ops-watch-heading"><FaWaveSquare /><span>Custody + automation<small>{state.refreshedAt ? 'Checked ' + state.refreshedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Connecting'}</small></span>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh custody and automation"><FaSyncAlt className={refreshing ? 'spinning' : ''} /></button>
      </div>
      <ModuleAccess module="funds_custody.workspace"><Link to="/funds-custody?workspace=execution" className={'ops-watch-card ' + (state.clearingError ? 'watch-warning' : clearing?.awaiting_approval ? 'watch-attention' : '')}>
        <span className="ops-watch-icon"><FaUserCheck /></span>
        <span className="ops-watch-copy"><small>Authorization desk</small>
          <strong>{state.loading && !clearing ? 'Connecting…' : !clearing ? 'Status unavailable' : number(clearing.awaiting_approval) + ' awaiting authorization'}</strong>
          <span>{state.clearingError ? 'Connection interrupted · last confirmed count retained' : clearing ? number(clearing.open_batches) + ' open batches · mutation gate ' + (clearing.writes_enabled ? 'enabled' : 'locked') : 'Checking custody queue'}</span>
        </span><FaArrowRight />
      </Link></ModuleAccess>
      <ModuleAccess module="reports.hovering"><Link to="/reports?workspace=hovering" className={'ops-watch-card ' + (unavailable || posture === 'STALLED' ? 'watch-warning' : '')}>
        <span className="ops-watch-icon"><FaRobot /></span>
        <span className="ops-watch-copy"><small>Loan hovering monitor</small>
          <strong>{unavailable ? 'Source unavailable' : state.loading && !hovering ? 'Connecting…' : postureLabels[posture]}</strong>
          <span>{unavailable ? hovering?.source_error || 'Monitor disconnected · open to investigate' : hovering ? number(hovering.counts?.pending_count) + ' pending · ' + number(hovering.movement?.rate_per_hour) + '/hr processed · ' + (hovering.movement?.window_open ? 'window open' : 'window paused') : 'Waiting for queue telemetry'}</span>
        </span><FaArrowRight />
      </Link></ModuleAccess>
    </section>
  );
};
export default OperationalTransparency;
