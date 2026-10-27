import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import reportsApi from '../../services/reportsApi';
import QueueRecoveryReview from './QueueRecoveryReview';
import HoveringQueueWorkspace from './HoveringQueueWorkspace';
import PersonalLoanWorkspace from './PersonalLoanWorkspace';
jest.mock('../../services/reportsApi', () => ({__esModule:true,default:{queueCustody:jest.fn(),executeRecovery:jest.fn(),getHoveringOverview:jest.fn(),getHoveringRecords:jest.fn(),failureReasons:jest.fn(),prepareRecovery:jest.fn(),personalOverview:jest.fn(),personalRecords:jest.fn()}}));
jest.mock('../../contexts/NotificationContext', () => ({useNotifications: () => ({addNotification:jest.fn()})}));
jest.mock('./HoveringSettingsWorkspace', () => () => null);
beforeEach(() => {
  jest.clearAllMocks();
  (reportsApi.getHoveringOverview as jest.Mock).mockResolvedValue({configured:true,queue_type:'LOAN_LEDGER_FEES',window:{},policy:{enabled:false},date_actions:[],policy_audit:[]});
  (reportsApi.getHoveringRecords as jest.Mock).mockResolvedValue({items:[],page:1,pages:1,total:0});
  (reportsApi.failureReasons as jest.Mock).mockResolvedValue([{description:'',count:2}]);
});
test('all statuses sends an explicit empty status and custody is hidden for non-admins', async () => {
  render(<HoveringQueueWorkspace isAdmin={false} canOperate canManagePasswords={false} refreshNonce={0} />);
  await screen.findByText('Loan ledger fees');
  fireEvent.change(screen.getByDisplayValue('Pending'),{target:{value:''}});
  await waitFor(() => expect(reportsApi.getHoveringRecords).toHaveBeenLastCalledWith(expect.objectContaining({status:''})));
  expect(screen.queryByText('Custody marks')).not.toBeInTheDocument();
});
test('empty description stays a real failure filter', async () => {
  render(<HoveringQueueWorkspace isAdmin={false} canOperate canManagePasswords={false} refreshNonce={0} />);
  await screen.findByText('Loan ledger fees');
  fireEvent.change(screen.getByDisplayValue('Pending'),{target:{value:'FAILED'}});
  await screen.findByText('No description (blank or missing) (2)');
  fireEvent.change(screen.getByDisplayValue('All failure reasons'),{target:{value:'""'}});
  await waitFor(() => expect(reportsApi.getHoveringRecords).toHaveBeenLastCalledWith(expect.objectContaining({status:'FAILED',description:''})));
});
test('recovery cannot submit twice after an uncertain response', async () => {
  (reportsApi.executeRecovery as jest.Mock).mockRejectedValue({response:{data:{detail:'Outcome uncertain; reconcile custody.'}}});
  render(<QueueRecoveryReview preview={{action_id:'a',count:1,items:[{id:'1'}]}} onClose={jest.fn()} onComplete={jest.fn()} />);
  fireEvent.click(screen.getByRole('button',{name:'Confirm requeue'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Outcome uncertain');
  expect(screen.getByRole('button',{name:'Confirm requeue'})).toBeDisabled();
  expect(reportsApi.executeRecovery).toHaveBeenCalledTimes(1);
});
test('personal ID imports reject SQL and never call recovery', async () => {
  (reportsApi.personalOverview as jest.Mock).mockResolvedValue({configured:true,counts:{PENDING:1}});
  (reportsApi.personalRecords as jest.Mock).mockResolvedValue({items:[],total:0,page:1,pages:1});
  render(<PersonalLoanWorkspace isAdmin={false} refreshNonce={0} />);
  fireEvent.change(screen.getByPlaceholderText('156713, 156714'),{target:{value:'156713 OR 1=1'}});
  fireEvent.click(screen.getByRole('button',{name:'Review imported IDs'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('numeric application IDs');
  expect(reportsApi.prepareRecovery).not.toHaveBeenCalled();
});

test('currency selection scopes live reads and imported recovery', async () => {
  (reportsApi.personalOverview as jest.Mock).mockResolvedValue({configured:true,counts:{PENDING:1}});
  (reportsApi.personalRecords as jest.Mock).mockResolvedValue({items:[],total:0,page:1,pages:1});
  (reportsApi.prepareRecovery as jest.Mock).mockResolvedValue({action_id:'a',count:1,items:[{id:'156713'}]});
  render(<PersonalLoanWorkspace isAdmin={false} refreshNonce={0} />);
  fireEvent.click(screen.getByRole('button',{name:'USD'}));
  await waitFor(() => expect(reportsApi.personalOverview).toHaveBeenLastCalledWith('USD'));
  expect(reportsApi.personalRecords).toHaveBeenLastCalledWith(expect.objectContaining({currency:'USD'}));
  fireEvent.change(screen.getByPlaceholderText('156713, 156714'),{target:{value:'156713'}});
  fireEvent.click(screen.getByRole('button',{name:'Review imported IDs'}));
  await waitFor(() => expect(reportsApi.prepareRecovery).toHaveBeenCalledWith({currency:'USD',record_ids:['156713']},'personal-loans'));
});

test('expanded custody replaces the recent preview instead of duplicating it', async () => {
  const action={action_id:'a',created_at:'2026-10-22T08:00:00Z',trigger:'MANUAL',actor:'operator',updated_count:7,status:'COMPLETED'};
  (reportsApi.getHoveringOverview as jest.Mock).mockResolvedValue({configured:true,queue_type:'LOAN_LEDGER_FEES',window:{},policy:{},date_actions:[action],policy_audit:[]});
  (reportsApi.queueCustody as jest.Mock).mockResolvedValue({date_actions:[action],policy_audit:[],recoveries:[],has_more:false});
  render(<HoveringQueueWorkspace isAdmin canOperate canManagePasswords={false} refreshNonce={0} />);
  await screen.findByText('7 records updated');
  fireEvent.click(screen.getByRole('button',{name:'Browse full custody history'}));
  await screen.findByRole('button',{name:'Collapse history'});
  expect(screen.getAllByText('7 records updated')).toHaveLength(1);
});

test('live refresh waits for slow requests instead of overlapping them', async () => {
  jest.useFakeTimers();
  let resolve!: (value: unknown) => void;
  (reportsApi.personalOverview as jest.Mock).mockResolvedValue({configured:true,counts:{}});
  (reportsApi.personalRecords as jest.Mock).mockImplementationOnce(() => new Promise(r => {resolve=r;})).mockResolvedValue({items:[],total:0,page:1,pages:1});
  const view=render(<PersonalLoanWorkspace isAdmin={false} refreshNonce={0} />);
  await act(async () => { jest.advanceTimersByTime(10000); });
  expect(reportsApi.personalRecords).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({items:[],total:0,page:1,pages:1}); });
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(reportsApi.personalRecords).toHaveBeenCalledTimes(2);
  view.unmount(); jest.useRealTimers();
});

test('personal details use a right drawer and unrelated workflow stages do not affect progress', async () => {
  (reportsApi.personalOverview as jest.Mock).mockResolvedValue({configured:true,counts:{PENDING:1,SUCCESS:1,FAILED:0,OTHER:8}});
  (reportsApi.personalRecords as jest.Mock).mockResolvedValue({items:[{id:10,account_number:'100001',status_id:18,is_processed:'1',overdraft_tenure:'USD PERSONAL LOAN 48 MONTHS'}],total:1,page:1,pages:1});
  render(<PersonalLoanWorkspace isAdmin={false} refreshNonce={0} />);
  await screen.findByText('100001');
  expect(screen.queryByText('Other workflow stages')).not.toBeInTheDocument();
  expect(screen.getByText('50% successful')).toBeInTheDocument();
  fireEvent.click(screen.getByText('100001'));
  const dialog=screen.getByRole('dialog');
  expect(dialog.parentElement).toHaveClass('personal-drawer-backdrop');
  expect(screen.getByRole('button',{name:'Close application'})).toBeInTheDocument();
  fireEvent.keyDown(dialog,{key:'Escape'});
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
