import { describe, expect, it } from 'vitest';
import { buildRows, type TripRowNested, toTripData } from '../supabaseMappers';

const tripRow: TripRowNested = {
  id: '202512_NZ',
  name: 'NZ South Island',
  description: null,
  destination: 'New Zealand',
  start_date: '2025-12-13',
  end_date: '2025-12-29',
  timezone: 'Pacific/Auckland',
  created_at: '2025-11-01T00:00:00Z',
  updated_at: '2025-11-01T00:00:00Z',
  stops: [
    {
      id: 'queenstown',
      trip_id: '202512_NZ',
      name: 'Queenstown',
      date_from: '2025-12-13',
      date_to: '2025-12-16',
      lat: -45.03,
      lng: 168.66,
      duration_days: 3,
      travel_time_from_previous: null,
      sort_order: 0,
      created_at: '2025-11-01T00:00:00Z',
      updated_at: '2025-11-01T00:00:00Z',
      accommodations: [
        {
          id: 'acc-1',
          stop_id: 'queenstown',
          name: 'Lakeview Motel',
          address: '1 Lake Rd',
          check_in: '2025-12-13 15:00',
          check_out: '2025-12-16 10:00',
          confirmation: null,
          url: null,
          thumbnail_url: null,
          google_place_id: null,
          created_at: '2025-11-01T00:00:00Z',
          updated_at: '2025-11-01T00:00:00Z',
        },
      ],
      activities: [
        {
          id: 'act-2',
          stop_id: 'queenstown',
          name: 'Gondola',
          type: 'attraction',
          lat: -45.02,
          lng: 168.65,
          address: null,
          duration: '2h',
          travel_time_from_accommodation: null,
          url: null,
          remarks: null,
          thumbnail_url: null,
          google_place_id: null,
          sort_order: 1,
          is_done: true,
          created_at: '2025-11-01T00:00:00Z',
          updated_at: '2025-11-01T00:00:00Z',
        },
        {
          id: 'act-1',
          stop_id: 'queenstown',
          name: 'Fergburger',
          type: 'restaurant',
          lat: null,
          lng: null,
          address: '42 Shotover St',
          duration: null,
          travel_time_from_accommodation: null,
          url: null,
          remarks: null,
          thumbnail_url: null,
          google_place_id: null,
          sort_order: 0,
          is_done: false,
          created_at: '2025-11-01T00:00:00Z',
          updated_at: '2025-11-01T00:00:00Z',
        },
      ],
      scenic_waypoints: [],
    },
  ],
};

describe('toTripData', () => {
  it('maps rows to the domain TripData shape', () => {
    const trip = toTripData(tripRow);
    expect(trip.trip_id).toBe('202512_NZ');
    expect(trip.trip_name).toBe('NZ South Island');
    expect(trip.stops[0].stop_id).toBe('queenstown');
    expect(trip.stops[0].date).toEqual({ from: '2025-12-13', to: '2025-12-16' });
    expect(trip.stops[0].location).toEqual({ lat: -45.03, lng: 168.66 });
    expect(trip.stops[0].accommodation?.name).toBe('Lakeview Motel');
  });

  it('sorts activities by sort_order and maps is_done to status.done', () => {
    const activities = toTripData(tripRow).stops[0].activities;
    expect(activities.map((a) => a.activity_id)).toEqual(['act-1', 'act-2']);
    expect(activities[1].status).toEqual({ done: true });
    expect(activities[1].order).toBe(1);
  });

  it('accepts accommodation embedded as object or array, and as null', () => {
    const accommodations = tripRow.stops[0].accommodations;
    const first = Array.isArray(accommodations) ? accommodations[0] : accommodations;
    const asObject = { ...tripRow.stops[0], accommodations: first };
    expect(toTripData({ ...tripRow, stops: [asObject] }).stops[0].accommodation?.name).toBe('Lakeview Motel');
    const asNull = { ...tripRow.stops[0], accommodations: null };
    expect(toTripData({ ...tripRow, stops: [asNull] }).stops[0].accommodation).toBeUndefined();
  });

  it('omits activity location when no coordinates or address exist', () => {
    const bare = { ...tripRow.stops[0].activities[0], lat: null, lng: null, address: null };
    const trip = toTripData({ ...tripRow, stops: [{ ...tripRow.stops[0], activities: [bare] }] });
    expect(trip.stops[0].activities[0].location).toBeUndefined();
  });
});

describe('buildRows', () => {
  it('round-trips: buildRows(toTripData(rows)) reproduces the row values', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.trip.id).toBe('202512_NZ');
    expect(bundle.stops[0].sort_order).toBe(0);
    expect(bundle.activities.find((a) => a.id === 'act-2')?.is_done).toBe(true);
    expect(bundle.accommodations[0].stop_id).toBe('queenstown');
  });

  it('derives trip start/end dates from stops when building rows', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.trip.start_date).toBe('2025-12-13');
    expect(bundle.trip.end_date).toBe('2025-12-16');
  });
});
