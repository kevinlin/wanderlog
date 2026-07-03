import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
const mockSignInWithOAuth = vi.fn();
const mockAuthSignOut = vi.fn().mockResolvedValue({ error: null });
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({
    auth: {
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
      signInWithOAuth: mockSignInWithOAuth,
      signOut: mockAuthSignOut,
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
