# Phase 3 M4 — Design Quality: Critique Remediation

Implements the five recommended actions from the [Trip page critique](../../../.impeccable/critique/20260710_src-pages-trippage-tsx.md) (score 26/40, 0 P0, 3 P1, 2 P2). Each action maps to an `/impeccable` command and addresses specific heuristic gaps.

**Prerequisite:** Phase 3 M3 (generative creation) shipped.

## Scope

| # | Action | Priority | Files | What changes |
|---|--------|----------|-------|-------------|
| 1 | `quieter` — self-consistency | P2 | AccommodationCard, ScenicWaypointCard, MapLayerPicker, AgentModal, ActivitiesPanel, DoneCheckbox | Drop `border-l-4` stripe; drop gradient card; sentence-case tracked-caps labels; standardize add buttons on teal-tint; make done checkbox emerald everywhere |
| 2 | `audit` — reduced-motion + a11y | P1 | MapContainer, index.css | Strip infinite `pulse`+glow from marker SVGs; add global `@media (prefers-reduced-motion: reduce)` block covering `scale`, `hover`, transitions; gate `Animation.DROP` on motion preference |
| 3 | `colorize` — timeline contrast | P1 | TimelineStrip | Darken rainbow fills from `-500` to `-700` (selected to `-800`); verify all 12 entries pass WCAG AA (4.5:1) with white text |
| 4 | `clarify` — undo + error copy | P2 | TripPage, ErrorMessage | Add "Undo" action to reorder toast (Toast already supports `action`); rewrite ErrorMessage suggestions in companion voice on the Supabase model |
| 5 | `polish` — final sweep | Minor | index.css, MapContainer, ActivitiesPanel, AgentModal | Remove Inter weight 300; remove production console.log/warn/error; align route-error yellow→amber |

## Tasks

### Action 1 — `quieter` (self-consistency)

- [x] **1.1** `AccommodationCard.tsx:28` — replace `border-sky-500 border-l-4` with a plain `border border-gray-200` to match the activity card pattern.
- [x] **1.2** `ScenicWaypointCard.tsx:59` — replace the default-state gradient `bg-linear-to-r from-violet-50 to-sky-50 hover:from-violet-100/50 hover:to-sky-100/50` with flat `bg-white hover:bg-gray-50`.
- [x] **1.3** `MapLayerPicker.tsx:106,126` — change `text-xs uppercase tracking-wide` section labels to sentence-case (`normal-case tracking-normal`).
- [x] **1.4** `AgentModal.tsx:199` — change `text-xs uppercase` entity labels to sentence-case.
- [x] **1.5** `ActivitiesPanel.tsx` — standardize add-accommodation (sky), add-waypoint (violet), and add-activity (emerald) buttons to the teal-tint secondary treatment: `border-alpine-teal/30 bg-alpine-teal/10 text-alpine-teal hover:bg-alpine-teal/20`.
- [x] **1.6** `ScenicWaypointCard.tsx` — change `DoneCheckbox accent="violet"` to `accent="emerald"` so done-state is emerald everywhere.

### Action 2 — `audit` (reduced-motion + pin tone-down)

- [x] **2.1** `MapContainer.tsx` — remove `@keyframes pulse` and `.pin-icon { animation: ... }` from all three marker SVG generators (`getAccommodationPinIcon`, `getActivityPinIcon`, `getScenicWaypointPinIconFn`) and the search-result pin.
- [x] **2.2** `MapContainer.tsx` — remove the glow filter (`<filter id="glow">`) from all marker SVGs; keep the drop-shadow filter on accommodation pins.
- [x] **2.3** `MapContainer.tsx` — gate `Animation.DROP` calls on reduced-motion preference: check `window.matchMedia('(prefers-reduced-motion: reduce)')` before calling `setAnimation`.
- [x] **2.4** `index.css` — extend the existing `@media (prefers-reduced-motion: reduce)` block to suppress `hover:scale-*`, `active:scale-*`, and transition durations globally.

### Action 3 — `colorize` (timeline contrast)

- [x] **3.1** `TimelineStrip.tsx` — darken the 12-color palette from `-500` base / `-600` selected to `-700` base / `-800` selected. All entries must pass 4.5:1 against white text. Keep ring colors at `-500` (border/ring treatments, not text backgrounds).

### Action 4 — `clarify` (undo + error copy)

- [x] **4.1** `TripPage.tsx` — extend `handleActivityReorder` to capture the pre-reorder order and show a toast with an `action: { label: 'Undo', onClick: ... }` that re-submits the original order.
- [x] **4.2** `ErrorMessage.tsx` — rewrite the suggestion lists in the companion voice (no "trip data file", no "browser cache", no "console"):
  - `data` → "Check your connection and try again" / "The trip might have been moved or deleted"
  - `general` → "Give it another go" / "Try refreshing the page"
  - `network` → "Check your Wi-Fi or mobile signal" / "Try again in a moment"
  - `permission` → "Make sure you're signed in" / "Ask the trip owner to share access"

### Action 5 — `polish` (final sweep)

- [x] **5.1** `index.css:1` — remove weight 300 from the Inter import (the type system uses 400/500/600/700 only).
- [x] **5.2** `ActivitiesPanel.tsx` — remove `console.warn` and `console.error` in `handleExport`.
- [x] **5.3** `MapContainer.tsx` — remove `console.warn` in route truncation and directions fallback; remove `console.error` in route fetch catch.
- [x] **5.4** `MapContainer.tsx:1046` — change route-error banner from `border-yellow-400 bg-yellow-100 text-yellow-700` to `border-amber-400 bg-amber-100 text-amber-700` (align with the design system warning color).

## Verification

- `pnpm test:run` — all existing tests pass (no behavioral regressions).
- `pnpm build` — TypeScript + Vite build clean.
- `pnpm lint` — Ultracite clean.
