import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentEvent } from '../../src/types/agent';
import { type AgentTool, dispatchTool, toAnthropicTools } from './tools';

export const MAX_ITERATIONS = 16;
export const MAX_TOKENS_PER_CALL = 4096;

const PROGRESS_LABELS: Record<string, string> = {
  list_trips: 'Listing trips…',
  get_trip: 'Reading trip details…',
};

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
    const toolUses = response.content.filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use');
    if (response.stop_reason !== 'tool_use' || toolUses.length === 0) {
      return { finalText: lastText, hitIterationCap: false };
    }
    messages.push({ role: 'assistant', content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      deps.emit({
        type: 'progress',
        message: PROGRESS_LABELS[toolUse.name] ?? `Running ${toolUse.name}…`,
      });
      const execution = await dispatchTool(deps.tools, deps.supabase, toolUse.name, toolUse.input);
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
