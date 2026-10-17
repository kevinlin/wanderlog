import { QueryClient, QueryClientProvider, skipToken, useQuery } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { Todo, TripData } from '@/types/trip';

export const TRIP_ID = 't1';

// A day inside the trip, so nothing here depends on the real clock.
export const TODAY = '2026-12-05';

export const todo = (todoId: string, title: string, over: Partial<Todo> = {}): Todo => ({ todo_id: todoId, title, done: false, ...over });

// The trip ends in 2099 so that tests reading the real clock (the badge) still
// find it running. Tests that pass TODAY explicitly don't depend on it.
export const makeTrip = (todos: Todo[], over: Partial<TripData> = {}): TripData => ({
  trip_id: TRIP_ID,
  trip_name: 'Sichuan',
  timezone: 'Asia/Shanghai',
  start_date: '2026-12-01',
  end_date: '2099-12-31',
  stops: [
    {
      stop_id: 's1',
      name: 'Chengdu',
      date: { from: '2026-12-15', to: '2026-12-18' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [
        { activity_id: 'a1', activity_name: 'Panda base', activity_type: 'attraction' },
        { activity_id: 'a2', activity_name: 'Hotpot night', activity_type: 'restaurant' },
      ],
    },
    {
      stop_id: 's2',
      name: 'Chongqing',
      date: { from: '2026-12-11', to: '2026-12-14' },
      duration_days: 3,
      location: { lat: 3, lng: 4 },
      activities: [{ activity_id: 'a3', activity_name: 'Cable car', activity_type: 'transport' }],
    },
  ],
  todos,
  ...over,
});

// Reads the trip back out of the query cache, so an optimistic write is visible
// to the component under test the way it is on the real page. enabled: false
// keeps the settle-time invalidation from refetching and resetting the seed.
function Live({ children }: { children: (trip: TripData) => ReactNode }) {
  const { data } = useQuery<TripData>({ queryKey: tripKeys.detail(TRIP_ID), queryFn: skipToken, enabled: false });
  return data ? children(data) : null;
}

export function renderWithTrip(trip: TripData, ui: (trip: TripData) => ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(tripKeys.detail(TRIP_ID), structuredClone(trip));
  client.setQueryData(tripKeys.all, []);
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ToastProvider>
          <Live>{ui}</Live>
        </ToastProvider>
      </QueryClientProvider>
    ),
  };
}
