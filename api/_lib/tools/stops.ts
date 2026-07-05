import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import { nightsBetween, patchRow, STOP_COLUMNS } from '../../../src/services/entityRows.js';
import type { TripBase } from '../../../src/types/trip.js';
import { recalculateStopDates } from '../../../src/utils/stopDateUtils.js';
import type { AgentTool } from './core.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(DATE_RE, 'expected YYYY-MM-DD');

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const createStopSchema = z
  .object({
    trip_id: z.string().min(1),
    name: z.string().min(1),
    lat: z.number().min(LAT_MIN).max(LAT_MAX),
    lng: z.number().min(LNG_MIN).max(LNG_MAX),
    date_from: dateString,
    date_to: dateString,
  })
  .strict()
  .refine((value) => value.date_from <= value.date_to, { message: 'date_to must not precede date_from' });

const updateStopSchema = z
  .object({
    stop_id: z.string().min(1),
    name: z.string().min(1).optional(),
    lat: z.number().min(LAT_MIN).max(LAT_MAX).optional(),
    lng: z.number().min(LNG_MIN).max(LNG_MAX).optional(),
    date_from: dateString.optional(),
    date_to: dateString.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, { message: 'provide at least one field to change' });

const deleteStopSchema = z.object({ stop_id: z.string().min(1) }).strict();

const restructureStopsSchema = z
  .object({
    trip_id: z.string().min(1),
    ordered_stop_ids: z.array(z.string().min(1)).min(1),
  })
  .strict();

interface StopRowLite {
  date_from: string;
  date_to: string;
  id: string;
  lat: number;
  lng: number;
  name: string;
  sort_order: number;
}

export const STOP_TOOLS: AgentTool[] = [
  {
    name: 'create_stop',
    description:
      'Add a stop to a trip. Coordinates must come from existing trip data or the user - never invented. Dates do not automatically chain; call restructure_stops afterwards to rebuild a contiguous date chain.',
    schema: createStopSchema,
    execute: async (client, input) => {
      const { count, error: countError } = await client
        .from('stops')
        .select('id', { count: 'exact', head: true })
        .eq('trip_id', input.trip_id as string);
      if (countError) {
        throw new Error(countError.message);
      }
      const id = crypto.randomUUID();
      const { error } = await client.from('stops').insert({
        id,
        trip_id: input.trip_id,
        ...patchRow(STOP_COLUMNS, input),
        duration_days: nightsBetween(input.date_from as string, input.date_to as string),
        sort_order: count ?? 0,
      });
      if (error) {
        throw new Error(error.message);
      }
      return { id, name: input.name };
    },
    toChanges: (input, output) => [{ op: 'created', entity: 'stop', id: (output as { id: string }).id, name: input.name as string }],
  },
  {
    name: 'update_stop',
    description: 'Update a stop by id: name, coordinates, or dates. Only provided fields change.',
    schema: updateStopSchema,
    execute: async (client, input) => {
      const id = input.stop_id as string;
      const { data: current, error: readError } = await client.from('stops').select('name, date_from, date_to').eq('id', id).maybeSingle();
      if (readError) {
        throw new Error(readError.message);
      }
      if (!current) {
        throw new Error(`No stop found with id ${id}`);
      }
      const row = current as { date_from: string; date_to: string; name: string };
      const patch = patchRow(STOP_COLUMNS, input);
      if (input.date_from !== undefined || input.date_to !== undefined) {
        const from = (input.date_from as string | undefined) ?? row.date_from;
        const to = (input.date_to as string | undefined) ?? row.date_to;
        if (from > to) {
          throw new Error(`date_to (${to}) precedes date_from (${from})`);
        }
        patch.duration_days = nightsBetween(from, to);
      }
      const { error } = await client.from('stops').update(patch).eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return { id, name: (input.name as string | undefined) ?? row.name };
    },
    toChanges: (_input, output) => {
      const o = output as { id: string; name: string };
      return [{ op: 'updated', entity: 'stop', id: o.id, name: o.name }];
    },
  },
  {
    name: 'delete_stop',
    description:
      "Permanently delete a stop AND everything in it (accommodation, activities, waypoints - database cascade). Call ONLY when the user's prompt explicitly asks to remove this stop.",
    schema: deleteStopSchema,
    execute: async (client, input) => {
      const id = input.stop_id as string;
      const { data: current, error: readError } = await client.from('stops').select('name').eq('id', id).maybeSingle();
      if (readError) {
        throw new Error(readError.message);
      }
      if (!current) {
        throw new Error(`No stop found with id ${id}`);
      }
      const { error } = await client.from('stops').delete().eq('id', id);
      if (error) {
        throw new Error(error.message);
      }
      return { id, name: (current as { name: string }).name, deleted: true };
    },
    toChanges: (_input, output) => {
      const o = output as { id: string; name: string };
      return [{ op: 'deleted', entity: 'stop', id: o.id, name: o.name }];
    },
  },
  {
    name: 'restructure_stops',
    description:
      "Reorder a trip's stops and rebuild the contiguous date chain: pass every stop id of the trip in the desired order. Each stop keeps its night count; dates re-anchor at the trip start date; the trip's date span is updated. Also use after adding or deleting stops to renormalize dates.",
    schema: restructureStopsSchema,
    execute: async (client, input) => {
      const tripId = input.trip_id as string;
      const orderedIds = input.ordered_stop_ids as string[];
      const { data: tripRow, error: tripError } = await client.from('trips').select('name, start_date').eq('id', tripId).maybeSingle();
      if (tripError) {
        throw new Error(tripError.message);
      }
      if (!tripRow) {
        throw new Error(`No trip found with id ${tripId}`);
      }
      const trip = tripRow as { name: string; start_date: string };
      const { data: stopData, error: stopsError } = await client
        .from('stops')
        .select('id, name, lat, lng, date_from, date_to, sort_order')
        .eq('trip_id', tripId);
      if (stopsError) {
        throw new Error(stopsError.message);
      }
      const rows = (stopData ?? []) as StopRowLite[];
      const byId = new Map(rows.map((row) => [row.id, row]));
      const isPermutation =
        orderedIds.length === rows.length && new Set(orderedIds).size === orderedIds.length && orderedIds.every((id) => byId.has(id));
      if (!isPermutation) {
        throw new Error(`ordered_stop_ids must be a permutation of the trip's stop ids: [${rows.map((row) => row.id).join(', ')}]`);
      }
      const orderedBases: TripBase[] = orderedIds.map((id) => {
        const row = byId.get(id) as StopRowLite;
        return {
          stop_id: row.id,
          name: row.name,
          date: { from: row.date_from, to: row.date_to },
          location: { lat: row.lat, lng: row.lng },
          duration_days: nightsBetween(row.date_from, row.date_to),
          activities: [],
          scenic_waypoints: [],
        };
      });
      const recalculated = recalculateStopDates(orderedBases, trip.start_date);
      const results = await Promise.all(
        recalculated.map((stop, index) =>
          client
            .from('stops')
            .update({
              sort_order: index,
              date_from: stop.date.from,
              date_to: stop.date.to,
              duration_days: nightsBetween(stop.date.from, stop.date.to),
            })
            .eq('id', stop.stop_id)
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw new Error(failed.error.message);
      }
      const startDate = recalculated[0].date.from;
      const endDate = recalculated.at(-1)?.date.to ?? startDate;
      const { error: spanError } = await client.from('trips').update({ start_date: startDate, end_date: endDate }).eq('id', tripId);
      if (spanError) {
        throw new Error(spanError.message);
      }
      const changedStops = recalculated
        .filter((stop, index) => {
          const before = byId.get(stop.stop_id) as StopRowLite;
          return before.sort_order !== index || before.date_from !== stop.date.from || before.date_to !== stop.date.to;
        })
        .map((stop) => ({ id: stop.stop_id, name: stop.name }));
      return {
        trip_id: tripId,
        trip_name: trip.name,
        start_date: startDate,
        end_date: endDate,
        stops: recalculated.map((stop, index) => ({
          stop_id: stop.stop_id,
          name: stop.name,
          sort_order: index,
          date_from: stop.date.from,
          date_to: stop.date.to,
        })),
        changed_stops: changedStops,
      };
    },
    toChanges: (_input, output) => {
      const o = output as { changed_stops: { id: string; name: string }[]; trip_id: string; trip_name: string };
      return [
        ...o.changed_stops.map((stop) => ({ op: 'updated' as const, entity: 'stop' as const, id: stop.id, name: stop.name })),
        { op: 'updated' as const, entity: 'trip' as const, id: o.trip_id, name: o.trip_name },
      ];
    },
  },
];
