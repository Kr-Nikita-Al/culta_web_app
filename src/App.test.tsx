import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('unauthenticated visitor sees the login form', async () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/login');
  render(<App />);
  expect(await screen.findByRole('button', { name: 'Войти' })).toBeInTheDocument();
});
