import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentEvent } from '@/types/agent';
import { runAgent } from '../agentService';

const fetchMock = vi.fn();

const mockFetchStream = (chunks: string[]): void => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  fetchMock.mockResolvedValue(new Response(stream, { status: 200 }));
};

describe('runAgent', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('parses NDJSON events, including one split across chunks', async () => {
    const events: AgentEvent[] = [];
    mockFetchStream(['{"type":"progress","mess', 'age":"Reading…"}\n{"type":"result","summary":"A","answer":"A","tripId":null}\n']);
    await runAgent({ accessToken: 't', prompt: 'q', onEvent: (e) => events.push(e) });
    expect(events).toEqual([
      { type: 'progress', message: 'Reading…' },
      { type: 'result', summary: 'A', answer: 'A', tripId: null },
    ]);
  });

  it('sends the token and body', async () => {
    mockFetchStream(['{"type":"result","summary":"","answer":null,"tripId":null}\n']);
    await runAgent({ accessToken: 'jwt', prompt: 'q', tripId: 't1', onEvent: () => {} });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt' }),
        body: JSON.stringify({ prompt: 'q', tripId: 't1' }),
      })
    );
  });

  it('throws the server error message on non-200', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid request: prompt too long' }), { status: 400 }));
    await expect(runAgent({ accessToken: 't', prompt: 'q', onEvent: () => {} })).rejects.toThrow('Invalid request: prompt too long');
  });
});
