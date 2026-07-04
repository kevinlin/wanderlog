import { describe, expect, it } from 'vitest';
import type { TripBase } from '@/types/trip';
import { recalculateStopDates } from '../stopDateUtils';

const stub = (overrides: Partial<TripBase>): TripBase => ({
  stop_id: 'stub',
  name: 'Stub',
  date: { from: '2025-12-13', to: '2025-12-14' },
  location: { lat: 0, lng: 0 },
  duration_days: 1,
  activities: [],
  scenic_waypoints: [],
  ...overrides,
});

describe('recalculateStopDates', () => {
  it('re-anchors the chain preserving each stop duration', () => {
    const stops = [
      stub({ stop_id: 'a', date: { from: '2025-12-13', to: '2025-12-16' } }), // 3 nights
      stub({ stop_id: 'b', date: { from: '2025-12-16', to: '2025-12-18' } }), // 2 nights
    ];
    const result = recalculateStopDates([stops[1], stops[0]], '2025-12-13'); // reordered b, a
    expect(result[0].date).toEqual({ from: '2025-12-13', to: '2025-12-15' }); // b keeps 2 nights
    expect(result[1].date).toEqual({ from: '2025-12-15', to: '2025-12-18' }); // a keeps 3 nights
  });

  it('chains checkout day = next check-in day across three stops', () => {
    const stops = [
      stub({ stop_id: 'a', date: { from: '2026-01-01', to: '2026-01-03' } }), // 2 nights
      stub({ stop_id: 'b', date: { from: '2026-01-03', to: '2026-01-04' } }), // 1 night
      stub({ stop_id: 'c', date: { from: '2026-01-04', to: '2026-01-07' } }), // 3 nights
    ];
    const result = recalculateStopDates(stops, '2026-02-10'); // new anchor
    expect(result.map((s) => s.date)).toEqual([
      { from: '2026-02-10', to: '2026-02-12' },
      { from: '2026-02-12', to: '2026-02-13' },
      { from: '2026-02-13', to: '2026-02-16' },
    ]);
  });

  it('updates duration_days to match the preserved span', () => {
    const stops = [stub({ stop_id: 'a', date: { from: '2025-12-13', to: '2025-12-16' }, duration_days: 3 })];
    const result = recalculateStopDates(stops, '2026-01-01');
    expect(result[0].duration_days).toBe(3);
    expect(result[0].date).toEqual({ from: '2026-01-01', to: '2026-01-04' });
  });

  it('treats a zero-night stop (from === to) as staying in place for a day', () => {
    const stops = [
      stub({ stop_id: 'a', date: { from: '2026-01-01', to: '2026-01-01' } }),
      stub({ stop_id: 'b', date: { from: '2026-01-01', to: '2026-01-02' } }),
    ];
    const result = recalculateStopDates(stops, '2026-01-05');
    expect(result[0].date).toEqual({ from: '2026-01-05', to: '2026-01-05' });
    expect(result[1].date).toEqual({ from: '2026-01-05', to: '2026-01-06' });
  });

  it('returns new objects without mutating the input', () => {
    const stops = [stub({ stop_id: 'a', date: { from: '2025-12-13', to: '2025-12-16' } })];
    const result = recalculateStopDates(stops, '2026-01-01');
    expect(result[0]).not.toBe(stops[0]);
    expect(stops[0].date).toEqual({ from: '2025-12-13', to: '2025-12-16' });
  });

  it('handles an empty stop list', () => {
    expect(recalculateStopDates([], '2026-01-01')).toEqual([]);
  });
});
