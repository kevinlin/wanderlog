# Toolchain Upgrade (Phase 2, M0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all frontend frameworks and toolchain to latest stable before any Phase 2 feature work, keeping the app pixel-identical and all 218 tests green.

**Architecture:** No production code changes intended; this is a dependency and config migration. Each cluster is bumped and committed separately so regressions bisect to one commit. Verification is the existing test suite plus a manual smoke of the running app.

**Tech Stack:** pnpm, Vite 8, Vitest 4, React 19.2, TypeScript 6, Tailwind CSS 4, Ultracite 7 / Biome 2.5, Node 24 LTS (CI).

## Global Constraints

- Package manager: pnpm. Never edit `pnpm-lock.yaml` by hand.
- `firebase` stays at `^12.6.0` - excluded from all upgrades (decommissioned within Phase 2).
- Version numbers below are latest stable as of 2026-07-03. At execution time take the latest within the same major; do not cross into a newer major than planned.
- After every task: `pnpm test:run` shows `Tests  218 passed`, `pnpm build` exits 0.
- One commit per task, conventional-commit style (`chore: ...`).
- Do not refactor or reformat app code beyond what an upgrade forces (Ultracite task excepted - its job is formatting).
- GH Pages is still the live host during M0; `base: '/wanderlog/'` in `vite.config.ts` stays.

---

### Task 1: Baseline + minor/patch sweep

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Consumes: current green baseline (218 tests, clean build).
- Produces: same baseline on latest in-major minors; the reference point for every later task.

- [x] **Step 1: Record the baseline**

```bash
pnpm install
pnpm test:run
pnpm build
```

Expected: `Tests  218 passed (218)`, build exits 0. If either fails, stop - fix the baseline before upgrading anything.

- [x] **Step 2: Bump minors/patches (majors and firebase excluded)**

```bash
pnpm add react@^19.2.7 react-dom@^19.2.7 date-fns@^4.4.0 @react-google-maps/api@^2.20.8
pnpm add -D @types/react@^19.2.17 @types/react-dom@^19.2.3 \
  @testing-library/react@^16.3.2 @testing-library/jest-dom@^6.9.1 \
  postcss@^8.5.16 tsx@^4.22.5 @types/node@^24
```

`@types/node` stays on major 24 deliberately - it matches the Node 24 LTS runtime (Task 6), not the newest types major.

- [x] **Step 3: Verify**

```bash
pnpm test:run && pnpm build
```

Expected: 218 passed, build exits 0.

- [x] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: bump minor and patch dependencies"
```

---

### Task 2: Vite 8 + Vitest 4 cluster

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify (if migration guides require): `vite.config.ts`, `vitest.config.ts`

**Interfaces:**
- Consumes: Task 1 baseline.
- Produces: green build/test on Vite 8, Vitest 4, plugin-react 6, jsdom 29.

Vite and Vitest bump together in one commit: Vitest 3 declares a Vite peer range that tops out at 7, so bumping Vite alone leaves a broken peer graph. jsdom and the Vitest companion packages ride along because they version-lock to Vitest.

- [x] **Step 1: Read the migration guides for breaking changes**

Check https://vite.dev/guide/migration and https://vitest.dev/guide/migration for changes affecting this repo's configs (shown in full below - they are small):

- `vite.config.ts`: `plugins: [react()]`, `base: '/wanderlog/'`, `@` alias, one `define` entry.
- `vitest.config.ts`: jsdom environment, `globals: true`, setup file, include/exclude globs, v8 coverage, junit `outputFile`.

- [x] **Step 2: Bump the cluster**

```bash
pnpm add -D vite@^8.1.3 @vitejs/plugin-react@^6.0.3 \
  vitest@^4.1.9 @vitest/coverage-v8@^4.1.9 @vitest/ui@^4.1.9 jsdom@^29.1.1
```

- [x] **Step 3: Apply any config changes the guides require, then verify** (no config changes needed; two test files updated for Vitest 4 constructor-mock behavior; CI reporter flags unchanged)

```bash
pnpm test:run
pnpm build
pnpm test:run --reporter=verbose --reporter=junit --outputFile.junit=./test-results.xml
```

Expected: 218 passed; build exits 0; the third command matches the CI invocation in `.github/workflows/deploy.yml:44` and must produce `test-results.xml` - if Vitest 4 changed reporter flags, update the workflow line to the new syntax in this task.

- [x] **Step 4: Dev-server smoke**

```bash
pnpm dev
```

Open http://localhost:5173/wanderlog/ - map renders with pins, no console errors from the dev server itself.

- [x] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vite.config.ts vitest.config.ts .github/workflows/deploy.yml
git commit -m "chore: upgrade to vite 8 and vitest 4"
```

