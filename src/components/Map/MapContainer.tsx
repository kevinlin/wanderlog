import { DirectionsRenderer, GoogleMap, LoadScript, Marker, Polyline } from '@react-google-maps/api';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { MapLayerPicker, type MapTypeId, type OverlayLayers } from '@/components/Map/MapLayerPicker';
import { PlaceHoverCard } from '@/components/Map/PlaceHoverCard';
import { POIModal } from '@/components/Map/POIModal';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { PlacesService } from '@/services/placesService';
import { getMapLayerPreferences, saveMapType, saveOverlayLayers } from '@/services/storageService';
import type { ScenicWaypoint } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import { type Accommodation, type Activity, ActivityType, type TripBase, type TripData } from '@/types/trip';
import {
  enrichActivityWithType,
  getAccommodationSvgPath,
  getActivityTypeSvgPath,
  getScenicWaypointSvgPath,
  inferActivityType,
} from '@/utils/activityUtils';
import * as dateUtils from '@/utils/dateUtils';
import '@/assets/styles/map-animations.css';

// Hover state interface for place hover card
interface HoverState {
  type: 'accommodation' | 'activity' | 'scenic_waypoint';
  id: string;
  position: { x: number; y: number };
  accommodation?: Accommodation;
  activity?: Activity;
  scenicWaypoint?: ScenicWaypoint;
  stopName?: string;
  isDone?: boolean;
}

interface MapContainerProps {
  tripData: TripData;
  currentBaseId: string | null;
  selectedActivityId: string | null;
  activityStatus: Record<string, boolean>; // activityId -> visited status
  onActivitySelect: (activityId: string) => void;
  onBaseSelect: (baseId: string) => void;
}

