# Map Markers Redesign - Design

Status: approved for build after spec review round 1 (deep_reasoner, all 5 blocking and 7 advisory findings accepted; dispositions in [Review changes](#review-changes)). Visual reference: the design review artifact at https://claude.ai/artifact/WNyqLesfyBFAn3cmB7sRR7 (live scene, every state, before/after). Plan: [plan_map-markers.md](plan_map-markers.md).

## Why

The map pins are a legacy `google.maps.Marker` with a flat 30px data-URI SVG each ([MapContainer.tsx](../../src/components/Map/MapContainer.tsx), the four `get*PinIcon` builders). They look dated and they break the design system:

- All 12 activity types share one teardrop; `getActivityTypeSvgPath` ignores its argument, so only color tells types apart. PRODUCT.md: meaning must not ride on color alone.
- Pin colors reuse the functional palette: orange (press) for accommodation and restaurants, amber (needs attention) for outdoor, emerald (done) for shopping, sky (selected) for recreation. A green shopping pin reads as done.
- Past and upcoming stops differ only by opacity (0.3 / 0.7).
- Legacy markers take no CSS, so selection is a 30 to 33px bump and the glow/drop CSS in `map-animations.css` is dead.
- `google.maps.Marker` is deprecated (Feb 2024, no sunset date, console warning).

## Decisions

Confirmed with the owner:

- **Category color families** for activities; stops keep their timeline color.
- **Category glyph** on activity markers (Phosphor, fill weight).
- **Initials** on stop markers, the same rule as the collapsed mobile timeline.
- **Extras:** zoom-aware dots, a "Next" tab, a today halo, the glyph in the hover card.
- **`AdvancedMarkerElement` with a Map ID** and cloud-based map styling (the JSON `styles` option cannot coexist with a Map ID).

Driver calls (reviewable):

- Scenic waypoints stay **violet** (the sights family color), not nature green: the panel's waypoint section, `ScenicWaypointCard` and the POI modal's waypoint button are all violet, and the diamond shape already separates waypoints from violet activity pins.
- Only one marker ever carries the sky selection outline: the selected activity or waypoint (`selectedActivityId`). The viewed stop grows but gets no outline. Search results have no selected state; clicking one opens the POI modal, as today.
- The viewed stop shows its name pill only when zoomed out; up close the pill would cover its own activities.
- Stop ownership is shown by what is on the map: only the viewed stop's activities and waypoints are drawn (as today), and the stop marker wears its timeline color and initials. Activity markers carry their category, not their stop.
- A past stop gets a muted fill but **no** check: the timeline's completion seal already means "every activity done", and a stop whose dates have passed may not be.
- Overview dots keep two non-color cues, kind (circle for an activity, diamond for a waypoint) and done (hollow), but drop the category glyph. Their tap target is 24px (WCAG 2.5.8 AA), deliberately under 44px so a dot cannot steal taps from a stop marker beside it.
- The selection ring and done badge use the **-600** shades (sky-600, emerald-600). The -500 shades measure 2.8:1 and 2.5:1 against white, under WCAG 1.4.11's 3:1.
- Done and past faces switch the glyph and initials from white to gray-800 (`--marker-ink-muted`, #1f2937). White on the muted fill measures about 2:1; gray-800 measures 5.9:1 or better on every family and stop color.
- Stay on `@react-google-maps/api` and create advanced markers imperatively. The library has no AdvancedMarker; moving to `@vis.gl/react-google-maps` would mean replacing `GoogleMap`, both loaders, `DirectionsRenderer` and `Polyline` for one feature.

## Marker system

| Kind | Face | Box (anchor) | States |
|---|---|---|---|
| Stop | 32px rounded square + tail, stop's timeline `-700` color, white 13px bold initials | 44x44, tip at bottom centre (default anchor) | upcoming: white fill, colored stroke and initials · today: filled + halo (loops; a static ring under reduced motion) · past: muted fill, gray-800 initials, no check · viewing: 1.12x, name pill only when zoomed out |
| Activity | 30px circle + short tail, family color, white 16px glyph | 38x39, tip at bottom centre (default anchor) | hover: lift 2px, deeper shadow · selected: 1.15x, sky-600 outline, name pill · done: muted fill, gray-800 glyph, emerald check, lower z · next: "Next" tab |
| Scenic waypoint | 18px rounded diamond, violet, white 12px mountains glyph | 26x26, centred (`anchorTop: '-50%'`) | selected: sky ring · done: muted, gray-800 glyph, check |
| POI search result | 26px white circle, slate-300 border, 14px glyph in alpine-teal-deep | 26x26, centred | no selected state · collision `OPTIONAL_AND_HIDES_LOWER_PRIORITY` |
| Dot (zoomed out, below zoom 11) | activity: 11px circle; waypoint: 9px diamond; item's color, white 2px border | 11x11 / 9x9, centred | done: hollow (white fill, 2px border in the item's color). A selected item never becomes a dot |

The travel pulse dot, halo and trail of the stop hop stay legacy `google.maps.Marker`/`Polyline` (they still work with a Map ID).

### Category families

| Family | Token | Hex | White-glyph contrast | Types (glyph) |
|---|---|---|---|---|
| food | `--marker-food` | #db2777 | 4.6 | restaurant (`ForkKnifeIcon`) |
| sights | `--marker-sights` | #7c3aed | 5.7 | attraction (`CameraIcon`), cultural (`BankIcon`), recreation (`TicketIcon`), playground (`BalloonIcon`); scenic waypoint (`MountainsIcon`) |
| nature | `--marker-nature` | #5b8c5a | 3.9 | outdoor (`PersonSimpleHikeIcon`), scenic (`BinocularsIcon`) |
| water | `--marker-water` | #0e7490 | 5.4 | beach (`UmbrellaIcon`) |
| shopping | `--marker-shopping` | #4f46e5 | 6.3 | shopping (`ShoppingBagIcon`), grocery (`ShoppingCartIcon`) |
| transport | `--marker-transport` | #475569 | 7.6 | transport (`CarIcon`) |
| other | `--marker-other` | #6b7280 | 4.8 | other (`FlagIcon`) |

None of these is a functional color (sky, emerald, orange, red, amber). Stop pill: `BedIcon`. Done badge: `CheckFatIcon`. All glyphs render with `weight="fill"`.

### Stacking and titles

- zIndex: stop 10, done activity/waypoint 15, activity/waypoint 20, search result 25, viewed stop 30, selected 40. `MapMarker` adds 100 while the pointer is over a marker.
- `title` (screen readers and the tooltip):
  - stop: `"{stop name} - {accommodation name}, {today|past|upcoming}"`, or `"{stop name}, {status}"` with no accommodation
  - activity / waypoint: `"{name}"`, plus `", done"` when done, or `", next up"` for the Next item
  - search result: `"{name}, search result"`

### Motion

- **Arrival.** When the viewed stop changes, its activities and waypoints are not rendered until the camera hop lands (`landedStopId === currentBaseId`). On landing the stop marker plays `mk-drop` (420ms) and each activity/waypoint plays `mk-pop` (320ms spring) with `--enter-index` staggering 45ms, capped at 10. Hops are 520-920ms (`hopDuration` in `mapCamera.ts`), so the last item finishes at most about 1.7s after the stop is picked (920 + 450 + 320ms).
- **Done.** When `isDone` turns true while the face is mounted, the badge plays the existing `.animate-check-pop` plus one `mk-ripple`. A face that mounts already done shows the badge still. Done, then not done, then done again while mounted animates again.
- **Today.** The today stop's halo loops (`mk-halo`, 2.4s). It is the only looping motion.
- **Reduced motion.** The global rule in `src/index.css` shortens every animation and transition to 0.01ms and one iteration, but it does not reset `animation-delay`. `map-markers.css` therefore zeroes the entrance stagger under reduced motion, and replaces the halo loop with a static ring so "today" still has a non-color cue.

## Files

### New: `src/assets/styles/map-markers.css`

Replaces `src/assets/styles/map-animations.css` (deleted). Imported by `MapContainer.tsx` where the old file was. Ship it as written:

```css
/* Map markers: faces rendered into AdvancedMarkerElement content. Each face's
   box is sized so the marker's anchor lands on the pin tip (pins) or the
   centre (diamonds, discs, dots). Pills, badges and tabs sit outside the box,
   so a growing label never moves the anchor. */
:root {
  --marker-food: #db2777;
  --marker-sights: #7c3aed;
  --marker-nature: #5b8c5a;
  --marker-water: #0e7490;
  --marker-shopping: #4f46e5;
  --marker-transport: #475569;
  --marker-other: #6b7280;
  --marker-select: #0284c7; /* sky-600: -500 is under 3:1 on the map */
  --marker-done: #059669; /* emerald-600, same reason */
  --marker-next: #2b7070;
  --marker-muted: #d6dbe3;
  --marker-ink-muted: #1f2937; /* gray-800: white on the muted fill is ~2:1 */
  --marker-shadow: drop-shadow(0 1px 1.5px rgb(15 23 42 / 0.35)) drop-shadow(0 2px 4px rgb(15 23 42 / 0.16));
  --marker-shadow-lift: drop-shadow(0 2px 2px rgb(15 23 42 / 0.3)) drop-shadow(0 7px 10px rgb(15 23 42 / 0.22));
  --marker-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --marker-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mk {
  position: relative;
  display: block;
  cursor: pointer;
  transition:
    transform 200ms var(--marker-ease),
    translate 200ms var(--marker-ease);
}
/* Invisible hit area: every face reaches at least 44px for touch. */
.mk::after {
  content: "";
  position: absolute;
  inset: -4px;
}
.mk-pin {
  width: 38px;
  height: 39px;
  transform-origin: 19px 39px;
}
.mk-stop {
  width: 44px;
  height: 44px;
  transform-origin: 22px 44px;
}
.mk-wp,
.mk-poi {
  width: 26px;
  height: 26px;
  transform-origin: 13px 13px;
}
.mk-wp::after,
.mk-poi::after {
  inset: -9px;
}
.mk-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--c);
  border: 2px solid #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.35);
}
.mk-dot.is-wp {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  transform: rotate(45deg);
}
/* 24px target (WCAG 2.5.8 AA): wide enough to hit, narrow enough not to cover a stop marker. */
.mk-dot::after {
  inset: -6.5px;
}
.mk-dot.is-wp::after {
  inset: -7.5px;
}
.mk-dot.is-done {
  background: #fff;
  border-color: var(--c);
}

.mk-shape {
  position: absolute;
  inset: 0;
  overflow: visible;
  filter: var(--marker-shadow);
  transition: filter 200ms var(--marker-ease);
}
.mk-body {
  fill: var(--c);
  stroke: #fff;
  stroke-width: 2.5;
  stroke-linejoin: round;
  transition: fill 200ms var(--marker-ease);
}
.mk-sel {
  fill: none;
  stroke: var(--marker-select);
  stroke-width: 7;
  stroke-linejoin: round;
  opacity: 0;
  transition: opacity 160ms var(--marker-ease);
}
.mk-glyph {
  position: absolute;
  display: grid;
  place-items: center;
  color: #fff;
  pointer-events: none;
}
.mk-pin .mk-glyph {
  left: 11px;
  top: 11px;
  width: 16px;
  height: 16px;
}
.mk-stop .mk-glyph {
  left: 6px;
  top: 6px;
  width: 32px;
  height: 32px;
  font: 700 13px/1 Inter, system-ui, sans-serif;
  letter-spacing: -0.01em;
}
.mk-wp .mk-glyph {
  left: 7px;
  top: 7px;
  width: 12px;
  height: 12px;
}
.mk-poi .mk-glyph {
  left: 6px;
  top: 6px;
  width: 14px;
  height: 14px;
  color: var(--marker-next);
}

.mk-stop.is-upcoming .mk-body {
  fill: #fff;
  stroke: var(--c);
}
.mk-stop.is-upcoming .mk-glyph {
  color: var(--c);
}
.mk-halo {
  position: absolute;
  left: 6px;
  top: 6px;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--c);
  opacity: 0;
  pointer-events: none;
}
.mk-stop.is-today .mk-halo {
  animation: mk-halo 2.4s ease-out infinite;
}

.mk-dia {
  position: absolute;
  left: 4px;
  top: 4px;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: var(--c);
  border: 2px solid #fff;
  transform: rotate(45deg);
  filter: var(--marker-shadow);
  transition: background-color 200ms var(--marker-ease);
}
.mk-disc {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid #cbd5e1;
  filter: var(--marker-shadow);
}

/* Done and past: muted fill with a dark glyph; done items also get the emerald check. */
.mk.is-done .mk-body,
.mk-stop.is-past .mk-body {
  fill: color-mix(in oklab, var(--c) 38%, var(--marker-muted));
  stroke: #fff;
}
.mk-wp.is-done .mk-dia {
  background: color-mix(in oklab, var(--c) 38%, var(--marker-muted));
}
.mk.is-done .mk-glyph,
.mk-stop.is-past .mk-glyph {
  color: var(--marker-ink-muted);
}
.mk-check {
  position: absolute;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--marker-done);
  border: 2px solid #fff;
  display: grid;
  place-items: center;
  color: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.3);
  pointer-events: none;
}
.mk-pin .mk-check {
  left: 25px;
  top: -1px;
}
.mk-wp .mk-check {
  left: 15px;
  top: -4px;
  width: 13px;
  height: 13px;
}
.mk-ripple {
  position: absolute;
  border-radius: 50%;
  border: 2px solid var(--marker-done);
  opacity: 0;
  pointer-events: none;
  animation: mk-ripple 520ms var(--marker-ease);
}
.mk-pin .mk-ripple {
  left: 2px;
  top: 2px;
  width: 34px;
  height: 34px;
}
.mk-wp .mk-ripple {
  left: -2px;
  top: -2px;
  width: 30px;
  height: 30px;
}

/* Hover lifts, for a mouse only; touch selects instead. */
@media (hover: hover) {
  .mk:hover {
    translate: 0 -2px;
  }
  .mk:hover .mk-shape,
  .mk:hover .mk-dia,
  .mk:hover .mk-disc {
    filter: var(--marker-shadow-lift);
  }
}

.mk.is-selected {
  transform: scale(1.15);
}
.mk-stop.is-viewing {
  transform: scale(1.12);
}
.mk.is-selected .mk-sel {
  opacity: 1;
}
.mk-wp.is-selected .mk-dia {
  box-shadow: 0 0 0 2.5px var(--marker-select);
}

.mk-pill {
  position: absolute;
  z-index: -1;
  height: 24px;
  max-width: 190px;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  background: #fff;
  color: #111827;
  font: 600 12px/1 Inter, system-ui, sans-serif;
  border-radius: 9999px;
  padding: 0 10px 0 14px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.25), 0 3px 8px rgb(15 23 42 / 0.12);
  opacity: 0;
  transform: translateX(-6px);
  pointer-events: none;
  transition:
    opacity 180ms var(--marker-ease),
    transform 220ms var(--marker-ease);
}
.mk-pill > span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.mk-pill > em {
  font-style: normal;
  font-weight: 500;
  color: #6b7280;
}
.mk-pill > svg {
  flex: none;
  color: var(--c);
}
.mk-pin .mk-pill {
  left: 26px;
  top: 7px;
}
.mk-stop .mk-pill {
  left: 32px;
  top: 10px;
  padding-left: 16px;
}
.mk-wp .mk-pill {
  left: 20px;
  top: 1px;
}
.mk.is-selected .mk-pill,
.mk.has-label .mk-pill {
  opacity: 1;
  transform: none;
}

.mk-next {
  position: absolute;
  left: 19px;
  top: -13px;
  transform: translateX(-50%);
  background: var(--marker-next);
  color: #fff;
  font: 600 10px/1 Inter, system-ui, sans-serif;
  padding: 3px 6px;
  border-radius: 9999px;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.3);
  white-space: nowrap;
  pointer-events: none;
}

/* Entrances animate the individual translate/scale properties, so they never
   fight the selected-state transform; fill-mode backwards drops them after. */
.mk.mk-drop {
  animation: mk-drop 420ms var(--marker-ease) backwards;
}
.mk.mk-enter {
  animation: mk-pop 320ms var(--marker-spring) backwards;
  animation-delay: calc(min(var(--enter-index, 0), 10) * 45ms);
}
/* Selecting an overview dot mounts the full face; it answers the click with no stagger. */
.mk.mk-enter.is-selected {
  animation-delay: 0ms;
}

/* The global reduced-motion rule in index.css shortens durations but keeps
   delays, so drop the stagger; and keep "today" readable without the loop. */
@media (prefers-reduced-motion: reduce) {
  .mk.mk-enter {
    animation-delay: 0ms;
  }
  .mk-stop.is-today .mk-halo {
    animation: none;
    opacity: 0.3;
    transform: scale(1.35);
  }
}

/* Glyph chip for the hover card: the marker's face in miniature. */
.mk-chip {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--c);
  color: #fff;
  flex: none;
}

@keyframes mk-drop {
  0% {
    translate: 0 -22px;
    scale: 0.92;
    opacity: 0;
  }
  55% {
    translate: 0 2px;
    scale: 1.04;
    opacity: 1;
  }
  100% {
    translate: 0 0;
    scale: 1;
    opacity: 1;
  }
}
@keyframes mk-pop {
  from {
    scale: 0.4;
    opacity: 0;
  }
  to {
    scale: 1;
    opacity: 1;
  }
}
@keyframes mk-halo {
  0% {
    transform: scale(0.95);
    opacity: 0.45;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}
@keyframes mk-ripple {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}
```

### New: `src/utils/stopPalette.ts`

Moves the inline `colorPalette` and `getInitials` out of `TimelineStrip.tsx` so the map and the timeline share one source.

- `interface StopColor { base: string; text: string; selected: string; ring: string; color: string }`:
  - the four existing Tailwind class strings, unchanged and literal (Tailwind scans them)
  - `color`: the matching Tailwind 4 variable for the map, `'var(--color-blue-700)'`, `'var(--color-emerald-700)'` and so on. Tailwind 4 emits these variables because the timeline's `bg-*-700` utilities use them, so map and timeline render the identical color. Hard-coded hex would drift: Tailwind 4's OKLCH values differ from the old hex palette.
- `STOP_PALETTE: StopColor[]` (12 entries, current order).
- `getStopColor(index: number): StopColor`, wrapping with `%`.
- `getStopInitials(name: string): string`: first letter of each word, uppercase, max 2. Splits on any whitespace run (`/\s+/`) after trimming. The current code already gives "TA" for a double space; this also handles tabs and leading spaces.
- `TimelineStrip.tsx` imports these and deletes its local copies; its rendering is unchanged.

### New: `src/components/Map/markerCategory.ts`

- `type MarkerFamily = 'food' | 'sights' | 'nature' | 'water' | 'shopping' | 'transport' | 'other'`.
- `MARKER_FAMILY_COLOR: Record<MarkerFamily, string>`: `'var(--marker-food)'` and so on.
- `ACTIVITY_MARKER: Record<ActivityType, { family: MarkerFamily; Glyph: Icon }>` per the family table. `Icon` is the type exported by `@phosphor-icons/react`. Import the `*Icon` names (`ForkKnifeIcon`, …); the bare names are deprecated in 2.1.
- `getActivityMarker(type: ActivityType | undefined): { color: string; Glyph: Icon }`: falls back to `other`.
- `WAYPOINT_MARKER = { color: MARKER_FAMILY_COLOR.sights, Glyph: MountainsIcon }`.

### Changed: `src/utils/dateUtils.ts`

- `getStopTimeStatus(stop, today: string): 'past' | 'current' | 'upcoming'`. It becomes a pure comparison of `YYYY-MM-DD` strings: `today < stop.date.from` is upcoming, `today > stop.date.to` is past, otherwise current.
- `today` comes from `useTripToday(tripData.timezone)` ([useTripToday.ts](../../src/hooks/useTripToday.ts)), the trip-local date that Phase 5's todos already use; it rolls over at the trip's own midnight.
- Why not keep its body: the old body went through `getCurrentNZDate` and `formatDate`'s `toISOString`, so on a browser east of UTC an early-morning "today" came out as yesterday. It has no other callers, and `getCurrentNZDate`'s only caller is the deleted `getBaseStatus`. Leave both NZ helpers alone otherwise.

### New: `src/components/Map/MapMarker.tsx`

Imperative wrapper around `google.maps.marker.AdvancedMarkerElement`, rendered inside the existing `<GoogleMap>`.

```ts
interface MapMarkerProps {
  position: google.maps.LatLngLiteral;
  title: string;
  zIndex: number;
  centred?: boolean; // anchorTop '-50%' for diamonds, discs and dots; pins keep the default bottom-centre anchor
  collisionBehavior?: google.maps.CollisionBehavior;
  onClick?: () => void;
  onHoverChange?: (rect: DOMRect | null) => void; // mouse pointers only
  children: React.ReactNode;
}
```

- Map from `useGoogleMap()`; render nothing until it exists.
- Content element: `const [content] = useState(() => document.createElement('div'))`, so it survives StrictMode's double mount.
- Keep the latest props in a ref updated every render (`propsRef.current = props`). Listeners read from it, so they never see a stale `zIndex` or callback and never need rebinding.
- **Creation.** One effect keyed on `[map, content]` creates the marker. On cleanup it removes all three listeners, sets `marker.map = null` and clears the marker ref.
  - It applies **every** current prop at construction: `new google.maps.marker.AdvancedMarkerElement({ map, content, gmpClickable: true, position, title, zIndex, collisionBehavior, anchorTop })`. A marker recreated for a new map is then complete even when no prop changed.
  - It stores the marker in a ref.
  - It adds three listeners:
    - `'gmp-click'` on the marker, calling `propsRef.current.onClick?.()`
    - `pointerenter` on `content`: when `e.pointerType === 'mouse'`, set `marker.zIndex = propsRef.current.zIndex + 100` and call `onHoverChange(content.getBoundingClientRect())`
    - `pointerleave` on `content`: when `e.pointerType === 'mouse'`, restore `propsRef.current.zIndex` and call `onHoverChange(null)`
  - Pass `content` through the constructor, since the instance `.content` setter is deprecated. Do not use `addListener` or `'click'`, which were deprecated in 3.66.
- **Sync.** Separate effects copy `position` (deps on the `lat` and `lng` numbers, not the object), `title`, `zIndex`, `collisionBehavior` and `anchorTop` (`centred ? '-50%' : '-100%'`) onto the existing marker. Re-renders must never recreate it.
- `return createPortal(children, content)`.

### New: `src/components/Map/MarkerFaces.tsx`

Pure presentational faces. Each root is `<div className="mk mk-{kind} …" style={{ '--c': color } as React.CSSProperties}>`. The only state is the done-badge transition below. Faces take no event handlers: `MapMarker` owns click and hover.

- **`StopFace({ initials, color, status, isViewing, showLabel, name, isLanding })`**, where `status` is `'past' | 'current' | 'upcoming'`.
  - Classes: `is-past` / `is-today` / `is-upcoming`, `is-viewing`, `has-label`, and `mk-drop` when `isLanding`.
  - Children, in order:
    - `.mk-halo`
    - the `mk-shape` SVG (viewBox `-4 -4 44 44`), with the stop path drawn twice: `.mk-sel`, then `.mk-body`
    - `.mk-glyph` with the initials
    - `.mk-pill` with `BedIcon` (size 13, `weight="fill"`), the name in a `<span>`, and `<em>· today</em>` when current
  - No check badge.
- **`ActivityFace({ color, Glyph, name, isDone, isSelected, isNext, enterIndex })`**.
  - Classes: `is-done`, `is-selected`, and `mk-enter` when `enterIndex` is defined (it sets `--enter-index`).
  - Children, in order:
    - the `mk-shape` SVG (viewBox `-4 -4 38 39`)
    - `.mk-glyph` with `<Glyph size={16} weight="fill" />`
    - the done badge
    - `.mk-pill` with the name
    - `.mk-next` "Next" when `isNext && !isDone`
- **`WaypointFace({ name, isDone, isSelected, enterIndex })`**: `.mk-dia`, `.mk-glyph` with `MountainsIcon` (size 12), the done badge, `.mk-pill`. Color comes from `WAYPOINT_MARKER`.
- **`PoiFace({ Glyph, name })`**: `.mk-disc` and `.mk-glyph` with `<Glyph size={14} weight="fill" />`. No pill and no selected state; `name` is only for the test hook (`data-name`).
- **`DotFace({ color, isDone, kind })`**, where `kind` is `'activity' | 'waypoint'`: `<div className="mk mk-dot …" />`, adding `is-wp` for a waypoint and `is-done` when done.
- **Done badge** (activity and waypoint):
  - While `isDone`, render `.mk-check` with `CheckFatIcon` (size 8, `weight="bold"`).
  - It animates (`animate-check-pop` on the badge plus a sibling `<span className="mk-ripple" />`) only when `isDone` turned true *after* the face mounted. A face that mounts done shows it still.
  - Unticking and ticking again while mounted animates again.
  - Track the previous value, for example by holding `animateTick` state that is set when a `false → true` transition is seen. The badge unmounts while not done, so each re-tick mounts it fresh with the animation class.
- **Paths:**
  - pin: `M15 35L10.9 27.4A13 13 0 1 1 19.1 27.4Z`
  - stop: `M12 2H24A10 10 0 0 1 34 12V24A10 10 0 0 1 24 34H22L18 40L14 34H12A10 10 0 0 1 2 24V12A10 10 0 0 1 12 2Z`

  The SVGs are `aria-hidden`, since the marker's `title` carries the meaning.

### Changed: `src/config/mapsLoader.ts`

- `libraries: ['places', 'marker']`. Both loaders share this object, so `useJsApiLoader` sees identical options.
- `export const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || 'DEMO_MAP_ID';`. `DEMO_MAP_ID` renders an unstyled map and is for development only; the real ID carries the cloud style.

### Changed: `src/components/Map/MapContainer.tsx`

- **Delete:**
  - `customMapStyle` and the `styles` option; add `mapId: MAP_ID`
  - `getBaseStatus`
  - `getAccommodationPinIcon`, `getActivityPinIcon`, `getScenicWaypointPinIconFn` and `getSearchResultPinIcon`
  - the three marker-ref maps
  - the legacy DROP code: every `setAnimation` and `google.maps.Animation` use, and the waypoint stagger timers
  - `getScreenPosition`
- **Keep the stop-change effect.** It is the only caller of `animateStopHop`; only its DROP block goes. Likewise the selected-activity effect keeps `centerAndZoomOnLocation` and loses only its DROP block.
- **Arrival gate.**
  - Add `landedStopId: string | null` state.
  - When the stop-change effect starts a hop, it sets `landedStopId` to `null` first.
  - `animateStopHop(from, to, stopId)` publishes `setLandedStopId(stopId)` on every path:
    - from `flyCamera`'s `onDone`
    - in the reduced-motion branch, immediately
    - when `mapInstance` is missing, immediately
  - A cancelled hop never calls `onDone` (`flyCamera`'s cancel flag), and every new hop cancels the in-flight one through `clearTravelViz`. So only the active hop can publish, and going A → B → A before B lands still waits for A's own landing.
- **Today:** `const today = useTripToday(tripData.timezone)`; stop status is `getStopTimeStatus(stop, today)`.
- **Zoom:**
  - `isZoomedOut: boolean`, from a `zoom_changed` listener on `mapInstance` (`(map.getZoom() ?? 0) < 11`), plus an initial read when the map loads. Remove the listener on cleanup.
  - React skips a re-render when the boolean doesn't change, so the fractional-zoom frames of a hop cost nothing.
- **Render**, inside `isMapLoaded && tripData?.stops`:
  - **Every stop:**
    - `MapMarker`, default anchor, zIndex 30 when viewing and 10 otherwise, plus a `StopFace`.
    - Face inputs:
      - `color`: `getStopColor(index).color`
      - `initials`: `getStopInitials(stop.name)`
      - `status`: `getStopTimeStatus(stop, today)`
      - `isViewing`: `stop_id === currentBaseId`
      - `showLabel`: `isViewing && isZoomedOut`
      - `isLanding`: `isViewing && landedStopId === stop_id`
    - Key the face on `` `${stop_id}-${landedStopId}` `` so the drop replays on each landing.
    - Title: `{name} - {accommodation name}, {today|past|upcoming}`, or `{name}, {status}` when there is no accommodation.
    - Click calls `onBaseSelect`.
  - **Activities and waypoints**, only when `landedStopId === currentBaseId`: the viewed stop's activities and waypoints that have a location.
    - Enrich activities first (`enrichActivityWithType`). Use the enriched object for the marker, the title and the hover card, so an inferred restaurant shows its fork-knife chip.
    - `nextId = partitionByVisit(enrichedActivities, waypoints).planned[0]?.activity_id` ([tripUtils.ts](../../src/utils/tripUtils.ts)).
    - `isDone`: `activityStatus[id]`. A waypoint is also done when `waypoint.status?.done` is set.
    - `isSelected`: `id === selectedActivityId`.
    - When zoomed out and not selected, render a `DotFace`, `centred`. Otherwise render an `ActivityFace` or `WaypointFace`, waypoints `centred`.
    - `enterIndex` counts across activities, then waypoints, in render order.
    - zIndex: 40 when selected, 15 when done, 20 otherwise.
    - Title: `{name}`, plus `, done` or `, next up`.
    - Click calls `onActivitySelect`.
  - **Search results:**
    - `MapMarker`, `centred`, zIndex 25, `collisionBehavior` `google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY`, title `{name}, search result`.
    - `PoiFace` with the glyph of `getActivityMarker(inferActivityTypeFromGooglePlaces(poi.types ?? []))`.
    - Click behaviour is unchanged.
- **Hover:** `onHoverChange(rect)` from `MapMarker` sets `hoverState` with `position = { x: rect.left + rect.width / 2, y: rect.bottom }`. `PlaceHoverCard` is `position: fixed`, so viewport coordinates are exactly what it needs. `null` clears it. The `HoverState` shape stays, plus `stopColor` for the accommodation chip.
- **Styles:** `import '@/assets/styles/map-markers.css'` replaces the `map-animations.css` import.
- **Route:** `DirectionsRenderer` gets `preserveViewport: true`. Every trip edit re-fetches the route, and each new result used to re-fit the map to the whole trip. A check-off then threw the camera out to the overview, every marker turned into a dot, and the done motion was never seen.

### Changed: `src/components/Map/PlaceHoverCard.tsx`

- Replace the emoji type icon with a `.mk-chip`:
  - activity: `getActivityMarker(activity.activity_type)`
  - scenic waypoint: `WAYPOINT_MARKER`
  - accommodation: `BedIcon` on a new optional `stopColor` prop, default `var(--marker-other)`
- Glyph size 12, `weight="fill"`. The type label text and everything else stay.

### Changed: `src/utils/activityUtils.ts`

- Delete `getActivityTypeColor`, `getActivityTypeSvgPath`, `getAccommodationSvgPath` and `getScenicWaypointSvgPath`, and their `describe` blocks in `activityUtils.test.ts`. MapContainer is their only caller.
- Keep `getActivityTypeIcon`: cards, todos and the todo form use the emoji.

### Dependencies and types

- Add `@phosphor-icons/react` ^2.1.10 (MIT, React ≥16.8) to `dependencies`.
- `@react-google-maps/api` 2.20.8 pins `@types/google.maps` to 3.58.1, which predates `anchorTop`. Changes:
  - add `@types/google.maps` ^3.66.0 to `devDependencies`
  - add `"pnpm": { "overrides": { "@types/google.maps": "^3.66.0" } }` to `package.json`, so one copy of the global types exists
  - `tsconfig.app.json` `types` becomes `["node", "google.maps"]`
- Commit-ready lockfile: `pnpm-lock.yaml` must be updated by the install. CI runs a frozen install.

### Map style and environment

- Export the deleted `customMapStyle` array verbatim as `docs/architecture/map-style.json`, for the Cloud Console JSON import.
- `.env.local.example`: add `VITE_GOOGLE_MAPS_MAP_ID=` with a one-line comment (Map ID that carries the cloud style; empty falls back to DEMO_MAP_ID, development only).
- CLAUDE.md's env list gains the variable.

## Tests

- **`src/utils/__tests__/stopPalette.test.ts`:**
  - initials:
    - "Lake Tekapo" → "LT"
    - "Queenstown" → "Q"
    - "Mount Cook Village" → "MC"
    - "Te  Anau" → "TA"
    - "\tTe Anau" → "TA"
  - `getStopColor(12)` equals `getStopColor(0)`
  - every entry's `color` is a `var(--color-*-700)` string matching its `base` class
- **`src/components/Map/__tests__/markerCategory.test.ts`:**
  - every `ActivityType` value has an entry
  - the family grouping matches the table
  - an undefined or unknown type falls back to `other`
  - no family token names a functional color (sky, emerald, orange, red, amber)
- **`src/utils/__tests__/dateUtils.test.ts`**, `getStopTimeStatus(stop, today)` for a 2026-11-10 to 2026-11-12 stop:
  - "2026-11-09" → upcoming
  - "2026-11-10" → current
  - "2026-11-12" → current
  - "2026-11-13" → past
- **`src/components/Map/__tests__/MarkerFaces.test.tsx` (RTL):**
  - ActivityFace:
    - done shows `.mk-check` without `animate-check-pop` when mounted done
    - rerendering false → true adds it, plus `.mk-ripple`
    - true → false → true animates again
    - selected adds `is-selected`
    - Next renders only when not done
  - StopFace: `is-upcoming` / `is-today` / `is-past`, no `.mk-check` on past, and `has-label` only with `showLabel`
  - DotFace: `is-wp` for a waypoint, `is-done` when done
- **`src/components/Map/__tests__/MapMarker.test.tsx`** (with the `FakeMarker` below):
  - creates one marker with every prop applied at construction
  - prop changes update the same instance
  - `gmp-click` calls the latest `onClick` after a rerender with a new handler
  - a mouse `pointerenter` raises zIndex by 100 and calls `onHoverChange` with a rect; `pointerleave` restores the *current* zIndex
  - a touch `pointerenter` does nothing
  - unmount sets `map` to null and removes the listeners
  - under `<StrictMode>`, exactly one live marker remains attached
- **`src/components/Map/__tests__/MapContainer.test.tsx`**, mock changes:
  - `@react-google-maps/api` mock: drop `Marker`, add `useGoogleMap: () => mockMap`; `mockMap.addListener` returns `{ remove }`, and `mockMap.getZoom` is controllable
  - `window.google.maps`:
    - drop `Animation`, `Size` and `Point`
    - add `CollisionBehavior` and `marker.AdvancedMarkerElement` (a `FakeMarker`)
    - keep or add the travel-viz APIs the stop hop still uses: `Marker` (`setMap`, `setPosition`, `setOpacity`), `SymbolPath.CIRCLE` and `Polyline` (`setMap`, `setPath`, `setOptions`)
  - `FakeMarker`:
    - wraps a div whose `title` mirrors the setter
    - appends the `content` option into that div
    - its `map` setter attaches the div to `document.body`, and `null` removes it, or nodes leak across tests
    - `addEventListener` and `removeEventListener` delegate to the div
    - records constructor options and the latest `zIndex`, `collisionBehavior` and `anchorTop`
  - `flyCamera` is a controllable mock. It records each call's `onDone` and returns a cancel spy, and the test calls `onDone` to land.
  - a two-stop trip fixture
  - drop the CSS mock and the `getActivityTypeColor` spy and its block
- MapContainer cases:
  - markers are found by title (`"Test Stop 1 - Test Hotel, …"`)
  - `gmp-click` on a stop marker calls `onBaseSelect`; on an activity, `onActivitySelect`
  - activities are absent before the hop's `onDone` and present after it
  - A → B → A: B's hop is cancelled, and A's activities appear only after A's own `onDone`
  - under reduced motion, activities render with no `flyCamera` call
  - a selected activity carries `is-selected`; a done activity's title ends in ", done"; the first planned one's title ends in ", next up"
  - rerendering with a new `selectedActivityId` constructs no new `AdvancedMarkerElement`
  - at zoom 9 an unselected activity renders as `.mk-dot` and a selected one does not
  - search results carry the optional collision behaviour
- `TripPage` tests pass. There are no `TimelineStrip` tests; its unchanged look is checked in the browser gate.

## Out of scope

- The stop-hop pulse dot, halo and trail (legacy markers, still work).
- Panel cards' emoji and the violet scenic-waypoint styling in the panel.
- Activity type inference.
- Clustering.

## Release prerequisite and owner steps

A push to `main` deploys production, so these come **before** merging:

1. Google Cloud Console → Map Management: create a JavaScript Map ID (raster).
2. Map Styles: import `docs/architecture/map-style.json`, apply it to roadmap, and link it to the Map ID. Google calls the legacy-JSON conversion approximate, so compare against the current production map:
   - land, water and natural colors
   - roads
   - business POIs hidden
   - transit hidden
3. Set `VITE_GOOGLE_MAPS_MAP_ID` in `.env.local` and in the Vercel project (Preview and Production).

Without it the map runs on `DEMO_MAP_ID`: unstyled, development only, and not acceptable in production. The local browser gate runs on `DEMO_MAP_ID` and cannot check style parity; step 2's comparison is the owner's.

## Review changes

Spec review round 1 (deep_reasoner, `job-2026-10-17T22-45-42-80020-spec-review`).

Blocking, all accepted:
1. The stop-change effect is kept (it alone calls `animateStopHop`), and only the active hop can publish a landing.
2. Done and past faces get a gray-800 glyph; white on the muted fill was about 2:1.
3. Overview dots keep kind (circle or diamond) and done (hollow) as non-color cues. Their 24px targets are stated as an AA choice, not 44px.
4. Stop status is a pure string comparison against the trip-local `useTripToday`. This fixes the root cause rather than patching the NZ helpers.
5. Search results have no selected state.

Advisory, all accepted:
- latest props through a ref, every prop applied at construction, and all listener cleanup
- controllable `flyCamera`, A → B → A, the travel-viz mocks, and `MapMarker` lifecycle tests
- reduced motion zeroes the stagger and keeps a static halo; the timing claim is corrected
- `MapMarker` owns hover (mouse only), and the hover card gets the enriched activity
- done transitions are tracked, so a re-tick animates
- stop colors use Tailwind 4 variables
- Map ID before merge, and the owner checks style parity

Also: T1's acceptance no longer cites nonexistent TimelineStrip tests, T2's `rg` check is fixed, and past stops lose the check badge, which would have clashed with the timeline's completion seal.

Implementation review (driver, after T2):
- A selected face mounted from an overview dot waited out its entrance stagger (up to 450ms). `.mk.mk-enter.is-selected` now has no delay.
- The browser gate found the route re-fit described under **Route** above. The bug predates this work, but the dot tier made it hide the done motion. Fixed with `preserveViewport`, plus a test that fails without it.
