import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { formatTripLocal } from '@/services/visitRecord';
import { VisitDetailsModal } from '../VisitDetailsModal';

const item = {
  activity_id: 'act-1',
  activity_name: 'Museum',
  visited_at: '2026-07-15 09:10',
  visit_duration_minutes: 90,
  remarks: 'early start',
};

const renderModal = (overrides: Partial<React.ComponentProps<typeof VisitDetailsModal>> = {}) => {
  const onSave = vi.fn();
  render(
    <VisitDetailsModal
      isOpen
      item={item}
      onClose={vi.fn()}
      onSave={onSave}
      tripEndDate="2026-07-19"
      tripStartDate="2026-07-12"
      tripTimezone="Asia/Tokyo"
      {...overrides}
    />
  );
  return { onSave };
};

describe('VisitDetailsModal', () => {
  it('prefills every field from the stored values', () => {
    renderModal();
    expect(screen.getByLabelText('Date')).toHaveValue('2026-07-15');
    expect(screen.getByLabelText('Time')).toHaveValue('09:10');
    expect(screen.getByLabelText('Hours')).toHaveValue(1);
    expect(screen.getByLabelText('Minutes')).toHaveValue(30);
    expect(screen.getByLabelText('Notes')).toHaveValue('early start');
  });

  it('shows the trip range as guidance', () => {
    renderModal();
    expect(screen.getByText(/2026-07-12 to 2026-07-19/)).toBeInTheDocument();
    expect(screen.queryByText(/outside this trip/i)).not.toBeInTheDocument();
  });

  it('saves an out-of-range date with a warning rather than blocking', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.clear(screen.getByLabelText('Date'));
    await user.type(screen.getByLabelText('Date'), '2026-07-25');
    expect(screen.getByText(/outside this trip/i)).toBeInTheDocument();

    // Clicking the real button exercises native form validation; calling the
    // submit handler directly would not catch a min/max regression.
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      visitedAt: '2026-07-25 09:10',
      visitDurationMinutes: 90,
      remarks: 'early start',
    });
  });

  it('sends nulls when the fields are cleared', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.clear(screen.getByLabelText('Date'));
    await user.clear(screen.getByLabelText('Hours'));
    await user.clear(screen.getByLabelText('Minutes'));
    await user.clear(screen.getByLabelText('Notes'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({ visitedAt: null, visitDurationMinutes: null, remarks: null });
  });

  it('keeps a whole-hour duration as hours with empty minutes', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ item: { activity_id: 'act-3', activity_name: 'Onsen', visit_duration_minutes: 120 } });

    expect(screen.getByLabelText('Hours')).toHaveValue(2);
    expect(screen.getByLabelText('Minutes')).toHaveValue(0);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ visitDurationMinutes: 120 }));
  });

  it('defaults the date and time to now in the trip zone when unset', () => {
    renderModal({ item: { activity_id: 'act-2', activity_name: 'Ramen' } });
    const expected = formatTripLocal(new Date(), 'Asia/Tokyo');
    expect(screen.getByLabelText('Date')).toHaveValue(expected.slice(0, 10));
    expect(screen.getByLabelText('Time')).toHaveValue(expected.slice(11, 16));
  });
});
