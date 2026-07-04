import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
// Relative imports with explicit .js extensions: the Vercel function runtime
// is Node ESM, which neither rewrites tsconfig path aliases nor resolves
// extensionless relative specifiers.
import {
  TRIP_SELECT,
  TRIP_SUMMARY_SELECT,
  type TripRowNested,
  type TripSummaryRow,
  toTripData,
  toTripSummary,
} from '../src/services/supabaseMappers.js';
import type { AgentBufferedResult, AgentChangeEvent, AgentErrorEvent, AgentEvent } from '../src/types/agent.js';
import { loadAgentEnv } from './_lib/env.js';
import { MAX_ITERATIONS, runAgentLoop } from './_lib/loop.js';
import { createUserClient, extractBearerToken, getAuthenticatedUserId } from './_lib/supabase.js';
import { buildSystemPrompt } from './_lib/systemPrompt.js';
import { READ_TOOLS } from './_lib/tools.js';

export const MAX_PROMPT_CHARS = 4000;

const bodySchema = z.object({
  prompt: z.string().min(1).max(MAX_PROMPT_CHARS),
  tripId: z.string().min(1).optional(),
});

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }
  const token = extractBearerToken(request);
  if (!token) {
    return json(401, { error: 'Missing bearer token' });
  }
  const env = loadAgentEnv();
  const supabase = createUserClient(env, token);
  if (!(await getAuthenticatedUserId(supabase, token))) {
    return json(401, { error: 'Invalid or expired token' });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json(400, { error: 'Body must be JSON' });
  }
  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(400, {
      error: `Invalid request: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
    });
  }
  const { prompt, tripId } = parsed.data;

  // Context prefetch (runs under the caller's RLS)
  const context: Parameters<typeof buildSystemPrompt>[0] = {};
  if (tripId) {
    const { data, error } = await supabase.from('trips').select(TRIP_SELECT).eq('id', tripId).maybeSingle();
    if (error || !data) {
      return json(400, { error: `Unknown tripId: ${tripId}` });
    }
    context.trip = toTripData(data as unknown as TripRowNested);
  } else {
    const { data } = await supabase.from('trips').select(TRIP_SUMMARY_SELECT).order('start_date', { ascending: false });
    context.tripSummaries = (data ?? []).map((row) => toTripSummary(row as unknown as TripSummaryRow));
  }

  const anthropic = new Anthropic({ apiKey: env.anthropicApiKey, baseURL: env.anthropicBaseUrl });
  const systemPrompt = buildSystemPrompt(context);
  const wantsBuffered = request.headers.get('accept') === 'application/json';

  const runToEvents = async (emit: (event: AgentEvent) => void): Promise<void> => {
    const { finalText, hitIterationCap } = await runAgentLoop(
      { anthropic, emit, model: env.anthropicModel, signal: request.signal, supabase, tools: READ_TOOLS },
      systemPrompt,
      prompt
    );
    if (hitIterationCap) {
      emit({ type: 'error', message: `Stopped after ${MAX_ITERATIONS} steps without finishing.`, detail: null });
    }
    emit({ type: 'result', summary: finalText, answer: finalText || null, tripId: null });
  };

  if (wantsBuffered) {
    const changes: AgentChangeEvent[] = [];
    const errors: AgentErrorEvent[] = [];
    let result: AgentBufferedResult = { summary: '', answer: null, changes, errors, tripId: null };
    try {
      await runToEvents((event) => {
        if (event.type === 'change') {
          changes.push(event);
        } else if (event.type === 'error') {
          errors.push(event);
        } else if (event.type === 'result') {
          result = { ...result, summary: event.summary, answer: event.answer, tripId: event.tripId };
        }
      });
    } catch (error) {
      return json(502, {
        error: 'The AI service could not complete the request',
        detail: error instanceof Error ? error.message : String(error),
      });
    }
    return json(200, result);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: AgentEvent): void => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        await runToEvents(emit);
      } catch (error) {
        emit({
          type: 'error',
          message: 'The AI service could not complete the request',
          detail: error instanceof Error ? error.message : String(error),
        });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}
