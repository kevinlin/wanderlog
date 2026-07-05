import { differenceInCalendarDays, parseISO } from 'date-fns';

// Pure module shared by the browser service and the api/ agent tools (Vercel
// Node ESM): no supabase-js, no @/config value imports. It owns the per-entity
// input→column mapping and the canonical night-count so column knowledge and
// date math live in exactly one place.

// Canonical night count: calendar days, DST-safe, matching recalculateStopDates.
// Replaces the client's UTC ms-round version and the agent's dayCount.
export const nightsBetween = (fromISO: string, toISO: string): number => differenceInCalendarDays(parseISO(toISO), parseISO(fromISO));

export interface ColumnDef {
  // DB column name; also accepted as an input key (agent tool inputs are snake_case).
  column: string;
  // camelCase input key (browser *Input shapes).
  input: string;
}

const col = (input: string, column: string = input): ColumnDef => ({ input, column });

export const ACTIVITY_COLUMNS: readonly ColumnDef[] = [
  col('name'),
  col('type'),
  col('lat'),
  col('lng'),
  col('address'),
  col('duration'),
  col('url'),
  col('remarks'),
  col('thumbnailUrl', 'thumbnail_url'),
  col('googlePlaceId', 'google_place_id'),
];

// scenic_waypoints has no type column.
export const WAYPOINT_COLUMNS: readonly ColumnDef[] = ACTIVITY_COLUMNS.filter((def) => def.column !== 'type');

// The agent's update tools expose `done`; the browser toggles is_done via setActivityDone.
export const ITEM_DONE_COLUMN: ColumnDef = col('done', 'is_done');

export const ACCOMMODATION_COLUMNS: readonly ColumnDef[] = [
  col('name'),
  col('address'),
  col('checkIn', 'check_in'),
  col('checkOut', 'check_out'),
  col('remarks'),
  col('url'),
  col('confirmation'),
  col('lat'),
  col('lng'),
  col('googlePlaceId', 'google_place_id'),
];

export const STOP_COLUMNS: readonly ColumnDef[] = [
  col('name'),
  col('lat'),
  col('lng'),
  col('dateFrom', 'date_from'),
  col('dateTo', 'date_to'),
];

export const TRIP_METADATA_COLUMNS: readonly ColumnDef[] = [
  col('name'),
  col('description'),
  col('destination'),
  col('startDate', 'start_date'),
  col('endDate', 'end_date'),
];

const readInput = (input: Record<string, unknown>, def: ColumnDef): unknown => {
  const value = input[def.input];
  return value === undefined ? input[def.column] : value;
};

// Dense: every column, absent input → null (browser full-form semantics).
export const denseRow = (defs: readonly ColumnDef[], input: object): Record<string, unknown> => {
  const bag = input as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const def of defs) {
    row[def.column] = readInput(bag, def) ?? null;
  }
  return row;
};

// Sparse: only columns whose input key is present (agent patch semantics).
// Explicit null passes through (e.g. clearing a trip description).
export const patchRow = (defs: readonly ColumnDef[], input: object): Record<string, unknown> => {
  const bag = input as Record<string, unknown>;
  const row: Record<string, unknown> = {};
  for (const def of defs) {
    const value = readInput(bag, def);
    if (value !== undefined) {
      row[def.column] = value;
    }
  }
  return row;
};

export const CREATE_DEFAULTS = { is_done: false } as const;

// Deterministic one-per-stop id, matching the migration script convention.
export const accommodationId = (stopId: string): string => `${stopId}_accommodation`;
