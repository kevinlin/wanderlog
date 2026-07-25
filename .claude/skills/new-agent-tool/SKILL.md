---
name: new-agent-tool
description: Add a tool to the Wanderlog AI agent's tool-use loop. Use when adding, extending, or splitting a tool in api/_lib/tools/ — anything that gives the agent a new capability over trips, stops, activities, waypoints, or accommodations. Handles the five things that are easy to half-miss: the shared-module import style, the injected RLS-scoped client, registration in buildAgentTools, the toChanges mapping, and the paired test.
---

# Adding an agent tool

A tool is five coupled pieces. Miss one and the failure is quiet: an unregistered tool is dead code, a missing `toChanges` leaves the UI stale after a successful write, and a wrong import style ships green and 500s only on Vercel.

Read [api/_lib/tools/tripFields.ts](../../../api/_lib/tools/tripFields.ts) before starting — it is the clearest existing example, with both a create/update discrimination and a sparse patch.

## 1. Decide where it goes

Group by entity, matching the existing files:

| Entity | File | Exported array |
|---|---|---|
| Trip fields, accommodation | `tripFields.ts` | `TRIP_FIELD_TOOLS` |
| Stops | `stops.ts` | `STOP_TOOLS` |
| Activities, waypoints | `items.ts` | `ACTIVITY_TOOLS`, `WAYPOINT_TOOLS` |
| Reads | `read.ts` | `READ_TOOLS` |
| Whole-trip creation | `createTrip.ts` | `CREATE_TRIP_TOOL` |
| Geocoding | `geocode.ts` | `buildGeocodeTool(key)` |

Add to an existing array when the entity matches. Only create a new file for a genuinely new entity — then it also needs registering (step 4).

## 2. Write the tool

Start from [template.ts](template.ts). The non-negotiables:

**Imports.** Shared `src/` modules use relative specifiers with explicit `.js` extensions — the Vercel runtime is Node ESM and resolves neither `@/` nor extensionless paths. The `check-shared-esm.sh` hook will reject a violation, but write it right the first time.

**The client is injected.** `execute: async (client, input)` receives an RLS-scoped client built from the caller's JWT in `api/agent.ts`. Never import the browser singleton, never reach for the service-role key — either one silently bypasses RLS and lets the agent touch other users' trips.

**Go through the shared write modules.** `tripWrites.ts` and `entityRows.ts` own the column definitions and the write semantics; the agent's snake_case input is accepted by them directly. Raw `client.from(...).insert(...)` in a tool duplicates logic that file import and `create_trip` already share.

**Validate in zod, not in `execute`.** Use `.strict()` so unknown keys are rejected rather than silently dropped, and `.refine()` for cross-field rules (empty patch, reversed date range). `dispatchTool` runs `safeParse` and returns the error to the model, which then retries with corrected input — that loop only works if the constraint lives in the schema.

**Descriptions are the model's only spec.** State what the tool does *and* what it does not do. `create_stop` says "Dates do not automatically chain; call restructure_stops afterwards" because the model would otherwise assume they do. Add `.describe()` on any field whose format is not obvious from its name.

**`toChanges` drives the UI.** Return one `{op, entity, id, name}` per row touched. `entity` must be one of `'accommodation' | 'activity' | 'stop' | 'trip' | 'waypoint'` (see [src/types/agent.ts](../../../src/types/agent.ts)). Omit `toChanges` only on read-only tools. There is no undo — the change list is the entire record of what the agent did, and `AgentModal` invalidates query keys from it. A write with no change event leaves the user's cache stale.

To label an op `created` vs `updated`, pre-read the row (as `upsert_accommodation` does). That extra read is agent-only work and is worth it.

## 3. Write the test

Start from [template.test.ts](template.test.ts). Tests live in `api/_lib/__tests__/` and go through `dispatchTool`, not the raw `execute` — that is what exercises schema validation and change mapping together.

`createFakeClient(queue)` takes an ordered queue of `{table, method, data}` entries. Each `from(table).<method>()` consumes the first matching entry; unmatched calls resolve to `{data: null, error: null, count: null}`. Assert on the recorded `calls` array for the payload actually sent.

Cover four cases:

1. Happy path — assert the write payload and the exact `result.changes`.
2. Schema rejection — `result.isError` is true for an empty patch or a violated refine.
3. Missing entity — the tool errors *and* no write call was recorded.
4. Any created/updated discrimination the tool makes.

Test files may use extensionless imports; Vitest resolves them and the ESM hook skips them.

## 4. Register it

If you added to an existing array, `buildAgentTools` already picks it up. A **new** array must be added to [api/_lib/tools/index.ts](../../../api/_lib/tools/index.ts) — either to `AGENT_TOOLS`, or inside `buildAgentTools` if it needs a server key like `buildGeocodeTool` does.

Registration is the step that fails silently. An unregistered tool passes tsc, passes its own test, and simply never reaches the model.

## 5. Verify

```bash
pnpm vitest run api/_lib/__tests__/<yourfile>.test.ts
pnpm test          # the pre-commit hook runs the full suite anyway
pnpm build
```

`pnpm dev` does not serve `api/`. To exercise the tool end to end you need `vercel dev` or a preview deploy. Say so rather than claiming it works when only the unit test ran.

## Checklist

- [ ] Relative imports with `.js` extensions for anything under `src/`
- [ ] `execute` uses the injected `client`; no browser singleton, no service-role key
- [ ] Writes go through `tripWrites` / `entityRows`, not raw table calls
- [ ] Zod schema is `.strict()` and carries the cross-field rules
- [ ] Description states the limits, not just the capability
- [ ] `toChanges` returns one event per touched row, with a valid `entity`
- [ ] Registered in `buildAgentTools`
- [ ] Test covers happy path, schema rejection, missing entity, op discrimination
- [ ] `pnpm test` and `pnpm build` both pass
