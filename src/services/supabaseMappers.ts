import type { ScenicWaypoint } from '@/types/map';
import type { Accommodation, Activity, TripBase, TripData } from '@/types/trip';

export interface TripRow {
  created_at: string;
  description: string | null;
  destination: string | null;
  end_date: string;
  id: string;
  name: string;
  start_date: string;
  timezone: string;
  updated_at: string;
}

export interface StopRow {
  created_at: string;
  date_from: string;
  date_to: string;
  duration_days: number | null;
  id: string;
  lat: number;
  lng: number;
  name: string;
  sort_order: number;
  travel_time_from_previous: string | null;
  trip_id: string;
  updated_at: string;
}

export interface AccommodationRow {
  address: string | null;
  check_in: string | null;
  check_out: string | null;
  confirmation: string | null;
  created_at: string;
  google_place_id: string | null;
  id: string;
  lat: number | null;
  lng: number | null;
  name: string;
  remarks: string | null;
  stop_id: string;
  thumbnail_url: string | null;
  updated_at: string;
  url: string | null;
}

export interface ActivityRow {
  address: string | null;
  created_at: string;
  duration: string | null;
  google_place_id: string | null;
  id: string;
  is_done: boolean;
  lat: number | null;
  lng: number | null;
  name: string;
  remarks: string | null;
  sort_order: number;
  stop_id: string;
  thumbnail_url: string | null;
  travel_time_from_accommodation: string | null;
  type: string | null;
  updated_at: string;
  url: string | null;
}

export type ScenicWaypointRow = Omit<ActivityRow, 'type' | 'travel_time_from_accommodation'>;

export interface StopRowNested extends StopRow {
  accommodations: AccommodationRow[] | AccommodationRow | null;
  activities: ActivityRow[];
  scenic_waypoints: ScenicWaypointRow[];
}

export interface TripRowNested extends TripRow {
  stops: StopRowNested[];
}

export interface RowBundle {
  accommodations: AccommodationRow[];
  activities: ActivityRow[];
  scenicWaypoints: ScenicWaypointRow[];
  stops: StopRow[];
  trip: TripRow;
}

const toLocation = (row: { lat: number | null; lng: number | null; address: string | null }) => {
  if (row.lat === null && row.lng === null && row.address === null) {
    return;
  }
  return {
    ...(row.lat === null ? {} : { lat: row.lat }),
    ...(row.lng === null ? {} : { lng: row.lng }),
    ...(row.address === null ? {} : { address: row.address }),
  };
};

const orNothing = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

const toActivity = (row: ActivityRow): Activity => ({
  activity_id: row.id,
  activity_name: row.name,
  activity_type: orNothing(row.type) as Activity['activity_type'],
  location: toLocation(row),
  duration: orNothing(row.duration),
  travel_time_from_accommodation: orNothing(row.travel_time_from_accommodation),
  url: orNothing(row.url),
  remarks: orNothing(row.remarks),
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
  order: row.sort_order,
  status: { done: row.is_done },
});

const toScenicWaypoint = (row: ScenicWaypointRow): ScenicWaypoint => ({
  activity_id: row.id,
  activity_name: row.name,
  location: toLocation(row) ?? {},
  duration: orNothing(row.duration),
  url: orNothing(row.url),
  remarks: orNothing(row.remarks),
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
  status: { done: row.is_done },
});

const toAccommodation = (row: AccommodationRow): Accommodation => ({
  name: row.name,
  address: row.address ?? '',
  check_in: row.check_in ?? '',
  check_out: row.check_out ?? '',
  confirmation: orNothing(row.confirmation),
  url: orNothing(row.url),
  remarks: orNothing(row.remarks),
  location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : undefined,
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
});

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

const singleAccommodation = (value: AccommodationRow[] | AccommodationRow | null): AccommodationRow | undefined => {
  if (value === null) {
    return;
  }
  return Array.isArray(value) ? value[0] : value;
};

const toTripBase = (row: StopRowNested): TripBase => {
  const accommodationRow = singleAccommodation(row.accommodations);
  return {
    stop_id: row.id,
    name: row.name,
    date: { from: row.date_from, to: row.date_to },
    location: { lat: row.lat, lng: row.lng },
    duration_days: row.duration_days ?? 0,
    travel_time_from_previous: orNothing(row.travel_time_from_previous),
    accommodation: accommodationRow ? toAccommodation(accommodationRow) : undefined,
    activities: [...row.activities].sort(bySortOrder).map(toActivity),
    scenic_waypoints: [...row.scenic_waypoints].sort(bySortOrder).map(toScenicWaypoint),
  };
};

