import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpsertAccommodation = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  upsertAccommodation: (...args: unknown[]) => mockUpsertAccommodation(...args),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import type { Accommodation } from '@/types/trip';
import { AccommodationFormModal } from '../AccommodationFormModal';

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

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  searchLocation: { lat: -45, lng: 168 },
  stopId: 's1',
  tripId: 't1',
};

describe('AccommodationFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpsertAccommodation.mockResolvedValue(undefined);
  });

  it('create mode maps datetime-local values to the trip text format', async () => {
    render(<AccommodationFormModal {...baseProps} />, { wrapper });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Lakeview Motel' } });
    fireEvent.change(screen.getByLabelText('Check-in'), { target: { value: '2025-12-13T15:00' } });
    fireEvent.change(screen.getByLabelText('Check-out'), { target: { value: '2025-12-16T10:00' } });
    fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'Lake view' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpsertAccommodation).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({
          name: 'Lakeview Motel',
          checkIn: '2025-12-13 15:00',
          checkOut: '2025-12-16 10:00',
          remarks: 'Lake view',
        })
      )
    );
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('edit mode pre-fills fields from the accommodation', async () => {
    const accommodation: Accommodation = {
      name: 'Old Motel',
      address: '1 Lake Rd',
      check_in: '2025-12-13 15:00',
      check_out: '2025-12-16 10:00',
      confirmation: 'ABC123',
      remarks: 'old note',
      location: { lat: -45.03, lng: 168.66 },
    };
    render(<AccommodationFormModal {...baseProps} accommodation={accommodation} />, { wrapper });

    expect(screen.getByLabelText('Name')).toHaveValue('Old Motel');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Lake Rd');
    expect(screen.getByLabelText('Check-in')).toHaveValue('2025-12-13T15:00');
    expect(screen.getByLabelText('Check-out')).toHaveValue('2025-12-16T10:00');
    expect(screen.getByLabelText('Confirmation')).toHaveValue('ABC123');
    expect(screen.getByLabelText('Remarks')).toHaveValue('old note');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New Motel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpsertAccommodation).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'New Motel', lat: -45.03, lng: 168.66 }))
    );
  });

  it('blocks submit when the name is empty', async () => {
    render(<AccommodationFormModal {...baseProps} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeInTheDocument());
    expect(mockUpsertAccommodation).not.toHaveBeenCalled();
  });
});
