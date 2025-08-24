# Wanderlog Travel Journal - Implementation Tasks

## Implementation Plan

This document outlines the step-by-step implementation tasks for building the Wanderlog Travel Journal application. Each task builds incrementally on previous steps, following test-driven development practices where appropriate.

### Task Checklist

- [x] 1. **Project Setup and Foundation**
  - [x] 1.1 Initialize React + Vite + TypeScript project structure
    - Create project with Vite template
    - Configure TypeScript strict mode settings
    - Set up project folder structure according to design document
    - **Requirements Reference**: Requirement 10.1, 10.2 (Vite configuration, TypeScript setup)

  - [x] 1.2 Install and configure core dependencies
    - Install React, TypeScript, Tailwind CSS, @react-google-maps/api, @dnd-kit/core, date-fns
    - Configure Tailwind CSS with travel journal color palette
    - Set up Vite configuration with base path '/wanderlog/' for GitHub Pages
    - **Requirements Reference**: Requirement 10.1, 10.4 (GitHub Pages configuration)

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
    - **Requirements Reference**: Requirement 8.4 (JSON schema validation), Requirement 5.6 (JSON export structure)

  - [x] 2.2 Implement StorageService for LocalStorage operations
    - Create storageService.ts with getUserModifications, saveUserModifications methods (new UserModifications format)
    - Implement weather cache storage and retrieval functions with expiration handling
    - Add LocalStorage availability detection and fallback handling
    - Include migration from legacy StopStatus format to new UserModifications format
    - Add comprehensive weather caching with validation and expiration
    - **Requirements Reference**: Requirement 5.1, 5.2, 5.3 (LocalStorage persistence), Requirement 8.3 (LocalStorage unavailable handling)

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
    - **Requirements Reference**: Requirement 5.4 (state restoration), Requirement 9.3 (loading indicators)

- [x] 4. **Layout Components and Error Handling**
  - [x] 4.1 Create error boundary and loading components
    - Implement ErrorBoundary.tsx with JavaScript error catching, travel journal styling, enhanced error reporting with unique error IDs, comprehensive logging, and retry functionality
    - Create LoadingSpinner.tsx component with travel journal styling including adventure-themed variant with compass animations, multiple sizes, and enhanced travel-themed loading states
    - Implement ErrorMessage.tsx for displaying user-friendly error messages with contextual error types (network, data, permission), helpful suggestions, and travel journal aesthetics
    - **Requirements Reference**: Requirement 8.6 (JavaScript error handling), Requirement 9.3 (loading indicators)

  - [x] 4.2 Create main App component structure
    - Updated App.tsx to properly use AppStateProvider and global context management
    - Implement proper trip data loading with global state initialization
    - Enhanced error boundary wrapping and comprehensive global error handling with graceful degradation
    - Migrated from legacy useAppState hook to proper global state management using AppStateContext
    - **Requirements Reference**: Requirement 5.4 (state restoration on load), Requirement 8.6 (error handling)

- [x] 5. **Google Maps Integration**
  - [x] 5.1 Implement basic MapContainer component
    - Create MapContainer.tsx with @react-google-maps/api integration
    - Implement custom map styling with pastel colors and reduced POI clutter
    - Add map loading error handling with grid background fallback
    - **Requirements Reference**: Requirement 1.1, 1.4 (Google Maps display, custom styling), Requirement 8.1 (map loading failure)

  - [x] 5.2 Create map pin components with type-specific icons
    - Implement CityPin.tsx with yellow star icon (Starred place style)
    - Create AccommodationPin.tsx with lodge icon and status-based coloring
    - Implement ActivityPin.tsx with activity-type specific icons:
      - Restaurant: Fork and knife icon
      - Attraction: Camera/sightseeing icon
      - Shopping: Shopping bag icon
      - Outdoor: Mountain/hiking icon
      - Cultural: Museum/building icon
      - Transport: Vehicle icon
      - Other/Default: Green flag icon ("Want to go" style)
    - Add pin highlighting when corresponding cards are selected
    - Implement click handlers for all pin types
    - **Requirements Reference**: Requirement 1.5, 1.6, 1.7 (accommodation, activity, and city pins), Requirement 3.4 (pin-card synchronization)

  - [x] 5.3 Implement route visualization with Google Directions API
    - Create TripRoute.tsx component for polyline rendering
    - Implement route fetching with scenic waypoints inclusion
    - Add fallback to straight-line polylines when Directions API fails
    - **Requirements Reference**: Requirement 1.2, 1.3 (route polylines, scenic waypoints), Requirement 8.2 (Directions API fallback)

