// Template for an agent tool test. Lives in api/_lib/__tests__/.
// Extensionless imports are fine here — Vitest resolves them and the
// check-shared-esm.sh hook skips test files.

import { describe, expect, it } from 'vitest';
import { dispatchTool } from '../tools';
import { EXAMPLE_TOOLS } from '../tools/example';
import { createFakeClient } from './fakeSupabaseClient';

// Always go through dispatchTool rather than calling execute directly — that
// is what exercises schema validation and change mapping together.

describe('update_example', () => {
  it('patches only the provided fields and reports the change', async () => {
    // Ordered queue: each from(table).<method>() consumes the first matching
    // entry. Unmatched calls resolve { data: null, error: null, count: null }.
    const { calls, client } = createFakeClient([
      { table: 'examples', method: 'select', data: { name: 'Old name' } },
      { table: 'examples', method: 'update' },
    ]);

    const result = await dispatchTool(EXAMPLE_TOOLS, client, 'update_example', {
      entity_id: 'e1',
      name: 'New name',
    });

    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ name: 'New name' });
    expect(result.changes).toEqual([{ type: 'change', op: 'updated', entity: 'activity', id: 'e1', name: 'New name' }]);
  });

  it('rejects an empty patch via zod', async () => {
    const { client } = createFakeClient([]);
    const result = await dispatchTool(EXAMPLE_TOOLS, client, 'update_example', { entity_id: 'e1' });
    expect(result.isError).toBe(true);
  });

  it('errors on an unknown id without writing', async () => {
    const { calls, client } = createFakeClient([{ table: 'examples', method: 'select', data: null }]);
    const result = await dispatchTool(EXAMPLE_TOOLS, client, 'update_example', { entity_id: 'ghost', name: 'X' });
    expect(result.isError).toBe(true);
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });
});
