// hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useWebSocket = (url: string, onMessage: (data: any) => void) => {
  const wsRef = useRef<WebSocket | null>(null);
  const { token } = useAuth();
  
  useEffect(() => {
    if (!token) return;
    
    const socket = new WebSocket(`${url}?token=${token}`);
    
    socket.onopen = () => {
      console.log('WebSocket connected');
    };
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message', error);
      }
    };
    
    socket.onclose = () => {
      console.log('WebSocket disconnected');
    };
    
    wsRef.current = socket;
    
    return () => {
      socket.close();
    };
  }, [token, url, onMessage]);
  
  return {
    send: (data: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
      }
    }
  };
};