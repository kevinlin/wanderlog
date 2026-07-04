import { getSupabase } from '@/config/supabase';
import type { TripData, TripSummary } from '@/types/trip';
import {
  buildRows,
  TRIP_SELECT,
  TRIP_SUMMARY_SELECT,
  type TripRowNested,
  type TripSummaryRow,
  toTripData,
  toTripSummary,
} from './supabaseMappers';

export { TRIP_SELECT } from './supabaseMappers';

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
export const deleteTrip = (tripId: string): Promise<void> => deleteById('trips', tripId);

async function updateById(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().from(table).update(patch).eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

async function deleteById(table: string, id: string): Promise<void> {
  const { error } = await getSupabase().from(table).delete().eq('id', id);
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

export interface ActivityInput {
  address?: string;
  duration?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  name: string;
  remarks?: string;
  thumbnailUrl?: string;
  type?: string;
  url?: string;
}

const activityInputToRow = (input: ActivityInput) => ({
  name: input.name,
  type: input.type ?? null,
  lat: input.lat ?? null,
  lng: input.lng ?? null,
  address: input.address ?? null,
  duration: input.duration ?? null,
  url: input.url ?? null,
  remarks: input.remarks ?? null,
  thumbnail_url: input.thumbnailUrl ?? null,
  google_place_id: input.googlePlaceId ?? null,
});

export async function createActivity(stopId: string, sortOrder: number, input: ActivityInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await getSupabase()
    .from('activities')
    .insert({ id, stop_id: stopId, sort_order: sortOrder, is_done: false, ...activityInputToRow(input) });
  if (error) {
    throw new Error(error.message);
  }
  return id;
}

export const updateActivity = (activityId: string, input: ActivityInput): Promise<void> =>
  updateById('activities', activityId, activityInputToRow(input));

export const deleteActivity = (activityId: string): Promise<void> => deleteById('activities', activityId);

// ActivityInput minus type/travel-time; scenic_waypoints has no such columns.
export interface WaypointInput {
  address?: string;
  duration?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  name: string;
  remarks?: string;
  thumbnailUrl?: string;
  url?: string;
}

const waypointInputToRow = (input: WaypointInput) => ({
  name: input.name,
  lat: input.lat ?? null,
  lng: input.lng ?? null,
  address: input.address ?? null,
  duration: input.duration ?? null,
  url: input.url ?? null,
  remarks: input.remarks ?? null,
  thumbnail_url: input.thumbnailUrl ?? null,
  google_place_id: input.googlePlaceId ?? null,
});

export async function createWaypoint(stopId: string, sortOrder: number, input: WaypointInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await getSupabase()
    .from('scenic_waypoints')
    .insert({ id, stop_id: stopId, sort_order: sortOrder, is_done: false, ...waypointInputToRow(input) });
  if (error) {
    throw new Error(error.message);
  }
  return id;
}

export const updateWaypoint = (waypointId: string, input: WaypointInput): Promise<void> =>
  updateById('scenic_waypoints', waypointId, waypointInputToRow(input));

export const deleteWaypoint = (waypointId: string): Promise<void> => deleteById('scenic_waypoints', waypointId);

export interface AccommodationInput {
  address?: string;
  checkIn?: string; // 'YYYY-MM-DD HH:mm'
  checkOut?: string;
  confirmation?: string;
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
  name: string;
  remarks?: string;
  url?: string;
}

// Upsert (not update) because a stop may have no accommodation yet - the same
// edit modal covers add and edit. The id is deterministic, matching the
// migration script convention.
export async function upsertAccommodation(stopId: string, input: AccommodationInput): Promise<void> {
  const { error } = await getSupabase()
    .from('accommodations')
    .upsert(
      {
        id: `${stopId}_accommodation`,
        stop_id: stopId,
        name: input.name,
        address: input.address ?? null,
        check_in: input.checkIn ?? null,
        check_out: input.checkOut ?? null,
        remarks: input.remarks ?? null,
        url: input.url ?? null,
        confirmation: input.confirmation ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        google_place_id: input.googlePlaceId ?? null,
      },
      { onConflict: 'id' }
    );
  if (error) {
    throw new Error(error.message);
  }
}

export interface StopInput {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  lat: number;
  lng: number;
  name: string;
}

const nightsBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / (24 * 60 * 60 * 1000));

export async function createStop(tripId: string, sortOrder: number, input: StopInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await getSupabase()
    .from('stops')
    .insert({
      id,
      trip_id: tripId,
      sort_order: sortOrder,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      date_from: input.dateFrom,
      date_to: input.dateTo,
      duration_days: nightsBetween(input.dateFrom, input.dateTo),
    });
  if (error) {
    throw new Error(error.message);
  }
  return id;
}

export async function updateStop(stopId: string, patch: Partial<StopInput>): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    row.name = patch.name;
  }
  if (patch.lat !== undefined) {
    row.lat = patch.lat;
  }
  if (patch.lng !== undefined) {
    row.lng = patch.lng;
  }
  if (patch.dateFrom !== undefined) {
    row.date_from = patch.dateFrom;
  }
  if (patch.dateTo !== undefined) {
    row.date_to = patch.dateTo;
  }
  await updateById('stops', stopId, row);
}

// DB cascade removes the stop's accommodation, activities and waypoints.
export const deleteStop = (stopId: string): Promise<void> => deleteById('stops', stopId);

export interface StopStructureRow {
  date_from: string;
  date_to: string;
  id: string;
  sort_order: number;
}

// Batches a restructure: per-row order/date updates, then the trip's date
// span. When stops exist, restructuring recomputes the trip span; direct
// metadata date edits set the trip dates but never move stops. Last write
// wins between the two, by design.
export async function applyStopStructure(
  tripId: string,
  rows: StopStructureRow[],
  tripStartDate: string,
  tripEndDate: string
): Promise<void> {
  await Promise.all(
    rows.map((row) =>
      updateById('stops', row.id, {
        sort_order: row.sort_order,
        date_from: row.date_from,
        date_to: row.date_to,
        duration_days: nightsBetween(row.date_from, row.date_to),
      })
    )
  );
  await updateById('trips', tripId, { start_date: tripStartDate, end_date: tripEndDate });
}

export interface TripMetadataPatch {
  description?: string | null;
  endDate?: string;
  name?: string;
  startDate?: string;
}

export async function updateTripMetadata(tripId: string, patch: TripMetadataPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    row.name = patch.name;
  }
  if (patch.description !== undefined) {
    row.description = patch.description;
  }
  if (patch.startDate !== undefined) {
    row.start_date = patch.startDate;
  }
  if (patch.endDate !== undefined) {
    row.end_date = patch.endDate;
  }
  await updateById('trips', tripId, row);
}
