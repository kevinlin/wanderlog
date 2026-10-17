import { ArrowTopRightOnSquareIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ReactElement } from 'react';
import { DoneCheckbox } from '@/components/Cards/DoneCheckbox';
import type { Todo } from '@/types/trip';
import { TodoChip } from './TodoChip';
import type { TodoLink } from './todoSelectors';

interface TodoRowProps {
  // Offline: the row stays readable, every write control is off.
  disabled: boolean;
  link: TodoLink | null;
  onDelete: (todo: Todo) => void;
  onEdit: (todo: Todo) => void;
  onToggle: (todo: Todo, done: boolean) => void;
  today: string;
  todo: Todo;
}

// Hermes writes free text into this column, and an href of "javascript:" is
// script injection. The database refuses anything but http(s) for new rows; this
// keeps a bad value that is already stored (or cached) from ever becoming a link.
const HTTP_URL = /^https?:\/\//i;

const ICON_BUTTON =
  'flex h-11 w-11 items-center justify-center rounded-md text-gray-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50';

export function TodoRow({ todo, today, link, disabled, onToggle, onEdit, onDelete }: TodoRowProps): ReactElement {
  const url = todo.url?.trim();
  const isLink = Boolean(url && HTTP_URL.test(url));

  return (
    <li className={`rounded-lg p-3 shadow-md ${todo.done ? 'bg-emerald-500/10' : 'bg-white'}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <DoneCheckbox
            accent="emerald"
            ariaLabel={`Mark "${todo.title}" done`}
            checked={todo.done}
            disabled={disabled}
            onToggle={(done) => onToggle(todo, done)}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className={`break-words font-semibold text-base ${todo.done ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
            {todo.title}
          </p>
          {link && (
            <p className={`mt-0.5 text-sm ${todo.done ? 'text-gray-500' : 'text-gray-700'}`}>
              <span aria-hidden="true">{link.emoji}</span> {link.label}
            </p>
          )}
          {!todo.done && (
            <div className="mt-1.5">
              <TodoChip today={today} todo={todo} />
            </div>
          )}
          {todo.notes && (
            <p className={`mt-1.5 whitespace-pre-line text-sm ${todo.done ? 'text-gray-500' : 'text-gray-600'}`}>{todo.notes}</p>
          )}
          {isLink && (
            <a
              aria-label={`Open link for "${todo.title}"`}
              className="mt-0.5 -mb-2 inline-flex min-h-11 items-center gap-1 font-medium text-sky-700 text-sm underline-offset-2 hover:underline"
              href={url}
              rel="noopener noreferrer"
              target="_blank"
            >
              Open link
              <ArrowTopRightOnSquareIcon aria-hidden="true" className="h-4 w-4" />
            </a>
          )}
        </div>

        <div className="-mt-1 -mr-1 flex shrink-0">
          <button
            aria-label={`Edit "${todo.title}"`}
            className={`${ICON_BUTTON} hover:bg-sky-500/10 hover:text-sky-600`}
            disabled={disabled}
            onClick={() => onEdit(todo)}
            type="button"
          >
            <PencilIcon aria-hidden="true" className="h-4 w-4" />
          </button>
          <button
            aria-label={`Delete "${todo.title}"`}
            className={`${ICON_BUTTON} hover:bg-red-500/10 hover:text-red-600`}
            disabled={disabled}
            onClick={() => onDelete(todo)}
            type="button"
          >
            <TrashIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}
