import { reorderActivities, setActivityDone, setWaypointDone } from '@/services/supabaseService';
import { useTripCacheMutation } from './useTripCacheMutation';

interface ToggleDoneVariables {
  activityId: string;
  isDone: boolean;
  isWaypoint: boolean;
}

export function useToggleActivityDone(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ activityId, isDone, isWaypoint }: ToggleDoneVariables) =>
      isWaypoint ? setWaypointDone(activityId, isDone) : setActivityDone(activityId, isDone),
    patch: (trip, { activityId, isDone }) => {
      for (const stop of trip.stops) {
        for (const item of [...stop.activities, ...(stop.scenic_waypoints ?? [])]) {
          if (item.activity_id === activityId) {
            item.status = { done: isDone };
          }
        }
      }
      return trip;
    },
    errorMessage: 'Could not save the change',
  });
}

interface ReorderVariables {
  orderedActivityIds: string[];
  stopId: string;
}

export function useReorderActivities(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ orderedActivityIds }: ReorderVariables) => reorderActivities(orderedActivityIds),
    patch: (trip, { stopId, orderedActivityIds }) => {
      const stop = trip.stops.find((s) => s.stop_id === stopId);
      if (stop) {
        const byId = new Map(stop.activities.map((a) => [a.activity_id, a]));
        stop.activities = orderedActivityIds
          .map((id) => byId.get(id))
          .filter((a) => a !== undefined)
          .map((a, index) => ({ ...a, order: index }));
      }
      return trip;
    },
    errorMessage: 'Could not save the new order',
  });
}
