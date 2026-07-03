# Wanderlog Functional Requirement Specification

## 1. Overview
**Project Name:** Wanderlog  
**Type:** Mobile-friendly Single Page Application (SPA)  
**Framework:** React + Vite + TypeScript  
**Deployment Target:** GitHub Pages (`https://kevinlin.github.io/wanderlog/`)  
**Map Provider:** Google Maps (via `@react-google-maps/api`)  
**Data Source:** Static JSON file (`/trip-data/202512_NZ_trip-plan.json`) with support for user-uploaded JSON in future.

The application will display an **interactive map-based travel journal** with day-based progression, activity cards, and route polylines.

---

## 2. Functional Requirements

### 2.1 Core Features
- Always-on **map background** with Google Maps.
- **Base-to-base route polyline** using Google Directions API (prefetched on load).
- **Scenic waypoints** (e.g., Lindis Pass, Crown Range) included as part of route segments.
- **Pins** for:
  - Accommodation (1 per base)
  - Activities (multiple per base)
- **Detail views**:
  - Accommodation card fixed at the top.
  - Activities displayed as a vertical list + corresponding map pins.
- **Activity cards**:
  - Title + thumbnail
  - Address/location
  - Travel time from accommodation
  - Duration
  - URL link (official/booking)
  - Remarks
  - "Mark Done" checkbox
  - "Navigate in Google Maps" action
- **Timeline strip**:
  - Bases only, length proportional to stay duration.
  - Swipeable horizontal carousel.
  - Auto-focus on today’s base (NZ local time).
- **Status coloring (pins & cards):**
  - Past: greyed (40% opacity)
  - Current: teal (brand color)
  - Upcoming: normal (70–80% opacity)
- **Reordering activities**:
  - Drag-drop in list view
  - Order persisted in LocalStorage and exported JSON.
- **Weather integration:**
  - Client-side fetch from Open-Meteo API (daily high, low, precipitation chance).
  - Cache per stop in LocalStorage.
- **Export functionality:**
  - “Download Updated Trip JSON” (with done states + manual order).

### 2.2 Data Persistence
- **LocalStorage**:
  - Done states
  - Manual order overrides
  - Last viewed day/base
- **Download JSON**: merges LocalStorage states back into trip data.

### 2.3 Navigation & Interaction
- Navigation between bases:
  - Timeline strip (swipe/tap)
  - Tapping pins or route segments
- Activity pin ↔ list synchronization:
  - Tapping pin highlights activity card.
  - Tapping card highlights pin.

### 2.4 Styling & Aesthetic
- **Theme:** Travel-journal aesthetic
- **Color palette:** Alpine teal, lake blue, fern green, sandy beige
- **Custom Google Map style:** Softer pastel colors, reduced POI clutter
- **UI:** Map background + floating journal-style cards

---

## 3. Architecture & Technical Decisions

### 3.1 Frontend
- **React + Vite + TypeScript**
- **@react-google-maps/api** for Google Maps integration
- **React DnD or similar** for drag-drop reordering
- **LocalStorage** for client persistence
- **Static JSON** (fetched from `/wanderlog/trip-data/...json`)

### 3.2 Data Schema Extensions
```json
{
  "trip_name": "string",
  "timezone": "Pacific/Auckland",
  "stops": [
    {
      "stop_id": "string",
      "name": "string",
      "date": {"from": "YYYY-MM-DD", "to": "YYYY-MM-DD"},
      "location": {"lat": number, "lng": number},
      "duration_days": number,
      "travel_time_from_previous": "string",
      "scenic_waypoints": [
        {"lat": number, "lng": number, "label": "string"}
      ],
      "accommodation": {
        "name": "string",
        "address": "string",
        "check_in": "YYYY-MM-DD hh:mm",
        "check_out": "YYYY-MM-DD hh:mm",
        "confirmation": "string",
        "url": "string",
        "thumbnail_url": "string|null"
      },
      "activities": [
        {
          "activity_id": "string",
          "activity_name": "string",
          "location": {"lat"?: number, "lng"?: number, "address"?: "string"},
          "duration": "string",
          "travel_time_from_accommodation": "string",
          "url": "string",
          "remarks": "string",
          "thumbnail_url": "string|null",
          "order": number,
          "status": {"done": boolean}
        }
      ]
    }
  ]
}
```

### 3.3 Deployment
- **GitHub Pages** project site: `/wanderlog/`
- **Vite config:** `base: '/wanderlog/'`
- **GitHub Actions workflow:**
  - Build on push to `main`
  - Inject Google Maps API key via GitHub Secret (`GOOGLE_MAPS_API_KEY`)
  - Deploy to GitHub Pages using `actions/upload-pages-artifact` + `actions/deploy-pages`

### 3.4 API Keys & Security
- Google Maps API key stored as GitHub Secret.
- Injected at build with Vite env var: `VITE_GOOGLE_MAPS_API_KEY`
- Referrer restrictions enabled in Google Cloud Console.

---

## 4. Error Handling
- **Map loading failure:**
  - Show placeholder grid background with overlay “Map unavailable”.
- **Directions API quota exceeded:**
  - Fall back to straight-line polyline.
- **Weather API failure:**
  - Show “Weather unavailable” placeholder.
- **LocalStorage full/unavailable:**
  - App still usable but without persistence.
- **Invalid JSON schema:**
  - Show error “Trip file format invalid”.

---

## 5. Testing Plan

### 5.1 Unit Tests
- JSON schema validation
- LocalStorage persistence utilities
- Activity reordering logic
- Date progression logic (always NZ time)

### 5.2 Integration Tests
- Map renders with base + activities
- Route polyline displays correctly with scenic waypoints
- Activity list ↔ pin sync works both directions
- Weather fetch populates forecast correctly

### 5.3 Manual QA Checklist
- Deploy build loads correctly at `/wanderlog/`
- Today’s base auto-focused (NZT)
- Drag-drop reordering persists across refresh
- “Download Trip JSON” includes updated state
- “Mark Done” toggles persist
- Offline test: disable network → JSON still loads, no map/route

---

## 6. Future Enhancements
- User-uploaded trip JSON
- Photo thumbnails from Google Places API
- Offline-first full map caching
- Multi-user sync with backend
- Trip summary dashboard
- More family-specific flags with icons

---

✅ This specification gives a developer everything needed to begin implementing Wanderlog MVP immediately.

