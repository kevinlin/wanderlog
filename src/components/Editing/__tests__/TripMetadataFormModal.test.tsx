import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateTripMetadata = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  updateTripMetadata: (...args: unknown[]) => mockUpdateTripMetadata(...args),
  importTrip: vi.fn(),
  deleteTrip: vi.fn(),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import type { TripSummary } from '@/types/trip';
import { TripMetadataFormModal } from '../TripMetadataFormModal';

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
};

const trip: TripSummary = {
  trip_id: 't1',
  trip_name: 'NZ South Island',
  description: 'Family holiday',
  destination: 'New Zealand',
  start_date: '2025-12-13',
  end_date: '2025-12-29',
  timezone: 'Pacific/Auckland',
};

const baseProps = { isOpen: true, onClose: vi.fn(), trip };

describe('TripMetadataFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTripMetadata.mockResolvedValue(undefined);
  });

  it('pre-fills from the trip summary and submits the edited patch', async () => {
    render(<TripMetadataFormModal {...baseProps} />, { wrapper });

    expect(screen.getByLabelText('Name')).toHaveValue('NZ South Island');
    expect(screen.getByLabelText('Description')).toHaveValue('Family holiday');
    expect(screen.getByLabelText('Start date')).toHaveValue('2025-12-13');
    expect(screen.getByLabelText('End date')).toHaveValue('2025-12-29');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'NZ Summer' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2025-12-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateTripMetadata).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ name: 'NZ Summer', startDate: '2025-12-13', endDate: '2025-12-30' })
      )
    );
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('sends null when the description is cleared', async () => {
    render(<TripMetadataFormModal {...baseProps} />, { wrapper });

    fireEvent.change(screen.getByLabelText('Description'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockUpdateTripMetadata).toHaveBeenCalledWith('t1', expect.objectContaining({ description: null })));
  });

  it('blocks submit when the end date is before the start date', async () => {
    render(<TripMetadataFormModal {...baseProps} />, { wrapper });

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2025-12-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText('End date must be on or after the start date')).toBeInTheDocument());
    expect(mockUpdateTripMetadata).not.toHaveBeenCalled();
  });

  it('blocks submit when the name is empty', async () => {
    render(<TripMetadataFormModal {...baseProps} />, { wrapper });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeInTheDocument());
    expect(mockUpdateTripMetadata).not.toHaveBeenCalled();
  });
});
