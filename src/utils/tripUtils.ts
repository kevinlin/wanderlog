import { Activity, TripStop, StopStatus } from '@/types';

/**
 * Sort activities by manual order, falling back to original order
 */
export const sortActivitiesByOrder = (
  activities: Activity[],
  customOrder?: { [activityId: string]: number }
): Activity[] => {
  return [...activities].sort((a, b) => {
    const orderA = customOrder?.[a.activity_id] ?? a.order ?? a.order ?? 0;
    const orderB = customOrder?.[b.activity_id] ?? b.order ?? b.order ?? 0;
    return orderA - orderB;
  });
};

/**
 * Get activity status from localStorage, with fallback to original status
 */
export const getActivityStatus = (
  activity: Activity,
  stopStatus: StopStatus,
  stopId: string
): boolean => {
  return stopStatus[stopId]?.activities[activity.activity_id]?.done ?? activity.status?.done ?? false;
};

/**
 * Calculate progress for a stop (percentage of completed activities)
 */
export const calculateStopProgress = (
  stop: TripStop,
  stopStatus: StopStatus
): number => {
  if (stop.activities.length === 0) return 100;
  
  const completedCount = stop.activities.filter(activity =>
    getActivityStatus(activity, stopStatus, stop.stop_id)
  ).length;
  
  return Math.round((completedCount / stop.activities.length) * 100);
};

/**
 * Get completed activities count
 */
export const getCompletedActivitiesCount = (
  stop: TripStop,
  stopStatus: StopStatus
): number => {
  return stop.activities.filter(activity =>
    getActivityStatus(activity, stopStatus, stop.stop_id)
  ).length;
};

/**
 * Generate Google Maps navigation URL
 */
export const generateGoogleMapsUrl = (
  activity: Activity,
  accommodation?: { location: { lat: number; lng: number } }
): string => {
  const destination = activity.location?.address || (activity.location?.lat && activity.location?.lng ? `${activity.location.lat},${activity.location.lng}` : '');
  const baseUrl = 'https://www.google.com/maps/dir/';
  
  if (accommodation) {
    const origin = `${accommodation.location.lat},${accommodation.location.lng}`;
    return `${baseUrl}${encodeURIComponent(origin)}/${encodeURIComponent(destination)}`;
  }
  
  return `${baseUrl}/${encodeURIComponent(destination)}`;
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
export const findStopById = (stops: TripStop[], stopId: string): TripStop | undefined => {
  return stops.find(stop => stop.stop_id === stopId);
};

/**
 * Find activity by ID within a stop
 */
export const findActivityById = (stop: TripStop, activityId: string): Activity | undefined => {
  return stop.activities.find(activity => activity.activity_id === activityId);
};
