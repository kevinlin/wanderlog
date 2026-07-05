import { getSupabase } from '@/config/supabase';
import type { TripData, TripSummary } from '@/types/trip';
import { TRIP_SELECT, TRIP_SUMMARY_SELECT, type TripRowNested, type TripSummaryRow, toTripData, toTripSummary } from './supabaseMappers';
import { insertTripBundle } from './tripBundleInsert';
import * as writes from './tripWrites';

export { TRIP_SELECT } from './supabaseMappers';
export type {
  AccommodationInput,
  ActivityInput,
  StopInput,
  StopStructureRow,
  TripMetadataPatch,
  WaypointInput,
} from './tripWrites';

// Thin browser adapter: binds the browser's singleton client to the shared,
// client-injected write module (tripWrites), keeping the browser-facing
// signatures that hooks and their tests depend on.

export async function fetchTripById(tripId: string): Promise<TripData | null> {
  const { data, error } = await getSupabase().from('trips').select(TRIP_SELECT).eq('id', tripId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? toTripData(data as TripRowNested) : null;
}

export async function fetchTripSummaries(): Promise<TripSummary[]> {
  const { data, error } = await getSupabase().from('trips').select(TRIP_SUMMARY_SELECT).order('start_date', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => toTripSummary(row as TripSummaryRow));
}

export const importTrip = (tripData: TripData): Promise<string> => insertTripBundle(getSupabase(), tripData);

// The DB cascade (M1 schema `on delete cascade`) removes stops, accommodations,
// activities, and waypoints - no client-side fan-out needed.
export const deleteTrip = (tripId: string): Promise<void> => writes.deleteById(getSupabase(), 'trips', tripId);

export const setActivityDone = (activityId: string, isDone: boolean): Promise<void> =>
  writes.setActivityDone(getSupabase(), activityId, isDone);

export const setWaypointDone = (waypointId: string, isDone: boolean): Promise<void> =>
  writes.setWaypointDone(getSupabase(), waypointId, isDone);

export const reorderActivities = (orderedActivityIds: string[]): Promise<void> =>
  writes.reorderActivities(getSupabase(), orderedActivityIds);

export const createActivity = (stopId: string, sortOrder: number, input: writes.ActivityInput): Promise<string> =>
  writes.createActivity(getSupabase(), stopId, sortOrder, input);

export const updateActivity = (activityId: string, input: writes.ActivityInput): Promise<void> =>
  writes.updateActivity(getSupabase(), activityId, input);

export const deleteActivity = (activityId: string): Promise<void> => writes.deleteById(getSupabase(), 'activities', activityId);

export const createWaypoint = (stopId: string, sortOrder: number, input: writes.WaypointInput): Promise<string> =>
  writes.createWaypoint(getSupabase(), stopId, sortOrder, input);

export const updateWaypoint = (waypointId: string, input: writes.WaypointInput): Promise<void> =>
  writes.updateWaypoint(getSupabase(), waypointId, input);

export const deleteWaypoint = (waypointId: string): Promise<void> => writes.deleteById(getSupabase(), 'scenic_waypoints', waypointId);

export const upsertAccommodation = (stopId: string, input: writes.AccommodationInput): Promise<void> =>
  writes.upsertAccommodation(getSupabase(), stopId, input);

export const createStop = (tripId: string, sortOrder: number, input: writes.StopInput): Promise<string> =>
  writes.createStop(getSupabase(), tripId, sortOrder, input);

export const updateStop = (stopId: string, patch: Partial<writes.StopInput>): Promise<void> =>
  writes.updateStop(getSupabase(), stopId, patch);

// DB cascade removes the stop's accommodation, activities and waypoints.
export const deleteStop = (stopId: string): Promise<void> => writes.deleteById(getSupabase(), 'stops', stopId);

export const applyStopStructure = (
  tripId: string,
  rows: writes.StopStructureRow[],
  tripStartDate: string,
  tripEndDate: string
): Promise<void> => writes.applyStopStructure(getSupabase(), tripId, rows, tripStartDate, tripEndDate);

export const updateTripMetadata = (tripId: string, patch: writes.TripMetadataPatch): Promise<void> =>
  writes.updateTripMetadata(getSupabase(), tripId, patch);
