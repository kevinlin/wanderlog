import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
const mockSignInWithOAuth = vi.fn();
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange, signInWithOAuth: mockSignInWithOAuth },
  }),
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
});
