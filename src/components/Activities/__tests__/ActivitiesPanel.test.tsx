import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import type { ScenicWaypoint } from '@/types/map';
import type { Activity, Todo, TripData } from '@/types/trip';
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

  it('shows and announces where a ticked item went, only on a tick', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel({ activities: [act('Ramen'), act('Sushi', { status: { done: true } })] });

    expect(screen.getByRole('button', { name: /Visited \(1\)/ })).not.toHaveClass('visited-arrive');

    await user.click(screen.getByRole('button', { name: /Activities \(1\)/ }));
    await user.click(screen.getByLabelText('Mark "Ramen" done'));
    rerender({ activities: [act('Ramen', { status: { done: true } }), act('Sushi', { status: { done: true } })] });

    expect(screen.getByRole('button', { name: /Visited \(2\)/ })).toHaveClass('visited-arrive');
    expect(screen.getByText('Moved to Visited, 2 so far')).toBeInTheDocument();
  });
});

describe('ActivitiesPanel todo chips', () => {
  // 12:00 on 5 Dec in Asia/Tokyo, the trip's timezone.
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-12-05T03:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const todo = (id: string, over: Partial<Todo> = {}): Todo => ({ todo_id: id, title: id, done: false, activity_id: 'Ramen', ...over });
  const withTodos = (todos: Todo[]): TripData => ({ ...trip, todos });

  const openActivities = (user: ReturnType<typeof userEvent.setup>) =>
    user.click(screen.getByRole('button', { name: /Activities \(\d+\)/ }));

  it('shows the most urgent linked todo on the card: overdue before ready before upcoming', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen')],
      tripData: withTodos([todo('soon', { opens_on: '2026-12-09' }), todo('open'), todo('late', { due_on: '2026-12-01' })]),
    });

    await openActivities(user);

    expect(screen.getByText('Overdue · was due 1 Dec')).toBeInTheDocument();
    expect(screen.queryByText('Ready now')).not.toBeInTheDocument();
    expect(screen.queryByText(/^Opens/)).not.toBeInTheDocument();
  });

  it('prefers a ready todo to an upcoming one', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen')],
      tripData: withTodos([todo('soon', { opens_on: '2026-12-09' }), todo('open', { due_on: '2026-12-20' })]),
    });

    await openActivities(user);

    expect(screen.getByText('Ready · by 20 Dec')).toBeInTheDocument();
    expect(screen.queryByText(/^Opens/)).not.toBeInTheDocument();
  });

  it('shows no chip when every linked todo is done', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen')],
      tripData: withTodos([todo('a', { done: true }), todo('b', { done: true, due_on: '2026-12-01' })]),
    });

    await openActivities(user);

    expect(screen.getByLabelText('Ramen')).toBeInTheDocument();
    expect(screen.queryByText(/Ready|Overdue|^Opens/)).not.toBeInTheDocument();
  });

  it('chips only the activity the todo is linked to', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen'), act('Museum', { order: 1 })],
      tripData: withTodos([todo('open')]),
    });

    await openActivities(user);

    expect(screen.getAllByText('Ready now')).toHaveLength(1);
  });

  it('keeps the chip on a visited activity whose todo is still open', async () => {
    const user = userEvent.setup();
    renderPanel({
      activities: [act('Ramen', { status: { done: true }, visited_at: '2026-12-05 11:00' })],
      tripData: withTodos([todo('open')]),
    });

    await user.click(screen.getByRole('button', { name: /Visited \(1\)/ }));

    expect(screen.getByText('Ready now')).toBeInTheDocument();
  });
});
