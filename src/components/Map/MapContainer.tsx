import { DirectionsRenderer, GoogleMap, Polyline, useJsApiLoader } from '@react-google-maps/api';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadingSpinner } from '@/components/Layout/LoadingSpinner';
import { MapLayerPicker, type MapTypeId, type OverlayLayers } from '@/components/Map/MapLayerPicker';
import { MapMarker } from '@/components/Map/MapMarker';
import { ActivityFace, DotFace, PoiFace, StopFace, WaypointFace } from '@/components/Map/MarkerFaces';
import { getActivityMarker, WAYPOINT_MARKER } from '@/components/Map/markerCategory';
import { PlaceHoverCard } from '@/components/Map/PlaceHoverCard';
import { POIModal } from '@/components/Map/POIModal';
import { MAP_ID, MAPS_LOADER_OPTIONS } from '@/config/mapsLoader';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useCreateActivity, useCreateWaypoint } from '@/hooks/useTripMutations';
import { useTripToday } from '@/hooks/useTripToday';
import { PlacesService } from '@/services/placesService';
import { getMapLayerPreferences, saveMapType, saveOverlayLayers } from '@/services/viewStateStorage';
import type { ScenicWaypoint } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import type { Accommodation, Activity, TripData } from '@/types/trip';
import { enrichActivityWithType, inferActivityType, inferActivityTypeFromGooglePlaces } from '@/utils/activityUtils';
import { getStopTimeStatus } from '@/utils/dateUtils';
import { flyCamera, type LatLng } from '@/utils/mapCamera';
import { getStopColor, getStopInitials } from '@/utils/stopPalette';
import { partitionByVisit } from '@/utils/tripUtils';
import '@/assets/styles/map-markers.css';

// The travelling pulse + trail drawn along a leg while the camera flies to the next stop.
const TRAVEL_COLOR = '#4a9e9e'; // Alpine teal — reads as "this trip", matches the route line.

// Hover state interface for place hover card
interface HoverState {
  accommodation?: Accommodation;
  activity?: Activity;
  id: string;
  isDone?: boolean;
  position: { x: number; y: number };
  scenicWaypoint?: ScenicWaypoint;
  stopColor?: string;
  stopName?: string;
  type: 'accommodation' | 'activity' | 'scenic_waypoint';
}

interface MapContainerProps {
  activityStatus: Record<string, boolean>; // activityId -> visited status
  currentBaseId: string | null;
  onActivitySelect: (activityId: string) => void;
  onBaseSelect: (baseId: string) => void;
  selectedActivityId: string | null;
  tripData: TripData;
}

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const center = {
  lat: -44.5, // Center of South Island, NZ
  lng: 170.0,
};

// Below this zoom the overview shows dots instead of full markers.
const ZOOM_DOTS_BELOW = 11;

type Located<T> = T & { location: { lat: number; lng: number } };

const hasLocation = <T extends { location?: { lat?: number; lng?: number } }>(item: T): item is Located<T> =>
  Boolean(item.location?.lat && item.location?.lng);

