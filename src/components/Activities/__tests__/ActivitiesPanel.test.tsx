import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import type { ScenicWaypoint } from '@/types/map';
import type { Activity, TripData } from '@/types/trip';
import { ActivitiesPanel } from '../ActivitiesPanel';

vi.mock('@/services/supabaseService', () => ({ writeVisitFields: vi.fn() }));
vi.mock('@/hooks/useWeather', () => ({
  useWeather: () => ({ weather: null, isStale: false, updatedAt: null }),
  // WeatherCard renders inside the expanded activities section and calls this.
  useWeatherDisplay: () => ({ description: 'Weather unavailable', icon: '🌤️', temperature: null, precipitation: null }),
}));
vi.mock('@/hooks/useScreenSize', () => ({ useScreenSize: () => ({ isMobile: false }) }));
vi.mock('@/hooks/useTripMutations', () => ({
  useCreateActivity: () => ({ mutate: vi.fn() }),
  useDeleteActivity: () => ({ mutate: vi.fn() }),
  useDeleteWaypoint: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/services/placesService', () => ({
  PlacesService: { getInstance: () => ({ textSearchWithLocationBias: vi.fn().mockResolvedValue([]) }) },
}));
vi.mock('@/contexts/AppStateContext', () => ({
  useAppStateContext: () => ({
    state: { poiSearch: { query: '', results: [], loading: false, error: null } },
    dispatch: vi.fn(),
  }),
}));
// The item editors load a Places search; none of them is under test here.
vi.mock('@/components/Editing/ActivityFormModal', () => ({ ActivityFormModal: () => null }));
vi.mock('@/components/Editing/AccommodationFormModal', () => ({ AccommodationFormModal: () => null }));
vi.mock('@/components/Editing/WaypointFormModal', () => ({ WaypointFormModal: () => null }));

const trip: TripData = {
  trip_id: 't1',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [],
};

const act = (name: string, over: Partial<Activity> = {}): Activity => ({
  activity_id: name,
  activity_name: name,
  order: 0,
  ...over,
});

const wp = (name: string, over: Partial<ScenicWaypoint> = {}): ScenicWaypoint => ({
  activity_id: name,
  activity_name: name,
  location: {},
  order: 0,
  ...over,
});

const baseProps = {
  activities: [] as Activity[],
  baseId: 's1',
  baseLocation: { lat: 1, lng: 2 },
  onActivitySelect: vi.fn(),
  onItemDone: vi.fn(),
  onReorder: vi.fn(),
  scenicWaypoints: [] as ScenicWaypoint[],
  selectedActivityId: null,
  stopName: 'Tokyo',
  tripData: trip,
};

const renderPanel = (overrides: Partial<typeof baseProps> = {}) => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { rerender } = render(<ActivitiesPanel {...baseProps} {...overrides} />, { wrapper });
  return {
    // RTL re-applies the wrapper on rerender, so the bare element goes in here:
    // wrapping it again would change the element type at that position and
    // remount the panel, throwing away the expand state a test just set.
    rerender: (next: Partial<typeof baseProps>) => rerender(<ActivitiesPanel {...baseProps} {...overrides} {...next} />),
  };
};

// Card titles sit in the same element as a type icon, so the emoji is part of
// their text content. The card's own aria-label is the clean handle: 'Ramen',
// 'Ramen, done', 'Lake, scenic waypoint, done'. The checkbox label is
// `Mark "Ramen" done`, which the comma in this pattern excludes.
const cardLabels = () => screen.getAllByLabelText(/, done$/).map((element) => element.getAttribute('aria-label'));

describe('ActivitiesPanel planned/visited split', () => {
  it('counts and lists only planned waypoints in the scenic group', async () => {
    const user = userEvent.setup();
    renderPanel({
      scenicWaypoints: [wp('Lake'), wp('Bridge', { status: { done: true }, visited_at: '2026-07-15 09:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Scenic Waypoints \(1\)/ }));

    expect(screen.getByLabelText('Lake, scenic waypoint')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Bridge/)).not.toBeInTheDocument();
  });

  it('counts and lists only planned activities in the activities section', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen'), act('Museum', { order: 1, status: { done: true }, visited_at: '2026-07-15 09:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));

    expect(screen.getByLabelText('Ramen')).toBeInTheDocument();
    expect(screen.queryByLabelText(/^Museum/)).not.toBeInTheDocument();
  });

  it('groups visited activities and waypoints by day in visit order', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Museum', { order: 0, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Ramen', { order: 1, status: { done: true }, visited_at: '2026-07-16 12:00' }),
      ],
      scenicWaypoints: [wp('Lake', { order: 0, status: { done: true }, visited_at: '2026-07-15 14:00' })],
    });

    await user.click(screen.getByRole('button', { name: /Visited \(3\)/ }));

    expect(screen.getByText('Wed 15 Jul')).toBeInTheDocument();
    expect(screen.getByText('Thu 16 Jul')).toBeInTheDocument();
    expect(cardLabels()).toEqual(['Museum, done', 'Lake, scenic waypoint, done', 'Ramen, done']);
  });

  it('puts undated visited items in a final group', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Museum', { order: 0, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Ramen', { order: 1, status: { done: true } }),
      ],
    });

    await user.click(screen.getByRole('button', { name: /Visited \(2\)/ }));

    expect(screen.getByText('Time not recorded')).toBeInTheDocument();
    expect(cardLabels()).toEqual(['Museum, done', 'Ramen, done']);
  });

  it('offers drag handles in the planned list and none in the visited one', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [
        act('Ramen'),
        act('Museum', { order: 1, status: { done: true }, visited_at: '2026-07-15 09:10' }),
        act('Shrine', { order: 2, status: { done: true }, visited_at: '2026-07-15 11:00' }),
      ],
    });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));
    await user.click(screen.getByRole('button', { name: /Visited \(2\)/ }));

    expect(screen.getAllByLabelText('Drag to reorder activity')).toHaveLength(1);
    expect(cardLabels()).toHaveLength(2);
  });

  it('moves an item between the sections when it becomes done', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel({ activities: [act('Ramen')] });

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));
    expect(screen.queryByRole('button', { name: /Visited/ })).not.toBeInTheDocument();

    rerender({ activities: [act('Ramen', { status: { done: true }, visited_at: '2026-07-15 09:10' })] });

    // Expanded, the count lives in the section's h3 rather than the toggle.
    expect(screen.getByRole('heading', { name: /Activities \(0\)/ })).toBeInTheDocument();
    expect(screen.getByText('Everything here is ticked off.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Visited \(1\)/ })).toBeInTheDocument();
  });
});
