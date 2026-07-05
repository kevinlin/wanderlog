import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import { ACTIVITY_COLUMNS, type ColumnDef, ITEM_DONE_COLUMN, patchRow, WAYPOINT_COLUMNS } from '../../../src/services/entityRows.js';
import {
  type ActivityInput,
  createActivity,
  createWaypoint,
  deleteById,
  updateById,
  type WaypointInput,
} from '../../../src/services/tripWrites.js';
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
};

const fetchName = async (client: SupabaseClient, table: string, id: string, noun: string): Promise<string> => {
  const { data, error } = await client.from(table).select('name').eq('id', id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`No ${noun} found with id ${id}`);
  }
  return (data as { name: string }).name;
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

function buildItemTools({ columns, create, entity, hasType, idField, noun, table }: ItemToolsConfig): AgentTool[] {
  const typeField = hasType ? { type: activityTypeSchema.optional() } : {};
  // Sparse patch semantics: only provided fields, `done` mapped to is_done.
  const patchDefs = [...columns, ITEM_DONE_COLUMN];
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
      description: `Update an existing ${noun} by id. Only the fields you provide change; set done to true/false to mark completion. Read current data first to resolve the id.`,
      schema: updateSchema,
      execute: async (client, input) => {
        const id = input[idField] as string;
        const currentName = await fetchName(client, table, id, noun);
        // Sparse update stays agent policy; the shared updateById does the write.
        await updateById(client, table, id, patchRow(patchDefs, input));
        return { id, name: (input.name as string | undefined) ?? currentName };
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
        const name = await fetchName(client, table, id, noun);
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
