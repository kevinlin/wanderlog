import type { Todo, TripData } from '@/types/trip';
import { getActivityTypeIcon } from '@/utils/activityUtils';
import { countActiveTodos, groupTodos, isActiveTodo } from '@/utils/todoUtils';

export interface TodoLink {
  emoji: string;
  label: string;
}

// What an activity card needs to draw its chip. `today` rides along so the chip
// judges the todo against the same day the list and the badge used.
export interface ActivityTodo {
  today: string;
  todo: Todo;
}

const STOP_EMOJI = '📍';

// The design has links resolve only inside the todo's own trip, because the
// database does not pin them there. Anything else reads as a trip-level todo.
// The activity wins over the stop, and a dead activity link falls back to the
// stop link the todo may also carry.
export const resolveTodoLink = (todo: Todo, trip: TripData): TodoLink | null => {
  if (todo.activity_id) {
    for (const stop of trip.stops) {
      const activity = stop.activities.find((candidate) => candidate.activity_id === todo.activity_id);
      if (activity) {
        return { emoji: getActivityTypeIcon(activity.activity_type ?? 'other'), label: activity.activity_name };
      }
    }
  }
  const stop = todo.stop_id ? trip.stops.find((candidate) => candidate.stop_id === todo.stop_id) : undefined;
  return stop ? { emoji: STOP_EMOJI, label: stop.name } : null;
};

// One chip per activity, built once per render from the whole trip's todos.
// Done todos never chip. groupTodos already orders the ready group with overdue
// first (an overdue todo's deadline is before any other ready one), and ready
// before upcoming is the urgency order, so its first entry is the winner.
export const buildActivityTodoMap = (todos: Todo[] | undefined, today: string): Record<string, ActivityTodo> => {
  const open = new Map<string, Todo[]>();
  for (const todo of todos ?? []) {
    if (todo.activity_id && !todo.done) {
      open.set(todo.activity_id, [...(open.get(todo.activity_id) ?? []), todo]);
    }
  }

  const map: Record<string, ActivityTodo> = {};
  for (const [activityId, linked] of open) {
    const groups = groupTodos(linked, today);
    const winner = groups.ready[0] ?? groups.upcoming[0];
    if (winner) {
      map[activityId] = { todo: winner, today };
    }
  }
  return map;
};

// Judged on the list as it stands before the tick. Ticking something that was
// never active (an upcoming todo, or any todo on an ended trip) must stay quiet.
export const tickCompletesActiveTodos = (todos: Todo[], todoId: string, today: string, tripEndDate: string | undefined): boolean => {
  const ticked = todos.find((todo) => todo.todo_id === todoId);
  if (!(ticked && isActiveTodo(ticked, today, tripEndDate))) {
    return false;
  }
  return (
    countActiveTodos(
      todos.filter((todo) => todo.todo_id !== todoId),
      today,
      tripEndDate
    ) === 0
  );
};
