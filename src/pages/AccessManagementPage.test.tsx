import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AccessManagementPage from './AccessManagementPage';
import api from '../services/api';

const mockRefresh = jest.fn().mockResolvedValue(undefined);
jest.mock('../contexts/AccessContext', () => ({ useAccess: () => ({ refresh: mockRefresh }) }));
jest.mock('../services/api', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  (api.get as jest.Mock).mockImplementation((url: string) => Promise.resolve({data: url.endsWith('/users') || url.endsWith('/audit') ? [] : {
    sections: [{id:'a',name:'Operations',is_active:true},{id:'b',name:'Finance',is_active:true}],
    modules: [{id:'history',module_key:'trustlink.run_history',name:'Run history',page_key:'Trustlink',is_active:true},
      {id:'daily',module_key:'trustlink.daily_extraction',name:'Daily pipeline',page_key:'Trustlink',is_active:true}],
    assignments: [{section_id:'a',module_id:'history'},{section_id:'b',module_id:'history'}],
  }}));
  (api.put as jest.Mock).mockResolvedValue({data:{saved:true}});
});

test('group selection saves one section without replacing shared ownership', async () => {
  render(<AccessManagementPage />);
  await screen.findByRole('button', {name:'Operations'});
  await waitFor(() => expect(screen.getByRole('checkbox', {name:/Run history/})).toBeChecked());
  fireEvent.click(screen.getByRole('button', {name:'Select all shown'}));
  fireEvent.click(screen.getByRole('button', {name:'Save assignments'}));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/admin/sections/a/modules',{module_ids:['history','daily']}));
  await screen.findByText('Access changes saved.');
});

test('reverse perspective shows shared sections and removes only the selected grant', async () => {
  render(<AccessManagementPage />);
  await screen.findByRole('button', {name:'Operations'});
  fireEvent.click(screen.getByRole('button', {name:'Modules'}));
  expect(await screen.findByRole('checkbox', {name:/Operations/})).toBeChecked();
  expect(screen.getByRole('checkbox', {name:/Finance/})).toBeChecked();
  fireEvent.click(screen.getByRole('checkbox', {name:/Operations/}));
  fireEvent.click(screen.getByRole('button', {name:'Save assignments'}));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/v1/admin/modules/history/sections',{section_ids:['b']}));
});

test('switching with unsaved changes requires an explicit discard', async () => {
  render(<AccessManagementPage />);
  fireEvent.click(await screen.findByRole('checkbox', {name:/Daily pipeline/}));
  fireEvent.click(screen.getByRole('button', {name:'Operations'}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name:'Finance'}));
  expect(screen.getByRole('dialog')).toHaveTextContent('unsaved assignments');
  fireEvent.click(screen.getByRole('button', {name:'Keep editing'}));
  expect(screen.getByRole('checkbox', {name:/Daily pipeline/})).toBeChecked();
  fireEvent.click(screen.getByRole('button', {name:'Finance'}));
  fireEvent.click(screen.getByRole('button', {name:'Discard & switch'}));
  expect(screen.getByRole('heading', {name:'Finance'})).toBeInTheDocument();
  expect(screen.getByRole('checkbox', {name:/Daily pipeline/})).not.toBeChecked();
  expect(api.put).not.toHaveBeenCalled();
});

test('failed saves preserve edits and filtering preserves hidden assignments', async () => {
  (api.put as jest.Mock).mockRejectedValueOnce({response:{data:{detail:'Save failed'}}});
  render(<AccessManagementPage />);
  await screen.findByRole('checkbox', {name:/Run history/});
  fireEvent.change(screen.getByLabelText('Filter assignments'), {target:{value:'Daily'}});
  fireEvent.click(screen.getByRole('checkbox', {name:/Daily pipeline/}));
  fireEvent.click(screen.getByRole('button', {name:'Save assignments'}));
  await screen.findByRole('alert');
  expect(api.put).toHaveBeenCalledWith('/api/v1/admin/sections/a/modules',{module_ids:['history','daily']});
  expect(screen.getByRole('checkbox', {name:/Daily pipeline/})).toBeChecked();
  expect(screen.getByText('1 unsaved change')).toBeInTheDocument();
});

test('operator directory and audit history load only when opened', async () => {
  render(<AccessManagementPage />);
  await screen.findByRole('button', {name:'Operations'});
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', {name:'Effective access'}));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/api/v1/users'));
  fireEvent.click(screen.getByRole('button', {name:'Audit history'}));
  await screen.findByText('No access changes to show.');
  expect(api.get).toHaveBeenCalledWith('/api/v1/admin/access/audit');
});
