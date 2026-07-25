import { describe, expect, it } from 'vitest';
import type { TripData } from '@/types/trip';
import { applyVisitPatch, revertVisitPatch } from '../visitMutation';

const trip = (): TripData => ({
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [
    {
      stop_id: 'stop-1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 35.6, lng: 139.7 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', remarks: 'book ahead', status: { done: false } }],
      scenic_waypoints: [{ activity_id: 'wp-1', activity_name: 'Lake', location: {}, status: { done: false } }],
    },
  ],
});

describe('applyVisitPatch', () => {
  it('sets only the supplied fields on the named activity', () => {
    const next = applyVisitPatch(trip(), {
      tripId: 't1',
      itemId: 'act-1',
      isWaypoint: false,
      isDone: true,
      visitedAt: '2026-07-15 14:32',
    });
    const activity = next.stops[0].activities[0];
    expect(activity.status).toEqual({ done: true });
    expect(activity.visited_at).toBe('2026-07-15 14:32');
    expect(activity.remarks).toBe('book ahead');
  });

  it('clears visited_at when passed null', () => {
    const started = applyVisitPatch(trip(), { tripId: 't1', itemId: 'act-1', isWaypoint: false, visitedAt: '2026-07-15 14:32' });
    const cleared = applyVisitPatch(started, { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: false, visitedAt: null });
    expect(cleared.stops[0].activities[0].visited_at).toBeUndefined();
  });

  it('leaves duration and remarks alone when unchecking', () => {
    const visited = applyVisitPatch(trip(), {
      tripId: 't1',
      itemId: 'act-1',
      isWaypoint: false,
      isDone: true,
      visitedAt: '2026-07-15 14:32',
      visitDurationMinutes: 90,
      remarks: 'queue was long',
    });
    const unchecked = applyVisitPatch(visited, { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: false, visitedAt: null });
    const activity = unchecked.stops[0].activities[0];
    expect(activity.visited_at).toBeUndefined();
    expect(activity.visit_duration_minutes).toBe(90);
    expect(activity.remarks).toBe('queue was long');
  });

  it('patches waypoints too', () => {
    const next = applyVisitPatch(trip(), { tripId: 't1', itemId: 'wp-1', isWaypoint: true, isDone: true, visitDurationMinutes: 20 });
    expect(next.stops[0].scenic_waypoints?.[0].visit_duration_minutes).toBe(20);
  });

  it('does not mutate the input trip', () => {
    const before = trip();
    applyVisitPatch(before, { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true });
    expect(before.stops[0].activities[0].status).toEqual({ done: false });
  });
});

describe('revertVisitPatch', () => {
  it('restores the captured prior values', () => {
    const before = trip();
    const after = applyVisitPatch(before, {
      tripId: 't1',
      itemId: 'act-1',
      isWaypoint: false,
      isDone: true,
      visitedAt: '2026-07-15 14:32',
      remarks: 'queue was long',
    });
    const restored = revertVisitPatch(after, {
      itemId: 'act-1',
      previous: { is_done: false, visited_at: undefined, visit_duration_minutes: undefined, remarks: 'book ahead' },
    });
    const activity = restored.stops[0].activities[0];
    expect(activity.status).toEqual({ done: false });
    expect(activity.visited_at).toBeUndefined();
    expect(activity.remarks).toBe('book ahead');
  });

  it('is a no-op when there is no snapshot', () => {
    const current = trip();
    expect(revertVisitPatch(current, { itemId: 'act-1', previous: null })).toEqual(current);
  });
});
