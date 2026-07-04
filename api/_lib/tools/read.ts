// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import { z } from 'zod';
import {
  TRIP_SELECT,
  TRIP_SUMMARY_SELECT,
  type TripRowNested,
  type TripSummaryRow,
  toTripData,
  toTripSummary,
} from '../../../src/services/supabaseMappers.js';
import type { AgentTool } from './core.js';

const listTripsSchema = z.object({}).strict();
const getTripSchema = z.object({ trip_id: z.string().min(1) }).strict();

export const READ_TOOLS: AgentTool[] = [
  {
    name: 'list_trips',
    description:
      'List all trips in the library with id, name, destination, date range, and timezone. Call this to discover trip ids before reading a specific trip.',
    schema: listTripsSchema,
    execute: async (client) => {
      const { data, error } = await client.from('trips').select(TRIP_SUMMARY_SELECT).order('start_date', { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => toTripSummary(row as unknown as TripSummaryRow));
    },
  },
  {
    name: 'get_trip',
    description:
      'Read one full trip by id: all stops with dates and coordinates, accommodations, activities (with done status), and scenic waypoints.',
    schema: getTripSchema,
    execute: async (client, input) => {
      const { data, error } = await client
        .from('trips')
        .select(TRIP_SELECT)
        .eq('id', input.trip_id as string)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? toTripData(data as unknown as TripRowNested) : { error: `No trip found with id ${input.trip_id}` };
    },
  },
];
