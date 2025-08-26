import React, { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { TripData, ActivityType } from '@/types/trip';
import { enrichActivityWithType, getActivityTypeSvgPath } from '@/utils/activityUtils';
import * as dateUtils from '@/utils/dateUtils';
import '@/assets/styles/map-animations.css';

interface MapContainerProps {
  tripData: TripData;
  currentBaseId: string | null;
  selectedActivityId: string | null;
  activityStatus: Record<string, boolean>; // activityId -> visited status
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
  activityStatus,
  onActivitySelect,
  onBaseSelect,
}) => {
  const [, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeFallback, setRouteFallback] = useState<google.maps.LatLng[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  
  // Refs to store marker instances for animation
  const accommodationMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const activityMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const previousSelectedActivityRef = useRef<string | null>(null);
  const previousCurrentBaseRef = useRef<string | null>(null);

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
            location: stops[i].accommodation?.location || stops[i].location,
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
          origin: stops[0].accommodation?.location || stops[0].location,
          destination: stops[stops.length - 1].accommodation?.location || stops[stops.length - 1].location,
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

  // Animation effects for pin highlighting
  useEffect(() => {
    // Animate accommodation pin when base selection changes
    if (currentBaseId && currentBaseId !== previousCurrentBaseRef.current && isMapLoaded) {
      const marker = accommodationMarkersRef.current.get(currentBaseId);
      if (marker && window.google?.maps?.Animation) {
        // Use Google Maps DROP animation
        marker.setAnimation(window.google.maps.Animation.DROP);
        // Stop animation after duration
        setTimeout(() => {
          if (marker.getAnimation()) {
            marker.setAnimation(null);
          }
        }, 600);
      }
      previousCurrentBaseRef.current = currentBaseId;
    }
  }, [currentBaseId, isMapLoaded]);

  useEffect(() => {
    // Animate activity pin when activity selection changes
    if (selectedActivityId && selectedActivityId !== previousSelectedActivityRef.current && isMapLoaded) {
      const marker = activityMarkersRef.current.get(selectedActivityId);
      if (marker && window.google?.maps?.Animation) {
        // Use Google Maps DROP animation
        marker.setAnimation(window.google.maps.Animation.DROP);
        // Stop animation after duration
        setTimeout(() => {
          if (marker.getAnimation()) {
            marker.setAnimation(null);
          }
        }, 600);
      }
      previousSelectedActivityRef.current = selectedActivityId;
    } else if (!selectedActivityId) {
      previousSelectedActivityRef.current = null;
    }
  }, [selectedActivityId, isMapLoaded]);

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



  // Accommodation pin (lodge-style) - Enhanced visibility with 1.5x size and Orange-500
  const getAccommodationPinIcon = (baseId: string, isSelected: boolean) => {
    const status = getBaseStatus(baseId);
    let color = '#f97316'; // Orange-500 for active states
    let strokeColor = '#ea580c'; // Orange-600 for outline
    let opacity = 1.0;
    
    if (status === 'past') {
      color = '#f97316';
      opacity = 0.3;
    } else if (status === 'current') {
      color = '#f97316';
      opacity = 1.0;
    } else if (status === 'upcoming') {
      color = '#f97316';
      opacity = 0.7;
    }

    const baseSize = 30; // 1.5x larger than Google Maps default (20px)
    const selectedSize = 33; // 1.1x hover scaling
    const size = isSelected ? selectedSize : baseSize;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" 
              fill="${color}" 
              fill-opacity="${opacity}"
              stroke="${strokeColor}" 
              stroke-width="1" 
              filter="url(#shadow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
    };
  };

  // Activity pin with standardized visited/unvisited colors - Enhanced visibility with 1.5x size
  const getActivityPinIcon = (activityType: ActivityType, isSelected: boolean, isVisited: boolean = false) => {
    // Standardized colors: blue for unvisited, green for visited
    const color = isVisited ? '#10b981' : '#0ea5e9'; // Emerald-500 for visited, Sky-500 for unvisited
    const svgPath = getActivityTypeSvgPath(activityType);
    
    // Calculate stroke color (darker version of fill color)
    const strokeHex = color.length === 7 ? 
      '#' + color.slice(1).match(/.{2}/g)?.map(hex => 
        Math.max(0, parseInt(hex, 16) - 40).toString(16).padStart(2, '0')
      ).join('') || color : color;

    const baseSize = 30; // 1.5x larger than Google Maps default (20px)
    const selectedSize = 33; // 1.1x hover scaling
    const size = isSelected ? selectedSize : baseSize;
    
    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <path d="${svgPath}" 
              fill="${color}" 
              stroke="${strokeHex}" 
              stroke-width="1" 
              filter="url(#shadow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
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
          // Mobile touch optimizations
          gestureHandling: 'greedy', // Allow single-finger panning
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_BOTTOM,
          },
          // Enhanced touch interactions
          clickableIcons: false, // Disable default POI clicks to avoid conflicts
          keyboardShortcuts: false, // Disable keyboard shortcuts on mobile
        }}
      >
        {/* Only render markers after map is loaded */}
        {isMapLoaded && tripData?.stops && (
          <>
            {/* Accommodation markers (lodge-style pins) */}
            {tripData.stops.map((base) => (
              <Marker
                key={`accommodation-${base.stop_id}`}
                position={base.accommodation?.location || base.location}
                title={`${base.name} - ${base.accommodation.name}`}
                icon={getAccommodationPinIcon(base.stop_id, base.stop_id === currentBaseId)}
                onClick={() => onBaseSelect(base.stop_id)}
                onLoad={(marker) => {
                  accommodationMarkersRef.current.set(base.stop_id, marker);
                }}
                onUnmount={() => {
                  accommodationMarkersRef.current.delete(base.stop_id);
                }}
              />
            ))}

            {/* Activity markers for current base with standardized visited/unvisited colors */}
            {currentBase?.activities
              .filter(activity => activity.location?.lat && activity.location?.lng)
              .map((activity) => {
                // TypeScript safety: we know location exists due to filter above
                const location = activity.location!;
                const enrichedActivity = enrichActivityWithType(activity);
                const activityType = enrichedActivity.activity_type || ActivityType.OTHER;
                const isVisited = activityStatus[activity.activity_id] || false;
                
                return (
                  <Marker
                    key={`activity-${activity.activity_id}`}
                    position={{ lat: location.lat!, lng: location.lng! }}
                    title={activity.activity_name}
                    icon={getActivityPinIcon(activityType, activity.activity_id === selectedActivityId, isVisited)}
                    onClick={() => onActivitySelect(activity.activity_id)}
                    onLoad={(marker) => {
                      activityMarkersRef.current.set(activity.activity_id, marker);
                    }}
                    onUnmount={() => {
                      activityMarkersRef.current.delete(activity.activity_id);
                    }}
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
