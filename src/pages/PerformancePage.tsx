import React, { useEffect, useState } from 'react';
import { FaChartLine, FaCheckCircle, FaClock, FaCloudSun, FaCrown, FaFire, FaLink, FaMedal, FaMoon, FaShieldAlt, FaStar, FaSun, FaSyncAlt, FaUsers, FaBolt, FaArrowRight } from 'react-icons/fa';
import PageGuide from '../components/ui/PageGuide';
import { pageGuides } from '../content/pageGuides';
import { useNotifications } from '../contexts/NotificationContext';
import { performanceApi, PerformanceBadge, PerformanceCommandResponse, PerformanceWindowKey } from '../services/performanceApi';
import './PerformancePage.css';

const windows: PerformanceWindowKey[] = ['weekly', 'monthly', 'quarterly', 'yearly'];
const labels = { weekly: 'This week', monthly: 'This month', quarterly: 'This quarter', yearly: 'This year' };
const icons: Record<string, React.ReactNode> = { flow: <FaChartLine />, shield: <FaShieldAlt />, bolt: <FaBolt />, relay: <FaLink />, orbit: <FaFire />, moon: <FaMoon />, sunrise: <FaSun />, sun: <FaCloudSun />, allies: <FaUsers />, clock: <FaClock />, crown: <FaCrown /> };
const number = (n: number) => new Intl.NumberFormat().format(n || 0);
const shortDate = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function Award({ levels, claiming, onClaim }: { levels: PerformanceBadge[]; claiming: string | null; onClaim: (key: string) => void }) {
  const next = levels.find(b => !b.claimed) || levels[levels.length - 1];
  const [selected, setSelected] = useState<string | null>(null);
  const badge = levels.find(b => b.key === selected) || next;
  const claimed = levels.filter(b => b.claimed).length;
  return <article className={`pi-award ${badge.claimable ? 'pi-award-ready' : ''}`}>
    <div className="pi-award-heading"><span className={`pi-emblem pi-${badge.theme}`}>{icons[badge.icon] || <FaStar />}</span><div><h3>{badge.family_name || badge.name}</h3><span>{claimed ? `${claimed} level${claimed === 1 ? '' : 's'} collected` : 'Your next achievement'}</span></div></div>
    <div className="pi-levels" aria-label={`${badge.family_name || badge.name} levels`}>
      {levels.map(b => <button key={b.key} type="button" aria-pressed={b.key === badge.key} onClick={() => setSelected(b.key)}>{b.claimed && <FaCheckCircle />} {b.level_name || 'Amateur'}</button>)}
    </div>
    <p>{badge.description}</p>
    <div className="pi-progress-heading"><strong>{badge.level_name || 'Milestone'}</strong><span>{badge.claimed ? 'Collected' : badge.claimable ? 'Ready to collect' : `${Math.floor(badge.progress)}%`}</span></div>
    <progress max={100} value={badge.progress} aria-label={`${badge.name} progress`} />
    <ul className="pi-requirements">{badge.requirements?.length ? badge.requirements.map(r => <li key={r.label}><span>{r.met ? <FaCheckCircle /> : <span className="pi-dot" />}{r.label}</span><strong>{number(r.current)} / {number(r.target)}</strong></li>) : <li>{badge.target}</li>}</ul>
    {badge.claimable ? <button className="pi-primary" disabled={claiming !== null} onClick={() => onClaim(badge.key)}><FaMedal /> {claiming === badge.key ? 'Collecting…' : `Collect ${badge.level_name || 'award'}`}</button> : <div className="pi-award-note">{badge.claimed ? 'Saved to your collection. Your achievement stays yours.' : badge.earned ? 'Collect the preceding level to continue.' : 'Progress uses this year’s recorded work.'}</div>}
  </article>;
}

