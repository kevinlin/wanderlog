import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({
    auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange },
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
});
