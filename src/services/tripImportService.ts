import { toTripData, wanderlogTripSchema } from '@/schemas/tripFileSchemas';
import type { TripData } from '@/types/trip';

export interface ImportIssue {
  message: string;
  path: string;
}

export interface ImportPreview {
  activityCount: number;
  format: 'wanderlog' | 'tripit';
  stopCount: number;
  tripData: TripData;
  warnings: string[];
}

export type ParseResult = { ok: true; preview: ImportPreview } | { ok: false; errors: ImportIssue[] };

export type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>;

const UNKNOWN_FORMAT_MESSAGE =
  'Unrecognized file format. Supported: Wanderlog trip export (trip_name + stops) and TripIt export (trips list).';

export function detectFormat(raw: unknown): 'wanderlog' | 'tripit' | 'unknown' {
  if (!raw || typeof raw !== 'object') {
    return 'unknown';
  }
  const obj = raw as Record<string, unknown>;
  const candidate = (obj.tripData ?? obj) as Record<string, unknown>;
  if (candidate && typeof candidate === 'object' && 'trip_name' in candidate && 'stops' in candidate) {
    return 'wanderlog';
  }
  if (Array.isArray(obj.trips)) {
    return 'tripit';
  }
  return 'unknown';
}

export function withFreshIds(trip: TripData): TripData {
  return {
    ...trip,
    trip_id: crypto.randomUUID(),
    stops: trip.stops.map((stop) => ({
      ...stop,
      stop_id: crypto.randomUUID(),
      activities: stop.activities.map((activity) => ({ ...activity, activity_id: crypto.randomUUID() })),
      scenic_waypoints: (stop.scenic_waypoints ?? []).map((waypoint) => ({
        ...waypoint,
        activity_id: crypto.randomUUID(),
      })),
    })),
  };
}

const formatPath = (path: readonly PropertyKey[]): string => {
  const joined = path.reduce<string>(
    (acc, segment) => (typeof segment === 'number' ? `${acc}[${segment}]` : acc ? `${acc}.${String(segment)}` : String(segment)),
    ''
  );
  return joined || 'file';
};

const toIssues = (error: { issues: { path: readonly PropertyKey[]; message: string }[] }): ImportIssue[] =>
  error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));

const toPreview = (tripData: TripData, format: 'wanderlog' | 'tripit', warnings: string[]): ImportPreview => ({
  tripData: withFreshIds(tripData),
  format,
  warnings,
  stopCount: tripData.stops.length,
  activityCount: tripData.stops.reduce((sum, stop) => sum + stop.activities.length, 0),
});

export async function parseTripFile(text: string, geocode: GeocodeFn): Promise<ParseResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: 'file', message: 'not valid JSON' }] };
  }

  const format = detectFormat(raw);
  if (format === 'unknown') {
    return { ok: false, errors: [{ path: 'file', message: UNKNOWN_FORMAT_MESSAGE }] };
  }

  if (format === 'wanderlog') {
    const candidate = ((raw as Record<string, unknown>).tripData ?? raw) as Record<string, unknown>;
    const parsed = wanderlogTripSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, errors: toIssues(parsed.error) };
    }
    return { ok: true, preview: toPreview(toTripData(parsed.data), 'wanderlog', []) };
  }

  return parseTripitFile(raw, geocode);
}

// Implemented in Task 3; keeping the native path shippable on its own.
function parseTripitFile(_raw: unknown, _geocode: GeocodeFn): Promise<ParseResult> {
  return Promise.resolve({
    ok: false,
    errors: [{ path: 'file', message: 'TripIt import not available yet' }],
  });
}
