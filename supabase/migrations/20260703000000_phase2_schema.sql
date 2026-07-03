create extension if not exists moddatetime schema extensions;

create table trips (
  id          text primary key,
  name        text not null,
  description text,
  destination text,
  start_date  date not null,
  end_date    date not null,
  timezone    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table stops (
  id          text primary key,
  trip_id     text not null references trips(id) on delete cascade,
  name        text not null,
  date_from   date not null,
  date_to     date not null,
  lat         double precision not null,
  lng         double precision not null,
  duration_days integer,
  travel_time_from_previous text,
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table accommodations (
  id          text primary key,
  stop_id     text not null unique references stops(id) on delete cascade,
  name        text not null,
  address     text,
  check_in    text,
  check_out   text,
  confirmation text,
  url         text,
  thumbnail_url text,
  google_place_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table activities (
  id          text primary key,
  stop_id     text not null references stops(id) on delete cascade,
  name        text not null,
  type        text,
  lat         double precision,
  lng         double precision,
  address     text,
  duration    text,
  travel_time_from_accommodation text,
  url         text,
  remarks     text,
  thumbnail_url text,
  google_place_id text,
  sort_order  integer not null,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table scenic_waypoints (
  id          text primary key,
  stop_id     text not null references stops(id) on delete cascade,
  name        text not null,
  lat         double precision,
  lng         double precision,
  address     text,
  duration    text,
  url         text,
  remarks     text,
  thumbnail_url text,
  google_place_id text,
  sort_order  integer not null,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index stops_trip_id_idx on stops(trip_id);
create index activities_stop_id_idx on activities(stop_id);
create index scenic_waypoints_stop_id_idx on scenic_waypoints(stop_id);

-- updated_at maintenance (last-write-wins timestamp, Req 4.9)
create trigger set_updated_at before update on trips
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on stops
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on accommodations
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on activities
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on scenic_waypoints
  for each row execute procedure extensions.moddatetime(updated_at);

-- RLS: authenticated family members get everything, anon gets nothing (Req 1.6, 2.7)
alter table trips enable row level security;
alter table stops enable row level security;
alter table accommodations enable row level security;
alter table activities enable row level security;
alter table scenic_waypoints enable row level security;

create policy authenticated_all on trips for all to authenticated using (true) with check (true);
create policy authenticated_all on stops for all to authenticated using (true) with check (true);
create policy authenticated_all on accommodations for all to authenticated using (true) with check (true);
create policy authenticated_all on activities for all to authenticated using (true) with check (true);
create policy authenticated_all on scenic_waypoints for all to authenticated using (true) with check (true);

-- Base table grants: current Supabase projects no longer grant table privileges
-- to API roles by default; RLS policies above still gate row access. anon gets
-- no grant at all (Req 2.7).
grant select, insert, update, delete
  on trips, stops, accommodations, activities, scenic_waypoints
  to authenticated;
grant all
  on trips, stops, accommodations, activities, scenic_waypoints
  to service_role;
