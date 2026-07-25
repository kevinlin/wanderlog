import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateMutate = vi.fn();
const mockUseCreateTrip = vi.fn();
vi.mock('@/hooks/useTripLibraryMutations', () => ({
  useCreateTrip: () => mockUseCreateTrip(),
  useImportTrip: () => ({ mutate: vi.fn(), isPending: false, error: null }),
}));
const mockUseOnlineStatus = vi.fn();
vi.mock('@/hooks/useOnlineStatus', () => ({
  useOnlineStatus: () => mockUseOnlineStatus(),
}));
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
}));
vi.mock('@/services/geocodingService', () => ({
  geocodeAddress: vi.fn(async () => ({ lat: 1, lng: 2 })),
}));

import { NewTripPage } from '../NewTripPage';

const renderPage = () =>
  render(
    <MemoryRouter>
      <NewTripPage />
    </MemoryRouter>
  );

const fillForm = async (user: ReturnType<typeof userEvent.setup>, { start, end }: { start: string; end: string }) => {
  await user.type(screen.getByLabelText(/trip name/i), 'Japan in spring');
  // userEvent.type is unreliable on date inputs in jsdom; set them directly.
  fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: start } });
  fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: end } });
};

describe('NewTripPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateTrip.mockReturnValue({ mutate: mockCreateMutate, isPending: false, error: null });
    mockUseOnlineStatus.mockReturnValue(true);
  });

  it('renders the creation form and the import path', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /where to next\?/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/trip name/i)).toHaveFocus();
    expect(screen.getByRole('button', { name: /create trip/i })).toBeEnabled();
    expect(screen.getByText(/wanderlog or tripit export/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to trips/i })).toHaveAttribute('href', '/trips');
  });

  it('requires a name before creating', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: /create trip/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/enter a trip name/i);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('requires both dates before creating', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/trip name/i), 'Japan in spring');
    await user.click(screen.getByRole('button', { name: /create trip/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/start and end date/i);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user, { start: '2027-04-10', end: '2027-04-01' });
    await user.click(screen.getByRole('button', { name: /create trip/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/on or after the start date/i);
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('creates a trip with trimmed fields and the browser timezone', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user, { start: '2027-04-01', end: '2027-04-10' });
    await user.type(screen.getByLabelText(/description/i), '  Cherry blossoms  ');
    await user.click(screen.getByRole('button', { name: /create trip/i }));
    expect(mockCreateMutate).toHaveBeenCalledWith({
      name: 'Japan in spring',
      description: 'Cherry blossoms',
      startDate: '2027-04-01',
      endDate: '2027-04-10',
      timezone: expect.any(String),
    });
  });

  it('shows a live nights badge as dates are picked', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user, { start: '2027-04-01', end: '2027-04-04' });
    expect(screen.getByText('3 nights')).toBeInTheDocument();
  });

  it('calls a same-day range a day trip', async () => {
    const user = userEvent.setup();
    renderPage();
    await fillForm(user, { start: '2027-04-01', end: '2027-04-01' });
    expect(screen.getByText(/day trip/i)).toBeInTheDocument();
  });

  it('disables creation while offline', () => {
    mockUseOnlineStatus.mockReturnValue(false);
    renderPage();
    expect(screen.getByText(/you're offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create trip/i })).toBeDisabled();
  });

  it('locks the button while the trip is being created', () => {
    mockUseCreateTrip.mockReturnValue({ mutate: mockCreateMutate, isPending: true, error: null });
    renderPage();
    expect(screen.getByRole('button', { name: /creating trip/i })).toBeDisabled();
  });

  it('surfaces a server error and keeps the form filled', async () => {
    mockUseCreateTrip.mockReturnValue({ mutate: mockCreateMutate, isPending: false, error: new Error('trips: boom') });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText(/trip name/i), 'Japan in spring');
    expect(screen.getByRole('alert')).toHaveTextContent('trips: boom');
    expect(screen.getByLabelText(/trip name/i)).toHaveValue('Japan in spring');
  });
});
