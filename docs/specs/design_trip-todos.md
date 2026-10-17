# Wanderlog Phase 5 - Design Document

Design for [requirements_trip-todos.md](requirements_trip-todos.md): trip todos with a "from"/"by" window, an always-visible active count, one trip-wide list, and a REST contract for Hermes. Phases 2-4 ([design_supabase-auth-editing.md](design_supabase-auth-editing.md), [design_ai-trip-agent.md](design_ai-trip-agent.md), [design_visit-records.md](design_visit-records.md)) carry over except where amended here.

Revised after an independent spec review; see the changelog for what moved.

## Design Decisions

In addition to the Scope Decisions in the requirements doc.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | New `todos` table, a child of `trips` | Hermes writes rows over REST, and the database has to reject bad ones. A JSON column on `trips` would give neither per-row writes nor constraints. |
| Links | Plain nullable FKs to `stops` and `activities`, `on delete set null`, no same-trip check | A composite FK that pins the stop to the trip and the activity to the stop was tried on paper. On a stop delete, the cascade's two set-null actions fire in an order Postgres doesn't promise, and a "link needs a stop" check can fail halfway through. A trigger would work but is the clever option. Accepted cost: Hermes could link a todo to another trip's activity. The client resolves links only inside the todo's own trip and shows anything else as trip-level, so the worst case is a missing label. |
| Dates | `date` columns `opens_on`, `due_on`, read as calendar dates in `trips.timezone` | Every hint in the source plan is day-granular. Sale times (12306 releases at set hours) go in the notes. |
| Active rule | Written twice: a pure TS module for the app, a SQL view for Hermes. Both are checked against the same state boundaries | The app needs the rule offline and against optimistic state, so it can't ask the database. Hermes needs it with no client code. Each copy carries a comment naming the other. |
| Clock | `useTripToday(timeZone)` re-renders when the trip-local date changes. It checks once a minute and on `visibilitychange` | Render-time "today" alone leaves a page left open overnight showing yesterday's count, and nothing refetches to fix it (review finding). |
| Client data path | Todos ride in the browser's trip detail query as `TripData.todos` | Writes then go through `useTripCacheMutation` (invariant 2). A separate todos query was rejected because it needs a second optimistic-write pattern. |
| Agent isolation | New browser-only selects; the shared `TRIP_SELECT` and `TRIP_SUMMARY_SELECT` are untouched | The agent prefetch and `get_trip`/`list_trips` keep producing exactly what they do today (`api/agent.ts:62`, `api/_lib/tools/read.ts:25`). The mappers map `todos` only when the row carries them, so agent output gains no key. |
| Library counts | Browser-only summary select embeds `todos(opens_on, is_done)`, mapped in `supabaseMappers`. Todo writes also invalidate `tripKeys.all` | Counts are time-dependent, so they're computed at render. The library count is fresh once the write settles. An optimistic library projection was rejected: it would add a second snapshot and rollback for one card (requirement 3.4 narrowed instead). |
| Cache buster | Bumped to `phase5-v1` | Both new fields are optional, so a stale cache would read fine. But the bump costs one cold load per device, and in exchange no restored cache can mix pre-todo shapes into optimistic writes. It also keeps the invariant auditor's rule simple. |
| Offline writes | Todo mutations run with `networkMode: 'always'`. An offline attempt fails, rolls back, and offers retry. It is never paused | A paused mutation is persisted, and after a reload only mutations with registered defaults can run again (`src/lib/mutationDefaults.ts`, visits only). A restored todo write would have no function and no rollback. You can't book a train offline anyway. |
| Ordering of todo writes | All todo mutations for a trip share a TanStack `scope` (`todos:<tripId>`) | Ids are client-generated, so a tick or edit sent while the create is still in flight could reach the database first and update nothing. A shared scope runs them in order. |
| View security | `security_invoker = true`, granted to `authenticated` only | RLS on `todos` and `trips` applies to whoever queries the view. `anon` gets nothing, as everywhere else. |
| Ids | `text` PK with a `gen_random_uuid()::text` default | Hermes can omit the id. The app generates its own uuid and passes it in, so the optimistic row and the stored row share an id and nothing flickers on settle. |
| Text safety | DB checks `title ~ '\S'` and `url ~* '^https?://'`. The client trims the title and renders a link only for `http(s)` | `btrim` strips spaces only, so a tab- or newline-only title would pass it. Hermes writes free text, and an unchecked `javascript:` URL in an `href` is script injection. |
| Missing-row updates | A zero-row update counts as success | Someone else deleted the todo. The settle refetch shows the truth, which matches how `updateById` treats every other entity. |
| UI label | "To do" | The mockup said "To book", but not every item is a booking. Checking that the drone show is confirmed is a check, not a booking. |

