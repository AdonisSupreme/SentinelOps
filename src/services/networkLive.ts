export type NetworkConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline' | 'denied';

/** One stream per workspace, bounded reconnects, heartbeat watchdog and full cleanup. */
export function connectNetworkStream(
  url: string,
  onMessage: (message: { type: string; data?: any }) => void,
  onState: (state: NetworkConnectionState) => void,
) {
  let socket: WebSocket | null = null;
  let disposed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  let lastMessage = Date.now();
  const connect = () => {
    if (disposed) return;
    onState(attempts ? 'reconnecting' : 'connecting');
    const current = new WebSocket(url);
    socket = current;
    lastMessage = Date.now();
    current.onmessage = event => {
      if (disposed || socket !== current) return;
      try {
        const message = JSON.parse(event.data);
        if (!message || typeof message.type !== 'string') return;
        lastMessage = Date.now();
        attempts = 0;
        onState(message.type === 'ENGINE_OFFLINE' ? 'offline' : 'live');
        onMessage(message);
      } catch { /* Ignore malformed frames; the watchdog still detects a dead feed. */ }
    };
    current.onerror = () => current.close();
    current.onclose = event => {
      if (disposed || socket !== current) return;
      if (event.code === 1008) { onState('denied'); return; }
      onState('reconnecting');
      retry = setTimeout(connect, Math.min(30000, 1000 * 2 ** Math.min(attempts++, 5)));
    };
  };
  const watchdog = setInterval(() => {
    if (socket && socket.readyState !== WebSocket.CLOSED && Date.now() - lastMessage > 45000) socket.close();
  }, 5000);
  connect();
  return () => {
    disposed = true;
    clearTimeout(retry);
    clearInterval(watchdog);
    socket?.close();
  };
}
