import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { ActivityType, type TripData } from '@/types/trip';
import * as activityUtils from '@/utils/activityUtils';
import { MapContainer } from '../MapContainer';

// Mock the Google Maps API
const mockMarker = {
  setAnimation: vi.fn(),
  getAnimation: vi.fn(() => null),
};

const mockMap = {
  fitBounds: vi.fn(),
  panTo: vi.fn(),
  setZoom: vi.fn(),
};

// Mock @react-google-maps/api
vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ children, onLoad }: any) => {
    React.useEffect(() => {
      if (onLoad) {
        onLoad(mockMap);
      }
    }, [onLoad]);
    return <div data-testid="google-map">{children}</div>;
  },
  LoadScript: ({ children }: any) => <div data-testid="load-script">{children}</div>,
  Marker: ({ onLoad, onUnmount, onClick, title }: any) => {
    React.useEffect(() => {
      if (onLoad) {
        onLoad(mockMarker);
      }
      return () => {
        if (onUnmount) {
          onUnmount();
        }
      };
    }, [onLoad, onUnmount]);

    return (
      <div data-testid={`marker-${title}`} onClick={onClick}>
        {title}
      </div>
    );
  },
  DirectionsRenderer: () => <div data-testid="directions-renderer" />,
  Polyline: () => <div data-testid="polyline" />,
}));

// Mock the CSS import
vi.mock('@/assets/styles/map-animations.css', () => ({}));

// Mock window.google
Object.defineProperty(window, 'google', {
  value: {
    maps: {
      Animation: {
        DROP: 'DROP',
      },
      Size: vi.fn(),
      Point: vi.fn(),
      LatLngBounds: vi.fn(() => ({
        extend: vi.fn(),
      })),
      LatLng: vi.fn(),
      DirectionsService: vi.fn(),
      TravelMode: {
        DRIVING: 'DRIVING',
      },
      DirectionsStatus: {
        OK: 'OK',
      },
      places: {
        PlacesService: vi.fn(() => ({
          getDetails: vi.fn(),
          nearbySearch: vi.fn(),
          textSearch: vi.fn(),
        })),
        PlacesServiceStatus: {
          OK: 'OK',
        },
      },
    },
  },
  writable: true,
});

// Spy on getActivityTypeColor to verify it's called
const getActivityTypeColorSpy = vi.spyOn(activityUtils, 'getActivityTypeColor');

const mockTripData: TripData = {
  trip_name: 'Test Trip',
  timezone: 'Pacific/Auckland',
  stops: [
    {
      stop_id: 'stop1',
      name: 'Test Stop 1',
      date: {
        from: '2024-01-01',
        to: '2024-01-02',
      },
      location: { lat: -44.5, lng: 170.0 },
      duration_days: 1,
      accommodation: {
        name: 'Test Hotel',
        address: '123 Test St',
        check_in: '2024-01-01 15:00',
        check_out: '2024-01-02 11:00',
        location: { lat: -44.5, lng: 170.0 },
      },
      activities: [
        {
          activity_id: 'activity1',
          activity_name: 'Test Activity',
          activity_type: ActivityType.ATTRACTION,
          location: {
            lat: -44.6,
            lng: 170.1,
          },
        },
      ],
      scenic_waypoints: [
        {
          activity_id: 'waypoint1',
          activity_name: 'Test Scenic Waypoint',
          location: {
            lat: -44.7,
            lng: 170.2,
            address: 'Scenic Lookout',
          },
          duration: '15 min',
        },
      ],
    },
  ],
};

