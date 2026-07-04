import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDeleteTrip = vi.fn();
const mockImportTrip = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  importTrip: (tripData: unknown) => mockImportTrip(tripData),
  deleteTrip: (tripId: string) => mockDeleteTrip(tripId),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockGetCurrentTripId = vi.fn<() => string | null>();
const mockSetCurrentTripId = vi.fn();
vi.mock('@/services/viewStateStorage', () => ({
  getCurrentTripId: () => mockGetCurrentTripId(),
  setCurrentTripId: (tripId: string | null) => mockSetCurrentTripId(tripId),
}));

import type { TripData } from '@/types/trip';
import { useDeleteTrip, useImportTrip } from '../useTripLibraryMutations';

describe('useImportTrip', () => {
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(['trips'], [{ trip_id: 't1' }]);
  });

  it('imports the trip, invalidates the list, and navigates to the new trip', async () => {
    mockImportTrip.mockResolvedValue('new-trip-id');
    const tripData = { trip_id: 'new-trip-id', trip_name: 'Imported', timezone: 'UTC', stops: [] } as unknown as TripData;
    const { result } = renderHook(() => useImportTrip(), { wrapper });
    result.current.mutate(tripData);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockImportTrip).toHaveBeenCalledWith(tripData);
    expect(queryClient.getQueryState(['trips'])?.isInvalidated).toBe(true);
    expect(mockNavigate).toHaveBeenCalledWith('/trips/new-trip-id');
  });

  it('surfaces the error and does not navigate when the import fails', async () => {
    mockImportTrip.mockRejectedValue(new Error('stops: boom'));
    const { result } = renderHook(() => useImportTrip(), { wrapper });
    result.current.mutate({ trip_name: 'X', timezone: 'UTC', stops: [] } as unknown as TripData);
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error?.message).toBe('stops: boom');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});

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
