# Wanderlog Travel Journal - Implementation Tasks

## Implementation Plan

This document is the worklist for building the Wanderlog Travel Journal application. Each task built incrementally on previous steps, following test-driven development for core business logic. Design rationale and acceptance criteria live in the sibling specs:

- Design: [design_travel-journal.md](design_travel-journal.md)
- Requirements: [requirements_travel-journal.md](requirements_travel-journal.md)
- Cloud storage was added later — see [plan_firebase-integration.md](plan_firebase-integration.md).

### Task Checklist

- [x] 1. **Project Setup and Foundation** — Scaffolded React + Vite + TypeScript (strict), installed core deps (Tailwind, `@react-google-maps/api`, `@dnd-kit`, date-fns), configured the GitHub Pages base path, and defined the core domain types (`TripData`, `TripBase`, `Activity`, `ActivityType`, `UserModifications`, plus weather/map types). (Requirements 11.1, 11.2, 11.4, 5.1, 5.2, 1.6, 1.7)

- [x] 2. **Data Services and Core Infrastructure** — Built `tripDataService` (JSON load + schema validation), `storageService` (LocalStorage user-mods + weather cache with legacy-format migration), date/map/validation/export utilities, and `activityUtils` keyword-based type inference; stood up Vitest + React Testing Library with 95+ passing tests. (Requirements 9.4, 5.6, 5.1–5.3, 9.3, 2.3, 3.4, 1.6)

- [x] 3. **Global State Management and Context** — Implemented `AppStateContext` with `useReducer` (SET_TRIP_DATA, SELECT_BASE, SELECT_ACTIVITY, TOGGLE_ACTIVITY_DONE, REORDER_ACTIVITIES, SET_WEATHER_DATA) and custom hooks (`useAppState`, `useTripData`, `useLocalStorage`). (Requirements 2.6, 2.7, 3.6, 5.4, 10.3)

- [x] 4. **Layout Components and Error Handling** — Added `ErrorBoundary`, `LoadingSpinner`, `ErrorMessage`, and `LocationWarning`, and wired `App.tsx` to `AppStateProvider` with global data loading and graceful degradation. (Requirements 9.6, 10.3, 1.10, 3.15, 3.16, 5.4)

- [x] 5. **Google Maps Integration** — Built `MapContainer` with custom pastel styling and a grid-background load fallback, type-specific pins (accommodation as the primary marker, 1.5x sizing, shadows, hover scaling, card sync), and `TripRoute` polylines via the Directions API with a straight-line fallback. (Requirements 1.1–1.9, 3.4, 9.1, 9.2)

- [x] 6. **Timeline Navigation (Floating Panel)** — `TimelineStrip` frosted-glass floating panel with proportional sizing, NZ-timezone auto-focus on today, Sky-500 status colors, swipe navigation, and mobile-responsive touch targets. (Requirements 2.1–2.6, 7.3, 11.2, 11.3)

- [x] 7. **Expandable Activities Panel** — `ActivitiesPanel` floating expandable panel with `ActivityCard` (travel time, mark-done, selection/hover states, location warnings), pin↔card sync + scroll-to, and `@dnd-kit` drag-and-drop reordering persisted to LocalStorage. (Requirements 3.1–3.16, 11.2)

- [x] 8. **Accommodation Display Components** — `AccommodationCard` inside the panel (check-in/out, confirmation, thumbnail, host/rooms, location warnings) plus one accommodation pin per base. (Requirements 4.1–4.5, 1.10, 3.15, 3.16, 11.3)

- [x] 9. **Weather Integration** — `weatherService` (Open-Meteo fetch, LocalStorage cache with expiration), `WeatherCard`, and `useWeather` hook integrated into the panel with an "unavailable" fallback. (Requirements 6.1–6.5)

- [x] 10. **Data Export** — `exportService` merges LocalStorage modifications (done status, manual order) into the original trip data and downloads JSON via a "Download Updated Trip JSON" button with toast feedback. (Requirements 5.5, 5.6)

- [x] 11. **Responsive Design and Mobile Optimization** — Applied responsive Tailwind classes across components, touch-optimized the map (`gestureHandling: 'greedy'`), 44px tap targets, and touch-friendly drag-and-drop with global CSS touch tuning. (Requirements 7.1–7.5)

- [x] 12. **Mobile Layout and Panel Management** — Mobile timeline pinned top full-width; `ActivitiesPanel` slides up from the bottom on selection with a collapse control and a single unified scroll container maximizing space (`calc(100vh - 5rem)`). (Requirements 8.1–8.8)

- [ ] 13. **Error Handling and Fallback Mechanisms** *(outstanding)* — Network/offline detection + status display, API timeout + retry logic, and graceful degradation for map/Directions failures so core functionality works without external services. (Requirements 9.1, 9.2, 9.5, 10.4)

- [x] 14. **Enhanced Pin Visibility and Location Validation** — 1.5x pins with a vibrant palette, SVG shadows, and hover scaling; `LocationWarning` + validation helpers (`hasLocationIssues`, `activityHasLocationIssues`, `accommodationHasLocationIssues`, 13 tests); frosted-glass consistency across floating panels. (Requirements 1.8–1.10, 3.15, 3.16, 11.1–11.3)

