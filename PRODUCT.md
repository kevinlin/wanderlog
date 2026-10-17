# Product

<!-- impeccable:product-schema 1 -->

## Register

product

## Platform

web

## Users

Wanderlog is used by a family traveling together: the trip's owner plus a few relatives who share one plan. Everyone sees the same itinerary; done-status, visit records, ordering and todos are canonical and shared, not private per person. It is not an open, public product with unrelated strangers each in their own silo. The design can assume a handful of people who trust each other and care about the same trip.

A second audience never sees the UI: agents acting as a family member. The in-app agent edits the plan from a natural-language prompt, and the owner's personal agent (Hermes) reads and writes todos over Supabase's REST API and sends WhatsApp reminders. Both work under a family member's login and row-level security, so they can do nothing that person couldn't.

Their context spans two moments. Before the trip they plan at a desk on a larger screen, adding stops, activities, and accommodation. During the trip they pull it up on a phone, on the go, to check what's next and mark things done. Both moments are first-class; there is no "planning mode" versus "travel mode" to switch between, just one plan that has to work at arm's length and in the hand.

## Product Purpose

Wanderlog is a map-based travel journal for planning a trip and then keeping that plan honest as the trip actually happens. Stops, activities, accommodation, and scenic waypoints live on a map and a timeline at once, so a trip is legible both by place and by day.

Success is a plan that stays accurate from the first planning session through the last day — reordered when things change, checked off as they are done, and current for everyone on it — without anyone treating it as paperwork.

## Positioning

A living plan you track as you go. Not a static itinerary document and not a saved-places list: Wanderlog's reason to exist is that the plan changes with the trip. Reorder on the fly, mark things done, and everyone sharing it sees the current state. Every screen should reinforce that the plan is alive and up to date, not a snapshot filed before leaving.

## Brand Personality

Warm and familial, still playful. Wanderlog is the family's shared trip journal, not a booking tool: it holds what was planned and, once ticked, what actually happened (when, for how long, a note in the traveller's words). It should feel personal and a little sentimental, the kind of record you'd scroll back through after the trip, in the voice of a relative who's along for the ride rather than a productivity tool.

The small moments still earn a reward: checking off an activity, watching the timeline fill in, reaching the next stop. That warmth lives in the interactions and the copy, not in decoration (see Anti-references). Light, encouraging, a bit joyful: a plan that is fun to keep up with and a journal worth keeping, never a chore.

## Anti-references

Explicitly not any of these:

- Generic SaaS dashboard — cold, corporate, gray cards in a grid, charts for their own sake.
- Cluttered booking site — ad-dense and upsell-heavy, busy like Expedia or Booking.com.
- Enterprise admin panel — dense tables, form-first, joyless utility.
- Over-designed or trendy — glassmorphism, gradients everywhere, motion for its own sake. Playful is earned through moments and voice, never through visual excess.

Taken together: the trip should always look like a trip — a map, a timeline, real places — never like data entry, and never like a template showing off.

## Capabilities and Constraints

- Map and timeline at once: a trip is ordered stops, each with at most one accommodation plus activities and scenic waypoints.
- Editing in the app: add, reorder, edit and delete, with optimistic updates that roll back with a retry prompt on failure.
- Trip import from a Wanderlog export or TripIt file. Agent-created and imported trips are structurally identical.
- In-app agent: one prompt per request, no stored conversation, no undo. Creates and updates run immediately; item deletes only on explicit request; it cannot delete a trip. After a run the app shows the list of changes.
- Visit records: ticking stays instant. Time, duration and a note are opt-in, offered only on ticked items, and the form works offline. Time is auto-stamped only when today falls inside the trip's dates. Visited items move to their own section, sorted by when they happened.
- Trip todos: booking tasks with optional "from" and "by" dates and optional stop/activity links. A todo counts as active once it can be acted on, and the active count shows wherever you land. Wanderlog never sends reminders; Hermes does. Todos of ended trips stop counting.
- Signed-in only. Everything except sign-in and password reset sits behind auth.
- No push notifications, no service worker, no per-user state.

## Design Principles

- The plan is alive. Every screen reflects the current state: done, reordered, synced. Track-as-you-go is the product, so nothing should read as a stale snapshot.
- Delight in the moments, restraint in the frame. Personality shows up in interactions, microcopy, and small surprises, not in decorative styling. Reconcile "playful" with "not over-designed" by putting the joy in behavior, not ornament.
- Two moments, one plan. Design for the desk (planning) and the hand (on the go) as equals, with no mode switch. A screen that only works well in one of the two is not done.
- Shared and trustworthy. The family relies on the same canonical plan, so state must read as current and correct for everyone; a wrong "done" or a wrong order costs someone in the real world.
- Agents are co-editors. The in-app agent and Hermes write the same plan the family does. Anything an agent changes has to read clearly to a person afterward: what changed, where, and that it is now the current state.
- Nudge, don't nag. Surface what can be acted on now (the active todo count), keep the rest quiet, and stop counting once a trip ends.
- Show the trip, not a form. Lead with map, timeline, and place. When a task risks becoming data entry, find the more visual, direct affordance first.

## Accessibility & Inclusion

Target WCAG 2.1 AA: body text at contrast ≥4.5:1 (large text ≥3:1), full keyboard navigation, and a `prefers-reduced-motion` alternative for every animation — non-negotiable given the playful motion direction.

Because the map and activity status lean on color (markers, done versus not-done), do not encode meaning in color alone; pair it with shape, icon, or label so the plan stays readable for color-blind users and in bright outdoor light on a phone.
