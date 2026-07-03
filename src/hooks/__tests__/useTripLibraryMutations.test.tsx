import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeleteTrip = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createTrip: vi.fn(),
  deleteTrip: (tripId: string) => mockDeleteTrip(tripId),
}));

const mockGetCurrentTripId = vi.fn<() => string | null>();
const mockSetCurrentTripId = vi.fn();
vi.mock('@/services/viewStateStorage', () => ({
  getCurrentTripId: () => mockGetCurrentTripId(),
  setCurrentTripId: (tripId: string | null) => mockSetCurrentTripId(tripId),
}));

import { useDeleteTrip } from '../useTripLibraryMutations';

describe('useDeleteTrip', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteTrip.mockResolvedValue(undefined);
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['trips'], [{ trip_id: 't1' }]);
    queryClient.setQueryData(['trip', 't1'], { trip_id: 't1' });
  });

  it('invalidates the trips list and removes the trip detail from the cache', async () => {
    mockGetCurrentTripId.mockReturnValue(null);
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockDeleteTrip).toHaveBeenCalledWith('t1');
    expect(queryClient.getQueryData(['trip', 't1'])).toBeUndefined();
    expect(queryClient.getQueryState(['trips'])?.isInvalidated).toBe(true);
  });

  it('clears the remembered trip id when it matches the deleted trip', async () => {
    mockGetCurrentTripId.mockReturnValue('t1');
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSetCurrentTripId).toHaveBeenCalledWith(null);
  });

  it('keeps the remembered trip id when a different trip is deleted', async () => {
    mockGetCurrentTripId.mockReturnValue('other');
    const { result } = renderHook(() => useDeleteTrip(), { wrapper });
    result.current.mutate('t1');
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockSetCurrentTripId).not.toHaveBeenCalled();
  });
});
