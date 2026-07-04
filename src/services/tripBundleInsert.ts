import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripData } from '@/types/trip';
// Explicit .js extension: reachable from api/ (Node ESM runtime).
import { buildRows } from './supabaseMappers.js';

// Pure module (client injected) so both the browser importTrip path and the
// api/ create_trip tool share one FK-ordered, all-or-nothing insert pipeline.
export async function insertTripBundle(client: SupabaseClient, tripData: TripData, overrides?: { destination?: string }): Promise<string> {
  const tripId = tripData.trip_id ?? crypto.randomUUID();
  const bundle = buildRows(tripData, tripId);
  const insert = async (table: string, rows: object[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    const { error } = await client.from(table).insert(rows);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert('trips', [{ ...bundle.trip, destination: overrides?.destination ?? bundle.trip.destination }]);
  try {
    await insert('stops', bundle.stops);
    await insert('accommodations', bundle.accommodations);
    await insert('activities', bundle.activities);
    await insert('scenic_waypoints', bundle.scenicWaypoints);
  } catch (error) {
    // Compensation: removing the trip row cascades to any children already inserted.
    await client.from('trips').delete().eq('id', tripId);
    throw error;
  }
  return tripId;
}
