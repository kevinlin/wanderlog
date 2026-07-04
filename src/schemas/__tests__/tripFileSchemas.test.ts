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
});

describe('toTripData', () => {
  it('fills duration_days from the date range when missing', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[1] as Record<string, unknown>).duration_days = undefined;
    const parsed = wanderlogTripSchema.parse(trip);
    expect(toTripData(parsed).stops[1].duration_days).toBe(2); // 05-31 → 06-02
  });
});
