import { describe, expect, it } from 'vitest';
import type { Todo, TripData } from '@/types/trip';
import { buildActivityTodoMap, resolveTodoLink, tickCompletesActiveTodos } from '../todoSelectors';

const TODAY = '2026-12-05';

const todo = (todoId: string, over: Partial<Todo> = {}): Todo => ({ todo_id: todoId, title: todoId, done: false, ...over });

describe('buildActivityTodoMap', () => {
  it('picks overdue over ready over upcoming for one activity', () => {
    const map = buildActivityTodoMap(
      [
        todo('upcoming', { activity_id: 'a1', opens_on: '2026-12-09' }),
        todo('ready', { activity_id: 'a1', due_on: '2026-12-20' }),
        todo('overdue', { activity_id: 'a1', due_on: '2026-12-01' }),
      ],
      TODAY
    );

    expect(map.a1.todo.todo_id).toBe('overdue');
  });

  it('prefers a ready todo to an upcoming one', () => {
    const map = buildActivityTodoMap(
      [todo('upcoming', { activity_id: 'a1', opens_on: '2026-12-09' }), todo('ready', { activity_id: 'a1' })],
      TODAY
    );

    expect(map.a1.todo.todo_id).toBe('ready');
  });

  it('falls back to the earliest upcoming todo when nothing is ready', () => {
    const map = buildActivityTodoMap(
      [todo('later', { activity_id: 'a1', opens_on: '2026-12-20' }), todo('sooner', { activity_id: 'a1', opens_on: '2026-12-09' })],
      TODAY
    );

    expect(map.a1.todo.todo_id).toBe('sooner');
  });

  it('breaks a tie between overdue todos by the earliest deadline', () => {
    const map = buildActivityTodoMap(
      [todo('recent', { activity_id: 'a1', due_on: '2026-12-04' }), todo('oldest', { activity_id: 'a1', due_on: '2026-11-20' })],
      TODAY
    );

    expect(map.a1.todo.todo_id).toBe('oldest');
  });

  it('carries the day the state was judged on, so the chip and the list agree', () => {
    const map = buildActivityTodoMap([todo('t', { activity_id: 'a1' })], TODAY);

    expect(map.a1.today).toBe(TODAY);
  });

  it('gives an activity no entry when every linked todo is done', () => {
    const map = buildActivityTodoMap(
      [todo('a', { activity_id: 'a1', done: true }), todo('b', { activity_id: 'a1', done: true, due_on: '2026-12-01' })],
      TODAY
    );

    expect(map.a1).toBeUndefined();
  });

  it('ignores a done todo when another linked todo is still open', () => {
    const map = buildActivityTodoMap(
      [todo('done', { activity_id: 'a1', done: true, due_on: '2026-12-01' }), todo('open', { activity_id: 'a1', opens_on: '2026-12-09' })],
      TODAY
    );

    expect(map.a1.todo.todo_id).toBe('open');
  });

  it('skips todos that link only to a stop or to nothing', () => {
    const map = buildActivityTodoMap([todo('stop', { stop_id: 's1' }), todo('trip')], TODAY);

    expect(map).toEqual({});
  });

  it('copes with a trip that has no todos field', () => {
    expect(buildActivityTodoMap(undefined, TODAY)).toEqual({});
  });
});

const trip: TripData = {
  trip_id: 't1',
  trip_name: 'Sichuan',
  timezone: 'Asia/Shanghai',
  stops: [
    {
      stop_id: 's1',
      name: 'Chengdu',
      date: { from: '2026-12-15', to: '2026-12-18' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'a1', activity_name: 'Panda base', activity_type: 'attraction' }],
    },
    {
      stop_id: 's2',
      name: 'Chongqing',
      date: { from: '2026-12-11', to: '2026-12-14' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [],
    },
  ],
};

describe('resolveTodoLink', () => {
  it('names the activity, with its type emoji, when it resolves inside the trip', () => {
    expect(resolveTodoLink(todo('t', { activity_id: 'a1', stop_id: 's1' }), trip)).toEqual({ emoji: '📸', label: 'Panda base' });
  });

  it('shows the activity even when only the activity link is set', () => {
    expect(resolveTodoLink(todo('t', { activity_id: 'a1' }), trip)?.label).toBe('Panda base');
  });

  it('falls back to the stop when the activity does not resolve', () => {
    expect(resolveTodoLink(todo('t', { activity_id: 'gone', stop_id: 's2' }), trip)).toEqual({ emoji: '📍', label: 'Chongqing' });
  });

  it('names the stop for a stop-only link', () => {
    expect(resolveTodoLink(todo('t', { stop_id: 's2' }), trip)?.label).toBe('Chongqing');
  });

  it('shows nothing for a trip-level todo', () => {
    expect(resolveTodoLink(todo('t'), trip)).toBeNull();
  });

  it('shows nothing for links that point outside this trip', () => {
    expect(resolveTodoLink(todo('t', { activity_id: 'elsewhere', stop_id: 'other-stop' }), trip)).toBeNull();
  });
});

describe('tickCompletesActiveTodos', () => {
  const END = '2026-12-31';

  it('is true when the ticked todo is the only active one', () => {
    const todos = [todo('last'), todo('done', { done: true })];

    expect(tickCompletesActiveTodos(todos, 'last', TODAY, END)).toBe(true);
  });

  it('is false while other todos are still active', () => {
    const todos = [todo('a'), todo('b', { due_on: '2026-12-01' })];

    expect(tickCompletesActiveTodos(todos, 'a', TODAY, END)).toBe(false);
  });

  it('counts the last active tick even when upcoming todos remain', () => {
    const todos = [todo('last'), todo('later', { opens_on: '2026-12-20' })];

    expect(tickCompletesActiveTodos(todos, 'last', TODAY, END)).toBe(true);
  });

  it('is false for a todo that was not active, so ticking an upcoming one stays quiet', () => {
    const todos = [todo('later', { opens_on: '2026-12-20' })];

    expect(tickCompletesActiveTodos(todos, 'later', TODAY, END)).toBe(false);
  });

  it('is false on an ended trip, where nothing is active', () => {
    expect(tickCompletesActiveTodos([todo('last')], 'last', TODAY, '2026-12-01')).toBe(false);
  });

  it('is false for an unknown id', () => {
    expect(tickCompletesActiveTodos([todo('a')], 'nope', TODAY, END)).toBe(false);
  });
});