export const toTripData = (row: TripRowNested): TripData => ({
  trip_id: row.id,
  trip_name: row.name,
  timezone: row.timezone,
  stops: [...row.stops].sort(bySortOrder).map(toTripBase),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const buildRows = (trip: TripData, tripId: string): RowBundle => {
  const now = new Date().toISOString();
  const stops: StopRow[] = [];
  const accommodations: AccommodationRow[] = [];
  const activities: ActivityRow[] = [];
  const scenicWaypoints: ScenicWaypointRow[] = [];

  trip.stops.forEach((stop, stopIndex) => {
    stops.push({
      id: stop.stop_id,
      trip_id: tripId,
      name: stop.name,
      date_from: stop.date.from,
      date_to: stop.date.to,
      lat: stop.location.lat,
      lng: stop.location.lng,
      duration_days: stop.duration_days ?? null,
      travel_time_from_previous: stop.travel_time_from_previous ?? null,
      sort_order: stopIndex,
      created_at: now,
      updated_at: now,
    });
    // Legacy JSON can carry a degenerate empty accommodation object; a row
    // without a name is meaningless and violates the schema's NOT NULL.
    if (stop.accommodation?.name) {
      accommodations.push({
        id: `${stop.stop_id}_accommodation`,
        stop_id: stop.stop_id,
        name: stop.accommodation.name,
        address: stop.accommodation.address ?? null,
        check_in: stop.accommodation.check_in ?? null,
        check_out: stop.accommodation.check_out ?? null,
        confirmation: stop.accommodation.confirmation ?? null,
        url: stop.accommodation.url ?? null,
        remarks: stop.accommodation.remarks ?? null,
        lat: stop.accommodation.location?.lat ?? null,
        lng: stop.accommodation.location?.lng ?? null,
        thumbnail_url: stop.accommodation.thumbnail_url ?? null,
        google_place_id: stop.accommodation.google_place_id ?? null,
        created_at: now,
        updated_at: now,
      });
    }
    stop.activities.forEach((activity, index) => {
      activities.push({
        id: activity.activity_id,
        stop_id: stop.stop_id,
        name: activity.activity_name,
        type: activity.activity_type ?? null,
        lat: activity.location?.lat ?? null,
        lng: activity.location?.lng ?? null,
        address: activity.location?.address ?? null,
        duration: activity.duration ?? null,
        travel_time_from_accommodation: activity.travel_time_from_accommodation ?? null,
        url: activity.url ?? null,
        remarks: activity.remarks ?? null,
        thumbnail_url: activity.thumbnail_url ?? null,
        google_place_id: activity.google_place_id ?? null,
        sort_order: activity.order ?? index,
        is_done: activity.status?.done ?? false,
        created_at: now,
        updated_at: now,
      });
    });
    (stop.scenic_waypoints ?? []).forEach((waypoint, index) => {
      scenicWaypoints.push({
        id: waypoint.activity_id,
        stop_id: stop.stop_id,
        name: waypoint.activity_name,
        lat: waypoint.location?.lat ?? null,
        lng: waypoint.location?.lng ?? null,
        address: waypoint.location?.address ?? null,
        duration: waypoint.duration ?? null,
        url: waypoint.url ?? null,
        remarks: waypoint.remarks ?? null,
        thumbnail_url: waypoint.thumbnail_url ?? null,
        google_place_id: waypoint.google_place_id ?? null,
        sort_order: index,
        is_done: waypoint.status?.done ?? false,
        created_at: now,
        updated_at: now,
      });
    });
  });

  const allFrom = trip.stops.map((s) => s.date.from).sort();
  const allTo = trip.stops.map((s) => s.date.to).sort();

  return {
    trip: {
      id: tripId,
      name: trip.trip_name,
      description: null,
      destination: null,
      start_date: allFrom[0],
      end_date: allTo.at(-1) ?? allFrom[0],
      timezone: trip.timezone,
      created_at: trip.created_at ?? now,
      updated_at: trip.updated_at ?? now,
    },
    stops,
    accommodations,
    activities,
    scenicWaypoints,
  };
};
