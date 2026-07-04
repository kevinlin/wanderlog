import {
  type ActivityInput,
  createActivity,
  deleteActivity,
  reorderActivities,
  setActivityDone,
  setWaypointDone,
  updateActivity,
} from '@/services/supabaseService';
import type { Activity } from '@/types/trip';
import { useTripCacheMutation } from './useTripCacheMutation';

// Domain-shape equivalent of the row written by the service (absent input
// fields intentionally clear the corresponding domain fields).
const activityInputToDomain = (input: ActivityInput): Omit<Activity, 'activity_id'> => ({
  activity_name: input.name,
  activity_type: input.type as Activity['activity_type'],
  location:
    input.lat === undefined && input.lng === undefined && input.address === undefined
      ? undefined
      : { lat: input.lat, lng: input.lng, address: input.address },
  duration: input.duration,
  url: input.url,
  remarks: input.remarks,
  thumbnail_url: input.thumbnailUrl,
  google_place_id: input.googlePlaceId,
});

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

interface CreateActivityVariables {
  input: ActivityInput;
  sortOrder: number;
  stopId: string;
  tempId: string;
}

export function useCreateActivity(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId, sortOrder, input }: CreateActivityVariables) => createActivity(stopId, sortOrder, input),
    patch: (trip, { stopId, sortOrder, input, tempId }) => {
      const stop = trip.stops.find((s) => s.stop_id === stopId);
      if (stop) {
        stop.activities.push({
          activity_id: tempId,
          ...activityInputToDomain(input),
          order: sortOrder,
          status: { done: false },
        });
      }
      return trip;
    },
    errorMessage: 'Could not add the activity',
  });
}

interface UpdateActivityVariables {
  activityId: string;
  input: ActivityInput;
}

export function useUpdateActivity(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ activityId, input }: UpdateActivityVariables) => updateActivity(activityId, input),
    patch: (trip, { activityId, input }) => {
      for (const stop of trip.stops) {
        stop.activities = stop.activities.map((activity) =>
          activity.activity_id === activityId ? { ...activity, ...activityInputToDomain(input) } : activity
        );
      }
      return trip;
    },
    errorMessage: 'Could not save the activity',
  });
}

export function useDeleteActivity(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ activityId }: { activityId: string }) => deleteActivity(activityId),
    patch: (trip, { activityId }) => {
      for (const stop of trip.stops) {
        stop.activities = stop.activities.filter((activity) => activity.activity_id !== activityId);
      }
      return trip;
    },
    errorMessage: 'Could not delete the activity',
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
