-- Phase 4: visit records. Additive only - `duration` keeps the planned
-- estimate (free text, often a range) and is never converted.
alter table activities       add column visited_at             text;
alter table activities       add column visit_duration_minutes integer;
alter table scenic_waypoints add column visited_at             text;
alter table scenic_waypoints add column visit_duration_minutes integer;
