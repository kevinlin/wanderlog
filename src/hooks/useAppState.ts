import { useState, useEffect } from 'react';
import { AppState, StopStatus, TripStop } from '@/types';
import { 
  getStopStatus, 
  getLastViewedStop, 
  saveLastViewedStop,
  updateActivityStatus as updateStorageActivityStatus,
  updateActivityOrder as updateStorageActivityOrder
} from '@/services/storageService';
import { getCurrentStop } from '@/utils/dateUtils';

interface UseAppStateReturn extends AppState {
  updateActivityStatus: (stopId: string, activityId: string, done: boolean) => void;
  updateActivityOrder: (stopId: string, activityOrder: { [activityId: string]: number }) => void;
  setCurrentStop: (stopId: string) => void;
  setSelectedActivity: (activityId: string | null) => void;
}

/**
 * Hook to manage app state including current stop, activity status, and selections
 */
export const useAppState = (stops: TripStop[] = []): UseAppStateReturn => {
  const [stopStatus, setStopStatus] = useState<StopStatus>({});
  const [currentStopId, setCurrentStopId] = useState<string>('');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);

  // Initialize state on mount
  useEffect(() => {
    if (stops.length === 0) return;

    // Load stop status from localStorage
    const savedStopStatus = getStopStatus();
    setStopStatus(savedStopStatus);

    // Determine initial current stop
    const lastViewedStop = getLastViewedStop();
    const currentStop = getCurrentStop(stops);
    
    const initialStopId = lastViewedStop && stops.find(s => s.stop_id === lastViewedStop) 
      ? lastViewedStop
      : currentStop?.stop_id || stops[0].stop_id;
    
    setCurrentStopId(initialStopId);
  }, [stops]);

  // Save current stop to localStorage when it changes
  useEffect(() => {
    if (currentStopId) {
      saveLastViewedStop(currentStopId);
    }
  }, [currentStopId]);

  const updateActivityStatus = (stopId: string, activityId: string, done: boolean) => {
    const newStatus = { done };
    
    // Update local state
    setStopStatus(prev => {
      const updated = { ...prev };
      if (!updated[stopId]) {
        updated[stopId] = { activities: {}, activityOrder: {} };
      }
      updated[stopId].activities[activityId] = newStatus;
      return updated;
    });

    // Update localStorage
    updateStorageActivityStatus(stopId, activityId, newStatus);
  };

  const updateActivityOrder = (stopId: string, activityOrder: { [activityId: string]: number }) => {
    // Update local state
    setStopStatus(prev => {
      const updated = { ...prev };
      if (!updated[stopId]) {
        updated[stopId] = { activities: {}, activityOrder: {} };
      }
      updated[stopId].activityOrder = activityOrder;
      return updated;
    });

    // Update localStorage
    updateStorageActivityOrder(stopId, activityOrder);
  };

  const setCurrentStop = (stopId: string) => {
    setCurrentStopId(stopId);
    setSelectedActivityId(null); // Clear activity selection when changing stops
  };

  const setSelectedActivity = (activityId: string | null) => {
    setSelectedActivityId(activityId);
  };

  return {
    stopStatus,
    currentStopId,
    selectedActivityId,
    updateActivityStatus,
    updateActivityOrder,
    setCurrentStop,
    setSelectedActivity,
  };
};
