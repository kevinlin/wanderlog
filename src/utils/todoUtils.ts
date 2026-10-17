import { formatTripLocal } from '@/services/visitRecord';
import type { Todo, TodoWindow } from '@/types/trip';

export type TodoState = 'done' | 'upcoming' | 'ready' | 'overdue';

// "Today" in the trip's timezone, via visitRecord's pinned formatter, as a
// YYYY-MM-DD string that compares lexicographically against the stored dates.
export const tripToday = (timeZone: string, now: Date = new Date()): string => formatTripLocal(now, timeZone).slice(0, 10);

export const todoState = (todo: Pick<Todo, 'done' | 'opens_on' | 'due_on'>, today: string): TodoState => {
  if (todo.done) {
    return 'done';
  }
  if (todo.opens_on && todo.opens_on > today) {
    return 'upcoming';
  }
  if (todo.due_on && todo.due_on < today) {
    return 'overdue';
  }
  return 'ready';
};

// Same rule as the active_todos view. Change both together.
// A missing end_date (an old cached TripData) counts as "not ended".
export const isActiveTodo = (todo: TodoWindow, today: string, tripEndDate: string | undefined): boolean => {
  if (todo.done) {
    return false;
  }
  if (todo.opens_on && todo.opens_on > today) {
    return false;
  }
  return !tripEndDate || tripEndDate >= today;
};

export const countActiveTodos = (todos: TodoWindow[] | undefined, today: string, tripEndDate: string | undefined): number =>
  (todos ?? []).filter((todo) => isActiveTodo(todo, today, tripEndDate)).length;

export interface TodoGroups {
  done: Todo[];
  ready: Todo[];
  upcoming: Todo[];
}

// A missing date sorts after every dated one. Plain string comparison, which is
// safe for YYYY-MM-DD and, unlike localeCompare, never depends on the collation.
const compareDay = (a: string | undefined, b: string | undefined): number => {
  if (a === b) {
    return 0;
  }
  if (!a) {
    return 1;
  }
  if (!b) {
    return -1;
  }
  return a < b ? -1 : 1;
};

const byDueOn = (a: Todo, b: Todo): number => compareDay(a.due_on, b.due_on);

// Overdue todos need no rank of their own: their due_on is before today, so
// ordering by deadline already puts them ahead of every other ready todo.
const byReadyOrder = (a: Todo, b: Todo): number => byDueOn(a, b) || a.title.localeCompare(b.title);

// Every upcoming todo has an opens_on, since that is what makes it upcoming.
const byOpensOn = (a: Todo, b: Todo): number => compareDay(a.opens_on, b.opens_on);

// Ordering lives here, not in the components, so they only render.
export const groupTodos = (todos: Todo[], today: string): TodoGroups => {
  const groups: TodoGroups = { ready: [], upcoming: [], done: [] };
  for (const todo of todos) {
    const state = todoState(todo, today);
    if (state === 'done') {
      groups.done.push(todo);
    } else if (state === 'upcoming') {
      groups.upcoming.push(todo);
    } else {
      groups.ready.push(todo);
    }
  }
  groups.ready.sort(byReadyOrder);
  groups.upcoming.sort(byOpensOn);
  groups.done.sort(byDueOn);
  return groups;
};
