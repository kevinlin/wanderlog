import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import type { Activity, TripData } from '@/types/trip';
import { ActivityListItem } from '../ActivityListItem';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

vi.mock('@/components/Map/MapContainer', () => ({ MapContainer: () => null }));

const trip: TripData = {
  trip_id: 't1',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [],
    },
  ],
};

const renderItem = (activity: Activity) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  render(
    <ActivityListItem
      activity={activity}
      isDraggable={false}
      isSelected={false}
      onDone={vi.fn()}
      onSelect={vi.fn()}
      trip={trip}
      tripId="t1"
    />,
    { wrapper }
  );
};

const done = (over: Partial<Activity> = {}): Activity => ({
  activity_id: 'act-1',
  activity_name: 'Museum',
  status: { done: true },
  ...over,
});

describe('ActivityListItem', () => {
  // Req 5.1: the visit form is the single editor exempt from the offline gate.
  // ActivitiesPanel wraps onEdit/onDelete in `isOnline ? … : undefined`; if that
  // pattern is ever copied onto onLogVisit, this fails.
  it('offers the visit form while offline', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderItem(done());
    expect(screen.getByLabelText('Log visit details')).toBeInTheDocument();
  });

  it('offers no visit form on an item that is not done', () => {
    renderItem(done({ status: { done: false } }));
    expect(screen.queryByLabelText('Log visit details')).not.toBeInTheDocument();
  });

  it('renders the stored visit time and duration on the card', () => {
    renderItem(done({ visited_at: '2026-07-15 14:32', visit_duration_minutes: 90 }));
    expect(screen.getByText(/14:32/)).toBeInTheDocument();
    expect(screen.getByText(/1h 30m/)).toBeInTheDocument();
  });

  it('stamps the trip-local time when ticked during the trip', async () => {
    const user = userEvent.setup();
    writeVisitFields.mockReset();
    writeVisitFields.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-07-15T05:32:00Z')); // 14:32 in Tokyo

    renderItem(done({ status: { done: false } }));
    await user.click(screen.getByRole('checkbox'));

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });
    vi.useRealTimers();
  });

  it('records no time when ticked outside the trip window', async () => {
    const user = userEvent.setup();
    writeVisitFields.mockReset();
    writeVisitFields.mockResolvedValue(undefined);
    vi.setSystemTime(new Date('2026-09-01T05:32:00Z'));

    renderItem(done({ status: { done: false } }));
    await user.click(screen.getByRole('checkbox'));

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: true, visited_at: null });
    vi.useRealTimers();
  });

  it('clears the stamp when unticked but leaves the note and duration', async () => {
    const user = userEvent.setup();
    writeVisitFields.mockReset();
    writeVisitFields.mockResolvedValue(undefined);

    renderItem(done({ visited_at: '2026-07-15 14:32', visit_duration_minutes: 90, remarks: 'queue was long' }));
    await user.click(screen.getByRole('checkbox'));

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: false, visited_at: null });
  });
});
