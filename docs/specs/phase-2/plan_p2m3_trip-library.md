# Trip Library (Phase 2, M3) Implementation Plan

**Goal:** Authenticated family members browse all trips at `/trips` with derived past/active/upcoming status, open any trip, create new trips, and delete trips with cascade - turning the app from a single-trip viewer into a journal (Requirement 3).

**Architecture:** A `TripLibraryPage` under the existing `ProtectedRoute` renders trip summary cards from the `['trips']` query. Status derivation is a pure function of trip dates and the trip's own timezone. Create/delete are `useMutation` hooks over two new `supabaseService` functions; the DB cascade (M1 schema) does the cleanup. `HomeRedirect` falls back to `/trips` instead of the hardcoded trip id.

**Tech Stack:** react-router v7, TanStack Query v5, @supabase/supabase-js v2, date-fns, Tailwind 4.

## Global Constraints

- Prerequisite: M2 shipped ([plan_p2m2_auth-gate.md](plan_p2m2_auth-gate.md)) - router, `ProtectedRoute`, `UserMenu`, Vercel production all live.
- No schema changes: the M1 tables and their `on delete cascade` FKs already support everything here. RLS's blanket authenticated CRUD covers the new writes.
- New trip ids are client-generated `crypto.randomUUID()` (design: text PKs, natural keys for migrated rows, UUIDs for new rows).
- Domain type `TripData` stays untouched; only `TripSummary` grows fields.

---

### Task 1: Extend trip summaries with library fields (TDD)

Moved `TripSummary` from `AppStateContext.tsx` to `src/types/trip.ts` and grew it with `destination`, `start_date`, `end_date` (plus `timezone`, `created_at`, `updated_at`). Widened the `fetchTripSummaries` select and mapping to hydrate the new columns; updated all importers.

### Task 2: Trip status derivation (TDD)

Added `src/utils/tripStatusUtils.ts` with three pure functions: `deriveTripStatus` (past/active/upcoming, evaluated against "today" in the trip's own timezone via `Intl.DateTimeFormat('en-CA', { timeZone })` so lexicographic `YYYY-MM-DD` compares are safe), `pickHeroTrip` (active trip, else soonest upcoming, else null), and `sortForLibrary` (start_date descending). The Auckland test case pins the UTC-rollover boundary behavior.

### Task 3: createTrip / deleteTrip service functions (TDD)

Added `createTrip(input): Promise<string>` (mints a `crypto.randomUUID()`, inserts a `trips` row, returns the id) and `deleteTrip(tripId): Promise<void>` to `supabaseService`. Delete relies on the M1 `on delete cascade` FKs to remove stops/accommodations/activities/waypoints - no client-side fan-out (Req 3.6).

### Task 4: Trip library page

Added `TripLibraryPage` (route `/trips` inside `ProtectedRoute`) and `TripLibraryCard`. Layout: theme background, "Our Trips" heading, `UserMenu` top-right, a "New trip" button (wired in Task 6). The `pickHeroTrip` result renders as a full-width hero card (`data-testid="hero-trip"`); the rest render from `sortForLibrary` as a responsive card grid with name, destination, `date-fns`-formatted date range, and a status badge (`fern-green` active / `lake-blue` upcoming / `gray-400` past). Cards navigate to `/trips/:tripId`; loading/error reuse `LoadingSpinner`/`ErrorMessage`. Added a "Trips" item to `UserMenu` and deleted the unwired pre-M1 `TripSelectorModal` scaffolding (`TripCard` adapted in place where it fit).

### Task 5: Home redirect + last-trip restore (Req 3.4)

`HomeRedirect` now sends `/` to `/trips/:lastTripId` when `getCurrentTripId()` returns an id, otherwise to the library `/trips` (the `DEFAULT_TRIP_ID` constant from M2 was removed). `TripPage` renders a "This trip no longer exists" not-found state with a link back to `/trips` when a remembered-but-deleted trip resolves `null`.

### Task 6: Create trip (Req 3.5)

Added `CreateTripModal` and `useCreateTrip` (`useTripLibraryMutations`): a `POIModal`-style dialog with name (required), optional destination, start/end date (`endDate >= startDate` validated on submit), and timezone auto-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone` (read-only helper text). On success it invalidates `['trips']` and navigates to the new trip. Also hardened `TripPage` for empty trips (`stops.length === 0`): renders a map-background overlay card instead of assuming `stops[0]`, skipping the `SELECT_BASE` init and route calculation.

### Task 7: Delete trip with confirmation (Req 3.6)

Added a reusable `ConfirmDialog` (`{ title, message, confirmLabel, onConfirm, onCancel }`, destructive red confirm - M4 reuses it) and `useDeleteTrip`. A hover/long-press trash affordance on the card (with `stopPropagation`) opens the dialog; confirming calls `deleteTrip`, then removes `['trip', id]` from the cache, invalidates `['trips']`, and clears the stored current-trip id when it matches. No optimistic update - the confirm pause plus a single invalidation refetch is enough.

### Task 8: M3 verification gate (Req 3) + sign-off

Verified Req 3.1-3.6 on production: the library lists every trip with status badges, the active/next-upcoming trip is the hero with the rest ordered by start date, opening lands on the full trip UI, `/` restores the last opened trip, create appears and opens without crashing, and delete requires confirmation with no orphan child rows (cascade confirmed in the Supabase Table Editor). Marked the M3 row `Shipped` in `plan_wanderlog-phase-2.md`.

---

## Critical Files - Summary

| Path | Role |
|------|------|
| `src/types/trip.ts` | Home of `TripSummary` (now with destination + date range fields). |
| `src/utils/tripStatusUtils.ts` | Pure `deriveTripStatus` / `pickHeroTrip` / `sortForLibrary`; timezone-aware status. |
| `src/services/supabaseService.ts` | `createTrip` / `deleteTrip` (cascade via DB FKs). |
| `src/hooks/useTripLibraryMutations.ts` | `useCreateTrip` / `useDeleteTrip`. |
| `src/pages/TripLibraryPage.tsx` | `/trips` library page: hero + card grid. |
| `src/components/TripLibrary/TripLibraryCard.tsx` | Trip card with status badge and delete affordance. |
| `src/components/TripLibrary/CreateTripModal.tsx` | Create-trip dialog (replaced by `ImportTripModal` in M3.5). |
| `src/components/Layout/ConfirmDialog.tsx` | Reusable destructive-confirm dialog (reused in M4). |
| `src/pages/HomeRedirect.tsx` | `/` → last trip, else `/trips`. |

## Self-Review Notes

- Status derivation runs in the trip's own timezone (design: "derived status vs today in the trip's timezone") - the Auckland test case pins the UTC-rollover behavior.
- `deleteTrip` needs no optimistic update: the confirm dialog already inserts a deliberate pause, and the library invalidation refetches in one round trip.
- Trip metadata *editing* (name, dates, description) is deliberately absent - that is M4 slice 2 (Req 4.5).
- The Task 4 "New trip" button is inert for one commit until Task 6 wires it. Same reasoning as M2 Task 1: commits are not deploys.
- `TripSummary` moving to `types/trip.ts` touches M1-era imports; the compiler enforces completeness (`tsc -b` in `pnpm build`).

## Changelog

- 2026-07-04 — **Compacted post-implementation.** Removed step-by-step tasks, code snippets, `Files:`/`Interfaces:` preambles, and verification command lists now that M3 has shipped. Preserved Goal/Architecture, Global Constraints, Self-Review Notes, and added a Critical Files summary. Original plan recoverable via git history.
- 2026-07-03: Initial plan.
