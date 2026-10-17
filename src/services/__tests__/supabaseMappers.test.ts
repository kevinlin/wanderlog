import { describe, expect, it } from 'vitest';
import {
  buildRows,
  type TodoRow,
  TRIP_DETAIL_SELECT,
  TRIP_LIBRARY_SELECT,
  TRIP_SELECT,
  TRIP_SUMMARY_SELECT,
  type TripRowNested,
  type TripSummaryRow,
  toTodo,
  toTodoWindow,
  toTripData,
  toTripSummary,
} from '../supabaseMappers';

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
          remarks: 'Ask for a lake-facing room',
          lat: -45.031,
          lng: 168.662,
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
          visited_at: '2025-12-15 14:32',
          visit_duration_minutes: 80,
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
          visited_at: null,
          visit_duration_minutes: null,
          created_at: '2025-11-01T00:00:00Z',
          updated_at: '2025-11-01T00:00:00Z',
        },
      ],
      scenic_waypoints: [],
    },
  ],
};

const todoRow: TodoRow = {
  id: 'todo-1',
  trip_id: '202512_NZ',
  stop_id: 'queenstown',
  activity_id: 'act-1',
  title: 'Book the gondola',
  notes: 'Morning slot',
  url: 'https://example.com/gondola',
  opens_on: '2025-12-01',
  due_on: '2025-12-10',
  is_done: false,
  created_at: '2025-11-01T00:00:00Z',
  updated_at: '2025-11-01T00:00:00Z',
};

const bareTodoRow: TodoRow = {
  ...todoRow,
  id: 'todo-2',
  stop_id: null,
  activity_id: null,
  title: 'Check the drone show',
  notes: null,
  url: null,
  opens_on: null,
  due_on: null,
  is_done: true,
};

describe('select strings', () => {
  // The agent prefetch and get_trip/list_trips select these two, so their output
  // must not gain a todos key. Browser-only selects stand in for the additions.
  it('keeps the shared selects byte-identical', () => {
    expect(TRIP_SELECT).toBe('*, stops(*, accommodations(*), activities(*), scenic_waypoints(*))');
    expect(TRIP_SUMMARY_SELECT).toBe('id, name, description, destination, start_date, end_date, timezone, created_at, updated_at');
  });

  it('adds todos only in the browser selects', () => {
    expect(TRIP_DETAIL_SELECT).toBe('*, stops(*, accommodations(*), activities(*), scenic_waypoints(*)), todos(*)');
    expect(TRIP_LIBRARY_SELECT).toBe(
      'id, name, description, destination, start_date, end_date, timezone, created_at, updated_at, todos(opens_on, is_done)'
    );
  });
});

describe('toTodo', () => {
  it('maps every column to the domain shape, is_done becoming done', () => {
    expect(toTodo(todoRow)).toEqual({
      todo_id: 'todo-1',
      title: 'Book the gondola',
      notes: 'Morning slot',
      url: 'https://example.com/gondola',
      opens_on: '2025-12-01',
      due_on: '2025-12-10',
      stop_id: 'queenstown',
      activity_id: 'act-1',
      done: false,
    });
  });

  it('turns null columns into absent values, never null', () => {
    const todo = toTodo(bareTodoRow);
    expect(todo).toEqual({ todo_id: 'todo-2', title: 'Check the drone show', done: true });
    expect(Object.values(todo)).not.toContain(null);
    expect(todo.notes).toBeUndefined();
    expect(todo.url).toBeUndefined();
    expect(todo.opens_on).toBeUndefined();
    expect(todo.due_on).toBeUndefined();
    expect(todo.stop_id).toBeUndefined();
    expect(todo.activity_id).toBeUndefined();
  });

  it('keeps the row-only columns off the domain object', () => {
    const todo = toTodo(todoRow);
    expect(todo).not.toHaveProperty('trip_id');
    expect(todo).not.toHaveProperty('created_at');
    expect(todo).not.toHaveProperty('is_done');
  });
});