export const MapContainer: React.FC<MapContainerProps> = ({
  tripData,
  currentBaseId,
  selectedActivityId,
  activityStatus,
  onActivitySelect,
  onBaseSelect,
}) => {
  const { state, dispatch } = useAppStateContext();
  const createActivityMutation = useCreateActivity(tripData.trip_id ?? '');
  const createWaypointMutation = useCreateWaypoint(tripData.trip_id ?? '');
  const { isLoaded: isMapsLoaded } = useJsApiLoader(MAPS_LOADER_OPTIONS);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const [routeFallback, setRouteFallback] = useState<google.maps.LatLng[]>([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [hoverState, setHoverState] = useState<HoverState | null>(null);
  // The stop whose camera hop has landed. Its activities and waypoints are drawn only then,
  // so a stop arrives first and its places follow.
  const [landedStopId, setLandedStopId] = useState<string | null>(null);
  const [isZoomedOut, setIsZoomedOut] = useState(false);
  const today = useTripToday(tripData.timezone);
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

  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Refs for overlay layer instances
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const transitLayerRef = useRef<google.maps.TransitLayer | null>(null);
  const bicyclingLayerRef = useRef<google.maps.BicyclingLayer | null>(null);

  const previousSelectedActivityRef = useRef<string | null>(null);
  const previousCurrentBaseRef = useRef<string | null>(null);

  // Cinematic stop-hop: cancel handle for the in-flight camera fly, plus the
  // pulse/halo/trail markers drawn along the leg while it travels.
  const travelCancelRef = useRef<(() => void) | null>(null);
  const travelVizRef = useRef<{
    dot: google.maps.Marker;
    halo: google.maps.Marker;
    trail: google.maps.Polyline;
  } | null>(null);

  // Tear down any in-flight hop: cancel the rAF and remove the travel markers.
  const clearTravelViz = useCallback(() => {
    travelCancelRef.current?.();
    travelCancelRef.current = null;
    const viz = travelVizRef.current;
    if (viz) {
      viz.dot.setMap(null);
      viz.halo.setMap(null);
      viz.trail.setMap(null);
      travelVizRef.current = null;
    }
  }, []);

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
    clearTravelViz();
    setMapInstance(null);
  }, [clearTravelViz]);

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

  // Apply a camera pose atomically where supported, falling back to discrete setters.
  const applyCamera = useCallback(
    (center: LatLng, zoom: number) => {
      if (!mapInstance) return;
      if (typeof mapInstance.moveCamera === 'function') {
        mapInstance.moveCamera({ center, zoom });
      } else {
        mapInstance.setCenter(center);
        mapInstance.setZoom(zoom);
      }
    },
    [mapInstance]
  );

  // Fade the pulse + trail out over ~220ms after the camera settles, then remove.
  const fadeOutTravelViz = useCallback(() => {
    const viz = travelVizRef.current;
    if (!viz) return;
    const FADE_MS = 220;
    let start = 0;
    const step = (ts: number) => {
      if (travelVizRef.current !== viz) return; // superseded by a newer hop
      if (!start) start = ts;
      const k = Math.min((ts - start) / FADE_MS, 1);
      const o = 1 - k;
      viz.dot.setOpacity(o);
      viz.halo.setOpacity(o * 0.35);
      viz.trail.setOptions({ strokeOpacity: o * 0.9 });
      if (k < 1) {
        travelCancelRef.current = (() => {
          const raf = requestAnimationFrame(step);
          return () => cancelAnimationFrame(raf);
        })();
      } else {
        clearTravelViz();
      }
    };
    travelCancelRef.current = (() => {
      const raf = requestAnimationFrame(step);
      return () => cancelAnimationFrame(raf);
    })();
  }, [clearTravelViz]);

  // The signature "reaching the next stop" moment: ease the camera along the
  // leg (pulling back for long legs), tracing a pulse + growing trail from the
  // previous stop to the new one. Reduced motion settles instantly with no viz.
  // Every path publishes the landing; a cancelled hop never reaches onDone, so only the
  // active hop can, and going A -> B -> A before B lands still waits for A's own landing.
  const animateStopHop = useCallback(
    (from: LatLng | null, to: LatLng, stopId: string) => {
      if (!mapInstance) {
        setLandedStopId(stopId);
        return;
      }

      if (prefersReducedMotion) {
        applyCamera(to, PLACE_ZOOM_LEVEL);
        setLandedStopId(stopId);
        return;
      }

      clearTravelViz();

      const startCenter = mapInstance.getCenter();
      const fromCam: LatLng = startCenter ? { lat: startCenter.lat(), lng: startCenter.lng() } : (from ?? to);
      const fromZoom = mapInstance.getZoom() ?? PLACE_ZOOM_LEVEL;

      // Only draw the travelling pulse when we know which stop we came from.
      if (from) {
        const dot = new google.maps.Marker({
          map: mapInstance,
          position: from,
          zIndex: 9999,
          clickable: false,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 5,
            fillColor: TRAVEL_COLOR,
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2,
          },
        });
        const halo = new google.maps.Marker({
          map: mapInstance,
          position: from,
          zIndex: 9998,
          clickable: false,
          opacity: 0.35,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: TRAVEL_COLOR,
            fillOpacity: 1,
            strokeWeight: 0,
          },
        });
        const trail = new google.maps.Polyline({
          map: mapInstance,
          path: [from, from],
          geodesic: true,
          strokeColor: TRAVEL_COLOR,
          strokeOpacity: 0.9,
          strokeWeight: 3,
          zIndex: 9997,
        });
        travelVizRef.current = { dot, halo, trail };
      }

      travelCancelRef.current = flyCamera({
        from: fromCam,
        to,
        fromZoom,
        toZoom: PLACE_ZOOM_LEVEL,
        onFrame: (center, zoom, e) => {
          applyCamera(center, zoom);
          const viz = travelVizRef.current;
          if (from && viz) {
            const point: LatLng = {
              lat: from.lat + (to.lat - from.lat) * e,
              lng: from.lng + (to.lng - from.lng) * e,
            };
            viz.dot.setPosition(point);
            viz.halo.setPosition(point);
            viz.trail.setPath([from, point]);
          }
        },
        onDone: () => {
          setLandedStopId(stopId);
          if (travelVizRef.current) {
            fadeOutTravelViz();
          } else {
            travelCancelRef.current = null;
          }
        },
      });
    },
    [mapInstance, applyCamera, clearTravelViz, fadeOutTravelViz]
  );

  // MapMarker reports the hovered marker's viewport rect (mouse only). The card is
  // position: fixed, so the rect's bottom centre is exactly what it needs.
  const showHoverCard = useCallback((rect: DOMRect | null, state: Omit<HoverState, 'position'>) => {
    setHoverState(rect ? { ...state, position: { x: rect.left + rect.width / 2, y: rect.bottom } } : null);
  }, []);

  // Route fetching effect
  useEffect(() => {
    if (!(isMapLoaded && tripData?.stops) || tripData.stops.length < 2) {
      return;
    }

    const fetchRoute = async () => {
      try {
        const directionsService = new google.maps.DirectionsService();
        const stops = tripData.stops;

        // Create waypoints array including scenic waypoints as pass-through points
        const waypoints: google.maps.DirectionsWaypoint[] = [];
        const MAX_WAYPOINTS = 25;

        for (let i = 0; i < stops.length; i++) {
          const currentStop = stops[i];

          // For stops after the first, add scenic waypoints from CURRENT stop
          // (scenic_waypoints are defined as waypoints TO visit on the way TO this stop)
          if (i > 0) {
            const scenicWaypoints = currentStop.scenic_waypoints || [];
            for (const waypoint of scenicWaypoints) {
              if (waypoint.location?.lat && waypoint.location?.lng) {
                waypoints.push({
                  location: { lat: waypoint.location.lat, lng: waypoint.location.lng },
                  stopover: false, // Pass through without formal stop
                });
              }
            }
          }

          // Add intermediate stops (not first or last) as stopovers
          if (i > 0 && i < stops.length - 1) {
            waypoints.push({
              location: currentStop.accommodation?.location || currentStop.location,
              stopover: true,
            });
          }
        }

        // Truncate waypoints if exceeding Google Maps limit (prioritize accommodation stops)
        let finalWaypoints = waypoints;
        if (waypoints.length > MAX_WAYPOINTS) {
          // Separate accommodation stops (stopover: true) from scenic waypoints (stopover: false)
          const accommodationStops = waypoints.filter((w) => w.stopover === true);
          const scenicWaypoints = waypoints.filter((w) => w.stopover === false);
          // Always include all accommodation stops, fill remaining slots with scenic waypoints
          const remainingSlots = MAX_WAYPOINTS - accommodationStops.length;
          finalWaypoints = [...scenicWaypoints.slice(0, Math.max(0, remainingSlots)), ...accommodationStops];
          // Re-sort to maintain geographic order (interleave scenic before their destination stop)
          finalWaypoints = waypoints.filter((w) => finalWaypoints.includes(w));
        }

        const request: google.maps.DirectionsRequest = {
          origin: stops[0].accommodation?.location || stops[0].location,
          destination: stops[stops.length - 1].accommodation?.location || stops[stops.length - 1].location,
          waypoints: finalWaypoints,
          travelMode: google.maps.TravelMode.DRIVING,
          optimizeWaypoints: false,
        };

        directionsService.route(request, (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            setDirectionsResponse(result);
            setRouteError(null);
            setRouteFallback([]);
          } else {
            setRouteError('Unable to load route details');
            // Fall back to straight-line polylines
            const fallbackRoute = stops.map((stop) => new google.maps.LatLng(stop.location.lat, stop.location.lng));
            setRouteFallback(fallbackRoute);
            setDirectionsResponse(null);
          }
        });
      } catch {
        setRouteError('Route service unavailable');
        // Fall back to straight-line polylines
        const fallbackRoute = tripData.stops.map((stop) => new google.maps.LatLng(stop.location.lat, stop.location.lng));
        setRouteFallback(fallbackRoute);
        setDirectionsResponse(null);
      }
    };

    fetchRoute();
  }, [isMapLoaded, tripData?.stops]);

  // The only caller of animateStopHop: switching stops reads as a journey rather than a jump.
  useEffect(() => {
    if (currentBaseId && currentBaseId !== previousCurrentBaseRef.current && isMapLoaded) {
      // Fly from the stop we came from to the one just selected.
      const previousStop = tripData?.stops?.find((stop) => stop.stop_id === previousCurrentBaseRef.current);
      const currentStop = tripData?.stops?.find((stop) => stop.stop_id === currentBaseId);
      if (currentStop) {
        const target = currentStop.accommodation?.location || currentStop.location;
        const origin = previousStop ? previousStop.accommodation?.location || previousStop.location : null;
        setLandedStopId(null);
        animateStopHop(origin ? { lat: origin.lat, lng: origin.lng } : null, { lat: target.lat, lng: target.lng }, currentBaseId);
      }

      previousCurrentBaseRef.current = currentBaseId;
    }
  }, [currentBaseId, isMapLoaded, tripData?.stops, animateStopHop]);

  useEffect(() => {
    // Center and zoom when activity selection changes
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
      previousSelectedActivityRef.current = selectedActivityId;
    } else if (!selectedActivityId) {
      previousSelectedActivityRef.current = null;
    }
  }, [selectedActivityId, isMapLoaded, currentBaseId, tripData?.stops, centerAndZoomOnLocation]);

  // A boolean, so React skips the re-render on the fractional-zoom frames of a hop.
  useEffect(() => {
    if (!mapInstance) return;
    const readZoom = () => setIsZoomedOut((mapInstance.getZoom() ?? 0) < ZOOM_DOTS_BELOW);
    readZoom();
    const listener = mapInstance.addListener('zoom_changed', readZoom);
    return () => listener.remove();
  }, [mapInstance]);

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

  // Add activity from POI (persists via the optimistic create mutation)
  const handleAddActivityFromPOI = useCallback(
    (poi: POIDetails) => {
      if (!currentBaseId) return;

      const stop = tripData.stops.find((s) => s.stop_id === currentBaseId);
      createActivityMutation.mutate({
        stopId: currentBaseId,
        sortOrder: stop?.activities.length ?? 0,
        tempId: crypto.randomUUID(),
        input: {
          name: poi.name,
          type: inferActivityType(poi.name, undefined, poi.types),
          lat: poi.location.lat,
          lng: poi.location.lng,
          address: poi.formatted_address,
          duration: '1-2 hours',
          url: poi.website,
          remarks: poi.rating ? `Rating: ${poi.rating}/5 (${poi.user_ratings_total} reviews)` : undefined,
          thumbnailUrl: poi.photos?.[0]?.photo_reference,
          googlePlaceId: poi.place_id,
        },
      });
    },
    [currentBaseId, tripData.stops, createActivityMutation]
  );

  // Add scenic waypoint from POI (persists via the optimistic create mutation)
  const handleAddScenicWaypointFromPOI = useCallback(
    (poi: POIDetails) => {
      if (!currentBaseId) return;

      const stop = tripData.stops.find((s) => s.stop_id === currentBaseId);
      createWaypointMutation.mutate({
        stopId: currentBaseId,
        sortOrder: stop?.scenic_waypoints?.length ?? 0,
        tempId: crypto.randomUUID(),
        input: {
          name: poi.name,
          lat: poi.location.lat,
          lng: poi.location.lng,
          address: poi.formatted_address,
          duration: '30 mins - 1 hour', // Default for scenic stops
          url: poi.website,
          remarks: poi.rating ? `Rating: ${poi.rating}/5 (${poi.user_ratings_total} reviews)` : undefined,
          thumbnailUrl: poi.photos?.[0]?.photo_reference,
          googlePlaceId: poi.place_id,
        },
      });
    },
    [currentBaseId, tripData.stops, createWaypointMutation]
  );

  // Close POI modal
  const handleClosePOIModal = useCallback(() => {
    dispatch({ type: 'CLOSE_POI_MODAL' });
  }, [dispatch]);

  const currentBase = tripData?.stops?.find((stop) => stop.stop_id === currentBaseId);

  // Enriched first, so the marker, its title and the hover card all use the inferred type.
  const placedActivities = (currentBase?.activities ?? []).filter(hasLocation).map(enrichActivityWithType).filter(hasLocation);
  const placedWaypoints = (currentBase?.scenic_waypoints ?? []).filter(hasLocation);
  const nextActivityId = partitionByVisit(placedActivities, placedWaypoints).planned[0]?.activity_id;
  const showPlaces = Boolean(currentBase) && landedStopId === currentBaseId;

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

  if (!isMapsLoaded) {
    return <LoadingSpinner />;
  }

  return (
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
        mapId: MAP_ID, // Required by AdvancedMarkerElement; the JSON `styles` option cannot coexist with it
        mapTypeId: mapType,
        disableDefaultUI: false,
        zoomControl: true,
        streetViewControl: false,
        isFractionalZoomEnabled: true, // Smooth sub-integer zoom for the cinematic stop-hop arc
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
          {tripData.stops.map((stop, index) => {
            const status = getStopTimeStatus(stop, today);
            const statusLabel = status === 'current' ? 'today' : status;
            const isViewing = stop.stop_id === currentBaseId;
            const color = getStopColor(index).color;
            const position = stop.accommodation?.location || stop.location;
            const title = stop.accommodation ? `${stop.name} - ${stop.accommodation.name}, ${statusLabel}` : `${stop.name}, ${statusLabel}`;
            return (
              <MapMarker
                key={`stop-${stop.stop_id}`}
                onClick={() => onBaseSelect(stop.stop_id)}
                onHoverChange={(rect) =>
                  showHoverCard(rect, {
                    type: 'accommodation',
                    id: stop.stop_id,
                    accommodation: stop.accommodation,
                    stopName: stop.name,
                    stopColor: color,
                  })
                }
                position={{ lat: position.lat, lng: position.lng }}
                title={title}
                zIndex={isViewing ? 30 : 10}
              >
                {/* Keyed on the landing so the drop replays each time the stop is reached */}
                <StopFace
                  color={color}
                  initials={getStopInitials(stop.name)}
                  isLanding={isViewing && landedStopId === stop.stop_id}
                  isViewing={isViewing}
                  key={`${stop.stop_id}-${landedStopId}`}
                  name={stop.name}
                  showLabel={isViewing && isZoomedOut}
                  status={status}
                />
              </MapMarker>
            );
          })}

          {/* Activities and scenic waypoints of the viewed stop, once the camera has landed */}
          {showPlaces &&
            placedActivities.map((activity, index) => {
              const { lat, lng } = activity.location;
              const isDone = Boolean(activityStatus[activity.activity_id]);
              const isSelected = activity.activity_id === selectedActivityId;
              const isNext = activity.activity_id === nextActivityId;
              const { color, Glyph } = getActivityMarker(activity.activity_type);
              const asDot = isZoomedOut && !isSelected;
              let zIndex = 20;
              if (isSelected) zIndex = 40;
              else if (isDone) zIndex = 15;
              let suffix = '';
              if (isDone) suffix = ', done';
              else if (isNext) suffix = ', next up';

              return (
                <MapMarker
                  centred={asDot}
                  key={`activity-${activity.activity_id}`}
                  onClick={() => onActivitySelect(activity.activity_id)}
                  onHoverChange={(rect) => showHoverCard(rect, { type: 'activity', id: activity.activity_id, activity, isDone })}
                  position={{ lat, lng }}
                  title={`${activity.activity_name}${suffix}`}
                  zIndex={zIndex}
                >
                  {asDot ? (
                    <DotFace color={color} isDone={isDone} kind="activity" />
                  ) : (
                    <ActivityFace
                      color={color}
                      enterIndex={index}
                      Glyph={Glyph}
                      isDone={isDone}
                      isNext={isNext}
                      isSelected={isSelected}
                      name={activity.activity_name}
                    />
                  )}
                </MapMarker>
              );
            })}

          {showPlaces &&
            placedWaypoints.map((waypoint, index) => {
              const { lat, lng } = waypoint.location;
              const isDone = Boolean(activityStatus[waypoint.activity_id] || waypoint.status?.done);
              const isSelected = waypoint.activity_id === selectedActivityId;
              const asDot = isZoomedOut && !isSelected;
              let zIndex = 20;
              if (isSelected) zIndex = 40;
              else if (isDone) zIndex = 15;

              return (
                <MapMarker
                  centred
                  key={`scenic-waypoint-${waypoint.activity_id}`}
                  onClick={() => onActivitySelect(waypoint.activity_id)}
                  onHoverChange={(rect) =>
                    showHoverCard(rect, { type: 'scenic_waypoint', id: waypoint.activity_id, scenicWaypoint: waypoint, isDone })
                  }
                  position={{ lat, lng }}
                  title={`${waypoint.activity_name}${isDone ? ', done' : ''}`}
                  zIndex={zIndex}
                >
                  {asDot ? (
                    <DotFace color={WAYPOINT_MARKER.color} isDone={isDone} kind="waypoint" />
                  ) : (
                    <WaypointFace
                      enterIndex={placedActivities.length + index}
                      isDone={isDone}
                      isSelected={isSelected}
                      name={waypoint.activity_name}
                    />
                  )}
                </MapMarker>
              );
            })}

          {/* POI search results: a quiet disc that never competes with the trip's own markers */}
          {state.poiSearch.results.map((poi) => (
            <MapMarker
              centred
              collisionBehavior={google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY}
              key={`search-result-${poi.place_id}`}
              onClick={() => {
                handlePOIClick(poi.place_id);
                centerAndZoomOnLocation(poi.location.lat, poi.location.lng);
              }}
              position={{ lat: poi.location.lat, lng: poi.location.lng }}
              title={`${poi.name}, search result`}
              zIndex={25}
            >
              <PoiFace Glyph={getActivityMarker(inferActivityTypeFromGooglePlaces(poi.types ?? [])).Glyph} name={poi.name} />
            </MapMarker>
          ))}
        </>
      )}

      {/* Directions renderer for routes between stops */}
      {directionsResponse && (
        <DirectionsRenderer
          directions={directionsResponse}
          options={{
            suppressMarkers: true,
            // Every trip edit re-fetches the route; without this each new result re-fits the
            // map to the whole trip, so a check-off would throw the camera out to the overview.
            preserveViewport: true,
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
        <div className="absolute top-4 left-4 rounded-md border border-amber-400 bg-amber-100 px-3 py-2 text-amber-700 text-sm">
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
          stopColor={hoverState.stopColor}
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
  );
};
