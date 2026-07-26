import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import {
  ACTIVITY_COLUMNS,
  type ColumnDef,
  ITEM_DONE_COLUMN,
  patchRow,
  VISIT_COLUMNS,
  WAYPOINT_COLUMNS,
} from '../../../src/services/entityRows.js';
import {
  type ActivityInput,
  createActivity,
  createWaypoint,
  deleteById,
  updateById,
  type WaypointInput,
} from '../../../src/services/tripWrites.js';
import { isValidTripLocal, stampIfDuringTrip } from '../../../src/services/visitRecord.js';
import { ActivityType } from '../../../src/types/trip.js';
import type { AgentTool } from './core.js';

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const activityTypeSchema = z.enum(Object.values(ActivityType) as [ActivityType, ...ActivityType[]]);

const CREATE_FIELDS = {
  name: z.string().min(1),
  lat: z.number().min(LAT_MIN).max(LAT_MAX).optional(),
  lng: z.number().min(LNG_MIN).max(LNG_MAX).optional(),
  address: z.string().optional(),
  duration: z.string().optional(),
  url: z.string().optional(),
  remarks: z.string().optional(),
};

const UPDATE_FIELDS = {
  ...CREATE_FIELDS,
  name: z.string().min(1).optional(),
  done: z.boolean().optional(),
  visited_at: z
    .string()
    .refine(isValidTripLocal, { message: "must be 'YYYY-MM-DD HH:mm' in the trip's timezone" })
    .nullable()
    .optional()
    .describe("When the item was actually done: 'YYYY-MM-DD HH:mm', local to the trip's timezone. null clears it."),
  visit_duration_minutes: z
    .number()
    .int()
    .nonnegative()
    .nullable()
    .optional()
    .describe('How long the visit actually took, in whole minutes.'),
};

// The item's done state and the owning trip's zone and dates arrive through the
// same round trip this pre-read already made, so the stamp rule and the
// not-done guard cost no extra query and resolve on library-scoped runs where
// no trip was prefetched into the prompt.
const ITEM_CONTEXT_SELECT = 'name, is_done, stops(trips(timezone, start_date, end_date))';

// PostgREST returns a many-to-one embed as an object, but the same nested shape
// arrives as a single-element array on some relationship shapes - which is why
// supabaseMappers already unwraps both for accommodations.
type Embedded<T> = T | T[] | null;

interface TripContextRow {
  end_date: string | null;
  start_date: string | null;
  timezone: string | null;
}

interface ItemContextRow {
  is_done: boolean | null;
  name: string;
  stops: Embedded<{ trips: Embedded<TripContextRow> }>;
}

export interface ItemContext {
  endDate?: string;
  isDone: boolean;
  name: string;
  startDate?: string;
  timeZone?: string;
}

const unwrap = <T>(value: Embedded<T> | undefined): T | undefined => {
  if (value == null) {
    return;
  }
  return Array.isArray(value) ? value[0] : value;
};

const fetchItemContext = async (client: SupabaseClient, table: string, id: string, noun: string): Promise<ItemContext> => {
  const { data, error } = await client.from(table).select(ITEM_CONTEXT_SELECT).eq('id', id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`No ${noun} found with id ${id}`);
  }
  const row = data as ItemContextRow;
  const trip = unwrap(unwrap(row.stops)?.trips);
  return {
    name: row.name,
    isDone: row.is_done ?? false,
    timeZone: trip?.timezone ?? undefined,
    startDate: trip?.start_date ?? undefined,
    endDate: trip?.end_date ?? undefined,
  };
};

interface ItemToolsConfig {
  columns: readonly ColumnDef[];
  create: (client: SupabaseClient, stopId: string, sortOrder: number, input: Record<string, unknown>) => Promise<string>;
  entity: 'activity' | 'waypoint';
  hasType: boolean;
  idField: 'activity_id' | 'waypoint_id';
  noun: string;
  table: 'activities' | 'scenic_waypoints';
}

// remarks is deliberately not a visit key: it holds the planned note as well,
// and the agent may edit that on an item that is not done.
const VISIT_KEYS = ['visited_at', 'visit_duration_minutes'] as const;

const setsVisitField = (patch: Record<string, unknown>): boolean => VISIT_KEYS.some((key) => patch[key] != null);

// The same three rules the browser toggle applies, so an agent check-off and a
// UI check-off are indistinguishable in the data: an untick clears the stamp,
// a tick with no supplied time gets the shared stamp rule, and a supplied time
// wins (Req 4.3, 4.4, and the untick half of Req 2.10).
const resolveVisitPatch = (patch: Record<string, unknown>, context: ItemContext, now: Date): Record<string, unknown> => {
  if (patch.is_done === false) {
    return { ...patch, visited_at: null };
  }
  if (patch.is_done === true && patch.visited_at === undefined) {
    return {
      ...patch,
      visited_at: stampIfDuringTrip({ now, timeZone: context.timeZone, startDate: context.startDate, endDate: context.endDate }),
    };
  }
  return patch;
};

