import React, { useEffect, useRef, useState } from 'react';
import { FaDownload, FaChartBar, FaFilter } from 'react-icons/fa';
import reportsApi, { PersonalLoanReport, PersonalLoanScope } from '../../services/reportsApi';
import { recoveryError } from './QueueRecoveryReview';

const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
const currencyOf = (tenure: string) => tenure.startsWith('USD ') ? 'USD' : 'ZWL';
const stateOf = (row: {status_id:number; is_processed:string}) => row.status_id === 18 && String(row.is_processed) === '1' ? 'Successful' : row.status_id === 18 && String(row.is_processed) === '2' ? 'Failed' : row.status_id === 31 && String(row.is_processed) === '0' ? 'Pending' : 'Other';
const money = (value: string | null) => value === null ? 'Not supplied' : Number(value).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});

export default function PersonalLoanReporting({scope,onScope,filters,onPeriod}: {
  scope: PersonalLoanScope; onScope: (scope:PersonalLoanScope) => void;
  filters: Record<string,unknown>; onPeriod:(start:string,end:string) => void;
}) {
  const [draft,setDraft] = useState(scope);
  const [report,setReport] = useState<PersonalLoanReport | null>(null);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const generation = useRef(0);
  const filterKey = JSON.stringify(filters);
  useEffect(() => { generation.current++; setReport(null); setError(''); setNotice(''); },[filterKey]);
  useEffect(() => { setDraft(scope); },[scope]);
  useEffect(() => () => { generation.current++; },[]);
  const inspect = async () => {
    const request = generation.current;
    setBusy(true); setError('');
    try { const result = await reportsApi.personalReport(filters); if (request === generation.current) setReport(result); }
    catch (failure) { if (request === generation.current) setError(recoveryError(failure)); }
    finally { setBusy(false); }
  };
  const download = async () => {
    const request = generation.current;
    setBusy(true); setError(''); setNotice('');
    try {
      const blob = await reportsApi.exportPersonalReport(filters);
      if (request !== generation.current) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url;
      link.download = `personal-loans-${filters.currency || 'both'}-${filters.status || 'all'}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Report downloaded for the applied filters, across all matching pages.');
    } catch (failure) { if (request === generation.current) setError(recoveryError(failure)); }
    finally { setBusy(false); }
  };
  const period = (kind: string) => {
    if (kind === 'all') { onPeriod('',''); return; }
    const start = new Date(); start.setHours(0,0,0,0);
    if (kind === 'week') start.setDate(start.getDate()-6);
    if (kind === 'month') start.setDate(1);
    const end = new Date(); end.setHours(0,0,0,0); end.setDate(end.getDate()+1);
    onPeriod(localInput(start),localInput(end));
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(scope);
  return <section className="personal-credit-reporting" aria-label="Credit reporting">
    <header><div><small><FaChartBar /> Credit reporting</small><h3>Scope, understand, export</h3><p>Reports use the applied queue filters, across all pages.</p></div><div className="personal-report-actions"><button disabled={busy || dirty} onClick={() => void inspect()}><FaChartBar /> Analyze scope</button><button disabled={busy || dirty} onClick={() => void download()}><FaDownload /> {busy ? 'Preparing…' : 'Download CSV'}</button></div></header>
    <details className="personal-report-scope"><summary><FaFilter /> Reporting boundaries {Object.values(scope).some(Boolean) ? '· Applied' : '· All eligible loans'}</summary>
      <form onSubmit={event => { event.preventDefault(); onScope(draft); }}>
        <label>Date basis<select value={draft.date_basis || 'created'} onChange={event => setDraft({...draft,date_basis:event.target.value})}><option value="created">Application created</option><option value="processed">Bot processed</option></select></label>
        <label>Branch (exact code)<input value={draft.branch || ''} onChange={event => setDraft({...draft,branch:event.target.value})} /></label>
        {([['maturity_after','Maturity after (exclusive)'],['maturity_to','Maturity through (inclusive)'],['pay_from','Next pay date from'],['pay_to','Next pay date through']] as const).map(([key,label]) => <label key={key}>{label}<input type="date" value={draft[key] || ''} onChange={event => setDraft({...draft,[key]:event.target.value || undefined})} /></label>)}
        <div className="personal-report-scope-actions"><button type="submit" disabled={!dirty}>Apply boundaries</button><button type="button" onClick={() => { setDraft({}); onScope({}); }}>Clear boundaries</button><button type="button" onClick={() => setDraft({...draft,maturity_after:'2029-12-31',pay_from:'2025-06-01',maturity_to:undefined,pay_to:undefined})}>Load legacy credit scope</button></div>
      </form>
      <p>The legacy preset selects maturity after 31 Dec 2029 and next pay date from 1 Jun 2025. Review and apply it explicitly. These are reporting boundaries, not lending limits. Missing dates do not match date boundaries.</p>
    </details>
    <div className="personal-report-periods" role="group" aria-label="Reporting period"><span>{scope.date_basis === 'processed' ? 'Processed' : 'Created'} period</span>{[['today','Today'],['week','Last 7 days'],['month','This month'],['all','All dates']].map(([key,label]) => <button key={key} onClick={() => period(key)}>{label}</button>)}</div>
    <p className="personal-report-caption">{String(filters.currency || 'USD + ZWL')} · {String(filters.status || 'All statuses')} · {scope.date_basis === 'processed' ? 'Processed' : 'Created'} {filters.created_from ? `from ${new Date(String(filters.created_from)).toLocaleString()}` : 'from earliest'} {filters.created_to ? `to before ${new Date(String(filters.created_to)).toLocaleString()}` : 'onward'}. Date shortcuts use your local calendar. CSV: up to 10,000 rows; recovery: up to 500 reviewed failures.</p>
    {Object.entries(scope).filter(([key,value]) => key !== 'date_basis' && value).length > 0 && <dl className="personal-report-boundaries">{Object.entries(scope).filter(([key,value]) => key !== 'date_basis' && value).map(([key,value]) => <div key={key}><dt>{({branch:'Branch',maturity_after:'Maturity after',maturity_to:'Maturity through',pay_from:'Next pay from',pay_to:'Next pay through'} as Record<string,string>)[key]}</dt><dd>{value}</dd></div>)}</dl>}
    {dirty && <p role="status">Boundary changes are not applied yet. Apply them before analyzing or downloading.</p>}
    {error && <p role="alert" className="reports-error">{error}</p>}{notice && <p role="status">{notice}</p>}
    {report && <div className="personal-report-results"><div className="personal-report-result-heading"><strong>Filtered evidence</strong><small>Snapshot {new Date(report.generated_at).toLocaleString()} · source calendar {report.timezone}</small></div>
      <p>Approved amounts describe applications; they are not proof of funds disbursed. Minimum and maximum below are observed amounts, not policy limits.</p>
      <div className="personal-report-table"><table><caption>Application totals by currency and state</caption><thead><tr><th>Currency / state</th><th>Applications</th><th>Approved total</th><th>Observed min–max</th></tr></thead><tbody>{report.groups.map(row => <tr key={`${row.overdraft_tenure}-${row.status_id}-${row.is_processed}`}><th>{currencyOf(row.overdraft_tenure)} · {stateOf(row)}</th><td>{row.total.toLocaleString()}<small>{row.total- row.amounts_known} without amount</small></td><td>{money(row.approved_total)}</td><td>{money(row.approved_min)} – {money(row.approved_max)}</td></tr>)}</tbody></table></div>
      {!report.groups.length && <p>No applications match the applied scope.</p>}
      <details><summary>Daily activity · latest 62 date/currency groups</summary><p>Counts use the selected date basis and each application's current state. They do not reconstruct past state transitions.</p><div className="personal-report-table"><table><thead><tr><th>Day / currency</th><th>Applications</th><th>Successful</th><th>Failed</th></tr></thead><tbody>{report.activity.map(row => <tr key={`${row.day}-${row.overdraft_tenure}`}><th>{row.day} · {currencyOf(row.overdraft_tenure)}</th><td>{row.total}</td><td>{row.successful}</td><td>{row.failed}</td></tr>)}</tbody></table></div></details>
    </div>}
  </section>;
}