(Include only the files that actually changed.)

---

### Task 3: TypeScript 6

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Modify (as errors surface): `tsconfig.app.json`, `tsconfig.node.json`, individual `src/**` files

**Interfaces:**
- Consumes: Task 2 baseline.
- Produces: green `tsc -b` on TypeScript 6.

- [x] **Step 1: Bump**

```bash
pnpm add -D typescript@^6.0.3
```

- [x] **Step 2: Surface breakages**

```bash
pnpm build
```

`build` runs `tsc -b` first. If it exits 0, skip to Step 4.

- [x] **Step 3: Fix surfaced errors minimally** (removed deprecated `baseUrl`; added `"types": ["node"]` to both tsconfigs since TS 6 defaults `types` to `[]`)

Consult https://www.typescriptlang.org/docs/handbook/release-notes/ for the 6.0 entry. Fix each error with the smallest change that preserves behavior - type annotations and config flags, not refactors. If an error's fix is unclear, prefer the config-level compatibility flag the release notes recommend over rewriting app code.

- [x] **Step 4: Verify**

```bash
pnpm test:run && pnpm build
```

Expected: 218 passed, build exits 0.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: upgrade to typescript 6"
```

---

### Task 4: Tailwind CSS 4

**Files:**
- Modify: `src/index.css`, `package.json`, `pnpm-lock.yaml`
- Delete (by the upgrade tool): `tailwind.config.js`, likely `postcss.config.js`

**Interfaces:**
- Consumes: Task 3 baseline.
- Produces: Tailwind 4 via CSS-first config; custom travel-theme colors preserved as utilities (`bg-alpine-teal` etc. keep working).

Current state the migration transforms:

- `tailwind.config.js` - four custom colors (`alpine-teal #4A9E9E`, `lake-blue #6BB6D6`, `fern-green #5B8C5A`, `sandy-beige #F2E7D5`) and the Inter font stack, `plugins: []`.
- `postcss.config.js` - `tailwindcss` + `autoprefixer` plugins.
- `src/index.css` - Google Fonts `@import` followed by the three `@tailwind` directives.

- [x] **Step 1: Run the official upgrade tool (requires a clean git tree)**

```bash
git status --porcelain   # must be empty
npx @tailwindcss/upgrade
```

Expected changes: `@tailwind` directives replaced by `@import "tailwindcss";`, custom colors and font moved into a `@theme` block in `src/index.css` (as `--color-alpine-teal: #4A9E9E;` etc.), `tailwind.config.js` removed, PostCSS config switched to `@tailwindcss/postcss`, `autoprefixer` dropped (built into v4).

- [x] **Step 2: Check the two things the tool gets wrong most often**

1. The Google Fonts `@import url(...)` line must remain **above** `@import "tailwindcss";` in `src/index.css` (CSS requires `@import` before other rules).
2. The `@theme` block must contain all four `--color-*` variables and the `--font-sans` stack. If any are missing, add them:

```css
@theme {
  --color-alpine-teal: #4A9E9E;
  --color-lake-blue: #6BB6D6;
  --color-fern-green: #5B8C5A;
  --color-sandy-beige: #F2E7D5;
  --font-sans: Inter, system-ui, sans-serif;
}
```

- [x] **Step 3: Remove the never-registered typography plugin**

`@tailwindcss/typography` is installed but `plugins: []` was empty - it was never active, so it goes rather than gets migrated:

```bash
pnpm remove @tailwindcss/typography
```

- [x] **Step 4: Verify, including visually**

```bash
pnpm test:run && pnpm build
pnpm dev
```

