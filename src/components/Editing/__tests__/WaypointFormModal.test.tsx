import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateWaypoint = vi.fn();
const mockUpdateWaypoint = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createWaypoint: (...args: unknown[]) => mockCreateWaypoint(...args),
  updateWaypoint: (...args: unknown[]) => mockUpdateWaypoint(...args),
  deleteWaypoint: vi.fn(),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import type { ScenicWaypoint } from '@/types/map';
import { WaypointFormModal } from '../WaypointFormModal';

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
  sortOrder: 2,
  stopId: 's1',
  tripId: 't1',
};

describe('WaypointFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateWaypoint.mockResolvedValue('new-id');
    mockUpdateWaypoint.mockResolvedValue(undefined);
  });

  it('create mode submits a WaypointInput with the entered values', async () => {
    render(<WaypointFormModal {...baseProps} />, { wrapper });

    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Devils Punchbowl' } });
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '30 mins' } });
    fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'Short walk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockCreateWaypoint).toHaveBeenCalledWith(
        's1',
        2,
        expect.objectContaining({ name: 'Devils Punchbowl', duration: '30 mins', remarks: 'Short walk' })
      )
    );
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('edit mode pre-fills fields from the waypoint and updates by id', async () => {
    const waypoint: ScenicWaypoint = {
      activity_id: 'wp-1',
      activity_name: 'Old falls',
      location: { lat: -42.9, lng: 171.5, address: 'Arthur’s Pass' },
      duration: '1 hour',
      remarks: 'old note',
      status: { done: false },
    };
    render(<WaypointFormModal {...baseProps} waypoint={waypoint} />, { wrapper });

    expect(screen.getByLabelText('Name')).toHaveValue('Old falls');
    expect(screen.getByLabelText('Address')).toHaveValue('Arthur’s Pass');
    expect(screen.getByLabelText('Duration')).toHaveValue('1 hour');
    expect(screen.getByLabelText('Remarks')).toHaveValue('old note');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New falls' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateWaypoint).toHaveBeenCalledWith('wp-1', expect.objectContaining({ name: 'New falls', lat: -42.9, lng: 171.5 }))
    );
  });

  it('blocks submit when the name is empty', async () => {
    render(<WaypointFormModal {...baseProps} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeInTheDocument());
    expect(mockCreateWaypoint).not.toHaveBeenCalled();
  });
});
