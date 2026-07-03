import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from '@/lib/queryClient';
import { reorderActivities, setActivityDone, setWaypointDone } from '@/services/supabaseService';
import type { TripData } from '@/types/trip';

const patchTrip = (trip: TripData, fn: (trip: TripData) => TripData) => fn(structuredClone(trip));

interface ToggleDoneVariables {
  activityId: string;
  isDone: boolean;
  isWaypoint: boolean;
}

export function useToggleActivityDone(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, isDone, isWaypoint }: ToggleDoneVariables) =>
      isWaypoint ? setWaypointDone(activityId, isDone) : setActivityDone(activityId, isDone),
    onMutate: async ({ activityId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
        old
          ? patchTrip(old, (trip) => {
              for (const stop of trip.stops) {
                for (const item of [...stop.activities, ...(stop.scenic_waypoints ?? [])]) {
                  if (item.activity_id === activityId) {
                    item.status = { done: isDone };
                  }
                }
              }
              return trip;
            })
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
  });
}

interface ReorderVariables {
  orderedActivityIds: string[];
  stopId: string;
}

export function useReorderActivities(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderedActivityIds }: ReorderVariables) => reorderActivities(orderedActivityIds),
    onMutate: async ({ stopId, orderedActivityIds }) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
        old
          ? patchTrip(old, (trip) => {
              const stop = trip.stops.find((s) => s.stop_id === stopId);
              if (stop) {
                const byId = new Map(stop.activities.map((a) => [a.activity_id, a]));
                stop.activities = orderedActivityIds
                  .map((id) => byId.get(id))
                  .filter((a) => a !== undefined)
                  .map((a, index) => ({ ...a, order: index }));
              }
              return trip;
            })
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
  });
}