export default function PerformancePage() {
  const { addNotification } = useNotifications();
  const [window, setWindow] = useState<PerformanceWindowKey>('monthly');
  const [data, setData] = useState<PerformanceCommandResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, refresh] = useState(0);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [view, setView] = useState<'overview' | 'awards' | 'evidence'>(() => globalThis.location?.hash === '#badge-forge' ? 'awards' : 'overview');
  const [awardFilter, setAwardFilter] = useState<'all' | 'ready' | 'collected'>('all');
  useEffect(() => {
    const openAwardLink = () => { if (globalThis.location.hash === '#badge-forge') setView('awards'); };
    globalThis.addEventListener('hashchange', openAwardLink);
    return () => globalThis.removeEventListener('hashchange', openAwardLink);
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    performanceApi.getPerformanceCommand(window).then(result => { if (!cancelled) setData(result); })
      .catch(() => { if (!cancelled) setError('Performance could not be refreshed. Please try again.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [window, revision]);
  async function claim(key: string) {
    if (claiming) return;
    setClaiming(key);
    try {
      const result = await performanceApi.claimPerformanceBadge(key);
      setData(current => current ? { ...current, badges: current.badges.map(b => b.key === key ? result.badge : b), profile: { ...current.profile, badge_count: result.claimed_badge_count } } : current);
      addNotification({ type: 'success', title: 'Achievement collected', message: `${result.badge.name} is saved to your collection.`, priority: 'medium' });
      refresh(n => n + 1);
    } catch {
      addNotification({ type: 'error', title: 'Collection not completed', message: 'Your award has not been confirmed. Refresh and try again.', priority: 'medium' });
    } finally { setClaiming(null); }
  }
  if (!data) return <div className="performance-intelligence"><header className="pi-hero"><span className="pi-kicker">Performance intelligence</span><h1>Your work. Recognized.</h1><p>Loading your contribution record.</p></header>{error ? <div role="alert" className="pi-panel"><p>{error}</p><button onClick={() => refresh(n => n + 1)}>Try again</button></div> : <div className="pi-stat-grid" aria-label="Loading performance" aria-busy="true">{[1,2,3,4].map(n => <div key={n} className="pi-skeleton" />)}</div>}</div>;
  const snapshot = data.windows[window];
  const evidence = snapshot.evidence;
  const grade = evidence?.sample_size ? snapshot.operational_grade : null;
  const families: Record<string, PerformanceBadge[]> = {};
  data.badges.forEach(b => { const key = b.family_key || b.key; (families[key] ||= []).push(b); });
  const groups = Object.values(families).map(group => group.sort((a,b) => (a.level || 1) - (b.level || 1)));
  const ready = data.badges.filter(b => b.claimable).length;
  const next = data.badges.filter(b => !b.earned).sort((a,b) => b.progress - a.progress)[0];
  const metrics = [
    { name: 'On-time tasks', value: snapshot.task_on_time_rate, sample: evidence?.deadline_tasks, detail: 'Completed tasks with a deadline' },
    { name: 'Run quality', value: snapshot.checklist_quality_rate, sample: evidence?.closed_runs, detail: 'Closed runs you contributed to' },
    { name: 'Shift participation', value: snapshot.shift_adherence_rate, sample: evidence?.elapsed_shifts, detail: 'Elapsed scheduled shifts' },
    { name: 'Timed starts', value: evidence?.timed_start_rate || 0, sample: evidence?.timed_starts, detail: 'Recorded starts against a schedule' },
  ];
  const maxPoints = Math.max(1, ...data.trend.map(t => t.command_points));
  return <div className="performance-intelligence" aria-busy={loading}>
    <header className="pi-hero"><div><span className="pi-kicker"><FaChartLine /> Performance intelligence</span><h1>Your work. Recognized.</h1><p>See your contribution, understand your progress, and build your next achievement.</p><div className="pi-context"><span>{data.profile.display_name}</span><span>{data.scope_label}</span><span>Updated {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div></div><button className="pi-refresh" aria-label="Refresh performance" disabled={loading} onClick={() => refresh(n => n + 1)}><FaSyncAlt className={loading ? 'pi-spin' : ''} />{loading ? 'Updating' : 'Refresh'}</button></header>
    <div className="pi-toolbar"><nav className="pi-tabs" aria-label="Performance views">{(['overview','awards','evidence'] as const).map(tab => <button key={tab} aria-pressed={view === tab} onClick={() => setView(tab)}>{tab === 'overview' ? 'Overview' : tab === 'awards' ? `Achievements${ready ? ` · ${ready} ready` : ''}` : 'Evidence & scoring'}</button>)}</nav><div className="pi-periods" aria-label="Performance period">{windows.map(w => <button key={w} aria-pressed={window === w} onClick={() => setWindow(w)}>{labels[w]}</button>)}</div></div>
    {error && <div className="pi-alert" role="alert">{error} Your previous record remains visible. <button onClick={() => refresh(n => n + 1)}>Retry</button></div>}
    {loading && <div role="status" className="pi-updating">Refreshing evidence…</div>}
    {view === 'overview' && <>
      <section className="pi-stat-grid" aria-label="Your performance summary">
        <article className="pi-stat pi-featured"><span>Contribution points</span><strong>{number(snapshot.command_points)}</strong><small>{shortDate(snapshot.start_date)} – {shortDate(snapshot.end_date)} · {snapshot.tier}</small></article>
        <article className="pi-stat"><span>Reliability grade</span><strong>{grade === null ? '—' : grade}<small>{grade !== null && '/100'}</small></strong><small>{grade === null ? 'Waiting for measurable outcomes' : `${evidence?.sample_size} observations · ${evidence?.status === 'established' ? 'established sample' : 'limited sample'}`}</small></article>
        <article className="pi-stat"><span>Days with contribution</span><strong>{snapshot.contribution_days}</strong><small>Completed work or handover activity</small></article>
        <article className="pi-stat"><span>Achievement collection</span><strong>{data.profile.badge_count}<small> levels</small></strong><button className="pi-text-button" onClick={() => setView('awards')}>{ready ? `${ready} ready to collect` : 'Explore your next level'} <FaArrowRight /></button></article>
      </section>
      <div className="pi-two-column"><section className="pi-panel"><div className="pi-section-head"><div><span className="pi-kicker">Your operating record</span><h2>Quality behind the numbers</h2></div><span className="pi-chip">{labels[window]}</span></div><p className="pi-summary">{snapshot.summary}</p><div className="pi-metric-grid">{metrics.map(m => <article key={m.name}><div><span>{m.name}</span><strong>{m.sample ? `${Math.round(m.value)}%` : '—'}</strong></div><progress max={100} value={m.sample ? m.value : 0} aria-label={m.name} /><small>{m.sample ? `${m.sample} observations` : 'No eligible evidence'} · {m.detail}</small></article>)}</div><div className="pi-work-totals"><span><b>{snapshot.items_completed}</b> checklist actions</span><span><b>{snapshot.tasks_completed}</b> tasks completed</span><span><b>{snapshot.handovers_resolved}</b> handovers resolved</span></div></section>
      <aside className="pi-panel pi-next"><span className="pi-kicker"><FaMedal /> Your next milestone</span><h2>{ready ? 'Your work has earned recognition.' : next?.name || 'Your collection is complete.'}</h2><p>{ready ? 'Collect the levels you have unlocked, then see what comes next.' : next?.target || 'Keep contributing. Collected awards remain yours.'}</p>{next && !ready && <progress max={100} value={next.progress} aria-label="Next milestone progress" />}<button className="pi-primary" onClick={() => setView('awards')}>Explore achievements <FaArrowRight /></button><div className="pi-queue"><FaClock /><div><strong>{snapshot.overdue_open_tasks} tasks currently overdue</strong><p>Current queue context. It does not erase points earned in earlier work.</p></div></div></aside></div>
      <div className="pi-two-column"><section className="pi-panel"><span className="pi-kicker">Contribution over time</span><h2>Your momentum</h2><span className="pi-chip">{labels[data.focus_window]}</span><div className="pi-trend">{data.trend.map(t => <div key={t.period_start} className="pi-trend-column"><strong>{number(t.command_points)}</strong><div className="pi-bar-track"><div style={{ height: `${t.command_points / maxPoints * 100}%` }} /></div><span>{t.label}</span><small>{t.tasks_completed} tasks · {t.checklist_items_completed} checks</small></div>)}</div><p className="pi-footnote">Partial periods contain fewer working days. Compare the work behind each total.</p></section>
      <section className="pi-panel"><span className="pi-kicker"><FaUsers /> Shared contribution</span><h2>Your visible team</h2><p className="pi-footnote">Ranked by contribution volume, not a staff appraisal. Workloads and shift opportunities differ. Equal results share a rank.</p><div className="pi-leaderboard">{data.leaderboard.length ? data.leaderboard.map(person => <div key={person.user_id} className={person.is_current_user ? 'is-you' : ''}><span className="pi-rank">{person.rank || '—'}</span><div><strong>{person.display_name}{person.is_current_user ? ' · You' : ''}</strong><small>{person.tasks_completed} tasks · {person.clean_checklists} clean runs</small></div><b>{number(person.command_points)}<small> points</small></b></div>) : <p>Completed contributions will appear here.</p>}</div></section></div>
    </>}
    {view === 'awards' && <section id="badge-forge"><div className="pi-section-head pi-award-intro"><div><span className="pi-kicker">Achievement collection</span><h2>Small milestones. Lasting recognition.</h2><p>Amateur → Skilled → Expert. Earn each level from this calendar year’s evidence; previously collected levels never expire.</p></div><div className="pi-periods">{(['all','ready','collected'] as const).map(f => <button key={f} aria-pressed={awardFilter === f} onClick={() => setAwardFilter(f)}>{f === 'all' ? 'All awards' : f === 'ready' ? 'Ready' : 'Collected'}</button>)}</div></div><div className="pi-award-grid">{groups.filter(g => awardFilter === 'all' || g.some(b => awardFilter === 'ready' ? b.claimable : b.claimed)).map(g => <Award key={g[0].family_key || g[0].key} levels={g} claiming={claiming} onClaim={claim} />)}</div>{!groups.some(g => awardFilter === 'all' || g.some(b => awardFilter === 'ready' ? b.claimable : b.claimed)) && <div className="pi-panel pi-empty">No awards in this view yet. Explore All awards to see the next achievable step.</div>}</section>}
    {view === 'evidence' && <><section className="pi-panel"><span className="pi-kicker">Transparent scoring</span><h2>Know what counts</h2><p>Points describe recorded contribution. The reliability grade uses only measurable outcomes; missing evidence is shown as a dash, not a failure.</p><div className="pi-breakdown">{Object.entries(snapshot.breakdown).map(([key,value]) => <article key={key}><span>{key.replace('_points','')}</span><strong>{number(value)}</strong></article>)}</div><div className="pi-method-grid"><article><h3>Execution</h3><p>Completed checklist items, subitems and tasks earn weighted points. Higher severity and required work carry more weight. A reopened record is not counted as another completion.</p></article><article><h3>Reliability</h3><p>On-time completion, clean contributed runs and measured timed starts add credit. A task without a deadline receives completion credit, but no on-time bonus.</p></article><article><h3>Collaboration</h3><p>Shared completed work and handover actions add credit. Joining a run or having a scheduled shift alone does not create a contribution day.</p></article><article><h3>Quality and fairness</h3><p>Critical work adds weight. Recorded late tasks and starts receive one deduction each. There is no extra repeat-lateness penalty or current-backlog deduction.</p></article></div><details className="pi-method-detail"><summary>Grade weights, evidence limits and awards</summary><p>Task timeliness: 28 parts; contributed-run quality: 27; elapsed-shift participation: 12; timed starts: 18. Only available measures are included, and weights are normalized. Run quality is 65% clean completion and 35% on-time closure. Fewer than ten task, run or timed-start observations is a limited sample.</p><p>Run quality is a shared outcome, not proof that one person caused an exception. Calendar-day consistency and streaks do not affect the grade or points. Awards use explicit requirements: every requirement must be met. These records support a conversation; they do not capture all work or replace manager judgment.</p><p>Checklist work is grouped by its operational shift date. Tasks and handovers use the configured business time zone. Award progress is year to date; existing unlocked and collected levels are preserved.</p></details></section><section className="pi-panel"><span className="pi-kicker">Recorded activity</span><h2>Recent contributions</h2><p className="pi-footnote">Event points below are base credits. Window totals also include reliability, collaboration and quality adjustments.</p><div className="pi-activity">{data.recent_events.length ? data.recent_events.map(e => <article key={e.id}><span className="pi-event-points">+{e.points}</span><div><h3>{e.title}</h3><p>{e.detail}</p></div><time dateTime={e.occurred_at}>{shortDate(e.occurred_at)}</time></article>) : <p>No recorded activity in this period yet.</p>}</div></section></>}
    <PageGuide guide={pageGuides.performance} />
  </div>;
}
