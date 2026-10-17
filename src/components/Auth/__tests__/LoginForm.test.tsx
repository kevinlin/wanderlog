import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSignIn = vi.fn();
const mockSignInWithGoogle = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ signIn: mockSignIn, signInWithGoogle: mockSignInWithGoogle }) }));

import { LoginForm } from '../LoginForm';

const renderForm = () =>
  render(
    <MemoryRouter>
      <LoginForm />
    </MemoryRouter>
  );

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('announces a sign-in error', async () => {
    mockSignIn.mockRejectedValue(new Error('Invalid login credentials'));
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByLabelText('Email'), 'member@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials');
  });

  it('locks the Google button while redirecting so a double tap starts one flow', async () => {
    mockSignInWithGoogle.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderForm();
    const google = screen.getByRole('button', { name: /continue with google/i });
    await user.click(google);
    await user.click(google);
    expect(google).toBeDisabled();
    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
  });

  it('unlocks the Google button and shows the error when the redirect fails', async () => {
    mockSignInWithGoogle.mockRejectedValue(new Error('popup blocked'));
    const user = userEvent.setup();
    renderForm();
    const google = screen.getByRole('button', { name: /continue with google/i });
    await user.click(google);
    expect(await screen.findByRole('alert')).toHaveTextContent('popup blocked');
    expect(google).toBeEnabled();
  });
});