## Data Model

Migration `supabase/migrations/20261017120000_trip_todos.sql`:

```sql
create table todos (
  id          text primary key default gen_random_uuid()::text,
  trip_id     text not null references trips(id) on delete cascade,
  stop_id     text references stops(id) on delete set null,
  activity_id text references activities(id) on delete set null,
  title       text not null check (title ~ '\S'),
  notes       text,
  url         text check (url ~* '^https?://'),
  opens_on    date,
  due_on      date,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint todos_window check (opens_on is null or due_on is null or opens_on <= due_on)
);

create index todos_trip_id_idx on todos(trip_id);

create trigger set_updated_at before update on todos
  for each row execute procedure extensions.moddatetime(updated_at);

alter table todos enable row level security;
create policy authenticated_all on todos for all to authenticated using (true) with check (true);
grant select, insert, update, delete on todos to authenticated;
grant all on todos to service_role;

-- Same rule as src/utils/todoUtils.ts (isActiveTodo). Change both together.
create view active_todos with (security_invoker = true) as
select
  todos.*,
  trips.name     as trip_name,
  trips.timezone as trip_timezone,
  coalesce(todos.due_on < (now() at time zone trips.timezone)::date, false) as is_overdue
from todos
join trips on trips.id = todos.trip_id
where not todos.is_done
  and coalesce(todos.opens_on <= (now() at time zone trips.timezone)::date, true)
  and trips.end_date >= (now() at time zone trips.timezone)::date;

grant select on active_todos to authenticated;
```

Notes:

- A null `url` passes its check. Postgres treats a null check result as satisfied.
- `stop_id` and `activity_id` are independent. The client shows the activity when one resolves inside the trip, otherwise the stop, otherwise nothing.
- `on delete set null` on a stop or activity keeps the todo (Req 1.4). A todo whose activity is deleted falls back to its stop link if it had one.

## Domain Types and Mapping

`src/types/trip.ts`:

```ts
export interface Todo {
  activity_id?: string;
  done: boolean;
  due_on?: string; // YYYY-MM-DD, trip timezone
  notes?: string;
  opens_on?: string; // YYYY-MM-DD, trip timezone
  stop_id?: string;
  title: string;
  todo_id: string;
  url?: string;
}

// The fields the active count needs; what the library summary carries.
export type TodoWindow = Pick<Todo, 'opens_on' | 'done'>;

// TripData gains:    todos?: Todo[];
// TripSummary gains: todos?: TodoWindow[];
```

`src/services/supabaseMappers.ts` (shared, invariant 5 rules apply):

- `TodoRow`, `toTodo(row)`, and `toTodoWindow(row)` (`is_done` becomes `done`), using the existing `orNothing` pattern (null becomes absent).
- `TripRowNested` gains `todos?: TodoRow[]`, and `TripSummaryRow` gains `todos?: Pick<TodoRow, 'opens_on' | 'is_done'>[]`. `toTripData` and `toTripSummary` spread `todos` in only when the row carries it, so the agent's output gains no key.
- `TRIP_DETAIL_SELECT = \`${TRIP_SELECT}, todos(*)\`` and `TRIP_LIBRARY_SELECT = \`${TRIP_SUMMARY_SELECT}, todos(opens_on, is_done)\``. Both are commented as browser-only. `api/` keeps using the originals.

`src/services/supabaseService.ts`: `fetchTripById` uses `TRIP_DETAIL_SELECT`, and `fetchTripSummaries` uses `TRIP_LIBRARY_SELECT`. All mapping stays in the mappers.

`src/main.tsx`: buster `phase5-v1`.

## State Rule

`src/utils/todoUtils.ts` (browser-only, may use `@/`):

```ts
export type TodoState = 'done' | 'upcoming' | 'ready' | 'overdue';

// "Today" in the trip's timezone, via visitRecord's pinned formatter.
export const tripToday = (timeZone: string, now: Date = new Date()): string => formatTripLocal(now, timeZone).slice(0, 10);

export const todoState = (todo: Pick<Todo, 'done' | 'opens_on' | 'due_on'>, today: string): TodoState => { ... };

// Same rule as the active_todos view. Change both together.
export const isActiveTodo = (todo: TodoWindow, today: string, tripEndDate: string | undefined): boolean => { ... };
export const countActiveTodos = (todos: TodoWindow[] | undefined, today: string, tripEndDate: string | undefined): number => { ... };
```

