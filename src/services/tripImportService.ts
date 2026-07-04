import { differenceInCalendarDays } from 'date-fns';
import type { Activity, TripBase, TripData } from '@/types/trip';
// Relative imports with explicit .js extensions: this module is reachable from
// api/ (create_trip uses withFreshIds), whose Node ESM runtime cannot resolve
// the @/ alias.
import { toTripData, wanderlogTripSchema } from '../schemas/tripFileSchemas.js';
import { type TripitFile, type TripitFlight, type TripitLodging, type TripitTrip, tripitFileSchema } from '../schemas/tripitSchemas.js';

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

const MONTHS: Record<string, string> = {
  Jan: '01',
  Feb: '02',
  Mar: '03',
  Apr: '04',
  May: '05',
  Jun: '06',
  Jul: '07',
  Aug: '08',
  Sep: '09',
  Oct: '10',
  Nov: '11',
  Dec: '12',
};

// "Mon, May 12, 2025 3:00 PM CEST" / "Fri, Feb 5, 2027 3:00 PM GMT+8"
const DATETIME_RE = /([A-Z][a-z]{2}) (\d{1,2}),? (\d{4})\s+(\d{1,2}):(\d{2}) (AM|PM)/;
const HOURS_HALF_DAY = 12;

export function parseTripitDateTime(text: string): { date: string; time: string } | null {
  const match = DATETIME_RE.exec(text);
  if (!match) {
    return null;
  }
  const [, monthName, day, year, rawHour, minute, meridiem] = match;
  const month = MONTHS[monthName];
  if (!month) {
    return null;
  }
  let hour = Number(rawHour) % HOURS_HALF_DAY;
  if (meridiem === 'PM') {
    hour += HOURS_HALF_DAY;
  }
  return {
    date: `${year}-${month}-${day.padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${minute}`,
  };
}

// "Check in Fri, Feb 5, 2027 3:00 PM GMT+8 Check out Tue, Feb 9, 2027 11:00 AM GMT+8"
const CHECK_TEXT_RE = /Check in (.+?)\s*Check out (.+)$/;

const lodgingCheckTimes = (lodging: TripitLodging): { checkIn: string | null; checkOut: string | null } => {
  if (lodging.checkIn || lodging.checkOut) {
    return { checkIn: lodging.checkIn ?? null, checkOut: lodging.checkOut ?? null };
  }
  const match = lodging.checkInText ? CHECK_TEXT_RE.exec(lodging.checkInText) : null;
  return match ? { checkIn: match[1], checkOut: match[2] } : { checkIn: null, checkOut: null };
};

// "Singapore May 11Terminal 2 11:30 PM GMT+8" → month + day; year resolved from the
// trip start date, rolling over New Year if the resulting date precedes the trip start.
const MONTH_DAY_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})/;

const flightDate = (flight: TripitFlight, trip: TripitTrip): string | null => {
  const match = flight.departureText ? MONTH_DAY_RE.exec(flight.departureText) : null;
  if (!match) {
    return null;
  }
  const [, monthName, day] = match;
  const year = trip.startDate.slice(0, 4);
  const candidate = `${year}-${MONTHS[monthName]}-${day.padStart(2, '0')}`;
  return candidate < trip.startDate ? `${Number(year) + 1}${candidate.slice(4)}` : candidate;
};

const flightToActivity = (flight: TripitFlight): Activity => {
  const route = flight.route?.replace(' ', ' → ') ?? '';
  const label = flight.flightNumber ?? flight.title ?? 'Flight';
  const legs = [flight.departureText, flight.arrivalText].filter(Boolean).join(' → ');
  return {
    activity_id: '',
    activity_name: route ? `${label}: ${route}` : label,
    activity_type: 'transport',
    remarks: [flight.airline, legs].filter(Boolean).join('. '),
    status: { done: false },
  };
};

