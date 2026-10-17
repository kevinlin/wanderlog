-- Phase 5: trip todos. opens_on/due_on are calendar dates in trips.timezone.
-- Links are plain FKs with no same-trip check: the client resolves a link only
-- inside the todo's own trip and shows anything else as trip-level.
create table todos (
  id          text primary key default gen_random_uuid()::text,
  trip_id     text not null references trips(id) on delete cascade,
  stop_id     text references stops(id) on delete set null,
  activity_id text references activities(id) on delete set null,
  -- \S, not btrim: btrim strips spaces only, so a tab- or newline-only title would pass
  title       text not null check (title ~ '\S'),
  notes       text,
  -- Hermes writes free text, and the client renders this as an href
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
-- security_invoker so the caller's RLS on todos and trips applies.
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