Boundaries, matching the view exactly: `opens_on = today` is ready, `due_on = today` is ready and not overdue, and `end_date = today` still counts. A missing `end_date` (an old cached `TripData`) counts as "not ended".

Ordering for the list lives here too, so the components only render:

- Ready now: overdue first, then `due_on` ascending (no deadline last), then title.
- Coming up: `opens_on` ascending.
- Done: `due_on` ascending.

`src/hooks/useTripToday.ts`: returns `tripToday(timeZone)`. It re-evaluates on a 60-second interval and on `visibilitychange` to visible, and changes state only when the date string changes, so it re-renders at most once a day. Every count and grouping takes `today` from this hook.

## Writes

`src/services/entityRows.ts`: `TODO_COLUMNS` = `title`, `notes`, `url`, `opensOn`→`opens_on`, `dueOn`→`due_on`, `stopId`→`stop_id`, `activityId`→`activity_id`. Done is written sparsely through its own column def, for the same reason `ITEM_DONE_COLUMN` sits outside `ACTIVITY_COLUMNS`: a full-form save must not clobber it.

`src/services/tripWrites.ts` (shared):

- `createTodo(client, tripId, id, input)`
- `updateTodo(client, id, input)`, a dense write of `TODO_COLUMNS` where an absent field clears the column, matching the item editors
- `setTodoDone(client, id, done)`
- deletion through the existing `deleteById(client, 'todos', id)`

`supabaseService` gains the matching thin bindings.

`src/hooks/useTripCacheMutation.ts` gains three optional options, each off by default so existing callers are unchanged:

- `invalidateLibrary` also invalidates `tripKeys.all` on settle
- `networkMode`, passed through to `useMutation`
- `scope`, passed through to `useMutation`

`src/hooks/useTodoMutations.ts` has `useCreateTodo`, `useUpdateTodo`, `useSetTodoDone`, and `useDeleteTodo`. All are composed from `useTripCacheMutation` with `invalidateLibrary: true`, `networkMode: 'always'`, `scope: { id: \`todos:${tripId}\` }`, and patches over `trip.todos ?? []`.

## UI

New folder `src/components/Todos/` with an `index.ts` barrel.

- **`TodoButton`** sits in the top-right cluster on `TripPage`, left of `AgentButton`. The two share one fixed container so they never overlap at narrow widths. It's a white floating chip with a clipboard-check icon, the "To do" label (icon-only below `sm`), and an amber count badge (Warning Amber, `gray-900` text) when the count is above zero. Accessible name: "To do, 3 ready" or "To do". Tapping toggles `TodoPanel`. It works offline, since reading is allowed. It also renders in `TripPage`'s no-stops view, because trip-level todos don't need stops.
- **`TodoPanel`** is a bottom sheet with a backdrop on a phone. On desktop it's a panel anchored under the cluster, stacked above the activities panel.
  - The header holds the title and an Add button, which is disabled offline.
  - The three groups (Requirement 4.1) have counts. The Done group starts collapsed when it's non-empty.
  - The empty state invites adding the first booking.
  - It closes on Escape, the close control, and a backdrop tap. Escape is ignored while the form or a confirm dialog is open on top of it.
  - On open, focus moves into the panel. On close, it returns to `TodoButton`.
- **Row**: `DoneCheckbox`, title, link line (activity emoji and name, or stop name), date chip, notes in muted body text, and an "Open link" control for `http(s)` URLs (`target="_blank" rel="noopener noreferrer"`).
  - Edit and delete icon buttons follow the in-card icon-button pattern. Delete goes through the existing `ConfirmDialog`.
  - Done rows use the existing done treatment: emerald tint, strike-through, muted.
  - `DoneCheckbox` gains an optional `disabled` prop for the offline state.
- **`TodoChip`** renders the date chip in one place for the row and the activity card:
  - ready: "Ready · by 15 Dec" (amber tint)
  - ready with no deadline: "Ready now"
  - overdue: "Overdue · was due 2 Dec" (red tint, with the word carrying the meaning)
  - upcoming: "Opens 4 Dec" (gray)
  - done: no chip
  - date format `d MMM` via date-fns
- **`TodoFormModal`** sits on `ItemModalShell` and has:
  - title (required, trimmed)
  - notes (textarea)
  - URL (`type="url"`)
  - "Link to": one select grouping the trip's stops and, under each, its activities. Choosing an activity also sets its stop.
  - "Ready from" and "Book by" as native `<input type="date">`
  - inline errors for a blank title and from-after-by

  When "Book by" is empty and a stop or activity is picked, it pre-fills with that stop's first day. No native `min`/`max`, for the reason Phase 4 recorded: they would block the form submit.