- [ ] 6. **Timeline Navigation Component**
  - [ ] 6.1 Create TimelineStrip component structure
    - Implement TimelineStrip.tsx with horizontal scrolling layout
    - Create TimelineBase.tsx for individual base representation
    - Add proportional sizing based on stay duration
    - **Requirements Reference**: Requirement 2.1, 2.2 (timeline strip, proportional length)

  - [ ] 6.2 Implement timeline navigation and auto-focus
    - Add New Zealand timezone detection for current day calculation
    - Implement auto-focus on today's base with visual highlighting
    - Create timeline base selection handlers with map integration
    - **Requirements Reference**: Requirement 2.3 (NZ local time auto-focus), Requirement 2.6 (timeline base selection)

  - [ ] 6.3 Add mobile touch support and status coloring
    - Implement swipe gesture handling for timeline navigation
    - Add status-based coloring (past: 40% opacity, current: teal, upcoming: 70-80% opacity)
    - Create responsive timeline layout for mobile devices
    - **Requirements Reference**: Requirement 2.4, 2.5 (status coloring, swipe navigation), Requirement 7.3 (touch optimizations)

- [ ] 7. **Activity Management Components**
  - [ ] 7.1 Create ActivityCard component
    - Implement ActivityCard.tsx with comprehensive activity information display
    - Add travel time calculation and display from accommodation
    - Implement "Mark Done" checkbox with visual feedback
    - **Requirements Reference**: Requirement 3.1 (activity card content), Requirement 3.7, 3.8 (completion status, visual indication)

  - [ ] 7.2 Implement activity list and card interactions
    - Create ActivityList.tsx for displaying multiple activities
    - Add activity card highlighting when map pins are selected
    - Implement "Navigate in Google Maps" action with external URL opening
    - **Requirements Reference**: Requirement 3.3, 3.4 (activity-pin synchronization), Requirement 3.9 (Google Maps navigation)

  - [ ] 7.3 Add drag-and-drop functionality for activity reordering
    - Implement DraggableActivity.tsx wrapper using @dnd-kit/core
    - Create drag handles and visual feedback during dragging
    - Add reordering persistence to LocalStorage with manual_order field
    - **Requirements Reference**: Requirement 3.5, 3.6 (drag-drop reordering, order persistence)

- [ ] 8. **Accommodation Display Components**
  - [ ] 8.1 Create AccommodationCard component
    - Implement AccommodationCard.tsx with accommodation details
    - Add check-in/check-out time display and confirmation information
    - Implement thumbnail image display when available
    - **Requirements Reference**: Requirement 4.2, 4.5 (accommodation information, thumbnail display)

  - [ ] 8.2 Integrate accommodation display with timeline
    - Position accommodation card prominently at top of detail view
    - Add accommodation pin display on map for each base
    - Ensure visual consistency with travel journal aesthetic
    - **Requirements Reference**: Requirement 4.1, 4.3, 4.4 (prominent display, single pin per base, visual consistency)

- [ ] 9. **Weather Integration**
  - [ ] 9.1 Implement WeatherService for Open-Meteo API
    - Create weatherService.ts with fetchWeatherData method
    - Implement weather data caching in LocalStorage with expiration
    - Add error handling for weather API failures
    - **Requirements Reference**: Requirement 6.1, 6.3 (weather API fetch, caching), Requirement 6.4 (API failure handling)

  - [ ] 9.2 Create WeatherCard component and integration
    - Implement WeatherCard.tsx with temperature and precipitation display
    - Add weather data fetching for each base location
    - Create "Weather unavailable" placeholder for API failures
    - **Requirements Reference**: Requirement 6.2 (weather data display), Requirement 6.4, 6.5 (error handling, performance)

- [ ] 10. **Data Export Functionality**
  - [ ] 10.1 Implement ExportService for JSON generation
    - Create exportService.ts with exportTripData method
    - Merge LocalStorage modifications (done status, manual order) into original data
    - Implement downloadAsJSON function for file download
    - **Requirements Reference**: Requirement 5.5, 5.6 (export functionality, merge LocalStorage states)

  - [ ] 10.2 Add export UI and user interaction
    - Create "Download Updated Trip JSON" button in main interface
    - Implement file download trigger with proper filename
    - Add user feedback for successful export operations
    - **Requirements Reference**: Requirement 5.5 (download function availability)

