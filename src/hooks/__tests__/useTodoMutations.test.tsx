import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
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

import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import { useCreateTodo, useDeleteTodo, useSetTodoDone, useUpdateTodo } from '../useTodoMutations';

const seedTrip: TripData = {
  trip_id: 't1',
  trip_name: 'Trip',
  timezone: 'Asia/Shanghai',
  stops: [],
  todos: [
    {
      todo_id: 'todo-1',
      title: 'Book the train',
      done: false,
      opens_on: '2026-12-01',
      due_on: '2026-12-10',
      stop_id: 's1',
      notes: 'Early',
    },
    { todo_id: 'todo-2', title: 'Check the drone show', done: false },
  ],
};

function setup(trip: TripData = seedTrip) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  client.setQueryData(tripKeys.all, []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      create: useCreateTodo('t1'),
      update: useUpdateTodo('t1'),
      done: useSetTodoDone('t1'),
      remove: useDeleteTodo('t1'),
    }),
    { wrapper }
  );
  return { client, result, wrapper };
}

const todosOf = (client: QueryClient) => client.getQueryData<TripData>(tripKeys.detail('t1'))?.todos;
const idsOf = (client: QueryClient) => todosOf(client)?.map((todo) => todo.todo_id);
const isInvalidated = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
const pausedMutations = (client: QueryClient) =>
  client
    .getMutationCache()
    .getAll()
    .filter((mutation) => mutation.state.isPaused);
const never = () => new Promise<void>(() => undefined);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('useCreateTodo', () => {
  it('optimistically appends the todo under the id it was given', async () => {
    mockCreateTodo.mockReturnValue(never());
    const { client, result } = setup();

    result.current.create.mutate({
      todoId: 'todo-new',
      input: { title: 'Buy the cruise tickets', dueOn: '2026-12-13', opensOn: '2026-12-10', stopId: 's1', activityId: 'act-1' },
    });

    await waitFor(() => expect(idsOf(client)).toEqual(['todo-1', 'todo-2', 'todo-new']));
    expect(todosOf(client)?.at(-1)).toEqual({
      todo_id: 'todo-new',
      title: 'Buy the cruise tickets',
      done: false,
      opens_on: '2026-12-10',
      due_on: '2026-12-13',
      stop_id: 's1',
      activity_id: 'act-1',
    });
    expect(mockCreateTodo).toHaveBeenCalledWith(
      't1',
      'todo-new',
      expect.objectContaining({ title: 'Buy the cruise tickets', dueOn: '2026-12-13' })
    );
  });

  it('creates the list when the cached trip has none (a cache from before todos)', async () => {
    mockCreateTodo.mockReturnValue(never());
    const { todos: _todos, ...withoutTodos } = seedTrip;
    const { client, result } = setup(withoutTodos);

    result.current.create.mutate({ todoId: 'todo-new', input: { title: 'First' } });

    await waitFor(() => expect(idsOf(client)).toEqual(['todo-new']));
  });

  it('rolls back the append and offers a retry when the write fails', async () => {
    mockCreateTodo.mockRejectedValue(new Error('denied'));
    const { client, result } = setup();

    result.current.create.mutate({ todoId: 'todo-new', input: { title: 'Buy the cruise tickets' } });

    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(idsOf(client)).toEqual(['todo-1', 'todo-2']);
    expect(await screen.findByText('Could not add the to-do')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockCreateTodo).toHaveBeenCalledTimes(2));
    expect(mockCreateTodo).toHaveBeenLastCalledWith('t1', 'todo-new', expect.objectContaining({ title: 'Buy the cruise tickets' }));
  });
});

