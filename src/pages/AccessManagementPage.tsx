import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FaShieldAlt, FaLayerGroup, FaUsers, FaSearch, FaPlus, FaCheck, FaTimes, FaSave, FaHistory, FaUserShield, FaExchangeAlt, FaChevronRight, FaSyncAlt } from 'react-icons/fa';
import api from '../services/api';
import { useAccess } from '../contexts/AccessContext';
import type { EffectiveAccess } from '../types/access';
import './AccessManagementPage.css';

interface Section { id: string; name: string; is_active: boolean }
interface Module extends Section { module_key: string; page_key: string }
interface Catalog { sections: Section[]; modules: Module[]; assignments: { section_id: string; module_id: string }[] }
interface AuditRow { action: string; timestamp: string; details: Record<string, unknown> }
type Perspective = 'section' | 'module';
const emptyCatalog: Catalog = { sections: [], modules: [], assignments: [] };
const errorMessage = (error: any) => typeof error.response?.data?.detail === 'string' ? error.response.data.detail : 'Something went wrong. Please retry.';

export const InheritedAccess: React.FC<{ sectionId?: string; role?: string }> = ({ sectionId, role }) => {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let mounted = true;
    api.get('/api/v1/admin/access').then(r => { if (mounted) setCatalog(r.data); }).catch(() => { if (mounted) setFailed(true); });
    return () => { mounted = false; };
  }, []);
  const modules = catalog?.modules.filter(m => m.is_active && (role?.toLowerCase() === 'admin' ||
    (catalog.sections.find(s => s.id === sectionId)?.is_active && catalog.assignments.some(a => a.section_id === sectionId && a.module_id === m.id))));
  return <div className="inherited-access"><strong><FaShieldAlt /> Inherited module access</strong>
    <p>{failed ? 'Preview unavailable. Saved section assignments still apply.' : catalog ? modules?.map(m => m.name).join(', ') || 'No modules assigned.' : 'Loading preview…'}</p></div>;
};

