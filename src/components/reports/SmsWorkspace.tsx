import React, { useEffect, useRef, useState } from 'react';
import { FaArrowRight, FaCheckCircle, FaClock, FaExclamationTriangle, FaPause, FaPlay, FaSearch, FaSms, FaSyncAlt, FaTimes } from 'react-icons/fa';
import { reportsClient } from '../../services/reportsApi';
import './SmsWorkspace.css';
import {subscribeSmsEvents, SmsLiveMode} from '../../services/smsLive';

type SmsRecord = { id: string; created_at?: string; updated_at?: string; status: string; recipients: string; source?: string; retry_count?: number; node?: string; sender?: string; message?: string; response?: string; template?: string; queued_recipients?: string };
type Overview = { configured: boolean; source_timezone: string; observed_at?: string; retained?: number; queued?: number; retryable?: number; errors?: number; sent?: number; unknown?: number; retained_since?: string; oldest_waiting?: string; aged?: number; arrivals_15m?: number; sent_updated_15m?: number; age_under_5m?: number; age_5m_1h?: number; age_1h_24h?: number; age_over_24h?: number; age_unknown?: number; sources?: { source: string | null; total: number; waiting: number; errors: number }[]; activity?: {hour: string; arrivals: number; now_sent: number}[] };
type Records = {items: SmsRecord[]; next_cursor: string | null; observed_at: string};
const base = '/api/v1/nexus/reports/sms';
const labels: Record<string, string> = {QUEUED: 'Waiting', RETRYABLE: 'Retry eligible', ERROR: 'Failed', SEND: 'Sent'};
const number = (value?: number) => new Intl.NumberFormat().format(value ?? 0);
const date = (value?: string) => value ? new Date(value).toLocaleString() : 'Not observed';
const failure = (error: any) => typeof error?.response?.data?.detail === 'string' ? error.response.data.detail : 'Unable to refresh SMS evidence. Check the source connection and try again.';
const elapsed = (value?: string) => {
  if (!value) return 'No timestamp';
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 1440)}d ${Math.floor(minutes % 1440 / 60)}h`;
};

function SmsDetail({id, close, revision}: {id: string; close: () => void; revision: number}) {
  const ref = useRef<HTMLElement>(null);
  const [record, setRecord] = useState<SmsRecord>();
  const [error, setError] = useState('');
  const readDetail = useRef<() => void>(() => {});
  const previousRevision = useRef(revision);
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false, running = false, pending = false;
    let timer: ReturnType<typeof setTimeout>;
    const read = async () => {
      if (cancelled) return;
      if (running) { pending = true; return; }
      running = true;
      try {
        const {data} = await reportsClient.get<SmsRecord>(`${base}/records/${id}`, {signal:controller.signal, timeout:15000});
        if (!cancelled) { setRecord(data); setError(''); }
      } catch (e) { if (!cancelled) setError(failure(e)); }
      finally {
        running = false;
        if (!cancelled && pending) { pending = false; timer = setTimeout(read, 250); }
      }
    };
    readDetail.current = () => { void read(); };
    void read();
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); readDetail.current = () => {}; };
  }, [id]);
  useEffect(() => {
    if (previousRevision.current !== revision) { previousRevision.current = revision; readDetail.current(); }
  }, [revision]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; ref.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <div className="sms-drawer-backdrop" onClick={close}>
    <section ref={ref} tabIndex={-1} className="sms-drawer" role="dialog" aria-modal="true" aria-labelledby="sms-detail-title" onClick={e => e.stopPropagation()} onKeyDown={e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const buttons = ref.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
        if (!buttons?.length) return;
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }}>
      <header><div><small>SMS evidence · read only</small><h2 id="sms-detail-title">Message {id}</h2></div><button aria-label="Close SMS detail" onClick={close}><FaTimes /></button></header>
      <div className="sms-drawer-body">
        {error && <p role="alert" className="sms-error">{error}</p>}
        {!record && !error && <p role="status">Loading message evidence…</p>}
        {record && <><span className={`sms-status state-${record.status}`}>{labels[record.status] || record.status}</span>
          <p className="sms-muted">Source status: {record.status}. {record.status === 'SEND' ? 'The source marks this sent; this is not a handset delivery receipt.' : 'The sending service owns retries and status changes.'}</p>
          <dl>{[['Recipient', record.recipients], ['Queued recipients', record.queued_recipients], ['Source', record.source], ['Sender', record.sender], ['Created', date(record.created_at)], ['Updated', date(record.updated_at)], ['Retry count', record.retry_count ?? 'Not supplied'], ['Node', record.node], ['Template', record.template]].map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value === '' || value === null || value === undefined ? 'Not supplied' : value}</dd></div>)}</dl>
          <section className="sms-evidence"><h3>Message content</h3><p>{record.message || 'No message supplied.'}</p></section>
          <section className="sms-evidence"><h3>Gateway response</h3><p>{record.response || 'No response recorded.'}</p></section>
          <p className="sms-muted">This evidence follows live queue updates while the workspace is running. A record may disappear when the source archives it.</p>
        </>}
      </div>
      <footer><button onClick={() => readDetail.current()}><FaSyncAlt /> Refresh evidence</button><button onClick={close}>Close</button></footer>
    </section>
  </div>;
}

export default function SmsWorkspace({refreshNonce = 0}: {refreshNonce?: number}) {
  const [overview, setOverview] = useState<Overview>();
  const [records, setRecords] = useState<Records>();
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [sourceDraft, setSourceDraft] = useState('');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [hours, setHours] = useState(0);
  const [aged, setAged] = useState(false);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<string>();
  const [liveMode, setLiveMode] = useState<SmsLiveMode>('connecting');
  const [detailRevision, setDetailRevision] = useState(0);
  const requestRefresh = useRef<() => void>(() => {});
  const configured = useRef(false);
  const before = cursors[cursors.length - 1];
  const reset = () => setCursors([undefined]);

  useEffect(() => { setRecords(undefined); }, [status, source, search, hours, aged, before]);
  useEffect(() => {
    let cancelled = false, inFlight = false, pending = false;
    let followup: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const load = async () => {
      if (cancelled) return;
      if (inFlight) { pending = true; return; }
      inFlight = true; setBusy(true);
      try {
        const readRecords = async () => {
          const {data} = await reportsClient.get<Records>(`${base}/records`, {params:{status, source, search, hours, aged, before}, signal:controller.signal, timeout:15000});
          if (!cancelled) { setRecords(data); setDetailRevision(v => v + 1); }
        };
        const health = reportsClient.get<Overview>(`${base}/overview`, {signal:controller.signal, timeout:30000}).then(({data}) => {
          if (!cancelled) { setOverview(data); configured.current = data.configured; }
          return data;
        });
        // Once configured, queue rows need not wait for overview aggregation.
        const rows = configured.current ? readRecords() : health.then(data => data.configured ? readRecords() : undefined);
        const outcomes = await Promise.allSettled([health, rows]);
        const failed = outcomes.find(outcome => outcome.status === 'rejected') as PromiseRejectedResult | undefined;
        if (!cancelled) setError(failed ? failure(failed.reason) : '');
      } finally {
        inFlight = false;
        if (!cancelled) {
          setBusy(false);
          if (pending) { pending = false; followup = setTimeout(load, 250); }
        }
      }
    };
    requestRefresh.current = () => { void load(); };
    void load();
    return () => { cancelled = true; controller.abort(); clearTimeout(followup); requestRefresh.current = () => {}; };
  }, [status, source, search, hours, aged, before, refresh, refreshNonce]);

  useEffect(() => {
    if (paused || !overview?.configured) return;
    return subscribeSmsEvents(change => {
      if (change.mode === 'realtime' || change.mode === 'polling') requestRefresh.current();
    }, setLiveMode);
  }, [paused, overview?.configured]);

  const waiting = (overview?.queued || 0) + (overview?.retryable || 0);
  const ageBands = [
    ['Under 5 minutes', overview?.age_under_5m], ['5 minutes–1 hour', overview?.age_5m_1h],
    ['1–24 hours', overview?.age_1h_24h], ['Over 24 hours', overview?.age_over_24h], ['No created time', overview?.age_unknown],
  ] as [string, number | undefined][];
  return <div className="sms-workspace">
    <section className="sms-watchbar"><div className="sms-watch-title"><span className="sms-icon"><FaSms /></span><div><small>Customer communications</small><h2>Every message in view.</h2><p>Waiting, retries, failures, and sent evidence in one place.</p></div></div>
      <div className="sms-watch-controls"><span className={`sms-live ${error ? 'is-error' : paused ? 'is-paused' : ''}`}><i />{error ? 'Refresh interrupted' : paused ? 'Live updates paused' : busy ? 'Refreshing' : overview?.configured ? liveMode === 'realtime' ? 'Live · source events' : liveMode === 'polling' ? 'Polling fallback · 1s' : liveMode === 'unavailable' ? 'Live connection interrupted' : 'Connecting live stream' : 'Awaiting source'}</span><small>Last queue read: {date(records?.observed_at)}</small><div><button onClick={() => setPaused(v => !v)}>{paused ? <FaPlay /> : <FaPause />}{paused ? 'Resume' : 'Pause'}</button><button disabled={busy} onClick={() => setRefresh(v => v + 1)}><FaSyncAlt /> Refresh</button></div></div>
    </section>
    {!paused && overview?.configured && liveMode === 'unavailable' && <div role="status" className="sms-error">Live connection interrupted. Reconnecting automatically; the displayed evidence is a snapshot.</div>}
    {!paused && overview?.configured && liveMode === 'polling' && <p className="sms-muted">Source change notifications are not installed. One-second polling is active until the source trigger is enabled.</p>}
    {error && <div role="alert" className="sms-error"><FaExclamationTriangle /> {error} {records ? 'Displayed records are the last successful snapshot.' : ''}</div>}
    {overview?.configured === false ? <section className="sms-panel"><h3>Connect the SMS source</h3><p>The workspace is ready. Configure the SMSAL connection on the Nexus API server, then refresh.</p><p>Database: postgres · source timezone: {overview.source_timezone}. No SMS records are changed by this workspace.</p></section> : !overview ? <div className="sms-loading" role="status">{error ? 'No SMS evidence loaded. Refresh to try again.' : 'Loading SMS queue evidence…'}</div> : <>
      {!overview && !error && <div className="sms-loading" role="status">Loading SMS queue evidence…</div>}
      <div className="sms-metrics">{([
        ['QUEUED', 'Waiting to send', overview?.queued, 'Awaiting the sending service', <FaClock />],
        ['RETRYABLE', 'Retry eligible', overview?.retryable, 'Failed attempt; service may retry', <FaSyncAlt />],
        ['ERROR', 'Failed', overview?.errors, 'Retry attempts exhausted', <FaExclamationTriangle />],
        ['SEND', 'Sent by source', overview?.sent, 'Not a handset delivery receipt', <FaCheckCircle />],
      ] as const).map(([key, title, value, hint, icon]) => <button key={key} className={`sms-metric state-${key} ${status === key ? 'selected' : ''}`} aria-pressed={status === key} onClick={() => {setStatus(status === key ? '' : key); if (key === 'ERROR' || key === 'SEND') setAged(false); reset();}}><span>{icon}{title}</span><strong>{overview ? number(value) : '—'}</strong><small>{hint}</small></button>)}</div>
      <section className="sms-signals"><div><small>Oldest waiting message</small><strong>{!overview ? '—' : waiting ? elapsed(overview.oldest_waiting) : 'No backlog'}</strong><span>{waiting ? date(overview?.oldest_waiting) : 'No waiting or retry-eligible messages observed'}</span></div><div><small>New records · last 15 min</small><strong>{overview ? number(overview.arrivals_15m) : '—'}</strong><span>Created in the retained SMS queue</span></div><div><small>Sent records updated · last 15 min</small><strong>{overview ? number(overview.sent_updated_15m) : '—'}</strong><span>Latest update time; not measured sending throughput</span></div></section>
      <div className="sms-insights"><section className="sms-panel"><header><div><small>Waiting + retry eligible</small><h3>Backlog age</h3></div><button className={aged ? 'selected' : ''} aria-pressed={aged} onClick={() => {setAged(v => !v); setStatus(''); reset();}}>{number(overview?.aged)} over 1h <FaArrowRight /></button></header>{ageBands.map(([label,value]) => <div className="sms-age" key={label}><span>{label}</span><meter min={0} max={Math.max(1, waiting)} value={value || 0} aria-label={label} /><strong>{number(value)}</strong></div>)}<p className="sms-muted">Age starts at creation. One hour is an investigation filter, not a configured delivery SLA.</p></section>
        <section className="sms-panel"><header><div><small>Top 12 · waiting first</small><h3>Source watch</h3></div></header><div className="sms-sources">{overview?.sources?.map((item, index) => <button key={item.source ?? `unknown-${index}`} disabled={!item.source} onClick={() => {setSource(item.source || '');setSourceDraft(item.source || '');reset();}}><span>{item.source || 'Source not supplied'}<small>{number(item.total)} retained</small></span><span><b>{number(item.waiting)}</b> waiting<small>{number(item.errors)} failed</small></span></button>)}{overview && !overview.sources?.length && <p>No retained SMS sources.</p>}</div></section></div>
      <details className="sms-panel sms-activity"><summary>Arrival pattern · last 24 hours <span>Counts by creation hour</span></summary><div className="sms-bars">{overview?.activity?.map(item => <div key={item.hour} title={`${date(item.hour)}: ${number(item.arrivals)} created; ${number(item.now_sent)} currently sent`}><span style={{height:`${Math.max(3, item.arrivals / Math.max(1, ...overview.activity!.map(x => x.arrivals)) * 85)}px`}} /><small>{new Date(item.hour).getHours()}:00</small></div>)}</div><p className="sms-muted">Retained records only; archiving can reduce counts. Hours use your browser timezone.</p></details>
      <section className="sms-panel sms-queue"><header><div><small>Message explorer</small><h3>Inspect the queue</h3><p>Metrics above cover all retained SMS records. Filters below apply to this list.</p></div><span className="sms-readonly">Read only</span></header>
        <form className="sms-filters" onSubmit={e => {e.preventDefault();setSearch(draft.trim());setSource(sourceDraft.trim());reset();}}>
          <label>Exact ID or recipient<div><input value={draft} maxLength={200} onChange={e => setDraft(e.target.value)} placeholder="Record ID or full recipient" /><button aria-label="Apply SMS search"><FaSearch /></button></div></label>
          <label>Status<select value={status} onChange={e => {setStatus(e.target.value); if (['ERROR','SEND'].includes(e.target.value)) setAged(false); reset();}}><option value="">All statuses</option>{Object.entries(labels).map(([key,label]) => <option key={key} value={key}>{label} · {key}</option>)}</select></label>
          <label>Created<select value={hours} onChange={e => {setHours(Number(e.target.value)); reset();}}><option value={0}>All retained dates</option><option value={1}>Last hour</option><option value={24}>Last 24 hours</option><option value={168}>Last 7 days</option></select></label>
          <label>Exact source<input list="sms-sources" value={sourceDraft} maxLength={200} onChange={e => setSourceDraft(e.target.value)} placeholder="All sources" /><datalist id="sms-sources">{overview?.sources?.filter(x => x.source).map(x => <option key={x.source!} value={x.source!} />)}</datalist></label><button type="submit">Apply</button>
        </form>
        <div className="sms-scope"><span>{status ? labels[status] : 'All statuses'} · {hours ? `Last ${hours}h` : 'All retained dates'}{source ? ` · ${source}` : ''}{search ? ` · Exact lookup: ${search}` : ''}{aged ? ' · Waiting over 1 hour' : ''}</span><button onClick={() => {setStatus('');setHours(0);setAged(false);setSource('');setSourceDraft('');setSearch('');setDraft('');reset();}}>Clear filters</button></div>
        <div className="sms-records" aria-busy={busy}>{records?.items.map(item => <button key={item.id} className="sms-record" onClick={() => setSelected(item.id)}><span className="sms-record-id"><b>#{item.id}</b><small>{item.recipients}</small></span><span>{item.source || 'Unknown source'}<small>Created {date(item.created_at)}</small></span><span className={`sms-status state-${item.status}`}>{labels[item.status] || item.status || 'Unknown'}</span><span className="sms-retries">{item.retry_count ?? '—'}<small>retries</small></span><FaArrowRight /></button>)}{records && !records.items.length && <div className="sms-empty"><FaSearch /><h3>No matching SMS records</h3><p>Try a wider time window or clear the filters. The source may have archived older records.</p></div>}{!records && <p role="status">{error ? 'Records unavailable.' : 'Loading records…'}</p>}</div>
        <footer><span>Page {cursors.length} · up to 50 records · newest ID first</span><div><button disabled={cursors.length === 1 || busy} onClick={() => setCursors(v => v.slice(0,-1))}>Previous</button><button disabled={!records?.next_cursor || busy} onClick={() => setCursors(v => [...v, records!.next_cursor!])}>Next</button></div></footer>
      </section>
      <p className="sms-boundary">{number(overview?.retained)} retained SMS records · oldest created: {date(overview?.retained_since)} · source timezone: {overview?.source_timezone || '—'} · displayed dates use your browser timezone. Deleted records and EMAIL traffic are excluded.{overview?.unknown ? ` ${number(overview.unknown)} records have an unrecognized status; inspect All statuses.` : ''} Overview observed: {date(overview?.observed_at)}.</p>
      <details className="sms-panel sms-guide"><summary>Operator guide · what to do next</summary><ol><li><b>Waiting growing or unusually old?</b> Open the over-one-hour filter, check the oldest creation time and source, then inspect a message’s node and gateway response.</li><li><b>Retry eligible?</b> The sending service owns the next attempt. Check retry count and response; SentinelOps does not trigger another SMS.</li><li><b>Failed?</b> Read the exact gateway response. Escalate invalid recipients or network errors to the responsible source/gateway team with the record ID and timestamps.</li><li><b>Sent but customer reports no SMS?</b> SEND reflects source status only. Request delivery evidence from the gateway team.</li><li><b>Counts decreased or a record disappeared?</b> Check whether the source archived or deleted it. A falling count alone does not prove successful sending.</li></ol></details>
    </>}
    {selected && <SmsDetail id={selected} revision={detailRevision} close={() => setSelected(undefined)} />}
  </div>;
}
