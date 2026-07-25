// Template for a Wanderlog agent tool. Copy the relevant block into the file
// for its entity (see SKILL.md step 1) and delete what you do not need.

import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime is
// Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import { patchRow } from '../../../src/services/entityRows.js';
import { updateById } from '../../../src/services/tripWrites.js';
import type { AgentTool } from './core.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(DATE_RE, 'expected YYYY-MM-DD');

// .strict() so unknown keys are rejected instead of silently dropped.
// .refine() carries the cross-field rules: dispatchTool safeParses and hands
// the message back to the model, which retries — validation done inside
// execute() never reaches that loop.
const exampleSchema = z
  .object({
    entity_id: z.string().min(1),
    name: z.string().min(1).optional(),
    happens_on: dateString.optional().describe('YYYY-MM-DD, local to the trip'),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 1, { message: 'provide at least one field to change' });

export const EXAMPLE_TOOLS: AgentTool[] = [
  {
    name: 'update_example',
    // The description is the model's only spec. Say what the tool does AND
    // what it deliberately does not do, so the model does not assume a
    // side effect that never happens.
    description:
      'Update an example. Only provided fields change. Does not reorder siblings or recalculate dates - call restructure_stops for that.',
    schema: exampleSchema,
    execute: async (client, input) => {
      // Pre-read when the tool must (a) confirm the row exists before writing,
      // or (b) decide a created/updated change label.
      const { data: existing, error: readError } = await client
        .from('examples')
        .select('name')
        .eq('id', input.entity_id as string)
        .maybeSingle();
      if (readError) {
        throw new Error(readError.message);
      }
      if (!existing) {
        throw new Error(`No example found with id ${input.entity_id}`);
      }

      // Go through the shared write modules — they own the column definitions
      // and are the same path file import and create_trip take. `client` is
      // the caller's RLS-scoped client; never swap in the browser singleton or
      // a service-role client.
      await updateById(client, 'examples', input.entity_id as string, patchRow(input));

      return { id: input.entity_id, name: (input.name as string | undefined) ?? (existing as { name: string }).name };
    },
    // One event per row touched. entity must be one of the union members in
    // src/types/agent.ts. AgentModal invalidates query keys from this list and
    // there is no undo — a write with no event leaves the cache stale.
    toChanges: (_input, output) => {
      const o = output as { id: string; name: string };
      return [{ op: 'updated', entity: 'activity', id: o.id, name: o.name }];
    },
  },
];
