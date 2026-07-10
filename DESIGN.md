---
name: Wanderlog
description: An interactive map-based travel journal — a living plan you track as you go.
colors:
  primary: "#4a9e9e"
  lake-blue: "#6bb6d6"
  fern-green: "#5b8c5a"
  sandy-beige: "#f2e7d5"
  selection: "#0ea5e9"
  success: "#10b981"
  danger: "#ef4444"
  active: "#f97316"
  warning: "#f59e0b"
  ink: "#111827"
  body-text: "#374151"
  muted: "#6b7280"
  border: "#d1d5db"
  surface: "#ffffff"
  surface-subtle: "#f9fafb"
  page-bg: "#f8fafc"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "12px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "44px"
  badge-duration:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "0 6px"
---

# Design System: Wanderlog

## 1. Overview

**Creative North Star: "The Living Field Journal"**

Wanderlog looks like a travel notebook that fills itself in as you go. The whole system is built around one idea from PRODUCT.md — *a living plan you track as you go* — so the interface reads as personal, tactile, and always current, not as a document you filed before leaving. Color is the primary carrier of meaning: a calm teal chrome holds the app together while a bright functional palette tells you at a glance what is selected, what is done, and what needs attention. Interactions spring and respond under the finger; the timeline of stops is a colorful row of markers you swipe through like flipping to today's page.

The register is a working tool, so clarity wins over decoration. Density is deliberately high — text-sm is the base size, information sits close together — because the same screen has to work at a desk during planning and in the hand at arm's length while traveling. Personality is earned through behavior and warmth (emoji markers, springy presses, a rainbow timeline, encouraging copy), never through visual excess. This is the reconciliation of "playful" with "not over-designed": the joy lives in the motion and the color-coding, not in gradients, glass panels, or ornament.

The system explicitly rejects every anti-reference in PRODUCT.md: the cold gray card-grid of a **generic SaaS dashboard**, the ad-dense busyness of a **cluttered booking site**, the joyless form-first density of an **enterprise admin panel**, and the trend-chasing of **over-designed** work (gradients everywhere, decorative glass, motion for its own sake). A trip should always look like a trip — a map, a timeline, real places — never like data entry.

**Key Characteristics:**
- Color carries meaning: teal chrome, and a functional palette for selection / done / danger / active / warning.
- Tactile and responsive: springy press feedback (scale on hover and active), immediate state changes.
- Dense and legible: text-sm base, 44px touch targets, works at desk and on-the-go with no mode switch.
- Warmth through moments: emoji content markers, a rotating rainbow timeline, encouraging microcopy.
- Flat content, floating chrome: soft shadows on cards; glass and blur only where UI floats over the map.

## 2. Colors

A calm teal identity over a bright, high-signal functional palette; neutrals are a cool Tailwind gray scale that keeps the color meaningful by staying quiet.

