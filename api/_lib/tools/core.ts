import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
// Relative import with explicit .js extension: the Vercel function runtime is
// Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import type { AgentChangeEvent } from '../../../src/types/agent.js';

export interface AgentTool {
  description: string;
  execute: (client: SupabaseClient, input: Record<string, unknown>) => Promise<unknown>;
  name: string;
  schema: z.ZodType;
  toChanges?: (input: Record<string, unknown>, output: unknown) => Omit<AgentChangeEvent, 'type'>[];
}

export const toAnthropicTools = (tools: AgentTool[]): Anthropic.Tool[] =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: z.toJSONSchema(tool.schema) as Anthropic.Tool.InputSchema,
  }));

export interface ToolExecution {
  changes: AgentChangeEvent[];
  content: string;
  isError: boolean;
}

export async function dispatchTool(tools: AgentTool[], client: SupabaseClient, name: string, input: unknown): Promise<ToolExecution> {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    return { content: `Unknown tool: ${name}`, isError: true, changes: [] };
  }
  const parsed = tool.schema.safeParse(input);
  if (!parsed.success) {
    return { content: `Invalid input for ${name}: ${parsed.error.message}`, isError: true, changes: [] };
  }
  try {
    const output = await tool.execute(client, parsed.data as Record<string, unknown>);
    const changes = (tool.toChanges?.(parsed.data as Record<string, unknown>, output) ?? []).map((change) => ({
      ...change,
      type: 'change' as const,
    }));
    return { content: JSON.stringify(output), isError: false, changes };
  } catch (error) {
    return { content: error instanceof Error ? error.message : String(error), isError: true, changes: [] };
  }
}
