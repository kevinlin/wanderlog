import { useEffect, useCallback } from 'react';
import { TripData, LoadingState } from '@/types';
import { loadTripData } from '@/services/tripDataService';
import { useAppStateContext } from '@/contexts/AppStateContext';

interface UseTripDataReturn extends LoadingState {
  tripData: TripData | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to load and manage trip data using global state context
 */
export const useTripData = (): UseTripDataReturn => {
  const { state, dispatch } = useAppStateContext();

  const fetchTripData = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });
      
      const data = await loadTripData();
      
      dispatch({ type: 'SET_TRIP_DATA', payload: data });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to load trip data:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  useEffect(() => {
    // Only fetch if we don't have trip data yet
    if (!state.tripData && !state.loading) {
      fetchTripData();
    }
  }, [state.tripData, state.loading, fetchTripData]);

  return {
    tripData: state.tripData,
    isLoading: state.loading,
    error: state.error,
    refetch: fetchTripData,
  };
};
