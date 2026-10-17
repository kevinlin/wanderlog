# Wanderlog Spec Index

Navigation map for the Wanderlog specification docs. All specs use the `default` profile
(`<artifact>_<topic>.md`), kept flat in this folder. Each phase has one topic name: Phase 1 `travel-journal-map`, Phase 2 `supabase-auth-editing`, Phase 3 `ai-trip-agent`, Phase 4 `visit-records`, Phase 5 `trip-todos`.
Generated conventions and lint reports live under [`meta/`](meta/).

## Requirements Specifications

| Doc | Description |
|-----|-------------|
| [requirements_travel-journal-map.md](requirements_travel-journal-map.md) | Phase 1 acceptance criteria (map, timeline, activities, accommodation, weather, POI, responsive design) plus the original MVP FRS context, data schema, testing plan, and future enhancements. |
| [requirements_supabase-auth-editing.md](requirements_supabase-auth-editing.md) | Supabase migration, auth gate, trip library, itinerary editing, offline read, hosting move. |
| [requirements_ai-trip-agent.md](requirements_ai-trip-agent.md) | Agent mode: natural-language Q&A, bounded itinerary edits, generative trip creation; first server-side code. |
| [requirements_visit-records.md](requirements_visit-records.md) | Visit records: optional time, duration, and note captured on check-off; visited items ordered chronologically; agent check-off support; offline capture. |
| [requirements_trip-todos.md](requirements_trip-todos.md) | Trip todos: booking tasks with a from/by window, an always-visible active count, one trip-wide list, and Supabase REST access for Hermes, which owns reminder delivery. |

## Design Specifications

| Doc | Description |
|-----|-------------|
| [design_travel-journal-map.md](design_travel-journal-map.md) | Architecture, components, data models, services, and visual design system. |
| [design_supabase-auth-editing.md](design_supabase-auth-editing.md) | Phase 2 architecture: Supabase schema + RLS, TanStack Query data layer, auth, routing, editing UX, offline cache, Vercel hosting, milestones M0-M4. |
| [design_ai-trip-agent.md](design_ai-trip-agent.md) | Phase 3 architecture: Vercel agent endpoint, LLM tool-use loop, mirrored CRUD tool surface, NDJSON/buffered API contract, milestones M1-M3. |
| [design_visit-records.md](design_visit-records.md) | Phase 4 architecture: shared visit-stamp module, additive visit columns, planned/visited panel split, visit form, module-scope visit mutation with restart resume, trip timezone correction, agent tool fields, milestones M1-M3. |
| [design_map-markers.md](design_map-markers.md) | Map marker redesign: AdvancedMarkerElement with a Map ID and cloud style, one marker family (stop initials in the timeline color, activity glyphs in seven color families, waypoint diamonds, search discs, overview dots), the landing-gated arrival motion, and the shipping CSS. |
| [design_trip-todos.md](design_trip-todos.md) | Phase 5 architecture: `todos` table and `active_todos` view, the state rule in TS and SQL, browser-only selects that leave the agent untouched, offline fail-fast writes, the trip-local clock hook, the To do button and panel, and the Hermes REST contract. |

## Implementation Plans

| Topic | Doc | Description |
|-------|-----|-------------|
| Phase 1 | [plan_travel-journal-map.md](plan_travel-journal-map.md) | Implementation task checklist (26 tasks) with requirement references. |
| POI Search | [plan_poi-search.md](plan_poi-search.md) | Places-API POI search in the Activities Panel with map result pins. |
| Firebase Integration | [plan_firebase-integration.md](plan_firebase-integration.md) | Firestore cloud storage, dual-write pattern, offline support, and JSON→Firestore migration. |
| Phase 2 | [plan_supabase-auth-editing.md](plan_supabase-auth-editing.md) | Phase 2 plan: milestone tracker plus every milestone's plan in one file - M0 toolchain upgrade (Vite 8, Vitest 4, TS 6, Tailwind 4, Node 24 CI), M1 Supabase foundation (schema + RLS, mappers, TanStack Query, parity checklist), M2 auth gate (route guards, Google sign-in, Vercel cutover, GH Pages retirement), M3 trip library, M3.5 file-import trip creation, M4 itinerary editing (three slices; Firebase decommission). |
| Phase 3 | [plan_ai-trip-agent.md](plan_ai-trip-agent.md) | Phase 3 plan: milestone tracker plus every milestone's plan in one file - M1 agent backend + Q&A (/api/agent endpoint, JWT auth + RLS client, read-tool loop, NDJSON/buffered responses, agent button + modal), M2 bounded edits (write tools, delete guard, change-event plumbing, modal change list), M3 generative creation (geocode, create_trip over the shared bundle insert, Hermes contract), M4 design quality (critique remediation), and the post-M3 data layer deepening (shared `entityRows` + `tripWrites`). |
| Phase 4 | [plan_visit-records.md](plan_visit-records.md) | Phase 4 plan: milestone tracker plus every milestone's plan in one file - M1 data model and capture (additive visit columns, shared `visitRecord` stamp module, trip timezone correction, module-scope visit mutation with restart resume, visit-details modal, per-item containers, import/export round-trip), M2 visited section (planned/visited split with a total merged order, day-grouped visited section, id-based reorder so visited items keep their slots), M3 agent check-off (visit fields on the agent item update tools, widened item pre-read, shared stamp rule server-side, not-done guard, system-prompt clock and trip range). |
| Map markers | [plan_map-markers.md](plan_map-markers.md) | T0 design and spec review, T1 foundation (deps, palette, categories, trip-local stop status), T2 markers and the MapContainer swap, T3 docs, T4 final check; the Map ID is a release prerequisite. |
| Phase 5 | [plan_trip-todos.md](plan_trip-todos.md) | Phase 5 plan: T1 migration and local-stack gate, T2 data layer, T3 UI, T4 docs and release, T5 review, browser gate, and the migration-before-deploy release order. |

## Meta

| Doc | Description |
|-----|-------------|
| [meta/convention.md](meta/convention.md) | Local copy of the spec naming/structure convention (source of truth for lint rules). |
