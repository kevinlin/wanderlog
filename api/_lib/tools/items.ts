import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
// Relative import with explicit .js extension: the Vercel function runtime is
// Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
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

// Column patch from parsed input: only provided fields, `done` mapped to is_done.
const CONTENT_COLUMNS = ['name', 'type', 'lat', 'lng', 'address', 'duration', 'url', 'remarks'] as const;

const contentPatch = (input: Record<string, unknown>): Record<string, unknown> => {
  const patch: Record<string, unknown> = {};
  for (const column of CONTENT_COLUMNS) {
    if (input[column] !== undefined) {
      patch[column] = input[column];
    }
  }
  if (input.done !== undefined) {
    patch.is_done = input.done;
  }
  return patch;
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
  entity: 'activity' | 'waypoint';
  hasType: boolean;
  idField: 'activity_id' | 'waypoint_id';
  noun: string;
  table: 'activities' | 'scenic_waypoints';
}

function buildItemTools({ entity, hasType, idField, noun, table }: ItemToolsConfig): AgentTool[] {
  const typeField = hasType ? { type: activityTypeSchema.optional() } : {};
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
        const id = crypto.randomUUID();
        const { error } = await client.from(table).insert({
          id,
          stop_id: input.stop_id,
          sort_order: count ?? 0,
          is_done: false,
          ...contentPatch(input),
        });
        if (error) {
          throw new Error(error.message);
        }
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
        const { error } = await client.from(table).update(contentPatch(input)).eq('id', id);
        if (error) {
          throw new Error(error.message);
        }
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
        const { error } = await client.from(table).delete().eq('id', id);
        if (error) {
          throw new Error(error.message);
        }
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
  entity: 'activity',
  hasType: true,
  idField: 'activity_id',
  noun: 'activity',
  table: 'activities',
});

export const WAYPOINT_TOOLS = buildItemTools({
  entity: 'waypoint',
  hasType: false,
  idField: 'waypoint_id',
  noun: 'scenic waypoint',
  table: 'scenic_waypoints',
});
