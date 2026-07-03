import { getSupabase } from '@/config/supabase';
import type { TripSummary } from '@/contexts/AppStateContext';
import type { TripData } from '@/types/trip';
import { type TripRowNested, toTripData } from './supabaseMappers';

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
    .select('id, name, timezone, created_at, updated_at')
    .order('start_date', { ascending: false });
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    trip_id: row.id,
    trip_name: row.name,
    timezone: row.timezone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
