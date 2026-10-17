import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateTodo = vi.fn();
const mockUpdateTodo = vi.fn();
const mockSetTodoDone = vi.fn();
const mockDeleteTodo = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createTodo: (...args: unknown[]) => mockCreateTodo(...args),
  updateTodo: (...args: unknown[]) => mockUpdateTodo(...args),
  setTodoDone: (...args: unknown[]) => mockSetTodoDone(...args),
  deleteTodo: (...args: unknown[]) => mockDeleteTodo(...args),
}));

import type { Todo } from '@/types/trip';
import { TodoPanel } from '../TodoPanel';
import { makeTrip, renderWithTrip, TODAY, TRIP_ID, todo } from './harness';

const renderPanel = (todos: Todo[], onClose = vi.fn()) =>
  renderWithTrip(makeTrip(todos), (trip) => <TodoPanel onClose={onClose} today={TODAY} tripData={trip} tripId={TRIP_ID} />);

// The checkbox label carries each row's title, so it gives a row order without a test-only hook.
const titlesIn = (regionName: string): string[] =>
  within(screen.getByRole('region', { name: regionName }))
    .getAllByRole('checkbox')
    .map((checkbox) => /^Mark "(.*)" done$/.exec(checkbox.getAttribute('aria-label') ?? '')?.[1] ?? '');

const mixed = [
  todo('r-train', 'Book the Chongqing train', { opens_on: '2026-11-27', due_on: '2026-12-10' }),
  todo('r-late', 'Buy cruise tickets', { due_on: '2026-12-01' }),
  todo('r-open', 'Check the drone show'),
  todo('r-soon', 'Book the cable car', { due_on: '2026-12-06' }),
  todo('u-late', 'Panda base tickets', { opens_on: '2026-12-09' }),
  todo('u-early', 'Panda Valley charter', { opens_on: '2026-12-07' }),
  todo('d-1', 'Book the hotel', { done: true, due_on: '2026-11-30' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTodo.mockResolvedValue(undefined);
  mockUpdateTodo.mockResolvedValue(undefined);
  mockSetTodoDone.mockResolvedValue(undefined);
  mockDeleteTodo.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TodoPanel grouping', () => {
  it('shows Ready now, Coming up and Done, each with its count', () => {
    renderPanel(mixed);

    expect(screen.getByRole('heading', { name: 'Ready now (4)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Coming up (2)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done (1)' })).toBeInTheDocument();
  });

  it('orders Ready now with the overdue todo first, then by deadline, with no deadline last', () => {
    renderPanel(mixed);

    expect(titlesIn('Ready now (4)')).toEqual([
      'Buy cruise tickets',
      'Book the cable car',
      'Book the Chongqing train',
      'Check the drone show',
    ]);
  });

  it('orders Coming up by the day each one opens', () => {
    renderPanel(mixed);

    expect(titlesIn('Coming up (2)')).toEqual(['Panda Valley charter', 'Panda base tickets']);
  });

  it('spells out Overdue on the late row, so colour is not the only signal', () => {
    renderPanel(mixed);

    expect(screen.getByText('Overdue · was due 1 Dec')).toBeInTheDocument();
  });

  it('starts with Done collapsed and opens it on demand', async () => {
    renderPanel(mixed);
    expect(screen.queryByText('Book the hotel')).not.toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: 'Done (1)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.setup().click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Book the hotel')).toBeInTheDocument();
  });

  it('has no Done or Coming up group when there is nothing in them', () => {
    renderPanel([todo('only', 'Book the train')]);

    expect(screen.getByRole('heading', { name: 'Ready now (1)' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Coming up/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Done/ })).not.toBeInTheDocument();
  });

  it('says so when nothing is ready but other todos exist', () => {
    renderPanel([todo('later', 'Panda base tickets', { opens_on: '2026-12-09' })]);

    expect(screen.getByRole('heading', { name: 'Ready now (0)' })).toBeInTheDocument();
    expect(screen.getByText('Nothing to book right now.')).toBeInTheDocument();
  });
});

