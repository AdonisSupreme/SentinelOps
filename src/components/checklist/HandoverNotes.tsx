import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaPlus, FaCheck, FaFlag, FaClock, FaArrowRight, FaSyncAlt } from 'react-icons/fa';
import api from '../../services/api';

interface HandoverNote {
  id: string; content: string; priority: number; created_at: string;
  from_shift?: string; to_shift?: string;
  created_by_username?: string; created_by_first_name?: string; created_by_last_name?: string;
  acknowledged_at?: string; acknowledged_by_username?: string;
  resolved_at?: string; resolved_by_username?: string; resolution_notes?: string;
  direction: 'incoming' | 'outgoing';
}
interface Props { instanceId: string; onShowModal: () => void; refreshKey?: number; }
const priorityLabel = ['Unknown', 'Low', 'Medium', 'High', 'Critical'];
const displayDate = (value: string) => new Date(value).toLocaleString([], { day:'numeric',month:'short',hour:'2-digit',minute:'2-digit' });

export default function HandoverNotes({ instanceId, onShowModal, refreshKey = 0 }: Props) {
  const [notes, setNotes] = useState<HandoverNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pending, setPending] = useState<string | null>(null);
  const [direction, setDirection] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const request = useRef(0);
  const load = useCallback(async () => {
    const revision = ++request.current;
    setLoading(true); setError('');
    try {
      const response = await api.get(`/api/v1/checklists/instances/${instanceId}/handover-notes`);
      if (revision === request.current) setNotes(response.data.handover_notes || []);
    } catch {
      if (revision === request.current) setError('Handover notes could not be loaded. Try refreshing.');
    } finally {
      if (revision === request.current) setLoading(false);
    }
  }, [instanceId]);
  useEffect(() => { setNotes([]); setDirection('all'); void load(); return () => { request.current++; }; }, [load, refreshKey]);
  const acknowledge = async (id: string) => {
    setPending(id); setError('');
    try { await api.post(`/api/v1/checklists/handover-notes/${id}/acknowledge`); await load(); }
    catch { setError('The note was not acknowledged. Please try again.'); }
    finally { setPending(null); }
  };
  const visible = notes.filter(note => direction === 'all' || note.direction === direction);
  const awaiting = notes.filter(note => note.direction === 'incoming' && !note.acknowledged_at).length;
  return <div className="handover-notes handover-stream">
    <div className="handover-stream-tools"><button type="button" onClick={onShowModal}><FaPlus/> Add note</button><button type="button" aria-label="Refresh handover notes" title="Refresh handover notes" disabled={loading || !!pending} onClick={() => void load()}><FaSyncAlt/></button></div>
    <p className="handover-stream-summary">{awaiting ? `${awaiting} incoming ${awaiting === 1 ? 'note needs' : 'notes need'} acknowledgement` : 'Keep the next shift informed.'}</p>
    {notes.length > 0 && <div className="handover-stream-filters" aria-label="Handover direction">{(['all','incoming','outgoing'] as const).map(value => <button type="button" key={value} aria-pressed={direction===value} onClick={() => setDirection(value)}>{value === 'all' ? 'All notes' : value === 'incoming' ? 'Incoming' : 'Outgoing'}<span>{value === 'all' ? notes.length : notes.filter(note => note.direction===value).length}</span></button>)}</div>}
    {error && <p className="handover-stream-error" role="alert">{error}</p>}
    {loading && <p className="handover-stream-loading" role="status">Refreshing handover notes…</p>}
    {!loading && !error && !visible.length && <div className="handover-stream-empty"><FaFlag aria-hidden="true"/><strong>{notes.length ? `No ${direction} notes` : 'A clear handover starts here'}</strong><p>{notes.length ? 'Choose another direction to see the remaining notes.' : 'Add the context, owner, and next step that the following shift needs.'}</p></div>}
    <div className="handover-stream-list" aria-busy={loading}>
      {visible.map(note => <article className="handover-stream-card" key={note.id}>
        <header><span className={`handover-priority level-${note.priority}`}><FaFlag/>{priorityLabel[note.priority] || 'Unknown'}</span><span>{note.direction === 'incoming' ? 'Incoming' : 'Outgoing'}</span></header>
        <div className="handover-route"><span>{note.from_shift || 'Previous shift'}</span><FaArrowRight aria-hidden="true"/><span>{note.to_shift || 'Next shift'}</span></div>
        <p className="handover-message">{note.content}</p>
        <div className="handover-authorship"><strong>{[note.created_by_first_name,note.created_by_last_name].filter(Boolean).join(' ') || note.created_by_username || 'Unknown author'}</strong><time dateTime={note.created_at} title={new Date(note.created_at).toLocaleString()}><FaClock/>{displayDate(note.created_at)}</time></div>
        <footer>
          {note.direction === 'incoming' && !note.acknowledged_at && <button type="button" disabled={!!pending} onClick={() => void acknowledge(note.id)}><FaCheck/>{pending === note.id ? 'Acknowledging…' : 'Acknowledge'}</button>}
          {note.acknowledged_at && <div className="handover-receipt"><FaCheck/><span>Acknowledged by {note.acknowledged_by_username || 'Someone'}<time dateTime={note.acknowledged_at}>{displayDate(note.acknowledged_at)}</time></span></div>}
          {note.resolved_at && <div className="handover-receipt"><FaCheck/><span>Resolved by {note.resolved_by_username || 'Someone'}<time dateTime={note.resolved_at}>{displayDate(note.resolved_at)}</time>{note.resolution_notes && <p>{note.resolution_notes}</p>}</span></div>}
        </footer>
      </article>)}
    </div>
  </div>;
}
