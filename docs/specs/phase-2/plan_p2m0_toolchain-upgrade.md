# Toolchain Upgrade (Phase 2, M0) Implementation Plan

**Goal:** Upgrade all frontend frameworks and toolchain to latest stable before any Phase 2 feature work, keeping the app pixel-identical and all 218 tests green.

**Architecture:** No production code changes intended; this was a dependency and config migration. Each cluster was bumped and committed separately so regressions bisect to one commit. Verification was the existing test suite plus a manual smoke of the running app.

**Tech Stack:** pnpm, Vite 8, Vitest 4, React 19.2, TypeScript 6, Tailwind CSS 4, Ultracite 7 / Biome 2.5, Node 24 LTS (CI).

Context: [design_phase-2.md](design_phase-2.md), [requirements_phase-2.md](requirements_phase-2.md); milestone tracker: [plan_phase-2.md](plan_phase-2.md).

## Global Constraints

- Package manager: pnpm. Never edit `pnpm-lock.yaml` by hand.
- `firebase` stayed at `^12.6.0` - excluded from all upgrades (decommissioned within Phase 2).
- Version numbers were latest stable as of 2026-07-03; upgrades stayed within the planned majors.
- One commit per task, conventional-commit style (`chore: ...`).
- No refactoring or reformatting of app code beyond what an upgrade forced (Ultracite task excepted - its job is formatting).
- GH Pages was still the live host during M0; `base: '/wanderlog/'` in `vite.config.ts` stayed.

---

### Task 1: Baseline + minor/patch sweep

Recorded the green baseline (218 tests, clean build), then bumped all minor/patch dependencies with majors and firebase excluded. `@types/node` stays on major 24 deliberately - it matches the Node 24 LTS runtime, not the newest types major.

### Task 2: Vite 8 + Vitest 4 cluster

Bumped Vite 8, plugin-react 6, Vitest 4 (+ coverage and UI companions), and jsdom 29 together in one commit: Vitest 3's Vite peer range tops out at 7, so bumping Vite alone leaves a broken peer graph. No config changes were needed; two test files were updated for Vitest 4's constructor-mock behavior, and the CI junit reporter flags were unchanged.

### Task 3: TypeScript 6

Bumped to TypeScript 6. Fixes were config-level only: removed the deprecated `baseUrl` and added `"types": ["node"]` to both tsconfigs since TS 6 defaults `types` to `[]`.

### Task 4: Tailwind CSS 4

Ran the official `@tailwindcss/upgrade` tool: `@tailwind` directives became `@import "tailwindcss"`, the four travel-theme colors and the Inter font stack moved into a `@theme` block in `src/index.css`, `tailwind.config.js` was deleted, and the PostCSS config switched to `@tailwindcss/postcss` (autoprefixer is built into v4). The never-registered `@tailwindcss/typography` plugin was removed rather than migrated. Verified visually against production side by side.

### Task 5: Ultracite 7 + Biome 2.5, retire stale eslint remnants

Bumped Ultracite 7 / Biome 2.5: presets renamed to `ultracite/biome/core` + `ultracite/biome/react`, four nursery rules moved to their promoted groups, and `style/noSubstr` was disabled instead of rewriting app code. Fixed the broken `lint` script (it called eslint, which was never installed) to `ultracite check` and removed the orphaned `globals` package.

### Task 6: CI on Node 24 LTS + deploy verification

Bumped the deploy workflow's Node version from 22 to 24. Push triggers are disabled in `deploy.yml`, so the verification run was dispatched manually via `gh workflow run`; build, tests, junit report, and GH Pages deploy all succeeded on Node 24.

### Task 7: Final M0 verification gate

Full local verification plus the manual smoke checklist on the deployed site (map pins, route polyline, timeline navigation, drag-reorder and done-toggle surviving refresh, export, POI search, no new console errors). Marked M0 shipped in [plan_phase-2.md](plan_phase-2.md).

---

## Critical Files — Summary

| File | Change |
|---|---|
| `package.json`, `pnpm-lock.yaml` | All dependency bumps; `lint` script fixed to `ultracite check` |
| `tsconfig.app.json`, `tsconfig.node.json` | TS 6: dropped `baseUrl`, added `"types": ["node"]` |
| `src/index.css` | Tailwind 4 CSS-first config: `@theme` block with the four travel colors + Inter stack |
| `postcss.config.js` | Switched to `@tailwindcss/postcss`; autoprefixer dropped |
| `biome.jsonc` | Ultracite 7 preset names; nursery rules re-homed; `style/noSubstr` disabled |
| `.github/workflows/deploy.yml` | Node 24 |

Deleted: `tailwind.config.js` (replaced by the CSS-first `@theme` config).

## Self-Review Notes

- Task ordering is risk-ascending: reversible dependency bumps before config-migrating ones (Tailwind), formatting last so no other task's diff is polluted by it.
- Vite/Vitest merged into one task because of the peer-dependency coupling; the design doc's table listed them as separate rows, superseded here.
- No TDD cycle: there is no new behavior to test-drive. The 218-test suite is the regression harness; every task ends on it.

## Changelog

- 2026-07-04: **Compacted post-implementation.** Removed step-by-step task bodies, code snippets, and verification command lists now that M0 has shipped. Preserved Goal, Global Constraints, per-task intents, Critical Files summary, and Self-Review Notes. Original plan is recoverable via git history.
- 2026-07-03: Initial plan.
