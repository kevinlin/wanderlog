# Wanderlog Spec Index

Navigation map for the Wanderlog specification docs. All specs use the `default` profile
(`<artifact>_<topic>.md`). Generated conventions and lint reports live under [`meta/`](meta/).

## Requirements Specifications

| Doc | Description |
|-----|-------------|
| [requirements_wanderlog-phase-1.md](requirements_wanderlog-phase-1.md) | Project-level functional requirement specification (the original MVP FRS/PRD). |
| [requirements_travel-journal.md](requirements_travel-journal.md) | Acceptance criteria for map, timeline, activities, accommodation, weather, POI, and responsive design. |
| [requirements_wanderlog-phase-2.md](requirements_wanderlog-phase-2.md) | Supabase migration, auth gate, trip library, itinerary editing, offline read, hosting move. |
| [requirements_wanderlog-phase-3.md](requirements_wanderlog-phase-3.md) | Agent mode: natural-language Q&A, bounded itinerary edits, generative trip creation; first server-side code. |

## Requirements Specifications

| Doc | Description |
|-----|-------------|
| [design_travel-journal.md](design_travel-journal.md) | Architecture, components, data models, services, and visual design system. |
| [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md) | Phase 2 architecture: Supabase schema + RLS, TanStack Query data layer, auth, routing, editing UX, offline cache, Vercel hosting, milestones M0-M4. |
| [design_wanderlog-phase-3.md](design_wanderlog-phase-3.md) | Phase 3 architecture: Vercel agent endpoint, LLM tool-use loop, mirrored CRUD tool surface, NDJSON/buffered API contract, milestones M1-M3. |


## Implementation Plans

| Topic | Doc | Description |
|-------|-----|-------------|
| Phase 1 | [plan_travel-journal.md](plan_travel-journal.md) | Implementation task checklist (26 tasks) with requirement references. |
| POI Search | [plan_poi-search.md](plan_poi-search.md) | Places-API POI search in the Activities Panel with map result pins. |
| Firebase Integration | [plan_firebase-integration.md](plan_firebase-integration.md) | Firestore cloud storage, dual-write pattern, offline support, and JSON→Firestore migration. |
| Phase 2 | [plan_wanderlog-phase-2.md](plan_wanderlog-phase-2.md) | Phase 2 master plan: milestone tracker linking per-milestone plans (written just-in-time). |
| Toolchain Upgrade (Phase 2 M0) | [plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md) | Vite 8, Vitest 4, TypeScript 6, Tailwind 4, Ultracite 7, Node 24 CI - detailed task plan. |
| Supabase Foundation (Phase 2 M1) | [plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md) | Schema + RLS, mappers, supabaseService, migration script, TanStack Query, auth bootstrap, Vercel previews, parity checklist. |
| Auth Gate (Phase 2 M2) | [plan_p2m2_auth-gate.md](plan_p2m2_auth-gate.md) | react-router route guards, login polish, Google sign-in (PKCE), sign-out cache purge, Vercel production cutover, GH Pages retirement. |
| Trip Library (Phase 2 M3) | [plan_p2m3_trip-library.md](plan_p2m3_trip-library.md) | Library page with timezone-aware status, hero trip, create/delete trips, last-trip restore, empty-trip hardening. |
| Trip Import (Phase 2 M3.5) | [plan_p2m3-5_trip-import.md](plan_p2m3-5_trip-import.md) | File-import trip creation: drag-n-drop JSON, zod validation with error list, TripIt conversion with geocoding, fresh-id inserts with compensation delete. |
| Itinerary Editing (Phase 2 M4) | [plan_p2m4_itinerary-editing.md](plan_p2m4_itinerary-editing.md) | Three slices: activities CRUD + retry/offline, accommodation + trip metadata, waypoints + stop restructuring with date cascade; Firebase decommission. |
| Phase 3 | [plan_wanderlog-phase-3.md](plan_wanderlog-phase-3.md) | Phase 3 master plan: milestone tracker linking per-milestone plans (written just-in-time). |
| Agent Backend + Q&A (Phase 3 M1) | [plan_p3m1_agent-backend-qa.md](plan_p3m1_agent-backend-qa.md) | Vercel /api/agent endpoint: JWT auth + RLS client, read-tool loop (@anthropic-ai/sdk), NDJSON/buffered responses, agent button + modal. |

## Meta

| Doc | Description |
|-----|-------------|
| [meta/convention.md](meta/convention.md) | Local copy of the spec naming/structure convention (source of truth for lint rules). |
