import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authService } from '../services/api';
import { checkAdAvailability } from '../services/adGatewayAuth';

const mockNavigate = jest.fn();
const mockLocation = {state:{from:{pathname:'/reports',search:'?workspace=crb'}}};
jest.mock('react-router-dom', () => ({useNavigate:()=>mockNavigate,useLocation:()=>mockLocation}), {virtual:true});
jest.mock('../services/api', () => ({setAuthToken:jest.fn(),clearAuthToken:jest.fn(),authService:{login:jest.fn(),getProfile:jest.fn(),logout:jest.fn()}}));
jest.mock('../services/websocketService', () => ({__esModule:true,default:{setAuthToken:jest.fn()}}));
jest.mock('../services/centralizedWebSocketManager', () => ({__esModule:true,default:{disconnectAll:jest.fn()}}));
jest.mock('../services/adGatewayAuth', () => ({checkAdAvailability:jest.fn()}));

const profile = {id:'operator',role:'USER',section_id:'a',access:{role:'USER',section:{id:'a',name:'A',is_active:true},modules:['reports.crb']}};
const Session = () => {
  const {user,loading,login,refreshUser} = useAuth();
  return <><output>{loading ? 'Restoring' : user?.id || 'Signed out'}</output>
    <span>{user?.access?.modules.join(',')}</span>
    <button onClick={() => void login('test@example.test','fixture')}>Sign in</button>
    <button onClick={() => void refreshUser()}>Refresh profile</button></>;
};
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  (checkAdAvailability as jest.Mock).mockResolvedValue('available');
  (authService.login as jest.Mock).mockResolvedValue({data:{token:'new-session',user:profile}});
  (authService.getProfile as jest.Mock).mockResolvedValue({data:profile});
});

test('login uses returned profile and grants without waiting for AD status or refetching profile', async () => {
  (checkAdAvailability as jest.Mock).mockImplementation(() => new Promise(() => {}));
  render(<AuthProvider><Session /></AuthProvider>);
  await act(async () => {fireEvent.click(screen.getByText('Sign in'));});
  expect(screen.getByText('operator')).toBeInTheDocument();
  expect(screen.getByText('reports.crb')).toBeInTheDocument();
  expect(authService.getProfile).not.toHaveBeenCalled();
  expect(mockNavigate).toHaveBeenCalledWith('/reports?workspace=crb');
});

test('restoring a session deduplicates profile requests, including StrictMode effects', async () => {
  localStorage.setItem('token','existing-session');
  let resolve!: (value:unknown) => void;
  (authService.getProfile as jest.Mock).mockImplementation(() => new Promise(r => {resolve=r;}));
  render(<React.StrictMode><AuthProvider><Session /></AuthProvider></React.StrictMode>);
  fireEvent.click(screen.getByText('Refresh profile'));
  expect(authService.getProfile).toHaveBeenCalledTimes(1);
  await act(async () => resolve({data:profile}));
  expect(screen.getByText('operator')).toBeInTheDocument();
});

test('a late profile response cannot overwrite a newly signed-in identity', async () => {
  localStorage.setItem('token','previous-session');
  let resolve!: (value:unknown) => void;
  (authService.getProfile as jest.Mock).mockImplementation(() => new Promise(r => {resolve=r;}));
  render(<AuthProvider><Session /></AuthProvider>);
  await act(async () => {fireEvent.click(screen.getByText('Sign in'));});
  await act(async () => resolve({data:{...profile,id:'old-operator'}}));
  expect(screen.getByText('operator')).toBeInTheDocument();
  expect(screen.queryByText('old-operator')).not.toBeInTheDocument();
});
