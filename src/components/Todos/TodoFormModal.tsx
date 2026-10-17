import { useState } from 'react';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { useCreateTodo, useUpdateTodo } from '@/hooks/useTodoMutations';
import type { TodoInput } from '@/services/supabaseService';
import type { Todo, TripData } from '@/types/trip';
import { getActivityTypeIcon } from '@/utils/activityUtils';

interface TodoFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  todo?: Todo;
  tripData: TripData;
  tripId: string;
}

const NO_LINK = '';
// Case-insensitive, like the database's `url ~* '^https?://'` check.
const HTTP_URL = /^https?:\/\//i;

const INPUT_CLASS =
  'min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-alpine-teal focus:outline-hidden focus:ring-2 focus:ring-alpine-teal/30 aria-invalid:border-red-500';
const LABEL_CLASS = 'mb-1 block font-medium text-gray-700 text-sm';
const HINT_CLASS = 'mt-1 text-gray-600 text-xs';
const ERROR_CLASS = 'mt-1 text-red-600 text-xs';

const stopOption = (stopId: string) => `stop:${stopId}`;
const activityOption = (activityId: string) => `activity:${activityId}`;

interface ParsedLink {
  activityId?: string;
  // The stop's first day, which is what an empty "Book by" is pre-filled with.
  firstDay?: string;
  stopId?: string;
}

// One select carries both kinds of link. Picking an activity also sets its stop,
// since the activity is the more specific of the two.
const parseLink = (value: string, trip: TripData): ParsedLink => {
  const separator = value.indexOf(':');
  const kind = value.slice(0, separator);
  const id = value.slice(separator + 1);
  if (kind === 'stop') {
    const stop = trip.stops.find((candidate) => candidate.stop_id === id);
    return stop ? { stopId: stop.stop_id, firstDay: stop.date.from } : {};
  }
  if (kind === 'activity') {
    const stop = trip.stops.find((candidate) => candidate.activities.some((activity) => activity.activity_id === id));
    return stop ? { activityId: id, stopId: stop.stop_id, firstDay: stop.date.from } : {};
  }
  return {};
};

// The same precedence the list uses: the activity when it resolves inside the
// trip, else the stop, else the whole trip. A link to anything outside this
// trip shows as the whole trip, and saving the form clears it.
const initialLink = (todo: Todo | undefined, trip: TripData): string => {
  if (todo?.activity_id && parseLink(activityOption(todo.activity_id), trip).activityId) {
    return activityOption(todo.activity_id);
  }
  if (todo?.stop_id && parseLink(stopOption(todo.stop_id), trip).stopId) {
    return stopOption(todo.stop_id);
  }
  return NO_LINK;
};

// `todo` absent means create mode; present means edit mode (pre-filled).
export const TodoFormModal = ({ isOpen, onClose, todo, tripData, tripId }: TodoFormModalProps) => {
  const createMutation = useCreateTodo(tripId);
  const updateMutation = useUpdateTodo(tripId);

  const [title, setTitle] = useState(todo?.title ?? '');
  const [notes, setNotes] = useState(todo?.notes ?? '');
  const [url, setUrl] = useState(todo?.url ?? '');
  const [link, setLink] = useState(() => initialLink(todo, tripData));
  const [opensOn, setOpensOn] = useState(todo?.opens_on ?? '');
  const [dueOn, setDueOn] = useState(todo?.due_on ?? '');
  // Errors wait for the first Save, so an untouched form isn't born red.
  const [showErrors, setShowErrors] = useState(false);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

  const errors = {
    title: title.trim() ? undefined : 'Give it a title.',
    url: url.trim() && !HTTP_URL.test(url.trim()) ? 'Links need to start with http:// or https://' : undefined,
    dueOn: opensOn && dueOn && opensOn > dueOn ? "Book by can't be before Ready from." : undefined,
  };
  const visible = showErrors ? errors : { title: undefined, url: undefined, dueOn: undefined };

  const handleLinkChange = (value: string) => {
    setLink(value);
    const { firstDay } = parseLink(value, tripData);
    if (firstDay && !dueOn) {
      setDueOn(firstDay);
    }
  };

  const handleSubmit = () => {
    setShowErrors(true);
    if (errors.title || errors.url || errors.dueOn) {
      return;
    }
    const { stopId, activityId } = parseLink(link, tripData);
    const input: TodoInput = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      url: url.trim() || undefined,
      opensOn: opensOn || undefined,
      dueOn: dueOn || undefined,
      stopId,
      activityId,
    };
    if (todo) {
      updateMutation.mutate({ todoId: todo.todo_id, input }, { onSuccess: onClose });
    } else {
      createMutation.mutate({ todoId: crypto.randomUUID(), input }, { onSuccess: onClose });
    }
  };

  return (
    <ItemModalShell
      error={mutationError}
      isOpen={isOpen}
      isPending={isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={todo ? 'Edit to-do' : 'Add to-do'}
    >
      <div>
        <label className={LABEL_CLASS} htmlFor="todo-title">
          Title
        </label>
        <input
          aria-describedby={visible.title ? 'todo-title-error' : undefined}
          aria-invalid={Boolean(visible.title)}
          className={INPUT_CLASS}
          id="todo-title"
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Book the Chongqing train"
          type="text"
          value={title}
        />
        {visible.title && (
          <p className={ERROR_CLASS} id="todo-title-error" role="alert">
            {visible.title}
          </p>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="todo-notes">
          Notes
        </label>
        <textarea className={INPUT_CLASS} id="todo-notes" onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="todo-url">
          URL
        </label>
        <input
          aria-describedby={visible.url ? 'todo-url-error' : undefined}
          aria-invalid={Boolean(visible.url)}
          className={INPUT_CLASS}
          id="todo-url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://"
          type="url"
          value={url}
        />
        {visible.url && (
          <p className={ERROR_CLASS} id="todo-url-error" role="alert">
            {visible.url}
          </p>
        )}
      </div>

      <div>
        <label className={LABEL_CLASS} htmlFor="todo-link">
          Link to
        </label>
        <select className={INPUT_CLASS} id="todo-link" onChange={(event) => handleLinkChange(event.target.value)} value={link}>
          <option value={NO_LINK}>Whole trip</option>
          {tripData.stops.map((stop) => (
            <optgroup key={stop.stop_id} label={stop.name}>
              <option value={stopOption(stop.stop_id)}>{`${stop.name} (whole stop)`}</option>
              {stop.activities.map((activity) => (
                <option key={activity.activity_id} value={activityOption(activity.activity_id)}>
                  {`${getActivityTypeIcon(activity.activity_type ?? 'other')} ${activity.activity_name}`}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={LABEL_CLASS} htmlFor="todo-opens-on">
            Ready from
          </label>
          <input
            className={INPUT_CLASS}
            id="todo-opens-on"
            onChange={(event) => setOpensOn(event.target.value)}
            type="date"
            value={opensOn}
          />
          <p className={HINT_CLASS}>When it can be booked. Empty means now.</p>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="todo-due-on">
            Book by
          </label>
          <input
            aria-describedby={visible.dueOn ? 'todo-due-on-error' : undefined}
            aria-invalid={Boolean(visible.dueOn)}
            className={INPUT_CLASS}
            id="todo-due-on"
            onChange={(event) => setDueOn(event.target.value)}
            type="date"
            value={dueOn}
          />
          {visible.dueOn ? (
            <p className={ERROR_CLASS} id="todo-due-on-error" role="alert">
              {visible.dueOn}
            </p>
          ) : (
            <p className={HINT_CLASS}>The last good day to do it.</p>
          )}
        </div>
      </div>
    </ItemModalShell>
  );
};
