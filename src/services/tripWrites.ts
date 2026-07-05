import type { SupabaseClient } from '@supabase/supabase-js';
// Explicit .js extension: reachable from api/ (Node ESM runtime).
import {
  ACCOMMODATION_COLUMNS,
  ACTIVITY_COLUMNS,
  accommodationId,
  CREATE_DEFAULTS,
  denseRow,
  nightsBetween,
  patchRow,
  STOP_COLUMNS,
  TRIP_METADATA_COLUMNS,
  WAYPOINT_COLUMNS,
} from './entityRows.js';

// Deep, client-injected write module shared by the browser service and the
// api/ agent tools (mirroring tripBundleInsert): no @/config import, the two
// adapters bind their own SupabaseClient. Consumes entityRows for column
// mapping; callers pick dense (full-form) or sparse (patch) semantics.

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

export interface StopInput {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  lat: number;
  lng: number;
  name: string;
}

export interface StopStructureRow {
  date_from: string;
  date_to: string;
  id: string;
  sort_order: number;
}

export interface TripMetadataPatch {
  description?: string | null;
  endDate?: string;
  name?: string;
  startDate?: string;
}

export async function updateById(client: SupabaseClient, table: string, id: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await client.from(table).update(row).eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteById(client: SupabaseClient, table: string, id: string): Promise<void> {
  const { error } = await client.from(table).delete().eq('id', id);
  if (error) {
    throw new Error(error.message);
  }
}

async function insertRow(client: SupabaseClient, table: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await client.from(table).insert(row);
  if (error) {
    throw new Error(error.message);
  }
}

export const setActivityDone = (client: SupabaseClient, activityId: string, isDone: boolean): Promise<void> =>
  updateById(client, 'activities', activityId, { is_done: isDone });

export const setWaypointDone = (client: SupabaseClient, waypointId: string, isDone: boolean): Promise<void> =>
  updateById(client, 'scenic_waypoints', waypointId, { is_done: isDone });

// Per-row updates are fine at family scale (a stop has under 20 activities);
// a batch RPC is deliberate YAGNI.
export async function reorderActivities(client: SupabaseClient, orderedActivityIds: string[]): Promise<void> {
  await Promise.all(orderedActivityIds.map((id, index) => updateById(client, 'activities', id, { sort_order: index })));
}

export async function createActivity(client: SupabaseClient, stopId: string, sortOrder: number, input: ActivityInput): Promise<string> {
  const id = crypto.randomUUID();
  await insertRow(client, 'activities', {
    id,
    stop_id: stopId,
    sort_order: sortOrder,
    ...CREATE_DEFAULTS,
    ...denseRow(ACTIVITY_COLUMNS, input),
  });
  return id;
}

export const updateActivity = (client: SupabaseClient, activityId: string, input: ActivityInput): Promise<void> =>
  updateById(client, 'activities', activityId, denseRow(ACTIVITY_COLUMNS, input));

export async function createWaypoint(client: SupabaseClient, stopId: string, sortOrder: number, input: WaypointInput): Promise<string> {
  const id = crypto.randomUUID();
  await insertRow(client, 'scenic_waypoints', {
    id,
    stop_id: stopId,
    sort_order: sortOrder,
    ...CREATE_DEFAULTS,
    ...denseRow(WAYPOINT_COLUMNS, input),
  });
  return id;
}

export const updateWaypoint = (client: SupabaseClient, waypointId: string, input: WaypointInput): Promise<void> =>
  updateById(client, 'scenic_waypoints', waypointId, denseRow(WAYPOINT_COLUMNS, input));

// Upsert (not update) because a stop may have no accommodation yet - the same
// edit modal covers add and edit. The id is deterministic, matching the
// migration script convention.
export async function upsertAccommodation(client: SupabaseClient, stopId: string, input: AccommodationInput): Promise<void> {
  const { error } = await client
    .from('accommodations')
    .upsert({ id: accommodationId(stopId), stop_id: stopId, ...denseRow(ACCOMMODATION_COLUMNS, input) }, { onConflict: 'id' });
  if (error) {
    throw new Error(error.message);
  }
}

export async function createStop(client: SupabaseClient, tripId: string, sortOrder: number, input: StopInput): Promise<string> {
  const id = crypto.randomUUID();
  const row = denseRow(STOP_COLUMNS, input);
  await insertRow(client, 'stops', {
    id,
    trip_id: tripId,
    sort_order: sortOrder,
    ...row,
    duration_days: nightsBetween(row.date_from as string, row.date_to as string),
  });
  return id;
}

export const updateStop = (client: SupabaseClient, stopId: string, patch: Partial<StopInput>): Promise<void> =>
  updateById(client, 'stops', stopId, patchRow(STOP_COLUMNS, patch));

// Batches a restructure: per-row order/date updates, then the trip's date
// span. When stops exist, restructuring recomputes the trip span; direct
// metadata date edits set the trip dates but never move stops. Last write
// wins between the two, by design.
export async function applyStopStructure(
  client: SupabaseClient,
  tripId: string,
  rows: StopStructureRow[],
  tripStartDate: string,
  tripEndDate: string
): Promise<void> {
  await Promise.all(
    rows.map((row) =>
      updateById(client, 'stops', row.id, {
        sort_order: row.sort_order,
        date_from: row.date_from,
        date_to: row.date_to,
        duration_days: nightsBetween(row.date_from, row.date_to),
      })
    )
  );
  await updateById(client, 'trips', tripId, { start_date: tripStartDate, end_date: tripEndDate });
}

export const updateTripMetadata = (client: SupabaseClient, tripId: string, patch: TripMetadataPatch): Promise<void> =>
  updateById(client, 'trips', tripId, patchRow(TRIP_METADATA_COLUMNS, patch));
