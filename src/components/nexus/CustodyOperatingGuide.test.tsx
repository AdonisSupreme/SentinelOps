import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustodyOperatingGuide from './CustodyOperatingGuide';

test('contextual help starts at the execution procedure and navigates without executing', () => {
  const navigate = jest.fn();
  render(<CustodyOperatingGuide origin="execution" onNavigate={navigate} onDownload={jest.fn()} />);
  expect(screen.getByText(/Approval executes the mutation/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Submit, then authorize from Execution Desk' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open Execution desk' }));
  expect(navigate).toHaveBeenCalledWith('execution');
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open Custody trail' }));
  expect(navigate).toHaveBeenLastCalledWith('audit');
  expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
});

test('changing tasks resets the procedure and retains prerequisites', () => {
  render(<CustodyOperatingGuide origin="control" onNavigate={jest.fn()} onDownload={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: /Investigate an account or RRN/ }));
  expect(screen.getByRole('button', { name: 'Previous guide step' })).toBeDisabled();
  expect(screen.getByText(/supporting authorization if preparing a correction/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Account explorer' })).toBeInTheDocument();
});

test('uncertain commit guidance is searchable and the manual remains available', () => {
  const download = jest.fn();
  render(<CustodyOperatingGuide origin="audit" onNavigate={jest.fn()} onDownload={download} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search custody help' }), { target: { value: 'uncertain' } });
  expect(screen.getByText('Commit uncertain means stop')).toBeInTheDocument();
  expect(screen.queryByText('Source validation stops the run')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Full manual' }));
  expect(download).toHaveBeenCalledTimes(1);
});
