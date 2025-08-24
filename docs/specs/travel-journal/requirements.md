# Wanderlog Travel Journal - Requirements Document

## Introduction

The Wanderlog Travel Journal is a comprehensive interactive web application designed to provide travelers with an immersive, map-based interface for planning, tracking, and managing their travel itineraries. The application combines Google Maps integration with detailed activity management, timeline navigation, and data persistence to create a digital travel companion that enhances the travel experience through visual organization and real-time information.

## Requirements

### 1. Core Map Integration and Visualization

**User Story:** As a traveler, I want to view my entire trip on an interactive map with route visualization, so that I can understand the geographical context and flow of my journey.

**Acceptance Criteria:**
1. WHEN the application loads, THEN it SHALL display a Google Maps interface as the primary background
2. WHEN trip data is loaded, THEN the system SHALL render route polylines between all trip bases using Google Directions API
3. WHEN route polylines are displayed, THEN they SHALL include scenic waypoints (e.g., Lindis Pass, Crown Range) as intermediate points
4. WHEN the map is displayed, THEN it SHALL use a custom travel-journal styling with softer pastel colors and reduced POI clutter
5. WHEN accommodation locations are available, THEN the system SHALL display accommodation pins at each base location
6. WHEN activity locations are available, THEN the system SHALL display activity pins for each activity with valid coordinates
7. WHEN the Google Maps API fails to load, THEN the system SHALL display a placeholder grid background with "Map unavailable" message

### 2. Timeline Navigation and Date Management

**User Story:** As a traveler, I want to navigate through my trip timeline and see my current progress, so that I can easily jump to any day and understand where I am in my journey.

**Acceptance Criteria:**
1. WHEN the application loads, THEN it SHALL display a horizontal timeline strip showing all trip bases
2. WHEN timeline elements are displayed, THEN each base SHALL have length proportional to the duration of stay
3. WHEN the current date is determined, THEN the system SHALL automatically focus on today's base using New Zealand local time
4. WHEN bases are displayed in the timeline, THEN they SHALL be color-coded based on status (past: 40% opacity grey, current: teal brand color, upcoming: 70-80% opacity normal)
5. WHEN a user interacts with the timeline, THEN it SHALL support both swipe gestures and tap navigation
6. WHEN a timeline base is selected, THEN the map SHALL center on the corresponding location and display relevant pins
7. WHEN timeline navigation occurs, THEN the system SHALL persist the last viewed day/base in LocalStorage

### 3. Activity Management and Organization

**User Story:** As a traveler, I want to view, organize, and track my activities with detailed information and completion status, so that I can efficiently manage my itinerary and remember what I've accomplished.

**Acceptance Criteria:**
1. WHEN activities are displayed, THEN each activity card SHALL include title, thumbnail, address/location, travel time from accommodation, duration, URL link, and remarks
2. WHEN an activity has location coordinates, THEN the system SHALL display a corresponding pin on the map
3. WHEN an activity card is tapped, THEN the corresponding map pin SHALL be highlighted and the map SHALL center on that location
4. WHEN a map pin is tapped, THEN the corresponding activity card SHALL be highlighted and scrolled into view
5. WHEN activities are displayed, THEN users SHALL be able to reorder them using drag-and-drop functionality
6. WHEN activity reordering occurs, THEN the new order SHALL be persisted in LocalStorage and reflected in exported data
7. WHEN an activity includes a "Mark Done" checkbox, THEN the completion status SHALL be persisted in LocalStorage
8. WHEN activities have completion status, THEN they SHALL be visually indicated (completed activities greyed out or marked)
9. WHEN an activity includes a URL, THEN users SHALL be able to access a "Navigate in Google Maps" action

### 4. Accommodation Display and Management

**User Story:** As a traveler, I want to see detailed accommodation information prominently displayed, so that I can easily access check-in details and location information for each base.

**Acceptance Criteria:**
1. WHEN a base is selected, THEN the accommodation card SHALL be displayed prominently at the top of the detail view
2. WHEN accommodation information is available, THEN it SHALL include name, address, check-in/check-out times, confirmation details, and booking URL
3. WHEN accommodation has location coordinates, THEN a single accommodation pin SHALL be displayed per base on the map
4. WHEN accommodation cards are displayed, THEN they SHALL maintain visual consistency with the travel-journal aesthetic
5. WHEN accommodation includes a thumbnail URL, THEN the thumbnail image SHALL be displayed on the card

### 5. Data Persistence and Export Functionality

**User Story:** As a traveler, I want my activity completion status and customizations to be saved and exportable, so that I can maintain my progress across sessions and share my updated itinerary.

