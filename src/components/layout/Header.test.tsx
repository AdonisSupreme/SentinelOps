import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import Header from './Header';
const mockMarkRead = jest.fn();
const mockLogout = jest.fn();
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }), useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}), { virtual: true });
jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { username: 'operator', first_name: 'Test', last_name: 'Operator', role: 'admin' }, logout: mockLogout }) }));
jest.mock('../../contexts/AccessContext', () => ({ useAccess: () => ({ canAccessPage: (path: string) => !['/reports', '/team'].includes(path) }) }));
jest.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ theme: 'dark', setTheme: jest.fn() }) }));
jest.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({
  notifications: [
    { id: 'new', title: 'New task', message: 'Review assignment', timestamp: new Date(), type: 'info', priority: 'medium', read: false, relatedId: 'task-1', relatedType: 'task' },
    { id: 'read', title: 'Earlier update', message: 'Already acknowledged', timestamp: new Date(0), type: 'info', priority: 'low', read: true },
  ], popupNotifications: [], unreadCount: 1, browserPermission: 'granted', markAsRead: mockMarkRead, markAllAsRead: jest.fn(), loadNotifications: jest.fn(), removeNotification: jest.fn(), requestBrowserPermission: jest.fn(),
}) }));
beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(window, 'matchMedia', { writable: true, value: jest.fn().mockReturnValue({ matches: false }) });
});
const setup = () => render(<Header />);
test('workspace and operator menus preserve access filtering and navigation', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Toggle navigation menu' }));
  expect(screen.queryByRole('link', { name: /Reports/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Task Center/ })).toHaveAttribute('href', '/tasks');
  fireEvent.click(screen.getByRole('link', { name: /Task Center/ }));
  expect(screen.queryByRole('link', { name: /Task Center/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'User menu' }));
  expect(screen.queryByRole('link', { name: /Team Management/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Section & Module Access/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Logout/ }));
  expect(mockLogout).toHaveBeenCalledTimes(1);
});
test('unread filter and acknowledgement retain the correct notification identity', () => {
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
  expect(screen.getByText('Earlier update')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Unread 1' }));
  expect(screen.queryByText('Earlier update')).not.toBeInTheDocument();
  expect(screen.getByText('New task')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark notification as read' }));
  expect(mockMarkRead).toHaveBeenCalledWith('new');
  fireEvent.click(screen.getByRole('button', { name: 'Open task' }));
  expect(mockNavigate).toHaveBeenCalledWith('/tasks?task=task-1');
  expect(screen.queryByText('Notification Center')).not.toBeInTheDocument();
});
