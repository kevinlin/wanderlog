import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MapContainer } from '../MapContainer';
import { TripData, ActivityType } from '@/types/trip';

// Mock the Google Maps API
const mockMarker = {
  setAnimation: vi.fn(),
  getAnimation: vi.fn(() => null),
};

const mockMap = {
  fitBounds: vi.fn(),
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
      <div 
        data-testid={`marker-${title}`}
        onClick={onClick}
      >
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
    },
  },
  writable: true,
});

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
    },
  ],
};

const defaultProps = {
  tripData: mockTripData,
  currentBaseId: 'stop1',
  selectedActivityId: null,
  onActivitySelect: vi.fn(),
  onBaseSelect: vi.fn(),
};

describe('MapContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up environment variables
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = 'test-api-key';
  });

  it('renders the map container', async () => {
    render(<MapContainer {...defaultProps} />);
    
    expect(screen.getByTestId('load-script')).toBeInTheDocument();
    expect(screen.getByTestId('google-map')).toBeInTheDocument();
  });

  it('renders accommodation and activity markers', async () => {
    render(<MapContainer {...defaultProps} />);
    
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Stop 1 - Test Hotel')).toBeInTheDocument();
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });
  });

  it('triggers drop animation when activity is selected', async () => {
    const { rerender } = render(<MapContainer {...defaultProps} />);
    
    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });

    // Select an activity
    rerender(<MapContainer {...defaultProps} selectedActivityId="activity1" />);
    
    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });
  });

  it('triggers drop animation when base is selected', async () => {
    const { rerender } = render(<MapContainer {...defaultProps} currentBaseId={null} />);
    
    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Stop 1 - Test Hotel')).toBeInTheDocument();
    });

    // Select a base
    rerender(<MapContainer {...defaultProps} currentBaseId="stop1" />);
    
    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });
  });

  it('handles missing Google Maps API key gracefully', () => {
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY = '';
    
    render(<MapContainer {...defaultProps} />);
    
    expect(screen.getByText('Map Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Google Maps API key not configured')).toBeInTheDocument();
  });

  it('calls onBaseSelect when accommodation marker is clicked', async () => {
    const onBaseSelect = vi.fn();
    render(<MapContainer {...defaultProps} onBaseSelect={onBaseSelect} />);
    
    await waitFor(() => {
      const marker = screen.getByTestId('marker-Test Stop 1 - Test Hotel');
      marker.click();
      expect(onBaseSelect).toHaveBeenCalledWith('stop1');
    });
  });

  it('calls onActivitySelect when activity marker is clicked', async () => {
    const onActivitySelect = vi.fn();
    render(<MapContainer {...defaultProps} onActivitySelect={onActivitySelect} />);
    
    await waitFor(() => {
      const marker = screen.getByTestId('marker-Test Activity');
      marker.click();
      expect(onActivitySelect).toHaveBeenCalledWith('activity1');
    });
  });

  it('does not animate the same marker twice in a row', async () => {
    const { rerender } = render(<MapContainer {...defaultProps} />);
    
    // Wait for markers to load
    await waitFor(() => {
      expect(screen.getByTestId('marker-Test Activity')).toBeInTheDocument();
    });

    // Select an activity
    rerender(<MapContainer {...defaultProps} selectedActivityId="activity1" />);
    
    await waitFor(() => {
      expect(mockMarker.setAnimation).toHaveBeenCalledWith('DROP');
    });

    // Clear the mock
    mockMarker.setAnimation.mockClear();

    // Select the same activity again (should not animate)
    rerender(<MapContainer {...defaultProps} selectedActivityId="activity1" />);
    
    // Should not animate again
    expect(mockMarker.setAnimation).not.toHaveBeenCalled();
  });
});