const libraries: 'places'[] = ['places'];

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
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeFallback, setRouteFallback] = useState<google.maps.LatLng[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  const placesServiceRef = useRef<PlacesService | null>(null);

  // Map layer state - initialize from localStorage
  const [mapType, setMapType] = useState<MapTypeId>(() => {
    const saved = getMapLayerPreferences();
    return saved.mapType;
  });
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayers>(() => {
    const saved = getMapLayerPreferences();
    return saved.overlayLayers;
  });

  // Refs for overlay layer instances
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const bicyclingLayerRef = useRef<google.maps.BicyclingLayer | null>(null);

  // Refs to store marker instances for animation
  const accommodationMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const activityMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const scenicWaypointMarkersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const previousSelectedActivityRef = useRef<string | null>(null);
  const previousCurrentBaseRef = useRef<string | null>(null);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      setMapInstance(map);
      setIsMapLoaded(true);

      // Initialize Places Service
      placesServiceRef.current = PlacesService.getInstance();
      placesServiceRef.current.initialize(map);

      // Fit map to show all stops
      if (tripData?.stops && tripData.stops.length > 0) {
        const bounds = new window.google.maps.LatLngBounds();
        tripData.stops.forEach((stop) => {
          bounds.extend(stop.location);
          stop.activities.forEach((activity) => {
            if (activity.location?.lat && activity.location?.lng) {
              bounds.extend({ lat: activity.location.lat, lng: activity.location.lng });
            }
          });
          // Include scenic waypoints in bounds calculation
          stop.scenic_waypoints?.forEach((waypoint) => {
            if (waypoint.location?.lat && waypoint.location?.lng) {
              bounds.extend({ lat: waypoint.location.lat, lng: waypoint.location.lng });
            }
          });
        });
        map.fitBounds(bounds);
      }
    },
    [tripData?.stops]
  );

  const onUnmount = useCallback(() => {
    setMapInstance(null);
  }, []);

  // Default zoom level for centering on a place (neighborhood-level view)
  const PLACE_ZOOM_LEVEL = 14;

  // Center and zoom the map on a specific location
  const centerAndZoomOnLocation = useCallback(
    (lat: number, lng: number) => {
      if (!mapInstance) return;
      mapInstance.panTo({ lat, lng });
      mapInstance.setZoom(PLACE_ZOOM_LEVEL);
    },
    [mapInstance]
  );

  // Convert lat/lng to screen position for hover card placement
  const getScreenPosition = useCallback(
    (lat: number, lng: number): { x: number; y: number } => {
      if (!mapInstance) return { x: 0, y: 0 };

      const projection = mapInstance.getProjection();
      if (!projection) return { x: 0, y: 0 };

      const bounds = mapInstance.getBounds();
      const ne = bounds?.getNorthEast();
      const sw = bounds?.getSouthWest();

      if (!(ne && sw)) return { x: 0, y: 0 };

      const mapDiv = mapInstance.getDiv();
      const mapWidth = mapDiv.offsetWidth;
      const mapHeight = mapDiv.offsetHeight;

      const latRange = ne.lat() - sw.lat();
      const lngRange = ne.lng() - sw.lng();

      const x = ((lng - sw.lng()) / lngRange) * mapWidth;
      const y = ((ne.lat() - lat) / latRange) * mapHeight;

      return { x, y };
    },
    [mapInstance]
  );

  // Hover handlers for markers
  const handleAccommodationHover = useCallback(
    (base: TripBase, isEntering: boolean) => {
      if (!isEntering) {
        setHoverState(null);
        return;
      }

      const position = base.accommodation?.location || base.location;
      const screenPos = getScreenPosition(position.lat, position.lng);

      setHoverState({
        type: 'accommodation',
        id: base.stop_id,
        position: screenPos,
        accommodation: base.accommodation,
        stopName: base.name,
      });
    },
    [getScreenPosition]
  );

  const handleActivityHover = useCallback(
    (activity: Activity, isEntering: boolean) => {
      if (!isEntering) {
        setHoverState(null);
        return;
      }

      if (!(activity.location?.lat && activity.location?.lng)) return;

      const screenPos = getScreenPosition(activity.location.lat, activity.location.lng);

      setHoverState({
        type: 'activity',
        id: activity.activity_id,
        position: screenPos,
        activity,
        isDone: activityStatus[activity.activity_id],
      });
    },
    [getScreenPosition, activityStatus]
  );

  const handleScenicWaypointHover = useCallback(
    (waypoint: ScenicWaypoint, isEntering: boolean) => {
      if (!isEntering) {
        setHoverState(null);
        return;
      }

      if (!(waypoint.location?.lat && waypoint.location?.lng)) return;

      const screenPos = getScreenPosition(waypoint.location.lat, waypoint.location.lng);

      setHoverState({
        type: 'scenic_waypoint',
        id: waypoint.activity_id,
        position: screenPos,
        scenicWaypoint: waypoint,
        isDone: activityStatus[waypoint.activity_id] || waypoint.status?.done,
      });
    },
    [getScreenPosition, activityStatus]
  );

  // Route fetching effect
  useEffect(() => {
    if (!(isMapLoaded && tripData?.stops) || tripData.stops.length < 2) {
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
            stopover: true,
          });
        }

        const request: google.maps.DirectionsRequest = {
          origin: stops[0].accommodation?.location || stops[0].location,
          destination: stops[stops.length - 1].accommodation?.location || stops[stops.length - 1].location,
          waypoints,
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
            const fallbackRoute = stops.map((stop) => new google.maps.LatLng(stop.location.lat, stop.location.lng));
            setRouteFallback(fallbackRoute);
            setDirectionsResponse(null);
          }
        });
      } catch (error) {
        console.error('Error fetching route:', error);
        setRouteError('Route service unavailable');
        // Fall back to straight-line polylines
        const fallbackRoute = tripData.stops.map((stop) => new google.maps.LatLng(stop.location.lat, stop.location.lng));
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
      // Find the base and center/zoom on it
      const currentStop = tripData?.stops?.find((stop) => stop.stop_id === currentBaseId);
      if (currentStop) {
        const position = currentStop.accommodation?.location || currentStop.location;
        centerAndZoomOnLocation(position.lat, position.lng);
      }

      // Animate the accommodation marker
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
  }, [currentBaseId, isMapLoaded, tripData?.stops, centerAndZoomOnLocation]);

  useEffect(() => {
    // Animate activity pin and center/zoom when activity selection changes
    if (selectedActivityId && selectedActivityId !== previousSelectedActivityRef.current && isMapLoaded) {
      // Find the current base from tripData
      const currentStop = tripData?.stops?.find((stop) => stop.stop_id === currentBaseId);

      // Find the activity or scenic waypoint location
      const activity = currentStop?.activities.find((a) => a.activity_id === selectedActivityId);
      const scenicWaypoint = currentStop?.scenic_waypoints?.find((w) => w.activity_id === selectedActivityId);

      // Center and zoom on the selected place
      if (activity?.location?.lat && activity?.location?.lng) {
        centerAndZoomOnLocation(activity.location.lat, activity.location.lng);
      } else if (scenicWaypoint?.location?.lat && scenicWaypoint?.location?.lng) {
        centerAndZoomOnLocation(scenicWaypoint.location.lat, scenicWaypoint.location.lng);
      }

      // Animate the marker
      const marker = activityMarkersRef.current.get(selectedActivityId) || scenicWaypointMarkersRef.current.get(selectedActivityId);
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
  }, [selectedActivityId, isMapLoaded, currentBaseId, tripData?.stops, centerAndZoomOnLocation]);

  // Map type change handler
  const handleMapTypeChange = useCallback(
    (newMapType: MapTypeId) => {
      setMapType(newMapType);
      saveMapType(newMapType); // Persist to localStorage
      if (mapInstance) {
        mapInstance.setMapTypeId(newMapType);
      }
    },
    [mapInstance]
  );

  // Overlay layer toggle handler
  const handleOverlayToggle = useCallback((layer: keyof OverlayLayers) => {
    setOverlayLayers((prev) => {
      const newLayers = {
        ...prev,
        [layer]: !prev[layer],
      };
      saveOverlayLayers(newLayers); // Persist to localStorage
      return newLayers;
    });
  }, []);

  // Effect to manage overlay layers
  useEffect(() => {
    if (!(mapInstance && isMapLoaded)) return;

    // Traffic layer
    if (overlayLayers.traffic) {
      if (!trafficLayerRef.current) {
        trafficLayerRef.current = new google.maps.TrafficLayer();
      }
      trafficLayerRef.current.setMap(mapInstance);
    } else if (trafficLayerRef.current) {
      trafficLayerRef.current.setMap(null);
    }

    // Transit layer
    if (overlayLayers.transit) {
      if (!transitLayerRef.current) {
        transitLayerRef.current = new google.maps.TransitLayer();
      }
      transitLayerRef.current.setMap(mapInstance);
    } else if (transitLayerRef.current) {
      transitLayerRef.current.setMap(null);
    }

    // Bicycling layer
    if (overlayLayers.bicycling) {
      if (!bicyclingLayerRef.current) {
        bicyclingLayerRef.current = new google.maps.BicyclingLayer();
      }
      bicyclingLayerRef.current.setMap(mapInstance);
    } else if (bicyclingLayerRef.current) {
      bicyclingLayerRef.current.setMap(null);
    }
  }, [mapInstance, isMapLoaded, overlayLayers]);

  // Cleanup overlay layers on unmount
  useEffect(
    () => () => {
      if (trafficLayerRef.current) {
        trafficLayerRef.current.setMap(null);
      }
      if (transitLayerRef.current) {
        transitLayerRef.current.setMap(null);
      }
      if (bicyclingLayerRef.current) {
        bicyclingLayerRef.current.setMap(null);
      }
    },
    []
  );

  // Determine base status for styling
  const getBaseStatus = (baseId: string): 'past' | 'current' | 'upcoming' => {
    if (!tripData) return 'upcoming';

    const base = tripData.stops.find((s) => s.stop_id === baseId);
    if (!base) return 'upcoming';

    const today = dateUtils.getCurrentNZDate();
    const baseFromDate = dateUtils.parseDate(base.date.from);
    const baseToDate = dateUtils.parseDate(base.date.to);

    if (today < baseFromDate) return 'upcoming';
    if (today > baseToDate) return 'past';
    return 'current';
  };

  // Accommodation pin (lodge-style) - Enhanced with glow effect and polished Material Design icon
  const getAccommodationPinIcon = (baseId: string, isSelected: boolean, isHovered = false) => {
    const status = getBaseStatus(baseId);
    const color = '#f97316'; // Orange-500 for active states
    const strokeColor = '#ea580c'; // Orange-600 for outline
    const glowColor = 'rgba(249, 115, 22, 0.7)'; // Orange glow
    let opacity = 1.0;

    if (status === 'past') {
      opacity = 0.3;
    } else if (status === 'upcoming') {
      opacity = 0.7;
    }

    const baseSize = 30; // 1.5x larger than Google Maps default (20px)
    const selectedSize = 33; // 1.1x hover scaling
    const size = isSelected || isHovered ? selectedSize : baseSize;
    const svgPath = getAccommodationSvgPath();

    // Glow intensity based on state
    const glowStdDev = isHovered ? 4 : 2;
    const glowOpacity = isHovered ? 0.9 : 0.6;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${glowStdDev}" result="blur"/>
            <feFlood flood-color="${glowColor}" flood-opacity="${glowOpacity}" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" flood-color="rgba(0,0,0,0.3)"/>
          </filter>
        </defs>
        <style>
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          .pin-icon { animation: pulse 2s ease-in-out infinite; }
        </style>
        <path class="pin-icon" d="${svgPath}" 
              fill="${color}" 
              fill-opacity="${opacity}"
              stroke="${strokeColor}" 
              stroke-width="1" 
              filter="url(#glow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
    };
  };

  // Activity pin with standardized visited/unvisited colors - Enhanced with glow effect and polished icons
  const getActivityPinIcon = (activityType: ActivityType, isSelected: boolean, isVisited = false, isHovered = false) => {
    // Standardized colors: blue for unvisited, green for visited
    const color = isVisited ? '#10b981' : '#0ea5e9'; // Emerald-500 for visited, Sky-500 for unvisited
    const glowColor = isVisited ? 'rgba(16, 185, 129, 0.7)' : 'rgba(14, 165, 233, 0.7)';
    const svgPath = getActivityTypeSvgPath(activityType);

    // Calculate stroke color (darker version of fill color)
    const strokeHex =
      color.length === 7
        ? '#' +
            color
              .slice(1)
              .match(/.{2}/g)
              ?.map((hex) =>
                Math.max(0, Number.parseInt(hex, 16) - 40)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('') || color
        : color;

    const baseSize = 30; // 1.5x larger than Google Maps default (20px)
    const selectedSize = 33; // 1.1x hover scaling
    const size = isSelected || isHovered ? selectedSize : baseSize;

    // Glow intensity based on state
    const glowStdDev = isHovered ? 4 : 2;
    const glowOpacity = isHovered ? 0.9 : 0.6;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${glowStdDev}" result="blur"/>
            <feFlood flood-color="${glowColor}" flood-opacity="${glowOpacity}" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <style>
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          .pin-icon { animation: pulse 2s ease-in-out infinite; }
        </style>
        <path class="pin-icon" d="${svgPath}" 
              fill="${color}" 
              stroke="${strokeHex}" 
              stroke-width="1" 
              filter="url(#glow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
    };
  };

  // Scenic waypoint pin with distinctive violet styling - Enhanced with glow effect
  const getScenicWaypointPinIconFn = (isSelected: boolean, isVisited = false, isHovered = false) => {
    // Violet color scheme for scenic waypoints
    const color = isVisited ? '#10b981' : '#8b5cf6'; // Emerald-500 for visited, Violet-500 for unvisited
    const glowColor = isVisited ? 'rgba(16, 185, 129, 0.7)' : 'rgba(139, 92, 246, 0.7)';
    const svgPath = getScenicWaypointSvgPath();

    // Calculate stroke color (darker version of fill color)
    const strokeHex =
      color.length === 7
        ? '#' +
            color
              .slice(1)
              .match(/.{2}/g)
              ?.map((hex) =>
                Math.max(0, Number.parseInt(hex, 16) - 40)
                  .toString(16)
                  .padStart(2, '0')
              )
              .join('') || color
        : color;

    const baseSize = 30; // 1.5x larger than Google Maps default (20px)
    const selectedSize = 33; // 1.1x hover scaling
    const size = isSelected || isHovered ? selectedSize : baseSize;

    // Glow intensity based on state
    const glowStdDev = isHovered ? 4 : 2;
    const glowOpacity = isHovered ? 0.9 : 0.6;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${glowStdDev}" result="blur"/>
            <feFlood flood-color="${glowColor}" flood-opacity="${glowOpacity}" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <style>
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          .pin-icon { animation: pulse 2s ease-in-out infinite; }
        </style>
        <path class="pin-icon" d="${svgPath}" 
              fill="${color}" 
              stroke="${strokeHex}" 
              stroke-width="1" 
              filter="url(#glow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
    };
  };

  // POI search result pin with distinctive rose/coral styling
  const getSearchResultPinIcon = (isHovered = false) => {
    const color = '#f43f5e'; // Rose-500 for search results
    const glowColor = 'rgba(244, 63, 94, 0.7)';
    const strokeColor = '#e11d48'; // Rose-600 for outline

    // Search result icon: magnifying glass / location marker combo
    const svgPath =
      'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

    const baseSize = 28;
    const selectedSize = 31;
    const size = isHovered ? selectedSize : baseSize;

    const glowStdDev = isHovered ? 4 : 2;
    const glowOpacity = isHovered ? 0.9 : 0.6;

    const iconUrl = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="${glowStdDev}" result="blur"/>
            <feFlood flood-color="${glowColor}" flood-opacity="${glowOpacity}" result="glowColor"/>
            <feComposite in="glowColor" in2="blur" operator="in" result="glow"/>
            <feMerge>
              <feMergeNode in="glow"/>
              <feMergeNode in="glow"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <style>
          @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          .pin-icon { animation: pulse 2s ease-in-out infinite; }
        </style>
        <path class="pin-icon" d="${svgPath}" 
              fill="${color}" 
              stroke="${strokeColor}" 
              stroke-width="1" 
              filter="url(#glow)"/>
      </svg>
    `)}`;

    return {
      url: iconUrl,
      scaledSize: new window.google.maps.Size(size, size),
      anchor: new window.google.maps.Point(size / 2, size),
    };
  };

  // POI click handler
  const handlePOIClick = useCallback(
    async (placeId: string) => {
      if (!(placesServiceRef.current && currentBaseId)) return;

      dispatch({ type: 'SET_POI_MODAL', payload: { isOpen: true, loading: true, error: null, poi: null } });

      try {
        const poiDetails = await placesServiceRef.current.getPlaceDetails(placeId);
        dispatch({ type: 'SET_POI_MODAL', payload: { poi: poiDetails, loading: false } });
      } catch (error) {
        dispatch({
          type: 'SET_POI_MODAL',
          payload: {
            loading: false,
            error: error instanceof Error ? error.message : 'Failed to load place details',
          },
        });
      }
    },
    [currentBaseId, dispatch]
  );

  // Add activity from POI
  const handleAddActivityFromPOI = useCallback(
    (poi: POIDetails) => {
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
        thumbnail_url: poi.photos?.[0]?.photo_reference,
        google_place_id: poi.place_id,
      };

      dispatch({
        type: 'ADD_ACTIVITY_FROM_POI',
        payload: { baseId: currentBaseId, activity: newActivity },
      });
    },
    [currentBaseId, dispatch]
  );

  // Add scenic waypoint from POI
  const handleAddScenicWaypointFromPOI = useCallback(
    (poi: POIDetails) => {
      if (!currentBaseId) return;

      // Generate a unique waypoint ID with scenic prefix
      const waypointId = `poi_scenic_${poi.place_id}_${Date.now()}`;

      const newWaypoint: ScenicWaypoint = {
        activity_id: waypointId,
        activity_name: poi.name,
        location: {
          lat: poi.location.lat,
          lng: poi.location.lng,
          address: poi.formatted_address,
        },
        duration: '30 mins - 1 hour', // Default for scenic stops
        url: poi.website,
        remarks: poi.rating ? `Rating: ${poi.rating}/5 (${poi.user_ratings_total} reviews)` : undefined,
        thumbnail_url: poi.photos?.[0]?.photo_reference,
        google_place_id: poi.place_id,
      };

      dispatch({
        type: 'ADD_SCENIC_WAYPOINT_FROM_POI',
        payload: { baseId: currentBaseId, waypoint: newWaypoint },
      });
    },
    [currentBaseId, dispatch]
  );

  // Close POI modal
  const handleClosePOIModal = useCallback(() => {
    dispatch({ type: 'CLOSE_POI_MODAL' });
  }, [dispatch]);

  const currentBase = tripData?.stops?.find((stop) => stop.stop_id === currentBaseId);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-200">
        <div className="text-center">
          <h3 className="mb-2 font-semibold text-gray-700 text-lg">Map Unavailable</h3>
          <p className="text-gray-600">Google Maps API key not configured</p>
        </div>
      </div>
    );
  }

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <GoogleMap
        center={center}
        mapContainerStyle={mapContainerStyle}
        onClick={(e) => {
          // Handle POI clicks
          const event = e as google.maps.MapMouseEvent & { placeId?: string };
          if (event.placeId) {
            event.stop?.(); // Prevent default info window
            handlePOIClick(event.placeId);
          }
        }}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          styles: mapType === 'roadmap' ? customMapStyle : undefined, // Only apply custom styles to roadmap
          mapTypeId: mapType,
          disableDefaultUI: false,
          zoomControl: true,
          streetViewControl: false,
          mapTypeControl: false, // We use our custom MapLayerPicker
          fullscreenControl: false,
          scaleControl: true, // Show distance scale ruler at bottom right
          // Mobile touch optimizations
          gestureHandling: 'greedy', // Allow single-finger panning
          zoomControlOptions: {
            position: window.google?.maps?.ControlPosition?.RIGHT_BOTTOM,
          },
          // Enhanced touch interactions
          clickableIcons: true, // Enable POI clicks
          keyboardShortcuts: false, // Disable keyboard shortcuts on mobile
        }}
        zoom={7}
      >
        {/* Only render markers after map is loaded */}
        {isMapLoaded && tripData?.stops && (
          <>
            {/* Accommodation markers (lodge-style pins) */}
            {tripData.stops.map((base) => {
              const isHovered = hoverState?.type === 'accommodation' && hoverState?.id === base.stop_id;
              const position = base.accommodation?.location || base.location;
              const title = base.accommodation ? `${base.name} - ${base.accommodation.name}` : base.name;
              return (
                <Marker
                  icon={getAccommodationPinIcon(base.stop_id, base.stop_id === currentBaseId, isHovered)}
                  key={`accommodation-${base.stop_id}`}
                  onClick={() => onBaseSelect(base.stop_id)}
                  onLoad={(marker) => {
                    accommodationMarkersRef.current.set(base.stop_id, marker);
                  }}
                  onMouseOut={() => handleAccommodationHover(base, false)}
                  onMouseOver={() => handleAccommodationHover(base, true)}
                  onUnmount={() => {
                    accommodationMarkersRef.current.delete(base.stop_id);
                  }}
                  position={position}
                  title={title}
                />
              );
            })}

            {/* Activity markers for current base with standardized visited/unvisited colors */}
            {currentBase?.activities
              .filter((activity) => activity.location?.lat && activity.location?.lng)
              .map((activity) => {
                // TypeScript safety: we know location exists due to filter above
                const location = activity.location!;
                const enrichedActivity = enrichActivityWithType(activity);
                const activityType = enrichedActivity.activity_type || ActivityType.OTHER;
                const isVisited = activityStatus[activity.activity_id];
                const isHovered = hoverState?.type === 'activity' && hoverState?.id === activity.activity_id;

                return (
                  <Marker
                    icon={getActivityPinIcon(activityType, activity.activity_id === selectedActivityId, isVisited, isHovered)}
                    key={`activity-${activity.activity_id}`}
                    onClick={() => onActivitySelect(activity.activity_id)}
                    onLoad={(marker) => {
                      activityMarkersRef.current.set(activity.activity_id, marker);
                    }}
                    onMouseOut={() => handleActivityHover(activity, false)}
                    onMouseOver={() => handleActivityHover(activity, true)}
                    onUnmount={() => {
                      activityMarkersRef.current.delete(activity.activity_id);
                    }}
                    position={{ lat: location.lat!, lng: location.lng! }}
                    title={activity.activity_name}
                  />
                );
              })}

            {/* Scenic waypoint markers for current base with violet styling */}
            {currentBase?.scenic_waypoints
              ?.filter((waypoint) => waypoint.location?.lat && waypoint.location?.lng)
              .map((waypoint) => {
                // TypeScript safety: we know location exists due to filter above
                const location = waypoint.location!;
                const isVisited = activityStatus[waypoint.activity_id] || waypoint.status?.done;
                const isHovered = hoverState?.type === 'scenic_waypoint' && hoverState?.id === waypoint.activity_id;

                return (
                  <Marker
                    icon={getScenicWaypointPinIconFn(waypoint.activity_id === selectedActivityId, isVisited, isHovered)}
                    key={`scenic-waypoint-${waypoint.activity_id}`}
                    onClick={() => onActivitySelect(waypoint.activity_id)}
                    onLoad={(marker) => {
                      scenicWaypointMarkersRef.current.set(waypoint.activity_id, marker);
                    }}
                    onMouseOut={() => handleScenicWaypointHover(waypoint, false)}
                    onMouseOver={() => handleScenicWaypointHover(waypoint, true)}
                    onUnmount={() => {
                      scenicWaypointMarkersRef.current.delete(waypoint.activity_id);
                    }}
                    position={{ lat: location.lat!, lng: location.lng! }}
                    title={waypoint.activity_name}
                  />
                );
              })}

            {/* POI Search Result markers with rose styling */}
            {state.poiSearch.results.map((poi) => (
              <Marker
                icon={getSearchResultPinIcon()}
                key={`search-result-${poi.place_id}`}
                onClick={() => {
                  handlePOIClick(poi.place_id);
                  centerAndZoomOnLocation(poi.location.lat, poi.location.lng);
                }}
                position={{ lat: poi.location.lat, lng: poi.location.lng }}
                title={poi.name}
              />
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

        {/* Fallback polyline when Directions API fails */}
        {!directionsResponse && routeFallback.length > 0 && (
          <Polyline
            options={{
              strokeColor: '#4A9E9E',
              strokeOpacity: 0.6,
              strokeWeight: 3,
              // Note: strokePattern not supported, using solid line for fallback
            }}
            path={routeFallback}
          />
        )}

        {/* Route error indicator */}
        {routeError && (
          <div className="absolute top-4 left-4 rounded-md border border-yellow-400 bg-yellow-100 px-3 py-2 text-sm text-yellow-700">
            ⚠️ {routeError}
          </div>
        )}

        {/* POI Modal */}
        <POIModal
          error={state.poiModal.error}
          isOpen={state.poiModal.isOpen}
          loading={state.poiModal.loading}
          onAddToActivities={handleAddActivityFromPOI}
          onAddToScenicWaypoints={handleAddScenicWaypointFromPOI}
          onClose={handleClosePOIModal}
          poi={state.poiModal.poi}
        />

        {/* Place Hover Card */}
        {hoverState && (
          <PlaceHoverCard
            accommodation={hoverState.accommodation}
            activity={hoverState.activity}
            isDone={hoverState.isDone}
            isVisible={true}
            placeType={hoverState.type}
            position={hoverState.position}
            scenicWaypoint={hoverState.scenicWaypoint}
            stopName={hoverState.stopName}
          />
        )}

        {/* Map Layer Picker */}
        <MapLayerPicker
          currentMapType={mapType}
          map={mapInstance}
          onMapTypeChange={handleMapTypeChange}
          onOverlayToggle={handleOverlayToggle}
          overlayLayers={overlayLayers}
        />
      </GoogleMap>
    </LoadScript>
  );
};
