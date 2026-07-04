import { z } from 'zod';
import type { AgentTool } from './core.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(DATE_RE, 'expected YYYY-MM-DD');

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const upsertAccommodationSchema = z
  .object({
    stop_id: z.string().min(1),
    name: z.string().min(1),
    address: z.string().optional(),
    check_in: z.string().optional().describe('YYYY-MM-DD HH:mm, local to the trip'),
    check_out: z.string().optional().describe('YYYY-MM-DD HH:mm, local to the trip'),
    confirmation: z.string().optional(),
    url: z.string().optional(),
    remarks: z.string().optional(),
    lat: z.number().min(LAT_MIN).max(LAT_MAX).optional(),
    lng: z.number().min(LNG_MIN).max(LNG_MAX).optional(),
  })
  .strict();

const METADATA_COLUMNS = ['name', 'description', 'destination', 'start_date', 'end_date'] as const;

const updateTripMetadataSchema = z
  .object({
    trip_id: z.string().min(1),
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    destination: z.string().optional(),
    start_date: dateString.optional(),
    end_date: dateString.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, { message: 'provide at least one field to change' })
  .refine((value) => !(value.start_date && value.end_date) || value.start_date <= value.end_date, {
    message: 'end_date must not precede start_date',
  });

export const TRIP_FIELD_TOOLS: AgentTool[] = [
  {
    name: 'upsert_accommodation',
    description:
      "Set or replace a stop's accommodation (one per stop). Provide the complete desired accommodation - this replaces all accommodation fields for the stop.",
    schema: upsertAccommodationSchema,
    execute: async (client, input) => {
      const id = `${input.stop_id}_accommodation`;
      const { data: existing, error: readError } = await client.from('accommodations').select('id').eq('id', id).maybeSingle();
      if (readError) {
        throw new Error(readError.message);
      }
      const { error } = await client.from('accommodations').upsert(
        {
          id,
          stop_id: input.stop_id,
          name: input.name,
          address: input.address ?? null,
          check_in: input.check_in ?? null,
          check_out: input.check_out ?? null,
          confirmation: input.confirmation ?? null,
          url: input.url ?? null,
          remarks: input.remarks ?? null,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
        },
        { onConflict: 'id' }
      );
      if (error) {
        throw new Error(error.message);
      }
      return { id, name: input.name, op: existing ? 'updated' : 'created' };
    },
    toChanges: (_input, output) => {
      const o = output as { id: string; name: string; op: 'created' | 'updated' };
      return [{ op: o.op, entity: 'accommodation', id: o.id, name: o.name }];
    },
  },
  {
    name: 'update_trip_metadata',
    description:
      "Update trip-level fields: name, description, destination, start_date, end_date. Only provided fields change. Date edits set the trip's date span but never move stops - use restructure_stops to rebuild the stop date chain.",
    schema: updateTripMetadataSchema,
    execute: async (client, input) => {
      const { data: existing, error: readError } = await client
        .from('trips')
        .select('name')
        .eq('id', input.trip_id as string)
        .maybeSingle();
      if (readError) {
        throw new Error(readError.message);
      }
      if (!existing) {
        throw new Error(`No trip found with id ${input.trip_id}`);
      }
      const patch: Record<string, unknown> = {};
      for (const column of METADATA_COLUMNS) {
        if (input[column] !== undefined) {
          patch[column] = input[column];
        }
      }
      const { error } = await client
        .from('trips')
        .update(patch)
        .eq('id', input.trip_id as string);
      if (error) {
        throw new Error(error.message);
      }
      return { id: input.trip_id, name: (input.name as string | undefined) ?? (existing as { name: string }).name };
    },
    toChanges: (_input, output) => {
      const o = output as { id: string; name: string };
      return [{ op: 'updated', entity: 'trip', id: o.id, name: o.name }];
    },
  },
];
