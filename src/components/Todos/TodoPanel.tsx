import { ChevronDownIcon, ChevronUpIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { type ReactElement, useEffect, useId, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/Layout/ConfirmDialog';
import { useToast } from '@/components/Layout/Toast';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useDeleteTodo, useSetTodoDone } from '@/hooks/useTodoMutations';
import type { Todo, TripData } from '@/types/trip';
import { groupTodos } from '@/utils/todoUtils';
import { TodoFormModal } from './TodoFormModal';
import { TodoRow } from './TodoRow';
import { resolveTodoLink, tickCompletesActiveTodos } from './todoSelectors';

interface TodoPanelProps {
  onClose: () => void;
  // From useTripToday, so the panel and the badge always judge the same day.
  today: string;
  tripData: TripData;
  tripId: string;
}

type FormState = { mode: 'create' } | { mode: 'edit'; todo: Todo };

const CELEBRATION = 'All booked. Now the fun part. 🎉';

const ADD_BUTTON =
  'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-alpine-teal/40 bg-alpine-teal/10 px-3 font-medium text-alpine-teal text-sm transition-colors hover:bg-alpine-teal/20 disabled:cursor-not-allowed disabled:opacity-50';

export function TodoPanel({ onClose, today, tripData, tripId }: TodoPanelProps): ReactElement {
  const isOnline = useOnlineStatus();
  const { showToast } = useToast();
  const setDone = useSetTodoDone(tripId);
  const deleteMutation = useDeleteTodo(tripId);

  const [form, setForm] = useState<FormState | null>(null);
  const [deleting, setDeleting] = useState<Todo | null>(null);
  const [isDoneOpen, setIsDoneOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const readyId = useId();
  const upcomingId = useId();
  const doneId = useId();

  const todos = tripData.todos ?? [];
  const groups = groupTodos(todos, today);

  // Focus moves in on open. The panel is the target rather than its first
  // control: that way a screen reader starts at the title.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  // Escape belongs to whatever is on top. The form and the confirm dialog sit
  // over the panel and have no Escape handling of their own, so while either is
  // open this listener must stay out of the way.
  const isCovered = form !== null || deleting !== null;
  useEffect(() => {
    if (isCovered) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCovered, onClose]);

  // Whatever opened the form or the dialog is gone once it closes, so put focus
  // back in the panel rather than leaving it on the page behind.
  const returnToPanel = () => panelRef.current?.focus();

  const closeForm = () => {
    setForm(null);
    returnToPanel();
  };

  const handleToggle = (todo: Todo, done: boolean) => {
    // Judged on the list as it stands, before the optimistic write lands. Only
    // ticking can celebrate, and only the tick that empties the active list.
    if (done && tickCompletesActiveTodos(todos, todo.todo_id, today, tripData.end_date)) {
      showToast({ message: CELEBRATION, type: 'success' });
    }
    setDone.mutate({ todoId: todo.todo_id, done });
  };

  const handleConfirmDelete = () => {
    if (deleting) {
      deleteMutation.mutate({ todoId: deleting.todo_id });
    }
    setDeleting(null);
    returnToPanel();
  };

  const renderRows = (list: Todo[]) => (
    <ul className="space-y-3">
      {list.map((todo) => (
        <TodoRow
          disabled={!isOnline}
          key={todo.todo_id}
          link={resolveTodoLink(todo, tripData)}
          onDelete={setDeleting}
          onEdit={(target) => setForm({ mode: 'edit', todo: target })}
          onToggle={handleToggle}
          today={today}
          todo={todo}
        />
      ))}
    </ul>
  );

  return (
    <>
      {/* Phone only: a tap outside the sheet closes it. On desktop the panel is
          anchored under the buttons and the map stays usable behind it. */}
      <div aria-hidden="true" className="fixed inset-0 z-20 bg-black/30 sm:hidden" data-testid="todo-backdrop" onClick={onClose} />

      <div
        aria-labelledby={titleId}
        className="fixed right-0 bottom-0 left-0 z-20 flex max-h-[75vh] flex-col rounded-t-xl border-white/30 border-t bg-white/90 shadow-lg outline-hidden backdrop-blur-md max-sm:motion-safe:starting:translate-y-full max-sm:motion-safe:transition-transform max-sm:motion-safe:duration-300 max-sm:motion-safe:ease-out sm:top-16 sm:right-2 sm:bottom-auto sm:left-auto sm:max-h-[calc(100vh-5rem)] sm:w-96 sm:rounded-xl sm:border"
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="flex shrink-0 items-center gap-2 px-4 pt-2 pb-2">
          <h2 className="flex-1 font-bold text-gray-900 text-xl" id={titleId}>
            To do
          </h2>
          <button className={ADD_BUTTON} disabled={!isOnline} onClick={() => setForm({ mode: 'create' })} type="button">
            <PlusIcon aria-hidden="true" className="h-4 w-4" />
            Add
          </button>
          <button
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {!isOnline && (
          <p className="shrink-0 px-4 pb-2 text-gray-700 text-xs">
            Offline: the list is here to read. Ticking and editing wait for a connection.
          </p>
        )}

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {todos.length === 0 ? (
            <div className="rounded-lg bg-white px-4 py-8 text-center shadow-md">
              <p aria-hidden="true" className="text-3xl">
                🎟️
              </p>
              <p className="mt-2 font-semibold text-base text-gray-900">Nothing to book yet.</p>
              <p className="mx-auto mt-1 max-w-xs text-gray-600 text-sm">
                Add the tickets, tables and trains you'll need to lock in, and Wanderlog keeps count of what's ready.
              </p>
              <button
                className={`${ADD_BUTTON} mx-auto mt-4`}
                disabled={!isOnline}
                onClick={() => setForm({ mode: 'create' })}
                type="button"
              >
                <PlusIcon aria-hidden="true" className="h-4 w-4" />
                Add the first one
              </button>
            </div>
          ) : (
            <>
              <section aria-labelledby={readyId}>
                <h3 className="mb-2 font-semibold text-gray-900 text-sm" id={readyId}>
                  Ready now ({groups.ready.length})
                </h3>
                {groups.ready.length > 0 ? (
                  renderRows(groups.ready)
                ) : (
                  <p className="rounded-lg bg-white px-3 py-3 text-gray-700 text-sm shadow-md">Nothing to book right now.</p>
                )}
              </section>

              {groups.upcoming.length > 0 && (
                <section aria-labelledby={upcomingId}>
                  <h3 className="mb-2 font-semibold text-gray-900 text-sm" id={upcomingId}>
                    Coming up ({groups.upcoming.length})
                  </h3>
                  {renderRows(groups.upcoming)}
                </section>
              )}

              {groups.done.length > 0 && (
                <section aria-labelledby={doneId}>
                  <h3 id={doneId}>
                    <button
                      aria-expanded={isDoneOpen}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 font-medium text-emerald-800 text-sm transition-colors hover:bg-emerald-500/30"
                      onClick={() => setIsDoneOpen((open) => !open)}
                      type="button"
                    >
                      Done ({groups.done.length})
                      {isDoneOpen ? (
                        <ChevronUpIcon aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>
                  </h3>
                  {isDoneOpen && <div className="mt-3">{renderRows(groups.done)}</div>}
                </section>
              )}
            </>
          )}
        </div>
      </div>

      {/* Siblings of the panel, not children: its backdrop blur would otherwise
          become the containing block for these fixed overlays. */}
      {form && (
        <TodoFormModal
          isOpen
          key={form.mode === 'edit' ? form.todo.todo_id : 'new'}
          onClose={closeForm}
          todo={form.mode === 'edit' ? form.todo : undefined}
          tripData={tripData}
          tripId={tripId}
        />
      )}

      {deleting && (
        <ConfirmDialog
          confirmLabel="Delete"
          message={`Delete "${deleting.title}"? This cannot be undone.`}
          onCancel={() => {
            setDeleting(null);
            returnToPanel();
          }}
          onConfirm={handleConfirmDelete}
          title="Delete to-do"
        />
      )}
    </>
  );
}
