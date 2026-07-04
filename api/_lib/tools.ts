import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  TRIP_SELECT,
  TRIP_SUMMARY_SELECT,
  type TripRowNested,
  type TripSummaryRow,
  toTripData,
  toTripSummary,
} from '@/services/supabaseMappers';

export interface AgentTool {
  description: string;
  execute: (client: SupabaseClient, input: Record<string, unknown>) => Promise<unknown>;
  name: string;
  schema: z.ZodType;
}

const listTripsSchema = z.object({}).strict();
const getTripSchema = z.object({ trip_id: z.string().min(1) }).strict();

export const READ_TOOLS: AgentTool[] = [
  {
    name: 'list_trips',
    description:
      'List all trips in the library with id, name, destination, date range, and timezone. Call this to discover trip ids before reading a specific trip.',
    schema: listTripsSchema,
    execute: async (client) => {
      const { data, error } = await client.from('trips').select(TRIP_SUMMARY_SELECT).order('start_date', { ascending: false });
      if (error) {
        throw new Error(error.message);
      }
      return (data ?? []).map((row) => toTripSummary(row as unknown as TripSummaryRow));
    },
  },
  {
    name: 'get_trip',
    description:
      'Read one full trip by id: all stops with dates and coordinates, accommodations, activities (with done status), and scenic waypoints.',
    schema: getTripSchema,
    execute: async (client, input) => {
      const { data, error } = await client
        .from('trips')
        .select(TRIP_SELECT)
        .eq('id', input.trip_id as string)
        .maybeSingle();
      if (error) {
        throw new Error(error.message);
      }
      return data ? toTripData(data as unknown as TripRowNested) : { error: `No trip found with id ${input.trip_id}` };
    },
  },
];

export const toAnthropicTools = (tools: AgentTool[]): Anthropic.Tool[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.schema) as Anthropic.Tool.InputSchema,
  }));

export interface ToolExecution {
  content: string;
  isError: boolean;
}

export async function dispatchTool(tools: AgentTool[], client: SupabaseClient, name: string, input: unknown): Promise<ToolExecution> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true };
  }
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return { content: `Invalid input for ${name}: ${parsed.error.message}`, isError: true };
  }
  try {
    const output = await tool.execute(client, parsed.data as Record<string, unknown>);
    return { content: JSON.stringify(output), isError: false };
  } catch (error) {
    return { content: error instanceof Error ? error.message : String(error), isError: true };
  }
}
