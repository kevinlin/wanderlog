# Wanderlog Phase 3 - Master Plan

Milestone tracker for [design_wanderlog-phase-3.md](design_wanderlog-phase-3.md) / [requirements_phase-3.md](requirements_phase-3.md).

Detailed plans are written just-in-time, following the Phase 2 convention: each milestone's plan is authored when the previous milestone ships. Each milestone is independently shippable.

**Prerequisite:** Phase 2 M4 (itinerary editing) shipped. Phase 3 M2's write tools mirror the M4 write path; M1 consumes M4's `useOnlineStatus` hook.

| Milestone | Plan | Status | Verification gate |
|-----------|------|--------|-------------------|
| M1 - Agent backend + Q&A | [plan_p3m1_agent-backend-qa.md](plan_p3m1_agent-backend-qa.md) | Planned | Questions about seeded trips answered from modal and curl (stream + buffered); unauthenticated requests rejected with 401; no write tool exists |
| M2 - Bounded edits | [plan_p3m2_bounded-edits.md](plan_p3m2_bounded-edits.md) | Planned | Scripted edit prompts round-trip on a preview; deletes fire only on explicit request; partial failure reported honestly |
| M3 - Generative creation + programmatic contract | [plan_p3m3_generative-creation.md](plan_p3m3_generative-creation.md) | Planned | Creation prompt yields a complete rendered trip; Hermes-style curl session (password grant → buffered call) works end-to-end |

## Changelog

- 2026-07-04: Created with M1 plan; M2-M3 plans to follow just-in-time.
- 2026-07-04: M2 plan written (registry restructure + change-event plumbing, activity/waypoint/accommodation/metadata/stop write tools with zod validation and delete guard, `restructure_stops` date cascade, modal change list). M3 plan written ahead of execution (server-side `geocode` tool, shared `insertTripBundle` extraction, `create_trip` over the import pipeline, creation-sized token cap + `result.tripId`, "Open trip" navigation, Hermes contract finalization). Symbol names in both follow the M1 and Phase 2 M4 plans; verify against shipped code at execution time.
