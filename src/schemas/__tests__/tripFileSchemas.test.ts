import { describe, expect, it } from 'vitest';
import { danangFile } from '@/testing/fixtures/tripFiles';
import { toTripData, wanderlogTripSchema } from '../tripFileSchemas';

describe('wanderlogTripSchema', () => {
  it('accepts the native DaNang export tripData', () => {
    const result = wanderlogTripSchema.safeParse(danangFile.tripData);
    expect(result.success).toBe(true);
  });

  it('rejects a trip without trip_name, timezone, or stops', () => {
    const result = wanderlogTripSchema.safeParse({ stops: [] });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('trip_name');
    expect(paths).toContain('timezone');
    expect(paths).toContain('stops'); // min(1)
  });

  it('rejects an invalid IANA timezone', () => {
    const result = wanderlogTripSchema.safeParse({
      ...danangFile.tripData,
      timezone: 'Not/AZone',
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range coordinates and bad dates with paths', () => {
    const bad = structuredClone(danangFile.tripData);
    bad.stops[0].location.lat = 123;
    bad.stops[0].date.from = '30-05-2026';
    const result = wanderlogTripSchema.safeParse(bad);
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('stops.0.location.lat');
    expect(paths).toContain('stops.0.date.from');
  });

  it('treats a degenerate accommodation (no name) as absent', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0] as Record<string, unknown>).accommodation = {};
    const result = wanderlogTripSchema.safeParse(trip);
    expect(result.success).toBe(true);
    expect(result.data?.stops[0].accommodation).toBeUndefined();
  });

  it('rejects an unknown activity_type', () => {
    const trip = structuredClone(danangFile.tripData);
    trip.stops[0].activities[0].activity_type = 'lodging';
    expect(wanderlogTripSchema.safeParse(trip).success).toBe(false);
  });

  it('rejects a malformed visited_at', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0].activities[0] as Record<string, unknown>).visited_at = '2026-07-15T14:32';
    expect(wanderlogTripSchema.safeParse(trip).success).toBe(false);
  });

  it('rejects a negative visit_duration_minutes', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0].activities[0] as Record<string, unknown>).visit_duration_minutes = -5;
    expect(wanderlogTripSchema.safeParse(trip).success).toBe(false);
  });
});

describe('toTripData', () => {
  it('fills duration_days from the date range when missing', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[1] as Record<string, unknown>).duration_days = undefined;
    const parsed = wanderlogTripSchema.parse(trip);
    expect(toTripData(parsed).stops[1].duration_days).toBe(2); // 05-31 → 06-02
  });

  it('accepts visit fields and carries them into TripData', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0].activities[0] as Record<string, unknown>).visited_at = '2026-05-30 14:32';
    (trip.stops[0].activities[0] as Record<string, unknown>).visit_duration_minutes = 80;
    trip.stops[0].scenic_waypoints = [
      { activity_id: 'wp-1', activity_name: 'Lookout', location: {}, visited_at: '2026-05-30 16:00', visit_duration_minutes: 20 },
    ] as (typeof trip.stops)[0]['scenic_waypoints'];

    const parsed = toTripData(wanderlogTripSchema.parse(trip));

    expect(parsed.stops[0].activities[0].visited_at).toBe('2026-05-30 14:32');
    expect(parsed.stops[0].activities[0].visit_duration_minutes).toBe(80);
    expect(parsed.stops[0].scenic_waypoints?.[0].visited_at).toBe('2026-05-30 16:00');
    expect(parsed.stops[0].scenic_waypoints?.[0].visit_duration_minutes).toBe(20);
  });

  // Export serialises the domain trip directly, so a file written by the app
  // must parse back with the visit record intact.
  it('round-trips the visit fields through an exported file', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0].activities[0] as Record<string, unknown>).visited_at = '2026-05-30 14:32';
    (trip.stops[0].activities[0] as Record<string, unknown>).visit_duration_minutes = 80;

    const exported = JSON.parse(JSON.stringify(toTripData(wanderlogTripSchema.parse(trip))));
    const reimported = toTripData(wanderlogTripSchema.parse(exported));

    expect(reimported.stops[0].activities[0].visited_at).toBe('2026-05-30 14:32');
    expect(reimported.stops[0].activities[0].visit_duration_minutes).toBe(80);
  });

  it('imports files without visit fields unchanged', () => {
    const parsed = toTripData(wanderlogTripSchema.parse(structuredClone(danangFile.tripData)));
    expect(parsed.stops[0].activities[0].visited_at).toBeUndefined();
    expect(parsed.stops[0].activities[0].visit_duration_minutes).toBeUndefined();
    expect(parsed.stops[0].activities[0].duration).toBe(danangFile.tripData.stops[0].activities[0].duration);
  });
});
