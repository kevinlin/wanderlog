# Wanderlog Travel Journal - Implementation Tasks

## Implementation Plan

This document outlines the step-by-step implementation tasks for building the Wanderlog Travel Journal application. Each task builds incrementally on previous steps, following test-driven development practices where appropriate.

### Task Checklist

- [x] 1. **Project Setup and Foundation**
  - [x] 1.1 Initialize React + Vite + TypeScript project structure
    - Create project with Vite template
    - Configure TypeScript strict mode settings
    - Set up project folder structure according to design document
    - **Requirements Reference**: Requirement 11.1, 11.2 (Vite configuration, TypeScript setup)

  - [x] 1.2 Install and configure core dependencies
    - Install React, TypeScript, Tailwind CSS, @react-google-maps/api, @dnd-kit/core, date-fns
    - Configure Tailwind CSS with travel journal color palette
    - Set up Vite configuration with base path '/wanderlog/' for GitHub Pages
    - **Requirements Reference**: Requirement 11.1, 11.4 (GitHub Pages configuration)

  - [x] 1.3 Create core TypeScript interfaces and types
    - Implement TripData, TripBase, Accommodation, Activity interfaces in src/types/trip.ts
    - Add ActivityType enum for pin icon categorization (restaurant, attraction, shopping, outdoor, cultural, transport, other)
    - Implement UserModifications, WeatherData, WeatherCache interfaces
    - Create map-related types (Coordinates, ScenicWaypoint) in src/types/map.ts
    - **Requirements Reference**: Requirement 5.1, 5.2 (data persistence structure), Requirement 1.6, 1.7 (activity and city pin types)

- [x] 2. **Data Services and Core Infrastructure**
  - [x] 2.1 Implement TripDataService for JSON data loading
    - Create tripDataService.ts with loadTripData and validateTripData methods
    - Implement JSON schema validation for trip data structure using comprehensive validationUtils
    - Add error handling for invalid JSON format with detailed error reporting
    - Add optional filename parameter and enhanced error messages
    - **Requirements Reference**: Requirement 9.4 (JSON schema validation), Requirement 5.6 (JSON export structure)

  - [x] 2.2 Implement StorageService for LocalStorage operations
    - Create storageService.ts with getUserModifications, saveUserModifications methods (new UserModifications format)
    - Implement weather cache storage and retrieval functions with expiration handling
    - Add LocalStorage availability detection and fallback handling
    - Include migration from legacy StopStatus format to new UserModifications format
    - Add comprehensive weather caching with validation and expiration
    - **Requirements Reference**: Requirement 5.1, 5.2, 5.3 (LocalStorage persistence), Requirement 9.3 (LocalStorage unavailable handling)

  - [x] 2.3 Create utility functions for date and map operations
    - Implement dateUtils.ts with New Zealand timezone-aware date functions (already exists)
    - Create mapUtils.ts with coordinate distance calculations, bearing, bounds, and map URL generation
    - Implement comprehensive validation utilities in validationUtils.ts with XSS protection
    - Add exportUtils.ts enhancements for new UserModifications format
    - **Requirements Reference**: Requirement 2.3 (NZ local time), Requirement 3.4 (travel time calculations)

  - [x] 2.5 Implement activity type inference system
    - Create activityUtils.ts with inferActivityType function
    - Implement keyword-based activity type detection from activity names
    - Add fallback logic for unknown activity types (default to 'other')
    - Support manual activity type overrides in trip data
    - **Requirements Reference**: Requirement 1.6 (activity-specific pins)

  - [x] 2.4 Set up testing framework and write comprehensive tests
    - Install and configure Vitest, JSDOM, and React Testing Library
    - Create test setup with localStorage mocking and test utilities
    - Write unit tests for TripDataService (JSON loading, validation, error handling)
    - Write unit tests for StorageService (UserModifications, weather cache, migration)
    - Write unit tests for validationUtils (all validation functions, XSS protection)
    - Write unit tests for mapUtils (distance calculations, coordinate utilities, URL generation)
    - [x] Add unit tests for activityUtils (activity type inference, keyword matching)
    - All 95+ tests passing with good coverage of core functionality
    - **Requirements Reference**: All requirements - testing ensures requirement compliance

