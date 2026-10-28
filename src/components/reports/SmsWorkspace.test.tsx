import React from 'react';
import {render, screen, fireEvent, waitFor, act} from '@testing-library/react';
import '@testing-library/jest-dom';
import SmsWorkspace from './SmsWorkspace';
import {subscribeSmsEvents} from '../../services/smsLive';
import {reportsClient} from '../../services/reportsApi';
jest.mock('../../services/reportsApi', () => ({reportsClient:{get:jest.fn()}}));
jest.mock('../../services/smsLive', () => ({subscribeSmsEvents:jest.fn(() => jest.fn())}));
const health = {configured:true,source_timezone:'Africa/Harare',retained:4,queued:1,retryable:1,errors:1,sent:1,sources:[],activity:[],observed_at:'2026-10-28T10:00:00Z'};
const record = {id:'9731710',status:'ERROR',recipients:'••••0263',source:'PythonSMS',retry_count:3};
beforeEach(() => {
  jest.clearAllMocks();
  (reportsClient.get as jest.Mock).mockImplementation((path:string) => Promise.resolve({data:path.endsWith('/overview') ? health : path.endsWith('/records') ? {items:[record],next_cursor:null,observed_at:health.observed_at} : {...record,message:'Synthetic message',response:'Unknown network'}}));
});
afterEach(() => jest.useRealTimers());

test('separates sent evidence from receipt and opens accessible read-only drawer', async () => {
  render(<SmsWorkspace />);
  fireEvent.click(await screen.findByText('#9731710'));
  const dialog = screen.getByRole('dialog');
  expect(await screen.findByText('Synthetic message')).toBeInTheDocument();
  expect(screen.getByText('Not a handset delivery receipt')).toBeInTheDocument();
  expect(dialog.closest('.sms-drawer-backdrop')).toBeTruthy();
  fireEvent.keyDown(dialog,{key:'Escape'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
});

test('status filters and exact lookup are sent to the source scope', async () => {
  render(<SmsWorkspace />); await screen.findByText('#9731710');
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'RETRYABLE'}});
  await waitFor(() => expect(reportsClient.get).toHaveBeenLastCalledWith(expect.stringContaining('/records'),expect.objectContaining({params:expect.objectContaining({status:'RETRYABLE'})})));
  fireEvent.change(screen.getByPlaceholderText('Record ID or full recipient'),{target:{value:'9731710'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply SMS search'}));
  await waitFor(() => expect(reportsClient.get).toHaveBeenLastCalledWith(expect.stringContaining('/records'),expect.objectContaining({params:expect.objectContaining({search:'9731710'})})));
});

test('refresh failure retains evidence with a visible warning', async () => {
  render(<SmsWorkspace />); await screen.findByText('#9731710');
  (reportsClient.get as jest.Mock).mockRejectedValue(new Error('offline'));
  fireEvent.click(screen.getByRole('button',{name:'Refresh'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('last successful snapshot');
  expect(screen.getByText('#9731710')).toBeInTheDocument();
});

test('source events refresh immediately and unsubscribe on unmount', async () => {
  const unsubscribe = jest.fn();
  (subscribeSmsEvents as jest.Mock).mockReturnValue(unsubscribe);
  const view=render(<SmsWorkspace />);
  await screen.findByText('#9731710');
  expect(reportsClient.get).toHaveBeenCalledTimes(2);
  const change = (subscribeSmsEvents as jest.Mock).mock.calls[0][0];
  await act(async () => { change({mode:'realtime',revision:1}); });
  expect(reportsClient.get).toHaveBeenCalledTimes(4);
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('unconfigured source never requests customer records', async () => {
  (reportsClient.get as jest.Mock).mockResolvedValue({data:{configured:false,source_timezone:'Africa/Harare'}});
  render(<SmsWorkspace />);
  expect(await screen.findByText('Connect the SMS source')).toBeInTheDocument();
  expect(reportsClient.get).toHaveBeenCalledTimes(1);
});

test('sent selection clears incompatible waiting-age scope', async () => {
  render(<SmsWorkspace />); await screen.findByText('#9731710');
  fireEvent.click(screen.getByRole('button',{name:/over 1h/}));
  await waitFor(() => expect(reportsClient.get).toHaveBeenLastCalledWith(expect.stringContaining('/records'),expect.objectContaining({params:expect.objectContaining({aged:true})})));
  fireEvent.change(screen.getByLabelText('Status'),{target:{value:'SEND'}});
  await waitFor(() => expect(reportsClient.get).toHaveBeenLastCalledWith(expect.stringContaining('/records'),expect.objectContaining({params:expect.objectContaining({aged:false,status:'SEND'})})));
});

test('zero retries is real evidence, not missing data', async () => {
  (reportsClient.get as jest.Mock).mockImplementation((path:string) => Promise.resolve({data:path.endsWith('/overview') ? health : path.endsWith('/records') ? {items:[record],next_cursor:null} : {...record,retry_count:0}}));
  render(<SmsWorkspace />); fireEvent.click(await screen.findByText('#9731710'));
  await screen.findByText('Retry count');
  expect(screen.getByText('Retry count').nextElementSibling).toHaveTextContent('0');
});
