import { describe, expect, it } from 'vitest';
import {
  ACCOMMODATION_COLUMNS,
  ACTIVITY_COLUMNS,
  accommodationId,
  CREATE_DEFAULTS,
  denseRow,
  ITEM_DONE_COLUMN,
  nightsBetween,
  patchRow,
  STOP_COLUMNS,
  TRIP_METADATA_COLUMNS,
  WAYPOINT_COLUMNS,
} from '../entityRows';

describe('nightsBetween', () => {
  it('counts calendar nights', () => {
    expect(nightsBetween('2026-03-02', '2026-03-05')).toBe(3);
    expect(nightsBetween('2026-03-02', '2026-03-02')).toBe(0);
    expect(nightsBetween('2026-01-01', '2026-01-02')).toBe(1);
  });

  it('counts calendar nights across DST boundaries (regression for the 3-way consolidation)', () => {
    // Northern-hemisphere spring forward (US: 2026-03-08) and fall back (US: 2026-11-01)
    expect(nightsBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(nightsBetween('2026-10-31', '2026-11-02')).toBe(2);
    // Southern-hemisphere transitions (NZ: 2026-09-27 forward, 2026-04-05 back)
    expect(nightsBetween('2026-09-26', '2026-09-28')).toBe(2);
    expect(nightsBetween('2026-04-04', '2026-04-06')).toBe(2);
  });

  it('is negative for a reversed range (callers validate order)', () => {
    expect(nightsBetween('2026-03-05', '2026-03-02')).toBe(-3);
  });
});

describe('activity and waypoint columns', () => {
  it('denseRow emits the full activity column set from camelCase input, nulling absent fields', () => {
    expect(
      denseRow(ACTIVITY_COLUMNS, { name: 'Kayaking', type: 'outdoor', lat: -45, lng: 168, thumbnailUrl: 't.jpg', googlePlaceId: 'pid' })
    ).toEqual({
      name: 'Kayaking',
      type: 'outdoor',
      lat: -45,
      lng: 168,
      address: null,
      duration: null,
      url: null,
      remarks: null,
      thumbnail_url: 't.jpg',
      google_place_id: 'pid',
    });
  });

  it('waypoint columns are the activity columns without type', () => {
    const row = denseRow(WAYPOINT_COLUMNS, { name: 'Lookout' });
    expect(row).not.toHaveProperty('type');
    expect(row).toEqual({
      name: 'Lookout',
      lat: null,
      lng: null,
      address: null,
      duration: null,
      url: null,
      remarks: null,
      thumbnail_url: null,
      google_place_id: null,
    });
  });

  it('patchRow keeps only provided fields and maps done to is_done (agent sparse semantics)', () => {
    expect(patchRow([...ACTIVITY_COLUMNS, ITEM_DONE_COLUMN], { name: 'Renamed', done: true })).toEqual({
      name: 'Renamed',
      is_done: true,
    });
    expect(patchRow([...ACTIVITY_COLUMNS, ITEM_DONE_COLUMN], { done: false })).toEqual({ is_done: false });
  });
});

describe('accommodation columns', () => {
  it('denseRow maps camelCase check-in/out and includes google_place_id', () => {
    expect(denseRow(ACCOMMODATION_COLUMNS, { name: 'Lakeview Motel', checkIn: '2025-12-13 15:00', googlePlaceId: 'pid' })).toEqual({
      name: 'Lakeview Motel',
      address: null,
      check_in: '2025-12-13 15:00',
      check_out: null,
      remarks: null,
      url: null,
      confirmation: null,
      lat: null,
      lng: null,
      google_place_id: 'pid',
    });
  });

  it('denseRow accepts snake_case input keys (agent tool input)', () => {
    const row = denseRow(ACCOMMODATION_COLUMNS, { name: 'Park Hyatt', check_in: '2026-03-02 15:00' });
    expect(row.check_in).toBe('2026-03-02 15:00');
    expect(row.check_out).toBeNull();
  });

  it('accommodationId is deterministic per stop', () => {
    expect(accommodationId('queenstown')).toBe('queenstown_accommodation');
  });
});

describe('stop columns', () => {
  it('denseRow maps dateFrom/dateTo to date columns', () => {
    expect(denseRow(STOP_COLUMNS, { name: 'Fairlie', lat: -44.1, lng: 170.8, dateFrom: '2026-01-01', dateTo: '2026-01-02' })).toEqual({
      name: 'Fairlie',
      lat: -44.1,
      lng: 170.8,
      date_from: '2026-01-01',
      date_to: '2026-01-02',
    });
  });

  it('patchRow keeps only provided stop fields, from either key style', () => {
    expect(patchRow(STOP_COLUMNS, { name: 'Renamed', dateTo: '2026-01-05' })).toEqual({ name: 'Renamed', date_to: '2026-01-05' });
    expect(patchRow(STOP_COLUMNS, { date_from: '2026-01-01' })).toEqual({ date_from: '2026-01-01' });
  });
});

describe('trip metadata columns', () => {
  it('covers destination alongside name/description/dates', () => {
    expect(patchRow(TRIP_METADATA_COLUMNS, { destination: 'New Zealand', startDate: '2026-01-01' })).toEqual({
      destination: 'New Zealand',
      start_date: '2026-01-01',
    });
  });

  it('passes an explicit null through (clearing a description)', () => {
    expect(patchRow(TRIP_METADATA_COLUMNS, { description: null })).toEqual({ description: null });
  });
});

describe('insert conventions', () => {
  it('CREATE_DEFAULTS seeds is_done false', () => {
    expect(CREATE_DEFAULTS).toEqual({ is_done: false });
  });
});
