import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMutate = vi.fn();
vi.mock('@/hooks/useTripLibraryMutations', () => ({
  useCreateTrip: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

import { CreateTripModal } from '../CreateTripModal';

const renderModal = () => render(<CreateTripModal isOpen onClose={vi.fn()} />);

describe('CreateTripModal', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a name', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/start date/i), '2026-10-01');
    await user.type(screen.getByLabelText(/end date/i), '2026-10-14');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('rejects an end date before the start date', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/trip name/i), 'Japan Spring');
    await user.type(screen.getByLabelText(/start date/i), '2026-10-14');
    await user.type(screen.getByLabelText(/end date/i), '2026-10-01');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(await screen.findByText(/end date must be after start date/i)).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('submits with the browser timezone', async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByLabelText(/trip name/i), 'Japan Spring');
    await user.type(screen.getByLabelText(/start date/i), '2026-10-01');
    await user.type(screen.getByLabelText(/end date/i), '2026-10-14');
    await user.click(screen.getByRole('button', { name: /create/i }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Japan Spring',
        startDate: '2026-10-01',
        endDate: '2026-10-14',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
    );
  });
});