- **Activity card chip**: `ActivityCard` gets an optional todo-state prop and shows `TodoChip` with a 🎟 lead when a linked todo isn't done. When several are linked, the most urgent wins (overdue, then ready, then upcoming). The map from activity id to state is built once from `tripData.todos` in the panel and passed down.
- **Library card**: `TripLibraryCard` shows "🎟 3 to do" in the meta row when the count is above zero.
- **Celebration**: ticking the last active todo shows a success toast ("All booked. Now the fun part. 🎉"). Other ticks show no toast. Unticking never celebrates.

Every motion added respects `prefers-reduced-motion`. Every touch target is at least 44px tall. Colour never carries meaning alone.

## Hermes API Contract (stable)

Base: `$SUPABASE_URL/rest/v1`. Every request sends `apikey: $SUPABASE_ANON_KEY` and `Authorization: Bearer $TOKEN`. `$APP_URL` is the production app origin.

**Auth.** Same account and flow as the agent contract:

```bash
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"hermes@wanderlog.local","password":"'"$HERMES_PASSWORD"'"}' | jq -r .access_token)
```

The token lasts an hour, so sign in at the start of each run.

**Read active todos** (the reminder feed). The trip-local date rule is applied by the database:

```bash
curl -s "$SUPABASE_URL/rest/v1/active_todos?select=*&order=is_overdue.desc,due_on.asc.nullslast" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
```

Each row carries every `todos` column plus `trip_name`, `trip_timezone`, and `is_overdue`. Deep link: `$APP_URL/trips/<trip_id>`.

**Read what opens on a given day.** For "panda tickets open tomorrow" nudges, query the table and filter out ended trips through the embedded trip:

```bash
curl -s "$SUPABASE_URL/rest/v1/todos?select=*,trips!inner(name,end_date)&is_done=is.false&opens_on=eq.2026-12-02&trips.end_date=gte.2026-12-02" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
```

**Read a trip tree for linking.** Stops carry the dates. Activities have none of their own.

```bash
curl -s "$SUPABASE_URL/rest/v1/trips?select=id,name,start_date,end_date,timezone,stops(id,name,date_from,date_to,activities(id,name))&end_date=gte.2026-10-17" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN"
```

**Create**, singly or in bulk. Omit `id`. Send the same keys in every object, with `null` for blank optional fields. A batch is atomic: one invalid row rejects them all.

```bash
curl -s "$SUPABASE_URL/rest/v1/todos" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '[{"trip_id":"<trip>","title":"Book 12/16 panda base tickets","notes":"Winter morning session from 08:00; go early.","url":null,"opens_on":"2026-12-02","due_on":"2026-12-15","stop_id":"<chengdu>","activity_id":"<panda-base>"}]'
```

**Update** any field, including done:

```bash
curl -s -X PATCH "$SUPABASE_URL/rest/v1/todos?id=eq.<todo>" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{"is_done":true}'
```

**Errors.** A blank or whitespace-only title, from after by, a non-http URL, or an unknown `trip_id` comes back as HTTP 400 or 409 with Postgres's message in `message`. Relative hints ("14 days ahead") are Hermes's to resolve to dates before writing.

## Testing

- `todoUtils`: one fixture table drives every state, all three equality boundaries, the ended trip, and the missing `end_date`. It also covers `tripToday` across a timezone midnight (`2026-12-01T16:30:00Z` is already 2 Dec in `Asia/Shanghai`) and the list ordering.
- `useTripToday`: with fake timers, the value flips at trip-local midnight and on a `visibilitychange`, and it doesn't re-render while the date holds.
- Mappers: `toTodo`/`toTodoWindow` null handling. `toTripData` and `toTripSummary` with and without `todos`, where an absent key stays absent. The existing full-output mapper tests pass unchanged.
- `entityRows`/`tripWrites`: `TODO_COLUMNS` mapping, dense update clears, `setTodoDone` writes only `is_done`, `createTodo` passes the id and trip. All run against the existing fake client.
- `useTodoMutations`: optimistic create, update, done, and delete. Rollback with a retry toast. Invalidation of both keys. Offline (`onlineManager.setOnline(false)`) the mutation function still runs, the write rolls back, and no paused mutation is left in the mutation cache. Two mutations in one scope run in order.
- Components: grouping and ordering. Badge count and accessible name. The count changing when the clock crosses midnight. The empty state. Controls disabled offline. A link only for http(s). Form validation (blank and whitespace-only title, from after by). The activity chip choosing the most urgent linked todo. The library count. The last-active celebration. The button in the no-stops view. Focus moving into and back out of the panel. Escape ignored while the form is open.
- Agent regression: every existing `api/` test passes untouched.

