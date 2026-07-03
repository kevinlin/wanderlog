import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { QueryClient } from '@tanstack/react-query';
import { del, get, set } from 'idb-keyval';

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIVE_MINUTES_MS,
      gcTime: THIRTY_DAYS_MS, // must be >= persister maxAge or cache is dropped on restore
      retry: 1,
    },
  },
});

const PERSIST_KEY = 'wanderlog-query-cache';

export const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: PERSIST_KEY,
});

export const clearPersistedCache = (): Promise<void> => del(PERSIST_KEY);

export const PERSIST_MAX_AGE_MS = THIRTY_DAYS_MS;

export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trip', tripId] as const,
};
export const weatherKeys = {
  base: (baseId: string) => ['weather', baseId] as const,
};
