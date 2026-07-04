import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentEvent } from '../../src/types/agent.js';
import { type AgentTool, dispatchTool, toAnthropicTools } from './tools/index.js';

export const MAX_ITERATIONS = 16;
// Sized for a full trip bundle in one tool_use block (creation runs).
export const MAX_TOKENS_PER_CALL = 8192;

// {name} carries its own leading space so nameless inputs collapse cleanly.
const LABEL_TEMPLATES: Record<string, string> = {
  list_trips: 'Listing trips…',
  get_trip: 'Reading trip details…',
  create_activity: 'Adding activity{name}…',
  update_activity: 'Updating activity{name}…',
  delete_activity: 'Deleting activity…',
  create_waypoint: 'Adding scenic waypoint{name}…',
  update_waypoint: 'Updating scenic waypoint{name}…',
  delete_waypoint: 'Deleting scenic waypoint…',
  upsert_accommodation: 'Saving accommodation{name}…',
  update_trip_metadata: 'Updating trip details…',
  create_stop: 'Adding stop{name}…',
  update_stop: 'Updating stop{name}…',
  delete_stop: 'Deleting stop…',
  restructure_stops: 'Reordering stops and recalculating dates…',
  geocode: 'Looking up{name}…',
  create_trip: 'Creating trip{name}…',
};

export function progressLabel(toolName: string, input: unknown): string {
  const template = LABEL_TEMPLATES[toolName];
  if (!template) {
    return `Running ${toolName}…`;
  }
  const fields = input as { address?: unknown; name?: unknown; trip_name?: unknown } | null;
  const raw = fields?.name ?? fields?.trip_name ?? fields?.address;
  const name = typeof raw === 'string' && raw ? ` "${raw}"` : '';
  return template.replace('{name}', name);
}

export interface LoopDeps {
  anthropic: Anthropic;
  emit: (event: AgentEvent) => void;
  model: string;
  signal?: AbortSignal;
  supabase: SupabaseClient;
  tools: AgentTool[];
}

const finalTextOf = (content: Anthropic.ContentBlock[]): string =>
  content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');

export async function runAgentLoop(
  deps: LoopDeps,
  systemPrompt: string,
  userPrompt: string
): Promise<{ finalText: string; hitIterationCap: boolean }> {
  const toolDefs = toAnthropicTools(deps.tools);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }];
  let lastText = '';

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const response = await deps.anthropic.messages.create(
      {
        model: deps.model,
        max_tokens: MAX_TOKENS_PER_CALL,
        system: systemPrompt,
        tools: toolDefs,
        messages,
      },
      { signal: deps.signal }
    );
    lastText = finalTextOf(response.content) || lastText;
    // A truncated response can carry a mangled or incomplete tool_use block;
    // executing it would be worse than stopping and telling the user.
    if (response.stop_reason === 'max_tokens') {
      deps.emit({
        type: 'error',
        message: 'The model response was cut off before finishing; results may be incomplete.',
        detail: null,
      });
      return { finalText: lastText, hitIterationCap: false };
    }
    const toolUses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { finalText: lastText, hitIterationCap: false };
    }
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      deps.emit({ type: 'progress', message: progressLabel(toolUse.name, toolUse.input) });
      const execution = await dispatchTool(deps.tools, deps.supabase, toolUse.name, toolUse.input);
      for (const change of execution.changes) {
        deps.emit(change);
      }
      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: execution.content,
        is_error: execution.isError || undefined,
      });
    }
    messages.push({ role: 'user', content: results });
  }
  return { finalText: lastText, hitIterationCap: true };
}