Expected: 218 passed, build exits 0. In the browser: timeline strip, activity cards, and accommodation cards show the teal/blue/green/beige theme colors; Inter font renders; layout unchanged against production (https://kevinlin.github.io/wanderlog/) side by side.

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: migrate to tailwind css 4"
```

---

### Task 5: Ultracite 7 + Biome 2.5, retire stale eslint remnants

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`, `biome.jsonc`
- Modify (formatting fallout): any `src/**` files Ultracite reformats

**Interfaces:**
- Consumes: Task 4 baseline.
- Produces: working `pnpm lint` (currently broken - it calls eslint, which is not installed); pre-commit hook green on Ultracite 7.

- [x] **Step 1: Bump**

```bash
pnpm add -D ultracite@^7.8.4 @biomejs/biome@^2.5.2
```

- [x] **Step 2: Reconcile `biome.jsonc` with Ultracite 7** (presets renamed to `ultracite/biome/core` + `ultracite/biome/react`; four nursery rules moved to their promoted groups; `style/noSubstr` disabled instead of rewriting app code)

```bash
npx ultracite check
```

If the `extends: ["ultracite/core", "ultracite/react"]` preset names changed in v7, update them per https://www.ultracite.ai/docs (migration section). Keep the existing rule-disable list and formatter settings (`lineWidth: 140`, single quotes) untouched unless a rule key was renamed - then rename it, do not drop it.

- [x] **Step 3: Fix the stale lint script and remove eslint leftovers**

`package.json` has `"lint": "eslint ."` but eslint is not a dependency and no eslint config exists. Replace it and drop the orphaned `globals` package:

```json
"lint": "ultracite check",
```

```bash
pnpm remove globals
```

- [x] **Step 4: Apply formatting and review**

```bash
npx ultracite fix
git diff --stat
```

Review the diff: formatting-only changes are expected; any semantic-looking change (imports removed, code deleted) gets reverted and the responsible rule disabled in `biome.jsonc` instead.

- [x] **Step 5: Verify (includes the pre-commit hook, which runs tests + ultracite)**

```bash
pnpm test:run && pnpm build && pnpm lint
git add -A
git commit -m "chore: upgrade ultracite 7 and biome 2.5, fix lint script"
```

Expected: all three commands exit 0; the husky pre-commit hook passes during the commit.

---

### Task 6: CI on Node 24 LTS + deploy verification

**Files:**
- Modify: `.github/workflows/deploy.yml:37`

**Interfaces:**
- Consumes: all previous tasks merged locally.
- Produces: green GH Pages deploy on Node 24 - the M0 exit gate for CI.

- [x] **Step 1: Bump the workflow's Node version**

In `.github/workflows/deploy.yml` change:

```yaml
        node-version: '22'
```

to:

```yaml
        node-version: '24'
```

- [x] **Step 2: Commit and push**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: run on node 24 lts"
git push
```

- [x] **Step 3: Watch the workflow** (push triggers are disabled in `deploy.yml`, so the run was dispatched manually via `gh workflow run`; build, tests, junit report, and GH Pages deploy all succeeded on Node 24)

```bash
gh run watch
```

Expected: test job passes (218 tests, junit report published), build succeeds, deploy job publishes to GH Pages. If the junit reporter step fails, the fix belongs in Task 2's reporter-flag update - amend there, do not patch around it here.

---

### Task 7: Final M0 verification gate

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md` (status row)

**Interfaces:**
- Consumes: everything above, deployed.
- Produces: signed-off M0; M1 planning can start.

- [x] **Step 1: Full local verification**

```bash
pnpm test:run && pnpm build && pnpm lint
```

Expected: 218 passed, both exit 0.

- [x] **Step 2: Manual smoke checklist (dev server or the deployed site)**

On https://kevinlin.github.io/wanderlog/ after the Task 6 deploy:

- [x] Map renders with accommodation + activity pins
- [x] Route polyline draws through scenic waypoints
- [x] Timeline strip navigates between stops
- [x] Activity drag-reorder works and survives a refresh
- [x] Done-toggle works and survives a refresh
- [x] Export downloads the trip JSON
- [x] POI search returns results and can add an activity (in-memory)
- [x] No new console errors compared to pre-upgrade production

- [x] **Step 3: Mark M0 shipped**

In `docs/specs/plan_wanderlog-phase-2.md`, set the M0 row's status to `Shipped (<date>)`.

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M0 toolchain upgrade shipped"
```

---

## Self-Review Notes

- Task ordering is risk-ascending: reversible dependency bumps before config-migrating ones (Tailwind), formatting last so no other task's diff is polluted by it.
- Vite/Vitest merged into one task because of the peer-dependency coupling; the design doc's table listed them as separate rows, superseded here.
- No TDD cycle: there is no new behavior to test-drive. The 218-test suite is the regression harness; every task ends on it.

## Changelog

- 2026-07-03: Initial plan.
