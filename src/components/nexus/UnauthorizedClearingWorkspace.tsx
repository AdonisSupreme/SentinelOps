import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FaArchive,
  FaBalanceScale,
  FaBan,
  FaBook,
  FaCheck,
  FaCheckCircle,
  FaChevronDown,
  FaChevronRight,
  FaDatabase,
  FaDownload,
  FaExclamationTriangle,
  FaFileImport,
  FaFingerprint,
  FaHistory,
  FaLock,
  FaSearch,
  FaShieldAlt,
  FaSyncAlt,
  FaTimes,
  FaTrash,
  FaUndo,
  FaUserCheck,
} from 'react-icons/fa';
import { useNotifications } from '../../contexts/NotificationContext';
import { FUNDS_CUSTODY_MANUAL_PDF_PATH } from '../../content/pageGuides';
import clearingApi, {
  ClearingAccountView,
  ClearingAuditEvidence,
  ClearingAuditEvent,
  ClearingBatch,
  ClearingBatchStatus,
  ClearingBatchSummary,
  ClearingExecution,
  ClearingExecutionPreview,
  ClearingOverview,
  ClearingReconciliationState,
  ClearingTransaction,
} from '../../services/clearingApi';
import centralizedWebSocketManager from '../../services/centralizedWebSocketManager';
import './UnauthorizedClearingWorkspace.css';
import './CustodyWorkspaceRefresh.css';
import CustodyOperatingGuide from './CustodyOperatingGuide';

type WorkspaceView = 'control' | 'accounts' | 'execution' | 'audit' | 'guide';
type TransactionFilter = 'all' | 'safe' | 'review' | 'blocked' | 'committed' | 'closed';
type CommandKind = 'submit' | 'approve' | 'reject' | 'rollback';
type AccountLookupMode = 'ACCOUNT' | 'RRN';
type DirectMode = 'QUEUE_TRANSACTION' | 'ALL_UNAUTHORIZED_DEBITS' | 'QUEUE_ROW_ONLY' | 'QUEUE_AMOUNT_RESET';
type AuditPriority = 'mutation' | 'authorization' | 'reconciliation' | 'custody';

interface AuditDayGroup {
  label: string;
  key: string;
  events: ClearingAuditEvent[];
}

interface AuditWeekGroup {
  label: string;
  key: string;
  days: AuditDayGroup[];
}

interface AuditMonthGroup {
  label: string;
  key: string;
  weeks: AuditWeekGroup[];
}

interface AuditYearGroup {
  label: string;
  key: string;
  months: AuditMonthGroup[];
}

interface Props {
  actor: string;
  userRole: string;
  initialView?: WorkspaceView;
}

const safeStates = new Set<ClearingReconciliationState>(['READY', 'READY_WITH_RESIDUAL', 'SAFE_EXTRA_QUEUE']);

const stateLabel: Record<ClearingReconciliationState, string> = {
  NOT_RECONCILED: 'Awaiting read',
  STALE: 'Read required',
  EXCLUDED: 'Excluded',
  READY: 'Exact match',
  READY_WITH_RESIDUAL: 'Residual preserved',
  SAFE_EXTRA_QUEUE: 'Extra queue preserved',
  SPECIAL_REVIEW: 'Review required',
  NO_LONGER_OUTSTANDING: 'No action',
  BLOCKED: 'Blocked',
};

const batchStatusLabel: Record<ClearingBatchStatus, string> = {
  IMPORTED: 'Source imported',
  RECONCILING: 'Reading Oracle',
  RECONCILED: 'Read complete',
  HAS_EXCEPTIONS: 'Exceptions found',
  READY_FOR_APPROVAL: 'Ready to submit',
  PENDING_APPROVAL: 'Checker review',
  APPROVED: 'Approved',
  EXECUTION_READY: 'Execution ready',
  EXECUTING: 'Executing',
  COMPLETED: 'Committed',
  ROLLED_BACK: 'Reversed',
  BLOCKED: 'Blocked',
  FAILED: 'Failed',
  COMMIT_UNCERTAIN: 'Commit uncertain',
};

const batchHandoffDetail: Record<ClearingBatchStatus, string> = {
  IMPORTED: 'Identifiers are sealed. Verify Oracle evidence to resolve exact rows and values.',
  RECONCILING: 'A fresh read is resolving account, currency, balance, and queue evidence.',
  RECONCILED: 'Oracle evidence is current. Review the interpreted rows before submission.',
  HAS_EXCEPTIONS: 'Separate safe rows from exceptions before sending a scope to the checker.',
  READY_FOR_APPROVAL: 'The selected evidence is safe to seal for checker review.',
  PENDING_APPROVAL: 'The checker must inspect the before-state and intended mutation.',
  APPROVED: 'Checker authority is recorded against the sealed payload.',
  EXECUTION_READY: 'The sealed payload is approved and ready for guarded execution.',
  EXECUTING: 'Oracle rows are locked, revalidated, and mutated as one controlled operation.',
  COMPLETED: 'The mutation committed and before/after evidence is in the custody trail.',
  ROLLED_BACK: 'The committed change was compensated and remains fully attributable.',
  BLOCKED: 'The mutation was stopped. Inspect the evidence before another attempt.',
  FAILED: 'Verification did not complete. Resolve the reported condition and read again.',
  COMMIT_UNCERTAIN: 'Stop. Do not retry until live state and execution evidence are reconciled.',
};

const money = (value?: string | number | null) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

const dateTime = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

const shortHash = (value?: string | null) => (value ? `${value.slice(0, 9)}...${value.slice(-6)}` : 'Not sealed');

const auditPriority = (eventType: string): AuditPriority => {
  if (/execution|rollback|mutation|committed/.test(eventType)) return 'mutation';
  if (/approval|approved|rejected|submitted/.test(eventType)) return 'authorization';
  if (/reconcil|inspect|lookup/.test(eventType)) return 'reconciliation';
  return 'custody';
};

const auditPriorityLabel: Record<AuditPriority, string> = {
  mutation: 'Oracle mutation',
  authorization: 'Authorization',
  reconciliation: 'Evidence verification',
  custody: 'Custody activity',
};

const auditEventTitle = (eventType: string) => {
  const labels: Record<string, string> = {
    execution_committed: 'Execution Committed',
    execution_failed: 'Execution Stopped',
    execution_created: 'Execution Started',
    batch_approved: 'Payload Approved',
    batch_rejected: 'Payload Rejected',
    batch_submitted: 'Payload Submitted',
    batch_reconciled: 'Oracle Evidence Verified',
    specific_record_policy_changed: 'Specific Record Policy Changed',
  };
  return labels[eventType] || eventType.replace(/_/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
};

type EvidenceRecord = Record<string, unknown>;

const evidenceColumnPriority = [
  'record',
  'row_id',
  'external_account',
  'internal_account',
  'currency',
  'rrn',
  'stan',
  'entry_date',
  'amount',
  'fee',
  'charge',
  'unauth_db_sum',
  'account_balance',
  'available_balance',
  'state',
  'message',
];

const isEvidenceRecord = (value: unknown): value is EvidenceRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const evidenceLabel = (value: string) => value
  .replace(/^acntbal_/i, '')
  .replace(/^bgpq_/i, '')
  .replace(/_/g, ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase());

const evidenceValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.length ? value.map(evidenceValue).join(', ') : 'None';
  if (isEvidenceRecord(value)) {
    const facts = Object.entries(value);
    return facts.length
      ? facts.map(([key, item]) => `${evidenceLabel(key)}: ${evidenceValue(item)}`).join(' | ')
      : 'None';
  }
  return String(value);
};

const evidenceRows = (value: unknown): EvidenceRecord[] => {
  if (Array.isArray(value)) {
    return value.map((item) => (isEvidenceRecord(item) ? item : { value: item }));
  }
  if (!isEvidenceRecord(value)) return value === undefined ? [] : [{ value }];
  const entries = Object.entries(value);
  if (entries.length && entries.every(([, item]) => isEvidenceRecord(item))) {
    return entries.map(([record, item]) => {
      const row = item as EvidenceRecord;
      return row.row_id ? row : { record, ...row };
    });
  }
  return entries.length ? [value] : [];
};

const evidenceColumns = (rows: EvidenceRecord[]) => Array.from(
  new Set(rows.flatMap((row) => Object.keys(row))),
).sort((left, right) => {
  const leftPriority = evidenceColumnPriority.indexOf(left);
  const rightPriority = evidenceColumnPriority.indexOf(right);
  if (leftPriority === -1 && rightPriority === -1) return left.localeCompare(right);
  if (leftPriority === -1) return 1;
  if (rightPriority === -1) return -1;
  return leftPriority - rightPriority;
});

