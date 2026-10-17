import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Todo, TodoWindow } from '@/types/trip';
import { countActiveTodos, groupTodos, isActiveTodo, type TodoState, todoState, tripToday } from '../todoUtils';

const TODAY = '2026-12-05';
const TRIP_END = '2026-12-20';

interface StateFixture {
  active: boolean;
  done: boolean;
  due_on?: string;
  name: string;
  opens_on?: string;
  state: TodoState;
}

// One table drives todoState and isActiveTodo, so the two cannot drift apart.
// "active" is the count rule on a trip that has not ended.
const STATE_FIXTURES: StateFixture[] = [
  { name: 'done, no dates', done: true, state: 'done', active: false },
  { name: 'done, past its deadline', done: true, due_on: '2026-12-01', state: 'done', active: false },
  { name: 'done, not yet open', done: true, opens_on: '2026-12-09', state: 'done', active: false },
  { name: 'upcoming, opens tomorrow', done: false, opens_on: '2026-12-06', state: 'upcoming', active: false },
  { name: 'upcoming, with a deadline', done: false, opens_on: '2026-12-08', due_on: '2026-12-15', state: 'upcoming', active: false },
  { name: 'ready, no dates', done: false, state: 'ready', active: true },
  { name: 'ready, opened earlier and no deadline', done: false, opens_on: '2026-12-01', state: 'ready', active: true },
  { name: 'ready, deadline ahead', done: false, due_on: '2026-12-15', state: 'ready', active: true },
  {
    name: 'ready, opened earlier with a deadline ahead',
    done: false,
    opens_on: '2026-12-01',
    due_on: '2026-12-15',
    state: 'ready',
    active: true,
  },
  { name: 'ready, opens today (boundary)', done: false, opens_on: TODAY, state: 'ready', active: true },
  { name: 'ready, due today and not overdue (boundary)', done: false, due_on: TODAY, state: 'ready', active: true },
  { name: 'ready, opens and is due today', done: false, opens_on: TODAY, due_on: TODAY, state: 'ready', active: true },
  { name: 'overdue, due yesterday', done: false, due_on: '2026-12-04', state: 'overdue', active: true },
  {
    name: 'overdue, opened and past its deadline',
    done: false,
    opens_on: '2026-11-20',
    due_on: '2026-12-01',
    state: 'overdue',
    active: true,
  },
];

describe('todoState', () => {
  it.each(STATE_FIXTURES)('$name is $state', ({ done, opens_on, due_on, state }) => {
    expect(todoState({ done, opens_on, due_on }, TODAY)).toBe(state);
  });
});

describe('isActiveTodo', () => {
  it.each(STATE_FIXTURES)('$name: active is $active on a trip that has not ended', ({ done, opens_on, active }) => {
    expect(isActiveTodo({ done, opens_on }, TODAY, TRIP_END)).toBe(active);
  });

  it('agrees with todoState: exactly the ready and overdue todos are active', () => {
    for (const { done, opens_on, due_on, state } of STATE_FIXTURES) {
      expect(isActiveTodo({ done, opens_on }, TODAY, TRIP_END)).toBe(state === 'ready' || state === 'overdue');
      expect(todoState({ done, opens_on, due_on }, TODAY)).toBe(state);
    }
  });

  describe('trip end', () => {
    const ready: TodoWindow = { done: false };

    it('still counts on the trip end date (boundary)', () => {
      expect(isActiveTodo(ready, TODAY, TODAY)).toBe(true);
    });

    it('counts the day before the trip ends', () => {
      expect(isActiveTodo(ready, TODAY, '2026-12-06')).toBe(true);
    });

    it('stops counting the day after the trip ends', () => {
      expect(isActiveTodo(ready, TODAY, '2026-12-04')).toBe(false);
    });

    it('stops counting an overdue todo once the trip has ended', () => {
      expect(isActiveTodo({ done: false }, '2026-12-25', '2026-12-20')).toBe(false);
    });

    it('treats a missing end_date (an old cached TripData) as not ended', () => {
      expect(isActiveTodo(ready, TODAY, undefined)).toBe(true);
    });

    it('does not let a missing end_date revive a done or upcoming todo', () => {
      expect(isActiveTodo({ done: true }, TODAY, undefined)).toBe(false);
      expect(isActiveTodo({ done: false, opens_on: '2026-12-06' }, TODAY, undefined)).toBe(false);
    });
  });
});

