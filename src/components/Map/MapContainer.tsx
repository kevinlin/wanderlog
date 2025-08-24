import React, { useCallback, useState, useEffect } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { TripData, ActivityType } from '@/types/trip';
import { enrichActivityWithType, getActivityTypeColor } from '@/utils/activityUtils';
import * as dateUtils from '@/utils/dateUtils';

interface MapContainerProps {
  tripData: TripData;
  currentBaseId: string | null;
  selectedActivityId: string | null;
  onActivitySelect: (activityId: string) => void;
  onBaseSelect: (baseId: string) => void;
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

// Travel journal map styling with pastel colors and reduced POI clutter
const customMapStyle = [
  {
    featureType: 'poi',
    stylers: [{ visibility: 'simplified' }],
  },
  {
    featureType: 'poi.business',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#f5f1e8' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#c8e6f5' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#f9f7ed' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#e8f5e8' }],
  },
];

export const MapContainer: React.FC<MapContainerProps> = ({
  tripData,
  currentBaseId,
  selectedActivityId,
  onActivitySelect,
  onBaseSelect,
}) => {
  const [, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeFallback, setRouteFallback] = useState<google.maps.LatLng[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    setIsMapLoaded(true);
    
    // Fit map to show all stops
    if (tripData?.stops && tripData.stops.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      tripData.stops.forEach(stop => {
        bounds.extend(stop.location);
        stop.activities.forEach(activity => {
          if (activity.location?.lat && activity.location?.lng) {
            bounds.extend({ lat: activity.location.lat, lng: activity.location.lng });
          }
        });
      });
      map.fitBounds(bounds);
    }
  }, [tripData?.stops]);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Route fetching effect
  useEffect(() => {
    if (!isMapLoaded || !tripData?.stops || tripData.stops.length < 2) {
      return;
    }

    const fetchRoute = async () => {
      try {
        const directionsService = new google.maps.DirectionsService();
        const stops = tripData.stops;

        // Create waypoints array including scenic waypoints
        const waypoints: google.maps.DirectionsWaypoint[] = [];
        
        // Add intermediate stops as waypoints (all except first and last)
        for (let i = 1; i < stops.length - 1; i++) {
          waypoints.push({
            location: stops[i].location,
            stopover: true
          });

          // Add scenic waypoints for this segment
          if (stops[i].scenic_waypoints) {
            stops[i].scenic_waypoints!.forEach(waypoint => {
              waypoints.push({
                location: { lat: waypoint.lat, lng: waypoint.lng },
                stopover: false
              });
            });
          }
        }

        const request: google.maps.DirectionsRequest = {
          origin: stops[0].location,
          destination: stops[stops.length - 1].location,
          waypoints: waypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        };

        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirectionsResponse(result);
            setRouteError(null);
            setRouteFallback([]);
          } else {
            console.warn('Directions request failed:', status);
            setRouteError('Unable to load route details');
            // Fall back to straight-line polylines
            const fallbackRoute = stops.map(stop => 
              new google.maps.LatLng(stop.location.lat, stop.location.lng)
            );
            setRouteFallback(fallbackRoute);
            setDirectionsResponse(null);
          }
        });
      } catch (error) {
        console.error('Error fetching route:', error);
        setRouteError('Route service unavailable');
        // Fall back to straight-line polylines
        const fallbackRoute = tripData.stops.map(stop => 
          new google.maps.LatLng(stop.location.lat, stop.location.lng)
        );
        setRouteFallback(fallbackRoute);
        setDirectionsResponse(null);
      }
    };

    fetchRoute();
  }, [isMapLoaded, tripData?.stops]);

  // Determine base status for styling
  const getBaseStatus = (baseId: string): 'past' | 'current' | 'upcoming' => {
    if (!tripData) return 'upcoming';
    
    const base = tripData.stops.find(s => s.stop_id === baseId);
    if (!base) return 'upcoming';

    const today = dateUtils.getCurrentNZDate();
    const baseFromDate = dateUtils.parseDate(base.date.from);
    const baseToDate = dateUtils.parseDate(base.date.to);

    if (today < baseFromDate) return 'upcoming';
    if (today > baseToDate) return 'past';
    return 'current';
  };

  // City/Town pin (yellow star - "Starred place" style)
  const getCityPinIcon = (baseId: string, isSelected: boolean) => {
    const status = getBaseStatus(baseId);
    let opacity = 1.0;
    
    if (status === 'past') opacity = 0.4;
    else if (status === 'upcoming') opacity = 0.7;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFD700" fill-opacity="${opacity}" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.09 8.26L22 9L16 14.74L17.18 22L12 18.5L6.82 22L8 14.74L2 9L9.91 8.26L12 2Z"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(isSelected ? 28 : 24, isSelected ? 28 : 24),
      anchor: new window.google.maps.Point(isSelected ? 14 : 12, isSelected ? 14 : 12),
    };
  };

  // Accommodation pin (lodge-style)
  const getAccommodationPinIcon = (baseId: string, isSelected: boolean) => {
    const status = getBaseStatus(baseId);
    let color = '#8B4513'; // Brown for lodge
    
    if (status === 'past') color = '#9CA3AF'; 
    else if (status === 'current') color = '#4A9E9E'; // teal
    else if (status === 'upcoming') color = '#6B7280';

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(isSelected ? 28 : 20, isSelected ? 28 : 20),
      anchor: new window.google.maps.Point(isSelected ? 14 : 10, isSelected ? 28 : 20),
    };
  };

  // Activity pin (type-specific icons)
  const getActivityPinIcon = (activityType: ActivityType, isSelected: boolean) => {
    const color = getActivityTypeColor(activityType);
    
    // Default green flag for "Want to go" style (OTHER type)
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="24" height="24" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
        <path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(isSelected ? 24 : 18, isSelected ? 24 : 18),
      anchor: new window.google.maps.Point(isSelected ? 12 : 9, isSelected ? 24 : 18),
    };
  };

  const currentBase = tripData?.stops?.find(stop => stop.stop_id === currentBaseId);

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
        {isMapLoaded && tripData?.stops && (
          <>
            {/* City/Town markers (yellow star pins) - Primary location markers */}
            {tripData.stops.map((base) => (
              <Marker
                key={`city-${base.stop_id}`}
                position={base.location}
                title={base.name}
                icon={getCityPinIcon(base.stop_id, base.stop_id === currentBaseId)}
                onClick={() => onBaseSelect(base.stop_id)}
              />
            ))}

            {/* Accommodation markers (lodge-style pins) - Slightly offset for visibility */}
            {tripData.stops.map((base) => {
              // Slightly offset accommodation pins to avoid overlap with city pins
              const accommodationPosition = {
                lat: base.location.lat - 0.002, // Small offset south
                lng: base.location.lng + 0.002  // Small offset east
              };
              
              return (
                <Marker
                  key={`accommodation-${base.stop_id}`}
                  position={accommodationPosition}
                  title={`${base.name} - ${base.accommodation.name}`}
                  icon={getAccommodationPinIcon(base.stop_id, base.stop_id === currentBaseId)}
                  onClick={() => onBaseSelect(base.stop_id)}
                />
              );
            })}

            {/* Activity markers for current base (type-specific pins) */}
            {currentBase?.activities
              .filter(activity => activity.location?.lat && activity.location?.lng)
              .map((activity) => {
                // TypeScript safety: we know location exists due to filter above
                const location = activity.location!;
                const enrichedActivity = enrichActivityWithType(activity);
                const activityType = enrichedActivity.activity_type || ActivityType.OTHER;
                
                return (
                  <Marker
                    key={`activity-${activity.activity_id}`}
                    position={{ lat: location.lat!, lng: location.lng! }}
                    title={activity.activity_name}
                    icon={getActivityPinIcon(activityType, activity.activity_id === selectedActivityId)}
                    onClick={() => onActivitySelect(activity.activity_id)}
                  />
                );
              })}
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

        {/* Fallback polyline when Directions API fails */}
        {!directionsResponse && routeFallback.length > 0 && (
          <Polyline
            path={routeFallback}
            options={{
              strokeColor: '#4A9E9E',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              // Note: strokePattern not supported, using solid line for fallback
            }}
          />
        )}

        {/* Route error indicator */}
        {routeError && (
          <div className="absolute top-4 left-4 bg-yellow-100 border border-yellow-400 text-yellow-700 px-3 py-2 rounded-md text-sm">
            ⚠️ {routeError}
          </div>
        )}
      </GoogleMap>
    </LoadScript>
  );
};
