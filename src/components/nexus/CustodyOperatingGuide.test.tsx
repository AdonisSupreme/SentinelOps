import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import CustodyOperatingGuide from './CustodyOperatingGuide';

test('contextual help starts at the execution procedure and navigates without executing', () => {
  const navigate = jest.fn();
  render(<CustodyOperatingGuide origin="execution" onNavigate={navigate} onDownload={jest.fn()} />);
  expect(screen.getByText(/Approval executes the mutation/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Review before approval' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Open workspace' }));
  expect(navigate).toHaveBeenCalledWith('execution');
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open workspace' }));
  expect(navigate).toHaveBeenLastCalledWith('execution');
  expect(screen.getByRole('button', { name: 'Next step' })).toBeDisabled();
});

test('changing tasks resets the procedure and retains prerequisites', () => {
  render(<CustodyOperatingGuide origin="control" onNavigate={jest.fn()} onDownload={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next step' }));
  fireEvent.click(screen.getByRole('button', { name: /Investigate an account or RRN/ }));
  expect(screen.getByRole('button', { name: 'Previous guide step' })).toBeDisabled();
  expect(screen.getByText(/supporting authorization if preparing a correction/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open workspace' })).toBeInTheDocument();
});

test('uncertain commit guidance is searchable and the manual remains available', () => {
  const download = jest.fn();
  render(<CustodyOperatingGuide origin="audit" onNavigate={jest.fn()} onDownload={download} />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Search help for this module' }), { target: { value: 'uncertain' } });
  expect(screen.getByText('Commit uncertain means stop')).toBeInTheDocument();
  expect(screen.queryByText('Write gates closed')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Full manual' }));
  expect(download).toHaveBeenCalledTimes(1);
});
