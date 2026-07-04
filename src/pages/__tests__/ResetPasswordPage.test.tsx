import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdatePassword = vi.fn();
const mockNavigate = vi.fn();
let authValue: { isLoading: boolean; session: unknown; updatePassword: typeof mockUpdatePassword };

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { ResetPasswordPage } from '../ResetPasswordPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>
  );

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePassword.mockResolvedValue(undefined);
    authValue = { isLoading: false, session: { user: {} }, updatePassword: mockUpdatePassword };
  });

  it('shows a verifying state while the recovery link is exchanged', () => {
    authValue = { isLoading: true, session: null, updatePassword: mockUpdatePassword };
    renderPage();
    expect(screen.getByText('Verifying your link…')).toBeInTheDocument();
  });

  it('shows an invalid-link message when no session is established', () => {
    authValue = { isLoading: false, session: null, updatePassword: mockUpdatePassword };
    renderPage();
    expect(screen.getByText(/invalid or has expired/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /request a new link/i })).toBeInTheDocument();
  });

  it('sets the password and redirects home on success', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('New password'), 'new-secret');
    await user.type(screen.getByLabelText('Confirm password'), 'new-secret');
    await user.click(screen.getByRole('button', { name: /save password/i }));
    expect(mockUpdatePassword).toHaveBeenCalledWith('new-secret');
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('blocks mismatched passwords without calling updatePassword', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('New password'), 'new-secret');
    await user.type(screen.getByLabelText('Confirm password'), 'different');
    await user.click(screen.getByRole('button', { name: /save password/i }));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than the minimum length', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('New password'), '123');
    await user.type(screen.getByLabelText('Confirm password'), '123');
    await user.click(screen.getByRole('button', { name: /save password/i }));
    expect(screen.getByText(/at least 6 characters/i)).toBeInTheDocument();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });
});
