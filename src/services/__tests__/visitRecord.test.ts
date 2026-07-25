import { describe, expect, it } from 'vitest';
import { formatTripLocal, isValidTimeZone, isValidTripLocal, stampIfDuringTrip } from '../visitRecord';

// 2026-07-15T05:32:00Z is 14:32 in Tokyo and 07:32 in Zurich.
const INSTANT = new Date('2026-07-15T05:32:00Z');

describe('formatTripLocal', () => {
  it('renders the instant in the given zone', () => {
    expect(formatTripLocal(INSTANT, 'Asia/Tokyo')).toBe('2026-07-15 14:32');
    expect(formatTripLocal(INSTANT, 'Europe/Zurich')).toBe('2026-07-15 07:32');
  });

  it('renders midnight as 00:xx, never 24:xx', () => {
    // 2026-07-14T15:05:00Z is 00:05 the next day in Tokyo.
    expect(formatTripLocal(new Date('2026-07-14T15:05:00Z'), 'Asia/Tokyo')).toBe('2026-07-15 00:05');
  });

  it('is unaffected by a DST shift', () => {
    // Zurich is UTC+2 in July, UTC+1 in January.
    expect(formatTripLocal(new Date('2026-01-15T12:00:00Z'), 'Europe/Zurich')).toBe('2026-01-15 13:00');
    expect(formatTripLocal(new Date('2026-07-15T12:00:00Z'), 'Europe/Zurich')).toBe('2026-07-15 14:00');
  });
});

describe('stampIfDuringTrip', () => {
  const trip = { timeZone: 'Asia/Tokyo', startDate: '2026-07-12', endDate: '2026-07-19' };

  it('stamps inside the range', () => {
    expect(stampIfDuringTrip({ now: INSTANT, ...trip })).toBe('2026-07-15 14:32');
  });

  it('stamps on both boundary days', () => {
    expect(stampIfDuringTrip({ now: new Date('2026-07-12T01:00:00Z'), ...trip })).toBe('2026-07-12 10:00');
    expect(stampIfDuringTrip({ now: new Date('2026-07-19T01:00:00Z'), ...trip })).toBe('2026-07-19 10:00');
  });

  it('returns null outside the range', () => {
    expect(stampIfDuringTrip({ now: new Date('2026-07-20T01:00:00Z'), ...trip })).toBeNull();
    expect(stampIfDuringTrip({ now: new Date('2026-07-11T01:00:00Z'), ...trip })).toBeNull();
  });

  it('returns null when the trip has no dates or zone', () => {
    expect(stampIfDuringTrip({ now: INSTANT, timeZone: 'Asia/Tokyo' })).toBeNull();
    expect(stampIfDuringTrip({ now: INSTANT, startDate: '2026-07-12', endDate: '2026-07-19' })).toBeNull();
  });

  it('uses the trip zone, not the range interpretation of the device zone', () => {
    // 2026-07-19T20:00:00Z is 20 Jul 05:00 in Tokyo - past the trip end.
    expect(stampIfDuringTrip({ now: new Date('2026-07-19T20:00:00Z'), ...trip })).toBeNull();
  });
});

describe('isValidTripLocal', () => {
  it('accepts a real wall-clock value', () => {
    expect(isValidTripLocal('2026-07-15 14:32')).toBe(true);
    expect(isValidTripLocal('2028-02-29 00:00')).toBe(true); // real leap day
  });

  it('rejects bad shapes and impossible dates', () => {
    for (const bad of ['2026-07-15T14:32', '2026-7-15 14:32', '2026-02-30 10:00', '2026-07-15 25:61', '', 'yesterday']) {
      expect(isValidTripLocal(bad)).toBe(false);
    }
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zone names', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidTimeZone('Europe/Zurich')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects anything the runtime does not know', () => {
    for (const bad of ['Mars/Olympus', 'GMT+8', '', 'Tokyo']) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });
});
