import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trips = [
  {
    trip_id: 'nz',
    trip_name: 'NZ South Island',
    destination: 'New Zealand',
    start_date: '2025-12-13',
    end_date: '2025-12-29',
    timezone: 'Pacific/Auckland',
  },
  {
    trip_id: 'jp',
    trip_name: 'Japan Spring',
    destination: 'Japan',
    start_date: '2099-04-01',
    end_date: '2099-04-14',
    timezone: 'Asia/Tokyo',
  },
];
vi.mock('@/hooks/useTrips', () => ({
  useTrips: () => ({ trips, isLoading: false, error: null }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'kev@example.com' } }, isLoading: false, signOut: vi.fn() }),
}));
const mockImportMutate = vi.fn();
const mockDeleteMutate = vi.fn();
vi.mock('@/hooks/useTripLibraryMutations', () => ({
  useImportTrip: () => ({ mutate: mockImportMutate, isPending: false, error: null }),
  useDeleteTrip: () => ({ mutate: mockDeleteMutate, isPending: false, error: null }),
}));

import { TripLibraryPage } from '../TripLibraryPage';

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TripLibraryPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

describe('TripLibraryPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists every trip with name, destination, dates and status', () => {
    renderPage();
    expect(screen.getByText('NZ South Island')).toBeInTheDocument();
    expect(screen.getByText(/New Zealand/)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
  });

  it('renders the upcoming trip as the hero card', () => {
    renderPage();
    expect(screen.getByTestId('hero-trip')).toHaveTextContent('Japan Spring');
  });

  it('deletes a trip after confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /delete nz south island/i }));
    expect(screen.getByText(/delete 'nz south island'\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^delete$/i }));
    expect(mockDeleteMutate).toHaveBeenCalledWith('nz');
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /delete nz south island/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockDeleteMutate).not.toHaveBeenCalled();
    expect(screen.queryByText(/delete 'nz south island'\?/i)).not.toBeInTheDocument();
  });
});