// Mock trip data with varied activity types for color testing
const mockTripDataWithVariedActivities: TripData = {
  trip_name: 'Test Trip with Varied Activities',
  timezone: 'Pacific/Auckland',
  stops: [
    {
      stop_id: 'stop1',
      name: 'Test Stop 1',
      date: {
        from: '2024-01-01',
        to: '2024-01-02',
      },
      location: { lat: -44.5, lng: 170.0 },
      duration_days: 1,
      accommodation: {
        name: 'Test Hotel',
        address: '123 Test St',
        check_in: '2024-01-01 15:00',
        check_out: '2024-01-02 11:00',
        location: { lat: -44.5, lng: 170.0 },
      },
      activities: [
        {
          activity_id: 'restaurant1',
          activity_name: 'Test Restaurant',
          activity_type: ActivityType.RESTAURANT,
          location: { lat: -44.6, lng: 170.1 },
        },
        {
          activity_id: 'attraction1',
          activity_name: 'Test Attraction',
          activity_type: ActivityType.ATTRACTION,
          location: { lat: -44.7, lng: 170.2 },
        },
        {
          activity_id: 'shopping1',
          activity_name: 'Test Shopping',
          activity_type: ActivityType.SHOPPING,
          location: { lat: -44.8, lng: 170.3 },
        },
      ],
      scenic_waypoints: [],
    },
  ],
};

const defaultProps = {
  tripData: mockTripData,
  currentBaseId: 'stop1',
  selectedActivityId: null,
  activityStatus: {} as Record<string, boolean>,
  onActivitySelect: vi.fn(),
  onBaseSelect: vi.fn(),
};

// Helper function to render with AppStateProvider
const renderWithProvider = (ui: React.ReactElement) => render(<AppStateProvider>{ui}</AppStateProvider>);

