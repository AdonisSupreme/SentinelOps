import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AdvancedTeamManagementPage from './AdvancedTeamManagementPage';
import { orgApi } from '../services/orgApi';
import { teamApi } from '../services/teamApi';
import { userApi } from '../services/userApi';
import { shiftSchedulingApi } from '../services/shiftSchedulingApi';

const mockNotify = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin', section_id: 'ops' } }) }));
jest.mock('../contexts/NotificationContext', () => ({ useNotifications: () => ({ addNotification: mockNotify }) }));
jest.mock('../components/ui/PageGuide', () => () => null);
jest.mock('../services/orgApi', () => ({ orgApi: { listSections: jest.fn() } }));
jest.mock('../services/teamApi', () => ({ teamApi: { listShifts: jest.fn(), listScheduledShifts: jest.fn(), createScheduledShift: jest.fn() } }));
jest.mock('../services/userApi', () => ({ userApi: { listUsersBySection: jest.fn() } }));
jest.mock('../services/shiftSchedulingApi', () => ({ shiftSchedulingApi: { listShiftPatterns: jest.fn(), getPatternDetails: jest.fn(), bulkAssignShifts: jest.fn() } }));
const pattern = { id: 'p1', name: 'Weekday operations', pattern_type: 'FIXED' };
beforeEach(() => {
  jest.clearAllMocks();
  (orgApi.listSections as jest.Mock).mockResolvedValue([{ id: 'other', section_name: 'Another section' }, { id: 'ops', section_name: 'ICT Operations' }]);
  (teamApi.listShifts as jest.Mock).mockResolvedValue([{ id: 1, name: 'Morning', start_time: '07:00', end_time: '15:00' }, { id: 2, name: 'Night', start_time: '23:00', end_time: '07:00' }]);
  (userApi.listUsersBySection as jest.Mock).mockResolvedValue([{ id: 'u1', first_name: 'Ada', last_name: 'One' }, { id: 'u2', first_name: 'Ben', last_name: 'Two' }]);
  (shiftSchedulingApi.listShiftPatterns as jest.Mock).mockResolvedValue([pattern]);
  (shiftSchedulingApi.getPatternDetails as jest.Mock).mockResolvedValue({ ...pattern, schedule: { Monday: { shift_name: 'Morning' } } });
  (teamApi.listScheduledShifts as jest.Mock).mockResolvedValue([{ id: 'a1', user_id: 'u1', shift_id: 1, date: '2026-10-05', status: 'scheduled' }, { id: 'a2', user_id: 'u2', shift_id: 2, date: '2026-10-05', status: 'scheduled' }]);
});

test('admin opens their own section and Smart Assignment loads its existing patterns', async () => {
  render(<AdvancedTeamManagementPage />);
  const scope = await screen.findByRole('combobox', { name: 'Section scope' });
  expect(scope).toHaveValue('ops');
  expect(shiftSchedulingApi.listShiftPatterns).toHaveBeenCalledWith('ops');
  fireEvent.click(screen.getByRole('button', { name: 'Smart assign' }));
  const dropdown = screen.getByRole('combobox', { name: /Pattern · ICT Operations/ });
  await waitFor(() => expect(dropdown).toBeEnabled());
  fireEvent.change(dropdown, { target: { value: 'p1' } });
  expect(await screen.findByText('Pattern Schedule Preview')).toBeInTheDocument();
  expect(within(screen.getByRole('dialog')).getByRole('option', { name: 'Weekday operations (FIXED)' })).toBeInTheDocument();
  expect(shiftSchedulingApi.bulkAssignShifts).not.toHaveBeenCalled();
});

test('custom dates reach the API and person/shift filters narrow only the view', async () => {
  render(<AdvancedTeamManagementPage />);
  await screen.findByRole('heading', { name: 'Team schedule' });
  fireEvent.click(screen.getByRole('button', { name: 'Custom dates' }));
  fireEvent.change(screen.getByLabelText('Schedule from date'), { target: { value: '2026-10-05' } });
  fireEvent.change(screen.getByLabelText('Schedule through date'), { target: { value: '2026-10-09' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply dates' }));
  await waitFor(() => expect(teamApi.listScheduledShifts).toHaveBeenLastCalledWith({ section_id: 'ops', start_date: '2026-10-05', end_date: '2026-10-09' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Team member' }), { target: { value: 'u1' } });
  expect(screen.getByText('1 matching assignments')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Shift' }), { target: { value: '2' } });
  expect(await screen.findByText('No assignments match these filters')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(screen.getByText('2 matching assignments')).toBeInTheDocument();
  expect(teamApi.createScheduledShift).not.toHaveBeenCalled();
});

test('failed pattern requests offer retry rather than pretending no patterns exist', async () => {
  const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
  (shiftSchedulingApi.listShiftPatterns as jest.Mock).mockRejectedValue(new Error('Offline'));
  render(<AdvancedTeamManagementPage />);
  fireEvent.click(await screen.findByRole('button', { name: 'Smart assign' }));
  const modal = within(screen.getByRole('dialog'));
  await waitFor(() => expect(modal.getByRole('alert')).toHaveTextContent('could not be loaded'));
  (shiftSchedulingApi.listShiftPatterns as jest.Mock).mockResolvedValue([pattern]);
  fireEvent.click(modal.getByRole('button', { name: 'Retry patterns' }));
  await waitFor(() => expect(modal.getByRole('combobox')).toBeEnabled());
  expect(modal.queryByRole('alert')).not.toBeInTheDocument();
  quiet.mockRestore();
});
