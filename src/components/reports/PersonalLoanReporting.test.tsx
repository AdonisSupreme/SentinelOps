import React from 'react';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import '@testing-library/jest-dom';
import PersonalLoanReporting from './PersonalLoanReporting';
import reportsApi from '../../services/reportsApi';
jest.mock('../../services/reportsApi', () => ({__esModule:true,default:{personalReport:jest.fn(),exportPersonalReport:jest.fn()}}));
beforeEach(() => jest.clearAllMocks());
test('legacy scope remains a draft until explicitly applied', () => {
  const onScope = jest.fn();
  render(<PersonalLoanReporting scope={{}} filters={{currency:'USD',status:'FAILED'}} onScope={onScope} onPeriod={jest.fn()} />);
  fireEvent.click(screen.getByText('Load legacy credit scope'));
  expect(onScope).not.toHaveBeenCalled();
  expect(screen.getByRole('button',{name:'Download CSV'})).toBeDisabled();
  fireEvent.click(screen.getByText('Apply boundaries'));
  expect(onScope).toHaveBeenCalledWith(expect.objectContaining({maturity_after:'2029-12-31',pay_from:'2025-06-01'}));
});
test('analytics uses current filters and old results disappear when scope changes', async () => {
  (reportsApi.personalReport as jest.Mock).mockResolvedValue({generated_at:'2026-10-23T10:00:00Z',timezone:'Africa/Harare',groups:[],activity:[]});
  const props = {scope:{},onScope:jest.fn(),onPeriod:jest.fn()};
  const {rerender} = render(<PersonalLoanReporting {...props} filters={{currency:'USD',status:'SUCCESS'}} />);
  fireEvent.click(screen.getByText('Analyze scope'));
  await screen.findByText('Filtered evidence');
  expect(reportsApi.personalReport).toHaveBeenCalledWith({currency:'USD',status:'SUCCESS'});
  rerender(<PersonalLoanReporting {...props} filters={{currency:'ZWL',status:'SUCCESS'}} />);
  expect(screen.queryByText('Filtered evidence')).not.toBeInTheDocument();
});
test('oversized export displays the server explanation', async () => {
  (reportsApi.exportPersonalReport as jest.Mock).mockRejectedValue({response:{data:{detail:'More than 10,000 records match. Narrow the reporting scope before downloading.'}}});
  render(<PersonalLoanReporting scope={{}} filters={{currency:'ZWL',status:'SUCCESS'}} onScope={jest.fn()} onPeriod={jest.fn()} />);
  fireEvent.click(screen.getByText('Download CSV'));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('10,000'));
});
