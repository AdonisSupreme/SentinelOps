import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LoginPage from './LoginPage';
const mockLogin = jest.fn();
jest.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ login: mockLogin, adAvailability: 'available', refreshAdAvailability: jest.fn() }) }));
test('redesigned login preserves authentication and reports failure accessibly', async () => {
  mockLogin.mockRejectedValueOnce({ response: { status: 401 } });
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'operator@example.test' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-only-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(mockLogin).toHaveBeenCalledWith('operator@example.test', 'test-only-password');
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
});
