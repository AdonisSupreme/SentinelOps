import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import UnauthorizedClearingWorkspace from './UnauthorizedClearingWorkspace';
import clearingApi from '../../services/clearingApi';

jest.mock('../../contexts/NotificationContext', () => ({ useNotifications: () => ({ addNotification: jest.fn() }) }));
jest.mock('../../services/centralizedWebSocketManager', () => ({ __esModule: true, default: { subscribe: () => () => {} } }));
jest.mock('../../services/clearingApi', () => ({ __esModule: true, default: {
  overview: jest.fn().mockResolvedValue({ writes_enabled: false }),
  listBatches: jest.fn().mockResolvedValue([]),
  listExecutions: jest.fn().mockResolvedValue([]),
  listAudit: jest.fn().mockResolvedValue([
    { audit_id: 'one', event_type: 'execution_committed', actor: 'checker', occurred_at: '2026-09-12T12:00:00', details: {} },
    { audit_id: 'two', event_type: 'payload_rejected', actor: 'reviewer', occurred_at: '2026-09-11T12:00:00', details: {} },
  ]),
  getAuditEvidence: jest.fn().mockResolvedValue(null),
} }));

beforeEach(() => {
  (clearingApi.overview as jest.Mock).mockResolvedValue({ writes_enabled: false });
  (clearingApi.listBatches as jest.Mock).mockResolvedValue([]);
  (clearingApi.listExecutions as jest.Mock).mockResolvedValue([]);
  (clearingApi.listAudit as jest.Mock).mockResolvedValue([
    { audit_id: 'one', event_type: 'execution_committed', actor: 'checker', occurred_at: '2026-09-12T12:00:00', details: {} },
    { audit_id: 'two', event_type: 'payload_rejected', actor: 'reviewer', occurred_at: '2026-09-11T12:00:00', details: {} },
  ]);
});

test('trail filters loaded events by category and inclusive local date without reloading or mutating custody', async () => {
  render(<UnauthorizedClearingWorkspace actor="operator" userRole="admin" initialView="audit" />);
  await screen.findByText(/2 of 2 loaded events/);
  fireEvent.click(screen.getByRole('button', { name: 'Oracle mutation' }));
  expect(screen.getByText(/1 of 2 loaded events/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Trail from date'), { target: { value: '2026-09-13' } });
  expect(screen.getByText(/No loaded events match/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Trail from date'), { target: { value: '2026-09-12' } });
  fireEvent.change(screen.getByLabelText('Trail to date'), { target: { value: '2026-09-12' } });
  expect(screen.getByText(/1 of 2 loaded events/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
  expect(screen.getByText(/2 of 2 loaded events/)).toBeInTheDocument();
  expect(clearingApi.listAudit).toHaveBeenCalledTimes(1);
});

test('expand and collapse commands can be repeated after manually opening a branch', async () => {
  const { container } = render(<UnauthorizedClearingWorkspace actor="operator" userRole="admin" initialView="audit" />);
  await screen.findByText(/2 of 2 loaded events/);
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  expect(container.querySelector('details[open]')).toBeNull();
  const year = container.querySelector('details')!;
  year.open = true;
  fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
  await waitFor(() => expect(container.querySelector('details[open]')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
  expect(container.querySelectorAll('details:not([open])')).toHaveLength(0);
});
