import type { TripSummary } from '@/types/trip';

export type TripStatus = 'past' | 'active' | 'upcoming';

const todayInTimezone = (timezone: string, now: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // en-CA yields YYYY-MM-DD; lexicographic compare is safe

export function deriveTripStatus(trip: TripSummary, now: Date = new Date()): TripStatus {
  const today = todayInTimezone(trip.timezone, now);
  if (today > trip.end_date) {
    return 'past';
  }
  if (today < trip.start_date) {
    return 'upcoming';
  }
  return 'active';
}

export function pickHeroTrip(trips: TripSummary[], now: Date = new Date()): TripSummary | null {
  const active = trips.find((t) => deriveTripStatus(t, now) === 'active');
  if (active) {
    return active;
  }
  const upcoming = trips.filter((t) => deriveTripStatus(t, now) === 'upcoming').sort((a, b) => a.start_date.localeCompare(b.start_date));
  return upcoming[0] ?? null;
}

export const sortForLibrary = (trips: TripSummary[]): TripSummary[] => [...trips].sort((a, b) => b.start_date.localeCompare(a.start_date));
