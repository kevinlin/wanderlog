import { getSupabase } from '@/config/supabase';
import type { TripData, TripSummary } from '@/types/trip';
import { buildRows, type TripRowNested, toTripData } from './supabaseMappers';

export const TRIP_SELECT = '*, stops(*, accommodations(*), activities(*), scenic_waypoints(*))';

export async function fetchTripById(tripId: string): Promise<TripData | null> {
  const { data, error } = await getSupabase().from('trips').select(TRIP_SELECT).eq('id', tripId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data ? toTripData(data as TripRowNested) : null;
}

export async function fetchTripSummaries(): Promise<TripSummary[]> {
  const { data, error } = await getSupabase()
    .from('trips')
    .select('id, name, destination, start_date, end_date, timezone, created_at, updated_at')
    .order('start_date', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    trip_id: row.id,
    trip_name: row.name,
    destination: row.destination,
    start_date: row.start_date,
    end_date: row.end_date,
    timezone: row.timezone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function importTrip(tripData: TripData): Promise<string> {
  const tripId = tripData.trip_id ?? crypto.randomUUID();
  const bundle = buildRows(tripData, tripId);
  const insert = async (table: string, rows: object[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    const { error } = await getSupabase().from(table).insert(rows);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert('trips', [bundle.trip]);
  try {
    await insert('stops', bundle.stops);
    await insert('accommodations', bundle.accommodations);
    await insert('activities', bundle.activities);
    await insert('scenic_waypoints', bundle.scenicWaypoints);
  } catch (error) {
    // Compensation: removing the trip row cascades to any children already inserted.
    await getSupabase().from('trips').delete().eq('id', tripId);
    throw error;
  }
  return tripId;
}

// The DB cascade (M1 schema `on delete cascade`) removes stops, accommodations,
// activities, and waypoints - no client-side fan-out needed.
export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await getSupabase().from('trips').delete().eq('id', tripId);
  if (error) {
    throw new Error(error.message);
  }
}

async function updateById(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().from(table).update(patch).eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export const setActivityDone = (activityId: string, isDone: boolean): Promise<void> =>
  updateById('activities', activityId, { is_done: isDone });

export const setWaypointDone = (waypointId: string, isDone: boolean): Promise<void> =>
  updateById('scenic_waypoints', waypointId, { is_done: isDone });

// Per-row updates are fine at family scale (a stop has under 20 activities);
// a batch RPC is deliberate YAGNI.
export async function reorderActivities(orderedActivityIds: string[]): Promise<void> {
  await Promise.all(orderedActivityIds.map((id, index) => updateById('activities', id, { sort_order: index })));
}
