import { describe, expect, it, vi } from 'vitest';
import { danangFile, zurichTripitFile } from '@/testing/fixtures/tripFiles';
import { detectFormat, parseTripFile, withFreshIds } from '../tripImportService';

const geocodeStub = vi.fn(async () => ({ lat: 1, lng: 2 }));

describe('detectFormat', () => {
  it('detects the wanderlog export wrapper and bare TripData', () => {
    expect(detectFormat(danangFile)).toBe('wanderlog');
    expect(detectFormat(danangFile.tripData)).toBe('wanderlog');
  });
  it('detects a TripIt export', () => {
    expect(detectFormat(zurichTripitFile)).toBe('tripit');
  });
  it('returns unknown otherwise', () => {
    expect(detectFormat({ foo: 1 })).toBe('unknown');
    expect(detectFormat(null)).toBe('unknown');
  });
});

describe('withFreshIds', () => {
  it('mints new uuids and keeps counts and names', () => {
    const parsed = structuredClone(danangFile.tripData);
    const fresh = withFreshIds(parsed as never);
    expect(fresh.trip_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].stop_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].stop_id).not.toBe('grand-mercure-danang');
    expect(fresh.stops[0].activities[0].activity_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].activities[0].activity_name).toBe('Dragon Bridge (Cau Rong)');
    // two calls never collide
    expect(withFreshIds(parsed as never).trip_id).not.toBe(fresh.trip_id);
  });
});

describe('parseTripFile - wanderlog path', () => {
  it('parses a valid native file into a preview', async () => {
    const result = await parseTripFile(JSON.stringify(danangFile), geocodeStub);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.format).toBe('wanderlog');
      expect(result.preview.stopCount).toBe(2);
      expect(result.preview.activityCount).toBe(1);
      expect(result.preview.tripData.trip_name).toContain('Da Nang');
      expect(geocodeStub).not.toHaveBeenCalled();
    }
  });

  it('rejects broken JSON with a single error', async () => {
    const result = await parseTripFile('{not json', geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ path: 'file', message: 'not valid JSON' }]);
    }
  });

  it('rejects an unrecognized format', async () => {
    const result = await parseTripFile('{"foo": 1}', geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toMatch(/unrecognized file format/i);
    }
  });

  it('maps zod issues to path: message entries', async () => {
    const bad = structuredClone(danangFile);
    bad.tripData.stops[0].location.lat = 123;
    const result = await parseTripFile(JSON.stringify(bad), geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'stops[0].location.lat')).toBe(true);
    }
  });
});
