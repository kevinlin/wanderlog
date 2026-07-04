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
  useToggleActivityDone: () => ({ mutate: vi.fn() }),
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
});