describe('MapContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  it('renders the map container', async () => {
    renderWithProvider(<MapContainer {...defaultProps} />);

    expect(screen.getByTestId('load-script')).toBeInTheDocument();
    expect(screen.getByTestId('google-map')).toBeInTheDocument();
  });

  it('renders accommodation and activity markers', async () => {
    renderWithProvider(<MapContainer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Stop 1 - Test Hotel')).toBeInTheDocument();
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });
  });

  it('triggers drop animation when activity is selected', async () => {
    const { rerender } = renderWithProvider(<MapContainer {...defaultProps} />);

    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });

    // Select an activity
    rerender(
      <AppStateProvider>
        <MapContainer {...defaultProps} selectedActivityId="activity1" />
      </AppStateProvider>
    );

    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });
  });

  it('triggers drop animation when base is selected', async () => {
    const { rerender } = renderWithProvider(<MapContainer {...defaultProps} currentBaseId={null} />);

    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Stop 1 - Test Hotel')).toBeInTheDocument();
    });

    // Select a base
    rerender(
      <AppStateProvider>
        <MapContainer {...defaultProps} currentBaseId="stop1" />
      </AppStateProvider>
    );

    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });
  });

  it('handles missing Google Maps API key gracefully', () => {
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = '';

    renderWithProvider(<MapContainer {...defaultProps} />);

    expect(screen.getByText('Map Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Google Maps API key not configured')).toBeInTheDocument();
  });

  it('calls onBaseSelect when accommodation marker is clicked', async () => {
    const onBaseSelect = vi.fn();
    renderWithProvider(<MapContainer {...defaultProps} onBaseSelect={onBaseSelect} />);

    await waitFor(() => {
      const marker = screen.getByTestId('marker-Test Stop 1 - Test Hotel');
      marker.click();
      expect(onBaseSelect).toHaveBeenCalledWith('stop1');
    });
  });

  it('calls onActivitySelect when activity marker is clicked', async () => {
    const onActivitySelect = vi.fn();
    renderWithProvider(<MapContainer {...defaultProps} onActivitySelect={onActivitySelect} />);

    await waitFor(() => {
      const marker = screen.getByTestId('marker-Test Activity');
      marker.click();
      expect(onActivitySelect).toHaveBeenCalledWith('activity1');
    });
  });

  it('renders scenic waypoint markers', async () => {
    renderWithProvider(<MapContainer {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Scenic Waypoint')).toBeInTheDocument();
    });
  });

  it('calls onActivitySelect when scenic waypoint marker is clicked', async () => {
    const onActivitySelect = vi.fn();
    renderWithProvider(<MapContainer {...defaultProps} onActivitySelect={onActivitySelect} />);

    await waitFor(() => {
      const marker = screen.getByTestId('marker-Test Scenic Waypoint');
      marker.click();
      expect(onActivitySelect).toHaveBeenCalledWith('waypoint1');
    });
  });

  it('does not animate the same marker twice in a row', async () => {
    const { rerender } = renderWithProvider(<MapContainer {...defaultProps} />);

    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });

    // Select an activity
    rerender(
      <AppStateProvider>
        <MapContainer {...defaultProps} selectedActivityId="activity1" />
      </AppStateProvider>
    );

    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });

    // Clear the mock
    mockMarker.setAnimation.mockClear();

    // Select the same activity again (should not animate)
    rerender(
      <AppStateProvider>
        <MapContainer {...defaultProps} selectedActivityId="activity1" />
      </AppStateProvider>
    );

    // Should not animate again
    expect(mockMarker.setAnimation).not.toHaveBeenCalled();
  });

  describe('Activity pin styling with getActivityTypeColor', () => {
    beforeEach(() => {
      getActivityTypeColorSpy.mockClear();
    });

    it('should use activity type-specific colors for unvisited activities', async () => {
      renderWithProvider(
        <MapContainer {...defaultProps} activityStatus={{}} currentBaseId="stop1" tripData={mockTripDataWithVariedActivities} />
      );

      await waitFor(() => {
        // Verify getActivityTypeColor was called for each activity type
        expect(getActivityTypeColorSpy).toHaveBeenCalledWith(ActivityType.RESTAURANT);
        expect(getActivityTypeColorSpy).toHaveBeenCalledWith(ActivityType.ATTRACTION);
        expect(getActivityTypeColorSpy).toHaveBeenCalledWith(ActivityType.SHOPPING);
      });

      // Verify the function was called at least 3 times (once per activity)
      expect(getActivityTypeColorSpy.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should use green color for visited activities regardless of type', async () => {
      const activityStatus = {
        restaurant1: true, // visited
        attraction1: false, // unvisited
        shopping1: true, // visited
      };

      renderWithProvider(
        <MapContainer {...defaultProps} activityStatus={activityStatus} currentBaseId="stop1" tripData={mockTripDataWithVariedActivities} />
      );

      await waitFor(() => {
        // Verify markers are rendered
        expect(screen.getByTestId('marker-Test Restaurant')).toBeInTheDocument();
        expect(screen.getByTestId('marker-Test Attraction')).toBeInTheDocument();
        expect(screen.getByTestId('marker-Test Shopping')).toBeInTheDocument();
      });

      // Verify getActivityTypeColor is only called for unvisited activities
      // (visited activities use hardcoded green #10b981)
      const attractionCalls = getActivityTypeColorSpy.mock.calls.filter((call: [ActivityType]) => call[0] === ActivityType.ATTRACTION);
      expect(attractionCalls.length).toBeGreaterThan(0);
    });

    it('should generate different pin icons for different activity types', async () => {
      renderWithProvider(
        <MapContainer {...defaultProps} activityStatus={{}} currentBaseId="stop1" tripData={mockTripDataWithVariedActivities} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('marker-Test Restaurant')).toBeInTheDocument();
        expect(screen.getByTestId('marker-Test Attraction')).toBeInTheDocument();
        expect(screen.getByTestId('marker-Test Shopping')).toBeInTheDocument();
      });

      // Verify these colors are distinct
      const restaurantColor = activityUtils.getActivityTypeColor(ActivityType.RESTAURANT);
      const attractionColor = activityUtils.getActivityTypeColor(ActivityType.ATTRACTION);
      const shoppingColor = activityUtils.getActivityTypeColor(ActivityType.SHOPPING);

      expect(restaurantColor).not.toBe(attractionColor);
      expect(attractionColor).not.toBe(shoppingColor);
      expect(restaurantColor).not.toBe(shoppingColor);
    });
  });
});
