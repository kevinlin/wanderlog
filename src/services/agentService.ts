import type { AgentEvent, AgentRequestBody } from '@/types/agent';

export interface RunAgentParams {
  accessToken: string;
  onEvent: (event: AgentEvent) => void;
  prompt: string;
  signal?: AbortSignal;
  tripId?: string;
}

export async function runAgent({ accessToken, onEvent, prompt, signal, tripId }: RunAgentParams): Promise<void> {
  const body: AgentRequestBody = tripId ? { prompt, tripId } : { prompt };
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!(response.ok && response.body)) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.error ?? `Agent request failed (${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (line.trim()) {
        onEvent(JSON.parse(line) as AgentEvent);
      }
    }
  }
}
