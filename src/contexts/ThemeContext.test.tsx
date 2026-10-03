import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

let changed: () => void;
let dark: boolean;
const Theme = () => {
  const {theme,resolvedTheme,setTheme} = useTheme();
  return <><output>{theme}/{resolvedTheme}</output><button onClick={() => setTheme('system')}>Use system</button></>;
};
beforeEach(() => {
  localStorage.clear();
  dark = false;
  Object.defineProperty(window,'matchMedia',{writable:true,value:jest.fn(() => ({
    get matches() {return dark;}, addEventListener: (_:string,handler:()=>void) => {changed=handler;}, removeEventListener:jest.fn(),
  }))});
});
test('saved dark preference is applied on first render even when the system is light', () => {
  localStorage.setItem('theme','dark');
  render(<ThemeProvider><Theme /></ThemeProvider>);
  expect(screen.getByText('dark/dark')).toBeInTheDocument();
  expect(document.documentElement).toHaveAttribute('data-theme','dark');
  expect(document.documentElement.style.colorScheme).toBe('dark');
  expect(localStorage.getItem('theme')).toBe('dark');
});
test('system changes update only the resolved mode and keep the saved choice', () => {
  localStorage.setItem('theme','light');
  render(<ThemeProvider><Theme /></ThemeProvider>);
  act(() => {dark=true;changed();});
  expect(document.documentElement).toHaveAttribute('data-theme','light');
  fireEvent.click(screen.getByText('Use system'));
  expect(document.documentElement).toHaveAttribute('data-theme','dark');
  expect(localStorage.getItem('theme')).toBe('system');
  act(() => {dark=false;changed();});
  expect(document.documentElement).toHaveAttribute('data-theme','light');
});
