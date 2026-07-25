import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { queryClient, tripKeys } from '@/lib/queryClient';
import { VISIT_MUTATION_KEY, type VisitVariables } from '@/lib/visitMutation';
import { ToastProvider } from '../Toast';

const vars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' };

const trip = {
  trip_id: 't1',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', status: { done: false } }],
    },
  ],
};

const runVisitWrite = () =>
  act(() =>
    queryClient
      .getMutationCache()
      .build(queryClient, { mutationKey: [...VISIT_MUTATION_KEY], scope: { id: `visit-${vars.itemId}` } })
      .execute(vars)
      .catch(() => undefined)
  );

describe('the visit-write failure toast', () => {
  beforeEach(() => {
    writeVisitFields.mockReset();
    queryClient.getMutationCache().clear();
    registerMutationDefaults(queryClient);
    queryClient.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays on screen past the four seconds a normal toast lasts', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );
    writeVisitFields.mockRejectedValue(new Error('Failed to fetch'));

    await runVisitWrite();

    expect(await screen.findByText(/could not save your visit note/i)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText(/could not save your visit note/i)).toBeInTheDocument();
  });

  it('retries the same write, under the same per-item scope', async () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );
    writeVisitFields.mockRejectedValueOnce(new Error('Failed to fetch'));

    await runVisitWrite();
    expect(await screen.findByText(/could not save your visit note/i)).toBeInTheDocument();

    writeVisitFields.mockResolvedValueOnce(undefined);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(writeVisitFields).toHaveBeenCalledTimes(2);
    expect(writeVisitFields).toHaveBeenLastCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });
    expect(screen.queryByText(/could not save your visit note/i)).not.toBeInTheDocument();
  });
});
