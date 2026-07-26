import type { Activity, StopStatus, TripStop } from '@/types';
import type { ScenicWaypoint } from '@/types/map';

/**
 * Sort activities by manual order, falling back to original order
 */
export const sortActivitiesByOrder = (activities: Activity[], customOrder?: { [activityId: string]: number }): Activity[] =>
  [...activities].sort((a, b) => {
    const orderA = customOrder?.[a.activity_id] ?? a.order ?? a.order ?? 0;
    const orderB = customOrder?.[b.activity_id] ?? b.order ?? b.order ?? 0;
    return orderA - orderB;
  });

/**
 * Get activity status from localStorage, with fallback to original status
 */
export const getActivityStatus = (activity: Activity, stopStatus: StopStatus, stopId: string): boolean =>
  stopStatus[stopId]?.activities[activity.activity_id]?.done ?? activity.status?.done ?? false;

/**
 * Calculate progress for a stop (percentage of completed activities)
 */
export const calculateStopProgress = (stop: TripStop, stopStatus: StopStatus): number => {
  if (stop.activities.length === 0) return 100;

  const completedCount = stop.activities.filter((activity) => getActivityStatus(activity, stopStatus, stop.stop_id)).length;

  return Math.round((completedCount / stop.activities.length) * 100);
};

/**
 * Get completed activities count
 */
export const getCompletedActivitiesCount = (stop: TripStop, stopStatus: StopStatus): number =>
  stop.activities.filter((activity) => getActivityStatus(activity, stopStatus, stop.stop_id)).length;

/**
 * Generate Google Maps navigation URL
 */
export const generateGoogleMapsUrl = (activity: Activity, accommodation?: { location: { lat: number; lng: number } }): string => {
  const destination =
    activity.location?.address ||
    (activity.location?.lat && activity.location?.lng ? `${activity.location.lat},${activity.location.lng}` : '');
  const baseUrl = 'https://www.google.com/maps/dir/';

  if (accommodation) {
    const origin = `${accommodation.location.lat},${accommodation.location.lng}`;
    return `${baseUrl}${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
  }

  return `${baseUrl}/${encodeURIComponent(destination)}`;
};

/**
 * Generate Google Maps place URL from google_place_id
 * Opens Google Maps website on desktop and Google Maps app on mobile
 */
export const generateGoogleMapsPlaceUrl = (placeId: string, placeName?: string): string => {
  const params = new URLSearchParams({ api: '1' });
  if (placeName) params.set('query', placeName);
  params.set('query_place_id', placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
};

/**
 * Calculate total trip duration in days
 */
export const getTripDuration = (stops: TripStop[]): number => {
  if (stops.length === 0) return 0;

  const firstStop = stops[0];
  const lastStop = stops[stops.length - 1];

  const startDate = new Date(firstStop.date.from);
  const endDate = new Date(lastStop.date.to);

  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Find stop by ID
 */
export const findStopById = (stops: TripStop[], stopId: string): TripStop | undefined => stops.find((stop) => stop.stop_id === stopId);

/**
 * Find activity by ID within a stop
 */
export const findActivityById = (stop: TripStop, activityId: string): Activity | undefined =>
  stop.activities.find((activity) => activity.activity_id === activityId);

const MINUTES_PER_HOUR = 60;

/**
 * Format a visit duration in minutes for display ('90' -> '1h 30m')
 */
export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (!hours) {
    return `${rest}m`;
  }
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

export type VisitedItem = { kind: 'activity'; order: number; item: Activity } | { kind: 'waypoint'; order: number; item: ScenicWaypoint };

export interface VisitedGroup {
  date: string | null;
  items: VisitedItem[];
}

export interface VisitPartition {
  planned: Activity[];
  plannedWaypoints: ScenicWaypoint[];
  visitedGroups: VisitedGroup[];
}

const isDone = (item: { status?: { done: boolean } }): boolean => item.status?.done ?? false;

const byOrderThenId = (a: { activity_id: string; order?: number }, b: { activity_id: string; order?: number }): number =>
  (a.order ?? 0) - (b.order ?? 0) || (a.activity_id < b.activity_id ? -1 : 1);

// Total and deterministic (Req 3.6). visited_at has minute precision and the two
// tables number sort_order independently, so an activity and a waypoint sharing
// both a minute and an order value is routine - without the kind and id
// tie-breaks the render would depend on how the two arrays were concatenated.
// Undated entries compare equal on the first key and fall through to plan order.
const compareVisited = (a: VisitedItem, b: VisitedItem): number => {
  const timeA = a.item.visited_at ?? '';
  const timeB = b.item.visited_at ?? '';
  if (timeA !== timeB) {
    return timeA < timeB ? -1 : 1;
  }
  if (a.order !== b.order) {
    return a.order - b.order;
  }
  if (a.kind !== b.kind) {
    return a.kind === 'activity' ? -1 : 1;
  }
  return a.item.activity_id < b.item.activity_id ? -1 : 1;
};

/**
 * Split a stop's items into the planned halves and the merged visited groups
 */
export const partitionByVisit = (activities: Activity[], waypoints: ScenicWaypoint[]): VisitPartition => {
  const visited: VisitedItem[] = [
    ...activities.filter(isDone).map((item): VisitedItem => ({ kind: 'activity', order: item.order ?? 0, item })),
    ...waypoints.filter(isDone).map((item): VisitedItem => ({ kind: 'waypoint', order: item.order ?? 0, item })),
  ];

  const dated = visited.filter((entry) => entry.item.visited_at).sort(compareVisited);
  const undated = visited.filter((entry) => !entry.item.visited_at).sort(compareVisited);

  const visitedGroups: VisitedGroup[] = [];
  for (const entry of dated) {
    const date = (entry.item.visited_at ?? '').slice(0, 10);
    const last = visitedGroups.at(-1);
    if (last?.date === date) {
      last.items.push(entry);
    } else {
      visitedGroups.push({ date, items: [entry] });
    }
  }
  if (undated.length > 0) {
    visitedGroups.push({ date: null, items: undated });
  }

  return {
    planned: activities.filter((activity) => !isDone(activity)).sort(byOrderThenId),
    plannedWaypoints: waypoints.filter((waypoint) => !isDone(waypoint)).sort(byOrderThenId),
    visitedGroups,
  };
};

/**
 * Fold a drag over the planned subset back into a full-list id order
 */
export const applyPlannedOrder = (currentOrderIds: string[], reorderedPlannedIds: string[]): string[] => {
  // Filtering keeps the slot count and the queue length in step if an id was
  // deleted between the render that started the drag and this call.
  const queue = reorderedPlannedIds.filter((id) => currentOrderIds.includes(id));
  const slots = new Set(queue);
  let next = 0;
  return currentOrderIds.map((id) => {
    if (!slots.has(id)) {
      return id;
    }
    const replacement = queue[next];
    next += 1;
    return replacement;
  });
};

/**
 * Render a visited-group heading ('2026-07-15' -> 'Wed 15 Jul')
 */
// Locale pinned so the heading keeps one shape whatever the device is set to.
export const formatVisitDay = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
