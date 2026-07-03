# Wanderlog Phase 2 - Master Plan

Milestone tracker for [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md) / [requirements_wanderlog-phase-2.md](requirements_wanderlog-phase-2.md).

Detailed plans are written just-in-time: each milestone's plan is authored when the previous milestone ships, so task detail reflects the real code shape rather than speculation. Each milestone is independently shippable.

| Milestone | Plan | Status | Verification gate |
|-----------|------|--------|-------------------|
| M0 - Toolchain | [plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md) | Shipped (2026-07-03) | Build + 218 tests green; manual smoke (map, routes, timeline, drag-reorder, export); one GH Pages deploy |
| M1 - Foundation | [plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md) | Planned, pending M0 | Parity checklist (Req 1.7) passes on a Vercel preview |
| M2 - Auth gate | plan_p2m2_auth-gate.md (not yet written) | Pending M1 | Unauthenticated access fully blocked; family members sign in |
| M3 - Trip library | plan_p2m3_trip-library.md (not yet written) | Pending M2 | 2+ trips browsable and selectable |
| M4 - Itinerary editing | plan_p2m4_itinerary-editing.md (not yet written) | Pending M3 | Each slice (activities; accommodation + trip metadata; waypoints + stops) edits and persists round-trip |

Infrastructure that lands alongside milestones (see design):

- Vercel project + CI deploy pipeline: with M1, verified on preview URLs
- Production cutover + GH Pages retirement: with M2
- Maps key referrer restrictions: with hosting
- Post-cutover: final Firestore export archived, Firebase deps removed

## Changelog

- 2026-07-03: Created with M0 plan; M1-M4 plans to follow just-in-time.
- 2026-07-03: M1 plan written ahead of M0 execution on request; task detail targets the post-M0 toolchain. Plan files adopt the `plan_p2m<N>_<topic>.md` scheme.
