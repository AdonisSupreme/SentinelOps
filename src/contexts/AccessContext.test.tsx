import { canOpenPage, pageModules } from './AccessContext';
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AccessProvider, ModuleAccess, PageAccess, useAccess } from './AccessContext';
import type { EffectiveAccess } from '../types/access';
import api from '../services/api';

let mockLocation = {pathname:'/reports',search:''};
let mockUser: {id:string;role:string;section_id:string;access?:EffectiveAccess};
let mockToken = 'valid';
const mockRefreshUser = jest.fn();
jest.mock('react-router-dom', () => ({useLocation: () => mockLocation}), {virtual:true});
jest.mock('./AuthContext', () => ({useAuth: () => ({user:mockUser,token:mockToken,refreshUser:mockRefreshUser})}));
jest.mock('../services/api', () => ({__esModule:true,default:{get:jest.fn()}}));
jest.mock('../components/layout/WorkspacePreview', () => ({WorkspacePreview: () => <div role="status">Workspace skeleton</div>}));

const granted: EffectiveAccess = {role:'USER',section:{id:'a',name:'A',is_active:true},modules:['reports.crb']};

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'valid';
  mockUser = {id:'test-user',role:'USER',section_id:'a'};
  mockLocation={pathname:'/reports',search:''};
  (api.get as jest.Mock).mockResolvedValue({data:{role:'USER',section:{id:'a',name:'A',is_active:true},modules:['reports.crb']}});
});

const Refresh = () => {
  const { refresh } = useAccess();
  return <button onClick={() => void refresh()}>Refresh access</button>;
};

test('sign-in permissions render immediately without a second access request', () => {
  mockUser.access = granted;
  render(<AccessProvider><PageAccess><p>Workspace ready</p></PageAccess></AccessProvider>);
  expect(screen.getByText('Workspace ready')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
});

test('unchanged refresh and transient failures preserve workspace input and shell', async () => {
  mockUser.access = granted;
  const shellMount = jest.fn();
  const workspaceMount = jest.fn();
  const Shell = () => { React.useEffect(shellMount, []); return <input aria-label="Shell state" defaultValue="initial" />; };
  const Workspace = () => { React.useEffect(workspaceMount, []); return <input aria-label="Draft" defaultValue="initial" />; };
  const tree = <AccessProvider><Shell /><Refresh /><PageAccess><Workspace /></PageAccess></AccessProvider>;
  const { rerender } = render(tree);
  fireEvent.change(screen.getByLabelText('Draft'), {target:{value:'keep my draft'}});
  mockUser = {...mockUser};
  rerender(<AccessProvider><Shell /><Refresh /><PageAccess><Workspace /></PageAccess></AccessProvider>);
  expect(api.get).not.toHaveBeenCalled();
  await act(async () => { fireEvent.click(screen.getByText('Refresh access')); });
  (api.get as jest.Mock).mockRejectedValueOnce(new Error('temporary outage'));
  await act(async () => { fireEvent.click(screen.getByText('Refresh access')); });
  expect(screen.getByLabelText('Draft')).toHaveValue('keep my draft');
  expect(workspaceMount).toHaveBeenCalledTimes(1);
  expect(shellMount).toHaveBeenCalledTimes(1);
  (api.get as jest.Mock).mockResolvedValueOnce({data:{...granted,modules:[]}});
  await act(async () => { fireEvent.click(screen.getByText('Refresh access')); });
  expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('403');
  expect(shellMount).toHaveBeenCalledTimes(1);
});

test('concurrent refreshes share one request', async () => {
  mockUser.access = granted;
  let resolve!: (value: unknown) => void;
  (api.get as jest.Mock).mockImplementation(() => new Promise(r => { resolve = r; }));
  render(<AccessProvider><Refresh /></AccessProvider>);
  fireEvent.click(screen.getByText('Refresh access'));
  fireEvent.click(screen.getByText('Refresh access'));
  expect(api.get).toHaveBeenCalledTimes(1);
  await act(async () => resolve({data:granted}));
});

test('late response from a previous session cannot restore its grants', async () => {
  let resolve!: (value: unknown) => void;
  (api.get as jest.Mock).mockImplementationOnce(() => new Promise(r => {resolve=r;}));
  const {rerender} = render(<AccessProvider><PageAccess><p>Protected workspace</p></PageAccess></AccessProvider>);
  mockToken = 'another-session';
  mockUser = {id:'another-user',role:'USER',section_id:'a',access:{...granted,modules:[]}};
  rerender(<AccessProvider><PageAccess><p>Protected workspace</p></PageAccess></AccessProvider>);
  await act(async () => resolve({data:granted}));
  expect(screen.queryByText('Protected workspace')).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('403');
});

test('renders only the entitled workspace on a partial page', async () => {
  render(<AccessProvider><PageAccess><ModuleAccess module="reports.crb"><p>CRB workspace</p></ModuleAccess><ModuleAccess module="reports.hovering"><p>Hovering workspace</p></ModuleAccess></PageAccess></AccessProvider>);
  await screen.findByText('CRB workspace');
  expect(screen.queryByText('Hovering workspace')).not.toBeInTheDocument();
});

test('direct forbidden workspace returns 403 without mounting its content', async () => {
  mockLocation={pathname:'/reports',search:'?workspace=hovering'};
  render(<AccessProvider><PageAccess><p>Restricted data</p></PageAccess></AccessProvider>);
  await screen.findByText('403 — Access unavailable');
  expect(screen.queryByText('Restricted data')).not.toBeInTheDocument();
});

test('one permitted module keeps a multi-workspace page visible', () => {
  expect(canOpenPage('/reports', ['reports.crb'], 'USER')).toBe(true);
  expect(canOpenPage('/trustlink', ['trustlink.rtgs'], 'MANAGER')).toBe(true);
  expect(canOpenPage('/reports', ['task_manager.tasks'], 'MANAGER')).toBe(false);
});
test('deep link page classification and admin administration', () => {
  expect(pageModules('/checklist/some-id')).toContain('checklists.execution');
  expect(canOpenPage('/checklist/some-id', [], 'USER')).toBe(false);
  expect(canOpenPage('/access', [], 'MANAGER')).toBe(false);
  expect(canOpenPage('/access', [], 'ADMIN')).toBe(true);
});
test('roles do not entitle business modules', () => {
  expect(canOpenPage('/network-sentinel', [], 'MANAGER')).toBe(false);
  expect(canOpenPage('/team', ['team.scheduling'], 'USER')).toBe(false);
  expect(canOpenPage('/team', ['team.scheduling'], 'MANAGER')).toBe(true);
});
