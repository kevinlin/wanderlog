import { createTodo, deleteTodo, setTodoDone, type TodoInput, updateTodo } from '@/services/supabaseService';
import type { Todo } from '@/types/trip';
import { useTripCacheMutation } from './useTripCacheMutation';

// Every todo write shares this configuration.
//
// networkMode 'always': a paused mutation is persisted, and after a reload only
// mutations with registered defaults can run again (src/lib/mutationDefaults.ts,
// visits only). A restored todo write would have no function and no rollback.
// So an offline attempt runs, fails, rolls back and offers a retry. You can't
// book a train offline anyway.
//
// scope: ids are client-generated, so a tick or an edit sent while the create
// is still in flight could reach the database first and update nothing. One
// scope per trip runs them in order.
//
// invalidateLibrary: the library card's count reads the todos of every trip.
const todoWriteOptions = (tripId: string) =>
  ({
    tripId,
    invalidateLibrary: true,
    networkMode: 'always',
    scope: { id: `todos:${tripId}` },
  }) as const;

// Domain-shape equivalent of the row written by the service (absent input
// fields intentionally clear the corresponding domain fields). done is not part
// of the form, so an edit leaves it as it was.
const todoInputToDomain = (input: TodoInput): Omit<Todo, 'todo_id' | 'done'> => ({
  title: input.title,
  notes: input.notes,
  url: input.url,
  opens_on: input.opensOn,
  due_on: input.dueOn,
  stop_id: input.stopId,
  activity_id: input.activityId,
});

interface CreateTodoVariables {
  input: TodoInput;
  // The real id, not a placeholder: the optimistic row and the stored row share it.
  todoId: string;
}

export function useCreateTodo(tripId: string) {
  return useTripCacheMutation({
    ...todoWriteOptions(tripId),
    mutationFn: ({ todoId, input }: CreateTodoVariables) => createTodo(tripId, todoId, input),
    patch: (trip, { todoId, input }) => {
      trip.todos = [...(trip.todos ?? []), { todo_id: todoId, done: false, ...todoInputToDomain(input) }];
      return trip;
    },
    errorMessage: 'Could not add the to-do',
  });
}

interface UpdateTodoVariables {
  input: TodoInput;
  todoId: string;
}

export function useUpdateTodo(tripId: string) {
  return useTripCacheMutation({
    ...todoWriteOptions(tripId),
    mutationFn: ({ todoId, input }: UpdateTodoVariables) => updateTodo(todoId, input),
    patch: (trip, { todoId, input }) => {
      trip.todos = (trip.todos ?? []).map((todo) => (todo.todo_id === todoId ? { ...todo, ...todoInputToDomain(input) } : todo));
      return trip;
    },
    errorMessage: 'Could not save the to-do',
  });
}

interface SetTodoDoneVariables {
  done: boolean;
  todoId: string;
}

export function useSetTodoDone(tripId: string) {
  return useTripCacheMutation({
    ...todoWriteOptions(tripId),
    mutationFn: ({ todoId, done }: SetTodoDoneVariables) => setTodoDone(todoId, done),
    patch: (trip, { todoId, done }) => {
      trip.todos = (trip.todos ?? []).map((todo) => (todo.todo_id === todoId ? { ...todo, done } : todo));
      return trip;
    },
    errorMessage: 'Could not update the to-do',
  });
}

export function useDeleteTodo(tripId: string) {
  return useTripCacheMutation({
    ...todoWriteOptions(tripId),
    mutationFn: ({ todoId }: { todoId: string }) => deleteTodo(todoId),
    patch: (trip, { todoId }) => {
      trip.todos = (trip.todos ?? []).filter((todo) => todo.todo_id !== todoId);
      return trip;
    },
    errorMessage: 'Could not delete the to-do',
  });
}
