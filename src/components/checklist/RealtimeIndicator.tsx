// src/components/checklist/RealtimeIndicator.tsx
import React, { useState, useEffect } from 'react';
import { FaWifi, FaTimesCircle } from 'react-icons/fa';
import websocketService from '../../services/websocketService';
import './RealtimeIndicator.css';

const RealtimeIndicator: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');

  useEffect(() => {
    // Set up connection monitoring
    const updateStatus = () => {
      const isConnected = websocketService.isConnected();
      const connectionState = websocketService.getConnectionState();
      
      setIsConnected(isConnected);
      
      if (connectionState === 'CONNECTING') {
        setStatus('connecting');
      } else if (connectionState === 'OPEN') {
        setStatus('connected');
      } else {
        setStatus('disconnected');
      }
    };

    // Set up event listeners
    websocketService.onConnectionChangeCallback((connected: boolean) => {
      setIsConnected(connected);
      setStatus(connected ? 'connected' : 'disconnected');
    });

    // Initial status check
    updateStatus();

    // Update status every 5 seconds
    const interval = setInterval(updateStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  const getStatusText = () => {
    switch (status) {
      case 'connected':
        return 'Real-time updates active';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Real-time updates paused';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return '#22c55e'; // Green
      case 'connecting':
        return '#f59e0b'; // Orange
      case 'disconnected':
        return '#ef4444'; // Red
      default:
        return '#64748b'; // Gray
    }
  };

  return (
    <div className="realtime-indicator">
      <div 
        className="realtime-status"
        style={{ color: getStatusColor() }}
        title={getStatusText()}
      >
        {isConnected ? (
          <FaWifi className="realtime-icon connected" />
        ) : (
          <FaTimesCircle className="realtime-icon disconnected" />
        )}
      </div>
    </div>
  );
};

export default RealtimeIndicator;
