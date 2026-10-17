# Wanderlog Phase 5 - Implementation Plan

Implements [requirements_trip-todos.md](requirements_trip-todos.md) per [design_trip-todos.md](design_trip-todos.md). Work happens on branch `feat/trip-todos`. Delegated tasks run through agent-handoff, and their state lives in `.handoff/goal.md` (gitignored).

## Milestone Tracker

| Milestone | Tasks | Status | Gate |
|-----------|-------|--------|------|
| M1 - Data and API | T1, T2 | Not started | Hermes-style curl session against a local Supabase stack (design §Verification Gates) |
| M2 - In-app experience | T3 | Not started | Eight seed items render correctly at 375px and desktop; tick updates badge; offline disables controls |
| M3 - Release | T4, T5 | Not started | Full suite, build, lint; invariant audit clean; hosted migration applied with owner go-ahead |

## Tasks

### T1 - Migration (driver)

Write `supabase/migrations/20261017120000_trip_todos.sql` exactly as the design's Data Model section specifies: table, constraints, index, `updated_at` trigger, RLS policy, grants, and the `active_todos` view.

Acceptance: the design's M1 gate passes on a local stack after `supabase db reset`. A throwaway seeding script in the scratchpad (never committed) checks every expected result itself:

- the relative-date fixture, the equality boundaries, and the ended trip
- atomic rejection of a mixed batch
- rejection of a whitespace-only title, a `javascript:` URL, and an unknown `trip_id`
- done dropping out of the view
- links nulled on activity and stop delete
- anon getting nothing

### T2 - Data layer (fast_worker)

Types, mappers, writes, state rule, and mutation hooks per the design's Domain Types and Mapping, State Rule, and Writes sections, with the tests from its Testing section.

Files in scope: `src/types/trip.ts`, `src/services/supabaseMappers.ts`, `src/services/supabaseService.ts`, `src/services/entityRows.ts`, `src/services/tripWrites.ts`, `src/utils/todoUtils.ts` (new), `src/hooks/useTripCacheMutation.ts`, `src/hooks/useTodoMutations.ts` (new), and their tests under the existing `__tests__` folders.

Acceptance:
- `pnpm test:run`, `pnpm build`, and `pnpm lint` pass.
- `todoUtils` tests cover every state in one fixture table, the ended-trip case, the missing-`end_date` case, list ordering, and `tripToday` across the `Asia/Shanghai` midnight (`2026-12-01T16:30:00Z` gives `2026-12-02`).
- Mapper tests show `toTripData` output has no `todos` key when the row has none, and maps todos when present.
- `useTodoMutations` tests cover optimistic create/update/done/delete, rollback with a retry toast, and invalidation of both `tripKeys.detail(id)` and `tripKeys.all`.
- `useTripToday` tests use fake timers: the value flips at trip-local midnight and on `visibilitychange`, with no re-render while the date holds.
- Offline (`onlineManager.setOnline(false)`), a todo mutation still calls its function, rolls back, and leaves no paused mutation in the cache. Mutations in one trip scope run in order.
- Mapper tests: `toTripSummary` maps `todos` (`is_done` to `done`) when present and adds no key when absent, and the existing full-output mapper tests pass unchanged.
- `src/main.tsx` buster is `phase5-v1`.
- `TRIP_SELECT` and `TRIP_SUMMARY_SELECT` are byte-identical to before. Every file under `api/` and its tests is unchanged. The shared modules keep invariant 5 by the rule `.claude/hooks/check-shared-esm.sh` enforces: type-only `@/` imports are allowed, and every value import is relative with a `.js` extension.

### T3 - UI (fast_worker, depends on T2)

The design's UI section: `src/components/Todos/` (button with badge, panel, row, chip, form modal, barrel), `TripPage` integration, the activity-card chip, the library-card count, and the celebration.

Files in scope: `src/components/Todos/**` (new), `src/pages/TripPage.tsx`, `src/pages/TripLibraryPage.tsx`, `src/components/Activities/**`, `src/components/Cards/ActivityCard.tsx`, `src/components/TripLibrary/TripLibraryCard.tsx`, and their tests.

Acceptance:
- `pnpm test:run`, `pnpm build`, and `pnpm lint` pass.
- Component tests cover:
  - grouping and ordering
  - badge count and accessible name ("To do, 3 ready"), and the count changing when the clock crosses trip-local midnight
  - the zero-count state and the empty state
  - controls disabled offline (`DoneCheckbox` `disabled`)
  - a link rendered only for `http(s)` URLs
  - form validation: blank and whitespace-only title, from after by
  - the activity chip choosing the most urgent linked todo
  - the library count and the last-active celebration toast
  - the button present in `TripPage`'s no-stops view
  - focus moving into the panel on open and back to the button on close, and Escape ignored while the form is open
- Colours come from DESIGN.md tokens, no ad-hoc hex. Touch targets are at least 44px. Every animation has a reduced-motion path.

### T4 - Docs and release (driver)

- `package.json` version `3.2.0`. New `CHANGELOG.md` (Keep a Changelog format) with the 3.2.0 entry.
- `docs/architecture/architecture.md` §4 and `CLAUDE.md` Data Model: todos as a trip child, the `active_todos` view, the Hermes REST path. `docs/specs/index.md`: Phase 5 rows.

Acceptance: the docs name every new table, view, and module. `spec-lint`'s naming rules hold for the three Phase 5 files.

### T5 - Final review and verification (driver)

- `invariant-auditor` on the full branch diff. Full review of every delegated diff against T2/T3 acceptance.
- The M2 browser gate against the local stack, at 375×812 and 1440×900.
- The M3 release order from the design. First the owner's go-ahead, then `supabase db push`. Next, the disposable "Todo API check" trip on production gets the M1 checks and is deleted. Only after that is the branch pushed or deployed.
- The `invariant-auditor` runs with this design's deliberate deviation stated: the browser-only selects `TRIP_DETAIL_SELECT` and `TRIP_LIBRARY_SELECT` stand in for additions to the shared selects.

## Changelog

- 2026-10-17: Acceptance tightened after spec review round 1: relative-date gate fixtures, offline fail-fast, the clock hook, the ESM rule as the hook enforces it, the buster, the no-stops view and keyboard checks, and the release order.
- 2026-10-17: Plan written after the brainstormed design. T1/T4/T5 kept by the driver (security-relevant SQL, release prose, acceptance). T2/T3 delegated to `fast_worker` in sequence because T3 builds on T2's types and hooks.
