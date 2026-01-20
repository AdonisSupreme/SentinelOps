// src/components/notifications/NotificationCenter.tsx
import React, { useState } from 'react';
import {
  FaBell,
  FaTimes,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaSignal,
  FaWifi,
  FaTimesCircle,
} from 'react-icons/fa';
import useNotifications from '../../hooks/useNotifications';
import './NotificationCenter.css';

/**
 * NotificationCenter Component
 * Displays connection status, unread notification count, and notification list
 * Supports mark as read, manual refresh, and debug info panel
 */
const NotificationCenter: React.FC = () => {
  const {
    unreadCount,
    notifications,
    isConnected,
    error,
    connectionState,
    getUnread,
    markAsRead,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const handleRefresh = () => {
    getUnread(20);
  };

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId);
  };

  const getConnectionStatusIcon = () => {
    if (isConnected) {
      return <FaWifi className="status-icon connected" />;
    }
    if (error) {
      return <FaTimesCircle className="status-icon error" />;
    }
    return <FaSignal className="status-icon connecting" />;
  };

  const getConnectionStatusText = () => {
    if (isConnected) {
      return 'Connected';
    }
    if (error) {
      return `Disconnected: ${error}`;
    }
    return `${connectionState}...`;
  };

  const getNotificationIcon = (notification: any) => {
    if (notification.type === 'success' || notification.related_entity === 'SUCCESS') {
      return <FaCheckCircle className="notification-icon success" />;
    }
    if (notification.type === 'error' || notification.related_entity === 'ERROR') {
      return <FaExclamationTriangle className="notification-icon error" />;
    }
    if (notification.type === 'warning' || notification.related_entity === 'WARNING') {
      return <FaExclamationTriangle className="notification-icon warning" />;
    }
    return <FaInfoCircle className="notification-icon info" />;
  };

  const formatTime = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="notification-center-wrapper">
      {/* Trigger Button */}
      <button
        className={`notification-trigger ${isConnected ? 'connected' : 'disconnected'}`}
        onClick={() => setIsOpen(!isOpen)}
        title={getConnectionStatusText()}
        aria-label="Toggle notifications"
      >
        <FaBell className="trigger-icon" />
        {unreadCount > 0 && <span className="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        <span className="status-dot" style={{ backgroundColor: isConnected ? '#4caf50' : '#ff9800' }}></span>
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="notification-center">
          {/* Header */}
          <div className="notification-header">
            <div className="header-title">
              <h4>Notifications</h4>
              <span className="unread-badge">{unreadCount} unread</span>
            </div>
            <button
              className="close-btn"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <FaTimes />
            </button>
          </div>

          {/* Connection Status */}
          <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
            {getConnectionStatusIcon()}
            <span className="status-text">{getConnectionStatusText()}</span>
          </div>

          {/* Error Display */}
          {error && !isConnected && (
            <div className="error-banner">
              <FaExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

          {/* Notifications List */}
          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="empty-state">
                <FaBell className="empty-icon" />
                <p>No notifications</p>
                {isConnected && <p className="empty-hint">You're all caught up!</p>}
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                >
                  <div className="notification-icon-wrapper">
                    {getNotificationIcon(notification)}
                  </div>
                  <div className="notification-content">
                    <div className="notification-message">
                      {notification.message || notification.title || 'New notification'}
                    </div>
                    <div className="notification-meta">
                      <span className="notification-time">
                        {formatTime(notification.created_at || new Date())}
                      </span>
                      {!notification.is_read && <span className="unread-dot"></span>}
                    </div>
                  </div>
                  {!notification.is_read && (
                    <button
                      className="mark-read-btn"
                      onClick={() => handleMarkAsRead(notification.id)}
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <FaCheckCircle />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="notification-footer">
            <button
              className="refresh-btn"
              onClick={handleRefresh}
              disabled={!isConnected}
              title="Refresh notifications"
            >
              <FaSignal className="icon" />
              Refresh
            </button>
            <button
              className="debug-toggle-btn"
              onClick={() => setShowDebug(!showDebug)}
              title="Toggle debug info"
            >
              Debug
            </button>
          </div>

          {/* Debug Info */}
          {showDebug && (
            <div className="debug-panel">
              <h5>Debug Info</h5>
              <div className="debug-content">
                <p><strong>Connection State:</strong> {connectionState}</p>
                <p><strong>Is Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
                <p><strong>Unread Count:</strong> {unreadCount}</p>
                <p><strong>Total Cached:</strong> {notifications.length}</p>
                {error && <p><strong>Error:</strong> {error}</p>}
                <p><strong>Token:</strong> {localStorage.getItem('token') ? '✓ Present' : '✗ Missing'}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