function buildItemTools({ columns, create, entity, hasType, idField, noun, table }: ItemToolsConfig): AgentTool[] {
  const typeField = hasType ? { type: activityTypeSchema.optional() } : {};
  // Sparse patch semantics: only provided fields, `done` mapped to is_done.
  // VISIT_COLUMNS stays out of ACTIVITY_COLUMNS (the browser's dense form saves
  // would null it), so the agent appends it here.
  const patchDefs = [...columns, ITEM_DONE_COLUMN, ...VISIT_COLUMNS];
  const createSchema = z.object({ stop_id: z.string().min(1), ...CREATE_FIELDS, ...typeField }).strict();
  const updateSchema = z
    .object({ [idField]: z.string().min(1), ...UPDATE_FIELDS, ...typeField })
    .strict()
    .refine((value) => Object.keys(value).length > 1, { message: 'provide at least one field to change' });
  const deleteSchema = z.object({ [idField]: z.string().min(1) }).strict();

  return [
    {
      name: `create_${entity}`,
      description: `Add a new ${noun} to a stop. Provide the stop_id from current trip data; the ${noun} is appended to the stop's list. Coordinates (lat/lng) are optional - without them the item has no map pin.`,
      schema: createSchema,
      execute: async (client, input) => {
        const { count, error: countError } = await client
          .from(table)
          .select('id', { count: 'exact', head: true })
          .eq('stop_id', input.stop_id as string);
        if (countError) {
          throw new Error(countError.message);
        }
        const id = await create(client, input.stop_id as string, count ?? 0, input);
        return { id, name: input.name };
      },
      toChanges: (input, output) => [{ op: 'created', entity, id: (output as { id: string }).id, name: input.name as string }],
    },
    {
      name: `update_${entity}`,
      description: `Update an existing ${noun} by id. Only the fields you provide change; set done to true/false to mark completion. Record what actually happened with visited_at ('YYYY-MM-DD HH:mm' in the trip's timezone) and visit_duration_minutes - both need the ${noun} to be done already or marked done in the same call, otherwise the update is refused. Marking done without a visited_at records the current trip-local time when today falls inside the trip's dates. Read current data first to resolve the id.`,
      schema: updateSchema,
      execute: async (client, input) => {
        const id = input[idField] as string;
        const context = await fetchItemContext(client, table, id, noun);
        const patch = patchRow(patchDefs, input);
        // A visit record may exist only on a done item (Req 4.5) - the same
        // guarantee the UI gets by offering the form on ticked cards only.
        if (setsVisitField(patch) && !(context.isDone || patch.is_done === true)) {
          throw new Error(
            `${noun} "${context.name}" is not marked done, so it cannot carry a visit record. Set done: true in the same call.`
          );
        }
        // Sparse update stays agent policy; the shared updateById does the write.
        await updateById(client, table, id, resolveVisitPatch(patch, context, new Date()));
        return { id, name: (input.name as string | undefined) ?? context.name };
      },
      toChanges: (_input, output) => {
        const o = output as { id: string; name: string };
        return [{ op: 'updated', entity, id: o.id, name: o.name }];
      },
    },
    {
      name: `delete_${entity}`,
      description: `Permanently delete a ${noun} by id. Call ONLY when the user's prompt explicitly asks to remove this ${noun}; never as a side effect of another request.`,
      schema: deleteSchema,
      execute: async (client, input) => {
        const id = input[idField] as string;
        const { name } = await fetchItemContext(client, table, id, noun);
        await deleteById(client, table, id);
        return { id, name, deleted: true };
      },
      toChanges: (_input, output) => {
        const o = output as { id: string; name: string };
        return [{ op: 'deleted', entity, id: o.id, name: o.name }];
      },
    },
  ];
}

export const ACTIVITY_TOOLS = buildItemTools({
  columns: ACTIVITY_COLUMNS,
  create: (client, stopId, sortOrder, input) => createActivity(client, stopId, sortOrder, input as unknown as ActivityInput),
  entity: 'activity',
  hasType: true,
  idField: 'activity_id',
  noun: 'activity',
  table: 'activities',
});

export const WAYPOINT_TOOLS = buildItemTools({
  columns: WAYPOINT_COLUMNS,
  create: (client, stopId, sortOrder, input) => createWaypoint(client, stopId, sortOrder, input as unknown as WaypointInput),
  entity: 'waypoint',
  hasType: false,
  idField: 'waypoint_id',
  noun: 'scenic waypoint',
  table: 'scenic_waypoints',
});
