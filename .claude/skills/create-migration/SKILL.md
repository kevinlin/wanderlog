---
name: create-migration
description: Author a Supabase migration for Wanderlog — new table, new column, or constraint change — with the timestamped filename, the RLS wiring, and the downstream mapper/type updates the schema change implies.
disable-model-invocation: true
---

# Creating a Supabase migration

A schema change is never just SQL here. The row shape flows through `supabaseMappers` into domain types into a persisted IndexedDB cache, so a migration that stops at the `.sql` file leaves three downstream things broken, two of them silently.

**This skill writes the migration file. It does not apply it.** Applying against a real database is the user's call.

## 1. Write the SQL

Filename: `supabase/migrations/<UTC timestamp>_<snake_case_topic>.sql`, timestamp as `YYYYMMDDHHMMSS`.

```bash
date -u +%Y%m%d%H%M%S
```

Existing files use a zeroed clock time (`20260703000000`, `20260704080000`). Match that style — `20260725000000_add_activity_cost.sql` — and make sure the new timestamp sorts after every file already in the directory.

Open with a comment saying **why**, tied to the requirement or spec it serves. That is the house style:

```sql
-- Req 4.4: accommodation editing needs notes and a pin that follows the
-- accommodation; the M1 table has neither a remarks column nor coordinates.
alter table accommodations
  add column remarks text,
  add column lat double precision,
  add column lng double precision;
```

### Adding a column

Additive and nullable is the safe default. A `not null` column on a populated table needs a default or a backfill in the same migration, or the migration fails on deploy while passing locally against an empty database.

### Adding a table

Three things, all required:

```sql
create table examples (
  id       text primary key,
  -- Deletes cascade down the whole trip tree: trip -> stops -> children.
  stop_id  text not null references stops(id) on delete cascade,
  name     text not null
);

alter table examples enable row level security;

create policy authenticated_all on examples for all to authenticated using (true) with check (true);
```

Note what that policy means: **trip data is shared across every signed-in user.** There is no per-user ownership in this schema, and `is_done` is a canonical column all users see. A new table must follow the same model unless you are deliberately introducing per-user scoping — and if you are, say so out loud, because it is a product decision, not a schema detail.

A table with RLS enabled and no policy is invisible to everyone. A table with no RLS at all is readable by anyone with the anon key. Neither fails loudly.

## 2. Follow the change downstream

Work out which of these the migration implies, and do them in the same change:

| Changed | Also update |
|---|---|
| Any column | `TRIP_SELECT` / `TRIP_SUMMARY_SELECT` and the row/domain mapping in [src/services/supabaseMappers.ts](../../../src/services/supabaseMappers.ts) |
| Any column | Column definitions in [src/services/entityRows.ts](../../../src/services/entityRows.ts) |
| Domain-visible field | Types in [src/types/trip.ts](../../../src/types/trip.ts) |
| New table | Insert path in [src/services/tripBundleInsert.ts](../../../src/services/tripBundleInsert.ts), so file import and `create_trip` both populate it |
| Domain-visible field | Import schemas in [src/schemas/](../../../src/schemas/) if it comes from an import file |
| Domain-visible field | Agent tools in `api/_lib/tools/` if the agent should be able to set it |

A column added to the table but missing from `TRIP_SELECT` simply never loads — no error, just a field that is always undefined.

## 3. Bump the cache buster

**This is the step that gets forgotten.** If the change alters the shape of anything cached — domain types, mapper output, query key structure — change the `buster` string in [src/main.tsx](../../../src/main.tsx) (currently `'phase2-v1'`) in the same commit.

Without it, every returning user restores 30-day-old IndexedDB data in the old shape and feeds it to code expecting the new one. It passes every test, because tests start from an empty cache.

Purely additive nullable columns that no cached type mentions do not need a bump. When in doubt, bump — the cost is one cold fetch.

## 4. Verify

```bash
pnpm test
pnpm build
```

Then hand the apply step to the user:

```bash
supabase db push          # or: supabase migration up --local
```

Report the migration as written, not as applied, and list the downstream files you touched.

## Checklist

- [ ] Timestamp sorts after every existing migration
- [ ] Leading comment says why, referencing the requirement
- [ ] New table: `on delete cascade` to its parent, RLS enabled, `authenticated_all` policy
- [ ] `not null` columns have a default or a backfill
- [ ] `TRIP_SELECT` / `TRIP_SUMMARY_SELECT`, mappers, and `entityRows` updated
- [ ] Domain types updated
- [ ] `buster` bumped if any cached shape changed
- [ ] `pnpm test` and `pnpm build` pass
- [ ] Apply command handed to the user, not run
