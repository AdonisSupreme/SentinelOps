// src/components/notifications/NotificationCenter.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBell,
  FaCalendarAlt,
  FaCheckCircle,
  FaChevronRight,
  FaClipboardCheck,
  FaExclamationTriangle,
  FaFlag,
  FaInfoCircle,
  FaRedo,
  FaTimes,
} from 'react-icons/fa';
import { useNotifications } from '../../contexts/NotificationContext';
import './NotificationCenter.css';

const NotificationCenter: React.FC = () => {
  const {
    notifications,
    popupNotifications,
    unreadCount,
    browserPermission,
    markAsRead,
    markAllAsRead,
    loadNotifications,
    removeNotification,
    requestBrowserPermission,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showNewBadge, setShowNewBadge] = useState(false);
  const centerRef = useRef<HTMLDivElement>(null);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const navigate = useNavigate();

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort(
        (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
      ),
    [notifications]
  );

  useEffect(() => {
    const currentIds = new Set(sortedNotifications.map((notification) => notification.id));
    const knownIds = knownNotificationIdsRef.current;
    const hasNewNotification = sortedNotifications.some(
      (notification) => !knownIds.has(notification.id)
    );

    if (knownIds.size > 0 && hasNewNotification) {
      setShowNewBadge(true);
      const timerId = window.setTimeout(() => setShowNewBadge(false), 2600);
      knownNotificationIdsRef.current = currentIds;
      return () => window.clearTimeout(timerId);
    }

    knownNotificationIdsRef.current = currentIds;
  }, [sortedNotifications]);

  useEffect(() => {
    if (isOpen) {
      setShowNewBadge(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (centerRef.current && !centerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const formatRelativeTime = useCallback((timestamp: Date) => {
    const deltaMs = Date.now() - timestamp.getTime();
    const seconds = Math.floor(deltaMs / 1000);

    if (seconds < 60) return 'now';

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;

    return timestamp.toLocaleDateString();
  }, []);

  const getNotificationIcon = useCallback((type: string) => {
    switch (type) {
      case 'success':
        return <FaCheckCircle />;
      case 'warning':
        return <FaExclamationTriangle />;
      case 'error':
        return <FaExclamationTriangle />;
      case 'checklist':
        return <FaClipboardCheck />;
      case 'handover':
        return <FaFlag />;
      case 'reminder':
        return <FaCalendarAlt />;
      default:
        return <FaInfoCircle />;
    }
  }, []);

  const getEyebrow = useCallback((type: string) => {
    switch (type) {
      case 'success':
        return 'Success signal';
      case 'warning':
        return 'Warning';
      case 'error':
        return 'Critical alert';
      case 'checklist':
        return 'Checklist activity';
      case 'handover':
        return 'Handover note';
      case 'reminder':
        return 'Reminder';
      default:
        return 'Operations update';
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadNotifications();
    } finally {
      window.setTimeout(() => setIsRefreshing(false), 180);
    }
  }, [loadNotifications]);

  const handleMarkAllAsRead = useCallback(async () => {
    await markAllAsRead();
  }, [markAllAsRead]);

  const handleEnableDesktopAlerts = useCallback(async () => {
    try {
      await requestBrowserPermission();
    } catch (error) {
      console.error('Failed to request desktop notification permission:', error);
    }
  }, [requestBrowserPermission]);

  const getNotificationAction = useCallback(
    (notification: {
      relatedId?: string;
      relatedType?: string;
    }) => {
      const relatedType = (notification.relatedType || '').toLowerCase();

      if (
        notification.relatedId &&
        ['checklist_manager_review', 'checklist_manager_alert', 'checklist_instance'].includes(relatedType)
      ) {
        return {
          label: 'Open checklist',
          onClick: () => navigate(`/checklist/${notification.relatedId}`),
        };
      }

      if (notification.relatedId && relatedType === 'task') {
        return {
          label: 'Open task',
          onClick: () => navigate(`/tasks?task=${notification.relatedId}`),
        };
      }

      if (notification.relatedId && relatedType === 'network_service') {
        return {
          label: 'Open outage timeline',
          onClick: () => navigate(`/network-sentinel?service=${notification.relatedId}&tab=timeline`),
        };
      }

      if (relatedType === 'schedule') {
        return {
          label: 'Open schedule',
          onClick: () => navigate('/schedule'),
        };
      }

      if (relatedType === 'performance_badge') {
        return {
          label: 'Open Badge Forge',
          onClick: () => navigate('/performance#badge-forge'),
        };
      }

      return null;
    },
    [navigate]
  );

  const activePopupNotification = popupNotifications[0];
  const queuedPopupCount = Math.max(0, popupNotifications.length - 1);
  const popupAction = activePopupNotification ? getNotificationAction(activePopupNotification) : null;

  return (
    <div className="notification-center-wrapper" ref={centerRef}>
      <button
        className={`notification-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => {
          const nextOpen = !isOpen;
          setIsOpen(nextOpen);
          if (nextOpen) {
            if (browserPermission === 'default') {
              void requestBrowserPermission();
            }
            void loadNotifications();
          }
        }}
        aria-label="Open notifications"
        aria-expanded={isOpen}
        type="button"
      >
        <span className="notification-trigger-shell">
          <FaBell className="trigger-icon" />
          <span className="trigger-pulse" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="trigger-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </span>
      </button>

      {activePopupNotification && !isOpen && (
        <div className={`notification-live-toast type-${activePopupNotification.type}`} aria-live="polite">
          <div className="notification-live-toast-icon">
            {getNotificationIcon(activePopupNotification.type)}
          </div>
          <div className="notification-live-toast-body">
            <div className="notification-live-toast-header">
              <span className="notification-live-toast-eyebrow">
                {activePopupNotification.title || getEyebrow(activePopupNotification.type)}
              </span>
              <button
                className="notification-live-toast-close"
                onClick={() => removeNotification(activePopupNotification.id)}
                aria-label="Dismiss notification popup"
                type="button"
              >
                <FaTimes />
              </button>
            </div>
            <p className="notification-live-toast-message">{activePopupNotification.message}</p>
            <div className="notification-live-toast-footer">
              <span className={`notification-priority-chip priority-${activePopupNotification.priority}`}>
                {activePopupNotification.priority}
              </span>
              {queuedPopupCount > 0 && (
                <span className="notification-live-toast-queue">
                  +{queuedPopupCount} more
                </span>
              )}
              {popupAction && (
                <button
                  className="notification-live-toast-action"
                  onClick={popupAction.onClick}
                  type="button"
                >
                  {popupAction.label}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewBadge && !isOpen && popupNotifications.length === 0 && (
        <div className="notification-new-toast" aria-live="polite">
          <span className="notification-new-toast-orb" aria-hidden="true" />
          <span>New notification</span>
        </div>
      )}

      {isOpen && (
        <div className="notification-center-panel">
          <div className="notification-panel-glow" aria-hidden="true" />

          <div className="notification-center-header">
            <div className="notification-center-title">
              <span className="notification-center-kicker">Mission inbox</span>
              <h3>Notification Center</h3>
              <p>Live operational signals for your queue, team movement, and checklist flow.</p>
            </div>
            <button
              className="notification-dismiss-panel"
              onClick={() => setIsOpen(false)}
              aria-label="Close notification center"
              type="button"
            >
              <FaTimes />
            </button>
          </div>

          <div className="notification-center-summary">
            <div className="notification-summary-card">
              <span className="summary-label">Unread</span>
              <strong>{unreadCount}</strong>
              <span className="summary-copy">Awaiting acknowledgement</span>
            </div>
            <div className="notification-summary-card">
              <span className="summary-label">Visible</span>
              <strong>{sortedNotifications.length}</strong>
              <span className="summary-copy">Active in this session</span>
            </div>
          </div>

          <div className="notification-center-actions">
            <button
              className="notification-action secondary"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              type="button"
            >
              <FaRedo className={isRefreshing ? 'spinning' : ''} />
              {isRefreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              className="notification-action primary"
              onClick={() => void handleMarkAllAsRead()}
              disabled={sortedNotifications.length === 0}
              type="button"
            >
              <FaCheckCircle />
              Mark all read
            </button>
            {browserPermission !== 'granted' && browserPermission !== 'unsupported' && (
              <button
                className="notification-action secondary"
                onClick={() => void handleEnableDesktopAlerts()}
                type="button"
              >
                <FaBell />
                Enable desktop alerts
              </button>
            )}
          </div>

          <div className="notification-center-list">
            {sortedNotifications.length === 0 ? (
              <div className="notification-empty-state">
                <div className="notification-empty-icon">
                  <FaBell />
                </div>
                <h4>All clear</h4>
                <p>No active notifications are waiting for you right now.</p>
              </div>
            ) : (
              sortedNotifications.map((notification) => {
                const notificationAction = getNotificationAction(notification);

                return (
                <article
                  key={notification.id}
                  className={`notification-center-item type-${notification.type} ${
                    notification.read ? 'read' : 'unread'
                  }`}
                >
                  <div className="notification-item-icon">
                    {getNotificationIcon(notification.type)}
                  </div>

                  <div className="notification-item-body">
                    <div className="notification-item-header">
                      <span className="notification-item-eyebrow">
                        {getEyebrow(notification.type)}
                      </span>
                      <span className="notification-item-time">
                        {formatRelativeTime(notification.timestamp)}
                      </span>
                    </div>
                    {notification.title && (
                      <h4 className="notification-item-title">{notification.title}</h4>
                    )}
                    <p className="notification-item-message">{notification.message}</p>
                    {notificationAction && (
                      <button
                        className="notification-item-cta"
                        onClick={notificationAction.onClick}
                        type="button"
                      >
                        <FaCalendarAlt />
                        {notificationAction.label}
                      </button>
                    )}
                    <div className="notification-item-footer">
                      <span className={`notification-priority-chip priority-${notification.priority}`}>
                        {notification.priority}
                      </span>
                      <span className="notification-item-status">
                        <FaChevronRight />
                        Tap close to acknowledge
                      </span>
                    </div>
                  </div>

                  <div className="notification-item-actions">
                    <button
                      className="notification-item-close"
                      onClick={() => void markAsRead(notification.id)}
                      aria-label="Mark notification as read"
                      title="Mark as read"
                      type="button"
                    >
                      <FaTimes />
                    </button>
                  </div>
                </article>
              )})
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
