import {
  type AccommodationInput,
  type ActivityInput,
  applyStopStructure,
  createActivity,
  createStop,
  createWaypoint,
  deleteActivity,
  deleteStop,
  deleteWaypoint,
  reorderActivities,
  type StopInput,
  setActivityDone,
  setWaypointDone,
  updateActivity,
  updateStop,
  updateWaypoint,
  upsertAccommodation,
  type WaypointInput,
} from '@/services/supabaseService';
import type { ScenicWaypoint } from '@/types/map';
import type { Accommodation, Activity, TripBase } from '@/types/trip';
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

// Domain-shape equivalent of the row upserted by the service. The service
// doesn't write thumbnail_url, so the existing one is carried over.
const accommodationInputToDomain = (input: AccommodationInput, existing: Accommodation | undefined): Accommodation => ({
  name: input.name,
  address: input.address ?? '',
  check_in: input.checkIn ?? '',
  check_out: input.checkOut ?? '',
  confirmation: input.confirmation,
  url: input.url,
  remarks: input.remarks,
  location: input.lat !== undefined && input.lng !== undefined ? { lat: input.lat, lng: input.lng } : undefined,
  google_place_id: input.googlePlaceId,
  thumbnail_url: existing?.thumbnail_url,
});

interface UpsertAccommodationVariables {
  input: AccommodationInput;
  stopId: string;
}

export function useUpsertAccommodation(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId, input }: UpsertAccommodationVariables) => upsertAccommodation(stopId, input),
    patch: (trip, { stopId, input }) => {
      const stop = trip.stops.find((s) => s.stop_id === stopId);
      if (stop) {
        stop.accommodation = accommodationInputToDomain(input, stop.accommodation);
      }
      return trip;
    },
    errorMessage: 'Could not save the accommodation',
  });
}

// Domain-shape equivalent of the row written by the waypoint service functions.
const waypointInputToDomain = (input: WaypointInput): Omit<ScenicWaypoint, 'activity_id'> => ({
  activity_name: input.name,
  location: { lat: input.lat, lng: input.lng, address: input.address },
  duration: input.duration,
  url: input.url,
  remarks: input.remarks,
  thumbnail_url: input.thumbnailUrl,
  google_place_id: input.googlePlaceId,
});

interface CreateWaypointVariables {
  input: WaypointInput;
  sortOrder: number;
  stopId: string;
  tempId: string;
}

export function useCreateWaypoint(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId, sortOrder, input }: CreateWaypointVariables) => createWaypoint(stopId, sortOrder, input),
    patch: (trip, { stopId, input, tempId }) => {
      const stop = trip.stops.find((s) => s.stop_id === stopId);
      if (stop) {
        stop.scenic_waypoints = [
          ...(stop.scenic_waypoints ?? []),
          { activity_id: tempId, ...waypointInputToDomain(input), status: { done: false } },
        ];
      }
      return trip;
    },
    errorMessage: 'Could not add the waypoint',
  });
}

interface UpdateWaypointVariables {
  input: WaypointInput;
  waypointId: string;
}

export function useUpdateWaypoint(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ waypointId, input }: UpdateWaypointVariables) => updateWaypoint(waypointId, input),
    patch: (trip, { waypointId, input }) => {
      for (const stop of trip.stops) {
        stop.scenic_waypoints = (stop.scenic_waypoints ?? []).map((waypoint) =>
          waypoint.activity_id === waypointId ? { ...waypoint, ...waypointInputToDomain(input) } : waypoint
        );
      }
      return trip;
    },
    errorMessage: 'Could not save the waypoint',
  });
}

export function useDeleteWaypoint(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ waypointId }: { waypointId: string }) => deleteWaypoint(waypointId),
    patch: (trip, { waypointId }) => {
      for (const stop of trip.stops) {
        stop.scenic_waypoints = (stop.scenic_waypoints ?? []).filter((waypoint) => waypoint.activity_id !== waypointId);
      }
      return trip;
    },
    errorMessage: 'Could not delete the waypoint',
  });
}

const NIGHT_MS = 24 * 60 * 60 * 1000;

interface CreateStopVariables {
  input: StopInput;
  sortOrder: number;
  tempId: string;
}

export function useCreateStop(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ sortOrder, input }: CreateStopVariables) => createStop(tripId, sortOrder, input),
    patch: (trip, { input, tempId }) => {
      trip.stops.push({
        stop_id: tempId,
        name: input.name,
        location: { lat: input.lat, lng: input.lng },
        date: { from: input.dateFrom, to: input.dateTo },
        duration_days: Math.round((new Date(input.dateTo).getTime() - new Date(input.dateFrom).getTime()) / NIGHT_MS),
        activities: [],
        scenic_waypoints: [],
      });
      return trip;
    },
    errorMessage: 'Could not add the stop',
  });
}

interface UpdateStopVariables {
  patch: Partial<StopInput>;
  stopId: string;
}

export function useUpdateStop(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId, patch }: UpdateStopVariables) => updateStop(stopId, patch),
    patch: (trip, { stopId, patch }) => {
      trip.stops = trip.stops.map((stop) => {
        if (stop.stop_id !== stopId) {
          return stop;
        }
        return {
          ...stop,
          name: patch.name ?? stop.name,
          location: {
            lat: patch.lat ?? stop.location.lat,
            lng: patch.lng ?? stop.location.lng,
          },
          date: {
            from: patch.dateFrom ?? stop.date.from,
            to: patch.dateTo ?? stop.date.to,
          },
        };
      });
      return trip;
    },
    errorMessage: 'Could not save the stop',
  });
}

export function useDeleteStop(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId }: { stopId: string }) => deleteStop(stopId),
    patch: (trip, { stopId }) => {
      trip.stops = trip.stops.filter((stop) => stop.stop_id !== stopId);
      return trip;
    },
    errorMessage: 'Could not delete the stop',
  });
}

interface ApplyStopStructureVariables {
  stops: TripBase[]; // reordered and re-dated (recalculateStopDates output)
  tripEndDate: string;
  tripStartDate: string;
}

export function useApplyStopStructure(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stops, tripStartDate, tripEndDate }: ApplyStopStructureVariables) =>
      applyStopStructure(
        tripId,
        stops.map((stop, index) => ({
          id: stop.stop_id,
          sort_order: index,
          date_from: stop.date.from,
          date_to: stop.date.to,
        })),
        tripStartDate,
        tripEndDate
      ),
    patch: (trip, { stops }) => {
      trip.stops = stops;
      return trip;
    },
    errorMessage: 'Could not save the stop changes',
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
