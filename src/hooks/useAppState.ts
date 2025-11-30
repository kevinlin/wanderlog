import { useCallback, useEffect } from 'react';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useLastViewedBase, useUserModifications } from '@/hooks/useLocalStorage';
import { saveUserModifications } from '@/services/storageService';
import type { TripStop } from '@/types';
import { getCurrentStop } from '@/utils/dateUtils';

interface UseAppStateReturn {
  // Current state
  currentStopId: string | null;
  selectedActivityId: string | null;
  tripData: any;
  userModifications: any;
  loading: boolean;
  error: string | null;

  // Legacy compatibility - map new structure to old StopStatus format
  stopStatus: any;

  // Actions
  updateActivityStatus: (stopId: string, activityId: string, done: boolean) => void;
  updateActivityOrder: (stopId: string, activityOrder: { [activityId: string]: number }) => void;
  setCurrentStop: (stopId: string) => void;
  setSelectedActivity: (activityId: string | null) => void;
}

/**
 * Hook to manage app state using global Context API with backward compatibility
 * Migrated to use AppStateContext while maintaining existing API
 */
export const useAppState = (stops: TripStop[] = []): UseAppStateReturn => {
  const { state, dispatch } = useAppStateContext();
  const [userModifications, setUserModifications] = useUserModifications();
  const [lastViewedBase, setLastViewedBase] = useLastViewedBase();

  // Initialize user modifications in global state
  useEffect(() => {
    if (userModifications) {
      dispatch({ type: 'SET_USER_MODIFICATIONS', payload: userModifications });
    }
  }, [userModifications, dispatch]);

  // Initialize current base when trip data and stops are available
  useEffect(() => {
    if (stops.length === 0 || state.currentBase) return;

    // Determine initial current stop
    const currentStop = getCurrentStop(stops);
    const initialStopId =
      lastViewedBase && stops.find((s) => s.stop_id === lastViewedBase) ? lastViewedBase : currentStop?.stop_id || stops[0].stop_id;

    dispatch({ type: 'SELECT_BASE', payload: initialStopId });
  }, [stops, lastViewedBase, state.currentBase, dispatch]);

  // Save current base to localStorage when it changes
  useEffect(() => {
    if (state.currentBase) {
      setLastViewedBase(state.currentBase);
    }
  }, [state.currentBase, setLastViewedBase]);

  // Create legacy stopStatus format for backward compatibility
  const stopStatus = {
    ...(state.userModifications.activityOrders || {}),
    // Convert new format to legacy format
    ...Object.keys(state.userModifications.activityStatus || {}).reduce((acc, activityId) => {
      const baseId = stops.find((stop) => stop.activities.some((activity) => activity.activity_id === activityId))?.stop_id;

      if (baseId) {
        if (!acc[baseId]) {
          acc[baseId] = { activities: {}, activityOrder: {} };
        }
        acc[baseId].activities[activityId] = {
          done: state.userModifications.activityStatus[activityId],
        };
      }
      return acc;
    }, {} as any),
  };

  const updateActivityStatus = useCallback(
    (_stopId: string, activityId: string, done: boolean) => {
      // Update global state
      dispatch({
        type: 'TOGGLE_ACTIVITY_DONE',
        payload: { activityId, done },
      });

      // Update localStorage
      const updatedModifications = {
        ...state.userModifications,
        activityStatus: {
          ...state.userModifications.activityStatus,
          [activityId]: done,
        },
      };
      setUserModifications(updatedModifications);
      saveUserModifications(updatedModifications);
    },
    [dispatch, state.userModifications, setUserModifications]
  );

  const updateActivityOrder = useCallback(
    (stopId: string, activityOrder: { [activityId: string]: number }) => {
      // Convert from legacy format to new format
      const activityIds = Object.keys(activityOrder);
      const sortedIds = activityIds.sort((a, b) => activityOrder[a] - activityOrder[b]);
      const orderArray = sortedIds.map((_, index) => index);

      // Update global state
      dispatch({
        type: 'REORDER_ACTIVITIES',
        payload: { baseId: stopId, fromIndex: 0, toIndex: 0 }, // This will be recalculated
      });

      // Update localStorage with new format
      const updatedModifications = {
        ...state.userModifications,
        activityOrders: {
          ...state.userModifications.activityOrders,
          [stopId]: orderArray,
        },
      };
      setUserModifications(updatedModifications);
      saveUserModifications(updatedModifications);
    },
    [dispatch, state.userModifications, setUserModifications]
  );

  const setCurrentStop = useCallback(
    (stopId: string) => {
      dispatch({ type: 'SELECT_BASE', payload: stopId });
    },
    [dispatch]
  );

  const setSelectedActivity = useCallback(
    (activityId: string | null) => {
      dispatch({ type: 'SELECT_ACTIVITY', payload: activityId });
    },
    [dispatch]
  );

  return {
    // Map global state to expected interface
    currentStopId: state.currentBase,
    selectedActivityId: state.selectedActivity,
    tripData: state.tripData,
    userModifications: state.userModifications,
    loading: state.loading,
    error: state.error,

    // Legacy compatibility
    stopStatus,

    // Actions
    updateActivityStatus,
    updateActivityOrder,
    setCurrentStop,
    setSelectedActivity,
  };
};