- [x] 15. **Scenic Waypoints Enhancement and Integration** — Extended the `ScenicWaypoint` type to an activity-like shape, added the violet `ScenicWaypointCard`, a root-level collapsible waypoints section (non-draggable to preserve trip order), and map pins with staggered drop animations. (Requirements 3.17–3.26)

- [x] 16. **Point of Interest (POI) Discovery and Integration** — `POIDetails`/modal types, `PlacesService` (place details + type inference from Google Places types), `POIModal`, clickable map POIs, an "Add to Activities" flow, and reducer actions (SET_POI_MODAL, CLOSE_POI_MODAL, ADD_ACTIVITY_FROM_POI); includes card button-layout refinements (16.9–16.12) and POI test coverage. (Requirements 12.1–12.13, 3.7, 3.8, 3.14, 3.22)

- [x] 17. **Image Viewer and Thumbnail Standardization**
  - [x] 17.1 `ImageViewerModal` — full-screen viewer with backdrop/ESC close, loading + error states, body-scroll lock, and dialog accessibility. (Requirements 5.6–5.12)
  - [ ] 17.2 *(outstanding)* Wire the viewer into `AccommodationCard`; standardize thumbnails to `h-16 w-16`. (Requirements 5.1–5.3)
  - [ ] 17.3 *(outstanding)* Wire the viewer into `ActivityCard`. (Requirements 5.1, 5.2, 5.4)
  - [ ] 17.4 *(outstanding)* Wire the viewer into `ScenicWaypointCard`. (Requirements 5.1, 5.2, 5.5)

- [x] 18. **"Open Maps" Button on Place Cards** — `generateGoogleMapsPlaceUrl` (using `google_place_id`) and a three-button card layout (Details / Open Maps / Direction) across Activity, Accommodation, and Scenic Waypoint cards. (Requirements 3.16, 3.17, 3.24, 3.25, 4.10)

- [x] 19. **Mobile Panel Resize Handle** — iOS-style drag handle replacing the mobile collapse button, with height clamped between a minimum and viewport-minus-timeline and applied via dynamic inline height. (Requirements 9.3, 9.4, 9.5, 9.9)

- [x] 20. **Enhanced Pin Icons and Hover Interactions** — Material-Design SVG pin icons, glow pulse/hover animations via SVG filters, and a non-interactive `PlaceHoverCard` popover driven by MapContainer hover handlers. (Requirements 1.17–1.21)

- [x] 21. **Map Layer Picker** — `MapLayerPicker` (map type + Traffic/Transit/Bicycling overlays) integrated into MapContainer, with layer preferences persisted in `storageService` behind validation fallbacks. (Requirements 1.22–1.35)

- [x] 22. **POI Search** — POI search state + actions, `PlacesService.textSearchWithLocationBias`, `POISearchResultCard`, a restructured panel footer with a search bar, and rose/coral search-result map pins. (Requirements 15.1–15.12)

- [x] 23. **Place Selection Centering and Map Scale** — `centerAndZoomOnLocation` (`PLACE_ZOOM_LEVEL = 14`) driven by selection-state effects for unified centering from map/panel/timeline, plus Google's built-in scale control. (Requirements 1.32–1.36)

- [x] 24. **Timeline Expand/Collapse** — Persisted `isExpanded` state (defaults expanded), a collapsed single-stop desktop / initials-circle mobile view, and smooth transitions using `getCurrentStop`/`getInitials` helpers. (Requirements 2.13–2.18)

- [x] 25. **Add Scenic Waypoints from POI Modal** — `ADD_SCENIC_WAYPOINT_FROM_POI` reducer action, `handleAddScenicWaypointFromPOI` in MapContainer, and a three-button POIModal footer (Details / Scenic / Activity). (Requirements 13.14–13.17)

- [x] 26. **Scenic Waypoints Route Integration** — Scenic waypoints added as pass-through points (`stopover: false`) in the Directions request with accommodation kept as stopovers, plus waypoint truncation prioritizing stops when exceeding Google's 25-waypoint limit. Convention: waypoints under a stop are on the way *to* that stop. (Requirements 1.3, 1.3a, 1.3b)

## Implementation Notes

- Each task built incrementally on previous tasks.
- Test-driven development was prioritized for core business logic.
- All external API integrations include error handling and fallbacks.
- Mobile-first responsive design throughout.
- User data persistence started on LocalStorage and was later extended to Firestore (see [plan_firebase-integration.md](plan_firebase-integration.md)).

## Changelog

- 2026-07-03 — **Compacted post-implementation.** Collapsed each task's file-by-file implementation bullets into one-line intents while preserving task titles, completion status, and requirement references. Outstanding work (Task 13 and 17.2–17.4) retained as unchecked follow-ups. Full step-by-step detail is recoverable via git history; design and acceptance criteria live in the sibling design/requirements specs.
