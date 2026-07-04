# Spec Lint Report — 2026-07-04

Profile(s): `default` (auto-detected; `active_profile: auto` in meta/convention.md)
Specs root: `docs/specs/`

Run after the per-phase reorganization (flat → `phase-1/` `phase-2/` `phase-3/` folders),
the Phase 1 requirements merge, and the requirements-file rename to underscore.

## Summary

- Files scanned: 20 spec (3 requirements, 3 design, 14 plan) + 1 index + 2 meta
- Errors: 0
- Warnings: 10
- Info: 4
- Auto-fixed this run: 0 (link/reference fixes were applied as the reorganization cleanup, not as lint auto-fix)

## Convention Reference

- Path: `docs/specs/meta/convention.md`
- Status: present (in sync with the skill's bundled version)
- Active profile: `default`

## Root Index / Registry

- Path: `docs/specs/index.md`
- Status: present, rewritten this run to the per-phase folder layout
- Files linked: 20 / 20 spec files (complete; all index links resolve)
- Note: the second table's heading was corrected from a duplicated "Requirements Specifications" to "Design Specifications".

## Errors

None.

- Dead links: none — every relative markdown link across `docs/specs/` and `CLAUDE.md` resolves (verified by walking each link against disk). Cross-phase links now carry `../phase-N/` prefixes. No anchor links in use.
- Index drift: none — every spec file on disk appears in the index, and every index row points at an existing file.

## Warnings

### Naming

- `design_wanderlog-phase-3.md`: topic drifts from its `phase-3/` siblings, which use the `phase-3` topic (`plan_phase-3.md`, `requirements_phase-3.md`). Suggested rename for consistency: `design_phase-3.md`. Not renamed this run (only requirements files were in scope); needs explicit confirmation before renaming (it is referenced by 4 links + 1 forward-looking plan note that would need updating together).
- `plan_p2m0_toolchain-upgrade.md` … `plan_p2m4_itinerary-editing.md`, `plan_p2m3-5_trip-import.md`, `plan_p3m1_agent-backend-qa.md` … `plan_p3m3_generative-creation.md` (9 files): two underscores (`plan_p2m<N>_<topic>`, `plan_p3m<N>_<topic>`) violate the one-underscore rule (convention §3.5). Documented as a deliberate milestone-prefix scheme in the Phase 2/3 master plans. Options: rename to `plan_p2m<N>-<topic>.md`, or codify the scheme as an allowed exception in `meta/convention.md` (§11).

## Info

### Profile detection

- Detected profile: `default` via `docs/specs/` directory and `<artifact>_<topic>.md` filenames; `README.md` and `CLAUDE.md` point at `docs/specs/` explicitly. No other profile signals present.

### Structure — resolved

- Prior report's "all specs live flat at the root" warning is resolved: specs are now folderized into `phase-1/`, `phase-2/`, `phase-3/` (one folder per phase/module), matching convention §3.1.

### Content-class mismatches (carried over)

- `phase-1/plan_firebase-integration.md`: content is a design/spec document (Overview, Architecture, Data Model, security rules) under a `plan_` name. Historical artifact of a shipped feature; consider renaming to `design_firebase-integration.md` in a batched cleanup, or leave as-is.
- `phase-1/plan_poi-search.md`: retrospective implementation summary without Goal/Tasks sections (convention expects them in plan files). Feature shipped; dismissible.

### Intentionally-retained historical references

Per an explicit "forward-looking only" decision, these bare-text (non-link) mentions of pre-reorg filenames were left as historical records and NOT rewritten:

- `phase-2/plan_p2m2_auth-gate.md:60`, `phase-2/plan_p2m3_trip-library.md:48`, `phase-2/plan_p2m3-5_trip-import.md:46`, `phase-2/plan_p2m4_itinerary-editing.md:319,322,477,586,603`: verification prose and `git add` snippets naming `plan_wanderlog-phase-2.md` — records of already-shipped milestones.
- `phase-1/plan_poi-search.md:53-55,66-68`: retrospective "files modified" list naming the old flat `*_travel-journal.md` paths.

These are not clickable links, so they do not affect navigation. Fix in a future pass if full textual consistency is wanted.

## Reverse Consistency

Unchanged from prior audit (Phase 1 and Phase 2 shipped; Phase 3 planned):

- `phase-2/design_phase-2.md` ↔ `phase-2/requirements_phase-2.md`: all requirement groups covered. No gaps.
- Phase 2 plans ↔ `phase-2/design_phase-2.md`: milestones M0–M4 (+M3.5) each have a plan covering their design slice.
- `phase-1/design_phase-1.md` ↔ `phase-1/requirements_phase-1.md`: section-level coverage holds after the merge (map, timeline, activities, accommodation, images, persistence/export, weather, responsive/mobile, error handling, performance, visual design, POI, deployment). Phase 1 shipped.
- `phase-3/design_wanderlog-phase-3.md` ↔ `phase-3/requirements_phase-3.md`: covered per prior Phase 3 design review; milestones M1–M3 planned.

## Reorganization Cleanup Applied This Run

- Merged `requirements_travel-journal.md` + `requirements-phase-1.md` → `phase-1/requirements_phase-1.md` (EARS criteria 1–15 kept as the body; FRS overview, data schema, testing plan, and future enhancements appended).
- Renamed `phase-2/requirements-phase-2.md` → `requirements_phase-2.md`, `phase-3/requirements-phase-3.md` → `requirements_phase-3.md` (underscore convention).
- Rewrote `index.md` to the per-phase paths; fixed the duplicated table heading.
- Repointed all cross-doc markdown links to the new paths (renamed topics + `../phase-N/` cross-phase prefixes).
- Fixed 2 references in `CLAUDE.md`.
- Updated forward-looking Phase 3 plan instructions (p3m1/p3m2/p3m3) to the new paths.
