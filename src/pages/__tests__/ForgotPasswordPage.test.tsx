import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockResetPassword = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ resetPassword: mockResetPassword }) }));

import { ForgotPasswordPage } from '../ForgotPasswordPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>
  );

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResetPassword.mockResolvedValue(undefined);
  });

  it('sends a reset link and shows confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email'), 'member@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(mockResetPassword).toHaveBeenCalledWith('member@example.com');
    expect(await screen.findByText(/we sent a link/i)).toBeInTheDocument();
  });

  it('surfaces an error and stays on the form when sending fails', async () => {
    mockResetPassword.mockRejectedValue(new Error('rate limited'));
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText('Email'), 'member@example.com');
    await user.click(screen.getByRole('button', { name: /send reset link/i }));
    expect(await screen.findByText('rate limited')).toBeInTheDocument();
    expect(screen.queryByText(/we sent a link/i)).not.toBeInTheDocument();
  });
});
