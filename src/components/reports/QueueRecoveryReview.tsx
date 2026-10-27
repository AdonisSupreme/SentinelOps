import React, { useEffect, useRef, useState } from 'react';
import reportsApi, { RecoveryPreview } from '../../services/reportsApi';
import './QueueRecovery.css';

export const recoveryError = (error: unknown) => {
  const detail = (error as {response?: {data?: {detail?: unknown}}}).response?.data?.detail;
  return typeof detail === 'string' ? detail : 'The request could not be completed. Refresh the queue and check custody before retrying.';
};

const QueueRecoveryReview: React.FC<{preview: RecoveryPreview; queue?: string; onClose: () => void; onComplete: (count: number) => void}> = ({preview, queue, onClose, onComplete}) => {
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  const execute = async () => {
    setBusy(true); setSubmitted(true);
    try { const result = await reportsApi.executeRecovery(preview.action_id, queue); onComplete(result.updated_count); }
    catch (failure) { setError(recoveryError(failure)); }
    finally { setBusy(false); }
  };
  return <div className={`queue-review-backdrop ${queue === 'personal-loans' ? 'personal-drawer-backdrop' : ''}`}><section ref={dialog} tabIndex={-1} className="queue-review" role="dialog" aria-modal="true" aria-labelledby="queue-review-title" onKeyDown={event => {
    if (event.key === 'Escape' && !busy) { event.stopPropagation(); onClose(); }
    if (event.key === 'Tab') {
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex="0"]') || []);
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }}>
    <header><span>Recovery review</span><h2 id="queue-review-title">Requeue {preview.count} failed record{preview.count === 1 ? '' : 's'}?</h2><p>Only these records will return to Pending. The bot may process them again. Confirm the failure cause has been addressed before continuing.</p></header>
    {preview.requested_count !== undefined && preview.requested_count !== preview.count && <p role="status">{preview.count} of {preview.requested_count} requested IDs are eligible. Missing, changed or out-of-scope records are excluded from this review.</p>}
    <div className="queue-review-evidence">{preview.items.map(row => <article key={row.id}><strong>{row.id} · {row.debit_account || row.account_number || 'Account unavailable'}</strong><span>{row.currency} {row.amount || row.approved_amount}</span><p>{row.description?.trim() || row.bot_message?.trim() || 'No failure description'}</p></article>)}</div>
    <small>Review expires after 10 minutes. Changed records require a new review. Reference: {preview.action_id}</small>
    {error && <p role="alert">{error}</p>}
    <footer><button disabled={busy} onClick={onClose}>{submitted ? 'Close review' : 'Cancel'}</button><button disabled={busy || submitted} onClick={() => void execute()}>{busy ? 'Submitting…' : 'Confirm requeue'}</button></footer>
  </section></div>;
};
export default QueueRecoveryReview;
