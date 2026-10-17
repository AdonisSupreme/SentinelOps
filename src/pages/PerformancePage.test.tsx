import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PerformancePage from './PerformancePage';
import { performanceApi } from '../services/performanceApi';
import fixture from './__fixtures__/performance.json';
jest.mock('../services/performanceApi', () => ({ performanceApi: { getPerformanceCommand: jest.fn(), claimPerformanceBadge: jest.fn() } }));
jest.mock('../contexts/NotificationContext', () => ({ useNotifications: () => ({ addNotification: jest.fn() }) }));
jest.mock('../components/ui/PageGuide', () => () => null);
const get = performanceApi.getPerformanceCommand as jest.Mock;
const claim = performanceApi.claimPerformanceBadge as jest.Mock;
beforeEach(() => { jest.clearAllMocks(); get.mockResolvedValue(fixture); });
test('separates absent evidence from a zero score', async () => {
  const data=JSON.parse(JSON.stringify(fixture));data.windows.monthly.evidence={sample_size:0,status:'no_evidence',deadline_tasks:0,closed_runs:0,elapsed_shifts:0,timed_starts:0};get.mockResolvedValue(data);
  render(<PerformancePage />);
  expect(await screen.findByText('Waiting for measurable outcomes')).toBeInTheDocument();
  expect(screen.getAllByText(/No eligible evidence/)).toHaveLength(4);
});
test('award levels expose exact requirements and collect using the stable key', async () => {
  claim.mockResolvedValue({badge:{...fixture.badges[0],claimed:true,claimable:false},claimed_badge_count:1});
  render(<PerformancePage />);await screen.findByText('Contribution points');
  fireEvent.click(screen.getByRole('button',{name:/Achievements/}));
  expect(screen.getAllByRole('button',{name:'Expert'})).toHaveLength(11);
  const night=screen.getByRole('heading',{name:'Night Owl'}).closest('article')!;
  expect(night).toHaveTextContent('Night actions');expect(night).toHaveTextContent('40 / 12');
  fireEvent.click(screen.getAllByRole('button',{name:'Collect Amateur'})[0]);
  await waitFor(()=>expect(claim).toHaveBeenCalledWith('flow_keeper'));
});
test('refresh failure keeps the record and offers retry',async()=>{
  render(<PerformancePage />);await screen.findByText('Contribution points');
  get.mockRejectedValueOnce(new Error('offline'));fireEvent.click(screen.getByLabelText('Refresh performance'));
  expect(await screen.findByRole('alert')).toHaveTextContent('previous record remains visible');
  expect(screen.getByText('Contribution points')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Retry'}));await waitFor(()=>expect(get).toHaveBeenCalledTimes(3));
});