- [x] 3. **Global State Management and Context**
  - [x] 3.1 Implement AppStateContext with useReducer
    - Create AppStateContext.tsx with state interface and reducer
    - Implement actions for SET_TRIP_DATA, SELECT_BASE, SELECT_ACTIVITY, TOGGLE_ACTIVITY_DONE
    - Add REORDER_ACTIVITIES and SET_WEATHER_DATA actions
    - **Requirements Reference**: Requirement 2.6, 2.7 (timeline navigation persistence), Requirement 3.6 (activity reordering persistence)

  - [x] 3.2 Create custom hooks for state management
    - Implement useAppState hook for accessing global state with backward compatibility
    - Create useTripData hook for data loading with loading and error states using global context
    - Implement useLocalStorage hook for persistent state operations with migration support
    - **Requirements Reference**: Requirement 5.4 (state restoration), Requirement 10.3 (loading indicators)

- [x] 4. **Layout Components and Error Handling**
  - [x] 4.1 Create error boundary and loading components
    - Implement ErrorBoundary.tsx with JavaScript error catching, travel journal styling, enhanced error reporting with unique error IDs, comprehensive logging, and retry functionality
    - Create LoadingSpinner.tsx component with travel journal styling including adventure-themed variant with compass animations, multiple sizes, and enhanced travel-themed loading states
    - Implement ErrorMessage.tsx for displaying user-friendly error messages with contextual error types (network, data, permission), helpful suggestions, and travel journal aesthetics
    - Create LocationWarning.tsx component for displaying location data warnings in activities and accommodation cards
    - **Requirements Reference**: Requirement 9.6 (JavaScript error handling), Requirement 10.3 (loading indicators), Requirement 1.10, 3.15, 3.16 (location warnings)

  - [x] 4.2 Create main App component structure
    - Updated App.tsx to properly use AppStateProvider and global context management
    - Implement proper trip data loading with global state initialization
    - Enhanced error boundary wrapping and comprehensive global error handling with graceful degradation
    - Migrated from legacy useAppState hook to proper global state management using AppStateContext
    - **Requirements Reference**: Requirement 5.4 (state restoration on load), Requirement 9.6 (error handling)