describe('toTodoWindow', () => {
  it('keeps only opens_on and done', () => {
    expect(toTodoWindow({ opens_on: '2025-12-02', is_done: false })).toEqual({ opens_on: '2025-12-02', done: false });
  });

  it('turns a null opens_on into an absent value', () => {
    const window = toTodoWindow({ opens_on: null, is_done: true });
    expect(window).toEqual({ done: true });
    expect(window.opens_on).toBeUndefined();
  });
});

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

  it('maps accommodation remarks and builds location from lat/lng', () => {
    const accommodation = toTripData(tripRow).stops[0].accommodation;
    expect(accommodation?.remarks).toBe('Ask for a lake-facing room');
    expect(accommodation?.location).toEqual({ lat: -45.031, lng: 168.662 });
  });

  it('omits accommodation location when lat/lng are null', () => {
    const accommodations = tripRow.stops[0].accommodations;
    const first = Array.isArray(accommodations) ? accommodations[0] : accommodations;
    const bare = { ...tripRow.stops[0], accommodations: [{ ...(first as object), lat: null, lng: null, remarks: null }] };
    const accommodation = toTripData({ ...tripRow, stops: [bare as (typeof tripRow.stops)[0]] }).stops[0].accommodation;
    expect(accommodation?.location).toBeUndefined();
    expect(accommodation?.remarks).toBeUndefined();
  });

  it('maps visit fields and waypoint order onto the domain', () => {
    const waypointRow = {
      ...tripRow.stops[0].activities[1],
      id: 'wp-1',
      name: 'Lake lookout',
      sort_order: 3,
      visited_at: null,
      visit_duration_minutes: null,
    };
    const trip = toTripData({
      ...tripRow,
      stops: [{ ...tripRow.stops[0], scenic_waypoints: [waypointRow] }],
    });
    const stop = trip.stops[0];
    expect(stop.activities[1].visited_at).toBe('2025-12-15 14:32');
    expect(stop.activities[1].visit_duration_minutes).toBe(80);
    expect(stop.activities[0].visited_at).toBeUndefined();
    expect(stop.scenic_waypoints?.[0].order).toBe(3);
    expect(stop.scenic_waypoints?.[0].visited_at).toBeUndefined();
  });

  it('carries the trip stored date range into TripData', () => {
    const trip = toTripData(tripRow);
    expect(trip.start_date).toBe('2025-12-13');
    expect(trip.end_date).toBe('2025-12-29');
  });

  describe('todos', () => {
    it('adds no todos key when the row does not carry them (agent output stays unchanged)', () => {
      expect(toTripData(tripRow)).not.toHaveProperty('todos');
    });

    it('maps the embedded todos when the row carries them', () => {
      const trip = toTripData({ ...tripRow, todos: [todoRow, bareTodoRow] });
      expect(trip.todos).toEqual([toTodo(todoRow), toTodo(bareTodoRow)]);
      expect(trip.todos?.[0].todo_id).toBe('todo-1');
      expect(trip.todos?.[1].done).toBe(true);
    });

    it('keeps an empty todos array, since the row did carry it', () => {
      expect(toTripData({ ...tripRow, todos: [] }).todos).toEqual([]);
    });

    it('leaves the rest of the mapping untouched when todos ride along', () => {
      const { todos: _todos, ...withTodos } = toTripData({ ...tripRow, todos: [todoRow] });
      expect(withTodos).toEqual(toTripData(tripRow));
    });
  });

  it('omits activity location when no coordinates or address exist', () => {
    const bare = { ...tripRow.stops[0].activities[0], lat: null, lng: null, address: null };
    const trip = toTripData({ ...tripRow, stops: [{ ...tripRow.stops[0], activities: [bare] }] });
    expect(trip.stops[0].activities[0].location).toBeUndefined();
  });

  // Regression: when the client is deployed before a schema migration, rows
  // come back without the new columns (undefined, not null). The mapper must
  // not emit location objects with undefined coordinates - Google Maps throws
  // "not a LatLng or LatLngLiteral" on { lat: undefined }.
  describe('rows from an older schema missing lat/lng columns', () => {
    const stripCoords = <T extends object>(row: T): T => {
      const { lat: _lat, lng: _lng, ...rest } = row as T & { lat: unknown; lng: unknown };
      return rest as unknown as T;
    };

    it('omits accommodation location when lat/lng columns are absent', () => {
      const accommodations = tripRow.stops[0].accommodations;
      const first = Array.isArray(accommodations) ? accommodations[0] : accommodations;
      const legacy = { ...tripRow.stops[0], accommodations: [stripCoords(first as object)] };
      const accommodation = toTripData({ ...tripRow, stops: [legacy as (typeof tripRow.stops)[0]] }).stops[0].accommodation;
      expect(accommodation?.location).toBeUndefined();
    });

    it('omits activity coordinates when lat/lng columns are absent', () => {
      const legacy = stripCoords({ ...tripRow.stops[0].activities[0], address: null });
      const trip = toTripData({ ...tripRow, stops: [{ ...tripRow.stops[0], activities: [legacy] }] });
      expect(trip.stops[0].activities[0].location).toBeUndefined();
    });
  });
});

