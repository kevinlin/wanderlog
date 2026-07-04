import type { SupabaseClient } from '@supabase/supabase-js';

export interface FakeCall {
  method: 'delete' | 'insert' | 'select' | 'update' | 'upsert';
  payload?: unknown;
  table: string;
}

export interface FakeResult {
  count?: number | null;
  data?: unknown;
  error?: { message: string } | null;
}

type QueueEntry = FakeResult & { method: FakeCall['method']; table: string };

// Queue-based chainable fake: each from().<method>() call records itself and
// consumes the next queued result matching (table, method); unmatched calls
// resolve { data: null, error: null, count: null }.
export function createFakeClient(queue: QueueEntry[]): { calls: FakeCall[]; client: SupabaseClient } {
  const calls: FakeCall[] = [];
  const pending = [...queue];
  const client = {
    from(table: string) {
      const exec = (method: FakeCall['method'], payload?: unknown) => {
        calls.push({ table, method, payload });
        const index = pending.findIndex((entry) => entry.table === table && entry.method === method);
        const result = index === -1 ? {} : (pending.splice(index, 1)[0] as FakeResult);
        const promise = Promise.resolve({
          data: result.data ?? null,
          error: result.error ?? null,
          count: result.count ?? null,
        });
        const chain = {
          eq: () => chain,
          order: () => chain,
          maybeSingle: () => promise,
          // biome-ignore lint/suspicious/noThenProperty: deliberately thenable, mirroring supabase-js query builders
          then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            promise.then(onFulfilled, onRejected),
        };
        return chain;
      };
      return {
        select: (_columns?: string, _options?: unknown) => exec('select'),
        insert: (rows: unknown) => exec('insert', rows),
        update: (patch: unknown) => exec('update', patch),
        upsert: (rows: unknown, _options?: unknown) => exec('upsert', rows),
        delete: () => exec('delete'),
      };
    },
  };
  return { calls, client: client as unknown as SupabaseClient };
}
