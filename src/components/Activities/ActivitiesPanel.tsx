import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { POISearchResultCard } from '@/components/Cards/POISearchResultCard';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { WeatherCard } from '@/components/Cards/WeatherCard';
import { useAppStateContext } from '@/contexts/AppStateContext';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useWeather } from '@/hooks/useWeather';
import { ExportService } from '@/services/exportService';
import { PlacesService } from '@/services/placesService';
import type { Accommodation, Activity, TripData, UserModifications } from '@/types';
import type { Coordinates, ScenicWaypoint } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import { inferActivityType } from '@/utils/activityUtils';
import { DraggableActivitiesList } from './DraggableActivity';

// Constants for mobile panel resize
const MOBILE_MIN_PANEL_HEIGHT = 40; // Just the handle visible
const MOBILE_TIMELINE_HEIGHT = 64; // 4rem = 64px
const MOBILE_DEFAULT_PANEL_RATIO = 0.5; // Default to 50% of available height

interface ActivitiesPanelProps {
  accommodation: Accommodation;
  activities: Activity[];
  scenicWaypoints?: ScenicWaypoint[];
  stopName: string;
  baseId: string;
  baseLocation: Coordinates;
  selectedActivityId?: string | null;
  activityStatus: Record<string, boolean>;
  tripData?: TripData;
  userModifications?: UserModifications;
  isVisible?: boolean; // New prop for mobile visibility control
  onActivitySelect: (activityId: string) => void;
  onToggleDone: (activityId: string, done: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onExportSuccess?: () => void;
  onHide?: () => void; // Legacy prop for mobile panel hiding (deprecated, kept for compatibility)
  className?: string;
}

export const ActivitiesPanel: React.FC<ActivitiesPanelProps> = ({
  accommodation,
  activities,
  scenicWaypoints = [],
  stopName,
  baseId,
  baseLocation,
  selectedActivityId,
  activityStatus,
  tripData,
  userModifications,
  isVisible = true,
  onActivitySelect,
  onToggleDone,
  onReorder,
  onExportSuccess,
  onHide: _onHide, // Kept for backward compatibility but no longer used
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScenicWaypointsExpanded, setIsScenicWaypointsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // POI Search state from global context
  const { state, dispatch } = useAppStateContext();
  const { poiSearch } = state;
  const [searchInputValue, setSearchInputValue] = useState('');

  // Screen size detection
  const { isMobile } = useScreenSize();

  // Mobile panel height state and drag tracking
  const [mobilePanelHeight, setMobilePanelHeight] = useState<number | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartHeightRef = useRef(0);

  // Calculate max panel height (viewport - timeline)
  const getMaxPanelHeight = useCallback(() => {
    if (typeof window === 'undefined') return 500;
    return window.innerHeight - MOBILE_TIMELINE_HEIGHT;
  }, []);

  // Initialize mobile panel height on first render
  useEffect(() => {
    if (isMobile && mobilePanelHeight === null) {
      const maxHeight = getMaxPanelHeight();
      setMobilePanelHeight(Math.round(maxHeight * MOBILE_DEFAULT_PANEL_RATIO));
    }
  }, [isMobile, mobilePanelHeight, getMaxPanelHeight]);

  // Clamp height between min and max bounds
  const clampHeight = useCallback(
    (height: number) => {
      const maxHeight = getMaxPanelHeight();
      return Math.max(MOBILE_MIN_PANEL_HEIGHT, Math.min(height, maxHeight));
    },
    [getMaxPanelHeight]
  );

  // Touch event handlers for mobile resize
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!isMobile) return;
      isDraggingRef.current = true;
      dragStartYRef.current = e.touches[0].clientY;
      dragStartHeightRef.current = mobilePanelHeight ?? getMaxPanelHeight() * MOBILE_DEFAULT_PANEL_RATIO;
    },
    [isMobile, mobilePanelHeight, getMaxPanelHeight]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!(isDraggingRef.current && isMobile)) return;
      const deltaY = dragStartYRef.current - e.touches[0].clientY;
      const newHeight = clampHeight(dragStartHeightRef.current + deltaY);
      setMobilePanelHeight(newHeight);
    },
    [isMobile, clampHeight]
  );

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Mouse event handlers for desktop testing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isMobile) return;
      e.preventDefault();
      isDraggingRef.current = true;
      dragStartYRef.current = e.clientY;
      dragStartHeightRef.current = mobilePanelHeight ?? getMaxPanelHeight() * MOBILE_DEFAULT_PANEL_RATIO;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaY = dragStartYRef.current - moveEvent.clientY;
        const newHeight = clampHeight(dragStartHeightRef.current + deltaY);
        setMobilePanelHeight(newHeight);
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [isMobile, mobilePanelHeight, getMaxPanelHeight, clampHeight]
  );

  // Weather data management
  const { fetchWeather, getWeatherForBase } = useWeather();
  const weatherData = getWeatherForBase(baseId);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const toggleScenicWaypoints = () => {
    setIsScenicWaypointsExpanded(!isScenicWaypointsExpanded);
  };

  const handleExport = () => {
    if (!(tripData && userModifications)) {
      console.warn('Export failed: Missing trip data or user modifications');
      return;
    }

    try {
      ExportService.exportAndDownload(tripData, userModifications);
      onExportSuccess?.();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // POI Search handlers
  const handleSearch = useCallback(async () => {
    const query = searchInputValue.trim();
    if (!query) return;

    dispatch({ type: 'SET_POI_SEARCH_QUERY', payload: query });
    dispatch({ type: 'SET_POI_SEARCH_LOADING', payload: true });

    try {
      const placesService = PlacesService.getInstance();
      const results = await placesService.textSearchWithLocationBias(query, baseLocation, 5000);
      dispatch({ type: 'SET_POI_SEARCH_RESULTS', payload: results });
    } catch (error) {
      dispatch({
        type: 'SET_POI_SEARCH_ERROR',
        payload: error instanceof Error ? error.message : 'Search failed',
      });
    }
  }, [searchInputValue, baseLocation, dispatch]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchInputValue('');
    dispatch({ type: 'CLEAR_POI_SEARCH' });
  };

  const handleAddActivityFromPOI = useCallback(
    (poi: POIDetails) => {
      const activityType = inferActivityType(poi.name, undefined, poi.types);
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
        duration: '1-2 hours',
        url: poi.website,
        remarks: poi.rating ? `Rating: ${poi.rating}/5 (${poi.user_ratings_total} reviews)` : undefined,
        google_place_id: poi.place_id,
        order: 999,
      };

      dispatch({
        type: 'ADD_ACTIVITY_FROM_POI',
        payload: { baseId, activity: newActivity },
      });
    },
    [baseId, dispatch]
  );

  // Fetch weather data when component mounts or baseId changes
  useEffect(() => {
    fetchWeather(baseLocation, baseId).catch((error) => {
      console.warn(`Failed to fetch weather for ${baseId}:`, error);
    });
  }, [baseId, baseLocation, fetchWeather]);

  // Auto-expand and scroll to activity when one is selected from map
  useEffect(() => {
    if (selectedActivityId && !isExpanded) {
      setIsExpanded(true);
    }
  }, [selectedActivityId, isExpanded]);

  // Scroll to selected activity when panel is expanded and activity is selected
  useEffect(() => {
    if (selectedActivityId && isExpanded && scrollContainerRef.current) {
      const activityElement = activityRefs.current[selectedActivityId];
      if (activityElement) {
        // Small delay to ensure the panel expansion animation has completed
        setTimeout(() => {
          activityElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest',
          });
        }, 350); // Slightly longer than the 300ms transition
      }
    }
  }, [selectedActivityId, isExpanded]);

  // Mobile slide-out animation classes
  const mobileClasses = isVisible ? 'translate-y-0' : 'translate-y-full';

  // Hide panel completely on mobile when not visible
  if (!isVisible && isMobile) {
    return null;
  }

  // Calculate mobile panel style
  const mobilePanelStyle: React.CSSProperties | undefined =
    isMobile && mobilePanelHeight !== null ? { height: `${mobilePanelHeight}px` } : undefined;

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-10 rounded-t-xl border-white/20 border-t bg-white/30 shadow-md backdrop-blur transition-all duration-400 ease-in-out sm:absolute sm:top-2 sm:top-4 sm:right-2 sm:bottom-auto sm:left-auto sm:rounded-xl sm:border ${mobileClasses}
        ${
          isMobile
            ? 'w-full max-w-full overflow-hidden'
            : isExpanded || isScenicWaypointsExpanded
              ? 'h-[calc(100vh-4rem)] w-full max-w-full overflow-hidden sm:bottom-2 sm:bottom-4 sm:w-96 sm:max-w-96'
              : 'h-auto max-h-[60vh] w-full max-w-full sm:max-h-[calc(100vh-8rem)] sm:w-96 sm:max-w-96'
        }
        ${className}
      `}
      style={mobilePanelStyle}
    >
      {/* Panel Content */}
      <div className="flex h-full flex-col">
        {/* Mobile Resize Handle */}
        {isMobile && (
          <div
            aria-label="Drag to resize panel"
            className="flex flex-shrink-0 cursor-grab touch-none justify-center py-3 active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onTouchStart={handleTouchStart}
            role="slider"
          >
            <div className="h-1.5 w-10 rounded-full bg-gray-400" />
          </div>
        )}

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto overscroll-contain" ref={scrollContainerRef}>
          {/* Accommodation Card - Always Visible */}
          <div className="px-3 py-3">
            <AccommodationCard accommodation={accommodation} stopName={stopName} />
          </div>

          {/* Scenic Waypoints Section */}
          {scenicWaypoints.length > 0 && (
            <div className="px-3 pb-3">
              <button
                className="mb-3 flex min-h-[30px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/20 px-4 py-3 font-medium text-violet-700 transition-all duration-200 hover:bg-violet-500/30 hover:shadow-md active:bg-violet-500/40"
                onClick={toggleScenicWaypoints}
              >
                <span>🏞️ Scenic Waypoints ({scenicWaypoints.length})</span>
                {isScenicWaypointsExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
              </button>

              {isScenicWaypointsExpanded && (
                <div className="space-y-3">
                  {scenicWaypoints.map((waypoint) => (
                    <ScenicWaypointCard
                      accommodation={accommodation}
                      isDone={activityStatus[waypoint.activity_id] ?? waypoint.status?.done ?? false}
                      isSelected={selectedActivityId === waypoint.activity_id}
                      key={waypoint.activity_id}
                      onSelect={onActivitySelect}
                      onToggleDone={onToggleDone}
                      waypoint={waypoint}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Activities Toggle Button */}
          {!isExpanded && (
            <div className="px-3 pb-3">
              <button
                className="flex min-h-[30px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/20 px-4 py-3 font-medium text-sky-700 transition-all duration-200 hover:bg-sky-500/30 hover:shadow-md active:bg-sky-500/40"
                onClick={toggleExpanded}
              >
                <span>📋 Activities ({activities.length})</span>
                <ChevronDownIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Activities Section - Expanded State */}
          {isExpanded && (
            <>
              {/* Activities Header */}
              <div className="flex-shrink-0 px-3 pb-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-lg">📋 Activities ({activities.length})</h3>
                  <button
                    aria-label="Collapse activities panel"
                    className="min-h-[30px] min-w-[44px] touch-manipulation rounded-lg p-2 transition-colors hover:bg-orange-500/20 active:bg-orange-500/30"
                    onClick={toggleExpanded}
                  >
                    <ChevronUpIcon className="h-5 w-5 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Weather Card */}
              <div className="px-3 pb-3">
                <WeatherCard weatherData={weatherData} />
              </div>

              {/* Activities List */}
              <div className="px-3 pb-3">
                <DraggableActivitiesList
                  accommodation={accommodation}
                  activities={activities}
                  activityStatus={activityStatus}
                  onActivitySelect={onActivitySelect}
                  onReorder={onReorder}
                  onToggleDone={onToggleDone}
                  selectedActivityId={selectedActivityId}
                />
              </div>
            </>
          )}

          {/* POI Search Results */}
          {poiSearch.results.length > 0 && (
            <div className="px-3 pb-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">🔍 Search Results ({poiSearch.results.length})</h3>
              </div>
              <div className="space-y-3">
                {poiSearch.results.map((poi) => (
                  <POISearchResultCard key={poi.place_id} onAddToActivities={handleAddActivityFromPOI} poi={poi} />
                ))}
              </div>
            </div>
          )}

          {/* Search Error */}
          {poiSearch.error && (
            <div className="px-3 pb-3">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700 text-sm">{poiSearch.error}</div>
            </div>
          )}
        </div>

        {/* Panel Footer: Search & Download */}
        <div className="flex-shrink-0 px-3 pt-3">
          {/* Search Row */}
          <div className="mb-2 flex gap-2">
            <div className="relative flex-1">
              <input
                className="h-9 w-full rounded-lg border border-gray-300/50 bg-white/70 pr-8 pl-3 text-sm placeholder-gray-500 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                onChange={(e) => setSearchInputValue(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search nearby places..."
                type="text"
                value={searchInputValue}
              />
              {(searchInputValue || poiSearch.results.length > 0) && (
                <button
                  aria-label="Clear search"
                  className="-translate-y-1/2 absolute top-1/2 right-2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                  onClick={handleClearSearch}
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              )}
            </div>
            <button
              aria-label="Search"
              className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/20 text-emerald-700 transition-all hover:bg-emerald-500/30 active:bg-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!searchInputValue.trim() || poiSearch.loading}
              onClick={handleSearch}
            >
              {poiSearch.loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              ) : (
                <MagnifyingGlassIcon className="h-4 w-4" />
              )}
            </button>
            <button
              className="flex min-h-[36px] touch-manipulation items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/20 px-4 py-2 font-medium text-rose-700 text-sm transition-all duration-200 hover:bg-rose-500/30 hover:shadow-md active:bg-rose-500/40 disabled:cursor-not-allowed disabled:border-gray-500/30 disabled:bg-gray-500/20 disabled:text-gray-500 disabled:hover:bg-gray-500/20"
              disabled={!(tripData && userModifications)}
              onClick={handleExport}
              title="Download your updated trip data with activity status and custom order"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
