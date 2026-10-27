import React, { useCallback, useEffect, useRef, useState } from 'react';

import { FaArrowRight, FaHistory, FaSearch, FaSyncAlt, FaTimes } from 'react-icons/fa';

import reportsApi, { PersonalLoanRecord, PersonalLoanScope, QueueCustody, RecoveryPreview } from '../../services/reportsApi';

import QueueRecoveryReview, { recoveryError } from './QueueRecoveryReview';

import './PersonalLoanWorkspace.css';

import PersonalLoanReporting from './PersonalLoanReporting';



const queue = 'personal-loans';

export const personalStatus = (row: PersonalLoanRecord) => row.status_id === 31 && row.is_processed === '0' ? 'PENDING'

  : row.status_id === 18 && row.is_processed === '1' ? 'SUCCESS'

    : row.status_id === 18 && row.is_processed === '2' ? 'FAILED' : 'OTHER';



const PersonalLoanWorkspace: React.FC<{isAdmin: boolean; refreshNonce: number}> = ({isAdmin, refreshNonce}) => {

  const [overview, setOverview] = useState<Awaited<ReturnType<typeof reportsApi.personalOverview>> | null>(null);

  const [records, setRecords] = useState<Awaited<ReturnType<typeof reportsApi.personalRecords>> | null>(null);

  const [status, setStatus] = useState('PENDING');

  const [scope, setScope] = useState<PersonalLoanScope>({});

  const [currency, setCurrency] = useState('');

  const [lastRead, setLastRead] = useState<number | null>(null);

  const [now, setNow] = useState(Date.now());

  const [refreshing, setRefreshing] = useState(false);

  const [connectionFailed, setConnectionFailed] = useState(false);

  const inFlight = useRef<string | null>(null);

  const [lookup, setLookup] = useState('');

  const [draft, setDraft] = useState('');

  const [from, setFrom] = useState(''); const [to, setTo] = useState('');

  const [description, setDescription] = useState<string | undefined>();

  const [reasons, setReasons] = useState<{description: string; count: number}[]>([]);

  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [selected, setSelected] = useState<PersonalLoanRecord | null>(null);

  const [importIds, setImportIds] = useState('');

  const [preview, setPreview] = useState<RecoveryPreview | null>(null);

  const [custody, setCustody] = useState<QueueCustody | null>(null);

  const [custodyPage, setCustodyPage] = useState(1);

  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(true);

  const [error, setError] = useState(''); const [notice, setNotice] = useState('');

  const generation = useRef(0);
  const detailRef = useRef<HTMLElement>(null);
  const detailOpenId = selected && !preview ? selected.id : null;
  useEffect(() => {
    if (detailOpenId === null) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; detailRef.current?.focus();
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, [detailOpenId]);


  const filters = useCallback(() => ({...scope, currency, lookup: lookup || undefined,

    description: status === 'FAILED' ? description : undefined,

    created_from: from ? new Date(from).toISOString() : undefined,

    created_to: to ? new Date(to).toISOString() : undefined}), [scope, currency, lookup, status, description, from, to]);



  const load = useCallback(async (quiet = false) => {

    const key = JSON.stringify({...filters(),status,page});

    if (inFlight.current === key) return;

    inFlight.current = key;

    const request = ++generation.current;

    setRefreshing(true);

    if (!quiet) setLoading(true);

    try {

      const [summaryResult, rowsResult] = await Promise.allSettled([reportsApi.personalOverview(currency), reportsApi.personalRecords({...filters(), status, page})]);

      if (summaryResult.status === 'rejected') throw summaryResult.reason;

      if (rowsResult.status === 'rejected') throw rowsResult.reason;

      const summary = summaryResult.value; const rows = rowsResult.value;

      if (request === generation.current) { setOverview(summary); setRecords(rows); setLastRead(Date.now()); setConnectionFailed(false); setError('');

        setSelectedIds(ids => ids.filter(id => rows.items.some(row => String(row.id) === id && personalStatus(row) === 'FAILED')));

        setSelected(current => current ? rows.items.find(row => row.id === current.id) || null : null); }

    } catch (failure) { if (request === generation.current) { setConnectionFailed(true); setError(recoveryError(failure)); } }

    finally { if (request === generation.current) { setLoading(false); setRefreshing(false); inFlight.current = null; } }

  }, [filters, status, page, currency]);

  const invalidate = useCallback(() => { generation.current++; inFlight.current = null; }, []);

  useEffect(() => { setSelectedIds([]); void load(); return invalidate; }, [load, refreshNonce, invalidate]);

  useEffect(() => {

    let stopped = false;

    let timer: number;

    const tick = async () => {

      if (document.visibilityState === 'visible' && navigator.onLine) await load(true);

      if (!stopped) timer = window.setTimeout(tick, 5000);

    };

    timer = window.setTimeout(tick, 5000);

    const resume = () => { if (document.visibilityState === 'visible') void load(true); };

    window.addEventListener('focus', resume);

    window.addEventListener('online', resume);

    document.addEventListener('visibilitychange', resume);

    return () => { stopped = true; window.clearTimeout(timer); window.removeEventListener('focus', resume); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };

  }, [load]);

  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);

  useEffect(() => {

    let active = true;

    if (status === 'FAILED') void reportsApi.failureReasons(queue, currency).then(value => { if (active) setReasons(value); }).catch(failure => { if (active) setError(recoveryError(failure)); });

    return () => { active = false; };

  }, [status, currency, refreshNonce]);



  const prepare = async (ids?: string[], importing = false) => {

    setBusy(true); setNotice('');

    try {

      const result = await reportsApi.prepareRecovery({...(!importing ? filters() : {currency}), record_ids: ids}, queue);

      if (ids && result.count !== ids.length) {

        setNotice(`${result.count} of ${ids.length} requested IDs are eligible. The review lists only eligible failed records; missing, changed or out-of-scope IDs are excluded.`);

      }

      setPreview(result);

    } catch (failure) { setError(recoveryError(failure)); }

    finally { setBusy(false); }

  };

  const importReview = () => {

    const ids = Array.from(new Set(importIds.trim().split(/[\s,;]+/).filter(Boolean)));

    if (!ids.length || ids.length > 500 || ids.some(id => !/^\d+$/.test(id))) { setError('Enter 1–500 numeric application IDs, separated by commas or new lines.'); return; }

    void prepare(ids, true);

  };

  const history = async (next: number) => {

    setBusy(true);

    try { setCustody(await reportsApi.queueCustody(next, queue)); setCustodyPage(next); }

    catch (failure) { setError(recoveryError(failure)); }

    finally { setBusy(false); }

  };

  const counts = overview?.counts || {};

  const total = ['PENDING','SUCCESS','FAILED'].reduce((sum, key) => sum + (counts[key] || 0), 0);

  const completed = total ? Math.round((counts.SUCCESS || 0) / total * 100) : 0;

  return <section className="personal-loan-workspace">

    <header className="personal-loan-heading"><div><small>Personal lending · 48 months</small><h2>A clear path from queue to outcome</h2><p>USD and ZWL personal loan applications. Review failed applications before returning them to the robot queue.</p></div><button aria-label="Refresh personal loan queue" onClick={() => void load()} disabled={loading}><FaSyncAlt /></button></header>

    {error && <div className="reports-error" role="alert"><span>{error}</span><button onClick={() => setError('')}>Dismiss</button></div>}

    {notice && <p role="status">{notice}</p>}

    <div className="personal-live-toolbar">

      <div className="personal-currency-switch" role="group" aria-label="Loan currency">{[['','Both currencies'],['USD','USD'],['ZWL','ZWL']].map(([value,label]) => <button key={value} type="button" aria-pressed={currency === value} onClick={() => { if (value === currency) return; setCurrency(value); setPage(1); setDescription(undefined); setOverview(null); setRecords(null); setSelected(null); setLastRead(null); }}>{label}</button>)}</div>

      <div className={`personal-live-indicator ${connectionFailed || !navigator.onLine || (lastRead !== null && now-lastRead > 20000) ? 'stale' : ''}`} role="status"><i /><span><strong>{!navigator.onLine ? 'Offline' : connectionFailed ? 'Connection interrupted' : lastRead !== null && now-lastRead > 20000 ? 'Source update delayed' : refreshing ? 'Refreshing source' : lastRead ? 'Live monitoring' : 'Connecting'}</strong><small>{lastRead ? `Last verified ${Math.max(0,Math.floor((now-lastRead)/1000))}s ago` : 'Awaiting source data'} · checks every 5 seconds</small></span></div>

    </div>

    <div className="personal-loan-metrics">{['PENDING','SUCCESS','FAILED'].map(key => <article key={key}><small>{({PENDING:'Pending',SUCCESS:'Successful',FAILED:'Failed'} as Record<string,string>)[key]}</small><strong>{overview ? (counts[key] || 0).toLocaleString() : '—'}</strong></article>)}</div>

    <section className="personal-loan-progress"><div><strong>{completed}% successful</strong><span>Share of pending, successful and failed applications · {total.toLocaleString()} records</span></div><progress value={completed} max={100} /><small>Source snapshot {overview?.refreshed_at ? new Date(overview.refreshed_at).toLocaleTimeString() : 'not yet available'}. Automatically refreshes while visible. Queue-wide counts reflect the selected currency; use Credit reporting for metrics matching all filters.</small></section>

    <div className="personal-operations-layout"><div className="personal-queue-main">

    <form className="personal-loan-filters" onSubmit={event => { event.preventDefault(); setLookup(draft.trim()); setPage(1); }}>

      <label>Find an application<div><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="Application ID, customer, account or loan number" /><button aria-label="Search"><FaSearch /></button></div></label>

      <label>Status<select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{['PENDING','SUCCESS','FAILED'].map(key => <option key={key}>{key}</option>)}</select></label>

      <label>{scope.date_basis === 'processed' ? 'Processed from' : 'Created from'}<input type="datetime-local" value={from} onChange={event => { setFrom(event.target.value); setPage(1); }} /></label>

      <label>{scope.date_basis === 'processed' ? 'Processed before' : 'Created before'}<input type="datetime-local" value={to} onChange={event => { setTo(event.target.value); setPage(1); }} /></label>

      {status === 'FAILED' && <label>Failure reason<select value={description === undefined ? '__all' : JSON.stringify(description)} onChange={event => { setDescription(event.target.value === '__all' ? undefined : JSON.parse(event.target.value)); setPage(1); }}><option value="__all">All reasons</option>{reasons.map(reason => <option key={reason.description} value={JSON.stringify(reason.description)}>{reason.description || 'No description'} ({reason.count})</option>)}</select></label>}

    </form>



    <PersonalLoanReporting scope={scope} onScope={value => { setScope(value); setPage(1); }} filters={{...filters(),status}} onPeriod={(start,end) => { setFrom(start); setTo(end); setPage(1); }} />

    <div className="personal-loan-records" aria-busy={loading}>{loading ? <p>Loading applications…</p> : records?.items.map(row => <article key={row.id}>

      {status === 'FAILED' && <input type="checkbox" aria-label={`Select application ${row.id}`} checked={selectedIds.includes(String(row.id))} onChange={event => setSelectedIds(ids => event.target.checked ? [...ids, String(row.id)] : ids.filter(id => id !== String(row.id)))} />}

      <button onClick={() => setSelected(row)}><span><strong>{row.account_number || 'Account unavailable'}</strong><small>{row.full_name ? `${row.full_name} · ` : ''}Application {row.id} · {row.bot_processed_LN || 'Loan number not supplied'}</small></span><span><strong>{row.currency || ''} {row.approved_amount || '—'}</strong><small>{row.overdraft_tenure}</small></span><span className={`personal-state state-${personalStatus(row).toLowerCase()}`}>{personalStatus(row)}</span><FaArrowRight /></button>

    </article>)}{!loading && !records?.items.length && <p>No applications match these filters.</p>}</div>

    <footer className="queue-recovery-controls"><button disabled={page === 1 || loading} onClick={() => setPage(value => value - 1)}>Previous</button><span>Page {page} of {records?.pages || 1} · {records?.total || 0} matching records</span><button disabled={page >= (records?.pages || 1) || loading} onClick={() => setPage(value => value + 1)}>Next</button></footer>

    </div><aside className="personal-operations-sidebar" aria-label="Queue operations">

    <section className="personal-recovery-card"><small>Recovery desk</small><h3>Review before requeue</h3><p>Resolve the failure cause, then review the exact applications to return to the bot.</p>    {status === 'FAILED' && <div className="queue-recovery-controls"><button disabled={busy || !selectedIds.length} onClick={() => void prepare(selectedIds)}>Review selected ({selectedIds.length})</button><button disabled={busy || loading || !records?.total} onClick={() => void prepare()}>Review all filtered failures</button></div>}{status !== 'FAILED' && <button onClick={() => { setStatus('FAILED'); setPage(1); }}>View failed applications</button>}</section>

    <details className="personal-loan-import"><summary>Recover a list of application IDs</summary><p>Paste up to 500 numeric IDs, or import a plain text/CSV file containing IDs only. Only failed applications in the two approved 48-month queues can enter review.</p><label>Application IDs<textarea value={importIds} onChange={event => setImportIds(event.target.value)} rows={4} placeholder="156713, 156714" /></label><input type="file" accept=".txt,.csv" aria-label="Import application IDs" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 50000) { setError('ID file must be smaller than 50 KB.'); return; } setImportIds(await file.text()); }} /><button disabled={busy} onClick={importReview}>Review imported IDs</button></details>

    {isAdmin && <section className="queue-custody-history"><button disabled={busy} onClick={() => custody ? setCustody(null) : void history(1)}><FaHistory /> {custody ? 'Collapse custody' : 'Browse custody history'}</button>{custody && <>{custody.recoveries.map(action => <article key={action.action_id}><strong>{action.state} · {action.updated_count} requeued</strong><p>{action.actor} · {new Date(action.created_at).toLocaleString()}</p><details><summary>{action.evidence.length} reviewed applications</summary>{action.evidence.map(row => <p key={row.id}>{row.id} · {row.bot_message || 'No description'}</p>)}<small>{action.action_id}</small></details></article>)}<div className="queue-recovery-controls"><button disabled={custodyPage === 1 || busy} onClick={() => void history(custodyPage - 1)}>Previous</button><span>Page {custodyPage}</span><button disabled={!custody.has_more || busy} onClick={() => void history(custodyPage + 1)}>Next</button></div></>}</section>}

    </aside></div>

    {selected && !preview && <div className="queue-review-backdrop personal-drawer-backdrop"><section ref={detailRef} tabIndex={-1} onKeyDown={event => {
      if (event.key === 'Escape') { event.stopPropagation(); setSelected(null); }
      if (event.key === 'Tab') {
        const buttons = Array.from(detailRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
        if (event.shiftKey && (document.activeElement === buttons[0] || document.activeElement === detailRef.current)) { event.preventDefault(); buttons[buttons.length-1]?.focus(); }
        if (!event.shiftKey && document.activeElement === buttons[buttons.length-1]) { event.preventDefault(); buttons[0]?.focus(); }
      }
    }} className="queue-review personal-record-drawer" role="dialog" aria-modal="true" aria-labelledby="personal-record-title"><header><button className="personal-drawer-close" aria-label="Close application" onClick={() => setSelected(null)}><FaTimes /></button><small>Personal loan application · {personalStatus(selected)}</small><h2 id="personal-record-title">Application {selected.id}</h2></header><dl>{Object.entries({Customer:selected.full_name,Branch:selected.branch_origin,Account:selected.account_number,'Applied amount':selected.amount_applied,Maturity:selected.maturity,'Next pay date':selected.next_pay_date,Tenure:selected.overdraft_tenure,Currency:selected.currency,'Approved amount':selected.approved_amount,'Loan number':selected.bot_processed_LN,'Failure description':selected.bot_message,Created:selected.created_at,Updated:selected.updated_at,Processed:selected.processed_datetime}).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Not supplied'}</dd></div>)}</dl><footer><button onClick={() => setSelected(null)}>Close</button>{personalStatus(selected) === 'FAILED' && <button disabled={busy} onClick={() => void prepare([String(selected.id)], true)}>Review requeue</button>}</footer></section></div>}

    {preview && <QueueRecoveryReview queue={queue} preview={preview} onClose={() => setPreview(null)} onComplete={count => { setPreview(null); setSelected(null); setSelectedIds([]); setCustody(null); setNotice(`${count} failed applications returned to Pending.`); void load(true); }} />}

  </section>;

};

export default PersonalLoanWorkspace;

