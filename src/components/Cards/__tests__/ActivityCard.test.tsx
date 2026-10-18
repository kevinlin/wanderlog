import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActivityTodo } from '@/components/Todos/todoSelectors';
import type { Activity } from '@/types/trip';
import { ActivityCard } from '../ActivityCard';

const activity: Activity = { activity_id: 'a1', activity_name: 'Panda base', activity_type: 'attraction', duration: '2h' };

const TODAY = '2026-12-05';

const renderCard = (linkedTodo?: ActivityTodo, isDone = false) =>
  render(
    <ActivityCard
      activity={activity}
      isDone={isDone}
      isSelected={false}
      linkedTodo={linkedTodo}
      onSelect={vi.fn()}
      onToggleDone={vi.fn()}
    />
  );

const linked = (over: Partial<ActivityTodo['todo']>): ActivityTodo => ({
  today: TODAY,
  todo: { todo_id: 't1', title: 'Book tickets', done: false, activity_id: 'a1', ...over },
});

describe('ActivityCard todo chip', () => {
  it('shows no chip when the activity has no linked todo', () => {
    renderCard();

    expect(screen.queryByText(/Ready|Overdue|Opens/)).not.toBeInTheDocument();
  });

  it('shows a ready chip with the 🎟 lead', () => {
    renderCard(linked({ due_on: '2026-12-15' }));

    expect(screen.getByText('Ready · by 15 Dec')).toBeInTheDocument();
    expect(screen.getByText('🎟')).toBeInTheDocument();
  });

  it('spells out Overdue', () => {
    renderCard(linked({ due_on: '2026-12-02' }));

    expect(screen.getByText('Overdue · was due 2 Dec')).toBeInTheDocument();
  });

  it('shows when an upcoming todo opens', () => {
    renderCard(linked({ opens_on: '2026-12-09' }));

    expect(screen.getByText('Opens 9 Dec')).toBeInTheDocument();
  });

  it('shows no chip for a done todo', () => {
    renderCard(linked({ done: true, due_on: '2026-12-02' }));

    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it('still shows the chip on a ticked-off activity', () => {
    renderCard(linked({}), true);

    expect(screen.getByText('Ready now')).toBeInTheDocument();
  });
});

describe('ActivityCard keyboard', () => {
  const renderWithSelect = () => {
    const onSelect = vi.fn();
    render(<ActivityCard activity={activity} isDone={false} isSelected={false} onSelect={onSelect} onToggleDone={vi.fn()} />);
    return onSelect;
  };

  it('leaves a Space on the checkbox to the checkbox', () => {
    const onSelect = renderWithSelect();

    // false would mean the card cancelled the key, which blocks the tick
    expect(fireEvent.keyDown(screen.getByRole('checkbox'), { key: ' ' })).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects on Enter when the card itself has focus', () => {
    const onSelect = renderWithSelect();

    fireEvent.keyDown(screen.getByLabelText('Panda base'), { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith('a1');
  });
});

describe('ActivityCard missing fields', () => {
  it('drops the labels and links it has nothing to fill', () => {
    renderCard();

    expect(screen.getByText('Duration:')).toBeInTheDocument();
    expect(screen.queryByText('Travel time:')).not.toBeInTheDocument();
    expect(screen.queryByText(/Details/)).not.toBeInTheDocument();
  });
});
