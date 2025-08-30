# Wanderlog Travel Journal - Requirements Document

## Introduction

The Wanderlog Travel Journal is a comprehensive interactive web application designed to provide travelers with an immersive, map-based interface for planning, tracking, and managing their travel itineraries. The application combines Google Maps integration with detailed activity management, timeline navigation, and data persistence to create a digital travel companion that enhances the travel experience through visual organization and real-time information.

## Requirements

### 1. Core Map Integration and Visualization

**User Story:** As a traveler, I want to view my entire trip on an interactive map with route visualization, so that I can understand the geographical context and flow of my journey.

**Acceptance Criteria:**
1. WHEN the application loads, THEN it SHALL display a Google Maps interface as the primary background with floating UI components overlaid
2. WHEN trip data is loaded, THEN the system SHALL render route polylines between all trip bases using Google Directions API
3. WHEN route polylines are displayed, THEN they SHALL include scenic waypoints (e.g., Lindis Pass, Crown Range) as intermediate points
4. WHEN the map is displayed, THEN it SHALL use a custom travel-journal styling with softer pastel colors and reduced POI clutter
5. WHEN accommodation locations are available, THEN the system SHALL display lodge-style pins at each base location
6. WHEN activity locations are available, THEN the system SHALL display activity pins with standardized visited status colors (blue for unvisited activities, green for visited activities) for each activity with valid coordinates
7. WHEN base locations are displayed, THEN the system SHALL display accommodation pins (lodge-style) as the primary location markers
8. WHEN pins are displayed on the map, THEN they SHALL be sized larger than Google Maps built-in icons for enhanced visibility
9. WHEN activity pins are displayed on the map, THEN they SHALL use standardized colors: Sky-500 (#0ea5e9) for unvisited activities and Emerald-500 (#10b981) for visited activities
10. WHEN a location pin needs to be highlighted (trip stop selected or activity selected), THEN the system SHALL display a drop pin animation to draw attention to the specific location
11. WHEN a trip stop is selected, THEN the accommodation pin SHALL be highlighted with a drop pin animation
12. WHEN an activity is selected, THEN the corresponding activity pin SHALL be highlighted with a drop pin animation if the activity has valid location coordinates
13. WHEN activities or accommodations have invalid or missing location data, THEN the system SHALL display warning indicators in the ActivitiesPanel to alert users that addresses need to be corrected
14. WHEN the Google Maps API fails to load, THEN the system SHALL display a placeholder grid background with "Map unavailable" message
15. WHEN UI components are displayed over the map, THEN they SHALL be positioned as floating panels with appropriate gaps from screen edges
16. WHEN floating panels are rendered, THEN they SHALL use frosted glass styling with rounded corners, semi-transparent white background, backdrop blur, subtle borders, and medium shadows

### 2. Timeline Navigation and Date Management

**User Story:** As a traveler, I want to navigate through my trip timeline and see my current progress, so that I can easily jump to any day and understand where I am in my journey.

**Acceptance Criteria:**
1. WHEN the application loads on mobile, THEN it SHALL display a horizontal timeline strip positioned at the top of the screen spanning the full width
2. WHEN the application loads on desktop, THEN it SHALL display a horizontal timeline strip as a floating panel positioned at the top-left corner of the map
3. WHEN the timeline panel is displayed on mobile, THEN it SHALL be positioned at the top edge with no gaps and use frosted glass styling
4. WHEN the timeline panel is displayed on desktop, THEN it SHALL be positioned with appropriate gap from screen edges and use frosted glass styling
5. WHEN timeline elements are displayed, THEN each base SHALL have length proportional to the duration of stay
6. WHEN the current date is determined, THEN the system SHALL automatically focus on today's base using New Zealand local time
7. WHEN bases are displayed in the timeline, THEN each base SHALL have a unique vibrant color from the Tailwind color palette to create a colorful and visually distinct timeline
8. WHEN a timeline base is selected, THEN it SHALL enlarge slightly (scale 110%), change to a brighter/deeper shade of its base color, display a ring outline in the same color family, and remain visually selected until a different base is chosen
9. WHEN a user interacts with the timeline, THEN it SHALL support both swipe gestures and tap navigation
10. WHEN a timeline base is selected, THEN the map SHALL center on the corresponding location and display relevant pins
11. WHEN timeline navigation occurs, THEN the system SHALL persist the last viewed day/base in LocalStorage
12. WHEN a timeline base is selected on mobile, THEN the ActivitiesPanel SHALL automatically slide out from the bottom of the screen

### 3. Activity Management and Organization

**User Story:** As a traveler, I want to view, organize, and track my activities with detailed information and completion status, so that I can efficiently manage my itinerary and remember what I've accomplished.

**Acceptance Criteria:**
1. WHEN the application loads on desktop, THEN the accommodation/activities panel SHALL be positioned as a floating component at the top-right corner of the map with appropriate gap from screen edges
2. WHEN the application loads on mobile, THEN the accommodation/activities panel SHALL be hidden by default and slide out from the bottom when a stop is selected from the timeline
3. WHEN the activities panel is displayed, THEN it SHALL use frosted glass styling consistent with other floating panels
4. WHEN the activities panel is in default state on desktop, THEN it SHALL display only the accommodation card with an expand control at the bottom
5. WHEN the activities panel is displayed on mobile, THEN it SHALL slide up from the bottom of the screen and include a collapse button with chevron icon to hide the entire panel
6. WHEN the expand control is activated on desktop, THEN the panel SHALL extend to the bottom of the screen (map) maintaining the same gap, and become scrollable for viewing all activity cards
7. WHEN the activities panel is expanded on mobile, THEN it SHALL occupy the bottom portion of the screen and become scrollable for viewing all activity cards
8. WHEN the activities panel is expanded, THEN it SHALL include a collapse control at the end to return to the default state
9. WHEN the collapse button is pressed on mobile, THEN the entire ActivitiesPanel SHALL slide down and hide completely
6. WHEN activities are displayed, THEN each activity card SHALL include title, thumbnail, address/location, travel time from accommodation, duration, URL link, and remarks
7. WHEN an activity has location coordinates, THEN the system SHALL display a corresponding pin on the map
8. WHEN an activity card is tapped, THEN the corresponding map pin SHALL be highlighted with a drop pin animation and the map SHALL center on that location
9. WHEN a map pin is tapped, THEN the corresponding activity card SHALL be highlighted and scrolled into view
10. WHEN activities are displayed, THEN users SHALL be able to reorder them using drag-and-drop functionality
11. WHEN activity reordering occurs, THEN the new order SHALL be persisted in LocalStorage and reflected in exported data
12. WHEN an activity includes a "Mark Done" checkbox, THEN the completion status SHALL be persisted in LocalStorage
13. WHEN activities have completion status, THEN they SHALL be visually indicated on the map using standardized pin colors (green for completed/visited activities, blue for incomplete/unvisited activities)
14. WHEN an activity includes a URL, THEN users SHALL be able to access a "Navigate in Google Maps" action
15. WHEN activities or accommodations have missing, invalid, or non-geocodable location data, THEN warning indicators SHALL be displayed prominently on their respective cards in the ActivitiesPanel
16. WHEN location warnings are displayed, THEN they SHALL include clear messaging about the need to correct address information and SHALL not prevent other functionality from working
17. WHEN scenic waypoints are available for a trip base, THEN they SHALL be displayed as a dedicated collapsible section at the root level of the ActivitiesPanel, positioned between the accommodation card and activities section
18. WHEN scenic waypoints are available, THEN they SHALL have a dedicated wide button labeled "Scenic Waypoints (x)" with violet styling that toggles the section's visibility, defaulting to collapsed state
19. WHEN scenic waypoints are displayed, THEN each waypoint SHALL be shown as a card similar to activity cards but with distinctive scenic waypoint styling (violet color scheme and landscape emoji)
20. WHEN scenic waypoints are displayed, THEN they SHALL not be draggable or reorderable, maintaining their original sequence from the trip data
21. WHEN scenic waypoints include location data, THEN they SHALL support the same location validation and warning system as activities
22. WHEN scenic waypoints include URLs, THEN they SHALL provide "View Details" and "Navigate" actions similar to activities
23. WHEN scenic waypoints have valid location coordinates, THEN they SHALL be displayed as pins on the map with distinctive violet styling and landscape/mountain icons
24. WHEN a stop is selected from the timeline, THEN all scenic waypoints for that stop SHALL display drop pin animations simultaneously with the accommodation pin
25. WHEN scenic waypoints are displayed on the map, THEN they SHALL use the same enhanced visibility sizing (1.5x larger than Google Maps defaults) as other pins
26. WHEN scenic waypoint pins are clicked, THEN they SHALL trigger the same selection behavior as activity pins, highlighting the corresponding card in the ActivitiesPanel
27. WHEN scenic waypoints have completion status, THEN their map pins SHALL use the same color coding as activities (violet for unvisited, green for completed)

### 4. Accommodation Display and Management

**User Story:** As a traveler, I want to see detailed accommodation information prominently displayed with the ability to expand/collapse details, so that I can easily access check-in details and location information for each base while maintaining a clean interface.

**Acceptance Criteria:**
1. WHEN a base is selected, THEN the accommodation card SHALL be displayed prominently at the top of the detail view
2. WHEN accommodation card is in collapsed state, THEN it SHALL display only the accommodation name and stop name with an expand button using a chevron down icon
3. WHEN accommodation card is in expanded state, THEN it SHALL display all detailed information including address, check-in/check-out times, confirmation details, room information, phone, host, and booking URL
4. WHEN the expand/collapse button is clicked, THEN the card SHALL smoothly transition between collapsed and expanded states using the same chevron icons as the activities panel
5. WHEN accommodation information is available, THEN it SHALL include name, address, check-in/check-out times, confirmation details, and booking URL in the expanded state
6. WHEN accommodation has location coordinates, THEN a single accommodation pin SHALL be displayed per base on the map
7. WHEN accommodation cards are displayed, THEN they SHALL maintain visual consistency with the travel-journal aesthetic
8. WHEN accommodation includes a thumbnail URL, THEN the thumbnail image SHALL be displayed on the card only when expanded
9. WHEN the accommodation card is expanded, THEN the website link and directions button SHALL be shown at the bottom

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
6. WHEN the application is viewed on mobile, THEN the timeline SHALL be positioned at the top of the screen with full width
7. WHEN the application is viewed on mobile, THEN the ActivitiesPanel SHALL be hidden by default and slide out from the bottom when a stop is selected
8. WHEN the ActivitiesPanel is displayed on mobile, THEN it SHALL include a prominent collapse button with chevron icon to hide the panel completely
9. WHEN the collapse button is pressed on mobile, THEN the ActivitiesPanel SHALL slide down smoothly and disappear, returning to the map-only view

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

### 10. Visual Design and Color Theme

**User Story:** As a user, I want the application to have a modern, vivid, and dynamic visual design that enhances the travel experience and provides excellent visual hierarchy.

**Acceptance Criteria:**
1. WHEN the application is styled, THEN it SHALL use a vivid, modern, and dynamic color palette from Tailwind Colors v4 with each timeline base having a unique color from the palette (blue, emerald, violet, orange, rose, cyan, amber, pink, indigo, teal, lime, fuchsia) cycling through the sequence
2. WHEN floating panels are rendered, THEN they SHALL use consistent frosted glass styling with the following specifications:
   - Rounded corners using `rounded-xl` class
   - Semi-transparent white background using `bg-white/30`
   - Backdrop blur effect using `backdrop-blur`
   - Subtle border using `border border-white/20`
   - Medium shadow using `shadow-md`
3. WHEN color coding is applied, THEN the system SHALL use the selected vivid color palette for:
   - Timeline base unique color assignment (cycling through the 12-color palette)
   - Timeline base selection states (brighter shades with ring outlines)
   - Activity completion states
   - Pin highlighting and selection states
   - Interactive element feedback
4. WHEN visual hierarchy is established, THEN colors SHALL be used consistently across all components to maintain design coherence
5. WHEN accessibility is considered, THEN color combinations SHALL maintain adequate contrast ratios for readability

### 11. Point of Interest (POI) Discovery and Integration

**User Story:** As a traveler, I want to discover and interact with Points of Interest on the map, so that I can explore new places and easily add them to my itinerary.

**Acceptance Criteria:**
1. WHEN the map is displayed, THEN Google Maps built-in POIs SHALL be clickable and interactive
2. WHEN a POI is clicked, THEN the system SHALL prevent the default Google Maps info window from appearing
3. WHEN a POI is clicked, THEN a custom modal dialog SHALL open displaying detailed place information
4. WHEN the POI modal is displayed, THEN it SHALL show comprehensive place details including:
   - Place name and address
   - High-quality place photo (when available)
   - Star rating and review count (when available)
   - Price level indicators (when available)
   - Business hours and current open/closed status (when available)
   - Phone number and website links (when available)
   - Business status and place type tags
5. WHEN the POI modal is displayed, THEN it SHALL include a prominent "Open in Google Maps" link that opens the place in a new tab
6. WHEN the POI modal is displayed, THEN it SHALL include an "Add to Activities" button that allows users to convert the POI into a new activity
7. WHEN "Add to Activities" is clicked, THEN the system SHALL:
   - Create a new activity with the POI's name, location, and details
   - Automatically infer the appropriate activity type based on Google Places types
   - Add the activity to the current selected trip base/stop
   - Include rating and review information in the activity remarks
   - Set a default duration of "1-2 hours"
   - Close the POI modal
8. WHEN a POI is added as an activity, THEN it SHALL immediately appear in the activities list and on the map with the appropriate activity pin
9. WHEN the POI modal is displayed, THEN it SHALL be responsive and work well on both desktop and mobile devices
10. WHEN Google Places API requests fail, THEN the POI modal SHALL display appropriate error messages
11. WHEN the POI modal is loading place details, THEN it SHALL show a loading spinner with descriptive text
12. WHEN the POI modal is open, THEN users SHALL be able to close it by clicking the X button, clicking outside the modal, or pressing the Escape key
13. WHEN Google Places photo references are available, THEN they SHALL be properly formatted and displayed using the Google Places Photo API

### 12. Deployment and Configuration

**User Story:** As a developer/maintainer, I want the application to be properly configured for GitHub Pages deployment with secure API key management, so that the application can be reliably hosted and maintained.

**Acceptance Criteria:**
1. WHEN the application is built, THEN it SHALL be configured for GitHub Pages deployment with base path '/wanderlog/'
2. WHEN Google Maps API key is required, THEN it SHALL be injected via environment variable VITE_GOOGLE_MAPS_API_KEY during build
3. WHEN the application is deployed, THEN GitHub Actions SHALL automatically build and deploy on pushes to main branch
4. WHEN API keys are configured, THEN they SHALL include appropriate referrer restrictions in Google Cloud Console
5. WHEN the build process runs, THEN it SHALL validate all required environment variables are present
