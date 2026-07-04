import { describe, expect, it } from 'vitest';
import type { TripSummary } from '@/types/trip';
import { deriveTripStatus, pickHeroTrip, sortForLibrary } from '../tripStatusUtils';

const trip = (overrides: Partial<TripSummary>): TripSummary => ({
  trip_id: 't',
  trip_name: 'T',
  destination: null,
  start_date: '2026-01-10',
  end_date: '2026-01-20',
  timezone: 'UTC',
  ...overrides,
});

describe('deriveTripStatus', () => {
  const now = new Date('2026-07-03T12:00:00Z');
  it('classifies past, active and upcoming', () => {
    expect(deriveTripStatus(trip({ end_date: '2026-06-01', start_date: '2026-05-20' }), now)).toBe('past');
    expect(deriveTripStatus(trip({ start_date: '2026-07-01', end_date: '2026-07-10' }), now)).toBe('active');
    expect(deriveTripStatus(trip({ start_date: '2026-08-01', end_date: '2026-08-10' }), now)).toBe('upcoming');
  });

  it('evaluates "today" in the trip timezone, not UTC', () => {
    // 2026-07-03T11:00Z is already 2026-07-03 23:00 in Auckland (UTC+12);
    // a trip ending 2026-07-03 in Auckland is still active, not past.
    const nowUtc = new Date('2026-07-03T11:00:00Z');
    const aucklandTrip = trip({ start_date: '2026-07-01', end_date: '2026-07-03', timezone: 'Pacific/Auckland' });
    expect(deriveTripStatus(aucklandTrip, nowUtc)).toBe('active');
    // At 2026-07-03T13:00Z it is 2026-07-04 01:00 in Auckland - now past.
    expect(deriveTripStatus(aucklandTrip, new Date('2026-07-03T13:00:00Z'))).toBe('past');
  });
});

describe('pickHeroTrip', () => {
  const now = new Date('2026-07-03T12:00:00Z');
  it('prefers the active trip', () => {
    const active = trip({ trip_id: 'a', start_date: '2026-07-01', end_date: '2026-07-10' });
    const soon = trip({ trip_id: 'b', start_date: '2026-08-01', end_date: '2026-08-05' });
    expect(pickHeroTrip([soon, active], now)?.trip_id).toBe('a');
  });
  it('falls back to the next upcoming trip by soonest start', () => {
    const later = trip({ trip_id: 'c', start_date: '2026-12-01', end_date: '2026-12-10' });
    const soon = trip({ trip_id: 'b', start_date: '2026-08-01', end_date: '2026-08-05' });
    expect(pickHeroTrip([later, soon], now)?.trip_id).toBe('b');
  });
  it('returns null when only past trips exist', () => {
    expect(pickHeroTrip([trip({ start_date: '2020-01-01', end_date: '2020-01-05' })], now)).toBeNull();
  });
});

describe('sortForLibrary', () => {
  it('orders by start_date descending', () => {
    const trips = [trip({ trip_id: 'old', start_date: '2020-01-01' }), trip({ trip_id: 'new', start_date: '2026-01-01' })];
    expect(sortForLibrary(trips).map((t) => t.trip_id)).toEqual(['new', 'old']);
  });
});