- [x] 5. **Google Maps Integration**
  - [x] 5.1 Implement basic MapContainer component
    - Create MapContainer.tsx with @react-google-maps/api integration
    - Implement custom map styling with pastel colors and reduced POI clutter
    - Add map loading error handling with grid background fallback
    - **Requirements Reference**: Requirement 1.1, 1.4 (Google Maps display, custom styling), Requirement 9.1 (map loading failure)

  - [x] 5.2 Create map pin components with type-specific icons and enhanced visibility
    - Implemented enhanced pin visibility with 1.5x larger sizing than Google Maps defaults for all pin types
    - Removed city pins - accommodation pins now serve as the primary location markers
    - Enhanced accommodation pins with lodge icon using Orange-500 for active states with status-based opacity
    - Implemented activity pins with type-specific SVG paths and vibrant color coding:
      - Restaurant: Fork and knife icon with Orange-500 (#f97316)
      - Attraction: Camera/sightseeing icon with Violet-500 (#8b5cf6)
      - Shopping: Shopping bag icon with Amber-500 (#f59e0b)
      - Outdoor: Mountain/hiking icon with Emerald-500 (#10b981)
      - Cultural: Museum/building icon with Cyan-500 (#06b6d4)
      - Transport: Vehicle icon with Indigo-500 (#6366f1)
      - Other/Default: Flag icon with Sky-500 (#0ea5e9)
    - Added pin shadows using SVG filters for better contrast against map backgrounds
    - Implemented hover state scaling (1.1x) with smooth size transitions
    - Added consistent stroke width and color for icon outlines
    - Integrated pin highlighting when corresponding cards are selected
    - All click handlers properly implemented for pin-card synchronization
    - **Requirements Reference**: Requirement 1.5, 1.6, 1.7, 1.8, 1.9 (accommodation, activity, city pins, enhanced visibility), Requirement 3.4 (pin-card synchronization)

  - [x] 5.3 Implement route visualization with Google Directions API
    - Create TripRoute.tsx component for polyline rendering
    - Implement route fetching with scenic waypoints inclusion
    - Add fallback to straight-line polylines when Directions API fails
    - **Requirements Reference**: Requirement 1.2, 1.3 (route polylines, scenic waypoints), Requirement 9.2 (Directions API fallback)

- [x] 6. **Timeline Navigation Component (Floating Panel)**
  - [x] 6.1 Create floating TimelineStrip component structure
    - [x] Implement TimelineStrip.tsx as floating panel positioned at top-left corner with frosted glass styling
    - [x] Apply consistent styling: `absolute top-4 left-4 rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md`
    - [x] Update App.tsx to position timeline as floating panel over full-screen map
    - [x] Add proportional sizing based on stay duration
    - **Requirements Reference**: Requirement 2.1, 2.2 (floating timeline panel, proportional length), Requirement 11.2 (frosted glass styling)

  - [x] 6.2 Implement timeline navigation and auto-focus with new color palette
    - [x] New Zealand timezone detection for current day calculation (already implemented in dateUtils.ts)
    - [x] Auto-focus on today's base with Sky-500 highlighting (`bg-sky-500`) (already implemented in App.tsx)
    - [x] Timeline base selection handlers with map integration (already implemented)
    - [x] Apply new color scheme: past bases (`bg-sky-500/30`), current (`bg-sky-500`), upcoming (`bg-sky-500/70`)
    - **Requirements Reference**: Requirement 2.3 (NZ local time auto-focus), Requirement 2.6 (timeline base selection), Requirement 11.3 (vivid color palette)

  - [x] 6.3 Add mobile touch support and responsive design
    - [x] Implement swipe gesture handling for timeline navigation (swipe left/right to navigate between stops)
    - [x] Create responsive timeline layout with appropriate gap maintenance on mobile devices (top-2 left-2 on mobile, top-4 left-4 on larger screens)
    - [x] Add smooth transitions (300ms ease-in-out) for state changes
    - [x] Improve touch targets with min-h-[44px] for better mobile usability
    - [x] Add touch-manipulation and select-none classes for better mobile interaction
    - **Requirements Reference**: Requirement 2.4, 2.5 (swipe navigation), Requirement 7.3 (touch optimizations)

- [x] 7. **Expandable Activities Panel Component**
  - [x] 7.1 Create floating ActivitiesPanel component structure
    - Implement ActivitiesPanel.tsx as floating panel positioned at top-right corner with frosted glass styling
    - Apply consistent styling: `absolute top-4 right-4 rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md`
    - Implement expandable/collapsible functionality with smooth transitions (300ms ease-in-out)
    - Default state: Display only accommodation card with expand control at bottom
    - Expanded state: Extend to bottom of screen (`top-4` to `bottom-4`) with collapse control and scroll overflow
    - **Requirements Reference**: Requirement 3.1, 3.2, 3.3, 3.4, 3.5 (floating activities panel, expandable design), Requirement 11.2 (frosted glass styling)

  - [x] 7.2 Create ActivityCard component with new color palette and location validation
    - Enhanced ActivityCard.tsx with comprehensive activity information display including location validation
    - Travel time calculation and display from accommodation already implemented
    - "Mark Done" checkbox with visual feedback using new color palette (Emerald-500 for completed: `bg-emerald-500/10`, opacity-75)
    - Applied hover states with Orange-500 (`hover:bg-orange-500/5`) and selection states with Sky-500 (`ring-2 ring-sky-500 ring-offset-2 bg-sky-500/10`)
    - Implemented location warning indicator when coordinates are missing or invalid using `activityHasLocationIssues` validation
    - Integrated LocationWarning component for activities with location issues, displayed prominently with clear messaging
    - Added LocationWarning component with Amber-500 styling, ExclamationTriangleIcon, and helpful suggestions for address correction
    - **Requirements Reference**: Requirement 3.6 (activity card content), Requirement 3.12, 3.13 (completion status, visual indication with new colors), Requirement 3.15, 3.16 (location warnings)

  - [x] 7.3 Implement activity interactions within expandable panel
    - Add activity card highlighting when map pins are selected using Sky-500 (`bg-sky-500`)
    - Implement "View Details" and "Navigate in Google Maps" actions displayed side by side in a single row with external URL opening
    - Create scrollable activity list within expanded panel
    - Add smooth scroll-to-activity functionality when pins are selected
    - **Requirements Reference**: Requirement 3.8, 3.9 (activity-pin synchronization), Requirement 3.14 (Google Maps navigation)

  - [x] 7.4 Add drag-and-drop functionality within expandable panel
    - Implement DraggableActivitiesList component using @dnd-kit/core within the scrollable panel
    - Create drag handles and visual feedback during dragging with new color palette
    - Add reordering persistence to LocalStorage with `order` field via AppStateContext
    - Ensure drag-and-drop works properly within the constrained panel height
    - **Requirements Reference**: Requirement 3.10, 3.11 (drag-drop reordering, order persistence)

- [x] 8. **Accommodation Display Components (Within Activities Panel)**
  - [x] 8.1 Create AccommodationCard component for panel integration with location validation
    - Implement AccommodationCard.tsx with accommodation details for display within the ActivitiesPanel
    - Add check-in/check-out time display and confirmation information
    - Implement thumbnail image display when available
    - Apply new color palette for interactive elements (Orange-500 for hover states)
    - Ensure card fits properly within the collapsed panel state
    - Added support for host and rooms fields display when available
    - Add location warning indicator when coordinates are missing or invalid
    - Integrate LocationWarning component for accommodations with location issues
    - **Requirements Reference**: Requirement 4.2, 4.5 (accommodation information, thumbnail display), Requirement 11.3 (new color palette), Requirement 1.10, 3.15, 3.16 (location warnings)

  - [x] 8.2 Integrate accommodation display with activities panel and map
    - Position accommodation card prominently at top of the ActivitiesPanel (visible in both collapsed and expanded states)
    - Add accommodation pin display on map for each base with new color palette
    - Ensure visual consistency with frosted glass aesthetic and new color scheme
    - **Requirements Reference**: Requirement 4.1, 4.3, 4.4 (prominent display, single pin per base, visual consistency)

- [x] 9. **Weather Integration**
  - [x] 9.1 Implement WeatherService for Open-Meteo API
    - Create weatherService.ts with fetchWeatherData method
    - Implement weather data caching in LocalStorage with expiration
    - Add error handling for weather API failures
    - **Requirements Reference**: Requirement 6.1, 6.3 (weather API fetch, caching), Requirement 6.4 (API failure handling)

  - [x] 9.2 Create WeatherCard component and integration
    - Implement WeatherCard.tsx with temperature and precipitation display
    - Add weather data fetching for each base location
    - Create "Weather unavailable" placeholder for API failures
    - Integrate weather display into ActivitiesPanel component
    - Add useWeather hook for global state integration
    - **Requirements Reference**: Requirement 6.2 (weather data display), Requirement 6.4, 6.5 (error handling, performance)

- [x] 10. **Data Export Functionality**
  - [x] 10.1 Implement ExportService for JSON generation
    - Created exportService.ts with ExportService class containing exportTripData, downloadAsJSON, exportAndDownload, and generateFilename methods
    - Implemented merging of LocalStorage modifications (done status, manual order) into original data using existing exportUtils functions
    - Added proper filename generation with sanitization and timestamp support
    - **Requirements Reference**: Requirement 5.5, 5.6 (export functionality, merge LocalStorage states)

  - [x] 10.2 Add export UI and user interaction
    - Added "Download Updated Trip JSON" button in ActivitiesPanel expanded state with emerald color scheme
    - Implemented file download trigger with proper filename generation using trip name and timestamp
    - Added toast notification system with success feedback for export operations
    - Created Toast component with different types (success, error, warning, info) and auto-dismiss functionality
    - **Requirements Reference**: Requirement 5.5 (download function availability)

- [x] 11. **Responsive Design and Mobile Optimization**
  - [x] 11.1 Implement responsive layouts for all components
    - Updated all components with Tailwind responsive classes (sm: breakpoints)
    - Optimized map interactions for touch input with gestureHandling: 'greedy' and enhanced touch controls
    - Enhanced activity cards with appropriate mobile sizing and touch-friendly areas (min-h-[44px])
    - **Requirements Reference**: Requirement 7.2, 7.4, 7.5 (responsive layout, touch optimization, mobile sizing)
    - **Implementation Details**: 
      - ActivitiesPanel: Responsive width, padding, and positioning with mobile-first approach
      - ActivityCard: Touch-friendly buttons, responsive grid layouts, and enhanced tap targets
      - AccommodationCard: Mobile-optimized toggle buttons and responsive content layout
      - TimelineStrip: Already had responsive classes and mobile optimization

  - [x] 11.2 Add mobile-specific gesture handling
    - Swipe navigation for timeline already implemented with touch event handlers
    - Optimized drag-and-drop for touch interfaces with enhanced activation constraints and visual feedback
    - Added touch-friendly interaction areas with min-h-[44px] and active states for all interactive elements
    - Enhanced global CSS with touch optimizations and smooth scrolling
    - **Requirements Reference**: Requirement 7.3 (touch gestures), Requirement 7.1 (mobile-friendly interface)
    - **Implementation Details**:
      - DraggableActivity: Enhanced touch activation with delay and tolerance settings
      - Global CSS: Added touch-action: manipulation and webkit touch optimizations
      - All buttons: Added active states and touch-manipulation class for better feedback

- [x] 12. **Mobile Layout and Panel Management**
  - [x] 12.1 Implement mobile panel visibility and slide animations
    - Timeline positioned at top of screen with full width on mobile
    - ActivitiesPanel hidden by default, slides out from bottom when stop is selected
    - Prominent collapse button with chevron icon to hide panel completely
    - Smooth slide-up/slide-down animations with 400ms ease-in-out timing
    - **Requirements Reference**: Requirement 8.1, 8.2, 8.3, 8.4 (mobile timeline positioning, panel slide behavior, collapse functionality)
    - **Implementation Details**:
      - TimelineStrip: Full-width positioning at top edge on mobile
      - ActivitiesPanel: Fixed bottom positioning with slide animations
      - Collapse button: Fixed header outside scrollable area

  - [x] 12.2 Optimize mobile scrolling and space utilization
    - Maximized scrollable space using calc(100vh - 5rem) height calculation
    - Single unified scrollable container for all content to prevent scroll conflicts
    - Compact layout with reduced padding (px-2) and spacing (space-y-2)
    - Optimized touch performance with momentum scrolling and overscroll containment
    - **Requirements Reference**: Requirement 8.5, 8.6, 8.7, 8.8 (space maximization, unified scrolling, compact layout)
    - **Implementation Details**:
      - Mobile height calculation: Accounts for timeline (4rem) and collapse button header (1rem)
      - Unified scroll container: All content in single scrollable area
      - Compact spacing: Reduced section headers and card spacing for maximum content visibility

- [ ] 13. **Error Handling and Fallback Mechanisms**
  - [ ] 13.1 Implement comprehensive error handling
    - Add network connectivity detection and offline status display
    - Implement timeout and retry logic for API calls
    - Create fallback UI components for service failures
    - **Requirements Reference**: Requirement 9.5 (offline status), Requirement 10.4 (API timeouts and retry)

  - [ ] 13.2 Add graceful degradation for external services
    - Implement map unavailable state with grid background
    - Add straight-line polyline fallback for Directions API failures
    - Ensure core functionality works without external services
    - **Requirements Reference**: Requirement 9.1, 9.2 (map and directions fallbacks), Requirement 9.5 (offline functionality)

- [x] 14. **Enhanced Pin Visibility and Location Validation**
  - [x] 14.1 Implement enhanced pin visibility features
    - Updated all pin components to use 1.5x larger sizing (30px base, 33px selected) than Google Maps defaults (20px)
    - Applied vibrant colors from the color palette to all pin types with proper color mapping
    - Added pin shadows using SVG filters for better contrast against map backgrounds
    - Implemented hover state scaling (1.1x) with smooth transitions for enhanced interactivity
    - Added consistent stroke width and color for icon outlines using darker versions of fill colors
    - Enhanced pin visual prominence with proper opacity states for timeline status
    - **Requirements Reference**: Requirement 1.8, 1.9 (enhanced pin visibility, vibrant colors)

  - [x] 14.2 Implement location validation and warning system
    - Created LocationWarning component with Amber-500 warning styling, ExclamationTriangleIcon, and clear messaging
    - Added location validation logic in validationUtils.ts with `hasLocationIssues`, `activityHasLocationIssues`, and `accommodationHasLocationIssues` functions
    - Integrated location warnings into ActivityCard and AccommodationCard components with prominent display
    - Implemented comprehensive location validation detecting missing/invalid coordinates and empty addresses
    - Added clear messaging about address correction needs with helpful suggestions
    - Created comprehensive test coverage (13 new tests) for all location validation functions
    - **Requirements Reference**: Requirement 1.10, 3.15, 3.16 (location warnings and validation)

  - [x] 14.3 Update existing components with new color palette
    - Updated MapContainer pins with enhanced visibility and vibrant color scheme using Sky-500, Orange-500, and activity-specific colors
    - Applied new color palette throughout pin components with proper status-based opacity
    - Enhanced ActivityCard and AccommodationCard with new color scheme for selection, hover, and completion states
    - Updated activity type color mapping in activityUtils.ts with vivid Tailwind Colors v4 palette
    - **Requirements Reference**: Requirement 11.1, 11.3 (vivid color palette replacement)

  - [x] 14.4 Apply frosted glass styling to existing components
    - Verified all floating panel components (TimelineStrip, ActivitiesPanel) use consistent frosted glass styling
    - Ensured all floating elements follow the same visual design system with `rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md`
    - LocationWarning component uses consistent styling with proper backdrop and border effects
    - **Requirements Reference**: Requirement 11.2 (frosted glass styling consistency)

- [x] 15. **Scenic Waypoints Enhancement and Integration**
  - [x] 15.1 Update TypeScript types for enhanced scenic waypoints
    - Updated ScenicWaypoint interface in src/types/map.ts to support activity-like structure
    - Added activity_id, activity_name, location, duration, url, remarks, thumbnail_url, and status fields
    - Maintained compatibility with existing map-related types and utilities
    - **Requirements Reference**: Requirement 3.17 (scenic waypoints data structure)

  - [x] 15.2 Create ScenicWaypointCard component
    - Implemented ScenicWaypointCard.tsx with similar structure to ActivityCard but distinctive violet styling
    - Added landscape emoji (🏞️) and violet color scheme for visual distinction from activities
    - Implemented gradient background from violet-50 to sky-50 with violet-200 border
    - Added "Mark Done" functionality with violet-colored checkbox
    - Included location validation and warning system using existing validation utilities
    - Added "View Details" and "Navigate in Google Maps" actions displayed side by side in a single row with violet-colored buttons
    - Ensured non-draggable design to maintain original sequence from trip data
    - **Requirements Reference**: Requirement 3.18, 3.20, 3.21 (scenic waypoint cards, location validation, navigation actions)

  - [x] 15.3 Integrate scenic waypoints into ActivitiesPanel
    - Added scenicWaypoints prop to ActivitiesPanel component interface
    - Implemented collapsible Scenic Waypoints section between accommodation and activities
    - Added separate state management for scenic waypoints expansion (isScenicWaypointsExpanded)
    - Updated expand control button text to include scenic waypoints count when available
    - Created dedicated section header with violet color scheme and toggle functionality
    - Integrated scenic waypoint cards with proper selection and status management
    - **Requirements Reference**: Requirement 3.17, 3.19 (collapsible section, non-draggable display)

  - [x] 15.4 Update App component to pass scenic waypoints data
    - Modified App.tsx to extract scenic_waypoints from current stop and pass to ActivitiesPanel
    - Ensured proper fallback to empty array when scenic waypoints are not available
    - Maintained existing activity selection and status management for scenic waypoints
    - **Requirements Reference**: Requirement 3.17 (scenic waypoints integration)

  - [x] 15.5 Integrate scenic waypoints as map pins with animations
    - Created getScenicWaypointPinIcon function with violet color scheme and landscape/mountain SVG icon
    - Added scenicWaypointMarkersRef for managing scenic waypoint marker instances
    - Updated map bounds calculation to include scenic waypoints for proper map fitting
    - Implemented scenic waypoint markers rendering with proper selection and status handling
    - Added coordinated drop pin animations for scenic waypoints when stop is selected
    - Implemented staggered animations (100ms delay between waypoints) for visual effect
    - Enhanced visibility with 1.5x sizing and pin shadows consistent with other pins
    - **Requirements Reference**: Requirement 3.22, 3.23, 3.24, 3.25, 3.26 (map pins, animations, enhanced visibility, selection behavior, color coding)

  - [x] 15.6 Restructure ActivitiesPanel layout for scenic waypoints
    - Moved scenic waypoints section from inside Activities to root level of ActivitiesPanel
    - Created dedicated wide toggle button "🏞️ Scenic Waypoints (x)" with violet styling
    - Positioned scenic waypoints section between accommodation card and activities section
    - Implemented independent collapse/expand state for scenic waypoints (defaults to collapsed)
    - Updated activities expand button to show only activities count (removed scenic waypoints reference)
    - Maintained responsive design and touch-friendly interactions for all toggle buttons
    - **Requirements Reference**: Requirement 3.17, 3.18 (root level section, dedicated toggle button)

- [x] 16. **Point of Interest (POI) Discovery and Integration**
  - [x] 16.1 Create POI types and interfaces
    - Implement POIDetails interface with comprehensive place information structure
    - Add POIModalState interface for modal state management
    - Create type definitions for Google Places API integration
    - **Requirements Reference**: Requirement 12.4, 12.13 (place details structure, photo API integration)

  - [x] 16.2 Implement PlacesService for Google Places API integration
    - Create PlacesService singleton class with Google Maps integration
    - Implement getPlaceDetails method with comprehensive field requests
    - Add error handling for Places API failures and quota limits
    - Include proper TypeScript integration with Google Maps Places types
    - **Requirements Reference**: Requirement 12.10, 12.11 (API error handling, loading states)

  - [x] 16.3 Create POIModal component with Activity Card structure
    - Implement responsive modal dialog with frosted glass overlay
    - Add comprehensive place information display (photos, ratings, hours, contact)
    - Include star rating visualization and price level indicators
    - Implement "Open in Google Maps" link with proper URL generation
    - Add loading states with spinner animation and error handling
    - Ensure mobile-friendly design with touch-optimized interactions
    - **Requirements Reference**: Requirement 12.3, 12.4, 12.5, 12.9 (modal display, place details, Google Maps link, responsive design)

  - [x] 16.4 Implement POI interactivity and map integration
    - Enable Google Maps POI clicks by setting clickableIcons: true
    - Add POI click handler to prevent default info window and trigger custom modal
    - Integrate POI modal with global app state management
    - Implement proper modal opening/closing behavior with backdrop and keyboard support
    - **Requirements Reference**: Requirement 12.1, 12.2, 12.12 (POI clicks, custom modal, modal behavior)

  - [x] 16.5 Implement "Add to Activities" functionality
    - Create activity generation from POI data with proper structure mapping
    - Implement automatic activity type inference using Google Places types
    - Add activity to current selected trip base/stop with proper state management
    - Include POI rating and review information in activity remarks
    - Set default duration and proper activity ordering
    - **Requirements Reference**: Requirement 12.6, 12.7, 12.8 (Add to Activities button, activity creation, immediate display)

  - [x] 16.6 Update activity type inference for POI integration
    - Extend inferActivityType function to handle Google Places types
    - Add comprehensive Google Places type mapping to activity types
    - Implement proper fallback logic for unknown place types
    - Ensure backward compatibility with existing activity type inference
    - **Requirements Reference**: Requirement 12.7 (activity type inference)

  - [x] 16.7 Update state management for POI functionality
    - Add POI modal state to global AppStateContext
    - Implement POI modal actions (SET_POI_MODAL, CLOSE_POI_MODAL)
    - Add ADD_ACTIVITY_FROM_POI action for activity creation
    - Update reducer logic to handle POI-related state changes
    - **Requirements Reference**: Requirement 12.6, 12.7, 12.8 (state management, activity addition)

  - [x] 16.8 Update tests and ensure compatibility
    - Fix MapContainer tests to work with new POI functionality
    - Add proper Google Places API mocking for test environment
    - Update test wrappers to include AppStateProvider context
    - Ensure all existing tests continue to pass with POI changes
    - **Requirements Reference**: All requirements - testing ensures requirement compliance

  - [x] 16.9 Update Activity and Scenic Waypoint Card button layout
    - Combined "View Details" and "Navigate" buttons into a single row with two buttons side by side
    - Updated ActivityCard component to use flex layout with flex-1 for equal button sizing
    - Updated ScenicWaypointCard component with conditional sizing (flex-1 when URL exists, w-full when no URL)
    - Added border styling to "View Details" link buttons for visual consistency
    - Maintained existing color schemes (sky for activities, violet for scenic waypoints)
    - Ensured all tests continue to pass and build is successful
    - **Requirements Reference**: Requirement 3.14, 3.22 (action button layout optimization)

- [x] 16.10 Update Activity Card layout and drag handle positioning
    - Expanded Activity Card to full width in the container (w-full class)
    - Positioned draggable handle icon on the left edge of the card in the middle vertically
    - Removed excessive bottom spacing by replacing space-y-3 with individual mb-2 margins
    - Repositioned drag handle to absolute position at left edge middle (left-0 top-1/2 transform -translate-y-1/2)
    - Added left padding (pl-12) to Activity Card container to accommodate drag handle
    - Optimized content spacing for better visual density and reduced card height
    - Maintained all existing functionality including selection, completion status, and interactions
    - Ensured all tests continue to pass and build is successful
    - **Requirements Reference**: Requirement 3.7, 3.8 (full-width cards, left-edge drag handle positioning)

- [x] 16.11 Merge DraggableActivity and ActivityCard components
    - Merged drag-and-drop functionality directly into ActivityCard component to fix layout issues
    - Added isDraggable prop to ActivityCard to conditionally enable drag functionality
    - Positioned drag handle inside the card at left edge middle (left-2 top-1/2) with proper z-index
    - Simplified DraggableActivitiesList to directly use ActivityCard with isDraggable=true
    - Eliminated wrapper components that were causing layout positioning issues
    - Maintained all existing drag-and-drop functionality with improved layout control
    - Ensured all tests continue to pass and build is successful
    - **Requirements Reference**: Requirement 3.8, 3.10 (drag handle positioning, drag-drop functionality)

- [ ] 17. **Final Integration and Deployment Setup**
  - [ ] 17.1 Wire all components together in main App with new layout
    - Integrate floating Timeline and Activities panels with map background
    - Ensure proper positioning and responsive behavior of floating panels
    - Implement proper z-index stacking for panel interactions
    - Add final error boundary and loading state management with new colors
    - **Requirements Reference**: All requirements - final integration ensures complete functionality

  - [ ] 17.2 Configure deployment settings
    - Set up environment variable injection for VITE_GOOGLE_MAPS_API_KEY
    - Configure Vite build settings for GitHub Pages deployment
    - Create production build configuration with optimizations
    - **Requirements Reference**: Requirement 13.2, 13.3, 13.5 (API key injection, GitHub Actions, environment validation)

## Implementation Notes

- Each task builds incrementally on previous tasks
- Test-driven development is prioritized for core business logic
- All external API integrations include proper error handling and fallbacks
- Mobile-first responsive design is implemented throughout
- Performance optimizations are applied incrementally as features are added
- All user data persistence uses LocalStorage with proper error handling
