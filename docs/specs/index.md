# Wanderlog Spec Index

Navigation map for the Wanderlog specification docs. All specs use the `default` profile
(`<artifact>_<topic>.md`). Generated conventions and lint reports live under [`meta/`](meta/).

## Project-level

| Doc | Description |
|-----|-------------|
| [requirements_wanderlog-phase-1.md](requirements_wanderlog-phase-1.md) | Project-level functional requirement specification (the original MVP FRS/PRD). |
| [requirements_wanderlog-phase-2.md](requirements_wanderlog-phase-2.md) | Supabase migration, auth gate, trip library, itinerary editing, offline read, hosting move. Design/plan not yet written. |
| [requirements_travel-journal.md](requirements_travel-journal.md) | Acceptance criteria for map, timeline, activities, accommodation, weather, POI, and responsive design. |
| [design_travel-journal.md](design_travel-journal.md) | Architecture, components, data models, services, and visual design system. |
| [plan_travel-journal.md](plan_travel-journal.md) | Implementation task checklist (26 tasks) with requirement references. |

## Feature-level

| Topic | Doc | Description |
|-------|-----|-------------|
| POI Search | [plan_poi-search.md](plan_poi-search.md) | Places-API POI search in the Activities Panel with map result pins. |
| Firebase Integration | [plan_firebase-integration.md](plan_firebase-integration.md) | Firestore cloud storage, dual-write pattern, offline support, and JSON→Firestore migration. |

## Meta

| Doc | Description |
|-----|-------------|
| [meta/convention.md](meta/convention.md) | Local copy of the spec naming/structure convention (source of truth for lint rules). |
