# POI Search Functionality Implementation

## Summary

Add a search bar to the Activities Panel that queries Google Maps Places API for POIs biased to the current trip stop location. Search results display as detailed cards below the search bar and as pins on the map.

## Key Changes

### 1. State Management (`src/contexts/AppStateContext.tsx`)

Add new state and actions for POI search:

- New state: `poiSearchResults`, `poiSearchQuery`, `poiSearchLoading`, `poiSearchError`
- New actions: `SET_POI_SEARCH_RESULTS`, `SET_POI_SEARCH_QUERY`, `SET_POI_SEARCH_LOADING`, `SET_POI_SEARCH_ERROR`, `CLEAR_POI_SEARCH`

### 2. PlacesService Enhancement (`src/services/placesService.ts`)

Add location-biased text search method:

- Create `textSearchWithLocationBias(query, location, radius)` method
- Use current stop's accommodation coordinates as search center
- Default radius ~5000m for local search

### 3. New Component: POISearchResultCard (`src/components/Cards/POISearchResultCard.tsx`)

Detailed POI card component with:

- Place photo (when available)
- Name, type tags, rating/reviews
- Address, opening hours, business status
- "Add to Activities" button (reuse existing logic from MapContainer)
- "Open in Google Maps" link

### 4. ActivitiesPanel Layout Changes (`src/components/Activities/ActivitiesPanel.tsx`)

Restructure bottom section:

- Move Download button out of Activities section to panel footer
- Add search bar row: text input + search icon button + clear (X) button
- Rename Download label to "💾 Download"
- Add search results section below search bar (scrollable within panel)

### 5. Map Integration (`src/components/Map/MapContainer.tsx`)

Add search result pins:

- Render pins for `poiSearchResults` array from state
- Use distinctive pin style (different from activities/waypoints)
- Clear pins when search is cleared

### 6. Documentation Updates

- `docs/specs/travel-journal/requirements.md`: Add Requirement 15 for POI Search
- `docs/specs/travel-journal/design.md`: Add POISearchResultCard component, update ActivitiesPanel layout
- `docs/specs/travel-journal/tasks.md`: Add Task 22 for POI Search implementation

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/AppStateContext.tsx` | Add search state and actions |
| `src/services/placesService.ts` | Add location-biased search method |
| `src/components/Cards/POISearchResultCard.tsx` | New component |
| `src/components/Activities/ActivitiesPanel.tsx` | Layout restructure, search bar |
| `src/components/Map/MapContainer.tsx` | Render search result pins |
| `docs/specs/travel-journal/requirements.md` | Add Requirement 15 |
| `docs/specs/travel-journal/design.md` | Component documentation |
| `docs/specs/travel-journal/tasks.md` | Add Task 22 |

## Implementation Order

1. Update state management with search actions
2. Add location-biased search to PlacesService
3. Create POISearchResultCard component
4. Update ActivitiesPanel layout (move Download, add search bar)
5. Implement search functionality in ActivitiesPanel
6. Add search result pins to MapContainer
7. Update documentation files