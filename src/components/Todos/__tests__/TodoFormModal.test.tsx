import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreateTodo = vi.fn();
const mockUpdateTodo = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  createTodo: (...args: unknown[]) => mockCreateTodo(...args),
  updateTodo: (...args: unknown[]) => mockUpdateTodo(...args),
  setTodoDone: vi.fn(),
  deleteTodo: vi.fn(),
}));

import type { Todo } from '@/types/trip';
import { TodoFormModal } from '../TodoFormModal';
import { makeTrip, renderWithTrip, TRIP_ID, todo } from './harness';

const renderForm = (existing?: Todo, onClose = vi.fn()) =>
  renderWithTrip(makeTrip(existing ? [existing] : []), (trip) => (
    <TodoFormModal isOpen onClose={onClose} todo={existing} tripData={trip} tripId={TRIP_ID} />
  ));

const save = () => userEvent.setup().click(screen.getByRole('button', { name: 'Save' }));

const setDate = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateTodo.mockResolvedValue(undefined);
  mockUpdateTodo.mockResolvedValue(undefined);
});

describe('TodoFormModal fields', () => {
  it('asks for title, notes, URL, link and both dates', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: 'Add to-do' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Notes')).toBeInTheDocument();
    expect(screen.getByLabelText('URL')).toHaveAttribute('type', 'url');
    expect(screen.getByLabelText('Link to')).toBeInTheDocument();
    expect(screen.getByLabelText('Ready from')).toHaveAttribute('type', 'date');
    expect(screen.getByLabelText('Book by')).toHaveAttribute('type', 'date');
  });

  it('sets no native min or max on the dates, which would block the submit', () => {
    renderForm();

    for (const label of ['Ready from', 'Book by']) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('min');
      expect(screen.getByLabelText(label)).not.toHaveAttribute('max');
    }
  });

  it('groups each stop with its activities in the link select', () => {
    renderForm();

    const chengdu = screen.getByRole('group', { name: 'Chengdu' });
    expect(
      within(chengdu)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Chengdu (whole stop)', '📸 Panda base', '🍽️ Hotpot night']);
    const chongqing = screen.getByRole('group', { name: 'Chongqing' });
    expect(
      within(chongqing)
        .getAllByRole('option')
        .map((option) => option.textContent)
    ).toEqual(['Chongqing (whole stop)', '🚗 Cable car']);
    expect(screen.getByRole('option', { name: 'Whole trip' })).toBeInTheDocument();
  });
});

describe('TodoFormModal validation', () => {
  it('rejects a blank title with an inline error and writes nothing', async () => {
    renderForm();

    await save();

    expect(screen.getByRole('alert')).toHaveTextContent('Give it a title.');
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only title', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Give it a title.');
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('rejects a tab-only title, which the database check also refuses', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: '\t' } });
    await save();

    expect(screen.getByRole('alert')).toHaveTextContent('Give it a title.');
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('rejects "Ready from" after "Book by"', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    setDate('Ready from', '2026-12-10');
    setDate('Book by', '2026-12-05');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent("Book by can't be before Ready from.");
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('accepts "Ready from" and "Book by" on the same day', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    setDate('Ready from', '2026-12-05');
    setDate('Book by', '2026-12-05');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTodo).toHaveBeenCalledTimes(1);
  });

  it.each(['javascript:alert(1)', 'ftp://example.com/file'])('rejects the URL %s, since the database only takes http(s)', async (url) => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    await user.type(screen.getByLabelText('URL'), url);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Links need to start with http:// or https://');
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });

  it('clears an error once the field is fixed', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Title'), 'Book the train');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('TodoFormModal link pre-fill', () => {
  it("fills an empty Book by with the picked stop's first day", async () => {
    renderForm();

    await userEvent.setup().selectOptions(screen.getByLabelText('Link to'), 'stop:s1');

    expect(screen.getByLabelText('Book by')).toHaveValue('2026-12-15');
  });

  it("fills it with the activity's stop's first day when an activity is picked", async () => {
    renderForm();

    await userEvent.setup().selectOptions(screen.getByLabelText('Link to'), 'activity:a3');

    expect(screen.getByLabelText('Book by')).toHaveValue('2026-12-11');
  });

  it('leaves a Book by the user already set', async () => {
    renderForm();
    setDate('Book by', '2026-12-02');

    await userEvent.setup().selectOptions(screen.getByLabelText('Link to'), 'stop:s1');

    expect(screen.getByLabelText('Book by')).toHaveValue('2026-12-02');
  });

  it('writes the stop as well when an activity is picked', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book panda tickets');
    await user.selectOptions(screen.getByLabelText('Link to'), 'activity:a1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTodo).toHaveBeenCalledWith(
      TRIP_ID,
      expect.any(String),
      expect.objectContaining({ title: 'Book panda tickets', activityId: 'a1', stopId: 's1', dueOn: '2026-12-15' })
    );
  });

  it('writes only the stop when a stop is picked', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    await user.selectOptions(screen.getByLabelText('Link to'), 'stop:s2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTodo).toHaveBeenCalledWith(
      TRIP_ID,
      expect.any(String),
      expect.objectContaining({ stopId: 's2', activityId: undefined })
    );
  });
});