describe('useUpdateTodo', () => {
  it('optimistically rewrites the todo from the form, clearing the fields the form left out', async () => {
    mockUpdateTodo.mockReturnValue(never());
    const { client, result } = setup();

    result.current.update.mutate({ todoId: 'todo-1', input: { title: 'Renamed', notes: 'Window seat', dueOn: '2026-12-09' } });

    await waitFor(() => expect(todosOf(client)?.[0].title).toBe('Renamed'));
    expect(todosOf(client)?.[0]).toEqual({
      todo_id: 'todo-1',
      title: 'Renamed',
      done: false,
      notes: 'Window seat',
      due_on: '2026-12-09',
    });
    expect(todosOf(client)?.[1].title).toBe('Check the drone show');
    expect(mockUpdateTodo).toHaveBeenCalledWith('todo-1', expect.objectContaining({ title: 'Renamed', dueOn: '2026-12-09' }));
  });

  it('keeps a done todo done, since the form does not carry it', async () => {
    mockUpdateTodo.mockReturnValue(never());
    const { client, result } = setup({ ...seedTrip, todos: [{ todo_id: 'todo-1', title: 'Booked', done: true }] });

    result.current.update.mutate({ todoId: 'todo-1', input: { title: 'Booked, with a seat' } });

    await waitFor(() => expect(todosOf(client)?.[0].title).toBe('Booked, with a seat'));
    expect(todosOf(client)?.[0].done).toBe(true);
  });

  it('rolls back the edit and offers a retry when the write fails', async () => {
    mockUpdateTodo.mockRejectedValue(new Error('todos_window'));
    const { client, result } = setup();

    result.current.update.mutate({ todoId: 'todo-1', input: { title: 'Renamed' } });

    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(todosOf(client)?.[0]).toEqual(seedTrip.todos?.[0]);
    expect(await screen.findByText('Could not save the to-do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('useSetTodoDone', () => {
  it('optimistically ticks the todo and changes nothing else', async () => {
    mockSetTodoDone.mockReturnValue(never());
    const { client, result } = setup();

    result.current.done.mutate({ todoId: 'todo-1', done: true });

    await waitFor(() => expect(todosOf(client)?.[0].done).toBe(true));
    expect(todosOf(client)?.[0]).toEqual({ ...seedTrip.todos?.[0], done: true });
    expect(todosOf(client)?.[1].done).toBe(false);
    expect(mockSetTodoDone).toHaveBeenCalledWith('todo-1', true);
  });

  it('optimistically unticks a done todo', async () => {
    mockSetTodoDone.mockReturnValue(never());
    const { client, result } = setup({ ...seedTrip, todos: [{ todo_id: 'todo-1', title: 'Booked', done: true }] });

    result.current.done.mutate({ todoId: 'todo-1', done: false });

    await waitFor(() => expect(todosOf(client)?.[0].done).toBe(false));
    expect(mockSetTodoDone).toHaveBeenCalledWith('todo-1', false);
  });

  it('rolls back the tick and offers a retry when the write fails', async () => {
    mockSetTodoDone.mockRejectedValue(new Error('denied'));
    const { client, result } = setup();

    result.current.done.mutate({ todoId: 'todo-1', done: true });

    await waitFor(() => expect(result.current.done.isError).toBe(true));
    expect(todosOf(client)?.[0].done).toBe(false);
    expect(await screen.findByText('Could not update the to-do')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalledTimes(2));
    expect(mockSetTodoDone).toHaveBeenLastCalledWith('todo-1', true);
  });
});

describe('useDeleteTodo', () => {
  it('optimistically removes the todo', async () => {
    mockDeleteTodo.mockReturnValue(never());
    const { client, result } = setup();

    result.current.remove.mutate({ todoId: 'todo-1' });

    await waitFor(() => expect(idsOf(client)).toEqual(['todo-2']));
    expect(mockDeleteTodo).toHaveBeenCalledWith('todo-1');
  });

  it('restores the todo in its place and offers a retry when the delete fails', async () => {
    mockDeleteTodo.mockRejectedValue(new Error('denied'));
    const { client, result } = setup();

    result.current.remove.mutate({ todoId: 'todo-1' });

    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(idsOf(client)).toEqual(['todo-1', 'todo-2']);
    expect(await screen.findByText('Could not delete the to-do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

type Hooks = ReturnType<typeof setup>['result']['current'];

const WRITES: Array<{ name: string; mock: typeof mockCreateTodo; run: (hooks: Hooks) => void; failed: (hooks: Hooks) => boolean }> = [
  {
    name: 'create',
    mock: mockCreateTodo,
    run: (hooks) => hooks.create.mutate({ todoId: 'todo-new', input: { title: 'New' } }),
    failed: (hooks) => hooks.create.isError,
  },
  {
    name: 'update',
    mock: mockUpdateTodo,
    run: (hooks) => hooks.update.mutate({ todoId: 'todo-1', input: { title: 'Renamed' } }),
    failed: (hooks) => hooks.update.isError,
  },
  {
    name: 'done',
    mock: mockSetTodoDone,
    run: (hooks) => hooks.done.mutate({ todoId: 'todo-1', done: true }),
    failed: (hooks) => hooks.done.isError,
  },
  {
    name: 'delete',
    mock: mockDeleteTodo,
    run: (hooks) => hooks.remove.mutate({ todoId: 'todo-1' }),
    failed: (hooks) => hooks.remove.isError,
  },
];

describe('invalidation on settle', () => {
  it.each(WRITES)('$name invalidates both the trip detail and the library list', async ({ mock, run }) => {
    mock.mockResolvedValue(undefined);
    const { client, result } = setup();
    expect(isInvalidated(client, tripKeys.detail('t1'))).toBe(false);
    expect(isInvalidated(client, tripKeys.all)).toBe(false);

    run(result.current);

    await waitFor(() => expect(isInvalidated(client, tripKeys.all)).toBe(true));
    expect(isInvalidated(client, tripKeys.detail('t1'))).toBe(true);
  });

  it.each(WRITES)('$name invalidates both after a failed write too', async ({ mock, run, failed }) => {
    mock.mockRejectedValue(new Error('denied'));
    const { client, result } = setup();

    run(result.current);

    await waitFor(() => expect(failed(result.current)).toBe(true));
    expect(isInvalidated(client, tripKeys.detail('t1'))).toBe(true);
    expect(isInvalidated(client, tripKeys.all)).toBe(true);
  });
});

// A paused mutation is persisted, and after a reload only mutations with
// registered defaults can run again, so a restored todo write would have no
// function and no rollback. These writes fail fast instead.
describe('offline', () => {
  it.each(WRITES)('$name still calls its function, rolls back, and leaves nothing paused', async ({ mock, run, failed }) => {
    onlineManager.setOnline(false);
    mock.mockRejectedValue(new Error('Failed to fetch'));
    const { client, result } = setup();

    run(result.current);

    await waitFor(() => expect(failed(result.current)).toBe(true));
    expect(mock).toHaveBeenCalledTimes(1);
    expect(todosOf(client)).toEqual(seedTrip.todos);
    expect(pausedMutations(client)).toHaveLength(0);
    expect(
      client
        .getMutationCache()
        .getAll()
        .every((mutation) => mutation.state.status === 'error')
    ).toBe(true);
  });

  it('shows the retry toast for an offline failure', async () => {
    onlineManager.setOnline(false);
    mockSetTodoDone.mockRejectedValue(new Error('Failed to fetch'));
    const { result } = setup();

    result.current.done.mutate({ todoId: 'todo-1', done: true });

    expect(await screen.findByText('Could not update the to-do')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

describe('write order', () => {
  it('runs two writes in one trip scope in the order they were made', async () => {
    let releaseCreate: () => void = () => undefined;
    mockCreateTodo.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseCreate = resolve;
        })
    );
    mockSetTodoDone.mockResolvedValue(undefined);
    const { client, result } = setup();

    // Ids are client-generated: without a shared scope the tick could reach the
    // database before the create and update nothing.
    result.current.create.mutate({ todoId: 'todo-new', input: { title: 'New' } });
    await waitFor(() => expect(mockCreateTodo).toHaveBeenCalledTimes(1));
    result.current.done.mutate({ todoId: 'todo-new', done: true });

    await waitFor(() => expect(todosOf(client)?.find((todo) => todo.todo_id === 'todo-new')?.done).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockSetTodoDone).not.toHaveBeenCalled();

    releaseCreate();

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalledWith('todo-new', true));
    expect(mockCreateTodo.mock.invocationCallOrder[0]).toBeLessThan(mockSetTodoDone.mock.invocationCallOrder[0]);
  });

  it('does not queue a write behind another trip', async () => {
    mockCreateTodo.mockReturnValue(never());
    mockSetTodoDone.mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const other = renderHook(() => useSetTodoDone('t2'), { wrapper });
    const first = renderHook(() => useCreateTodo('t1'), { wrapper });

    first.result.current.mutate({ todoId: 'todo-new', input: { title: 'New' } });
    await waitFor(() => expect(mockCreateTodo).toHaveBeenCalledTimes(1));
    other.result.current.mutate({ todoId: 'todo-x', done: true });

    await waitFor(() => expect(mockSetTodoDone).toHaveBeenCalledWith('todo-x', true));
    expect(idsOf(client)).toEqual(['todo-1', 'todo-2', 'todo-new']);
  });
});
