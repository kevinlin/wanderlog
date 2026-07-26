# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wanderlog is a map-based travel journal: plan trips, then track them as you go. React 19 + TypeScript + Vite SPA, **Supabase** (Postgres + Auth + RLS) as the backend, **TanStack Query** as the data layer, and one Vercel serverless function (`api/agent.ts`) running an Anthropic tool-use loop for the AI agent.

[docs/architecture/architecture.md](docs/architecture/architecture.md) is the as-built architecture reference (5 diagrams: system context, runtime, frontend, data, agent). Read it before non-trivial changes; this file only carries the rules you must not break.

## Commands

```bash
pnpm dev              # Vite dev server (http://localhost:5173) — does NOT serve api/
pnpm build            # tsc -b + Vite production build
pnpm test             # Vitest (covers both src/ and api/)
pnpm test:run         # single run, CI mode
pnpm test:coverage    # coverage report
pnpm lint             # ultracite check
npx ultracite fix     # auto-fix formatting + lint
pnpm migrate:supabase # import local/trip-data/*.json into Supabase (service-role key)
```

Single test file: `pnpm vitest run src/path/to/file.test.ts`

`api/` is not served by Vite — the agent endpoint needs the Vercel runtime (`vercel dev` or a preview deploy).

Husky pre-commit runs the **full test suite** and then formats fully-staged files with Ultracite; partially staged files are skipped with a warning.

## Invariants

Break these and things fail in non-obvious ways.

**1. Server state in TanStack Query, UI state in a Context reducer.** Trip and weather data are never copied into React state — read them from the query cache. `src/lib/queryClient.ts` centralizes the keys (`tripKeys.all`, `tripKeys.detail(id)`, `weatherKeys.base(id)`). Read hooks (`useTrips`, `useTripData`, `useWeather`) are gated on an auth session. `AppStateContext` holds only `currentBase`, `currentTripId`, `selectedActivity`, `poiModal`, `poiSearch`.

**2. Writes go through `useTripCacheMutation`.** It owns the optimistic pattern: cancel in-flight reads → snapshot → patch a `structuredClone` → roll back with a retry toast on error → invalidate on settle. `useTripMutations` / `useTripLibraryMutations` compose it. New writes follow the same route, not raw `useMutation`.

**3. Persisted cache: `gcTime` ≥ `PERSIST_MAX_AGE_MS` (30 days)** or the IndexedDB cache is dropped on restore. Bump the `buster` string in `main.tsx` on any breaking cache-shape change. Sign-out purges the cache (`clearPersistedCache`).

**4. Supabase access boundary.** `src/config/supabase.ts` creates the browser client; `supabaseService` is the browser's only data-access entry point (a thin adapter binding that client to the shared write modules). Rows ↔ domain types only via `supabaseMappers` (`TRIP_SELECT` pulls the whole trip tree in one nested select; `TRIP_SUMMARY_SELECT` for the library list).

**5. Modules shared between `src/` and `api/` obey Node ESM rules.** The Vercel function runtime resolves neither `@/` aliases nor extensionless specifiers, so any module reachable from `api/` uses **relative imports with explicit `.js` extensions**, takes an injected `SupabaseClient` instead of importing the browser singleton, and imports `supabase-js` types only. Currently shared: `entityRows`, `tripWrites`, `tripBundleInsert`, `supabaseMappers`, `tripImportService`, `schemas/*`, `types/*`. Adding an `@/` import to one of these breaks the deployed function, not the build.

**6. The agent mirrors the client's CRUD surface, under the caller's RLS.** `api/agent.ts` verifies the bearer JWT, builds an RLS-scoped client from it, prefetches trip context into the system prompt, then runs `runAgentLoop` (16-iteration cap, stops on `max_tokens` because truncated `tool_use` blocks are unsafe to execute). Tools live in `api/_lib/tools/` and register via `buildAgentTools`. `create_trip` reuses the same `insertTripBundle` pipeline as file import, so agent-created and imported trips are structurally identical. Responses stream NDJSON (`progress` / `change` / `error` / `result`, one JSON per line); `Accept: application/json` gets a buffered result. Event types are shared in [src/types/agent.ts](src/types/agent.ts) — change both ends together. There is no undo; `AgentModal` invalidates the affected query keys and shows the change list.

## Data Model

`trip` → ordered `stops` → each with at most one `accommodation` plus many `activities` and `scenic_waypoints`. Deletes cascade down the tree. `is_done` is a canonical column shared by all users (no per-user modification concept). Schema and RLS live in `supabase/migrations/*.sql` (Supabase CLI).

Domain types in [src/types/trip.ts](src/types/trip.ts): `TripData` (holds `stops: TripBase[]`), `TripBase`, `Activity`, `TripSummary` (library row). Import-file shapes are zod schemas in [src/schemas/](src/schemas/) (Wanderlog export + TripIt), converted by `tripImportService`.

## Routing

react-router in [src/App.tsx](src/App.tsx), pages in [src/pages/](src/pages/). Everything except `/login`, `/forgot-password`, `/reset-password` is wrapped in `ProtectedRoute`. `vercel.json` rewrites all non-`/api/` paths to `index.html`.

## Conventions

- Path alias `@/*` → `./src/*`, declared in both `tsconfig.app.json` and `vitest.config.ts` (and unusable in shared `api/` modules — see invariant 5).
- Ultracite (Biome) owns formatting and lint; `tsconfig` is strict with `noUnusedLocals`/`noUnusedParameters`. Don't hand-format.
- No JSDoc. Comments explain *why* (see the existing ones in `api/_lib/loop.ts`, `entityRows.ts`), not what.
- Tailwind 4; colors and type scale come from [DESIGN.md](DESIGN.md) tokens, not ad-hoc hex values.
- Barrel `index.ts` exports per component folder.
- Never create git worktrees inside `.claude/` (or any subdirectory of it). Put them under `.worktrees/`.

## Environment Variables

`.env.local` for local dev (see `.env.local.example`). Client-visible (`VITE_*`): `VITE_GOOGLE_MAPS_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Server-only, never in the client bundle: `SUPABASE_SERVICE_ROLE_KEY` (migration script), `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` / `ANTHROPIC_MODEL` and `GOOGLE_GEOCODING_API_KEY` (agent function; the geocoding key is a separate server key, not the referrer-restricted browser Maps key).

## Deployment

Vercel. Push to `main` → test-gated production deploy; PRs get previews (`.github/workflows/vercel-deploy.yml`, Node 24, pnpm 10). Needs `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets. `api/agent.ts` runs with `maxDuration: 300`.

## Specs and Design Context

Spec docs live in `docs/specs/` as `<artifact>_<topic>.md` (requirements / design / plan), one folder per phase. Start at [docs/specs/index.md](docs/specs/index.md); [docs/specs/meta/convention.md](docs/specs/meta/convention.md) is the naming source of truth. Phase 1 = map/timeline/activities, Phase 2 = Supabase + auth + editing, Phase 3 = the agent.

Before any UI work read [PRODUCT.md](PRODUCT.md) (register, users, positioning) and [DESIGN.md](DESIGN.md) (visual system). Register: product (a working tool), web, mobile-first. Positioning: a living plan you track as you go, not a static itinerary doc. Principles: the plan is alive; delight in the moments, restraint in the frame; desk and phone as equals; shared and trustworthy; show the trip, not a form.
