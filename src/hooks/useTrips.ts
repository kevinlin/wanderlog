import { useCallback, useEffect } from 'react';
import { type TripSummary, useAppStateContext } from '@/contexts/AppStateContext';
import { loadAllTrips } from '@/services/tripService';
import type { LoadingState } from '@/types';

interface UseTripsReturn extends LoadingState {
  trips: TripSummary[];
  currentTripId: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to load and manage the list of available trips
 *
 * This hook:
 * - Loads all available trips from Firestore
 * - Provides the current trip ID
 * - Allows refetching the trip list
 */
export const useTrips = (): UseTripsReturn => {
  const { state, dispatch } = useAppStateContext();

  const fetchTrips = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      // Load all trips from Firestore
      const trips = await loadAllTrips();

      // Convert TripData[] to TripSummary[]
      const tripSummaries: TripSummary[] = trips.map((trip) => ({
        trip_id: trip.trip_id,
        trip_name: trip.trip_name,
        timezone: trip.timezone,
        created_at: trip.created_at,
        updated_at: trip.updated_at,
      }));

      dispatch({ type: 'SET_AVAILABLE_TRIPS', payload: tripSummaries });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trips';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
      console.error('Failed to load trips:', err);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  useEffect(() => {
    // Only fetch if we don't have trips yet
    if (state.availableTrips.length === 0 && !state.loading) {
      fetchTrips();
    }
  }, [state.availableTrips.length, state.loading, fetchTrips]);

  return {
    trips: state.availableTrips,
    currentTripId: state.currentTripId,
    isLoading: state.loading,
    error: state.error,
    refetch: fetchTrips,
  };
};