describe('toTripSummary', () => {
  it('maps a summary row to the domain shape', () => {
    expect(
      toTripSummary({
        id: 't1',
        name: 'NZ',
        description: null,
        destination: 'New Zealand',
        start_date: '2025-12-13',
        end_date: '2025-12-28',
        timezone: 'Pacific/Auckland',
        created_at: 'c',
        updated_at: 'u',
      })
    ).toEqual({
      trip_id: 't1',
      trip_name: 'NZ',
      description: null,
      destination: 'New Zealand',
      start_date: '2025-12-13',
      end_date: '2025-12-28',
      timezone: 'Pacific/Auckland',
      created_at: 'c',
      updated_at: 'u',
    });
  });

  describe('todos', () => {
    const summaryRow: TripSummaryRow = {
      id: 't1',
      name: 'Chengdu',
      description: null,
      destination: null,
      start_date: '2026-12-10',
      end_date: '2026-12-18',
      timezone: 'Asia/Shanghai',
      created_at: 'c',
      updated_at: 'u',
    };

    it('adds no todos key when the row does not carry them', () => {
      expect(toTripSummary(summaryRow)).not.toHaveProperty('todos');
    });

    it('maps the embedded windows, is_done becoming done', () => {
      const summary = toTripSummary({
        ...summaryRow,
        todos: [
          { opens_on: null, is_done: false },
          { opens_on: '2026-12-02', is_done: true },
        ],
      });
      expect(summary.todos).toEqual([{ done: false }, { opens_on: '2026-12-02', done: true }]);
    });

    it('keeps an empty todos array, since the row did carry it', () => {
      expect(toTripSummary({ ...summaryRow, todos: [] }).todos).toEqual([]);
    });
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

  it('round-trips accommodation remarks and coordinates', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.accommodations[0].remarks).toBe('Ask for a lake-facing room');
    expect(bundle.accommodations[0].lat).toBe(-45.031);
    expect(bundle.accommodations[0].lng).toBe(168.662);
  });

  it('round-trips visit fields back to row columns', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    const visited = bundle.activities.find((a) => a.id === 'act-2');
    expect(visited?.visited_at).toBe('2025-12-15 14:32');
    expect(visited?.visit_duration_minutes).toBe(80);
    expect(bundle.activities.find((a) => a.id === 'act-1')?.visited_at).toBeNull();
  });

  it('derives trip start/end dates from stops when building rows', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.trip.start_date).toBe('2025-12-13');
    expect(bundle.trip.end_date).toBe('2025-12-16');
  });

  it('skips accommodations without a name (degenerate legacy data)', () => {
    const trip = toTripData(tripRow);
    const noName = {
      ...trip,
      stops: [{ ...trip.stops[0], accommodation: {} as (typeof trip.stops)[0]['accommodation'] }],
    };
    const bundle = buildRows(noName, '202512_NZ');
    expect(bundle.accommodations).toEqual([]);
  });
});
