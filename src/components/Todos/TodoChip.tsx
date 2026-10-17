import { format, parseISO } from 'date-fns';
import type { ReactElement } from 'react';
import type { Todo } from '@/types/trip';
import { type TodoState, todoState } from '@/utils/todoUtils';

interface TodoChipProps {
  // A marker in front of the text, for places that need to say what the chip is about.
  lead?: string;
  today: string;
  todo: Pick<Todo, 'done' | 'due_on' | 'opens_on'>;
}

const day = (value: string): string => format(parseISO(value), 'd MMM');

// Each state reads as words first; the tint only backs them up. "Overdue" in
// particular is a word, never just red.
const LABEL: Record<Exclude<TodoState, 'done'>, (todo: Pick<Todo, 'due_on' | 'opens_on'>) => string> = {
  ready: (todo) => (todo.due_on ? `Ready · by ${day(todo.due_on)}` : 'Ready now'),
  overdue: (todo) => `Overdue · was due ${day(todo.due_on ?? '')}`,
  upcoming: (todo) => `Opens ${day(todo.opens_on ?? '')}`,
};

const TINT: Record<Exclude<TodoState, 'done'>, string> = {
  ready: 'bg-amber-100 text-amber-900 ring-amber-300',
  overdue: 'bg-red-50 text-red-800 ring-red-300',
  upcoming: 'bg-gray-100 text-gray-700 ring-gray-300',
};

export function TodoChip({ todo, today, lead }: TodoChipProps): ReactElement | null {
  const state = todoState(todo, today);
  if (state === 'done') {
    return null;
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ring-1 ring-inset ${TINT[state]}`}>
      {lead && <span aria-hidden="true">{lead}</span>}
      {LABEL[state](todo)}
    </span>
  );
}
