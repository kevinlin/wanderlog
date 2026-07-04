import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import {
  accommodationSchema,
  activitySchema,
  dateString,
  toTripData,
  wanderlogTripSchema,
  waypointSchema,
} from '../../../src/schemas/tripFileSchemas.js';
import { insertTripBundle } from '../../../src/services/tripBundleInsert.js';
import { withFreshIds } from '../../../src/services/tripImportService.js';
import type { AgentTool } from './core.js';

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

// Mirrors the trip JSON the model reads from get_trip. The file-import
// accommodation preprocess wrapper is deliberately not reused: its transform
// has no stable JSON Schema form. The canonical wanderlogTripSchema still
// validates every bundle inside the executor.
const agentStopSchema = z.object({
  name: z.string().min(1),
  date: z.object({ from: dateString, to: dateString }),
  location: z
    .object({ lat: z.number().min(LAT_MIN).max(LAT_MAX), lng: z.number().min(LNG_MIN).max(LNG_MAX) })
    .describe('Coordinates returned by the geocode tool - never guessed'),
  travel_time_from_previous: z.string().optional(),
  accommodation: accommodationSchema.optional(),
  activities: z.array(activitySchema).default([]),
  scenic_waypoints: z.array(waypointSchema).default([]),
});

const createTripSchema = z
  .object({
    trip_name: z.string().min(1),
    destination: z.string().min(1).describe('Shown in the trip library, e.g. "Tokyo, Japan"'),
    timezone: z.string().min(1).describe('IANA timezone of the destination, e.g. "Asia/Tokyo"'),
    stops: z.array(agentStopSchema).min(1).describe("Contiguous chain: each stop's date.from equals the previous stop's date.to"),
  })
  .strict();

export const CREATE_TRIP_TOOL: AgentTool = {
  name: 'create_trip',
  description:
    'Create a complete new trip from a full itinerary: stops (each with geocoded coordinates, dates, optional accommodation), activities, and scenic waypoints. All ids are generated server-side. Call at most once per request, after geocoding every stop location. The insert is all-or-nothing.',
  schema: createTripSchema,
  execute: async (client, input) => {
    const { destination, ...tripFields } = input as z.infer<typeof createTripSchema>;
    const validated = wanderlogTripSchema.safeParse(tripFields); // same gate as file import (Req 5.4)
    if (!validated.success) {
      throw new Error(
        `Trip failed validation: ${validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
      );
    }
    const trip = withFreshIds(toTripData(validated.data));
    const tripId = await insertTripBundle(client, trip, { destination });
    const activitiesWithoutCoordinates = trip.stops.flatMap((stop) =>
      stop.activities
        .filter((activity) => activity.location?.lat === undefined || activity.location?.lng === undefined)
        .map((activity) => activity.activity_name)
    );
    return {
      trip_id: tripId,
      trip_name: trip.trip_name,
      stop_count: trip.stops.length,
      activity_count: trip.stops.reduce((sum, stop) => sum + stop.activities.length, 0),
      activities_without_coordinates: activitiesWithoutCoordinates,
    };
  },
  toChanges: (_input, output) => {
    const o = output as { trip_id: string; trip_name: string };
    return [{ op: 'created', entity: 'trip', id: o.trip_id, name: o.trip_name }];
  },
};
