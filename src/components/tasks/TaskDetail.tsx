import React, { useEffect, useState, useRef, useCallback } from 'react';
import { taskApi, Task } from '../../services/taskApi';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { FaThLarge, FaComment, FaHistory, FaTimes } from 'react-icons/fa';
import './TaskDetail.css';

interface Props {
  taskId: string;
  onClose: () => void;
  onRefresh?: () => void;
  onRequestHistory?: (historyEntries: any[]) => void;
}

const statusLabel = (s?: string) => s || 'Unknown';

const TaskDetail: React.FC<Props> = ({ taskId, onClose, onRefresh, onRequestHistory }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [commentText, setCommentText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await taskApi.getTask(taskId);
      setTask(data);
    } catch (err) {
      console.error('Failed to load task detail', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  const getAssignedName = (t: any) => {
    if (!t) return '';
    if (t.assigned_to) return `${t.assigned_to.first_name || ''} ${t.assigned_to.last_name || ''}`.trim();
    if (t.assigned_to_first_name || t.assigned_to_last_name) return `${t.assigned_to_first_name || ''} ${t.assigned_to_last_name || ''}`.trim();
    if (t.assigned_to_username) return t.assigned_to_username;
    return '';
  };

  useEffect(() => { load(); }, [load]);

  const TaskDetailSkeleton: React.FC = () => (
    <div className="ts-td-modal-backdrop" onClick={onClose}>
      <div className="ts-td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="td-header">
          <div className="td-title">
            <div className="td-skeleton">
              <div className="sk-line sk-title" />
              <div className="sk-line sk-sub" />
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div className="sk-pill" />
            <div style={{display:'flex', gap:8}}>
              <div className="sk-btn" />
              <div className="sk-btn" />
            </div>
            <button className="td-close" onClick={onClose}><FaThLarge className='tc-actn-icon'/></button>
          </div>
        </div>

        <div className="td-body">
          <div className="td-left">
            <div className="td-card sk-card">
              <div className="sk-line" style={{width:'70%'}} />
              <div className="sk-line" style={{width:'60%'}} />
              <div className="sk-line" style={{width:'50%'}} />
              <div className="sk-line" style={{width:'80%'}} />
            </div>

            <div className="td-card sk-card">
              <div className="sk-line sk-sub" style={{height:18,width:'40%'}} />
              <div className="sk-line" style={{height:14,width:'100%',marginTop:10}} />
              <div className="sk-line" style={{height:14,width:'90%'}} />
              <div className="sk-line" style={{height:14,width:'80%'}} />
            </div>
          </div>

          <div className="td-right">
            <div className="td-card sk-card">
              <div className="sk-line" style={{height:84}} />
              <div className="td-actions" style={{marginTop:10}}>
                <div className="sk-btn" />
                <div style={{flex:1}} />
                <div className="sk-btn" />
              </div>
            </div>

            <div className="td-card sk-card">
              <div className="sk-line sk-sub" style={{height:18,width:'30%'}} />
              <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:10}}>
                {Array.from({length:4}).map((_,i)=> <div key={i} className="sk-line" style={{height:14,width:`${90 - i*10}%`}} />)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleStatusAction = async (newStatus: string) => {
    if (!task) return;
    try {
      setLoading(true);
      await taskApi.changeTaskStatus(task.id, newStatus as any);
      await Promise.all([load(), Promise.resolve(onRefresh?.())]);
    } catch (err) {
      console.error('Failed to change status', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!task || task.status !== 'IN_PROGRESS') {
      console.warn('Comments are disabled unless task is IN_PROGRESS');
      return;
    }
    if (!commentText.trim()) return;
    try {
      await taskApi.addComment(taskId, commentText.trim());
      setCommentText('');
      await load();
    } catch (err) {
      console.error('Failed to add comment', err);
    }
  };

  const handleUpload = async () => {
    if (!task || task.status !== 'IN_PROGRESS') {
      console.warn('Attachment upload is disabled unless task is IN_PROGRESS');
      return;
    }
    if (!file) return;
    try {
      await taskApi.uploadAttachment(taskId, file);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      console.error('Failed to upload attachment', err);
    }
  };

  const formatBytes = (bytes: number | undefined) => {
    if (!bytes && bytes !== 0) return '—';
    const b = Number(bytes);
    if (b === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(1024));
    return `${(b / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleDownloadAttachment = async (att: any) => {
    try {
    const rawUrl = att.url || att.file_path || att.fileUrl;
      let downloadUrl = rawUrl;

      // If the backend stored a local filesystem path (Windows or file://), use backend proxy
      // Always route downloads through backend proxy to avoid client-side file:// issues
      if (task?.id && att.id) {
        const base = (api.defaults && api.defaults.baseURL) ? api.defaults.baseURL.replace(/\/$/, '') : '';
        downloadUrl = `${base}/api/v1/tasks/${task.id}/attachments/${att.id}/download`;
        console.log('Using backend proxy for attachment', { rawUrl, proxy: downloadUrl });
      }

      if (!downloadUrl) {
        console.warn('No URL available for attachment', att);
        return;
      }

      console.log('Downloading attachment', { att, downloadUrl });

      // Always fetch via XHR/fetch so we can include Authorization header and handle responses
      const token = localStorage.getItem('token');
      const headers: any = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const resp = await fetch(downloadUrl, { credentials: 'include', headers });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw new Error(`Failed to fetch attachment: ${resp.status} ${resp.statusText} ${txt || ''}`);
      }
      const blob = await resp.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = att.filename || (downloadUrl.split('/').pop() || 'attachment');
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to download attachment', err);
    }
  };

  const computeFormattedEntries = () => {
    const comments = task?.comments || [];
    const history = task?.history || [];

    const entries: any[] = [];
    const TS_TOLERANCE_MS = 5000; // 5 seconds tolerance for matching timestamps

    const parseJSONSafe = (v: any) => {
      if (!v) return null;
      if (typeof v === 'object') return v;
      try {
        return JSON.parse(v);
      } catch (e) {
        return null;
      }
    };

    const fmtVal = (val: any) => {
      if (val === null || val === undefined) return '—';
      const isoDate = typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val);
      if (isoDate) return new Date(val).toLocaleString();
      return String(val);
    };

    const isDuplicate = (candidate: any) => {
      const candTs = candidate.timestamp ? new Date(candidate.timestamp).getTime() : 0;
      const candContent = candidate.content || candidate.summary || '';
      return entries.some((e) => {
        const eTs = e.timestamp ? new Date(e.timestamp).getTime() : 0;
        const eContent = e.content || e.summary || '';
        if (Math.abs(eTs - candTs) <= TS_TOLERANCE_MS && eContent && candContent && eContent === candContent) return true;
        // If both have ids and they match, treat as duplicate
        if (e.id && candidate.id && String(e.id) === String(candidate.id)) return true;
        return false;
      });
    };

    // Add comments first
    comments.forEach((c) => {
      const entry = {
        type: 'comment',
        id: c.id,
        timestamp: c.created_at,
        content: c.content,
        user: c.user || { username: c.username, first_name: c.first_name, last_name: c.last_name }
      };
      if (!isDuplicate(entry)) entries.push(entry);
    });

    // Process history entries
    history.forEach((h) => {
      const parsedNew = parseJSONSafe(h.new_values);
      const parsedOld = parseJSONSafe(h.old_values);

      // Comments recorded in history (some systems write comments into history instead of comments table)
      if (parsedNew && parsedNew.comment) {
        const content = parsedNew.comment;
        const entry = {
          type: 'comment',
          id: h.id,
          timestamp: h.timestamp,
          content,
          user: h.user || { username: h.username, first_name: h.first_name, last_name: h.last_name }
        };
        if (!isDuplicate(entry)) entries.push(entry);
        return;
      }

      const changes: string[] = [];
      const keys = new Set<string>();
      if (parsedOld && typeof parsedOld === 'object') Object.keys(parsedOld).forEach(k => keys.add(k));
      if (parsedNew && typeof parsedNew === 'object') Object.keys(parsedNew).forEach(k => keys.add(k));

      keys.forEach((k) => {
        const oldV = parsedOld ? parsedOld[k] : undefined;
        const newV = parsedNew ? parsedNew[k] : undefined;
        if (oldV !== undefined && newV !== undefined) {
          if (String(oldV) !== String(newV)) {
            changes.push(`Changed ${k.replace(/_/g, ' ')} from ${fmtVal(oldV)} to ${fmtVal(newV)}`);
          }
        } else if (newV !== undefined) {
          changes.push(`Set ${k.replace(/_/g, ' ')} to ${fmtVal(newV)}`);
        } else if (oldV !== undefined) {
          changes.push(`Removed ${k.replace(/_/g, ' ')} (${fmtVal(oldV)})`);
        }
      });

      const summary = changes.length > 0 ? changes.join('; ') : (h.action || 'Updated');

      const entry = {
        type: 'history',
        id: h.id,
        timestamp: h.timestamp,
        action: h.action,
        summary,
        user: h.user || { username: h.username, first_name: h.first_name, last_name: h.last_name }
      };
      if (!isDuplicate(entry)) entries.push(entry);
    });

    const allEntries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const commentEntries = allEntries.filter(e => e.type === 'comment');
    const historyEntries = allEntries.filter(e => e.type === 'history');

    // Process attachments (if present on task) into a simple list
    const attachments = (task?.attachments || []).map((a: any) => ({
      id: a.id,
      filename: a.filename || a.file_name || a.name,
      file_path: a.file_path || a.filePath || a.url,
      url: a.url || a.file_path || a.fileUrl,
      file_size: a.file_size || a.size || a.file_size_bytes,
      mime_type: a.mime_type || a.mimeType || a.content_type,
      uploaded_by: a.uploaded_by || a.user || a.uploaded_by_user,
      uploaded_at: a.uploaded_at || a.created_at || a.timestamp
    }));

    // Avoid duplicates by id
    const uniqAttachments: any[] = [];
    const seen = new Set();
    attachments.forEach((att: any) => {
      const key = att.id || `${att.filename}-${att.file_path}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqAttachments.push(att);
      }
    });

    return { commentEntries, historyEntries, attachments: uniqAttachments };
  };

  if (loading && !task) return <TaskDetailSkeleton />;

  return (
    <div className="ts-td-modal-backdrop" onClick={onClose}>
      <div className="ts-td-modal" onClick={(e) => e.stopPropagation()}>
        <div className="td-header">
          <div className="td-title">
            <div>
              <h2>{task?.title || 'Task'}</h2>
              <div className="td-sub">{task?.id ? `#${task.id}` : ''}</div>
            </div>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div className={`td-pill td-status`}>{statusLabel(task?.status)}</div>
            {/* Action buttons: show based on status and permissions */}
            {task?.permissions && (task.permissions.can_edit || task.permissions.can_complete) && (
              <div style={{display:'flex', gap:8}}>
                {task.status === 'ACTIVE' && task.assigned_to_id === user?.id && (
                  <button className="tc-action-btn tc-start" onClick={() => handleStatusAction('IN_PROGRESS')} disabled={loading}>Start</button>
                )}
                {task.status === 'IN_PROGRESS' && task.assigned_to_id === user?.id && (
                  <>
                    <button className="tc-action-btn tc-complete" onClick={() => handleStatusAction('COMPLETED')} disabled={loading}>Complete</button>
                    <button className="tc-action-btn tc-hold" onClick={() => handleStatusAction('ON_HOLD')} disabled={loading}>Hold</button>
                  </>
                )}
                {task.status === 'ON_HOLD' && task.assigned_to_id === user?.id && (
                  <button className="tc-action-btn tc-resume" onClick={() => handleStatusAction('IN_PROGRESS')} disabled={loading}>Resume</button>
                )}
              </div>
            )}
            <button className="td-close" onClick={onClose}><FaThLarge className='tc-actn-icon'/></button>
          </div>
        </div>

        <div className="td-body">
          <div className="td-left">
            <div className="td-card td-meta">
              <div><strong>Assigned</strong><div className="td-small">{getAssignedName(task) || 'Unassigned'}</div></div>
              <div><strong>Priority</strong><div className="td-small">{task?.priority || 'Normal'}</div></div>
              <div><strong>Due</strong><div className="td-small">{task?.due_date ? new Date(task.due_date).toLocaleString() : '—'}</div></div>
              <div><strong>Tags</strong><div className="td-small">{(task as any)?.tags?.join(', ') || '—'}</div></div>
            </div>

            <div className="td-card td-desc">
              <h4>Description</h4>
              <p>{task?.description || 'No description'}</p>
            </div>
          </div>

          <div className="td-right">
            {task?.status === 'IN_PROGRESS' && (
              <div className="td-card td-interact">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment"
                />
                <div className="td-actions">
                  <button onClick={handleAddComment} className="td-btn">Add Comment</button>
                  <div style={{flex:1}} />
                  <input ref={fileInputRef} type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                  <button onClick={handleUpload} disabled={!file} className="td-btn">Upload</button>
                </div>
              </div>
            )}

            <div className="td-card td-timeline-wrapper">
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <h4 style={{margin:0}}>Timeline</h4>
                <div style={{flex:1}} />
                <button
                  className="td-btn"
                  onClick={() => {
                    const { historyEntries } = computeFormattedEntries();
                    if (onRequestHistory) {
                      onRequestHistory(historyEntries);
                    } else {
                      setShowHistory(true);
                    }
                  }}
                >
                  View History
                </button>
              </div>
              {loading ? <div>Loading…</div> : (() => {
                const { commentEntries } = computeFormattedEntries();
                if (!commentEntries || commentEntries.length === 0) return <div className="td-small">No comments yet</div>;
                return (
                  <div className="td-timeline">
                    {commentEntries.map((ev: any) => (
                      <div key={ev.id} className="td-event">
                        <div className="td-event-time">{new Date(ev.timestamp).toLocaleString()}</div>
                        <div className="td-event-content">
                          <strong>Comment</strong>
                          <div className="td-small">{ev.content}</div>
                          <div className="td-small">by {ev.user?.username || `${ev.user?.first_name || ''} ${ev.user?.last_name || ''}`}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="td-card td-attachments">
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <h4 style={{margin:0}}>Attachments</h4>
                <div style={{flex:1}} />
                <div className="td-small">{(task?.attachments?.length || 0)} files</div>
              </div>
              {(() => {
                const { attachments } = computeFormattedEntries();
                if (!attachments || attachments.length === 0) return <div className="td-small" style={{marginTop:8}}>No attachments</div>;
                return (
                  <div className="td-attachments-grid">
                    {attachments.map((att: any) => (
                      <div key={att.id || att.file_path} className="td-attachment-card">
                        <div className="td-attachment-header">
                          {att.mime_type && att.mime_type.startsWith && att.mime_type.startsWith('image/') ? (
                            <img src={att.url || att.file_path} alt={att.filename} className="td-attachment-thumb" />
                          ) : (
                            <div className="td-attachment-filebadge">
                              {(att.filename || '').split('.').pop()?.toUpperCase() || 'FILE'}
                            </div>
                          )}
                          <div className="td-attachment-meta">
                            <div className="td-attachment-filename" title={att.filename}>{att.filename}</div>
                            <div className="td-attachment-size">{formatBytes(att.file_size)}</div>
                          </div>
                        </div>
                        <div className="td-attachment-footer">
                          <div className="td-attachment-uploader td-small">{att.uploaded_by?.username || `${att.uploaded_by?.first_name || ''} ${att.uploaded_by?.last_name || ''}`}</div>
                          <div className="td-attachment-actions">
                            <button className="td-btn" onClick={() => handleDownloadAttachment(att)}>Download</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      {showHistory && (() => {
              const { historyEntries } = computeFormattedEntries();
              return (
                <div className="history-modal-backdrop" style={{zIndex:40}} onClick={() => setShowHistory(false)}>
                  <div className="history-modal" style={{width:'720px'}} onClick={e => e.stopPropagation()}>
                    <div className="td-header">
                      <div className="td-title"><h2>Task History</h2><div className="td-sub">{task?.id ? `#${task.id}` : ''}</div></div>
                      <div style={{display:'flex',gap:8,alignItems:'center'}}>
                        <button className="td-close" onClick={() => setShowHistory(false)}>×</button>
                      </div>
                    </div>
                    <div className="history-body">
                      <div style={{display:'flex',flexDirection:'column',gap:12}}>
                        {historyEntries.length === 0 ? (
                          <div className="td-small">No history events</div>
                        ) : (
                          historyEntries.map((ev: any) => (
                            <div key={ev.id} className="td-event">
                              <div className="td-event-time">{new Date(ev.timestamp).toLocaleString()}</div>
                              <div className="td-event-content">
                                <strong>{ev.action || 'Updated'}</strong>
                                <div className="td-small">{ev.summary}</div>
                                <div className="td-small">by {ev.user?.username || `${ev.user?.first_name || ''} ${ev.user?.last_name || ''}`}</div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
    </div>
  );
};

export default TaskDetail;
