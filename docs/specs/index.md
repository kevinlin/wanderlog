# Wanderlog Spec Index

Navigation map for the Wanderlog specification docs. All specs use the `default` profile
(`<artifact>_<topic>.md`). Generated conventions and lint reports live under [`meta/`](meta/).

## Project-level

| Doc | Description |
|-----|-------------|
| [requirements_wanderlog-phase-1.md](requirements_wanderlog-phase-1.md) | Project-level functional requirement specification (the original MVP FRS/PRD). |
| [requirements_wanderlog-phase-2.md](requirements_wanderlog-phase-2.md) | Supabase migration, auth gate, trip library, itinerary editing, offline read, hosting move. |
| [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md) | Phase 2 architecture: Supabase schema + RLS, TanStack Query data layer, auth, routing, editing UX, offline cache, Vercel hosting, milestones M0-M4. |
| [plan_wanderlog-phase-2.md](plan_wanderlog-phase-2.md) | Phase 2 master plan: milestone tracker linking per-milestone plans (written just-in-time). |
| [requirements_travel-journal.md](requirements_travel-journal.md) | Acceptance criteria for map, timeline, activities, accommodation, weather, POI, and responsive design. |
| [design_travel-journal.md](design_travel-journal.md) | Architecture, components, data models, services, and visual design system. |
| [plan_travel-journal.md](plan_travel-journal.md) | Implementation task checklist (26 tasks) with requirement references. |

## Feature-level

| Topic | Doc | Description |
|-------|-----|-------------|
| POI Search | [plan_poi-search.md](plan_poi-search.md) | Places-API POI search in the Activities Panel with map result pins. |
| Firebase Integration | [plan_firebase-integration.md](plan_firebase-integration.md) | Firestore cloud storage, dual-write pattern, offline support, and JSON→Firestore migration. |
| Toolchain Upgrade (Phase 2 M0) | [plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md) | Vite 8, Vitest 4, TypeScript 6, Tailwind 4, Ultracite 7, Node 24 CI - detailed task plan. |
| Supabase Foundation (Phase 2 M1) | [plan_p2m1_supabase-foundation.md](plan_p2m1_supabase-foundation.md) | Schema + RLS, mappers, supabaseService, migration script, TanStack Query, auth bootstrap, Vercel previews, parity checklist. |

## Meta

| Doc | Description |
|-----|-------------|
| [meta/convention.md](meta/convention.md) | Local copy of the spec naming/structure convention (source of truth for lint rules). |
