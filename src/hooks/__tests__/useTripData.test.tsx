import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockFetchTripById = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  fetchTripById: (...args: unknown[]) => mockFetchTripById(...args),
}));

const mockSession = { user: { id: 'u1' } };
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: mockSession, isLoading: false }),
}));

import { useTripData } from '../useTripData';

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useTripData', () => {
  it('returns trip data fetched from the supabase service', async () => {
    mockFetchTripById.mockResolvedValue({
      trip_id: '202512_NZ',
      trip_name: 'NZ',
      timezone: 'Pacific/Auckland',
      stops: [],
    });

    const { result } = renderHook(() => useTripData({ tripId: '202512_NZ' }), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.tripData?.trip_name).toBe('NZ'));
    expect(result.current.error).toBeNull();
    expect(mockFetchTripById).toHaveBeenCalledWith('202512_NZ');
  });

  it('exposes the error message when the fetch fails', async () => {
    mockFetchTripById.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useTripData({ tripId: '202512_NZ' }), { wrapper });

    await waitFor(() => expect(result.current.error).toBe('offline'));
    expect(result.current.tripData).toBeNull();
  });
});
