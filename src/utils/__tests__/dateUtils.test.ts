import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TripStop } from '@/types/trip';
import { getStopTimeStatus } from '../dateUtils';

const stop: TripStop = {
  stop_id: 'stop-1',
  name: 'Lake Tekapo',
  date: { from: '2026-11-10', to: '2026-11-12' },
  location: { lat: -44, lng: 170 },
  duration_days: 2,
  activities: [],
};

describe('getStopTimeStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ['2026-11-09', 'upcoming'],
    ['2026-11-10', 'current'],
    ['2026-11-11', 'current'],
    ['2026-11-12', 'current'],
    ['2026-11-13', 'past'],
  ])('reports %s as %s', (today, status) => {
    expect(getStopTimeStatus(stop, today)).toBe(status);
  });

  it('compares across month and year boundaries', () => {
    const newYearStop = { ...stop, date: { from: '2026-12-30', to: '2027-01-02' } };

    expect(getStopTimeStatus(newYearStop, '2026-12-29')).toBe('upcoming');
    expect(getStopTimeStatus(newYearStop, '2027-01-01')).toBe('current');
    expect(getStopTimeStatus(newYearStop, '2027-01-03')).toBe('past');
  });

  it('ignores the system clock', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    expect(getStopTimeStatus(stop, '2026-11-11')).toBe('current');
  });
});
