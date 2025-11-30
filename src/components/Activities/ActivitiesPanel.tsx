import { ArrowDownTrayIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { WeatherCard } from '@/components/Cards/WeatherCard';
import { useScreenSize } from '@/hooks/useScreenSize';
import { useWeather } from '@/hooks/useWeather';
import { ExportService } from '@/services/exportService';
import type { Accommodation, Activity, TripData, UserModifications } from '@/types';
import type { Coordinates, ScenicWaypoint } from '@/types/map';
import { DraggableActivitiesList } from './DraggableActivity';

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
  onHide?: () => void; // New prop for mobile panel hiding
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
  onHide,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScenicWaypointsExpanded, setIsScenicWaypointsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Screen size detection
  const { isMobile } = useScreenSize();

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

  return (
    <div
      className={`fixed right-0 bottom-0 left-0 z-20 rounded-t-xl border-white/20 border-t bg-white/30 shadow-md backdrop-blur transition-all duration-400 ease-in-out sm:absolute sm:top-2 sm:top-4 sm:right-2 sm:right-4 sm:bottom-auto sm:left-auto sm:rounded-xl sm:border ${mobileClasses}
        ${
          isExpanded
            ? 'h-[calc(100vh-4rem)] w-full max-w-full overflow-hidden sm:bottom-2 sm:bottom-4 sm:w-96 sm:max-w-96'
            : 'h-auto max-h-[60vh] w-full max-w-full sm:max-h-[calc(100vh-8rem)] sm:w-96 sm:max-w-96'
        }
        ${className}
      `}
    >
      {/* Panel Content */}
      <div
        className={`
        ${isExpanded ? 'flex h-full flex-col' : ''}
      `}
      >
        {/* Mobile Collapse Button */}
        {isMobile && onHide && (
          <div className="flex flex-shrink-0 justify-center border-white/20 border-b px-3">
            <button
              aria-label="Hide activities panel"
              className="min-h-[44px] min-w-[44px] touch-manipulation rounded-lg px-2 transition-colors hover:bg-gray-500/20 active:bg-gray-500/30"
              onClick={onHide}
            >
              <ChevronDownIcon className="h-6 w-6 text-gray-600" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div
          className={`
            ${isExpanded ? 'flex-1 overflow-y-auto' : 'max-h-[50vh] overflow-y-auto'} overscroll-contain`}
          ref={scrollContainerRef}
        >
          {/* Accommodation Card - Always Visible */}
          <div className="px-3 pb-3">
            <AccommodationCard accommodation={accommodation} stopName={stopName} />
          </div>

          {/* Scenic Waypoints Section */}
          {scenicWaypoints.length > 0 && (
            <div className="px-3 pb-3">
              <button
                className="mb-3 flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-violet-500/30 bg-violet-500/20 px-4 py-3 font-medium text-violet-700 transition-all duration-200 hover:bg-violet-500/30 hover:shadow-md active:bg-violet-500/40"
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
                className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-sky-500/20 px-4 py-3 font-medium text-sky-700 transition-all duration-200 hover:bg-sky-500/30 hover:shadow-md active:bg-sky-500/40"
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
                    className="min-h-[44px] min-w-[44px] touch-manipulation rounded-lg p-2 transition-colors hover:bg-orange-500/20 active:bg-orange-500/30"
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

              {/* Export Button */}
              <div className="border-white/20 border-t px-3 pt-3 pb-6">
                <button
                  className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-500/30 hover:shadow-md active:bg-emerald-500/40 disabled:cursor-not-allowed disabled:border-gray-500/30 disabled:bg-gray-500/20 disabled:text-gray-500 disabled:hover:bg-gray-500/20"
                  disabled={!(tripData && userModifications)}
                  onClick={handleExport}
                  title="Download your updated trip data with activity status and custom order"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span className="text-sm">💾 Download Trip Data</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
