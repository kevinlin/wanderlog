import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateTodo = vi.fn();
const mockDeleteTodo = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createTodo: (...args: unknown[]) => mockCreateTodo(...args),
  updateTodo: vi.fn(),
  setTodoDone: vi.fn(),
  deleteTodo: (...args: unknown[]) => mockDeleteTodo(...args),
}));

import type { Todo } from '@/types/trip';
import { TodoControls } from '../TodoControls';
import { makeTrip, renderWithTrip, TRIP_ID, todo } from './harness';

const renderControls = (todos: Todo[], children?: ReactNode) =>
  renderWithTrip(makeTrip(todos), (trip) => (
    <TodoControls tripData={trip} tripId={TRIP_ID}>
      {children}
    </TodoControls>
  ));

const openPanel = () => userEvent.setup().click(screen.getByRole('button', { name: /^To do/ }));

const panel = () => screen.getByRole('dialog', { name: 'To do' });

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTodo.mockResolvedValue(undefined);
  mockDeleteTodo.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TodoControls badge', () => {
  // useTripToday reads the real clock, so the trip ends in 2099 and the todos
  // below that need no date are ready on whatever day this runs.
  it('counts the todos that are ready and names itself with the count', () => {
    renderControls([todo('a', 'Book the train'), todo('b', 'Book the hotel'), todo('c', 'Done one', { done: true })]);

    expect(screen.getByRole('button', { name: 'To do, 2 ready' })).toBeInTheDocument();
  });

  it('shows no number when nothing is ready', () => {
    renderControls([todo('c', 'Done one', { done: true })]);

    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();
  });

  it('shows no number for a trip that has ended, whatever its todos', () => {
    renderWithTrip(makeTrip([todo('a', 'Book the train')], { end_date: '2020-01-01' }), (trip) => (
      <TodoControls tripData={trip} tripId={TRIP_ID} />
    ));

    expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();
  });

  it('updates at once when a todo is ticked', async () => {
    renderControls([todo('a', 'Book the train'), todo('b', 'Book the hotel')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 2 ready' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mark "Book the train" done' }));

    expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toBeInTheDocument();
  });

  describe('across trip-local midnight', () => {
    // 15:59:30Z is 23:59:30 on 5 Dec in Asia/Shanghai. useTripToday checks once a minute.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'], now: new Date('2026-12-05T15:59:30Z') });
    });

    it('picks up a todo that opens at midnight, without a refetch', () => {
      renderControls([todo('opens-tomorrow', 'Panda base tickets', { opens_on: '2026-12-06' })]);
      expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toBeInTheDocument();
    });

    it('does not change before the date rolls over', () => {
      renderControls([todo('opens-tomorrow', 'Panda base tickets', { opens_on: '2026-12-06' })]);

      act(() => {
        vi.advanceTimersByTime(20_000);
      });

      expect(screen.getByRole('button', { name: 'To do' })).toBeInTheDocument();
    });
  });
});

describe('TodoControls layout', () => {
  it('shares one fixed container with whatever sits beside it', () => {
    renderControls([], <button type="button">Agent</button>);

    const container = screen.getByRole('button', { name: 'To do' }).parentElement;
    expect(container).toHaveClass('fixed', 'flex');
    expect(container).toContainElement(screen.getByRole('button', { name: 'Agent' }));
    expect(screen.getByRole('button', { name: 'To do' }).compareDocumentPosition(screen.getByRole('button', { name: 'Agent' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
});

describe('TodoControls panel', () => {
  it('is closed until the button is pressed, and toggles with it', async () => {
    renderControls([todo('a', 'Book the train')]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    expect(panel()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves focus into the panel when it opens', async () => {
    renderControls([todo('a', 'Book the train')]);

    await openPanel();

    expect(panel()).toContainElement(document.activeElement as HTMLElement);
  });

  it('returns focus to the To do button when the Close control is used', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toHaveFocus();
  });

  it('closes on Escape and returns focus to the button', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toHaveFocus();
  });

  it('closes on a backdrop tap', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.click(screen.getByTestId('todo-backdrop'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'To do, 1 ready' })).toHaveFocus();
  });

  it('ignores Escape while the form is open, and closes on the next one after the form closes', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await user.keyboard('{Escape}');

    expect(panel()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add to-do' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('heading', { name: 'Add to-do' })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores Escape while a delete confirmation is open', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.click(screen.getByRole('button', { name: 'Delete "Book the train"' }));
    await user.keyboard('{Escape}');

    expect(panel()).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Delete to-do' })).toBeInTheDocument();
    expect(mockDeleteTodo).not.toHaveBeenCalled();
  });

  it('keeps the panel open when the form was closed with its own Close control', async () => {
    renderControls([todo('a', 'Book the train')]);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'To do, 1 ready' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));
    const form = screen.getByRole('heading', { name: 'Add to-do' }).closest('form') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Close' }));

    expect(panel()).toBeInTheDocument();
    expect(panel()).toContainElement(document.activeElement as HTMLElement);
  });
});