## Verification Gates

**M1 (local stack).** Run `supabase start` and `supabase db reset`. A throwaway script creates a test user (auth admin API) and signs in by password grant. Every date is relative to the real today `T` in `Asia/Shanghai`. Seed:

- a live trip from `T-1` to `T+10` with two stops, an activity under each, and todos covering each state:
  - ready with no dates
  - `opens_on = T`
  - `opens_on = T+1` (coming up)
  - `due_on = T` (ready, not overdue)
  - `due_on = T-1` (overdue)
  - done
  - one todo linked to each activity
- an ended trip from `T-10` to `T-1` with one ready todo

Expected:

- `active_todos` returns exactly the ready and overdue ids from the live trip, and only `due_on = T-1` has `is_overdue`.
- A mixed batch (one valid row, one with from after by) is rejected whole. A whitespace-only title (`"\t\n"`), a `javascript:` URL, and an unknown `trip_id` are each rejected.
- A PATCH to done drops the row from the view.
- Deleting a linked activity leaves `activity_id` null and keeps `stop_id`. Deleting the stop nulls `stop_id`.
- Without a bearer token, both `todos` and `active_todos` return an error or no rows.

**M2 (local stack, browser).** Run `pnpm dev` pointed at the local stack and seeded as above. Check these at 375×812 and 1440×900:

- the groups match the M1 expectation
- ticking changes the badge at once
- the library shows the count
- with DevTools offline, the list stays readable, controls are disabled, and an already-open form's Save fails and rolls back without queueing

**M3 (release).** In order:

1. The owner approves applying the migration to the hosted project.
2. `supabase db push` runs. The migration is additive, so the deployed client keeps working.
3. As Hermes on production, a disposable trip "Todo API check" is created, the M1 checks are repeated on it, and the trip is deleted. Its todos cascade with it.
4. Only then is the branch pushed or deployed. A deploy that reaches the hosted database before the migration fails every trip and library load, preview builds included.

Source items from the plan, as an example Hermes batch (2026 trip, Asia/Shanghai):

| Title | From | By | Link |
|-------|------|----|------|
| Book 12/11 Tianfu Airport → Chongqing train | 2026-11-27 | 2026-12-10 | Chongqing stop |
| Check 12/12 drone show is confirmed | 2026-11-28 | 2026-12-11 | Chongqing stop |
| Book 12/12 Yangtze cable car slot | - | 2026-12-11 | Chongqing stop |
| Buy 12/14 Two Rivers night cruise tickets | 2026-12-10 | 2026-12-13 | Chongqing stop |
| Book 12/15 Chongqing → Chengdu East train | 2026-12-01 | 2026-12-14 | Chengdu stop |
| Book 12/16 panda base tickets | 2026-12-02 | 2026-12-15 | Chengdu stop |
| Book 12/17 Panda Valley tickets and charter car | - | 2026-12-16 | Chengdu stop |
| Book 12/18 Wuhou Shrine and face-changing opera | 2026-12-04 | 2026-12-11 | Chengdu stop |

## Left to the Builder

- Component split inside `src/components/Todos/`, and whether the sheet reuses `ActivitiesPanel`'s drag-handle mechanics or stays a plain sheet.
- Exact copy, within PRODUCT.md's voice, and the icon choice.
- Panel width and stacking on desktop, within DESIGN.md's rules (glass only where the surface floats over the map).
- Test file layout.

## Changelog

- 2026-10-17: Initial design (brainstormed and approved: Hermes-owned reminders over Supabase REST, trip-wide list behind a top-bar badge, from/by window, shared state).
- 2026-10-17: Revised after spec review round 1 (deep_reasoner). Added offline fail-fast with `networkMode: 'always'` (a paused mutation would persist without a way to revive it), `useTripToday` for midnight, and a per-trip mutation scope. Narrowed the library count to settle-time freshness. Changed the title check to `title ~ '\S'` (`btrim` misses tabs and newlines). Moved the library projection into the mappers. Bumped the buster. Covered the no-stops view, focus and Escape handling, and the `DoneCheckbox` disabled state. Wrote the release order (migration before any deploy) and relative-date gate fixtures. Made the curl examples complete.
