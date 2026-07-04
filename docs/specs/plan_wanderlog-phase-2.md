# Wanderlog Phase 2 - Master Plan

Milestone tracker for [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md) / [requirements_wanderlog-phase-2.md](requirements_wanderlog-phase-2.md).

Detailed plans are written just-in-time: each milestone's plan is authored when the previous milestone ships, so task detail reflects the real code shape rather than speculation. Each milestone is independently shippable.

| Milestone | Plan | Status | Verification gate |
|-----------|------|--------|-------------------|
| M0 - Toolchain | [plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md) | Shipped (2026-07-03) | Build + 218 tests green; manual smoke (map, routes, timeline, drag-reorder, export); one GH Pages deploy |
| M1 - Foundation | [plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md) | Shipped (2026-07-04) | Parity checklist (Req 1.7) passes on a Vercel preview |
| M2 - Auth gate | [plan_p2m2_auth-gate.md](plan_p2m2_auth-gate.md) | Shipped (2026-07-04) | Unauthenticated access fully blocked; family members sign in |
| M3 - Trip library | [plan_p2m3_trip-library.md](plan_p2m3_trip-library.md) | Shipped (2026-07-04) | 2+ trips browsable and selectable |
| M3.5 - Trip import | [plan_p2m3-5_trip-import.md](plan_p2m3-5_trip-import.md) | Shipped (2026-07-04) | Each sample file (native + 2 TripIt) imports and renders; invalid files rejected with listed errors; re-import creates an independent copy |
| M4 - Itinerary editing | [plan_p2m4_itinerary-editing.md](plan_p2m4_itinerary-editing.md) | Slice A shipped (2026-07-04) | Each slice (activities; accommodation + trip metadata; waypoints + stops) edits and persists round-trip |

Infrastructure that lands alongside milestones (see design):

- Vercel project + CI deploy pipeline: with M1, verified on preview URLs
- Production cutover + GH Pages retirement: with M2
- Maps key referrer restrictions: with hosting
- Post-cutover: final Firestore export archived, Firebase deps removed

## Changelog

- 2026-07-03: Created with M0 plan; M1-M4 plans to follow just-in-time.
- 2026-07-03: M1 plan written ahead of M0 execution on request; task detail targets the post-M0 toolchain. Plan files adopt the `plan_p2m<N>_<topic>.md` scheme.
- 2026-07-03: M2 plan written (react-router gate, Google sign-in, Vercel production cutover, GH Pages retirement).
- 2026-07-03: M3 plan written (library page, timezone-aware status, create/delete trips, last-trip restore).
- 2026-07-04: M1 shipped. Parity checklist passed on the Vercel preview (hosted Supabase, migrated data, CI deploys). Two follow-ups: enable Places API on the Vercel Maps key (POI search returns REQUEST_DENIED); cold offline start needs a service worker (parity with GH Pages holds - neither loads the shell offline).
- 2026-07-04: M4 plan written (three slices: activities CRUD with retry/offline plumbing; accommodation + trip metadata incl. additive accommodations migration; waypoints + stop restructuring with date cascade; Firebase decommission tail).
- 2026-07-04: M2 shipped. Production is https://wanderlog-xi.vercel.app (login-gated, Google + email sign-in, sign-out cache purge); GH Pages retired. Verification gate passed against production.
- 2026-07-04: M3 shipped; M3.5 (trip import) specced and planned - trip creation becomes file import (Req 3.5 amendment), slotting between M3 and M4.
- 2026-07-04: M4 Slice A (activities CRUD) shipped. Add/edit/delete with place search, optimistic persistence with retry toasts, offline editing lockout, drag-reorder re-verified under the shared mutation helper. Verified end-to-end against local Supabase; production re-check after deploy.
