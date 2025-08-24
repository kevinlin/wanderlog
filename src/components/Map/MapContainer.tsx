import React, { useCallback, useState } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer } from '@react-google-maps/api';
import { TripStop } from '@/types';

interface MapContainerProps {
  stops: TripStop[];
  currentStopId: string | null;
  selectedActivityId: string | null;
  onActivitySelect: (activityId: string) => void;
  onStopSelect: (stopId: string) => void;
}

const libraries: ("places")[] = ['places'];

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const center = {
  lat: -44.5, // Center of South Island, NZ
  lng: 170.0,
};

const customMapStyle = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
];

export const MapContainer: React.FC<MapContainerProps> = ({
  stops,
  currentStopId,
  selectedActivityId,
  onActivitySelect,
  onStopSelect,
}) => {
  const [, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    setIsMapLoaded(true);
    
    // Fit map to show all stops
    if (stops.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      stops.forEach(stop => {
        bounds.extend(stop.location);
        stop.activities.forEach(activity => {
          if (activity.location?.lat && activity.location?.lng) {
            bounds.extend({ lat: activity.location.lat, lng: activity.location.lng });
          }
        });
      });
      map.fitBounds(bounds);
    }
  }, [stops]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const getMarkerIcon = (_type: 'accommodation' | 'activity', isSelected: boolean, status: 'past' | 'current' | 'upcoming') => {
    let color = '#4A9E9E'; // alpine-teal
    
    if (status === 'past') {
      color = '#9CA3AF'; // gray-400
    } else if (status === 'upcoming') {
      color = '#6B7280'; // gray-500
    }

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
        <circle cx="12" cy="9" r="2.5" fill="white"/>
      </svg>
    `)}`;

    // Check if Google Maps is loaded
    if (typeof window !== 'undefined' && window.google && window.google.maps) {
      return {
        url: iconUrl,
        scaledSize: new window.google.maps.Size(isSelected ? 32 : 24, isSelected ? 32 : 24),
        anchor: new window.google.maps.Point(isSelected ? 16 : 12, isSelected ? 32 : 24),
      };
    }

    // Fallback for when Google Maps hasn't loaded yet
    return {
      url: iconUrl,
    };
  };

  const currentStop = stops.find(stop => stop.stop_id === currentStopId);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="w-full h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Map Unavailable</h3>
          <p className="text-gray-600">Google Maps API key not configured</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={center}
        zoom={7}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: customMapStyle,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        }}
      >
        {/* Only render markers after map is loaded */}
        {isMapLoaded && (
          <>
            {/* Accommodation markers */}
            {stops.map((stop) => (
              <Marker
                key={`accommodation-${stop.stop_id}`}
                position={stop.location}
                title={`${stop.name} - ${stop.accommodation.name}`}
                icon={getMarkerIcon('accommodation', stop.stop_id === currentStopId, 'current')}
                onClick={() => onStopSelect(stop.stop_id)}
              />
            ))}

            {/* Activity markers for current stop */}
            {currentStop?.activities.map((activity) => (
              activity.location?.lat && activity.location?.lng ? (
                <Marker
                  key={`activity-${activity.activity_id}`}
                  position={{ lat: activity.location.lat, lng: activity.location.lng }}
                  title={activity.activity_name}
                  icon={getMarkerIcon('activity', activity.activity_id === selectedActivityId, 'current')}
                  onClick={() => onActivitySelect(activity.activity_id)}
                />
              ) : null
            ))}
          </>
        )}

        {/* Directions renderer for routes between stops */}
        {directionsResponse && (
          <DirectionsRenderer
            directions={directionsResponse}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#4A9E9E',
                strokeOpacity: 0.8,
                strokeWeight: 4,
              },
            }}
          />
        )}
      </GoogleMap>
    </LoadScript>
  );
};