describe('TodoFormModal saving', () => {
  it('trims the text and leaves blank optional fields absent', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), '  Book the train  ');
    await user.type(screen.getByLabelText('Notes'), '   ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTodo).toHaveBeenCalledWith(TRIP_ID, expect.any(String), {
      title: 'Book the train',
      notes: undefined,
      url: undefined,
      opensOn: undefined,
      dueOn: undefined,
      stopId: undefined,
      activityId: undefined,
    });
  });

  it('sends every field it was given', async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    await user.type(screen.getByLabelText('Notes'), 'Early one');
    await user.type(screen.getByLabelText('URL'), 'https://www.12306.cn/');
    setDate('Ready from', '2026-12-01');
    setDate('Book by', '2026-12-10');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockCreateTodo).toHaveBeenCalledWith(TRIP_ID, expect.any(String), {
      title: 'Book the train',
      notes: 'Early one',
      url: 'https://www.12306.cn/',
      opensOn: '2026-12-01',
      dueOn: '2026-12-10',
      stopId: undefined,
      activityId: undefined,
    });
  });

  it('closes once the write succeeds', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderForm(undefined, onClose);

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stays open and shows the error when the write fails', async () => {
    const onClose = vi.fn();
    mockCreateTodo.mockRejectedValue(new Error('Failed to fetch'));
    const user = userEvent.setup();
    renderForm(undefined, onClose);

    await user.type(screen.getByLabelText('Title'), 'Book the train');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Failed to fetch')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('TodoFormModal editing', () => {
  const existing = todo('t1', 'Book panda tickets', {
    notes: 'Winter session',
    url: 'https://example.com/panda',
    opens_on: '2026-12-02',
    due_on: '2026-12-15',
    activity_id: 'a1',
    stop_id: 's1',
  });

  it('pre-fills every field, selecting the activity when one is linked', () => {
    renderForm(existing);

    expect(screen.getByRole('heading', { name: 'Edit to-do' })).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('Book panda tickets');
    expect(screen.getByLabelText('Notes')).toHaveValue('Winter session');
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com/panda');
    expect(screen.getByLabelText('Ready from')).toHaveValue('2026-12-02');
    expect(screen.getByLabelText('Book by')).toHaveValue('2026-12-15');
    expect(screen.getByLabelText('Link to')).toHaveValue('activity:a1');
  });

  it('selects the stop when only a stop is linked', () => {
    renderForm(todo('t2', 'Book the train', { stop_id: 's2' }));

    expect(screen.getByLabelText('Link to')).toHaveValue('stop:s2');
  });

  it('shows the whole trip when the links point outside this trip', () => {
    renderForm(todo('t3', 'Strange', { stop_id: 'elsewhere', activity_id: 'nowhere' }));

    expect(screen.getByLabelText('Link to')).toHaveValue('');
  });

  it('updates in place, clearing a field that was emptied', async () => {
    const user = userEvent.setup();
    renderForm(existing);

    await user.clear(screen.getByLabelText('Notes'));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockUpdateTodo).toHaveBeenCalledWith('t1', {
      title: 'Book panda tickets',
      notes: undefined,
      url: 'https://example.com/panda',
      opensOn: '2026-12-02',
      dueOn: '2026-12-15',
      stopId: 's1',
      activityId: 'a1',
    });
    expect(mockCreateTodo).not.toHaveBeenCalled();
  });
});
