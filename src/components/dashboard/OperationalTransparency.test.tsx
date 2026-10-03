import React from 'react';
import { render, screen } from '@testing-library/react';
import OperationalTransparency from './OperationalTransparency';
import clearingApi from '../../services/clearingApi';
import reportsApi from '../../services/reportsApi';
jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a> }), { virtual: true });
const mockCanAccess = jest.fn((module?: string) => true);
jest.mock('../../contexts/AccessContext', () => ({ useAccess: () => ({ canAccessModule: mockCanAccess }), ModuleAccess: ({ module, children }: any) => mockCanAccess(module) ? children : null }));
jest.mock('../../services/clearingApi', () => ({ __esModule: true, default: { overview: jest.fn() } }));
jest.mock('../../services/reportsApi', () => ({ __esModule: true, default: { getHoveringOverview: jest.fn() } }));
jest.mock('../../services/centralizedWebSocketManager', () => ({ __esModule: true, default: { subscribe: () => () => {} } }));
beforeEach(() => { jest.clearAllMocks(); mockCanAccess.mockReturnValue(true); });
test('compact indicators retain counts, source failures and the correct workspace links', async () => {
  (clearingApi.overview as jest.Mock).mockResolvedValue({ awaiting_approval: 4, open_batches: 6, writes_enabled: true });
  (reportsApi.getHoveringOverview as jest.Mock).mockResolvedValue({ configured: true, source_error: 'Connection timed out', movement: { posture: 'OBSERVING' } });
  render(<OperationalTransparency />);
  expect(await screen.findByText('4 awaiting authorization')).toBeInTheDocument();
  expect(screen.getByText('Source unavailable')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Authorization desk/ })).toHaveAttribute('href', '/funds-custody?workspace=execution');
  expect(screen.getByRole('link', { name: /Loan hovering/ })).toHaveAttribute('href', '/reports?workspace=hovering');
  expect(screen.queryByText('Observing movement')).not.toBeInTheDocument();
});
test('no operational data is requested without module access', () => {
  mockCanAccess.mockReturnValue(false);
  render(<OperationalTransparency />);
  expect(clearingApi.overview).not.toHaveBeenCalled();
  expect(reportsApi.getHoveringOverview).not.toHaveBeenCalled();
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
});