### Primary
- **Fresh Alpine Teal** (#4a9e9e): The brand voice and the app's chrome. Crisp and outdoorsy — a brighter, more energetic read of teal. Used on primary buttons, links, input focus (border plus a `#4a9e9e` ring at 30% opacity), and any control that represents the main action. Tints of teal (`/10`, `/20`, `/40`) form secondary/ghost buttons and quiet hover fills.

### Secondary
- **Lake Blue** (#6bb6d6): An atmospheric accent, not a workhorse. Appears in the auth-screen gradient and occasional soft backgrounds. Do not press it into service as a second interactive color; selection already belongs to Selection Sky.
- **Sandy Beige** (#f2e7d5): The warm-paper accent that ties back to the "journal" metaphor. Auth-screen gradient and the PWA background/splash. Used sparingly; warmth is a seasoning, not the base.
- **Fern Green** (#5b8c5a): A rarely-used scenic accent. Reserve for nature/scenic contexts; it is not the success color (that is Success Emerald).

### Tertiary — The Functional Palette
Meaning-bearing colors used consistently across cards, panels, and the map. This is where most of the app's color actually lives.
- **Selection Sky** (#0ea5e9): Selected / interactive. A selected card gets a `ring-2` in sky with an offset; in-card icon actions and links tint sky on hover. Sky is the "you are looking at this" color.
- **Success Emerald** (#10b981): Done / complete. The done-status tint on activity cards (`emerald/10` fill, muted text, strike-through) and the checkbox accent. Emerald means finished.
- **Danger Red** (#ef4444): Destructive and error. Delete affordances (`red/10` hover fill, `red-600` icon) and error messaging.
- **Active Orange** (#f97316): Press / active feedback. The momentary tint while a card is being tapped (`active:bg-orange-500/10`). Orange is touch, not state.
- **Warning Amber** (#f59e0b): Caution — location warnings, non-blocking alerts.

### Neutral
- **Ink** (#111827, gray-900): Headings and high-emphasis text.
- **Body Text** (#374151, gray-700): Default body copy and labels.
- **Muted** (#6b7280, gray-500): Secondary text, meta, field labels like "Duration:".
- **Border** (#d1d5db, gray-300): Input strokes, dividers, hairlines.
- **Surface** (#ffffff): Cards, inputs, modals, badges — content sits on white.
- **Surface Subtle** (#f9fafb, gray-50) / **Page Background** (#f8fafc, slate-50): App canvas behind cards.

### Named Rules
**The One Meaning Per Color Rule.** Sky is selection, emerald is done, orange is press, red is danger, amber is warning. Never reassign these. A card can be selected (sky ring) and done (emerald fill) at once, and the two colors must stay legible together.

**The Rainbow Timeline Rule.** Trip stops cycle through a fixed 12-color palette (blue, emerald, violet, orange, rose, cyan, amber, pink, indigo, teal, lime, fuchsia) by index, giving each stop its own bright identity. This is the one place the app is deliberately, joyfully saturated. Everywhere else, color is rationed to meaning.

## 3. Typography

**Display Font:** Inter (with system-ui, sans-serif fallback)
**Body Font:** Inter — one family across the whole app.
**Label Font:** Inter (weight and size carry the distinction, not a second family).

**Character:** One geometric-humanist sans in a tight range of weights (400 / 500 / 600 / 700 — no light or thin). Hierarchy comes from weight and size, not from a contrasting typeface. The result is clean, modern, and quiet enough to let the color and the map do the talking.

### Hierarchy
- **Display** (700, 1.875rem / text-3xl, line-height 1.2): The Wanderlog wordmark and top-level page titles (e.g. the login screen).
- **Headline** (700, 1.25rem / text-xl, line-height 1.3): Section and panel headers.
- **Title** (600, 1rem / text-base, line-height 1.4): Card titles — the activity name, accommodation name.
- **Body** (400–500, 0.875rem / text-sm, line-height 1.6): The dominant text size. Card content, descriptions, list rows. Cap prose at 65–75ch.
- **Label** (500, 0.75rem / text-xs, line-height 1.4): Field labels, meta, badges, timeline dates. Sentence case, not uppercase.

### Named Rules
**The Weight-Not-Family Rule.** Never introduce a second typeface for emphasis. Reach for 600/700 and a size bump. Wanderlog is a one-family system.

**The No-Tracked-Caps Rule.** Labels stay sentence case. No wide-tracked uppercase eyebrows — they read as SaaS scaffolding, an explicit anti-reference here.

## 4. Elevation

Floating chrome, flat content. Content surfaces (cards, panels, modals) are essentially flat, lifted only by a soft `shadow-md` at rest that grows to `shadow-lg` on hover. Depth on content is a gentle response to interaction, not a permanent ornament. Glass and blur are reserved for one job: UI that floats over the live map (the timeline strip, map controls, the offline indicator) uses a translucent white with `backdrop-blur` so the map stays visible behind it. This is the deliberate, narrow exception to the "no decorative glass" line.

### Shadow Vocabulary
- **Resting card** (`box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)` / shadow-md): Default lift for content cards.
- **Hover / selected** (`box-shadow: 0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` / shadow-lg): Response to hover, drag, or selection.
- **Floating chrome** (`shadow-md` + `backdrop-blur-sm` over `bg-white/30`): Timeline and controls over the map.
- **Auth splash** (shadow-2xl over `bg-white/80 backdrop-blur`): The one big, atmospheric moment — the sign-in card on the scenic gradient.
- **Micro-badge** (shadow-xs): Duration badges and tiny floating chips.

### Named Rules
**The Glass-Over-Map-Only Rule.** `backdrop-blur` is permitted only where a surface sits over the map or the auth gradient. Never blur a content card on a solid background — that is the decorative glassmorphism PRODUCT.md rejects.

**The Shadow-Responds Rule.** Content is flat at rest; shadow deepens as feedback (hover, drag, select), then relaxes. Depth is a verb, not a decoration.

## 5. Components

### Buttons
- **Shape:** Gently rounded (rounded-lg, 8px); the floating agent button is more pill-like (rounded-xl, 12px). Touch targets are ≥44px tall.
- **Primary:** Alpine-teal fill, white text, `font-medium`, padding 8px 16px. Hover deepens to teal at 90% opacity, active to 80%; disabled drops to 50% opacity. This is the main-action button everywhere (sign in, confirm, send).
- **Secondary / Tinted:** Teal-tint fill (`bg-alpine-teal/10`) with a teal border (`/40`) and teal text — the quieter "add" and toolbar action.
- **In-card action links:** Small (min-h 30px, rounded-sm), sky border and text, used for Details / Maps / Direction rows. The Direction button is a solid sky fill.
- **Icon buttons:** `p-1.5 rounded-md`, gray-400 at rest, tinting to the relevant meaning color on hover (sky for edit, red for delete).
- **Hover / Focus:** `transition-colors`, ~200ms. Focus-visible must show a ring; keyboard users never lose the focused control.

### Cards / Containers
- **Corner Style:** rounded-lg (8px); larger containers and modals use rounded-xl (12px).
- **Background:** White surface on the slate-50 canvas.
- **Shadow Strategy:** shadow-md at rest → shadow-lg on hover (see Elevation).
- **State overlays:** Selected → `bg-sky-500/10` + `ring-2 ring-sky-500 ring-offset-2`. Done → `bg-emerald-500/10` + 75% opacity + strike-through title. Pressed → `active:bg-orange-500/10`. Dragging → `scale-105 opacity-50 z-50`.
- **Internal Padding:** 12px (p-3) for cards, 24px (p-6) for modals/panels.
- **Content markers:** Emoji lead inline facts (📍 address, 💡 remark) and label actions (🧭 Direction). Emoji is a first-class part of the card language, not a gimmick — it is where the playful register shows up.

### Inputs / Fields
- **Style:** White fill, gray-300 border, rounded-lg, padding 8px 12px, min-height 44px, `text-base` to prevent iOS zoom.
- **Label:** text-sm, `font-medium`, gray-700, sits above the field.
- **Focus:** Border shifts to alpine-teal and a soft teal ring appears (`ring-2 ring-alpine-teal/30`); default outline removed. Never remove focus feedback without replacing it.
- **Error / Disabled:** Error text in Danger Red; disabled controls at reduced opacity.

### Navigation
- Lightweight and contextual, not a heavy app chrome. Chevron and menu controls are ghost icon buttons (`p-2 rounded-lg`, gray-700, hover fills a translucent white `hover:bg-white/30`, `active:scale-95`). Mobile collapses generously; the timeline itself is the primary spatial nav.

### Signature Component — The Timeline Strip
The defining component and the clearest expression of "the plan is alive."
- Each stop is a button whose **width is proportional to nights stayed** (≈100–300px), so the trip's rhythm is visible at a glance.
- Each stop takes its color from the 12-color rotating palette by index; a **duration badge** (rounded-full, white, `shadow-xs`) floats at the top-right.
- **Selected** stop: `ring-2` in its own color + `ring-offset`, a size bump, `shadow-lg`, and a small pointer triangle beneath it.
- **Tactile motion:** `hover:scale-105`, `active:scale-95`, 300ms `ease-in-out`.
- **Mobile:** horizontal swipe advances stops; collapses to a single circular initials avatar in the current stop's color; expand/collapse state persists in localStorage.
- Floats over the map as glass chrome (`bg-white/30 backdrop-blur-sm`, rounded-xl on desktop).

## 6. Do's and Don'ts

### Do:
- **Do** keep one meaning per functional color: sky = selected, emerald = done, orange = press, red = danger, amber = warning. Reuse them everywhere for the same meaning.
- **Do** carry personality through motion, color-coding, and emoji content markers — the playful register lives in behavior, not ornament.
- **Do** hold 44px minimum touch targets and `text-base` on inputs; the same screen is used at a desk and one-handed on a phone.
- **Do** pair every color signal with a non-color cue (icon, strike-through, label). The map and status lean on color, so meaning must survive color-blindness and bright outdoor light.
- **Do** provide a `prefers-reduced-motion` alternative for every spring, scale, and transition — required, not optional.
- **Do** reserve `backdrop-blur` for chrome floating over the map or the auth gradient.
- **Do** build hierarchy from Inter weight and size alone.

### Don't:
- **Don't** ship a **generic SaaS dashboard**: no cold gray card-grid of identical tiles, no charts for their own sake.
- **Don't** drift toward a **cluttered booking site**: no ad-dense, upsell-heavy busyness.
- **Don't** become an **enterprise admin panel**: no joyless dense tables or form-first screens where a map or timeline would tell the story better.
- **Don't** over-design: no gradient fills on content, no gradient text (`background-clip: text` is banned), no decorative glassmorphism on solid backgrounds, no motion for its own sake.
- **Don't** use `backdrop-blur` on a content card sitting on a solid background — glass is map-chrome only.
- **Don't** use wide-tracked uppercase eyebrow labels; keep labels sentence case.
- **Don't** introduce a second typeface for emphasis, or add a colored `border-left` stripe as a card accent.
- **Don't** let muted gray text fall below 4.5:1 contrast on tinted surfaces; bump toward Ink when close.