describe('TodoPanel rows', () => {
  it('shows the link line, chip and notes on a row', () => {
    renderPanel([
      todo('t1', 'Book panda base tickets', {
        activity_id: 'a1',
        stop_id: 's1',
        due_on: '2026-12-15',
        notes: 'Winter morning session from 08:00',
      }),
    ]);

    expect(screen.getByText('Panda base')).toBeInTheDocument();
    expect(screen.getByText('Ready · by 15 Dec')).toBeInTheDocument();
    expect(screen.getByText('Winter morning session from 08:00')).toBeInTheDocument();
  });

  it('names the stop when the todo links to a stop only', () => {
    renderPanel([todo('t1', 'Book the train', { stop_id: 's2' })]);

    expect(screen.getByText('Chongqing')).toBeInTheDocument();
  });

  it('gives a done row the strike-through treatment', async () => {
    renderPanel([todo('d', 'Book the hotel', { done: true })]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Done (1)' }));

    expect(screen.getByText('Book the hotel')).toHaveClass('line-through');
    expect(screen.getByRole('checkbox', { name: 'Mark "Book the hotel" done' })).toBeChecked();
  });

  it('offers no chip on a done row', async () => {
    renderPanel([todo('d', 'Book the hotel', { done: true, due_on: '2026-12-01' })]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Done (1)' }));

    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });
});

describe('TodoPanel links', () => {
  it('opens an http(s) URL in a new tab without leaking the opener', () => {
    renderPanel([todo('t1', 'Book the train', { url: 'https://www.12306.cn/en/index.html' })]);

    const link = screen.getByRole('link', { name: 'Open link for "Book the train"' });
    expect(link).toHaveAttribute('href', 'https://www.12306.cn/en/index.html');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('accepts plain http and any letter case, as the database check does', () => {
    renderPanel([todo('a', 'Plain http', { url: 'http://example.com/a' }), todo('b', 'Upper case', { url: 'HTTPS://EXAMPLE.COM/B' })]);

    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  it.each([
    ['javascript:', 'javascript:alert(1)'],
    ['ftp:', 'ftp://example.com/file'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['a scheme-less string', 'www.example.com'],
  ])('renders no link for %s', (_name, url) => {
    renderPanel([todo('t1', 'Sketchy', { url })]);

    expect(screen.getByText('Sketchy')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('TodoPanel empty state', () => {
  it('invites adding the first booking when the trip has no todos', () => {
    renderPanel([]);

    expect(screen.getByText('Nothing to book yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add the first one' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: /Ready now/ })).not.toBeInTheDocument();
  });

  it('opens the form from the empty state', async () => {
    renderPanel([]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Add the first one' }));

    expect(screen.getByRole('heading', { name: 'Add to-do' })).toBeInTheDocument();
  });
});

describe('TodoPanel offline', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  it('still renders the list', () => {
    renderPanel(mixed);

    expect(screen.getByText('Buy cruise tickets')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ready now (4)' })).toBeInTheDocument();
  });

  it('disables Add, edit, delete and every checkbox, including those in Done', async () => {
    renderPanel(mixed);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Done (1)' }));

    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
    for (const button of screen.getAllByRole('button', { name: /^(Edit|Delete) "/ })) {
      expect(button).toBeDisabled();
    }
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(7);
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeDisabled();
    }
  });

  it('disables the empty-state add button too', () => {
    renderPanel([]);

    expect(screen.getByRole('button', { name: 'Add the first one' })).toBeDisabled();
  });

  it('keeps reading controls working: Close, the Done toggle and open-link', () => {
    renderPanel([todo('t1', 'Book the train', { url: 'https://example.com' }), todo('d', 'Book the hotel', { done: true })]);

    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Done (1)' })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Open link for "Book the train"' })).toBeInTheDocument();
  });
});

describe('TodoPanel writes', () => {
  it('writes a tick through setTodoDone and updates the list at once', async () => {
    renderPanel([todo('t1', 'Book the train'), todo('t2', 'Book the hotel')]);

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Mark "Book the train" done' }));

    expect(mockSetTodoDone).toHaveBeenCalledWith('t1', true);
    expect(screen.getByRole('heading', { name: 'Ready now (1)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Done (1)' })).toBeInTheDocument();
  });

  it('opens the form pre-filled from the pencil', async () => {
    renderPanel([todo('t1', 'Book the train', { notes: 'Early one' })]);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit "Book the train"' }));

    expect(screen.getByRole('heading', { name: 'Edit to-do' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Book the train');
    expect(screen.getByLabelText('Notes')).toHaveValue('Early one');
  });

  it('asks before deleting, and deletes on confirm', async () => {
    const user = userEvent.setup();
    renderPanel([todo('t1', 'Book the train')]);

    await user.click(screen.getByRole('button', { name: 'Delete "Book the train"' }));
    expect(screen.getByRole('heading', { name: 'Delete to-do' })).toBeInTheDocument();
    expect(mockDeleteTodo).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(mockDeleteTodo).toHaveBeenCalledWith('t1');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Delete to-do' })).not.toBeInTheDocument());
  });

  it('leaves the todo alone when the delete is cancelled', async () => {
    const user = userEvent.setup();
    renderPanel([todo('t1', 'Book the train')]);

    await user.click(screen.getByRole('button', { name: 'Delete "Book the train"' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockDeleteTodo).not.toHaveBeenCalled();
    expect(screen.getByText('Book the train')).toBeInTheDocument();
  });
});

describe('TodoPanel celebration', () => {
  const CELEBRATION = 'All booked. Now the fun part. 🎉';

  it('celebrates when the last active todo is ticked', async () => {
    renderPanel([todo('last', 'Book the train'), todo('done', 'Book the hotel', { done: true })]);

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Mark "Book the train" done' }));

    expect(await screen.findByText(CELEBRATION)).toBeInTheDocument();
  });

  it('stays quiet while other todos are still active', async () => {
    renderPanel([todo('a', 'Book the train'), todo('b', 'Book the hotel')]);

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Mark "Book the train" done' }));

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalled());
    expect(screen.queryByText(CELEBRATION)).not.toBeInTheDocument();
  });

  it('stays quiet when an upcoming todo is ticked', async () => {
    renderPanel([todo('later', 'Panda base tickets', { opens_on: '2026-12-09' })]);

    await userEvent.setup().click(screen.getByRole('checkbox', { name: 'Mark "Panda base tickets" done' }));

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalled());
    expect(screen.queryByText(CELEBRATION)).not.toBeInTheDocument();
  });

  it('never celebrates an untick', async () => {
    const user = userEvent.setup();
    renderPanel([todo('d', 'Book the train', { done: true })]);

    await user.click(screen.getByRole('button', { name: 'Done (1)' }));
    await user.click(screen.getByRole('checkbox', { name: 'Mark "Book the train" done' }));

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalledWith('d', false));
    expect(screen.queryByText(CELEBRATION)).not.toBeInTheDocument();
  });
});
