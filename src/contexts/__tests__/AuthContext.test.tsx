import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
const mockSignInWithOAuth = vi.fn();
const mockAuthSignOut = vi.fn().mockResolvedValue({ error: null });
const mockResetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
const mockUpdateUser = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      resetPasswordForEmail: mockResetPasswordForEmail,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockAuthSignOut,
      updateUser: mockUpdateUser,
    },
  }),
}));

const mockIdbDel = vi.fn().mockResolvedValue(undefined);
vi.mock('idb-keyval', () => ({
  get: vi.fn(),
  set: vi.fn(),
  del: (key: string) => mockIdbDel(key),
}));

import { AuthProvider, useAuth } from '../AuthContext';

const Probe = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) {
    return <div>loading</div>;
  }
  return <div>{session ? 'in' : 'out'}</div>;
};

describe('AuthProvider', () => {
  it('resolves to signed-out when no session exists', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('signInWithGoogle starts the oauth flow with a same-origin redirect', async () => {
    mockSignInWithOAuth.mockResolvedValue({ error: null });
    let signInWithGoogle: (() => Promise<void>) | undefined;
    const OAuthProbe = () => {
      signInWithGoogle = useAuth().signInWithGoogle;
      return null;
    };
    render(
      <AuthProvider>
        <OAuthProbe />
      </AuthProvider>
    );
    await signInWithGoogle?.();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    });
  });

  it('resetPassword sends a recovery email pointing at /reset-password', async () => {
    let resetPassword: ((email: string) => Promise<void>) | undefined;
    const ResetProbe = () => {
      resetPassword = useAuth().resetPassword;
      return null;
    };
    render(
      <AuthProvider>
        <ResetProbe />
      </AuthProvider>
    );
    await resetPassword?.('member@example.com');
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('member@example.com', {
      redirectTo: window.location.origin + import.meta.env.BASE_URL + 'reset-password',
    });
  });

  it('resetPassword surfaces the supabase error message', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'rate limited' } });
    let resetPassword: ((email: string) => Promise<void>) | undefined;
    const ResetProbe = () => {
      resetPassword = useAuth().resetPassword;
      return null;
    };
    render(
      <AuthProvider>
        <ResetProbe />
      </AuthProvider>
    );
    await expect(resetPassword?.('member@example.com')).rejects.toThrow('rate limited');
  });

  it('updatePassword updates the user password', async () => {
    let updatePassword: ((password: string) => Promise<void>) | undefined;
    const UpdateProbe = () => {
      updatePassword = useAuth().updatePassword;
      return null;
    };
    render(
      <AuthProvider>
        <UpdateProbe />
      </AuthProvider>
    );
    await updatePassword?.('new-secret');
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'new-secret' });
  });

  it('signOut clears supabase session, query cache and persisted cache', async () => {
    let signOut: (() => Promise<void>) | undefined;
    const SignOutProbe = () => {
      signOut = useAuth().signOut;
      return null;
    };
    render(
      <AuthProvider>
        <SignOutProbe />
      </AuthProvider>
    );
    await signOut?.();
    expect(mockAuthSignOut).toHaveBeenCalled();
    expect(mockIdbDel).toHaveBeenCalledWith('wanderlog-query-cache');
  });
});
