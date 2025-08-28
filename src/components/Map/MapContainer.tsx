import React, { useCallback, useState, useEffect, useRef } from 'react';
import { GoogleMap, LoadScript, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { TripData, ActivityType, Activity } from '@/types/trip';
import { enrichActivityWithType, getActivityTypeSvgPath, inferActivityType } from '@/utils/activityUtils';
import { POIDetails } from '@/types/poi';
import { PlacesService } from '@/services/placesService';
import { POIModal } from '@/components/Map/POIModal';
import { useAppStateContext } from '@/contexts/AppStateContext';
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
  const { state, dispatch } = useAppStateContext();
  const [, setMap] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeFallback, setRouteFallback] = useState<google.maps.LatLng[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const placesServiceRef = useRef<PlacesService | null>(null);
  
  // Refs to store marker instances for animation
  const accommodationMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const activityMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const scenicWaypointMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const previousSelectedActivityRef = useRef<string | null>(null);
  const previousCurrentBaseRef = useRef<string | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    setIsMapLoaded(true);
    
    // Initialize Places Service
    placesServiceRef.current = PlacesService.getInstance();
    placesServiceRef.current.initialize(map);
    
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
        // Include scenic waypoints in bounds calculation
        stop.scenic_waypoints?.forEach(waypoint => {
          if (waypoint.location?.lat && waypoint.location?.lng) {
            bounds.extend({ lat: waypoint.location.lat, lng: waypoint.location.lng });
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
    // Animate accommodation pin and scenic waypoints when base selection changes
    if (currentBaseId && currentBaseId !== previousCurrentBaseRef.current && isMapLoaded) {
      const accommodationMarker = accommodationMarkersRef.current.get(currentBaseId);
      if (accommodationMarker && window.google?.maps?.Animation) {
        // Use Google Maps DROP animation
        accommodationMarker.setAnimation(window.google.maps.Animation.DROP);
        // Stop animation after duration
        setTimeout(() => {
          if (accommodationMarker.getAnimation()) {
            accommodationMarker.setAnimation(null);
          }
        }, 600);
      }

      // Animate all scenic waypoints for the current base
      const currentStop = tripData?.stops?.find(stop => stop.stop_id === currentBaseId);
      if (currentStop?.scenic_waypoints) {
        currentStop.scenic_waypoints.forEach((waypoint, index) => {
          const marker = scenicWaypointMarkersRef.current.get(waypoint.activity_id);
          if (marker && window.google?.maps?.Animation) {
            // Stagger the animations slightly for visual effect
            setTimeout(() => {
              marker.setAnimation(window.google.maps.Animation.DROP);
              setTimeout(() => {
                if (marker.getAnimation()) {
                  marker.setAnimation(null);
                }
              }, 600);
            }, index * 100); // 100ms delay between each waypoint animation
          }
        });
      }

      previousCurrentBaseRef.current = currentBaseId;
    }
  }, [currentBaseId, isMapLoaded, tripData?.stops]);

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

  // Scenic waypoint pin with distinctive violet styling
  const getScenicWaypointPinIcon = (isSelected: boolean, isVisited: boolean = false) => {
    // Violet color scheme for scenic waypoints
    const color = isVisited ? '#10b981' : '#8b5cf6'; // Emerald-500 for visited, Violet-500 for unvisited
    // Landscape/mountain SVG path for scenic waypoints
    const svgPath = 'M3 18h18v-2l-4-4-2.5 2.5L12 12l-3.5 3.5L6 14l-3 4z M14 8.5c0 1.38-1.12 2.5-2.5 2.5S9 9.88 9 8.5 10.12 6 11.5 6s2.5 1.12 2.5 2.5z';
    
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

  // POI click handler
  const handlePOIClick = useCallback(async (placeId: string) => {
    if (!placesServiceRef.current || !currentBaseId) return;

    dispatch({ type: 'SET_POI_MODAL', payload: { isOpen: true, loading: true, error: null, poi: null } });

    try {
      const poiDetails = await placesServiceRef.current.getPlaceDetails(placeId);
      dispatch({ type: 'SET_POI_MODAL', payload: { poi: poiDetails, loading: false } });
    } catch (error) {
      dispatch({ 
        type: 'SET_POI_MODAL', 
        payload: { 
          loading: false, 
          error: error instanceof Error ? error.message : 'Failed to load place details' 
        } 
      });
    }
  }, [currentBaseId, dispatch]);

  // Add activity from POI
  const handleAddActivityFromPOI = useCallback((poi: POIDetails) => {
    if (!currentBaseId) return;

    const activityType = inferActivityType(poi.name, undefined, poi.types);
    
    // Generate a unique activity ID
    const activityId = `poi_${poi.place_id}_${Date.now()}`;
    
    const newActivity: Activity = {
      activity_id: activityId,
      activity_name: poi.name,
      activity_type: activityType,
      location: {
        lat: poi.location.lat,
        lng: poi.location.lng,
        address: poi.formatted_address,
      },
      duration: '1-2 hours', // Default duration
      url: poi.website,
      remarks: poi.rating ? `Rating: ${poi.rating}/5 (${poi.user_ratings_total} reviews)` : undefined,
      order: 999, // Add at the end
    };

    dispatch({ 
      type: 'ADD_ACTIVITY_FROM_POI', 
      payload: { baseId: currentBaseId, activity: newActivity } 
    });
  }, [currentBaseId, dispatch]);

  // Close POI modal
  const handleClosePOIModal = useCallback(() => {
    dispatch({ type: 'CLOSE_POI_MODAL' });
  }, [dispatch]);

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
          clickableIcons: true, // Enable POI clicks
          keyboardShortcuts: false, // Disable keyboard shortcuts on mobile
        }}
        onClick={(e) => {
          // Handle POI clicks
          const event = e as google.maps.MapMouseEvent & { placeId?: string };
          if (event.placeId) {
            event.stop?.(); // Prevent default info window
            handlePOIClick(event.placeId);
          }
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

            {/* Scenic waypoint markers for current base with violet styling */}
            {currentBase?.scenic_waypoints
              ?.filter(waypoint => waypoint.location?.lat && waypoint.location?.lng)
              .map((waypoint) => {
                // TypeScript safety: we know location exists due to filter above
                const location = waypoint.location!;
                const isVisited = activityStatus[waypoint.activity_id] || waypoint.status?.done || false;
                
                return (
                  <Marker
                    key={`scenic-waypoint-${waypoint.activity_id}`}
                    position={{ lat: location.lat!, lng: location.lng! }}
                    title={waypoint.activity_name}
                    icon={getScenicWaypointPinIcon(waypoint.activity_id === selectedActivityId, isVisited)}
                    onClick={() => onActivitySelect(waypoint.activity_id)}
                    onLoad={(marker) => {
                      scenicWaypointMarkersRef.current.set(waypoint.activity_id, marker);
                    }}
                    onUnmount={() => {
                      scenicWaypointMarkersRef.current.delete(waypoint.activity_id);
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

        {/* POI Modal */}
        <POIModal
          poi={state.poiModal.poi}
          isOpen={state.poiModal.isOpen}
          loading={state.poiModal.loading}
          error={state.poiModal.error}
          onClose={handleClosePOIModal}
          onAddToActivities={handleAddActivityFromPOI}
        />
      </GoogleMap>
    </LoadScript>
  );
};