describe('countActiveTodos', () => {
  const todos: TodoWindow[] = STATE_FIXTURES.map(({ done, opens_on }) => ({ done, opens_on }));
  const expected = STATE_FIXTURES.filter((fixture) => fixture.active).length;

  it('counts every fixture the table marks active', () => {
    expect(expected).toBeGreaterThan(0);
    expect(countActiveTodos(todos, TODAY, TRIP_END)).toBe(expected);
  });

  it('is zero for an empty or absent list (a trip loaded before todos existed)', () => {
    expect(countActiveTodos([], TODAY, TRIP_END)).toBe(0);
    expect(countActiveTodos(undefined, TODAY, TRIP_END)).toBe(0);
  });

  it('is zero once the trip has ended, however many ready todos are left', () => {
    expect(countActiveTodos(todos, '2026-12-21', TRIP_END)).toBe(0);
  });

  it('still counts on the trip end date', () => {
    expect(countActiveTodos(todos, TRIP_END, TRIP_END)).toBeGreaterThan(0);
  });

  it('counts a todo the moment its opening date arrives', () => {
    const opening = [{ done: false, opens_on: '2026-12-06' }];
    expect(countActiveTodos(opening, TODAY, TRIP_END)).toBe(0);
    expect(countActiveTodos(opening, '2026-12-06', TRIP_END)).toBe(1);
  });

  it('counts a todo-window shaped like the library summary (no deadline field)', () => {
    expect(countActiveTodos([{ done: false }, { done: true }], TODAY, TRIP_END)).toBe(1);
  });
});

describe('tripToday', () => {
  it('is already the next day in Asia/Shanghai at 16:30 UTC (trip-local midnight)', () => {
    expect(tripToday('Asia/Shanghai', new Date('2026-12-01T16:30:00Z'))).toBe('2026-12-02');
    expect(tripToday('UTC', new Date('2026-12-01T16:30:00Z'))).toBe('2026-12-01');
  });

  it('flips exactly at trip-local midnight', () => {
    expect(tripToday('Asia/Shanghai', new Date('2026-12-01T15:59:59Z'))).toBe('2026-12-01');
    expect(tripToday('Asia/Shanghai', new Date('2026-12-01T16:00:00Z'))).toBe('2026-12-02');
  });

  it('can be a day behind UTC for a western zone', () => {
    expect(tripToday('America/Los_Angeles', new Date('2026-12-01T05:00:00Z'))).toBe('2026-11-30');
  });

  it('is a plain YYYY-MM-DD string that compares lexicographically against stored dates', () => {
    expect(tripToday('Asia/Shanghai', new Date('2026-01-09T20:00:00Z'))).toBe('2026-01-10');
  });

  describe('with the default clock', () => {
    afterEach(() => vi.useRealTimers());

    it('reads the current time when no instant is passed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-01T16:30:00Z'));
      expect(tripToday('Asia/Shanghai')).toBe('2026-12-02');
    });
  });
});

describe('groupTodos', () => {
  const todo = (todo_id: string, title: string, fields: Partial<Todo> = {}): Todo => ({ todo_id, title, done: false, ...fields });

  const todos: Todo[] = [
    todo('ready-none-z', 'Z no deadline'),
    todo('ready-b', 'B due the tenth', { due_on: '2026-12-10' }),
    todo('overdue-recent', 'Overdue by a day', { due_on: '2026-12-04' }),
    todo('ready-a', 'A due the tenth', { due_on: '2026-12-10' }),
    todo('ready-none-c', 'C no deadline, opened', { opens_on: '2026-12-01' }),
    todo('overdue-old', 'Overdue by a week', { due_on: '2026-11-28' }),
    todo('ready-today', 'Due today', { due_on: TODAY }),
    todo('up-late', 'Opens the twelfth', { opens_on: '2026-12-12', due_on: '2026-12-18' }),
    todo('up-soon', 'Opens tomorrow', { opens_on: '2026-12-06' }),
    todo('up-mid', 'Opens the ninth', { opens_on: '2026-12-09' }),
    todo('done-late', 'Done, due the ninth', { done: true, due_on: '2026-12-09' }),
    todo('done-none', 'Done, no deadline', { done: true }),
    todo('done-early', 'Done, due the second', { done: true, due_on: '2026-12-02' }),
  ];

  const ids = (list: Todo[]) => list.map((item) => item.todo_id);

  it('puts ready now first: overdue (oldest first), then deadline ascending, no deadline last, ties by title', () => {
    expect(ids(groupTodos(todos, TODAY).ready)).toEqual([
      'overdue-old',
      'overdue-recent',
      'ready-today',
      'ready-a',
      'ready-b',
      'ready-none-c',
      'ready-none-z',
    ]);
  });

  it('orders coming up by the day it opens', () => {
    expect(ids(groupTodos(todos, TODAY).upcoming)).toEqual(['up-soon', 'up-mid', 'up-late']);
  });

  it('orders done by deadline ascending, no deadline last', () => {
    expect(ids(groupTodos(todos, TODAY).done)).toEqual(['done-early', 'done-late', 'done-none']);
  });

  it('places every todo in exactly one group', () => {
    const groups = groupTodos(todos, TODAY);
    expect(groups.ready.length + groups.upcoming.length + groups.done.length).toBe(todos.length);
  });

  it('moves a todo between groups as the date advances', () => {
    expect(ids(groupTodos(todos, '2026-12-06').ready)).toContain('up-soon');
    expect(ids(groupTodos(todos, '2026-12-06').upcoming)).not.toContain('up-soon');
  });

  it('returns empty groups for an empty list', () => {
    expect(groupTodos([], TODAY)).toEqual({ ready: [], upcoming: [], done: [] });
  });

  it('does not reorder or mutate the list it was given', () => {
    const before = ids(todos);
    groupTodos(todos, TODAY);
    expect(ids(todos)).toEqual(before);
  });
});
