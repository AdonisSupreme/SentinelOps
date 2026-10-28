import { NEXUS_API_BASE_URL } from '../config/env';

export type SmsLiveMode = 'connecting' | 'realtime' | 'polling' | 'unavailable' | 'unconfigured';
export type SmsChange = {revision: number; mode: SmsLiveMode};

// Fetch streaming supports Authorization headers; credentials never enter a URL.
export function subscribeSmsEvents(onChange: (change: SmsChange) => void, onMode: (mode: SmsLiveMode) => void) {
  let stopped = false;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let backoff = 500;
  let attempted = false;
  const connect = async () => {
    if (stopped || document.hidden) return;
    controller = new AbortController();
    const active = controller;
    if (!attempted) onMode('connecting');
    attempted = true;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      watchdog = setTimeout(() => active.abort(), 12000);
      const token = localStorage.getItem('token');
      const response = await fetch(`${NEXUS_API_BASE_URL || ''}/api/v1/nexus/reports/sms/events`, {
        headers: {Authorization:`Bearer ${token || ''}`, Accept:'text/event-stream'},
        signal:active.signal, cache:'no-store',
      });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('SMS stream unavailable');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!stopped && !active.signal.aborted) {
        clearTimeout(watchdog);
        watchdog = setTimeout(() => active.abort(), 12000);
        const {done, value} = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, {stream:true});
        buffer = buffer.replace(/\r\n/g, '\n');
        let boundary: number;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0,boundary); buffer = buffer.slice(boundary+2);
          const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
          if (!data) continue;
          const change = JSON.parse(data) as SmsChange;
          if (!Number.isFinite(change.revision) || !['connecting','realtime','polling','unavailable','unconfigured'].includes(change.mode)) throw new Error('Invalid SMS event');
          if (stopped || active.signal.aborted) break;
          backoff = 500; onMode(change.mode); onChange(change);
        }
        if (buffer.length > 8192) throw new Error('Invalid SMS frame');
      }
    } catch {
      if (!stopped && !document.hidden) onMode('unavailable');
      backoff = Math.min(backoff * 2, 5000);
    } finally {
      clearTimeout(watchdog);
      if (reader) { try { await reader.cancel(); } catch { /* already disconnected */ } }
      if (!stopped && !document.hidden && controller === active) timer = setTimeout(connect, backoff);
    }
  };
  const visibility = () => {
    clearTimeout(timer); controller?.abort();
    if (!document.hidden) void connect();
  };
  document.addEventListener('visibilitychange', visibility);
  void connect();
  return () => { stopped = true; clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibility); };
}