**Acceptance Criteria:**
1. WHEN users mark activities as done, THEN the completion state SHALL be stored in browser LocalStorage
2. WHEN users reorder activities, THEN the manual order SHALL be stored in browser LocalStorage
3. WHEN users navigate between bases, THEN the last viewed day/base SHALL be stored in LocalStorage
4. WHEN the application loads, THEN it SHALL restore all persisted states from LocalStorage
5. WHEN users request data export, THEN the system SHALL provide a "Download Updated Trip JSON" function
6. WHEN JSON export occurs, THEN it SHALL merge LocalStorage states (done status, manual order) back into the original trip data format
7. WHEN LocalStorage is unavailable or full, THEN the application SHALL remain functional but display a warning about lack of persistence

### 6. Weather Information Integration

**User Story:** As a traveler, I want to see weather forecasts for each location, so that I can plan my activities according to weather conditions.

**Acceptance Criteria:**
1. WHEN a base is displayed, THEN the system SHALL fetch weather data from Open-Meteo API for that location
2. WHEN weather data is retrieved, THEN it SHALL include daily high temperature, low temperature, and precipitation chance
3. WHEN weather data is fetched, THEN it SHALL be cached per stop in LocalStorage to minimize API calls
4. WHEN weather API calls fail, THEN the system SHALL display "Weather unavailable" placeholder without breaking functionality
5. WHEN cached weather data exists, THEN it SHALL be used to reduce API requests and improve performance

### 7. Responsive Design and Mobile Optimization

**User Story:** As a mobile traveler, I want the application to work seamlessly on my phone and tablet, so that I can access my travel information while on the go.

**Acceptance Criteria:**
1. WHEN the application is accessed on mobile devices, THEN it SHALL provide a mobile-friendly interface with touch-optimized interactions
2. WHEN viewed on different screen sizes, THEN the layout SHALL adapt responsively while maintaining functionality
3. WHEN touch gestures are used, THEN the timeline SHALL support swipe navigation for base selection
4. WHEN on mobile devices, THEN map interactions SHALL be optimized for touch input (pinch, zoom, pan)
5. WHEN activity cards are displayed on mobile, THEN they SHALL be appropriately sized and easily tappable

### 8. Error Handling and Fallback Mechanisms

**User Story:** As a user, I want the application to handle errors gracefully and provide alternative functionality when services are unavailable, so that I can continue using the app even when connectivity or external services fail.

**Acceptance Criteria:**
1. WHEN Google Maps API fails to load, THEN the system SHALL display a grid background with "Map unavailable" overlay
2. WHEN Google Directions API quota is exceeded, THEN the system SHALL fall back to straight-line polylines between bases
3. WHEN weather API requests fail, THEN weather sections SHALL show "Weather unavailable" without affecting other functionality
4. WHEN trip JSON data has invalid schema, THEN the system SHALL display "Trip file format invalid" error message
5. WHEN network connectivity is lost, THEN cached data SHALL continue to function and users SHALL be notified of offline status
6. WHEN JavaScript errors occur, THEN they SHALL be caught and logged without crashing the entire application

### 9. Performance and Loading Optimization

**User Story:** As a user, I want the application to load quickly and respond smoothly to interactions, so that I can efficiently navigate my travel information without delays.

**Acceptance Criteria:**
1. WHEN the application loads, THEN route polylines SHALL be prefetched using Google Directions API on initial load
2. WHEN images are displayed, THEN they SHALL be optimized and lazy-loaded to improve performance
3. WHEN large amounts of data are processed, THEN the system SHALL provide loading indicators to inform users of progress
4. WHEN API calls are made, THEN they SHALL implement appropriate timeouts and retry logic
5. WHEN LocalStorage operations occur, THEN they SHALL be optimized to minimize performance impact

### 10. Deployment and Configuration

**User Story:** As a developer/maintainer, I want the application to be properly configured for GitHub Pages deployment with secure API key management, so that the application can be reliably hosted and maintained.

**Acceptance Criteria:**
1. WHEN the application is built, THEN it SHALL be configured for GitHub Pages deployment with base path '/wanderlog/'
2. WHEN Google Maps API key is required, THEN it SHALL be injected via environment variable VITE_GOOGLE_MAPS_API_KEY during build
3. WHEN the application is deployed, THEN GitHub Actions SHALL automatically build and deploy on pushes to main branch
4. WHEN API keys are configured, THEN they SHALL include appropriate referrer restrictions in Google Cloud Console
5. WHEN the build process runs, THEN it SHALL validate all required environment variables are present
