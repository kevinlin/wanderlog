# Wanderlog Phase 3 - Master Plan

Milestone tracker for [design_wanderlog-phase-3.md](design_wanderlog-phase-3.md) / [requirements_phase-3.md](requirements_phase-3.md).

Detailed plans are written just-in-time, following the Phase 2 convention: each milestone's plan is authored when the previous milestone ships. Each milestone is independently shippable.

**Prerequisite:** Phase 2 M4 (itinerary editing) shipped. Phase 3 M2's write tools mirror the M4 write path; M1 consumes M4's `useOnlineStatus` hook.

| Milestone | Plan | Status | Verification gate |
|-----------|------|--------|-------------------|
| M1 - Agent backend + Q&A | [plan_p3m1_agent-backend-qa.md](plan_p3m1_agent-backend-qa.md) | Shipped (2026-07-04) | Questions about seeded trips answered from modal and curl (stream + buffered); unauthenticated requests rejected with 401; no write tool exists |
| M2 - Bounded edits | [plan_p3m2_bounded-edits.md](plan_p3m2_bounded-edits.md) | Shipped (2026-07-04) | Scripted edit prompts round-trip on a preview; deletes fire only on explicit request; partial failure reported honestly |
| M3 - Generative creation + programmatic contract | [plan_p3m3_generative-creation.md](plan_p3m3_generative-creation.md) | Shipped (2026-07-04) | Creation prompt yields a complete rendered trip; Hermes-style curl session (password grant → buffered call) works end-to-end |
| M4 - Design quality: critique remediation | [plan_p3m4_design-quality.md](plan_p3m4_design-quality.md) | In Progress | Trip page critique score ≥ 32/40; all P1 issues resolved; `pnpm test:run` + `pnpm build` clean |

## Changelog

- 2026-07-04: M3 shipped - `geocode` + `create_trip` tools over the shared `insertTripBundle` pipeline, creation-sized token cap with truncation error, `result.tripId` + "Open trip" navigation, Hermes contract finalized. Verified on production: buffered Hermes curl session (password grant with the provisioned `hermes@wanderlog.local` account) created a complete 5-day Tokyo trip (tripId set, change event emitted, all stops geocoded); Atlantis negative test produced no trip and no errors; 400/401/405 pre-model status codes confirmed; in-app run rendered the trip with map pins, timeline, and activities. Phase 3 complete.
- 2026-07-04: M2 shipped - twelve agent write tools (activities, waypoints, accommodation, trip metadata, stops incl. `restructure_stops` date cascade) with zod validation, delete guard, per-write change events, and the modal change list; verified on preview and production (scripted edits, delete-guard, honest partial failure).
- 2026-07-04: M1 shipped - `/api/agent` (read-only tool loop, NDJSON stream + buffered mode) with agent modal on library and trip pages; verified on preview and production via curl and browser.
- 2026-07-04: Created with M1 plan; M2-M3 plans to follow just-in-time.
- 2026-07-04: M2 plan written (registry restructure + change-event plumbing, activity/waypoint/accommodation/metadata/stop write tools with zod validation and delete guard, `restructure_stops` date cascade, modal change list). M3 plan written ahead of execution (server-side `geocode` tool, shared `insertTripBundle` extraction, `create_trip` over the import pipeline, creation-sized token cap + `result.tripId`, "Open trip" navigation, Hermes contract finalization). Symbol names in both follow the M1 and Phase 2 M4 plans; verify against shipped code at execution time.