const AccessManagementPage = () => {
  const { refresh } = useAccess();
  const [catalog, setCatalog] = useState<Catalog>(emptyCatalog);
  const [loading, setLoading] = useState(true);
  const [perspective, setPerspective] = useState<Perspective>('section');
  const [view, setView] = useState<'assignments' | 'inspect' | 'audit'>('assignments');
  const [selected, setSelected] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [directorySearch, setDirectorySearch] = useState('');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [sectionName, setSectionName] = useState('');
  const [pending, setPending] = useState<{perspective: Perspective; id: string} | null>(null);
  const [statusTarget, setStatusTarget] = useState<Section | null>(null);
  const [users, setUsers] = useState<{id: string; username: string}[]>([]);
  const [userId, setUserId] = useState('');
  const [inspection, setInspection] = useState<EffectiveAccess | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const modalInput = useRef<HTMLInputElement>(null);
  const newSectionButton = useRef<HTMLButtonElement>(null);
  const load = useCallback(async () => {
    const { data } = await api.get<Catalog>('/api/v1/admin/access');
    setCatalog(data);
    return data;
  }, []);
  useEffect(() => { void load().catch(error => setNotice({text:errorMessage(error),error:true})).finally(() => setLoading(false)); }, [load]);
  useEffect(() => { if (creating) modalInput.current?.focus(); }, [creating]);
  useEffect(() => {
    if (view !== 'inspect') return;
    api.get('/api/v1/users').then(r => setUsers(r.data)).catch(error => setNotice({text:errorMessage(error),error:true}));
  }, [view]);

  const directory = perspective === 'section' ? catalog.sections : catalog.modules;
  useEffect(() => {
    if (!directory.some(item => item.id === selected)) setSelected(directory[0]?.id || '');
  }, [directory, selected]);
  const baseline = useMemo(() => catalog.assignments.filter(a => perspective === 'section' ? a.section_id === selected : a.module_id === selected)
    .map(a => perspective === 'section' ? a.module_id : a.section_id), [catalog.assignments, perspective, selected]);
  useEffect(() => setChecked(baseline), [baseline]);
  const changes = useMemo(() => new Set([...baseline, ...checked].filter(id => baseline.includes(id) !== checked.includes(id))).size, [baseline, checked]);
  const current = directory.find(item => item.id === selected);
  const shared = catalog.modules.filter(m => catalog.assignments.filter(a => a.module_id === m.id).length > 1).length;
  const groups = useMemo(() => {
    const result: Record<string, Section[]> = {};
    const items = perspective === 'section' ? catalog.modules : catalog.sections;
    items.filter(item => (item.name + ('page_key' in item ? ' ' + item.page_key : '')).toLowerCase().includes(search.toLowerCase())).forEach(item => {
      const group = 'page_key' in item ? String(item.page_key) : 'Organizational sections';
      (result[group] ||= []).push(item);
    });
    return Object.entries(result);
  }, [catalog, perspective, search]);
  const select = (next: Perspective, id: string) => {
    if (next === perspective && id === selected) return;
    if (changes) { setPending({perspective:next,id}); return; }
    setPerspective(next); setSelected(id); setSearch(''); setDirectorySearch(''); setNotice(null);
  };
  const run = async (action: () => Promise<unknown>, message = 'Access changes saved.') => {
    setBusy(true); setNotice(null);
    try { await action(); await load(); setNotice({text:message}); void refresh(); return true; }
    catch (error) { setNotice({text:errorMessage(error),error:true}); return false; }
    finally { setBusy(false); }
  };
  const save = () => run(() => api.put('/api/v1/admin/' + (perspective === 'section' ? 'sections/' : 'modules/') + selected + (perspective === 'section' ? '/modules' : '/sections'),
    perspective === 'section' ? {module_ids:checked} : {section_ids:checked}));
  const loadAudit = async () => {
    setAuditLoading(true);
    try { setAuditRows((await api.get('/api/v1/admin/access/audit')).data); }
    catch (error) { setNotice({text:errorMessage(error),error:true}); }
    finally { setAuditLoading(false); }
  };
  const closeCreate = () => { setCreating(false); setSectionName(''); newSectionButton.current?.focus(); };
  const moduleName = (key: string) => catalog.modules.find(m => m.module_key === key || m.id === key)?.name || key;
  const entityName = (value: unknown) => catalog.sections.find(s => s.id === value)?.name || catalog.modules.find(m => m.id === value)?.name || String(value || '');
  const modalKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) { closeCreate(); setPending(null); setStatusTarget(null); }
    if (event.key !== 'Tab') return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, [tabindex="0"]'));
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  };

  return <div className="sops-access">
    <header className="sops-access-command">
      <div className="sops-access-heading"><span className="sops-access-kicker"><FaShieldAlt /> System administration</span><h1>Section &amp; module access</h1><p>Give every team the right workspace.</p></div>
      <div className="sops-access-signals">
        <div><FaUsers /><span><small>Sections</small><strong>{loading ? '—' : catalog.sections.length}</strong><em>{catalog.sections.filter(s => s.is_active).length} active</em></span></div>
        <div><FaLayerGroup /><span><small>Modules</small><strong>{loading ? '—' : catalog.modules.length}</strong><em>Across SentinelOps</em></span></div>
        <div><FaExchangeAlt /><span><small>Shared modules</small><strong>{loading ? '—' : shared}</strong><em>Used by multiple teams</em></span></div>
      </div>
    </header>
    <div className="sops-access-navigation">
      <nav aria-label="Access management views">{[
        {id:'assignments' as const,label:'Assignments',icon:<FaLayerGroup />},
        {id:'inspect' as const,label:'Effective access',icon:<FaUserShield />},
        {id:'audit' as const,label:'Audit history',icon:<FaHistory />},
      ].map(tab => <button key={tab.id} aria-current={view === tab.id ? 'page' : undefined} onClick={() => {setView(tab.id);setNotice(null);if (tab.id === 'audit') void loadAudit();}}>{tab.icon}{tab.label}</button>)}</nav>
      <button ref={newSectionButton} className="sops-access-button primary" disabled={busy || changes > 0} title={changes ? 'Save or discard your assignments first' : undefined} onClick={() => setCreating(true)}><FaPlus /> New section</button>
    </div>
    {notice && <div className={'sops-access-notice ' + (notice.error ? 'error' : 'success')} role={notice.error ? 'alert' : 'status'}><span>{notice.error ? <FaTimes /> : <FaCheck />}{notice.text}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><FaTimes /></button></div>}

    {view === 'assignments' && <div className="sops-access-workspace">
      <aside className="sops-access-directory">
        <div className="sops-access-segments" aria-label="Manage by">
          <button aria-pressed={perspective === 'section'} disabled={busy} onClick={() => select('section',catalog.sections[0]?.id || '')}>Sections</button>
          <button aria-pressed={perspective === 'module'} disabled={busy} onClick={() => select('module',catalog.modules[0]?.id || '')}>Modules</button>
        </div>
        <label className="sops-access-search"><FaSearch /><input aria-label="Search directory" placeholder={'Find a ' + perspective + '…'} value={directorySearch} onChange={e => setDirectorySearch(e.target.value)} /></label>
        <div className="sops-access-directory-label"><span>{perspective === 'section' ? 'Organizational sections' : 'Workspace modules'}</span><span>{directory.length}</span></div>
        <div className="sops-access-directory-list" aria-label={perspective === 'section' ? 'Sections' : 'Modules'} aria-busy={loading}>
          {loading ? [0,1,2,3,4].map(i => <div className="sops-access-skeleton" key={i} />) : directory.filter(item => item.name.toLowerCase().includes(directorySearch.toLowerCase())).map(item => {
            const count = catalog.assignments.filter(a => perspective === 'section' ? a.section_id === item.id : a.module_id === item.id).length;
            return <button className={'sops-access-directory-item ' + (selected === item.id ? 'selected' : '')} aria-label={item.name} aria-pressed={selected === item.id} key={item.id} disabled={busy} onClick={() => select(perspective,item.id)}>
              <span className="sops-access-directory-icon">{perspective === 'section' ? <FaUsers /> : <FaLayerGroup />}</span>
              <span><strong>{item.name}</strong><small>{count} {perspective === 'section' ? 'modules' : 'sections'}{!item.is_active && ' · Inactive'}</small></span><FaChevronRight />
            </button>;
          })}
          {!loading && !directory.length && <div className="sops-access-empty"><FaUsers /><p>Create a section to start assigning workspaces.</p></div>}
          {!loading && directory.length > 0 && !directory.some(item => item.name.toLowerCase().includes(directorySearch.toLowerCase())) && <p className="sops-access-muted">No matches. Try another name.</p>}
        </div>
        <div className="sops-access-directory-note"><FaShieldAlt /><p>Sections determine workspace access. Roles determine the actions available inside.</p></div>
      </aside>

      <section className="sops-access-editor" aria-busy={loading}>
        {loading ? <div className="sops-access-editor-loading">{[0,1,2,3,4,5].map(i => <div className="sops-access-skeleton" key={i} />)}</div> : current ? <>
          <div className="sops-access-editor-head"><div><span className="sops-access-kicker">{perspective === 'section' ? 'Section assignments' : 'Shared ownership'}</span><h2>{current.name}</h2><p>{perspective === 'section' ? 'Choose the modules this team can open.' : 'Choose the sections that can use this module.'}</p></div>
            <div className="sops-access-editor-status"><span className={'sops-access-badge ' + (current.is_active ? 'active' : '')}>{current.is_active ? 'Active' : 'Inactive'}</span><button className="sops-access-text-button" disabled={busy || changes > 0} onClick={() => setStatusTarget(current)}>{current.is_active ? 'Deactivate' : 'Activate'}</button></div>
          </div>
          {!current.is_active && <div className="sops-access-inline-note">These assignments are retained but do not grant access while this {perspective} is inactive.</div>}
          <div className="sops-access-editor-toolbar"><label className="sops-access-search"><FaSearch /><input aria-label="Filter assignments" placeholder={perspective === 'section' ? 'Search modules or workspaces…' : 'Search sections…'} value={search} onChange={e => setSearch(e.target.value)} /></label><span>{checked.length} assigned</span></div>
          <div className="sops-access-groups">
            {groups.map(([name,items]) => <fieldset key={name} disabled={busy}><legend>{name} <span>{items.filter(i => checked.includes(i.id)).length}/{items.length}</span></legend>
              <div className="sops-access-group-tools"><button onClick={() => setChecked(v => Array.from(new Set([...v,...items.map(i => i.id)])))}>Select all shown</button><span>·</span><button onClick={() => setChecked(v => v.filter(id => !items.some(i => i.id === id)))}>Clear all shown</button></div>
              <div className="sops-access-options">{items.map(item => <label className={'sops-access-option ' + (checked.includes(item.id) ? 'assigned' : '')} key={item.id}>
                <input type="checkbox" checked={checked.includes(item.id)} onChange={() => setChecked(v => v.includes(item.id) ? v.filter(id => id !== item.id) : [...v,item.id])} />
                <span><strong>{item.name}</strong><small>{!item.is_active ? 'Inactive · access paused' : perspective === 'section' ? 'Workspace access' : 'Section membership'}</small></span>
                {checked.includes(item.id) && <FaCheck aria-hidden="true" />}
              </label>)}</div>
            </fieldset>)}
            {!groups.length && <div className="sops-access-empty"><FaSearch /><h3>No matching assignments</h3><p>Try a different search.</p><button className="sops-access-text-button" onClick={() => setSearch('')}>Clear filter</button></div>}
          </div>
          <footer className="sops-access-savebar"><span className={changes ? 'pending' : ''}>{changes ? <><span className="sops-access-dot" />{changes} unsaved {changes === 1 ? 'change' : 'changes'}</> : <><FaCheck /> All changes saved</>}</span><div>
            {changes > 0 && <button className="sops-access-button" disabled={busy} onClick={() => setChecked(baseline)}>Discard</button>}
            <button className="sops-access-button primary" disabled={busy || !changes} onClick={() => void save()}><FaSave />{busy ? 'Saving…' : 'Save assignments'}</button></div></footer>
        </> : <div className="sops-access-empty"><FaLayerGroup /><h2>Ready for your first team</h2><p>Create a section, then assign its workspaces here.</p></div>}
      </section>
    </div>}

    {view === 'inspect' && <section className="sops-access-panel">
      <div className="sops-access-panel-heading"><span className="sops-access-kicker"><FaUserShield /> Permission preview</span><h2>See what an operator can access</h2><p>A read-only view of their section's modules and current role.</p></div>
      <div className="sops-access-inspect-form"><label>User<select value={userId} disabled={inspecting} onChange={e => {setUserId(e.target.value);setInspection(null);}}><option value="">Select an operator…</option>{users.map(u => <option value={u.id} key={u.id}>{u.username}</option>)}</select></label>
        <button className="sops-access-button primary" disabled={!userId || inspecting} onClick={async () => {setInspecting(true);try {setInspection((await api.get('/api/v1/admin/users/' + userId + '/access')).data);}catch(error){setNotice({text:errorMessage(error),error:true});}finally{setInspecting(false);}}}>{inspecting ? 'Inspecting…' : 'Inspect access'}</button></div>
      {inspection ? <div className="sops-access-inspection"><div><span className="sops-access-badge active">{inspection.role}</span><strong>{inspection.section?.name || 'No section assigned'}</strong><span>{inspection.modules.length} modules available</span></div>
        <div className="sops-access-permission-list">{inspection.modules.map(key => <span key={key}><FaCheck />{moduleName(key)}</span>)}</div>
        {!inspection.modules.length && <p>No business modules are assigned to this user.</p>}</div>
        : <div className="sops-access-empty"><FaUserShield /><p>Select an operator to preview their effective access.</p></div>}
    </section>}

    {view === 'audit' && <section className="sops-access-panel">
      <div className="sops-access-panel-heading audit"><div><span className="sops-access-kicker"><FaHistory /> Access audit</span><h2>Recent access changes</h2><p>The latest 100 changes, including who made them.</p></div><button className="sops-access-button" disabled={auditLoading} onClick={() => void loadAudit()}><FaSyncAlt /> Refresh</button></div>
      {auditLoading ? <div className="sops-access-editor-loading">{[0,1,2].map(i => <div className="sops-access-skeleton" key={i} />)}</div> : <ol className="sops-access-audit">{auditRows.map((row,index) => <li key={index}><span className="sops-access-audit-icon"><FaShieldAlt /></span><div><strong>{row.action.toLowerCase().replaceAll('_',' ')}</strong><p>{entityName(row.details.section)}{row.details.module ? ' · ' + entityName(row.details.module) : ''}</p><small>{String(row.details.actor_username || row.details.actor || 'System')}</small><details><summary>Change details</summary><dl><dt>Previous</dt><dd>{typeof row.details.old_value === 'boolean' ? String(row.details.old_value) : entityName(row.details.old_value) || 'None'}</dd><dt>Updated</dt><dd>{typeof row.details.new_value === 'boolean' ? String(row.details.new_value) : entityName(row.details.new_value) || 'None'}</dd>{!!row.details.target_user && <><dt>Operator</dt><dd>{String(row.details.target_user)}</dd></>}</dl></details></div><time dateTime={row.timestamp}>{new Date(row.timestamp).toLocaleString()}</time></li>)}</ol>}
      {!auditLoading && !auditRows.length && <div className="sops-access-empty"><FaHistory /><p>No access changes to show.</p></div>}
    </section>}

    {(creating || pending || statusTarget) && <div className="sops-access-modal-backdrop"><div className="sops-access-modal" role="dialog" aria-modal="true" aria-labelledby="access-dialog-title" onKeyDown={modalKeys}>
      {creating ? <form onSubmit={async e => {e.preventDefault();const success = await run(() => api.post('/api/v1/admin/sections',{name:sectionName.trim()}),'Section created. Choose its workspace assignments.');if(success) closeCreate();}}>
        <span className="sops-access-kicker"><FaPlus /> Organization</span><h2 id="access-dialog-title">Create a section</h2><p>New sections start with no assigned modules.</p><label>Section name<input ref={modalInput} required maxLength={150} placeholder="e.g. ICT Operations" value={sectionName} onChange={e => setSectionName(e.target.value)} /></label>
        <div className="sops-access-modal-actions"><button className="sops-access-button" type="button" disabled={busy} onClick={closeCreate}>Cancel</button><button className="sops-access-button primary" disabled={busy || !sectionName.trim()}>{busy ? 'Creating…' : 'Create section'}</button></div></form>
        : pending ? <><h2 id="access-dialog-title">Keep your changes?</h2><p>You have unsaved assignments. Save or discard them before switching.</p><div className="sops-access-modal-actions"><button autoFocus className="sops-access-button" onClick={() => setPending(null)}>Keep editing</button><button className="sops-access-button" onClick={() => {setChecked([]);setPerspective(pending.perspective);setSelected(pending.id);setSearch('');setDirectorySearch('');setPending(null);}}>Discard &amp; switch</button></div></>
        : statusTarget && <><h2 id="access-dialog-title">{statusTarget.is_active ? 'Deactivate' : 'Activate'} {statusTarget.name}?</h2><p>{statusTarget.is_active ? 'Access will pause immediately. Existing assignments will be retained.' : 'Saved assignments will become effective again.'}</p><div className="sops-access-modal-actions"><button autoFocus className="sops-access-button" disabled={busy} onClick={() => setStatusTarget(null)}>Cancel</button><button className={'sops-access-button ' + (statusTarget.is_active ? 'danger' : 'primary')} disabled={busy} onClick={async () => {const success=await run(() => api.patch('/api/v1/admin/' + (perspective === 'section' ? 'sections/' : 'modules/') + selected,perspective === 'section' ? {name:statusTarget.name,is_active:!statusTarget.is_active} : {is_active:!statusTarget.is_active}));if(success)setStatusTarget(null);}}>{statusTarget.is_active ? 'Deactivate' : 'Activate'}</button></div></>}
      {notice?.error && <p role="alert" className="sops-access-modal-error">{notice.text}</p>}
    </div></div>}
  </div>;
};
export default AccessManagementPage;

