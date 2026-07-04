import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadAgentEnvMock = vi.fn(() => ({
  anthropicApiKey: 'k',
  anthropicBaseUrl: undefined,
  anthropicModel: 'test-model',
  supabaseUrl: 'https://proj.supabase.co',
  supabaseAnonKey: 'anon',
}));
vi.mock('../_lib/env', () => ({
  loadAgentEnv: () => loadAgentEnvMock(),
}));

const maybeSingleMock = vi.fn();
const orderMock = vi.fn();
const supabaseClientMock = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: maybeSingleMock })),
      order: orderMock,
    })),
  })),
};
const getAuthenticatedUserIdMock = vi.fn();
vi.mock('../_lib/supabase', () => ({
  createUserClient: () => supabaseClientMock,
  extractBearerToken: (request: Request) => {
    const header = request.headers.get('authorization');
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
  },
  getAuthenticatedUserId: (...args: unknown[]) => getAuthenticatedUserIdMock(...args),
}));

const runAgentLoopMock = vi.fn();
vi.mock('../_lib/loop', async (importOriginal) => {
  const original = await importOriginal<typeof import('../_lib/loop')>();
  return {
    MAX_ITERATIONS: original.MAX_ITERATIONS,
    MAX_TOKENS_PER_CALL: original.MAX_TOKENS_PER_CALL,
    runAgentLoop: (...args: unknown[]) => runAgentLoopMock(...args),
  };
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {},
}));

import handler from '../agent';

const post = (body: unknown, token?: string, headers?: Record<string, string>): Request =>
  new Request('http://x/api/agent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: JSON.stringify(body),
  });

describe('agent handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-1');
    orderMock.mockResolvedValue({ data: [], error: null });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
  });

  it('rejects non-POST with 405', async () => {
    const res = await handler(new Request('http://x/api/agent', { method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('rejects a missing/invalid token with 401 before any model call', async () => {
    getAuthenticatedUserIdMock.mockResolvedValue(null);
    const res = await handler(post({ prompt: 'hi' }, 'bad-token'));
    expect(res.status).toBe(401);
    expect(runAgentLoopMock).not.toHaveBeenCalled();
  });

  it('rejects an over-length prompt with 400', async () => {
    const res = await handler(post({ prompt: 'x'.repeat(4001) }, 'token'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/prompt/i);
  });

  it('rejects an unknown tripId with 400', async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const res = await handler(post({ prompt: 'hi', tripId: 'nope' }, 'token'));
    expect(res.status).toBe(400);
  });

  it('streams NDJSON progress then a result event by default', async () => {
    runAgentLoopMock.mockImplementation(async (deps: { emit: (e: unknown) => void }) => {
      deps.emit({ type: 'progress', message: 'Listing trips…' });
      return { finalText: 'You have 2 trips.', hitIterationCap: false };
    });
    const res = await handler(post({ prompt: 'how many trips?' }, 'token'));
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const lines = (await res.text())
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines[0]).toEqual({ type: 'progress', message: 'Listing trips…' });
    expect(lines.at(-1)).toMatchObject({
      type: 'result',
      summary: 'You have 2 trips.',
      answer: 'You have 2 trips.',
      tripId: null,
    });
  });

  it('returns one buffered JSON body under Accept: application/json', async () => {
    runAgentLoopMock.mockResolvedValue({ finalText: 'Answer.', hitIterationCap: false });
    const res = await handler(post({ prompt: 'q' }, 'token', { Accept: 'application/json' }));
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({
      summary: 'Answer.',
      answer: 'Answer.',
      changes: [],
      errors: [],
      tripId: null,
    });
  });

  it('maps a model-provider failure to 502', async () => {
    runAgentLoopMock.mockRejectedValue(Object.assign(new Error('provider down'), { status: 500 }));
    const res = await handler(post({ prompt: 'q' }, 'token', { Accept: 'application/json' }));
    expect(res.status).toBe(502);
  });
});
