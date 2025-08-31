import React, { useState, useEffect, useRef } from 'react';
import { Activity, Accommodation, TripData, UserModifications } from '@/types';
import { Coordinates, ScenicWaypoint } from '@/types/map';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { WeatherCard } from '@/components/Cards/WeatherCard';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { DraggableActivitiesList } from './DraggableActivity';
import { useWeather } from '@/hooks/useWeather';
import { useScreenSize } from '@/hooks/useScreenSize';
import { ExportService } from '@/services/exportService';
import { ChevronDownIcon, ChevronUpIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

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
    if (!tripData || !userModifications) {
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
            inline: 'nearest'
          });
        }, 350); // Slightly longer than the 300ms transition
      }
    }
  }, [selectedActivityId, isExpanded]);

  // Mobile slide-out animation classes
  const mobileClasses = isVisible
    ? 'translate-y-0'
    : 'translate-y-full';

  // Hide panel completely on mobile when not visible
  if (!isVisible && isMobile) {
    return null;
  }

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 sm:absolute sm:top-2 sm:right-2 sm:left-auto sm:bottom-auto sm:top-4 sm:right-4
        rounded-t-xl sm:rounded-xl bg-white/30 backdrop-blur border-t sm:border border-white/20 shadow-md
        transition-all duration-400 ease-in-out z-20
        ${mobileClasses}
        ${isExpanded
          ? 'h-[calc(100vh-4rem)] sm:bottom-2 sm:bottom-4 w-full sm:w-96 max-w-full sm:max-w-96 overflow-hidden'
          : 'h-auto w-full sm:w-96 max-w-full sm:max-w-96 max-h-[60vh] sm:max-h-[calc(100vh-8rem)]'
        }
        ${className}
      `}
    >
      {/* Panel Content */}
      <div className={`
        ${isExpanded ? 'h-full flex flex-col' : ''}
      `}>
        {/* Mobile Collapse Button */}
        {isMobile && onHide && (
          <div className="flex justify-center px-3 border-b border-white/20 flex-shrink-0">
            <button
              onClick={onHide}
              className="px-2 hover:bg-gray-500/20 active:bg-gray-500/30 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
              aria-label="Hide activities panel"
            >
              <ChevronDownIcon className="w-6 h-6 text-gray-600" />
            </button>
          </div>
        )}

        {/* Scrollable Content Area */}
        <div
          ref={scrollContainerRef}
          className={`
            ${isExpanded ? 'flex-1 overflow-y-auto' : 'max-h-[50vh] overflow-y-auto'} 
            overscroll-contain
          `}
        >
          {/* Accommodation Card - Always Visible */}
          <div className="px-3 pb-3">
            <AccommodationCard
              accommodation={accommodation}
              stopName={stopName}
            />
          </div>

          {/* Scenic Waypoints Section */}
          {scenicWaypoints.length > 0 && (
            <div className="px-3 pb-3">
              <button
                onClick={toggleScenicWaypoints}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 
                         bg-violet-500/20 hover:bg-violet-500/30 active:bg-violet-500/40
                         border border-violet-500/30 rounded-lg
                         text-violet-700 font-medium transition-all duration-200
                         hover:shadow-md touch-manipulation min-h-[44px] mb-3"
              >
                <span>🏞️ Scenic Waypoints ({scenicWaypoints.length})</span>
                {isScenicWaypointsExpanded ? (
                  <ChevronUpIcon className="w-4 h-4" />
                ) : (
                  <ChevronDownIcon className="w-4 h-4" />
                )}
              </button>

              {isScenicWaypointsExpanded && (
                <div className="space-y-3">
                  {scenicWaypoints.map((waypoint) => (
                    <ScenicWaypointCard
                      key={waypoint.activity_id}
                      waypoint={waypoint}
                      accommodation={accommodation}
                      isSelected={selectedActivityId === waypoint.activity_id}
                      isDone={activityStatus[waypoint.activity_id] || waypoint.status?.done || false}
                      onToggleDone={onToggleDone}
                      onSelect={onActivitySelect}
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
                onClick={toggleExpanded}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 
                         bg-sky-500/20 hover:bg-sky-500/30 active:bg-sky-500/40
                         border border-sky-500/30 rounded-lg
                         text-sky-700 font-medium transition-all duration-200
                         hover:shadow-md touch-manipulation min-h-[44px]"
              >
                <span>📋 Activities ({activities.length})</span>
                <ChevronDownIcon className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Activities Section - Expanded State */}
          {isExpanded && (
            <>
              {/* Activities Header */}
              <div className="px-3 pb-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    📋 Activities ({activities.length})
                  </h3>
                  <button
                    onClick={toggleExpanded}
                    className="p-2 hover:bg-orange-500/20 active:bg-orange-500/30 rounded-lg transition-colors touch-manipulation min-h-[44px] min-w-[44px]"
                    aria-label="Collapse activities panel"
                  >
                    <ChevronUpIcon className="w-5 h-5 text-gray-600" />
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
                  activities={activities}
                  accommodation={accommodation}
                  selectedActivityId={selectedActivityId}
                  activityStatus={activityStatus}
                  onActivitySelect={onActivitySelect}
                  onToggleDone={onToggleDone}
                  onReorder={onReorder}
                />
              </div>

              {/* Export Button */}
              <div className="px-3 pb-6 border-t border-white/20 pt-3">
                <button
                  onClick={handleExport}
                  disabled={!tripData || !userModifications}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 
                           bg-emerald-500/20 hover:bg-emerald-500/30 active:bg-emerald-500/40
                           disabled:bg-gray-500/20 disabled:hover:bg-gray-500/20
                           border border-emerald-500/30 disabled:border-gray-500/30 
                           rounded-lg text-emerald-700 disabled:text-gray-500 
                           font-medium transition-all duration-200
                           hover:shadow-md disabled:cursor-not-allowed touch-manipulation min-h-[44px]"
                  title="Download your updated trip data with activity status and custom order"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
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