const EvidenceTable: React.FC<{ title: string; value: unknown; empty?: string }> = ({ title, value, empty = 'No records captured.' }) => {
  const rows = evidenceRows(value);
  const columns = evidenceColumns(rows);
  return (
    <section className="audit-readable-evidence">
      <header><strong>{title}</strong><span>{rows.length} record{rows.length === 1 ? '' : 's'}</span></header>
      {rows.length ? (
        <div className="audit-evidence-table-scroll">
          <table>
            <thead><tr>{columns.map((column) => <th key={column}>{evidenceLabel(column)}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {columns.map((column) => <td key={column} title={evidenceValue(row[column])}>{evidenceValue(row[column])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p>{empty}</p>}
    </section>
  );
};

const EvidenceFacts: React.FC<{ value: EvidenceRecord }> = ({ value }) => (
  <dl className="audit-evidence-facts">
    {Object.entries(value).map(([key, item]) => (
      <div key={key}><dt>{evidenceLabel(key)}</dt><dd>{evidenceValue(item)}</dd></div>
    ))}
  </dl>
);

const uniqueEvidenceRows = (...values: unknown[]): EvidenceRecord[] => {
  const rows = new Map<string, EvidenceRecord>();
  values.flatMap(evidenceRows).forEach((row) => {
    const stableRecord = Object.fromEntries(
      Object.entries(row).sort(([left], [right]) => left.localeCompare(right)),
    );
    const key = String(row.row_id || row.record || JSON.stringify(stableRecord));
    if (!rows.has(key)) rows.set(key, row);
  });
  return Array.from(rows.values());
};

const canonicalExecutionBeforeState = (execution?: ClearingExecution | null) => {
  const executionBefore = isEvidenceRecord(execution?.oracle_evidence?.before)
    ? execution?.oracle_evidence?.before as EvidenceRecord
    : {};
  const itemEvidence = execution?.items || [];
  return {
    balanceRows: uniqueEvidenceRows(
      executionBefore.balance_rows,
      ...itemEvidence.map((item) => item.before_evidence?.balance_rows),
    ),
    queueRows: uniqueEvidenceRows(
      executionBefore.queue_rows,
      ...itemEvidence.map((item) => item.before_evidence?.queue_rows),
    ),
  };
};

const uniqueSnapshots = (snapshots: Array<Record<string, any>>) => {
  const rows = new Map<string, Record<string, any>>();
  snapshots.forEach((snapshot) => {
    const key = String(
      snapshot.snapshot_id
      || `${snapshot.reconciliation_id || ''}:${snapshot.external_account || ''}:${snapshot.internal_account || ''}:${snapshot.account_role || ''}`,
    );
    if (!rows.has(key)) rows.set(key, snapshot);
  });
  return Array.from(rows.values());
};

const AuditEvidenceSkeleton: React.FC = () => (
  <div className="audit-evidence-skeleton" role="status" aria-live="polite" aria-label="Loading custody evidence">
    <div className="audit-evidence-skeleton-head"><span /><strong /><i /></div>
    <div className="audit-evidence-skeleton-block tall"><span /><strong />{Array.from({ length: 3 }).map((_, index) => <i key={index} />)}</div>
    <div className="audit-evidence-skeleton-block"><span /><strong /><i /><i /></div>
    <div className="audit-evidence-skeleton-block"><span /><strong /><i /></div>
    <p>Opening sealed evidence...</p>
  </div>
);

const startOfLocalDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const groupAuditTimeline = (events: ClearingAuditEvent[], now = new Date()): AuditYearGroup[] => {
  const currentDay = startOfLocalDay(now).getTime();
  const currentYear = now.getFullYear();
  const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const years = new Map<string, Map<string, Map<string, Map<string, ClearingAuditEvent[]>>>>();

  events.forEach((event) => {
    const date = new Date(event.occurred_at);
    if (Number.isNaN(date.getTime())) return;
    const yearKey = String(date.getFullYear());
    const monthKey = `${yearKey}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const weekKey = `${monthKey}-W${Math.floor((date.getDate() - 1) / 7) + 1}`;
    const dayKey = `${monthKey}-${String(date.getDate()).padStart(2, '0')}`;
    if (!years.has(yearKey)) years.set(yearKey, new Map());
    const months = years.get(yearKey)!;
    if (!months.has(monthKey)) months.set(monthKey, new Map());
    const weeks = months.get(monthKey)!;
    if (!weeks.has(weekKey)) weeks.set(weekKey, new Map());
    const days = weeks.get(weekKey)!;
    if (!days.has(dayKey)) days.set(dayKey, []);
    days.get(dayKey)!.push(event);
  });

  return Array.from(years.entries()).map(([yearKey, months]) => ({
    key: yearKey,
    label: Number(yearKey) === currentYear ? 'Current year' : Number(yearKey) === currentYear - 1 ? 'Last year' : yearKey,
    months: Array.from(months.entries()).map(([monthKey, weeks]) => {
      const [, monthNumber] = monthKey.split('-').map(Number);
      const monthDate = new Date(Number(yearKey), monthNumber - 1, 1);
      const isCurrentMonth = monthDate.getFullYear() === now.getFullYear() && monthDate.getMonth() === now.getMonth();
      const isPreviousMonth = monthDate.getFullYear() === previousMonth.getFullYear() && monthDate.getMonth() === previousMonth.getMonth();
      return {
        key: monthKey,
        label: isCurrentMonth ? 'This month' : isPreviousMonth ? 'Last month' : monthDate.toLocaleDateString(undefined, { month: 'long' }),
        weeks: Array.from(weeks.entries()).map(([weekKey, days]) => ({
          key: weekKey,
          label: `Week ${weekKey.split('W')[1]}`,
          days: Array.from(days.entries()).map(([dayKey, dayEvents]) => {
            const date = new Date(`${dayKey}T00:00:00`);
            const difference = Math.round((currentDay - date.getTime()) / 86400000);
            const label = difference === 0
              ? 'Today'
              : difference === 1
                ? 'Yesterday'
                : difference > 1 && difference < 7
                  ? date.toLocaleDateString(undefined, { weekday: 'long' })
                  : date.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: date.getFullYear() === currentYear ? undefined : 'numeric' });
            return {
              key: dayKey,
              label,
              events: [...dayEvents].sort((left, right) => {
                const priority = { mutation: 0, authorization: 1, reconciliation: 2, custody: 3 };
                return priority[auditPriority(left.event_type)] - priority[auditPriority(right.event_type)]
                  || right.occurred_at.localeCompare(left.occurred_at);
              }),
            };
          }),
        })),
      };
    }),
  }));
};

const readError = (error: any) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.detail ||
  error?.message ||
  'The Funds Custody operation could not be completed.';

const sourceFileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const encoded = String(reader.result || '').split(',', 2)[1];
      if (!encoded) {
        reject(new Error('The selected source file could not be read.'));
        return;
      }
      resolve(encoded);
    };
    reader.onerror = () => reject(reader.error || new Error('The selected source file could not be read.'));
    reader.readAsDataURL(file);
  });

const executionFailureMessage = (execution: ClearingExecution) => {
  if (execution.error_message) return execution.error_message;
  const status = execution.status.replace(/_/g, ' ').toLowerCase();
  return `Approval was recorded, but the guarded Oracle execution ended as ${status}. Inspect the custody evidence before taking another action.`;
};

const UnauthorizedClearingWorkspace: React.FC<Props> = ({ actor, userRole, initialView = 'control' }) => {
  const { addNotification } = useNotifications();
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [overview, setOverview] = useState<ClearingOverview | null>(null);
  const [batches, setBatches] = useState<ClearingBatchSummary[]>([]);
  const [batch, setBatch] = useState<ClearingBatch | null>(null);
  const [executions, setExecutions] = useState<ClearingExecution[]>([]);
  const [audit, setAudit] = useState<ClearingAuditEvent[]>([]);
  const [batchSearch, setBatchSearch] = useState('');
  const [guideOrigin, setGuideOrigin] = useState<WorkspaceView>(initialView);
  const [auditKind, setAuditKind] = useState<AuditPriority | 'all'>('all');
  const [auditFrom, setAuditFrom] = useState('');
  const [auditTo, setAuditTo] = useState('');
  const [auditExpanded, setAuditExpanded] = useState<boolean | undefined>(undefined);
  const [auditExpansionRevision, setAuditExpansionRevision] = useState(0);
  const [auditQuery, setAuditQuery] = useState('');
  const [auditEvidence, setAuditEvidence] = useState<ClearingAuditEvidence | null>(null);
  const [selectedAuditEventId, setSelectedAuditEventId] = useState<string | null>(null);
  const auditEvidenceRequest = useRef(0);
  const [preview, setPreview] = useState<ClearingExecutionPreview | null>(null);
  const [accountView, setAccountView] = useState<ClearingAccountView | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [accountLookup, setAccountLookup] = useState('');
  const [accountLookupMode, setAccountLookupMode] = useState<AccountLookupMode>('ACCOUNT');
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [importIdentityKind, setImportIdentityKind] = useState<AccountLookupMode>('ACCOUNT');
  const [batchName, setBatchName] = useState('');
  const [financeReference, setFinanceReference] = useState('');

  const [command, setCommand] = useState<CommandKind | null>(null);
  const [commandBatchId, setCommandBatchId] = useState<string | null>(null);
  const [changeReference, setChangeReference] = useState('');
  const [commandNote, setCommandNote] = useState('');
  const [rollbackExecutionId, setRollbackExecutionId] = useState<string | null>(null);
  const [selectedBalanceRow, setSelectedBalanceRow] = useState<string | null>(null);
  const [selectedQueueRows, setSelectedQueueRows] = useState<string[]>([]);
  const [selectionPending, setSelectionPending] = useState<Set<string>>(new Set());
  const [directMode, setDirectMode] = useState<DirectMode>('QUEUE_TRANSACTION');
  const [directAmount, setDirectAmount] = useState('');
  const [directReference, setDirectReference] = useState('');
  const [directNote, setDirectNote] = useState('');

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const refreshBatch = useCallback(async (batchId: string) => {
    const next = await clearingApi.getBatch(batchId);
    setBatch(next);
    setBatches((current) => {
      const summary = next as ClearingBatchSummary;
      const without = current.filter((item) => item.batch_id !== next.batch_id);
      return [summary, ...without].sort((left, right) => right.updated_at.localeCompare(left.updated_at));
    });
    if (next.approved_payload || next.payload_hash) {
      try {
        setPreview(await clearingApi.getExecutionPreview(batchId));
      } catch {
        setPreview(null);
      }
    } else {
      setPreview(null);
    }
    return next;
  }, []);

  const loadWorkspace = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
      setError(null);
    }
    try {
      const [nextOverview, nextBatches, nextExecutions, nextAudit] = await Promise.all([
        clearingApi.overview(),
        clearingApi.listBatches(),
        clearingApi.listExecutions(),
        clearingApi.listAudit(),
      ]);
      setOverview(nextOverview);
      setBatches(nextBatches);
      setExecutions(nextExecutions);
      setAudit(nextAudit);
      const currentBatchId = batch?.batch_id;
      const targetId = currentBatchId && nextBatches.some((item) => item.batch_id === currentBatchId)
        ? currentBatchId
        : nextBatches[0]?.batch_id;
      if (targetId) {
        await refreshBatch(targetId);
      } else {
        setBatch(null);
      }
    } catch (loadError) {
      setError(readError(loadError));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [batch?.batch_id, refreshBatch]);

  useEffect(() => {
    void loadWorkspace();
    // Initial hydration only; explicit refresh owns later reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = centralizedWebSocketManager.subscribe('funds-custody', (event) => {
      if (event?.type !== 'CUSTODY_UPDATE') return;
      if (event?.event_type === 'selection_changed') return;
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void loadWorkspace(false), 220);
    });
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribe();
    };
  }, [loadWorkspace]);

  const notify = (type: 'success' | 'error' | 'warning', message: string) =>
    addNotification({ type, message, priority: type === 'error' ? 'high' : 'medium' });

  const run = async (key: string, action: () => Promise<void>, success?: string) => {
    setBusy(key);
    setError(null);
    try {
      await action();
      if (success) notify('success', success);
    } catch (operationError) {
      const detail = readError(operationError);
      setError(detail);
      notify('error', detail);
    } finally {
      setBusy(null);
    }
  };

  const handleImport = () =>
    run(
      'import',
      async () => {
        if (!sourceFile) throw new Error('Select the Finance CSV or XLSX source.');
        const imported = await clearingApi.importBatch({
          batch_name: batchName.trim(),
          finance_reference: financeReference.trim(),
          filename: sourceFile.name,
          content_base64: await sourceFileToBase64(sourceFile),
          identity_kind: importIdentityKind,
        });
        setImportOpen(false);
        setSourceFile(null);
        setBatchName('');
        setFinanceReference('');
        await refreshBatch(imported.batch_id);
        setOverview(await clearingApi.overview());
        setView('control');
      },
      'Identifiers sealed. Verify Oracle evidence before selecting the execution scope.',
    );

  const downloadSourceTemplate = () => {
    const content = importIdentityKind === 'ACCOUNT'
      ? ['Account', '100004167974'].join('\r\n')
      : ['RRN', '180001000436'].join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sentinelops_clearing_${importIdentityKind.toLowerCase()}_template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadOperatingGuide = () => {
    const anchor = document.createElement('a');
    anchor.href = FUNDS_CUSTODY_MANUAL_PDF_PATH;
    anchor.download = 'SentinelOps_Funds_Custody_Operating_Guide.pdf';
    anchor.click();
  };

  const handleReconcile = () => {
    if (!batch) return;
    void run(
      'reconcile',
      async () => {
        await clearingApi.reconcile(batch.batch_id);
        await refreshBatch(batch.batch_id);
        setAudit(await clearingApi.listAudit(batch.batch_id));
      },
      'Fresh Oracle evidence verified and sealed for this batch.',
    );
  };

  const applyLocalSelection = useCallback((batchId: string, selectedFingerprints: Set<string>) => {
    setBatch((current) => {
      if (!current || current.batch_id !== batchId) return current;
      const transactions = current.transactions.map((transaction) => {
        if (transaction.custody_state === 'COMMITTED') return transaction;
        const selected = selectedFingerprints.has(transaction.fingerprint);
        return {
          ...transaction,
          selected,
          reconciliation_state: selected ? 'STALE' : 'EXCLUDED',
          reconciliation_payload: {},
        } as ClearingTransaction;
      });
      const selectedCount = transactions.filter(
        (transaction) => transaction.selected && transaction.custody_state !== 'COMMITTED',
      ).length;
      return {
        ...current,
        status: 'IMPORTED',
        selected_count: selectedCount,
        transactions,
        reconciliation_summary: {},
        approved_payload: null,
        payload_hash: null,
        submitted_by: null,
        submitted_at: null,
        approved_by: null,
        approved_at: null,
        command_scope: current.command_scope ? { ...current.command_scope, armed: selectedCount } : current.command_scope,
      };
    });
    setPreview(null);
  }, []);

  const handleSelection = async (transaction: ClearingTransaction) => {
    if (!batch || selectionPending.has(transaction.fingerprint)) return;
    const targetSelected = !transaction.selected;
    const selected = new Set(
      batch.transactions.filter((item) => item.selected).map((item) => item.fingerprint),
    );
    if (targetSelected) selected.add(transaction.fingerprint);
    else selected.delete(transaction.fingerprint);
    applyLocalSelection(batch.batch_id, selected);
    setSelectionPending((current) => new Set(current).add(transaction.fingerprint));
    setError(null);
    try {
      const result = await clearingApi.setTransactionSelection(
        batch.batch_id,
        transaction.fingerprint,
        targetSelected,
      );
      setBatches((current) => current.map((item) => item.batch_id === batch.batch_id
        ? { ...item, status: 'IMPORTED', selected_count: result.selected_count }
        : item));
    } catch (selectionError) {
      setError(readError(selectionError));
      notify('error', readError(selectionError));
      await refreshBatch(batch.batch_id);
    } finally {
      setSelectionPending((current) => {
        const next = new Set(current);
        next.delete(transaction.fingerprint);
        return next;
      });
    }
  };

  const handleBulkSelection = (action: 'ARM_WINDOW' | 'DISARM_ALL') => {
    if (!batch) return;
    const pending = batch.transactions.filter((transaction) => transaction.custody_state !== 'COMMITTED');
    const limit = windowBlocked ? (overview?.operating_window.batch_threshold || 20) : pending.length;
    const selected = new Set(
      action === 'DISARM_ALL' ? [] : pending.slice(0, limit).map((transaction) => transaction.fingerprint),
    );
    applyLocalSelection(batch.batch_id, selected);
    void run('selection-bulk', async () => {
      try {
        const result = await clearingApi.setBatchSelection(batch.batch_id, action);
        applyLocalSelection(batch.batch_id, new Set(result.selected_fingerprints || []));
        setBatches((current) => current.map((item) => item.batch_id === batch.batch_id
          ? { ...item, status: 'IMPORTED', selected_count: result.selected_count }
          : item));
      } catch (bulkError) {
        await refreshBatch(batch.batch_id);
        throw bulkError;
      }
    }, action === 'DISARM_ALL'
      ? 'The command tranche is clear.'
      : windowBlocked
        ? `The first ${overview?.operating_window.batch_threshold || 20} pending records are armed.`
        : 'Every pending record is armed for this command window.');
  };

  const handleDeleteBatch = (batchId: string) => {
    const target = batches.find((item) => item.batch_id === batchId);
    const retiringDecision = target?.source_kind === 'ACCOUNT_EXPLORER'
      && ['COMPLETED', 'ROLLED_BACK'].includes(target.status);
    return (
    run('delete-batch', async () => {
      await clearingApi.deleteBatch(batchId);
      const nextBatches = await clearingApi.listBatches();
      setBatches(nextBatches);
      if (batch?.batch_id === batchId) {
        if (nextBatches[0]) await refreshBatch(nextBatches[0].batch_id);
        else setBatch(null);
      }
      setOverview(await clearingApi.overview());
      setAudit(await clearingApi.listAudit());
    }, retiringDecision
      ? 'Completed account decision archived. Its custody evidence remains available in the trail.'
      : 'Batch removed from the active custody workspace.')
    );
  };

  const createAccountBatch = () => {
    if (!accountView?.snapshot || !selectedBalanceRow) return;
    const balance = accountView.snapshot.balance_rows.find((row) => String(row.row_id) === selectedBalanceRow);
    const currency = String(balance?.currency || '');
    void run('account-batch', async () => {
      const payload = {
        balance_row_id: selectedBalanceRow,
        currency,
        mode: directMode,
        queue_row_id: ['QUEUE_TRANSACTION', 'QUEUE_ROW_ONLY'].includes(directMode) && selectedQueueRows.length === 1
          ? selectedQueueRows[0]
          : null,
        queue_row_ids: ['QUEUE_TRANSACTION', 'QUEUE_ROW_ONLY'].includes(directMode) ? selectedQueueRows : [],
        clear_amount: directMode === 'QUEUE_TRANSACTION' ? directAmount : null,
        change_reference: directReference.trim(),
        note: directNote.trim(),
      };
      const created = accountView.lookup_mode === 'RRN' && accountView.lookup_value
        ? await clearingApi.createRrnBatch(accountView.lookup_value, payload)
        : await clearingApi.createAccountBatch(accountView.external_account, payload);
      await refreshBatch(created.batch_id);
      setBatches(await clearingApi.listBatches());
      setOverview(await clearingApi.overview());
      setView('control');
      setDirectAmount('');
      setDirectReference('');
      setDirectNote('');
      setSelectedQueueRows([]);
    }, 'Controlled batch created. Verify fresh Oracle evidence before submission.');
  };

  const openCommand = (kind: CommandKind, executionId?: string, targetBatchId?: string) => {
    setCommandNote('');
    setRollbackExecutionId(executionId || null);
    const approvalBatchId = targetBatchId || batch?.batch_id;
    setCommandBatchId(approvalBatchId || null);
    if ((kind === 'approve' || kind === 'reject') && approvalBatchId) {
      void run('approval-preview', async () => {
        await refreshBatch(approvalBatchId);
        setPreview(await clearingApi.getExecutionPreview(approvalBatchId));
        setCommand(kind);
      });
      return;
    }
    setCommand(kind);
  };

  const executeCommand = () =>
    run(
      `command-${command}`,
      async () => {
        const targetBatchId = commandBatchId || batch?.batch_id;
        let approvalFailure: string | null = null;
        if (!targetBatchId && command !== 'rollback') return;
        if (command === 'submit' && batch) {
          await clearingApi.submit(batch.batch_id, changeReference, commandNote);
          setChangeReference('');
          await refreshBatch(batch.batch_id);
        } else if ((command === 'approve' || command === 'reject') && targetBatchId) {
          const decision = await clearingApi.decideApproval(targetBatchId, command === 'approve', commandNote);
          await refreshBatch(targetBatchId);
          setExecutions(await clearingApi.listExecutions());
          if (command === 'approve' && 'execution_id' in decision && decision.status !== 'COMMITTED') {
            approvalFailure = executionFailureMessage(decision);
          }
        } else if (command === 'rollback' && rollbackExecutionId) {
          await clearingApi.rollback(rollbackExecutionId, commandNote);
          setExecutions(await clearingApi.listExecutions());
          if (batch) await refreshBatch(batch.batch_id);
        }
        setAudit(await clearingApi.listAudit());
        setCommand(null);
        setCommandBatchId(null);
        if (approvalFailure) throw new Error(approvalFailure);
      },
      command === 'submit'
        ? 'Batch transferred to checker custody.'
        : command === 'approve'
          ? 'Payload approved. The guarded Oracle mutation completed and entered custody.'
          : command === 'reject'
            ? 'Payload rejected and returned to the maker. No Oracle mutation was attempted.'
            : command === 'rollback'
              ? 'Compensating reversal committed and audited.'
              : 'Authorized Oracle clearing completed.',
    );

  const handleSpecificRecordPolicy = (enabled: boolean) =>
    run('specific-record-policy', async () => {
      await clearingApi.setSpecificRecordPolicy(enabled);
      setOverview(await clearingApi.overview());
    }, enabled ? 'Specific-record clearing is available to operators.' : 'Operators can now clear full debit rows only.');

  const accountIndex = useMemo(() => {
    if (!batch) return [];
    const accounts = new Map<string, { account: string; roles: Set<string>; states: Set<ClearingReconciliationState>; count: number }>();
    batch.transactions.forEach((transaction) => {
      [[transaction.from_account, 'Debit']].forEach(([account, role]) => {
        const current = accounts.get(account) || {
          account,
          roles: new Set<string>(),
          states: new Set<ClearingReconciliationState>(),
          count: 0,
        };
        current.roles.add(role);
        current.states.add(transaction.reconciliation_state);
        current.count += 1;
        accounts.set(account, current);
      });
    });
    return Array.from(accounts.values()).sort((left, right) => left.account.localeCompare(right.account));
  }, [batch]);

  const inspectAccount = (account: string) => {
    const normalized = account.trim();
    if (!normalized) return;
    setSelectedAccount(normalized);
    setAccountLookup(normalized);
    setAccountView(null);
    setSelectedBalanceRow(null);
    setSelectedQueueRows([]);
    void run('account', async () => {
      setAccountView(await clearingApi.inspectLiveAccount(normalized));
    });
  };

  const inspectRrn = (rrn: string) => {
    const normalized = rrn.trim();
    if (!normalized) return;
    setSelectedAccount(`RRN:${normalized}`);
    setAccountLookup(normalized);
    setAccountView(null);
    setSelectedBalanceRow(null);
    setSelectedQueueRows([]);
    void run('account', async () => {
      setAccountView(await clearingApi.inspectLiveRrn(normalized));
    });
  };

  useEffect(() => {
    if (view !== 'accounts' || selectedAccount || !batch || !accountIndex.length) return;
    const target = accountIndex[0].account;
    setSelectedAccount(target);
    setAccountLookup(target);
    setBusy('account');
    clearingApi
      .inspectLiveAccount(target)
      .then(setAccountView)
      .catch((accountError) => setError(readError(accountError)))
      .finally(() => setBusy(null));
  }, [accountIndex, batch, selectedAccount, view]);

  const filteredTransactions = useMemo(() => {
    if (!batch) return [];
    const search = query.trim().toLowerCase();
    return batch.transactions.filter((transaction) => {
      const state = transaction.reconciliation_state;
      const filterMatches =
        filter === 'all' ||
        (filter === 'safe' && transaction.custody_state !== 'COMMITTED' && safeStates.has(state)) ||
        (filter === 'review' && state === 'SPECIAL_REVIEW') ||
        (filter === 'blocked' && state === 'BLOCKED') ||
        (filter === 'committed' && transaction.custody_state === 'COMMITTED') ||
        (filter === 'closed' && transaction.custody_state !== 'COMMITTED' && ['NO_LONGER_OUTSTANDING', 'EXCLUDED'].includes(state));
      const searchMatches =
        !search ||
        [transaction.rrn, transaction.stan, transaction.from_account, transaction.to_account || '', transaction.currency || '', transaction.narration]
          .join(' ')
          .toLowerCase()
          .includes(search);
      return filterMatches && searchMatches;
    });
  }, [batch, filter, query]);

  const classificationCounts = useMemo(() => {
    const counts = { safe: 0, review: 0, blocked: 0, committed: 0, closed: 0 };
    batch?.transactions.forEach((transaction) => {
      if (transaction.custody_state === 'COMMITTED') counts.committed += 1;
      else if (safeStates.has(transaction.reconciliation_state)) counts.safe += 1;
      else if (transaction.reconciliation_state === 'SPECIAL_REVIEW') counts.review += 1;
      else if (transaction.reconciliation_state === 'BLOCKED') counts.blocked += 1;
      else if (['NO_LONGER_OUTSTANDING', 'EXCLUDED'].includes(transaction.reconciliation_state)) counts.closed += 1;
    });
    return counts;
  }, [batch]);

  const selectedSafeCount = batch?.transactions.filter(
    (transaction) => transaction.selected && safeStates.has(transaction.reconciliation_state),
  ).length || 0;
  const pendingAuthorizationBatches = useMemo(
    () => batches.filter((item) => item.status === 'PENDING_APPROVAL'),
    [batches],
  );
  const canSpecificRecordClear = overview?.specific_record_policy?.can_specific_record_clear ?? false;
  const isCustodyAdmin = overview?.specific_record_policy?.is_admin ?? userRole.toLowerCase() === 'admin';

  const windowBlocked = !!overview?.operating_window?.blocked;
  const batchWindowBlocked = !!batch
    && windowBlocked
    && (batch.command_scope?.armed ?? batch.selected_count) > (overview?.operating_window.batch_threshold || 20);
  const canReconcile = !!batch && !batchWindowBlocked && !['EXECUTING', 'COMPLETED', 'ROLLED_BACK', 'COMMIT_UNCERTAIN'].includes(batch.status);
  const canSubmit = !!batch && selectedSafeCount > 0 && batch.transactions.every(
    (transaction) => !transaction.selected || safeStates.has(transaction.reconciliation_state),
  );
  const accountBatchTransactions = useMemo(
    () => batch?.transactions.filter((transaction) => transaction.from_account === selectedAccount) || [],
    [batch, selectedAccount],
  );
  const directBalanceRow = accountView?.snapshot?.balance_rows.find(
    (row) => String(row.row_id) === selectedBalanceRow,
  );
  const directCurrency = String(directBalanceRow?.currency || '');
  const directUnauthorizedDebit = Number(directBalanceRow?.unauth_db_sum || 0);
  const directPhysicalQueueAmount = Number(directBalanceRow?.debit_queue_amount || 0);
  const directQueueRows = useMemo(
    () => accountView?.snapshot?.queue_rows.filter((row) => (
      String(row.account_currency || row.currency || '') === directCurrency
    )) || [],
    [accountView, directCurrency],
  );
  const selectedDirectQueueRows = useMemo(
    () => directQueueRows.filter((row) => selectedQueueRows.includes(String(row.row_id))),
    [directQueueRows, selectedQueueRows],
  );
  const selectedQueueAuthority = selectedDirectQueueRows.reduce(
    (sum, row) => sum + Number(row.amount || 0) + Number(row.fee || 0),
    0,
  );
  const accountUnauthorizedDebit = Number(accountView?.snapshot?.summary?.unauthorized_debit_total || 0);
  const accountHasOutstandingDebit = accountUnauthorizedDebit > 0;
  const accountPhysicalQueueAmount = Number(
    accountView?.snapshot?.summary?.physical_queue_amount_total
      ?? accountView?.snapshot?.balance_rows.reduce((sum, row) => sum + Number(row.debit_queue_amount || 0), 0)
      ?? 0,
  );
  const accountHasQueueCustody = accountPhysicalQueueAmount > 0 || Boolean(accountView?.snapshot?.queue_rows.length);
  const queueCustodyMode = directMode === 'QUEUE_ROW_ONLY' || directMode === 'QUEUE_AMOUNT_RESET';
  const directReady = !!selectedBalanceRow
    && directReference.trim().length >= 3
    && (
      (directMode === 'ALL_UNAUTHORIZED_DEBITS' && directUnauthorizedDebit > 0)
      || (directMode === 'QUEUE_TRANSACTION'
        && directUnauthorizedDebit > 0
        && selectedQueueRows.length > 0
        && Number(directAmount) > 0
        && Number(directAmount) <= directUnauthorizedDebit
        && (selectedQueueRows.length === 1 || Number(directAmount) === selectedQueueAuthority))
      || (directMode === 'QUEUE_ROW_ONLY' && canSpecificRecordClear && directUnauthorizedDebit <= 0 && selectedQueueRows.length > 0)
      || (directMode === 'QUEUE_AMOUNT_RESET' && directUnauthorizedDebit <= 0 && directPhysicalQueueAmount > 0 && directQueueRows.length === 0)
    );

  useEffect(() => {
    if (canSpecificRecordClear || directMode !== 'QUEUE_TRANSACTION') return;
    setDirectMode('ALL_UNAUTHORIZED_DEBITS');
    setSelectedQueueRows([]);
    setDirectAmount('');
  }, [canSpecificRecordClear, directMode]);
  useEffect(() => {
    if (directMode !== 'QUEUE_TRANSACTION') return;
    setDirectAmount(selectedQueueRows.length ? selectedQueueAuthority.toFixed(2) : '');
  }, [directMode, selectedQueueAuthority, selectedQueueRows.length]);
  const visibleAudit = useMemo(() => audit.filter(event => {
    const date = new Date(event.occurred_at);
    const day = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
    return (auditKind === 'all' || auditPriority(event.event_type) === auditKind) && (!auditFrom || day >= auditFrom) && (!auditTo || day <= auditTo);
  }), [audit, auditKind, auditFrom, auditTo]);
  const auditTimeline = useMemo(() => groupAuditTimeline(visibleAudit), [visibleAudit]);
  const inspectAuditEvent = (event: ClearingAuditEvent) => {
    const requestId = ++auditEvidenceRequest.current;
    setSelectedAuditEventId(event.audit_id);
    setAuditEvidence(null);
    setBusy(`audit-evidence-${event.audit_id}`);
    setError(null);
    void clearingApi.getAuditEvidence(event.audit_id)
      .then((evidence) => {
        if (requestId === auditEvidenceRequest.current) setAuditEvidence(evidence);
      })
      .catch((operationError) => {
        if (requestId !== auditEvidenceRequest.current) return;
        const detail = readError(operationError);
        setError(detail);
        notify('error', detail);
      })
      .finally(() => {
        if (requestId === auditEvidenceRequest.current) setBusy(null);
      });
  };
  const renderLoading = () => (
    <div className="clearing-skeleton" aria-label="Loading clearing workspace">
      <div className="clearing-skeleton-line wide" />
      <div className="clearing-skeleton-grid">
        <span /><span /><span />
      </div>
      <div className="clearing-skeleton-ledger">
        {Array.from({ length: 6 }).map((_, index) => <span key={index} />)}
      </div>
    </div>
  );

  const renderBatchIndex = () => (
    <aside className="clearing-batch-index">
      <div className="clearing-section-heading">
        <span>Controlled batches</span>
        <button type="button" className="clearing-icon-button" onClick={() => setImportOpen(true)} title="Create controlled batch">
          <FaFileImport />
        </button>
      </div>
      <button type="button" className="clearing-import-command" onClick={() => setImportOpen(true)}>
        <FaFileImport />
        <span><strong>Create controlled batch</strong><small>One Account or RRN column becomes immutable evidence</small></span>
      </button>
      <label className="custody-batch-search"><FaSearch/><input type="search" aria-label="Find a controlled batch" value={batchSearch} onChange={event=>setBatchSearch(event.target.value)} placeholder="Find a batch or reference…"/></label>
      <div className="clearing-batch-list">
        {batches.filter(item => `${item.batch_name} ${item.finance_reference} ${batchStatusLabel[item.status]}`.toLowerCase().includes(batchSearch.toLowerCase())).map((item) => {
          const canArchiveDecision = item.source_kind === 'ACCOUNT_EXPLORER'
            && ['COMPLETED', 'ROLLED_BACK'].includes(item.status);
          const canDelete = canArchiveDecision
            || ['IMPORTED', 'RECONCILED', 'HAS_EXCEPTIONS', 'READY_FOR_APPROVAL', 'FAILED', 'BLOCKED'].includes(item.status);
          const itemCountLabel = item.source_kind === 'ACCOUNT_EXPLORER' && Number(item.total_debit) === 0
            ? `${item.transaction_count} queue custody item${item.transaction_count === 1 ? '' : 's'}`
            : `${item.transaction_count} debit${item.transaction_count === 1 ? '' : 's'}`;
          return (
            <div className="clearing-batch-row-wrap" key={item.batch_id}>
              <button
                type="button"
                className={`clearing-batch-row ${batch?.batch_id === item.batch_id ? 'active' : ''}`}
                onClick={() => void run('batch', async () => {
                  setSelectedAccount(null);
                  setAccountView(null);
                  await refreshBatch(item.batch_id);
                })}
              >
                <span className={`clearing-status-beacon status-${item.status.toLowerCase()}`} />
                <span>
                  <strong>{item.batch_name}</strong>
                  <small>{item.source_kind === 'ACCOUNT_EXPLORER' ? 'Account Explorer' : item.finance_reference} / {itemCountLabel}</small>
                </span>
                <span className="clearing-row-status">{batchStatusLabel[item.status]}</span>
              </button>
              {canDelete ? (
                <button
                  type="button"
                  className="clearing-batch-delete"
                  onClick={() => void handleDeleteBatch(item.batch_id)}
                  disabled={!!busy}
                  title={canArchiveDecision ? 'Archive completed decision' : 'Delete batch'}
                  aria-label={`${canArchiveDecision ? 'Archive' : 'Delete'} ${item.batch_name}`}
                >
                  {canArchiveDecision ? <FaArchive /> : <FaTrash />}
                </button>
              ) : null}
            </div>
          );
        })}
        {batches.length > 0 && !batches.some(item => `${item.batch_name} ${item.finance_reference} ${batchStatusLabel[item.status]}`.toLowerCase().includes(batchSearch.toLowerCase())) && <div className="clearing-empty-index" role="status">No batches match this search.</div>}
        {!batches.length ? (
          <div className="clearing-empty-index">
            <FaFingerprint />
            <strong>No identifier source has entered custody.</strong>
            <span>Import one Account or RRN column to begin.</span>
          </div>
        ) : null}
      </div>
    </aside>
  );

  const renderTransactionLedger = () => {
    if (!batch) {
      return (
        <div className="clearing-zero-state">
          <FaBalanceScale />
          <h3>No active clearing batch</h3>
          <p>Import an Account or RRN source. SentinelOps will preserve it, resolve debit evidence, and prepare the fresh Oracle verification.</p>
          <button type="button" onClick={() => setImportOpen(true)}><FaFileImport /> Import source</button>
        </div>
      );
    }
    return (
      <div className="clearing-ledger">
        <div className="clearing-ledger-head">
          <div className='fine-div'>
            <span className="clearing-kicker">Authorized transaction ledger</span>
            <h2>{batch.batch_name}</h2>
            <p>{batch.finance_reference} / source sealed {dateTime(batch.created_at)}</p>
          </div>
          <div className="clearing-ledger-totals" aria-label="Finance authorized values">
            <span><small>Transaction value</small><strong>{money(batch.total_amount)}</strong></span>
            <span><small>Charges</small><strong>{money(batch.total_charge)}</strong></span>
            <span><small>Debit authority</small><strong>{money(batch.total_debit)}</strong></span>
          </div>
        </div>

        <div className="clearing-command-line">
          <div className="clearing-batch-state">
            <span className={`clearing-status-beacon status-${batch.status.toLowerCase()}`} />
            <span><small>Current handoff</small><strong>{batchStatusLabel[batch.status]}</strong><em>{batchHandoffDetail[batch.status]}</em></span>
          </div>
          <div className="clearing-command-actions">
            <button type="button" onClick={handleReconcile} disabled={!canReconcile || !!busy}>
              <FaSyncAlt /> {busy === 'reconcile' ? 'Verifying Oracle...' : 'Verify Oracle evidence'}
            </button>
            <button type="button" onClick={() => openCommand('submit')} disabled={!canSubmit || !!busy}>
              <FaUserCheck /> Submit
            </button>
          </div>
        </div>
        <div className="clearing-tranche-line">
          <div>
            <span>Command tranche</span>
            <strong>{batch.command_scope?.armed ?? batch.selected_count} armed / {windowBlocked ? `${overview?.operating_window.batch_threshold || 20} max` : 'unlimited window'}</strong>
          </div>
          <div className="clearing-tranche-track" aria-label={`${batch.command_scope?.committed || 0} committed of ${batch.transaction_count}`}>
            <span style={{ width: `${Math.min(100, ((batch.command_scope?.committed || 0) / Math.max(1, batch.transaction_count)) * 100)}%` }} />
          </div>
          <div>
            <span>Source progress</span>
            <strong>{batch.command_scope?.committed || 0} acted on / {batch.command_scope?.remaining ?? batch.transaction_count} remaining</strong>
          </div>
          <div className="clearing-tranche-actions">
            <button
              type="button"
              onClick={() => handleBulkSelection('ARM_WINDOW')}
              disabled={!!busy || ['EXECUTING', 'COMPLETED', 'ROLLED_BACK', 'COMMIT_UNCERTAIN'].includes(batch.status)}
            >
              <FaCheck /> {windowBlocked ? `Arm next ${overview?.operating_window.batch_threshold || 20}` : 'Arm all pending'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => handleBulkSelection('DISARM_ALL')}
              disabled={!!busy || !(batch.command_scope?.armed ?? batch.selected_count)}
            >
              Clear armed
            </button>
          </div>
        </div>
        {batchWindowBlocked ? (
          <div className="clearing-window-lock">
            <FaShieldAlt />
            <span><strong>Large-batch protection is active</strong><small>{overview?.operating_window.message}</small></span>
            <time>{overview?.operating_window.window} {overview?.operating_window.timezone}</time>
          </div>
        ) : null}
        {batch.transactions.length > 0 && classificationCounts.closed === batch.transactions.length ? (
          <div className="clearing-nothing-outstanding">
            <FaCheckCircle />
            <span>
              <strong>Nothing remains to clear</strong>
              <small>Oracle reports no unauthorized debit for every record in this batch. The source remains in custody as closed evidence.</small>
            </span>
          </div>
        ) : null}

        <div className="clearing-classification-line">
          {([
            ['all', 'All', batch.transactions.length],
            ['safe', 'Execution-safe', classificationCounts.safe],
            ['review', 'Special review', classificationCounts.review],
            ['blocked', 'Blocked', classificationCounts.blocked],
            ['committed', 'Acted on', classificationCounts.committed],
            ['closed', 'No action', classificationCounts.closed],
          ] as Array<[TransactionFilter, string, number]>).map(([id, label, count]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>
              <span>{label}</span><strong>{count}</strong>
            </button>
          ))}
          <label className="clearing-ledger-search">
            <FaSearch />
            <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search batch transactions" placeholder="Account, RRN, STAN..." />
          </label>
        </div>

        <div className="clearing-table-wrap">
          <table className="clearing-table">
            <thead>
              <tr>
                <th aria-label="Selected" />
                <th>Source identity</th>
                <th>Debit authority</th>
                <th>Physical debit row</th>
                <th>Oracle interpretation</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const evidence = transaction.reconciliation_payload as any;
                const committed = transaction.custody_state === 'COMMITTED';
                const queueCustodyTransaction = ['QUEUE_ROW_ONLY', 'QUEUE_AMOUNT_RESET'].includes(transaction.operation_mode);
                const selectionLocked = committed || ['EXECUTING', 'ROLLED_BACK', 'COMMIT_UNCERTAIN'].includes(batch.status);
                return (
                  <tr key={transaction.fingerprint} className={`state-${transaction.reconciliation_state.toLowerCase()} custody-${(transaction.custody_state || 'PENDING').toLowerCase()} ${transaction.selected ? 'selected' : ''}`}>
                    <td>
                      <button
                        type="button"
                        className={`clearing-select-box ${transaction.selected ? 'checked' : ''}`}
                        onClick={() => void handleSelection(transaction)}
                        disabled={selectionLocked || selectionPending.has(transaction.fingerprint) || busy === 'selection-bulk'}
                        aria-label={`${transaction.selected ? 'Exclude' : 'Select'} transaction ${transaction.rrn}`}
                      >
                        {transaction.selected ? <FaCheck /> : null}
                      </button>
                    </td>
                    <td>
                      <strong>{transaction.rrn}</strong>
                      <span>STAN {transaction.stan} / {transaction.entry_date}</span>
                      <small>{transaction.narration || `Source row ${transaction.source_row}`}</small>
                    </td>
                    <td>
                      <strong>{transaction.from_account}</strong>
                      <span>{transaction.currency || evidence?.currency || 'Currency resolves from queue'}</span>
                      <small>{transaction.to_account ? `Destination context ${transaction.to_account}` : 'Debit clearing only'}</small>
                    </td>
                    <td>
                      <strong>{queueCustodyTransaction
                        ? transaction.operation_mode === 'QUEUE_ROW_ONLY' ? 'No balance change' : money(evidence?.debit_resolution?.current ?? 0)
                        : money(evidence?.debit_resolution?.current ?? transaction.clear_amount ?? Number(transaction.amount) + Number(transaction.charge))}</strong>
                      <span>
                        {evidence?.debit_resolution?.row_id
                          ? `${evidence?.debit_resolution?.currency || transaction.currency || '---'} / ${shortHash(String(evidence.debit_resolution.row_id))}`
                          : transaction.operation_mode.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <small>
                        {transaction.operation_mode === 'QUEUE_ROW_ONLY'
                          ? 'Unauthorized debit remains 0.00; exact queue row only'
                          : evidence?.debit_resolution?.after !== undefined
                          ? `${money(evidence.debit_resolution.current)} before / ${money(evidence.debit_resolution.after)} after`
                          : `${transaction.currency || evidence?.currency || 'unresolved'} / ${money(transaction.clear_amount || transaction.amount)} intended`}
                      </small>
                    </td>
                    <td>
                      <span className={`clearing-state-mark state-${transaction.reconciliation_state.toLowerCase()}`}>
                        {committed ? 'Acted on' : transaction.selected ? stateLabel[transaction.reconciliation_state] : 'Waiting tranche'}
                      </span>
                      <small>{committed ? `Committed ${dateTime(transaction.committed_at)}` : evidence?.explanation || (transaction.selected ? 'Run reconciliation to read exact Oracle evidence.' : 'Preserved in source custody for a later command tranche.')}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="clearing-row-open"
                        onClick={() => {
                          setView('accounts');
                          inspectAccount(transaction.from_account);
                        }}
                        title="Open account evidence"
                      >
                        <FaChevronRight />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!filteredTransactions.length ? (
            <div className="clearing-table-empty">No Finance transactions match this operational view.</div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderControl = () => (
    <div className="clearing-control-layout">
      {renderBatchIndex()}
      {busy === 'batch' ? renderLoading() : renderTransactionLedger()}
    </div>
  );

  const renderAccounts = () => (
    <div className="clearing-account-layout">
      <aside className="clearing-account-index">
        <div className="clearing-section-heading">
          <span>Database lookup</span>
          <FaDatabase />
        </div>
        <p>Inspect by external account or resolve the internal debit account from queue narration RRN evidence.</p>
        <div className="clearing-account-lookup-modes" role="group" aria-label="Account lookup method">
          <button
            type="button"
            className={accountLookupMode === 'ACCOUNT' ? 'active' : ''}
            onClick={() => {
              setAccountLookupMode('ACCOUNT');
              setAccountLookup('');
            }}
          >
            <FaDatabase /> Account
          </button>
          <button
            type="button"
            className={accountLookupMode === 'RRN' ? 'active' : ''}
            onClick={() => {
              setAccountLookupMode('RRN');
              setAccountLookup('');
            }}
          >
            <FaFingerprint /> RRN
          </button>
        </div>
        <form
          className="clearing-account-lookup"
          onSubmit={(event) => {
            event.preventDefault();
            if (accountLookupMode === 'RRN') inspectRrn(accountLookup);
            else inspectAccount(accountLookup);
          }}
        >
          <label>
            <FaSearch />
            <input
              value={accountLookup}
              onChange={(event) => setAccountLookup(event.target.value)}
              placeholder={accountLookupMode === 'RRN' ? 'Narration RRN' : 'External account number'}
              aria-label={accountLookupMode === 'RRN' ? 'Narration RRN' : 'External account number'}
            />
          </label>
          <button type="submit" disabled={!accountLookup.trim() || busy === 'account'}>
            Inspect
          </button>
        </form>
        <small className="clearing-account-lookup-note">
          {accountLookupMode === 'RRN'
            ? 'Reads ASIBGPQNP narration, proves one internal account, then opens its ACNTBAL evidence.'
            : 'Reads the existing ACNTS account mapping and its live Oracle evidence.'}
        </small>
        <div className="clearing-account-index-divider">
          <span>Accounts in selected batch</span>
          <strong>{accountIndex.length}</strong>
        </div>
        <div className="clearing-account-list">
          {accountIndex.map((item) => (
            <button
              type="button"
              key={item.account}
              className={selectedAccount === item.account ? 'active' : ''}
              onClick={() => inspectAccount(item.account)}
            >
              <span className="account-index-icon"><FaDatabase /></span>
              <span><strong>{item.account}</strong><small>{Array.from(item.roles).join(' + ')} / {item.count} linked</small></span>
              <FaChevronRight />
            </button>
          ))}
          {!accountIndex.length ? (
            <div className="clearing-account-index-empty">
              No batch accounts are available. Use database lookup above.
            </div>
          ) : null}
        </div>
      </aside>
      <section className="clearing-account-dossier">
        {busy === 'account' && !accountView ? (
          renderLoading()
        ) : accountView ? (
          <>
            <div className="account-dossier-head">
              <div className='fine-div'>
                <span className="clearing-kicker">
                  {accountView.lookup_mode === 'RRN'
                    ? 'RRN-resolved Oracle dossier'
                    : accountView.source === 'LIVE_ORACLE'
                      ? 'Live Oracle account dossier'
                      : 'Batch account evidence'}
                </span>
                <h2>{accountView.lookup_mode === 'RRN' ? `RRN ${accountView.lookup_value}` : accountView.external_account}</h2>
                <p>
                  {accountView.lookup_mode === 'RRN' && accountView.snapshot?.internal_accounts?.length
                    ? accountView.snapshot.external_accounts?.length
                      ? `Queue narration resolves to account ${accountView.snapshot.external_accounts.join(', ')} through internal account ${accountView.snapshot.internal_accounts.join(', ')}.`
                      : `Queue narration resolves to internal account ${accountView.snapshot.internal_accounts.join(', ')}. No external account was surfaced from ACNTS.`
                    : accountView.snapshot?.internal_accounts?.length
                      ? `Mapped to ${accountView.snapshot.internal_accounts.join(', ')}`
                    : accountView.snapshot?.internal_account
                      ? `Mapped to internal account ${accountView.snapshot.internal_account}`
                    : 'No unique internal mapping has been proven.'}
                </p>
                {accountView.lookup_mode === 'RRN' && accountView.snapshot?.internal_accounts?.length ? (
                  <div className="account-identity-chain" aria-label="RRN account resolution path">
                    <span><small>RRN evidence</small><strong>{accountView.lookup_value}</strong></span>
                    <FaChevronRight />
                    <span><small>Internal authority</small><strong>{accountView.snapshot.internal_accounts.join(', ')}</strong></span>
                    <FaChevronRight />
                    <span className={accountView.snapshot.external_accounts?.length ? 'resolved' : 'unresolved'}>
                      <small>External account</small>
                      <strong>{accountView.snapshot.external_accounts?.join(', ') || 'Not surfaced'}</strong>
                    </span>
                  </div>
                ) : null}
                {accountView.snapshot?.account_profiles?.[0] ? (
                  <small className="account-profile-line">
                    {String(accountView.snapshot.account_profiles[0].account_name || accountView.snapshot.account_profiles[0].short_name || 'Account name unavailable')}
                    {' / '}branch {String(accountView.snapshot.account_profiles[0].branch_code || '-')}
                    {' / '}product {String(accountView.snapshot.account_profiles[0].product_code || '-')}
                  </small>
                ) : null}
              </div>
              <span className={`mapping-verdict ${accountView.snapshot?.mapping_count === 1 ? 'proven' : 'blocked'}`}>
                {accountView.snapshot?.mapping_count === 1 ? <FaCheckCircle /> : <FaExclamationTriangle />}
                {accountView.snapshot?.mapping_count === 1
                  ? accountView.lookup_mode === 'RRN' ? 'Internal account proven' : 'Mapping proven'
                  : accountView.lookup_mode === 'RRN' ? 'RRN ambiguous' : 'Mapping unresolved'}
              </span>
            </div>
            <div className="account-evidence-rail">
              <span>
                <small>Evidence context</small>
                <strong>
                  {accountView.lookup_mode === 'RRN'
                    ? 'ASIBGPQNP to ACNTBAL'
                    : accountView.source === 'LIVE_ORACLE'
                    ? 'Live database'
                    : accountView.snapshot?.account_role || 'Awaiting read'}
                </strong>
              </span>
              <span>
                <small>Physical ACNTBAL rows</small>
                <strong>{accountView.snapshot?.balance_rows.length || 0}</strong>
              </span>
              <span>
                <small>Live queue rows</small>
                <strong>{accountView.snapshot?.queue_rows.length || 0}</strong>
              </span>
              <span>
                <small>Evidence captured</small>
                <strong>{dateTime(accountView.snapshot?.captured_at)}</strong>
              </span>
            </div>
            {accountView.snapshot?.summary ? (
              <div className="account-value-ledger" aria-label="Current unauthorized account values">
                <span>
                  <small>Unauthorized debit</small>
                  <strong>{money(accountView.snapshot.summary.unauthorized_debit_total)}</strong>
                </span>
                <span>
                  <small>Currency partitions</small>
                  <strong>{accountView.snapshot.summary.currencies.join(' / ') || 'None'}</strong>
                </span>
                <span>
                  <small>Live queue value</small>
                  <strong>{money(accountView.snapshot.summary.queued_amount_total)}</strong>
                </span>
                <span>
                  <small>Physical queue amount</small>
                  <strong>{money(accountPhysicalQueueAmount)}</strong>
                </span>
              </div>
            ) : null}
            {accountView.snapshot?.summary && !accountHasOutstandingDebit && accountHasQueueCustody ? (
              <div className="account-queue-posture">
                <FaExclamationTriangle />
                <span>
                  <strong>Debit balance is clear; queue custody remains</strong>
                  <small>
                    {accountView.snapshot.queue_rows.length
                      ? `${accountView.snapshot.queue_rows.length} live queue row${accountView.snapshot.queue_rows.length === 1 ? '' : 's'} can be removed without changing the unauthorized debit balance.`
                      : `${money(accountPhysicalQueueAmount)} remains in the physical queue amount with no live queue row. Use the guarded queue repair on the matching currency row.`}
                  </small>
                </span>
              </div>
            ) : null}
            {accountView.snapshot?.summary && !accountHasOutstandingDebit && !accountHasQueueCustody ? (
              <div className="account-cleared-posture">
                <FaCheckCircle />
                <span>
                  <strong>Account and queue are clear</strong>
                  <small>No positive unauthorized debit, live queue row, or physical queue amount remains.</small>
                </span>
              </div>
            ) : null}
            <div className="account-dossier-section">
              <div className="clearing-section-heading"><span>Physical balance rows</span></div>
              <div className="physical-row-table">
                <div className="physical-row-head"><span>Currency row</span><span>Unauthorized debit</span><span>Account balance</span><span>Queue amount</span><span>Hold / lien</span><span>SCN</span></div>
                {accountView.snapshot?.balance_rows.map((row, index) => {
                  const rowCurrency = String(row.currency || '');
                  const rowUnauthorized = Number(row.unauth_db_sum || 0);
                  const rowQueueAmount = Number(row.debit_queue_amount || 0);
                  const matchingQueueRows = accountView.snapshot?.queue_rows.filter((queue) => (
                    String(queue.account_currency || queue.currency || '') === rowCurrency
                  )) || [];
                  const actionable = rowUnauthorized > 0 || rowQueueAmount > 0 || matchingQueueRows.length > 0;
                  return (
                    <button
                      type="button"
                      className={`physical-row ${selectedBalanceRow === String(row.row_id) ? 'selected' : ''} ${rowUnauthorized <= 0 && actionable ? 'queue-custody' : ''}`}
                      key={String(row.row_id || index)}
                      onClick={() => {
                        setSelectedBalanceRow(String(row.row_id));
                        setSelectedQueueRows([]);
                        setDirectAmount('');
                        if (rowUnauthorized > 0) setDirectMode(canSpecificRecordClear ? 'QUEUE_TRANSACTION' : 'ALL_UNAUTHORIZED_DEBITS');
                        else if (matchingQueueRows.length > 0) setDirectMode('QUEUE_ROW_ONLY');
                        else setDirectMode('QUEUE_AMOUNT_RESET');
                      }}
                      disabled={!actionable}
                      title={rowUnauthorized <= 0 && matchingQueueRows.length > 0
                        ? 'Prepare queue-row-only custody'
                        : rowUnauthorized <= 0 && rowQueueAmount > 0
                          ? 'Prepare physical queue amount repair'
                          : 'Prepare unauthorized debit clearing'}
                    >
                      <span><strong>{rowCurrency || '---'}</strong><code>{String(row.row_id || 'Unavailable')}</code></span>
                      <strong>{money(row.unauth_db_sum as string)}</strong>
                      <span>{money(row.account_balance as string)}</span>
                      <span>{money(row.debit_queue_amount as string)}</span>
                      <span>{money(row.amount_on_hold as string)} / {money(row.lien_amount as string)}</span>
                      <span>{String(row.row_scn || '-')}</span>
                    </button>
                  );
                })}
                {!accountView.snapshot?.balance_rows.length ? <div className="physical-row-empty">No ACNTBAL evidence captured.</div> : null}
              </div>
            </div>
            <div className="account-dossier-section">
              <div className="clearing-section-heading">
                <span>{accountBatchTransactions.length ? 'Current batch context' : 'Authority boundary'}</span>
              </div>
              {accountBatchTransactions.length ? (
                <div className="account-transaction-strip">
                  {accountBatchTransactions.map((transaction) => (
                    <div key={transaction.fingerprint}>
                      <span className={`clearing-state-dot state-${transaction.reconciliation_state.toLowerCase()}`} />
                      <span><strong>{transaction.rrn}</strong><small>{transaction.currency || 'queue-resolved currency'} / {transaction.operation_mode.startsWith('QUEUE_') ? 'queue custody' : 'debit only'}</small></span>
                      <span>
                        <strong>{transaction.operation_mode === 'QUEUE_ROW_ONLY'
                          ? 'Remove exact row'
                          : transaction.operation_mode === 'QUEUE_AMOUNT_RESET'
                            ? 'Reset queue amount'
                            : money(transaction.clear_amount || Number(transaction.amount) + Number(transaction.charge))}</strong>
                        <small>{transaction.operation_mode.startsWith('QUEUE_') ? 'unauthorized debit unchanged' : 'authorized debit reduction'}</small>
                      </span>
                      <span>{stateLabel[transaction.reconciliation_state]}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="account-live-boundary">
                  <FaShieldAlt />
                  <span>
                    <strong>Diagnostic evidence only</strong>
                    <small>Select a physical currency row to prepare a governed account clearing batch.</small>
                  </span>
                </div>
              )}
            </div>
            <div className={`account-clearing-console ${selectedBalanceRow ? 'active' : ''}`}>
              <div className="account-clearing-console-head">
                <span><FaShieldAlt /></span>
                <div>
                  <small>{queueCustodyMode ? 'Guarded queue custody' : 'Controlled debit release'}</small>
                  <strong>{selectedBalanceRow ? `${directCurrency} row selected` : 'Select an actionable currency row above'}</strong>
                </div>
                {directBalanceRow ? (
                  <b>{queueCustodyMode
                    ? `${money(directPhysicalQueueAmount)} queued`
                    : directMode === 'QUEUE_TRANSACTION' && selectedQueueRows.length
                      ? `${money(selectedQueueAuthority)} selected / ${money(directUnauthorizedDebit)} available`
                      : `${money(directUnauthorizedDebit)} available`}</b>
                ) : null}
              </div>
              {selectedBalanceRow ? (
                <div className="account-clearing-console-body">
                  {directUnauthorizedDebit > 0 ? (
                    <div className="account-clearing-modes" role="group" aria-label="Clearing scope">
                      <button
                        type="button"
                        className={directMode === 'QUEUE_TRANSACTION' ? 'active' : ''}
                        onClick={() => setDirectMode('QUEUE_TRANSACTION')}
                        disabled={!canSpecificRecordClear}
                        title={canSpecificRecordClear ? 'Clear one or more exact queue rows' : 'An administrator has limited operators to full debit-row clearing'}
                      >
                        Specific queue rows
                      </button>
                      <button type="button" className={directMode === 'ALL_UNAUTHORIZED_DEBITS' ? 'active' : ''} onClick={() => {
                        setDirectMode('ALL_UNAUTHORIZED_DEBITS');
                        setSelectedQueueRows([]);
                        setDirectAmount('');
                      }}>
                        Clear full debit row
                      </button>
                    </div>
                  ) : (
                    <div className="account-queue-repair-mode">
                      <FaShieldAlt />
                      <span><small>Authorized operation</small><strong>{directMode === 'QUEUE_ROW_ONLY' ? 'Remove one proven queue row' : 'Reset orphaned physical queue amount'}</strong></span>
                      <em>Debit balance locked at 0.00</em>
                    </div>
                  )}
                  <p>
                    {directMode === 'QUEUE_TRANSACTION'
                      ? 'Choose every matching queue card that supports this physical row. One selected row may be partially cleared; a multi-row set is sealed at its exact combined value.'
                      : directMode === 'ALL_UNAUTHORIZED_DEBITS'
                        ? `Prepare the complete ${directCurrency} unauthorized debit of ${money(directBalanceRow?.unauth_db_sum as string)}.`
                        : directMode === 'QUEUE_ROW_ONLY'
                          ? 'Choose one or more exact live queue rows below. Approval deletes only that proven set; ACNTBAL unauthorized debit remains unchanged.'
                          : `No live queue row exists for ${directCurrency}. Approval resets only the orphaned physical queue amount of ${money(directPhysicalQueueAmount)}.`}
                  </p>
                  {!canSpecificRecordClear && ['QUEUE_TRANSACTION', 'QUEUE_ROW_ONLY'].includes(directMode) ? (
                    <div className="clearing-policy-note"><FaShieldAlt /> Operator scope is currently limited to clearing the complete unauthorized debit row.</div>
                  ) : null}
                  <div className="account-clearing-fields">
                    {directMode === 'QUEUE_TRANSACTION' ? (
                      <label>
                        <span>{selectedQueueRows.length > 1 ? 'Selected authority' : 'Clear amount'}</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={directAmount}
                          onChange={(event) => setDirectAmount(event.target.value)}
                          placeholder="0.00"
                          readOnly={selectedQueueRows.length > 1}
                        />
                      </label>
                    ) : null}
                    <label><span>Change reference</span><input value={directReference} onChange={(event) => setDirectReference(event.target.value)} placeholder="Approved change or case" /></label>
                    <label className="wide"><span>Operator note</span><input value={directNote} onChange={(event) => setDirectNote(event.target.value)} placeholder="Reason and supporting context" /></label>
                    <button type="button" onClick={createAccountBatch} disabled={!directReady || !!busy}>
                      <FaLock /> {busy === 'account-batch'
                        ? 'Preparing...'
                        : directMode === 'QUEUE_ROW_ONLY'
                          ? `Seal ${selectedQueueRows.length || ''} queue row${selectedQueueRows.length === 1 ? '' : 's'}`
                          : directMode === 'QUEUE_AMOUNT_RESET'
                            ? 'Seal queue amount repair'
                            : 'Create controlled batch'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="account-dossier-section">
              <div className="clearing-section-heading queue-selection-heading">
                <span>Live unauthorized queue</span>
                {selectedBalanceRow && ['QUEUE_TRANSACTION', 'QUEUE_ROW_ONLY'].includes(directMode) ? (
                  <div className="queue-selection-tools">
                    <strong>{selectedQueueRows.length} selected / {money(selectedQueueAuthority)}</strong>
                    <button
                      type="button"
                      onClick={() => setSelectedQueueRows(
                        selectedQueueRows.length === directQueueRows.length
                          ? []
                          : directQueueRows.map((row) => String(row.row_id)),
                      )}
                      disabled={!directQueueRows.length}
                    >
                      {selectedQueueRows.length === directQueueRows.length ? 'Clear selection' : 'Select matching set'}
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="queue-evidence-grid">
                {accountView.snapshot?.queue_rows.map((row, index) => {
                  const approved = accountBatchTransactions.some(
                    (transaction) => transaction.rrn === String(row.rrn) && transaction.stan === String(row.stan),
                  );
                  const transactionCurrency = String(row.currency || '');
                  const rowCurrency = String(row.account_currency || transactionCurrency);
                  const lookupMatch = row.lookup_match === true;
                  const selectable = !!selectedBalanceRow
                    && rowCurrency === directCurrency
                    && ['QUEUE_TRANSACTION', 'QUEUE_ROW_ONLY'].includes(directMode)
                    && (directMode !== 'QUEUE_ROW_ONLY' || canSpecificRecordClear);
                  return (
                    <button
                      type="button"
                      key={String(row.row_id || index)}
                      className={`${approved ? 'approved' : 'preserved'} ${lookupMatch ? 'lookup-match' : ''} ${selectedQueueRows.includes(String(row.row_id)) ? 'selected' : ''}`}
                      onClick={() => {
                        if (!selectable) return;
                        const rowId = String(row.row_id);
                        setSelectedQueueRows((current) => current.includes(rowId)
                          ? current.filter((value) => value !== rowId)
                          : [...current, rowId]);
                      }}
                      disabled={!selectable}
                    >
                      <span>
                        {lookupMatch
                          ? 'RRN lookup match'
                          : approved
                          ? 'Finance approved'
                          : selectable
                            ? directMode === 'QUEUE_ROW_ONLY' ? 'Available for queue-only custody' : 'Available for controlled clear'
                            : `${rowCurrency || 'No currency'} / select matching balance row`}
                      </span>
                      <strong>{String(row.rrn || 'RRN unavailable')}</strong>
                      <small>STAN {String(row.stan || '-')} / {String(row.entry_date || 'date unavailable')} / account {rowCurrency || '-'}</small>
                      <p>{money(row.amount as string)} transaction / {money(row.fee as string)} fee / {money(row.processing_fee as string)} processing</p>
                      <em>{transactionCurrency && transactionCurrency !== rowCurrency ? `transaction ${transactionCurrency} / ` : ''}{String(row.channel_id || 'channel -')} / {String(row.terminal_id || 'terminal -')} / {String(row.message_type || 'MTI -')}</em>
                      {row.narration_1 || row.narration_2 ? <small>{String(row.narration_1 || '')} {String(row.narration_2 || '')}</small> : null}
                    </button>
                  );
                })}
                {!accountView.snapshot?.queue_rows.length ? <div className="queue-evidence-empty">No live queue rows were captured for this account.</div> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="clearing-zero-state">
            <FaDatabase />
            <h3>Inspect an account</h3>
            <p>Enter any external account number for a fresh Oracle dossier, then prepare a governed debit action when the evidence is exact.</p>
          </div>
        )}
      </section>
    </div>
  );

  const renderExecution = () => (
    <div className="clearing-execution-layout">
      <section className="clearing-authorization-desk">
        <header className="authorization-desk-head">
          <div className='new-fine-div'>
            <span className="clearing-kicker"><FaUserCheck /> Authorization queue</span>
            <h2>Checker handoff</h2>
            <p>Approval is the final human decision. A successful approval immediately locks, revalidates, and commits the sealed Oracle mutation.</p>
          </div>
          <span className="authorization-live"><i /> Live custody</span>
        </header>

        <div className={`specific-record-policy ${overview?.specific_record_policy?.enabled ? 'enabled' : 'restricted'}`}>
          <span><FaShieldAlt /></span>
          <div>
            <small>Operator clearing scope</small>
            <strong>{overview?.specific_record_policy?.enabled ? 'Specific or full debit' : 'Full debit rows only'}</strong>
            <p>Administrators always retain specific-record authority. This policy controls every other maker.</p>
          </div>
          {isCustodyAdmin ? (
            <button
              type="button"
              role="switch"
              aria-checked={overview?.specific_record_policy?.enabled || false}
              onClick={() => void handleSpecificRecordPolicy(!overview?.specific_record_policy?.enabled)}
              disabled={!!busy}
              title="Change operator-specific clearing policy"
            >
              <span />
              {overview?.specific_record_policy?.enabled ? 'On' : 'Off'}
            </button>
          ) : (
            <em>Admin controlled</em>
          )}
        </div>

        <div className="authorization-queue-heading">
          <span>Waiting authorization</span>
          <strong>{pendingAuthorizationBatches.length}</strong>
        </div>
        <div className="authorization-queue-list">
          {pendingAuthorizationBatches.map((item) => (
            <article key={item.batch_id} className={commandBatchId === item.batch_id ? 'active' : ''}>
              <div className="authorization-queue-seal"><FaFingerprint /><small>{shortHash(item.payload_hash)}</small></div>
              <div>
                <small>{item.source_kind === 'ACCOUNT_EXPLORER' ? 'Account decision' : 'Controlled batch'}</small>
                <strong>{item.batch_name}</strong>
                <p>{item.source_kind === 'ACCOUNT_EXPLORER' && Number(item.total_debit) === 0
                  ? `${item.selected_count} queue custody item${item.selected_count === 1 ? '' : 's'} / debit unchanged / maker ${item.submitted_by || item.created_by}`
                  : `${item.selected_count} debit${item.selected_count === 1 ? '' : 's'} / ${money(item.total_debit)} / maker ${item.submitted_by || item.created_by}`}</p>
                <time>{dateTime(item.submitted_at || item.updated_at)}</time>
              </div>
              <div className="authorization-queue-actions">
                <button type="button" onClick={() => openCommand('approve', undefined, item.batch_id)} disabled={!!busy}>
                  <FaUserCheck /> Review & approve
                </button>
                <button type="button" className="reject" onClick={() => openCommand('reject', undefined, item.batch_id)} disabled={!!busy} title="Reject sealed payload">
                  <FaBan /> Reject
                </button>
              </div>
            </article>
          ))}
          {!pendingAuthorizationBatches.length ? (
            <div className="authorization-queue-empty"><FaCheckCircle /><span><strong>Authorization queue is clear</strong><small>New maker submissions will appear here instantly.</small></span></div>
          ) : null}
        </div>
      </section>

      <section className="clearing-preview-deck">
        <div className="clearing-section-heading">
          <span>Selected sealed payload</span>
          {preview ? <code>{shortHash(preview.payload_hash)}</code> : null}
        </div>
        {!preview ? (
          <div className="clearing-zero-state compact">
            <FaLock />
            <h3>Select an authorization</h3>
            <p>Open a waiting handoff to inspect its exact Oracle before-state, authorized change, and intended after-state.</p>
          </div>
        ) : (
          <>
            <div className="execution-custody-line">
              <span><small>Finance</small><strong>{preview.finance_reference}</strong></span>
              <i />
              <span><small>Change</small><strong>{preview.change_reference}</strong></span>
              <i />
              <span><small>Maker</small><strong>{preview.submitted_by || 'Pending'}</strong></span>
              <i />
              <span><small>Checker</small><strong>{preview.approved_by || 'Awaiting decision'}</strong></span>
            </div>
            <div className="execution-preview-section">
              <div className="clearing-section-heading"><span>Exact physical mutations</span><strong>{preview.balance_mutations.length}</strong></div>
              <div className="mutation-ledger">
                {preview.balance_mutations.map((mutation) => (
                  <div key={`${mutation.row_id}-${mutation.column}`}>
                    <span className={`mutation-role ${mutation.role.toLowerCase()}`}>{mutation.role}</span>
                    <span><small>{mutation.external_account} / {mutation.currency}</small><strong>{mutation.internal_account}</strong></span>
                    <code>{mutation.row_id}</code>
                    <span className="mutation-equation">
                      <strong>{money(mutation.before)}</strong><i>- {money(mutation.delta)}</i><b>{money(mutation.after)}</b>
                    </span>
                  </div>
                ))}
                {!preview.balance_mutations.length ? (
                  <div className="mutation-ledger-empty">No ACNTBAL column changes. This authority is limited to an exact queue row.</div>
                ) : null}
              </div>
            </div>
            <div className="execution-preview-section">
              <div className="clearing-section-heading"><span>Queue rows in scope</span><strong>{preview.queue_deletions.length}</strong></div>
              <div className="queue-delete-ledger">
                {preview.queue_deletions.map((queue) => (
                  <div key={queue.fingerprint}>
                    <FaFingerprint />
                    <span><strong>{queue.rrn}</strong><small>STAN {queue.stan}</small></span>
                    <span><strong>{money(queue.amount)}</strong><small>+ {money(queue.charge)} charge</small></span>
                    <code>{queue.row_id}</code>
                  </div>
                ))}
                {!preview.queue_deletions.length ? <div className="queue-delete-empty">Physical-row authority only. No queue row deletion is included.</div> : null}
              </div>
            </div>
          </>
        )}
      </section>

      <aside className="clearing-execution-history">
        <div className="clearing-section-heading"><span>Committed custody</span><strong>{executions.length}</strong></div>
        <div className="execution-history-list">
          {executions.map((execution) => (
            <div key={execution.execution_id} className={`execution-history-row status-${execution.status.toLowerCase()}`}>
              <span className="execution-history-beacon" />
              <div>
                <strong>{execution.status.replace(/_/g, ' ')}</strong>
                <small>{execution.requested_by} / {dateTime(execution.created_at)}</small>
                <p>{execution.reason}</p>
                {execution.error_message ? <em>{execution.error_message}</em> : null}
              </div>
              {execution.status === 'COMMITTED' && isCustodyAdmin ? (
                <button type="button" onClick={() => openCommand('rollback', execution.execution_id)} title="Prepare compensating reversal">
                  <FaUndo />
                </button>
              ) : null}
            </div>
          ))}
          {!executions.length ? <div className="execution-history-empty">No Oracle execution has entered the custody ledger.</div> : null}
        </div>
      </aside>
    </div>
  );

  const renderGuide = () => <CustodyOperatingGuide origin={guideOrigin} onNavigate={setView} onDownload={downloadOperatingGuide} />;

  const renderAudit = () => {
    const intent = auditEvidence?.sealed_intent;
    const beforeState = canonicalExecutionBeforeState(auditEvidence?.execution);
    const hasBeforeState = beforeState.balanceRows.length > 0 || beforeState.queueRows.length > 0;
    const snapshots = uniqueSnapshots(auditEvidence?.snapshots || []);
    const intendedAccounts = new Set(intent?.balance_mutations.map((mutation) => mutation.external_account) || []);
    const snapshotAccounts = new Set(snapshots.map((snapshot) => String(snapshot.external_account || '')));
    const missingSnapshotAccounts = Array.from(intendedAccounts).filter((account) => !snapshotAccounts.has(account));
    const auditEvidenceLoading = Boolean(busy?.startsWith('audit-evidence-'));
    return (
      <section className="clearing-audit-workspace">
        <div className="clearing-audit-head">
          <div className="fine-div">
            <span className="clearing-kicker">Append-only custody chronology</span>
            <h2>Trace the decision, then open its proof</h2>
            <p>Time folds from year to day. Mutation, authorization, and verification events surface before routine custody activity.</p>
          </div>
          <form onSubmit={(event) => {
            event.preventDefault();
            void run('audit', async () => {
              setAudit(await clearingApi.listAudit(null, 150, auditQuery));
              setAuditEvidence(null);
              setSelectedAuditEventId(null);
              auditEvidenceRequest.current += 1;
            });
          }} className="clearing-audit-search">
            <FaSearch />
            <input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} aria-label="Search custody trail by account or RRN" placeholder="Account number or RRN" />
            <button type="submit" disabled={!!busy}>Search trail</button>
            <button type="button" className="icon" onClick={() => void run('audit', async () => {
              setAudit(await clearingApi.listAudit(null, 150, auditQuery));
              setAuditEvidence(null);
              setSelectedAuditEventId(null);
              auditEvidenceRequest.current += 1;
            })} title="Refresh trail"><FaSyncAlt /></button>
          </form>
        </div>
        <div className="custody-trail-tools">
          <div className="custody-trail-types" aria-label="Event category">{(['all','mutation','authorization','reconciliation','custody'] as const).map(kind=><button type="button" key={kind} aria-pressed={auditKind===kind} onClick={()=>setAuditKind(kind)}>{kind==='all'?'All events':auditPriorityLabel[kind]}</button>)}</div>
          <div className="custody-trail-dates"><label>From<input aria-label="Trail from date" type="date" value={auditFrom} max={auditTo||undefined} onChange={event=>setAuditFrom(event.target.value)}/></label><label>To<input aria-label="Trail to date" type="date" value={auditTo} min={auditFrom||undefined} onChange={event=>setAuditTo(event.target.value)}/></label><button className="secondary" type="button" onClick={()=>{setAuditKind('all');setAuditFrom('');setAuditTo('');}}>Reset filters</button></div>
          <div className="custody-trail-count"><span>{visibleAudit.length} of {audit.length} loaded events · latest records returned by the trail</span><div><button type="button" className="secondary" onClick={()=>{setAuditExpanded(true);setAuditExpansionRevision(value=>value+1);}}>Expand all</button><button type="button" className="secondary" onClick={()=>{setAuditExpanded(false);setAuditExpansionRevision(value=>value+1);}}>Collapse all</button></div></div>
        </div>
        <div className="clearing-audit-explorer">
          <div className="clearing-audit-tree" key={auditExpansionRevision}>
            {auditTimeline.map((year, yearIndex) => (
              <details key={year.key} open={auditExpanded ?? (yearIndex === 0)} className="audit-year">
                <summary><span>{year.key} <em>{year.label !== year.key ? year.label : ''}</em></span><small>{year.months.reduce((sum, month) => sum + month.weeks.reduce((weekSum, week) => weekSum + week.days.reduce((daySum, day) => daySum + day.events.length, 0), 0), 0)} events</small><FaChevronDown /></summary>
                <div>
                  {year.months.map((month, monthIndex) => (
                    <details key={month.key} open={auditExpanded ?? (yearIndex === 0 && monthIndex === 0)} className="audit-month">
                      <summary><span>{month.label}</span><small>{month.weeks.length} week{month.weeks.length === 1 ? '' : 's'}</small><FaChevronDown /></summary>
                      <div>
                        {month.weeks.map((week, weekIndex) => (
                          <details key={week.key} open={auditExpanded ?? (yearIndex === 0 && monthIndex === 0 && weekIndex === 0)} className="audit-week">
                            <summary><span>{week.label}</span><small>{week.days.length} active day{week.days.length === 1 ? '' : 's'}</small><FaChevronDown /></summary>
                            <div>
                              {week.days.map((day, dayIndex) => (
                                <details key={day.key} open={auditExpanded ?? (yearIndex === 0 && monthIndex === 0 && weekIndex === 0 && dayIndex === 0)} className="audit-day">
                                  <summary><span>{day.label}</span><small>{day.events.length}</small><FaChevronDown /></summary>
                                  <div className="audit-day-events">
                                    <div className="audit-day-columns"><span>Activity</span><span>Reference</span><span>Custodian</span><span>Time</span><span /></div>
                                    {day.events.map((event) => {
                                      const priority = auditPriority(event.event_type);
                                      const selected = selectedAuditEventId === event.audit_id;
                                      const details = event.details as Record<string, any>;
                                      const reference = details.external_account || details.rrn || shortHash(event.batch_id);
                                      return (
                                        <button
                                          type="button"
                                          key={event.audit_id}
                                          className={`audit-event priority-${priority} ${selected ? 'selected' : ''}`}
                                          onClick={() => inspectAuditEvent(event)}
                                        >
                                          <span className="audit-event-icon">
                                            {priority === 'mutation' ? <FaLock /> : priority === 'authorization' ? <FaUserCheck /> : priority === 'reconciliation' ? <FaSyncAlt /> : <FaShieldAlt />}
                                          </span>
                                          <span>
                                            <small>{auditPriorityLabel[priority]}</small>
                                            <strong>{auditEventTitle(event.event_type)}</strong>
                                          </span>
                                          <code>{reference}</code>
                                          <em>{event.actor}</em>
                                          <time>{new Date(event.occurred_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                                          <FaChevronRight />
                                        </button>
                                      );
                                    })}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
            {!visibleAudit.length ? <div className="clearing-audit-empty">{audit.length ? 'No loaded events match these filters. Reset the filters or search a different account or RRN.' : 'No custody events were returned for this search.'}</div> : null}
          </div>

          <aside className={`clearing-audit-evidence ${auditEvidence || auditEvidenceLoading ? 'has-evidence' : ''}`}>
            {auditEvidenceLoading ? (
              <AuditEvidenceSkeleton />
            ) : !auditEvidence ? (
              <div className="audit-evidence-zero">
                <FaFingerprint />
                <strong>Select a custody event</strong>
                <p>Open an event to inspect its sealed intention, authorization, reconciliation snapshot, and Oracle before-state.</p>
              </div>
            ) : (
              <>
                <header>
                  <div className="audit-evidence-title">
                    <span className={`audit-evidence-priority priority-${auditPriority(auditEvidence.event.event_type)}`}>
                      {auditPriorityLabel[auditPriority(auditEvidence.event.event_type)]}
                    </span>
                    <h3>{auditEventTitle(auditEvidence.event.event_type)}</h3>
                  </div>
                  <p>{auditEvidence.event.actor} / {dateTime(auditEvidence.event.occurred_at)}</p>
                  <code>{auditEvidence.event.execution_id || auditEvidence.event.reconciliation_id || auditEvidence.event.audit_id}</code>
                </header>

                {intent ? (
                  <section className="audit-intent-panel">
                    <div>
                      <small>Sealed intention</small>
                      <strong>{intent.balance_mutations.length
                        ? `${intent.balance_mutations.length} physical mutation${intent.balance_mutations.length === 1 ? '' : 's'}`
                        : `${intent.queue_deletions.length} queue-row removal${intent.queue_deletions.length === 1 ? '' : 's'}`}</strong>
                      <span>Payload {shortHash(intent.payload_hash)}</span>
                    </div>
                    <div className="audit-mutation-list">
                      {intent.balance_mutations.map((mutation) => (
                        <article key={`${mutation.row_id}-${mutation.currency}`}>
                          <span><small>Account</small><strong>{mutation.external_account}</strong></span>
                          <span><small>Currency row</small><strong>{mutation.currency}</strong></span>
                          <span><small>Before</small><strong>{money(mutation.before)}</strong></span>
                          <span className="mutation-delta"><small>{mutation.column === 'ACNTBAL_AC_DB_QUEUE_AMT' ? 'Queue adjustment' : 'Authorized debit'}</small><strong>-{money(mutation.delta)}</strong></span>
                          <span><small>Intended after</small><strong>{money(mutation.after)}</strong></span>
                        </article>
                      ))}
                    </div>
                    {intent.queue_deletions.length ? (
                      <details className="audit-record-drawer">
                        <summary>Queue rows authorized for deletion <strong>{intent.queue_deletions.length}</strong></summary>
                        <div>{intent.queue_deletions.map((row) => <code key={row.row_id}>{row.rrn} / {row.stan} / {money(Number(row.amount) + Number(row.charge))}</code>)}</div>
                      </details>
                    ) : null}
                  </section>
                ) : null}

                {auditEvidence.approvals.length ? (
                  <section className="audit-approval-chain">
                    <small>Authorization custody</small>
                    {auditEvidence.approvals.map((approval) => (
                      <article key={approval.approval_id}>
                        <span>{approval.status}</span>
                        <strong>{approval.reviewed_by || 'Awaiting checker'}</strong>
                        <p>Submitted by {approval.submitted_by}. {approval.review_note || 'No decision note recorded.'}</p>
                      </article>
                    ))}
                  </section>
                ) : null}

                {hasBeforeState ? (
                  <section className="audit-before-state">
                    <small>Oracle records captured before mutation</small>
                    <details className="audit-record-drawer">
                      <summary>
                        <span>Execution lock snapshot</span>
                        <code>{beforeState.balanceRows.length} balance / {beforeState.queueRows.length} queue</code>
                        <strong>Open records</strong>
                      </summary>
                      <div className="audit-record-content">
                        <EvidenceTable title="ACNTBAL before-state" value={beforeState.balanceRows} />
                        <EvidenceTable title="Queue before-state" value={beforeState.queueRows} />
                      </div>
                    </details>
                  </section>
                ) : null}

                {snapshots.length ? (
                  <section className="audit-before-state">
                    <small>Reconciliation snapshots</small>
                    {intent ? (
                      <div className={`audit-reconciliation-coverage ${missingSnapshotAccounts.length ? 'incomplete' : 'complete'}`}>
                        <FaFingerprint />
                        <span>
                          <strong>{missingSnapshotAccounts.length ? 'Checkpoint coverage needs attention' : 'Checkpoint matches the sealed intention'}</strong>
                          <small>
                            {missingSnapshotAccounts.length
                              ? `${missingSnapshotAccounts.length} intended account${missingSnapshotAccounts.length === 1 ? '' : 's'} are absent from this reconciliation checkpoint.`
                              : `All ${intendedAccounts.size} intended account${intendedAccounts.size === 1 ? '' : 's'} are represented.`}
                          </small>
                        </span>
                      </div>
                    ) : null}
                    {snapshots.map((snapshot, index) => (
                      <details className="audit-record-drawer" key={String(snapshot.snapshot_id || index)}>
                        <summary><span>{snapshot.external_account}</span><code>{snapshot.account_role}</code><strong>Open evidence</strong></summary>
                        <div className="audit-record-content">
                          <EvidenceTable title="Physical balance rows" value={snapshot.balance_rows} />
                          <EvidenceTable title="Queue evidence" value={snapshot.queue_rows} />
                          <EvidenceTable title="Resolution" value={snapshot.resolution} />
                        </div>
                      </details>
                    ))}
                  </section>
                ) : null}

                {!intent && !hasBeforeState && !snapshots.length ? (
                  <section className="audit-event-metadata"><small>Recorded event metadata</small><EvidenceFacts value={auditEvidence.event.details} /></section>
                ) : null}
              </>
            )}
          </aside>
        </div>
      </section>
    );
  };

  const viewItems: Array<{ id: WorkspaceView; label: string; detail: string; icon: React.ReactNode }> = [
    { id: 'control', label: 'Batch control', detail: 'Sealed debit instructions and transaction decisions', icon: <FaBalanceScale /> },
    { id: 'accounts', label: 'Account explorer', detail: 'Mappings, physical balances, and queue evidence', icon: <FaDatabase /> },
    { id: 'execution', label: 'Execution desk', detail: 'Sealed mutations, approvals, and reversal', icon: <FaLock /> },
    { id: 'audit', label: 'Custody trail', detail: 'Immutable human and system activity', icon: <FaHistory /> },
    { id: 'guide', label: 'Operating guide', detail: 'Procedures, stop rules, and complete custody flow', icon: <FaBook /> },
  ];

  return (
    <main className="clearing-workspace custody-refined">
      <header className="clearing-masthead">
        <div className="clearing-masthead-copy">
          <span className="clearing-kicker"><FaShieldAlt /> SentinelOps funds custody</span>
          <h1>Unauthorized debit clearing</h1>
          <p>Release proven unauthorized debits against the exact account, currency, amount, and queue evidence.</p>
        </div>
        <div className="clearing-safety-posture">
          <span className={`clearing-gate ${overview?.writes_enabled ? 'armed' : 'locked'}`}>
            {overview?.writes_enabled ? <FaLock /> : <FaShieldAlt />}
            <small>Oracle mutation gate</small>
            <strong>{overview?.writes_enabled ? 'Explicitly enabled' : 'Locked by default'}</strong>
          </span>
          <span>
            <small>Operator</small>
            <strong>{actor}</strong>
            <em>{userRole || 'read-only'}</em>
          </span>
          <button type="button" className="clearing-icon-button" onClick={() => void loadWorkspace()} disabled={loading || !!busy} title="Refresh clearing workspace">
            <FaSyncAlt />
          </button>
        </div>
      </header>

      <nav className="clearing-mode-rail" aria-label="Unauthorized clearing workspaces">
        {viewItems.map((item) => (
          <button
            type="button"
            key={item.id}
            className={view === item.id ? 'active' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => { if (item.id === 'guide') setGuideOrigin(view); setView(item.id); }}
          >
            <span className="clearing-mode-icon">{item.icon}</span>
            <span><strong>{item.label}</strong><small>{item.detail}</small></span>
          </button>
        ))}
      </nav>

      {view !== 'guide' && <div className="custody-context-help"><span>{view === 'control' ? 'Prepare · verify · submit' : view === 'accounts' ? 'Investigate · establish scope · prepare' : view === 'execution' ? 'Review · authorize · confirm outcome' : 'Find an event · inspect its proof'}</span><button type="button" onClick={() => { setGuideOrigin(view); setView('guide'); }}><FaBook /> Help with this workspace</button></div>}
      {error ? (
        <div className="clearing-error-banner">
          <FaExclamationTriangle />
          <span><strong>Clearing control interrupted</strong><small>{error}</small></span>
          <button type="button" onClick={() => setError(null)} title="Dismiss"><FaTimes /></button>
        </div>
      ) : null}

      {loading ? renderLoading() : view === 'control' ? renderControl() : view === 'accounts' ? renderAccounts() : view === 'execution' ? renderExecution() : view === 'audit' ? renderAudit() : renderGuide()}

      {importOpen ? (
        <div className="clearing-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setImportOpen(false)}>
          <section className="clearing-modal" role="dialog" aria-modal="true" aria-labelledby="clearing-import-title">
            <header >
              <span><FaFileImport /></span>
              <div className='fine-div'><small>Immutable source intake</small><h2 id="clearing-import-title">Open a Finance clearing batch</h2></div>
              <button type="button" onClick={() => setImportOpen(false)} title="Close"><FaTimes /></button>
            </header>
            <div className="clearing-modal-body">
              <div className="clearing-source-contract">
                <FaFingerprint />
                <p>Import one identifier per row. SentinelOps resolves the live debit evidence, then seals the source and every later decision.</p>
              </div>
              <div className="clearing-import-kind" role="group" aria-label="Identifier type">
                <button type="button" className={importIdentityKind === 'ACCOUNT' ? 'active' : ''} onClick={() => setImportIdentityKind('ACCOUNT')}>
                  <FaDatabase /><span><strong>Accounts</strong><small>Prepare all positive debit currency rows</small></span>
                </button>
                <button
                  type="button"
                  className={importIdentityKind === 'RRN' ? 'active' : ''}
                  onClick={() => setImportIdentityKind('RRN')}
                  disabled={!canSpecificRecordClear}
                  title={canSpecificRecordClear ? 'Import exact queue references' : 'Specific-record clearing is disabled for operators'}
                >
                  <FaFingerprint /><span><strong>RRNs</strong><small>Resolve one exact debit queue row each</small></span>
                </button>
              </div>
              <div className="clearing-source-schema">
                <div>
                  <span>
                    <small>Import contract</small>
                    <strong>One {importIdentityKind === 'ACCOUNT' ? 'account' : 'RRN'} per row</strong>
                  </span>
                  <button type="button" onClick={downloadSourceTemplate}>
                    <FaDownload /> CSV template
                  </button>
                </div>
                <div className="clearing-source-columns">
                  <span className="critical">
                    <code>{importIdentityKind === 'ACCOUNT' ? 'Account' : 'RRN'}</code>
                    <small>The only column. Keep values formatted as text.</small>
                  </span>
                </div>
                <p>
                  {importIdentityKind === 'ACCOUNT'
                    ? 'Each account is resolved to its physical ACNTBAL currency rows. Ambiguous mappings stop the import.'
                    : 'Each RRN must resolve to exactly one debit queue row. Ambiguous or credit-only matches stop the import.'}
                </p>
              </div>
              <label>
                <span>Batch name</span>
                <input value={batchName} onChange={(event) => setBatchName(event.target.value)} placeholder="EcoCash unauthorized clearing / July" />
              </label>
              <label>
                <span>Finance reference</span>
                <input value={financeReference} onChange={(event) => setFinanceReference(event.target.value)} placeholder="FIN / email / approval reference" />
              </label>
              <label className={`clearing-file-drop ${sourceFile ? 'has-file' : ''}`}>
                <input type="file" accept=".csv,.xlsx,.xlsm" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} />
                <FaFileImport />
                <span>
                  <strong>{sourceFile?.name || 'Select CSV or XLSX'}</strong>
                  <small>{sourceFile ? `${Math.ceil(sourceFile.size / 1024)} KB ready to seal` : `Single column: ${importIdentityKind === 'ACCOUNT' ? 'Account' : 'RRN'}`}</small>
                </span>
              </label>
            </div>
            <footer>
              <button type="button" className="secondary" onClick={() => setImportOpen(false)}>Cancel</button>
              <button type="button" onClick={() => void handleImport()} disabled={!sourceFile || batchName.trim().length < 3 || financeReference.trim().length < 2 || !!busy}>
                <FaLock /> {busy === 'import' ? 'Resolving identifiers...' : 'Create controlled batch'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {command ? (
        <div className="clearing-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCommand(null)}>
          <section className="clearing-modal clearing-command-modal" role="dialog" aria-modal="true" aria-labelledby="clearing-command-title">
            <header>
              <span>{command === 'rollback' ? <FaUndo /> : command === 'reject' ? <FaBan /> : <FaUserCheck />}</span>
              <div className='new-fine-div'>
                <small>SentinelOps custody handoff</small>
                <h2 id="clearing-command-title">
                  {command === 'submit' ? 'Submit exact selection' : command === 'approve' ? 'Approve and commit' : command === 'reject' ? 'Reject sealed payload' : 'Compensating reversal'}
                </h2>
              </div>
              <button type="button" onClick={() => setCommand(null)} title="Close"><FaTimes /></button>
            </header>
            <div className="clearing-modal-body">
              {(command === 'approve' || command === 'reject') && preview ? (
                <section className="clearing-approval-evidence">
                  <header>
                    <span><FaFingerprint /> Sealed payload {shortHash(preview.payload_hash)}</span>
                    <strong>{preview.balance_mutations.length
                      ? `${preview.balance_mutations.length} intended physical mutation${preview.balance_mutations.length === 1 ? '' : 's'}`
                      : `${preview.queue_deletions.length} intended queue-row removal${preview.queue_deletions.length === 1 ? '' : 's'}`}</strong>
                  </header>
                  <p>Review the live row before-state, exact authorized operation, and intended after-state before recording a checker decision.</p>
                  <div>
                    {preview.balance_mutations.map((mutation) => (
                      <article key={`${mutation.row_id}-${mutation.currency}`}>
                        <span><small>Account</small><strong>{mutation.external_account}</strong></span>
                        <span><small>Currency</small><strong>{mutation.currency}</strong></span>
                        <span><small>Before</small><strong>{money(mutation.before)}</strong></span>
                        <span className="mutation-delta"><small>{mutation.column === 'ACNTBAL_AC_DB_QUEUE_AMT' ? 'Queue adjustment' : 'Authorized debit'}</small><strong>-{money(mutation.delta)}</strong></span>
                        <span><small>After</small><strong>{money(mutation.after)}</strong></span>
                      </article>
                    ))}
                  </div>
                  {preview.queue_deletions.length ? <small>{preview.queue_deletions.length} exact debit queue row{preview.queue_deletions.length === 1 ? '' : 's'} will be deleted.</small> : <small>No queue row deletion is included in this payload.</small>}
                </section>
              ) : null}
              {command === 'submit' ? (
                <label>
                  <span>Change reference</span>
                  <input value={changeReference} onChange={(event) => setChangeReference(event.target.value)} placeholder="Approved production change reference" />
                </label>
              ) : null}
              <label>
                <span>{command === 'reject' ? 'Rejection reason' : command === 'approve' ? 'Checker note' : 'Reason and evidence reference'}</span>
                <textarea
                  value={commandNote}
                  onChange={(event) => setCommandNote(event.target.value)}
                  placeholder={
                    command === 'rollback'
                        ? 'State why the committed execution must be compensated...'
                        : command === 'reject'
                          ? 'State precisely why this sealed payload must return to the maker...'
                        : 'Record the decision context...'
                  }
                  rows={5}
                />
              </label>
              {command === 'approve' ? (
                <div className="clearing-execute-warning">
                  <FaLock />
                  <p>Approval immediately starts the guarded mutation. SentinelOps locks and revalidates every sealed Oracle row; any mismatch rolls back the complete payload.</p>
                </div>
              ) : null}
              {command === 'reject' ? (
                <div className="clearing-execute-warning rejection">
                  <FaBan />
                  <p>Rejection records this checker decision and its reason, returns the batch to the maker, and does not execute any Oracle mutation.</p>
                </div>
              ) : null}
              {command === 'rollback' ? (
                <div className="clearing-execute-warning reversal">
                  <FaUndo />
                  <p>Reversal is allowed only when current balances still match the committed after-images and no queue transaction has reappeared.</p>
                </div>
              ) : null}
            </div>
            <footer>
              <button type="button" className="secondary" onClick={() => setCommand(null)}>Cancel</button>
              <button
                type="button"
                className={command === 'approve' ? 'approve-command' : command === 'reject' ? 'reject-command' : ''}
                onClick={() => void executeCommand()}
                disabled={
                  !!busy ||
                  (command === 'submit' && changeReference.trim().length < 3) ||
                  ((command === 'approve' || command === 'reject') && commandNote.trim().length < 3) ||
                  (command === 'rollback' && commandNote.trim().length < 12)
                }
              >
                {command === 'rollback' ? <FaUndo /> : command === 'approve' ? <FaCheck /> : command === 'reject' ? <FaBan /> : <FaUserCheck />}
                {busy?.startsWith('command-') ? 'Working...' : command === 'submit' ? 'Transfer to checker' : command === 'approve' ? 'Approve and execute' : command === 'reject' ? 'Reject payload' : 'Commit reversal'}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </main>
  );
};

export default UnauthorizedClearingWorkspace;
