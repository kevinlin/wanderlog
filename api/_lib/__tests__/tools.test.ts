import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { type AgentTool, dispatchTool, READ_TOOLS, toAnthropicTools } from '../tools';

const tripRowNested = {
  id: 't1',
  name: 'NZ Trip',
  description: null,
  destination: 'New Zealand',
  start_date: '2025-12-13',
  end_date: '2025-12-16',
  timezone: 'Pacific/Auckland',
  created_at: 'c',
  updated_at: 'u',
  stops: [],
};

const summaryRow = {
  id: 't1',
  name: 'NZ Trip',
  description: null,
  destination: 'New Zealand',
  start_date: '2025-12-13',
  end_date: '2025-12-16',
  timezone: 'Pacific/Auckland',
  created_at: 'c',
  updated_at: 'u',
};

const makeClient = (result: { data: unknown; error: { message: string } | null }): SupabaseClient =>
  ({
    from: () => ({
      select: () => ({
        order: () => Promise.resolve(result),
        eq: () => ({
          maybeSingle: () => Promise.resolve(result),
        }),
      }),
    }),
  }) as unknown as SupabaseClient;

const fakeClient = makeClient({ data: tripRowNested, error: null });
const errorClient = makeClient({ data: null, error: { message: 'boom' } });

describe('READ_TOOLS', () => {
  it('contains exactly the two read tools', () => {
    expect(READ_TOOLS.map((t) => t.name).sort()).toEqual(['get_trip', 'list_trips']);
  });
});

describe('toAnthropicTools', () => {
  it('produces JSON Schema input_schema objects', () => {
    const defs = toAnthropicTools(READ_TOOLS);
    const getTrip = defs.find((d) => d.name === 'get_trip');
    expect(getTrip?.input_schema).toMatchObject({ type: 'object', required: ['trip_id'] });
  });
});

describe('dispatchTool', () => {
  it('rejects an unknown tool as an error result without executing', async () => {
    const result = await dispatchTool(READ_TOOLS, fakeClient, 'drop_table', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Unknown tool');
  });

  it('rejects invalid input via zod as an error result', async () => {
    const result = await dispatchTool(READ_TOOLS, fakeClient, 'get_trip', { trip_id: 42 });
    expect(result.isError).toBe(true);
  });

  it('executes get_trip and returns the mapped trip as JSON', async () => {
    const result = await dispatchTool(READ_TOOLS, fakeClient, 'get_trip', { trip_id: 't1' });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content).trip_name).toBe('NZ Trip');
  });

  it('executes list_trips and returns mapped summaries as JSON', async () => {
    const listClient = makeClient({ data: [summaryRow], error: null });
    const result = await dispatchTool(READ_TOOLS, listClient, 'list_trips', {});
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual([
      {
        trip_id: 't1',
        trip_name: 'NZ Trip',
        description: null,
        destination: 'New Zealand',
        start_date: '2025-12-13',
        end_date: '2025-12-16',
        timezone: 'Pacific/Auckland',
        created_at: 'c',
        updated_at: 'u',
      },
    ]);
  });

  it('surfaces a db error as an error result, not a throw', async () => {
    const result = await dispatchTool(READ_TOOLS, errorClient, 'list_trips', {});
    expect(result.isError).toBe(true);
    expect(result.content).toContain('boom');
  });
});

const changeTool: AgentTool = {
  name: 'create_thing',
  description: 'test tool',
  schema: z.object({ name: z.string() }),
  execute: async () => ({ id: 'row-1' }),
  toChanges: (input, output) => [{ op: 'created', entity: 'activity', id: (output as { id: string }).id, name: input.name as string }],
};

describe('dispatchTool change events', () => {
  it('stamps toChanges output as change events on success', async () => {
    const result = await dispatchTool([changeTool], fakeClient, 'create_thing', { name: 'Ramen' });
    expect(result.changes).toEqual([{ type: 'change', op: 'created', entity: 'activity', id: 'row-1', name: 'Ramen' }]);
  });

  it('returns empty changes for unknown tool, invalid input, and execution errors', async () => {
    expect((await dispatchTool([changeTool], fakeClient, 'nope', {})).changes).toEqual([]);
    expect((await dispatchTool([changeTool], fakeClient, 'create_thing', { name: 5 })).changes).toEqual([]);
    const throwing = {
      ...changeTool,
      execute: async () => {
        throw new Error('boom');
      },
    };
    expect((await dispatchTool([throwing], fakeClient, 'create_thing', { name: 'x' })).changes).toEqual([]);
  });

  it('read tools produce no change events', async () => {
    const listClient = makeClient({ data: [summaryRow], error: null });
    const result = await dispatchTool(READ_TOOLS, listClient, 'list_trips', {});
    expect(result.changes).toEqual([]);
  });
});
