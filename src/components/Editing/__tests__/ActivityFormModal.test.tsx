import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createActivity: (...args: unknown[]) => mockCreateActivity(...args),
  updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
  deleteActivity: vi.fn(),
  setActivityDone: vi.fn(),
  setWaypointDone: vi.fn(),
  reorderActivities: vi.fn(),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import type { Activity } from '@/types/trip';
import { ActivityFormModal } from '../ActivityFormModal';

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
  sortOrder: 3,
  stopId: 's1',
  tripId: 't1',
};

describe('ActivityFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateActivity.mockResolvedValue('new-id');
    mockUpdateActivity.mockResolvedValue(undefined);
  });

  it('create mode submits an ActivityInput with the entered values', async () => {
    render(<ActivityFormModal {...baseProps} />, { wrapper });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Kayaking' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'outdoor' } });
    fireEvent.change(screen.getByLabelText('Duration'), { target: { value: '2 hours' } });
    fireEvent.change(screen.getByLabelText('Remarks'), { target: { value: 'Bring togs' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockCreateActivity).toHaveBeenCalledWith(
        's1',
        3,
        expect.objectContaining({ name: 'Kayaking', type: 'outdoor', duration: '2 hours', remarks: 'Bring togs' })
      )
    );
    await waitFor(() => expect(baseProps.onClose).toHaveBeenCalled());
  });

  it('edit mode pre-fills fields from the activity and updates by id', async () => {
    const activity: Activity = {
      activity_id: 'act-1',
      activity_name: 'Old name',
      activity_type: 'outdoor',
      location: { lat: -45, lng: 168, address: '1 Lake Rd' },
      duration: '1 hour',
      remarks: 'old note',
      status: { done: false },
    };
    render(<ActivityFormModal {...baseProps} activity={activity} />, { wrapper });

    expect(screen.getByLabelText('Name')).toHaveValue('Old name');
    expect(screen.getByLabelText('Type')).toHaveValue('outdoor');
    expect(screen.getByLabelText('Address')).toHaveValue('1 Lake Rd');
    expect(screen.getByLabelText('Duration')).toHaveValue('1 hour');
    expect(screen.getByLabelText('Remarks')).toHaveValue('old note');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'New name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockUpdateActivity).toHaveBeenCalledWith('act-1', expect.objectContaining({ name: 'New name', lat: -45, lng: 168 }))
    );
  });

  it('blocks submit when the name is empty', async () => {
    render(<ActivityFormModal {...baseProps} />, { wrapper });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByLabelText('Name')).toBeInTheDocument());
    expect(mockCreateActivity).not.toHaveBeenCalled();
  });
});
