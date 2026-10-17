import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseTripData = vi.fn();
vi.mock('@/hooks/useTripData', () => ({
  useTripData: () => mockUseTripData(),
}));
vi.mock('@/hooks/useTrips', () => ({
  useTrips: () => ({ trips: [], isLoading: false, error: null, refetch: vi.fn() }),
}));
vi.mock('@/hooks/useTripMutations', () => ({
  useReorderActivities: () => ({ mutate: vi.fn() }),
}));
vi.mock('@/hooks/useScreenSize', () => ({
  useScreenSize: () => ({ isMobile: false }),
}));
vi.mock('@/contexts/AppStateContext', () => ({
  useAppStateContext: () => ({
    state: { currentBase: null, selectedActivity: null },
    dispatch: vi.fn(),
  }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'kev@example.com' } }, isLoading: false, signOut: vi.fn() }),
}));
vi.mock('@/components/Map/MapContainer', () => ({
  MapContainer: () => <div data-testid="map" />,
}));
// The main view's own children are not under test here; the stubs also keep the
// agent modal and the sync indicator out of a test that has no QueryClient.
vi.mock('@/components/Agent', () => ({
  AgentButton: () => <button type="button">Agent</button>,
}));
vi.mock('@/components/Timeline/TimelineStrip', () => ({ TimelineStrip: () => null }));
vi.mock('@/components/Activities/ActivitiesPanel', () => ({ ActivitiesPanel: () => null }));
vi.mock('@/components/Layout/SyncIndicator', () => ({ SyncIndicator: () => null }));

import { TripPage } from '../TripPage';

const renderTripPage = () =>
  render(
    <MemoryRouter initialEntries={['/trips/some-trip']}>
      <Routes>
        <Route element={<TripPage />} path="/trips/:tripId" />
        <Route element={<div>trip library</div>} path="/trips" />
      </Routes>
    </MemoryRouter>
  );

describe('TripPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a not-found state with a library link when the trip does not exist', () => {
    mockUseTripData.mockReturnValue({ tripData: null, isLoading: false, error: null, refetch: vi.fn() });
    renderTripPage();
    expect(screen.getByText(/this trip no longer exists/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /trips/i })).toHaveAttribute('href', '/trips');
  });

  it('renders an empty-trip state instead of crashing when the trip has no stops', () => {
    mockUseTripData.mockReturnValue({
      tripData: { trip_id: 'empty', trip_name: 'Japan Spring 2027', timezone: 'Asia/Tokyo', stops: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderTripPage();
    expect(screen.getByText('Japan Spring 2027')).toBeInTheDocument();
    expect(screen.getByText(/no stops yet/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /trips/i })).toHaveAttribute('href', '/trips');
  });

  // Trip-level todos don't need stops, so the button can't depend on them.
  it('shows the To do button, with its count, when the trip has no stops', () => {
    mockUseTripData.mockReturnValue({
      tripData: {
        trip_id: 'empty',
        trip_name: 'Japan Spring 2027',
        timezone: 'Asia/Tokyo',
        stops: [],
        todos: [
          { todo_id: 'a', title: 'Book the train', done: false },
          { todo_id: 'b', title: 'Book the hotel', done: false },
          { todo_id: 'c', title: 'Already booked', done: true },
        ],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderTripPage();
    expect(screen.getByRole('button', { name: 'To do, 2 ready' })).toBeInTheDocument();
  });

  it('shows a plain To do button in the no-stops view when there are no todos', () => {
    mockUseTripData.mockReturnValue({
      tripData: { trip_id: 'empty', trip_name: 'Japan Spring 2027', timezone: 'Asia/Tokyo', stops: [] },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderTripPage();
    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();
  });

  it('puts the To do button left of the Agent button in the main view', () => {
    mockUseTripData.mockReturnValue({
      tripData: {
        trip_id: 'full',
        trip_name: 'Japan Spring 2027',
        timezone: 'Asia/Tokyo',
        stops: [
          {
            stop_id: 's1',
            name: 'Tokyo',
            date: { from: '2027-04-01', to: '2027-04-04' },
            duration_days: 3,
            location: { lat: 1, lng: 2 },
            activities: [],
          },
        ],
        todos: [{ todo_id: 'a', title: 'Book the train', done: false }],
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderTripPage();

    const todo = screen.getByRole('button', { name: 'To do, 1 ready' });
    const agent = screen.getByRole('button', { name: 'Agent' });
    expect(todo.parentElement).toBe(agent.parentElement);
    expect(todo.compareDocumentPosition(agent)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // Every failed visit write invalidates the trip, so the refetch that follows
  // fails on the same dead connection. Showing its error full-screen would take
  // the trip away and bury the rollback toast the failure just raised.
  it('keeps the cached trip on screen when a background refetch fails', () => {
    mockUseTripData.mockReturnValue({
      tripData: { trip_id: 'cached', trip_name: 'Japan Spring 2027', timezone: 'Asia/Tokyo', stops: [] },
      isLoading: false,
      error: 'TypeError: Failed to fetch',
      refetch: vi.fn(),
    });
    renderTripPage();
    expect(screen.getByText('Japan Spring 2027')).toBeInTheDocument();
    expect(screen.queryByText(/adventure data unavailable/i)).not.toBeInTheDocument();
  });

  it('still shows the error state when the refetch fails with nothing cached', () => {
    mockUseTripData.mockReturnValue({ tripData: null, isLoading: false, error: 'TypeError: Failed to fetch', refetch: vi.fn() });
    renderTripPage();
    expect(screen.getByText(/adventure data unavailable/i)).toBeInTheDocument();
  });
});
