import { useCallback, useEffect } from 'react';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { getCurrentTripId, getUserModifications, setCurrentTripId } from '@/services/storageService';
import { loadTripData } from '@/services/tripService';
import type { LoadingState, TripData } from '@/types';

interface UseTripDataReturn extends LoadingState {
  tripData: TripData | null;
  refetch: () => Promise<void>;
}

interface UseTripDataOptions {
  tripId?: string;
}

/**
 * Hook to load and manage trip data using global state context
 *
 * @param options.tripId - Optional trip ID to load. If not provided, uses current trip ID from localStorage
 */
export const useTripData = (options: UseTripDataOptions = {}): UseTripDataReturn => {
  const { state, dispatch } = useAppStateContext();
  const { tripId: providedTripId } = options;

  const fetchTripData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Determine which trip ID to use
      const tripId = providedTripId || getCurrentTripId();

      if (!tripId) {
        throw new Error('No trip ID provided and no current trip ID found');
      }

      // Load trip data and user modifications in parallel
      const [tripData, userModifications] = await Promise.all([loadTripData(tripId), getUserModifications(tripId)]);

      // Save current trip ID for future use
      setCurrentTripId(tripId);

      // Dispatch LOAD_TRIP action with all data
      dispatch({
        type: 'LOAD_TRIP',
        payload: {
          tripId,
          tripData,
          userModifications,
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to load trip data:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch, providedTripId]);

  useEffect(() => {
    // Fetch trip data when:
    // 1. We don't have trip data yet, OR
    // 2. The provided tripId is different from the current tripId
    const shouldFetch = !(state.tripData || state.loading) || (providedTripId && providedTripId !== state.currentTripId);

    if (shouldFetch) {
      fetchTripData();
    }
  }, [state.tripData, state.currentTripId, state.loading, providedTripId, fetchTripData]);

  return {
    tripData: state.tripData,
    isLoading: state.loading,
    error: state.error,
    refetch: fetchTripData,
  };
};
