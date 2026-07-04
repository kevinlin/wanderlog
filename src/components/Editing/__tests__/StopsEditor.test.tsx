import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateStop = vi.fn();
const mockUpdateStop = vi.fn();
const mockDeleteStop = vi.fn();
const mockApplyStopStructure = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createStop: (...args: unknown[]) => mockCreateStop(...args),
  updateStop: (...args: unknown[]) => mockUpdateStop(...args),
  deleteStop: (...args: unknown[]) => mockDeleteStop(...args),
  applyStopStructure: (...args: unknown[]) => mockApplyStopStructure(...args),
  createActivity: vi.fn(),
  updateActivity: vi.fn(),
  deleteActivity: vi.fn(),
  createWaypoint: vi.fn(),
  updateWaypoint: vi.fn(),
  deleteWaypoint: vi.fn(),
  upsertAccommodation: vi.fn(),
  setActivityDone: vi.fn(),
  setWaypointDone: vi.fn(),
  reorderActivities: vi.fn(),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import { StopsEditor } from '../StopsEditor';

const trip: TripData = {
  trip_id: 't1',
  trip_name: 'Trip',
  timezone: 'UTC',
  stops: [
    {
      stop_id: 'a',
      name: 'Alpha',
      date: { from: '2025-12-13', to: '2025-12-16' }, // 3 nights
      location: { lat: 0, lng: 0 },
      duration_days: 3,
      activities: [],
      scenic_waypoints: [],
    },
    {
      stop_id: 'b',
      name: 'Bravo',
      date: { from: '2025-12-16', to: '2025-12-18' }, // 2 nights
      location: { lat: 1, lng: 1 },
      duration_days: 2,
      activities: [],
      scenic_waypoints: [],
    },
  ],
};

// Mirrors TripPage: the editor re-renders with fresh tripData whenever the
// mutations patch the query cache.
const Host = ({ onClose }: { onClose: () => void }) => {
  const client = useQueryClient();
  const { data } = useQuery<TripData>({
    queryKey: tripKeys.detail('t1'),
    // Echo the optimistically patched cache, as if the server accepted the write
    queryFn: () => structuredClone(client.getQueryData<TripData>(tripKeys.detail('t1')) ?? trip),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return data ? <StopsEditor onClose={onClose} tripData={data} /> : null;
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <Host onClose={onClose} />
      </ToastProvider>
    </QueryClientProvider>
  );
  return { client, onClose };
}

describe('StopsEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApplyStopStructure.mockResolvedValue(undefined);
    mockDeleteStop.mockResolvedValue(undefined);
  });

  it('lists the stops in order with their date ranges', () => {
    setup();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('13 Dec – 16 Dec 2025')).toBeInTheDocument();
    expect(screen.getByText('16 Dec – 18 Dec 2025')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save order & dates' })).toBeDisabled();
  });

  it('previews the cascaded dates after a reorder', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Move Bravo up' }));

    // Bravo (2 nights) re-anchors at the trip start; Alpha (3 nights) follows
    expect(screen.getByText('13 Dec – 15 Dec 2025')).toBeInTheDocument();
    expect(screen.getByText('15 Dec – 18 Dec 2025')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save order & dates' })).toBeEnabled();
  });

  it('saves the reordered structure through applyStopStructure and closes', async () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Move Bravo up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save order & dates' }));

    await waitFor(() =>
      expect(mockApplyStopStructure).toHaveBeenCalledWith(
        't1',
        [
          { id: 'b', sort_order: 0, date_from: '2025-12-13', date_to: '2025-12-15' },
          { id: 'a', sort_order: 1, date_from: '2025-12-15', date_to: '2025-12-18' },
        ],
        '2025-12-13',
        '2025-12-18'
      )
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('deletes a stop after confirmation and re-cascades the rest', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }));
    expect(screen.getByText(/Its accommodation, activities and waypoints go with it/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDeleteStop).toHaveBeenCalledWith('a'));
    // Bravo re-anchors at the original trip start once the cache patch lands
    await waitFor(() => expect(screen.getByText('13 Dec – 15 Dec 2025')).toBeInTheDocument());
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('opens the stop form pre-filled for editing', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Alpha' }));
    expect(screen.getByRole('heading', { name: 'Edit stop' })).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Alpha');
    expect(screen.getByLabelText('From')).toHaveValue('2025-12-13');
    expect(screen.getByLabelText('To')).toHaveValue('2025-12-16');
  });
});