const nearestStopIndex = (stops: TripBase[], date: string): number => {
  const contained = stops.findIndex((stop) => stop.date.from <= date && date <= stop.date.to);
  if (contained !== -1) {
    return contained;
  }
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  stops.forEach((stop, index) => {
    const distance = Math.min(
      Math.abs(Date.parse(stop.date.from) - Date.parse(date)),
      Math.abs(Date.parse(stop.date.to) - Date.parse(date))
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
};

// TripIt addresses separate segments with " - " or commas; split into trimmed segments
// (spaces around the dash keep street numbers like "4-10" intact).
const addressSegments = (address: string): string[] =>
  address
    .split(/\s+-\s+|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);

// Geocode queries from most to least precise: exact address, comma-normalized address,
// lodging name + town, town/city segments alone, then the trip's primary location.
const geocodeQueries = (lodging: TripitLodging, trip: TripitTrip): string[] => {
  const queries: string[] = [];
  if (lodging.address) {
    const segments = addressSegments(lodging.address);
    queries.push(lodging.address, segments.join(', '));
    if (segments.length > 1) {
      const locality = segments.slice(1).join(', ');
      queries.push(`${lodging.title}, ${locality}`, locality);
    }
  }
  if (trip.primaryLocation) {
    queries.push(`${lodging.title}, ${trip.primaryLocation}`, trip.primaryLocation);
  }
  if (queries.length === 0) {
    queries.push(lodging.title);
  }
  return [...new Set(queries)];
};

interface GeocodeAttempt {
  coords: { lat: number; lng: number } | null;
  serviceError: string | null;
  usedQuery: string | null;
}

const geocodeWithFallback = async (queries: string[], geocode: GeocodeFn): Promise<GeocodeAttempt> => {
  for (const query of queries) {
    try {
      const coords = await geocode(query);
      if (coords) {
        return { coords, usedQuery: query, serviceError: null };
      }
    } catch (error) {
      // Service-level failure (denied key, quota, network): retrying coarser queries won't help.
      return {
        coords: null,
        usedQuery: null,
        serviceError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  return { coords: null, usedQuery: null, serviceError: null };
};

const lodgingToStop = async (
  lodging: TripitLodging,
  trip: TripitTrip,
  geocode: GeocodeFn,
  warnings: string[]
): Promise<{ stop: TripBase | null; error: string | null }> => {
  const address = lodging.address ?? lodging.title;
  const queries = geocodeQueries(lodging, trip);
  const { coords, usedQuery, serviceError } = await geocodeWithFallback(queries, geocode);
  if (serviceError) {
    return { stop: null, error: `Geocoding failed for "${lodging.title}": ${serviceError}` };
  }
  if (!coords) {
    return { stop: null, error: `Could not locate "${address}" for stop "${lodging.title}"` };
  }
  if (usedQuery !== queries[0]) {
    warnings.push(`Could not pinpoint "${queries[0]}"; using approximate location "${usedQuery}" for "${lodging.title}".`);
  }
  const { checkIn, checkOut } = lodgingCheckTimes(lodging);
  const parsedIn = checkIn ? parseTripitDateTime(checkIn) : null;
  const parsedOut = checkOut ? parseTripitDateTime(checkOut) : null;
  if (!(parsedIn && parsedOut)) {
    warnings.push(`Check-in/check-out times unreadable for "${lodging.title}"; using the trip date range.`);
  }
  const from = parsedIn?.date ?? trip.startDate;
  const to = parsedOut?.date ?? trip.endDate;
  return {
    stop: {
      stop_id: '',
      name: lodging.title,
      date: { from, to },
      location: coords,
      duration_days: differenceInCalendarDays(new Date(`${to}T00:00:00`), new Date(`${from}T00:00:00`)),
      accommodation: {
        name: lodging.title,
        address: lodging.address ?? '',
        check_in: parsedIn ? `${parsedIn.date} ${parsedIn.time}` : '',
        check_out: parsedOut ? `${parsedOut.date} ${parsedOut.time}` : '',
        confirmation: lodging.confirmation ?? undefined,
        url: lodging.website ?? undefined,
        phone: lodging.phone ?? undefined,
      },
      activities: [],
      scenic_waypoints: [],
    },
    error: null,
  };
};

export async function tripitToTripData(
  file: TripitFile,
  geocode: GeocodeFn
): Promise<{ tripData: TripData | null; warnings: string[]; errors: ImportIssue[] }> {
  const warnings: string[] = [];
  const errors: ImportIssue[] = [];
  const trip = file.trips[0];
  if (file.trips.length > 1) {
    warnings.push(`File contains ${file.trips.length} trips; importing "${trip.name}".`);
  }
  if (trip.lodging.length === 0) {
    return {
      tripData: null,
      warnings,
      errors: [{ path: 'trips[0].lodging', message: 'No lodging found - cannot derive stops' }],
    };
  }

  const stops: TripBase[] = [];
  for (const [index, lodging] of trip.lodging.entries()) {
    const { stop, error } = await lodgingToStop(lodging, trip, geocode, warnings);
    if (stop) {
      stops.push(stop);
    } else if (error) {
      errors.push({ path: `trips[0].lodging[${index}]`, message: error });
    }
  }

  if (errors.length > 0) {
    return { tripData: null, warnings, errors };
  }

  stops.sort((a, b) => a.date.from.localeCompare(b.date.from));

  for (const flight of trip.flights) {
    const date = flightDate(flight, trip);
    const stopIndex = date ? nearestStopIndex(stops, date) : 0;
    const activity = flightToActivity(flight);
    activity.order = stops[stopIndex].activities.length;
    stops[stopIndex].activities.push(activity);
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  warnings.push(`No timezone in TripIt exports - using this device's timezone (${timezone}).`);

  return {
    tripData: { trip_name: trip.name, timezone, stops },
    warnings,
    errors,
  };
}

async function parseTripitFile(raw: unknown, geocode: GeocodeFn): Promise<ParseResult> {
  const parsed = tripitFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: toIssues(parsed.error) };
  }
  const { tripData, warnings, errors } = await tripitToTripData(parsed.data, geocode);
  if (!tripData || errors.length > 0) {
    return { ok: false, errors };
  }
  // Final gate: converted output passes the same schema as native files.
  const validated = wanderlogTripSchema.safeParse(tripData);
  if (!validated.success) {
    return { ok: false, errors: toIssues(validated.error) };
  }
  return { ok: true, preview: toPreview(toTripData(validated.data), 'tripit', warnings) };
}