- [ ] 11. **Mobile Optimization and Responsive Design**
  - [ ] 11.1 Implement responsive layouts for all components
    - Update all components with Tailwind responsive classes
    - Optimize map interactions for touch input (pinch, zoom, pan)
    - Ensure activity cards are appropriately sized for mobile tapping
    - **Requirements Reference**: Requirement 7.2, 7.4, 7.5 (responsive layout, touch optimization, mobile sizing)

  - [ ] 11.2 Add mobile-specific gesture handling
    - Implement swipe navigation for timeline on mobile devices
    - Optimize drag-and-drop for touch interfaces
    - Add touch-friendly interaction areas and feedback
    - **Requirements Reference**: Requirement 7.3 (touch gestures), Requirement 7.1 (mobile-friendly interface)

- [ ] 12. **Error Handling and Fallback Mechanisms**
  - [ ] 12.1 Implement comprehensive error handling
    - Add network connectivity detection and offline status display
    - Implement timeout and retry logic for API calls
    - Create fallback UI components for service failures
    - **Requirements Reference**: Requirement 8.5 (offline status), Requirement 9.4 (API timeouts and retry)

  - [ ] 12.2 Add graceful degradation for external services
    - Implement map unavailable state with grid background
    - Add straight-line polyline fallback for Directions API failures
    - Ensure core functionality works without external services
    - **Requirements Reference**: Requirement 8.1, 8.2 (map and directions fallbacks), Requirement 8.5 (offline functionality)

- [ ] 13. **Performance Optimization**
  - [ ] 13.1 Implement performance optimizations
    - Add React.memo to expensive components (MapContainer, ActivityCard)
    - Implement useCallback and useMemo for expensive calculations
    - Add lazy loading for images and non-critical components
    - **Requirements Reference**: Requirement 9.2, 9.5 (image optimization, performance impact minimization)

  - [ ] 13.2 Optimize API calls and caching
    - Implement route polyline prefetching on application load
    - Add intelligent weather data caching with expiration
    - Optimize LocalStorage operations for performance
    - **Requirements Reference**: Requirement 9.1 (route prefetching), Requirement 6.5 (weather caching performance)

- [ ] 14. **Testing Implementation**
  - [ ] 14.1 Write unit tests for core services
    - Create tests for TripDataService JSON validation and loading
    - Implement tests for StorageService LocalStorage operations
    - Add tests for utility functions (dateUtils, mapUtils, validation)
    - **Requirements Reference**: All requirements - testing ensures requirement compliance

  - [ ] 14.2 Write component tests
    - Create tests for MapContainer with mock Google Maps API
    - Implement tests for TimelineStrip navigation and auto-focus
    - Add tests for ActivityCard interactions and drag-and-drop
    - **Requirements Reference**: Component-specific requirements verification

  - [ ] 14.3 Write integration tests for user flows
    - Create tests for complete base selection and activity management flow
    - Implement tests for data persistence and export functionality
    - Add tests for error handling and fallback mechanisms
    - **Requirements Reference**: End-to-end requirement validation

- [ ] 15. **Final Integration and Deployment Setup**
  - [ ] 15.1 Wire all components together in main App
    - Integrate all feature modules (Map, Timeline, Activities, Weather)
    - Ensure proper data flow between components via global state
    - Add final error boundary and loading state management
    - **Requirements Reference**: All requirements - final integration ensures complete functionality

  - [ ] 15.2 Configure deployment settings
    - Set up environment variable injection for VITE_GOOGLE_MAPS_API_KEY
    - Configure Vite build settings for GitHub Pages deployment
    - Create production build configuration with optimizations
    - **Requirements Reference**: Requirement 10.2, 10.3, 10.5 (API key injection, GitHub Actions, environment validation)

## Implementation Notes

- Each task builds incrementally on previous tasks
- Test-driven development is prioritized for core business logic
- All external API integrations include proper error handling and fallbacks
- Mobile-first responsive design is implemented throughout
- Performance optimizations are applied incrementally as features are added
- All user data persistence uses LocalStorage with proper error handling
