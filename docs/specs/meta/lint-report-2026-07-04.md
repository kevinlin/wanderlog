# Spec Lint Report — 2026-07-04

Profile(s): `default` (auto-detected; `active_profile: auto` in meta/convention.md)
Specs root: `docs/specs/`

## Summary

- Files scanned: 15 (3 requirements, 2 design, 9 plan, 1 index) + 1 meta
- Errors: 0
- Warnings: 6
- Info: 5
- Auto-fixed: 0 (no safe auto-fixes applicable)

## Convention Reference

- Path: `docs/specs/meta/convention.md`
- Status: present (in sync with the skill's bundled version)
- Active profile: `default`

## Root Index / Registry

- Path: `docs/specs/index.md`
- Status: present
- Files linked: 15 / 15 spec files (complete; all index links resolve)

## Errors

None.

- Dead links: none — all relative links across the tree resolve; no anchor links in use.
- Index drift: none — every spec file on disk appears in the index, and every index row points at an existing file.

## Warnings

### Naming

- `plan_p2m0_toolchain-upgrade.md`: two underscores (`plan_p2m0_toolchain-upgrade`) violates the one-underscore rule (convention.md §3.5, "underscore inside the topic"). The `plan_p2m<N>_<topic>.md` scheme is documented as deliberate in `plan_wanderlog-phase-2.md`'s changelog. Options: rename to `plan_p2m0-toolchain-upgrade.md`, or codify the scheme as an allowed exception in `meta/convention.md` (§11 customization).
- `plan_p2m1_supabase-foundation.md`: same rule, same options.
- `plan_p2m2_auth-gate.md`: same rule, same options.
- `plan_p2m3_trip-library.md`: same rule, same options.
- `plan_p2m4_itinerary-editing.md`: same rule, same options.

### Structure

- All specs live flat at the root; convention §3.1 expects one folder per module/feature (e.g. `travel-journal/`, `wanderlog-phase-2/`). The index's Project-level / Feature-level grouping compensates at the current tree size (14 files), but folderizing (or codifying the flat layout in `meta/convention.md`) would resolve the drift.

## Info

### Profile detection

- Detected profile: `default` via `docs/specs/` directory and `<artifact>_<topic>.md` filenames; `README.md` and `CLAUDE.md` both point at `docs/specs/` explicitly. No other profile signals present.

### Naming — likely-intentional phase suffixes

- `requirements_wanderlog-phase-1.md`, `requirements_wanderlog-phase-2.md`, `design_wanderlog-phase-2.md`, `plan_wanderlog-phase-2.md`: the anti-pattern table flags phase markers in filenames, but here each phase is a genuinely separate spec set (Phase 2 has its own requirements/design/plan chain), so the names carry real meaning. Dismissible; codify in `meta/convention.md` if desired.

### Content-class mismatches

- `plan_firebase-integration.md`: content is a design/spec document (Overview, Architecture, Data Model, security rules) under a `plan_` name. Historical artifact of a shipped feature; consider renaming to `design_firebase-integration.md` in a batched cleanup, or leave as-is.
- `plan_poi-search.md`: retrospective implementation summary without Goal/Tasks sections (convention §5.6 expects them in plan files). Feature shipped; dismissible.

## Reverse Consistency

- `design_wanderlog-phase-2.md` ↔ `requirements_wanderlog-phase-2.md`: all 8 requirement groups covered (schema/migration → Req 1, 8; Authentication → Req 2; Trip Library → Req 3; Itinerary Editing → Req 4; Offline → Req 5; Hosting and CI → Req 6; Maps key referrer restrictions + amendment note → Req 7). No gaps.
- Plans ↔ `design_wanderlog-phase-2.md`: milestones M0–M4 each have a plan covering their design slice (M0 toolchain, M1 schema/data layer/auth bootstrap/migration/hosting previews, M2 auth + cutover, M3 trip library, M4 itinerary editing in three slices per Req 4).
- `design_travel-journal.md` ↔ `requirements_travel-journal.md`: section-level spot check passes (map, timeline, activities, accommodation, images, persistence/export, weather, responsive/mobile, error handling, performance, visual design, POI, deployment all have design sections). Phase 1 shipped; no deeper audit performed.
