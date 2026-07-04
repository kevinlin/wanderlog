import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AgentEvent } from '@/types/agent';
import { type LoopDeps, MAX_ITERATIONS, progressLabel, runAgentLoop } from '../loop';
import { type AgentTool, READ_TOOLS } from '../tools';

const createMock = vi.fn();

const textResponse = (text: string) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
});
const toolResponse = (...calls: Array<{ id: string; name: string; input: unknown }>) => ({
  stop_reason: 'tool_use',
  content: calls.map((c) => ({ type: 'tool_use', ...c })),
});

const fakeSupabase = {
  from: () => ({
    select: () => ({
      order: () => Promise.resolve({ data: [], error: null }),
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  }),
} as unknown as SupabaseClient;

let emitted: AgentEvent[] = [];

const deps: LoopDeps = {
  anthropic: { messages: { create: createMock } } as unknown as Anthropic,
  emit: (event) => emitted.push(event),
  model: 'test-model',
  supabase: fakeSupabase,
  tools: READ_TOOLS,
};

describe('runAgentLoop', () => {
  beforeEach(() => {
    createMock.mockReset();
    emitted = [];
  });

  it('returns final text when the model answers without tools', async () => {
    createMock.mockResolvedValueOnce(textResponse('Two trips.'));
    const { finalText } = await runAgentLoop(deps, 'sys', 'how many trips?');
    expect(finalText).toBe('Two trips.');
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('dispatches a tool call, feeds the result back, emits progress', async () => {
    createMock
      .mockResolvedValueOnce(toolResponse({ id: 'tu1', name: 'list_trips', input: {} }))
      .mockResolvedValueOnce(textResponse('You have the NZ trip.'));
    const { finalText } = await runAgentLoop(deps, 'sys', 'what trips?');
    expect(finalText).toBe('You have the NZ trip.');
    const secondCallMessages = createMock.mock.calls[1][0].messages;
    expect(secondCallMessages.at(-1)).toMatchObject({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: 'tu1' }],
    });
    expect(emitted).toContainEqual({
      type: 'progress',
      message: expect.stringContaining('trips'),
    });
  });

  it('answers parallel tool_use blocks in a single user message', async () => {
    createMock
      .mockResolvedValueOnce(
        toolResponse({ id: 'a', name: 'get_trip', input: { trip_id: 't1' } }, { id: 'b', name: 'get_trip', input: { trip_id: 't2' } })
      )
      .mockResolvedValueOnce(textResponse('done'));
    await runAgentLoop(deps, 'sys', 'compare trips');
    const results = createMock.mock.calls[1][0].messages.at(-1);
    expect(results.content).toHaveLength(2);
  });

  it('feeds tool errors back as is_error tool_results instead of aborting', async () => {
    createMock.mockResolvedValueOnce(toolResponse({ id: 'x', name: 'nope', input: {} })).mockResolvedValueOnce(textResponse('recovered'));
    const { finalText } = await runAgentLoop(deps, 'sys', 'p');
    expect(finalText).toBe('recovered');
    const result = createMock.mock.calls[1][0].messages.at(-1).content[0];
    expect(result.is_error).toBe(true);
  });

  it('stops at MAX_ITERATIONS and reports the cap', async () => {
    createMock.mockResolvedValue(toolResponse({ id: 'l', name: 'list_trips', input: {} }));
    const { hitIterationCap } = await runAgentLoop(deps, 'sys', 'p');
    expect(hitIterationCap).toBe(true);
    expect(createMock).toHaveBeenCalledTimes(MAX_ITERATIONS);
  });

  it('surfaces a max_tokens truncation as an error event and stops', async () => {
    createMock.mockResolvedValueOnce({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] });
    const { finalText } = await runAgentLoop(deps, 'sys', 'plan a big trip');
    expect(finalText).toBe('partial');
    expect(emitted).toContainEqual({
      type: 'error',
      message: 'The model response was cut off before finishing; results may be incomplete.',
      detail: null,
    });
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('emits change events from tool executions', async () => {
    const changeTool: AgentTool = {
      name: 'create_thing',
      description: 'test tool',
      schema: z.object({ name: z.string() }),
      execute: async () => ({ id: 'row-1' }),
      toChanges: (input, output) => [{ op: 'created', entity: 'activity', id: (output as { id: string }).id, name: input.name as string }],
    };
    createMock
      .mockResolvedValueOnce(toolResponse({ id: 'c1', name: 'create_thing', input: { name: 'Ramen' } }))
      .mockResolvedValueOnce(textResponse('Added.'));
    await runAgentLoop({ ...deps, tools: [changeTool] }, 'sys', 'add ramen');
    expect(emitted).toContainEqual({ type: 'change', op: 'created', entity: 'activity', id: 'row-1', name: 'Ramen' });
  });
});

describe('progressLabel', () => {
  it('labels progress with the item name from the input', () => {
    expect(progressLabel('create_activity', { name: 'Ramen dinner' })).toBe('Adding activity "Ramen dinner"…');
    expect(progressLabel('delete_stop', { stop_id: 's1' })).toBe('Deleting stop…');
    expect(progressLabel('unknown_tool', {})).toBe('Running unknown_tool…');
  });

  it('labels address- and trip_name-carrying inputs', () => {
    expect(progressLabel('geocode', { address: 'Tokyo' })).toBe('Looking up "Tokyo"…');
    expect(progressLabel('create_trip', { trip_name: 'Tokyo with kids' })).toBe('Creating trip "Tokyo with kids"…');
  });
});
