# Wanderlog Spec Index

Navigation map for the Wanderlog specification docs. All specs use the `default` profile
(`<artifact>_<topic>.md`), organized into per-phase folders (`phase-1/`, `phase-2/`, `phase-3/`, `phase-4/`).
Generated conventions and lint reports live under [`meta/`](meta/).

## Requirements Specifications

| Doc | Description |
|-----|-------------|
| [phase-1/requirements_phase-1.md](phase-1/requirements_phase-1.md) | Phase 1 acceptance criteria (map, timeline, activities, accommodation, weather, POI, responsive design) plus the original MVP FRS context, data schema, testing plan, and future enhancements. |
| [phase-2/requirements_phase-2.md](phase-2/requirements_phase-2.md) | Supabase migration, auth gate, trip library, itinerary editing, offline read, hosting move. |
| [phase-3/requirements_phase-3.md](phase-3/requirements_phase-3.md) | Agent mode: natural-language Q&A, bounded itinerary edits, generative trip creation; first server-side code. |
| [phase-4/requirements_phase-4.md](phase-4/requirements_phase-4.md) | Visit records: optional time, duration, and note captured on check-off; visited items ordered chronologically; agent check-off support; offline capture. |

## Design Specifications

| Doc | Description |
|-----|-------------|
| [phase-1/design_phase-1.md](phase-1/design_phase-1.md) | Architecture, components, data models, services, and visual design system. |
| [phase-2/design_phase-2.md](phase-2/design_phase-2.md) | Phase 2 architecture: Supabase schema + RLS, TanStack Query data layer, auth, routing, editing UX, offline cache, Vercel hosting, milestones M0-M4. |
| [phase-3/design_wanderlog-phase-3.md](phase-3/design_wanderlog-phase-3.md) | Phase 3 architecture: Vercel agent endpoint, LLM tool-use loop, mirrored CRUD tool surface, NDJSON/buffered API contract, milestones M1-M3. |
| [phase-4/design_phase-4.md](phase-4/design_phase-4.md) | Phase 4 architecture: shared visit-stamp module, additive visit columns, planned/visited panel split, visit form, module-scope visit mutation with restart resume, trip timezone correction, agent tool fields, milestones M1-M3. |

## Implementation Plans

| Topic | Doc | Description |
|-------|-----|-------------|
| Phase 1 | [phase-1/plan_phase-1.md](phase-1/plan_phase-1.md) | Implementation task checklist (26 tasks) with requirement references. |
| POI Search | [phase-1/plan_poi-search.md](phase-1/plan_poi-search.md) | Places-API POI search in the Activities Panel with map result pins. |
| Firebase Integration | [phase-1/plan_firebase-integration.md](phase-1/plan_firebase-integration.md) | Firestore cloud storage, dual-write pattern, offline support, and JSON→Firestore migration. |
| Phase 2 | [phase-2/plan_phase-2.md](phase-2/plan_phase-2.md) | Phase 2 plan: milestone tracker plus every milestone's plan in one file - M0 toolchain upgrade (Vite 8, Vitest 4, TS 6, Tailwind 4, Node 24 CI), M1 Supabase foundation (schema + RLS, mappers, TanStack Query, parity checklist), M2 auth gate (route guards, Google sign-in, Vercel cutover, GH Pages retirement), M3 trip library, M3.5 file-import trip creation, M4 itinerary editing (three slices; Firebase decommission). |
| Phase 3 | [phase-3/plan_phase-3.md](phase-3/plan_phase-3.md) | Phase 3 plan: milestone tracker plus every milestone's plan in one file - M1 agent backend + Q&A (/api/agent endpoint, JWT auth + RLS client, read-tool loop, NDJSON/buffered responses, agent button + modal), M2 bounded edits (write tools, delete guard, change-event plumbing, modal change list), M3 generative creation (geocode, create_trip over the shared bundle insert, Hermes contract), M4 design quality (critique remediation), and the post-M3 data layer deepening (shared `entityRows` + `tripWrites`). |
| Phase 4 | [phase-4/plan_phase-4.md](phase-4/plan_phase-4.md) | Phase 4 plan: milestone tracker plus every milestone's plan in one file - M1 data model and capture (additive visit columns, shared `visitRecord` stamp module, trip timezone correction, module-scope visit mutation with restart resume, visit-details modal, per-item containers, import/export round-trip), M2 visited section (planned/visited split with a total merged order, day-grouped visited section, id-based reorder so visited items keep their slots), M3 agent check-off (visit fields on the agent item update tools, widened item pre-read, shared stamp rule server-side, not-done guard, system-prompt clock and trip range). |

## Meta

| Doc | Description |
|-----|-------------|
| [meta/convention.md](meta/convention.md) | Local copy of the spec naming/structure convention (source of truth for lint rules). |
