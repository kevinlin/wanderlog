import React, { useState, useEffect, useRef } from 'react';
import { Activity, Accommodation, TripData, UserModifications } from '@/types';
import { Coordinates, ScenicWaypoint } from '@/types/map';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { WeatherCard } from '@/components/Cards/WeatherCard';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { DraggableActivitiesList } from './DraggableActivity';
import { useWeather } from '@/hooks/useWeather';
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
  onActivitySelect: (activityId: string) => void;
  onToggleDone: (activityId: string, done: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onExportSuccess?: () => void;
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
  onActivitySelect,
  onToggleDone,
  onReorder,
  onExportSuccess,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isScenicWaypointsExpanded, setIsScenicWaypointsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

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

  return (
    <div
      className={`
        absolute top-2 right-2 sm:top-4 sm:right-4 
        rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md
        transition-all duration-300 ease-in-out
        ${isExpanded
          ? 'bottom-2 sm:bottom-4 w-full sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-96 overflow-hidden'
          : 'w-full sm:w-96 max-w-[calc(100vw-1rem)] sm:max-w-96 max-h-[calc(100vh-6rem)] sm:max-h-[calc(100vh-8rem)]'
        }
        ${className}
      `}
    >
      {/* Panel Content */}
      <div className={`
        ${isExpanded ? 'h-full flex flex-col' : ''}
      `}>
        {/* Accommodation Card - Always Visible */}
        <div className="p-3 sm:p-4 pb-2">
          <AccommodationCard
            accommodation={accommodation}
            stopName={stopName}
          />
        </div>

        {/* Scenic Waypoints Section */}
        {scenicWaypoints.length > 0 && (
          <div className="px-3 sm:px-4 pb-2">
            <button
              onClick={toggleScenicWaypoints}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 
                       bg-violet-500/20 hover:bg-violet-500/30 active:bg-violet-500/40
                       border border-violet-500/30 rounded-lg
                       text-violet-700 font-medium transition-all duration-200
                       hover:shadow-md touch-manipulation min-h-[44px] mb-2"
            >
              <span>Scenic Waypoints ({scenicWaypoints.length})</span>
              {isScenicWaypointsExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>

            {isScenicWaypointsExpanded && (
              <div className="space-y-2 mb-2">
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

        {/* Activities Expand/Collapse Control */}
        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
          <button
            onClick={toggleExpanded}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 
                       bg-sky-500/20 hover:bg-sky-500/30 active:bg-sky-500/40
                       border border-sky-500/30 rounded-lg
                       text-sky-700 font-medium transition-all duration-200
                       hover:shadow-md touch-manipulation min-h-[44px]"
          >
            <span>Activities ({activities.length})</span>
            {isExpanded ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Activities Section - Expanded State */}
        {isExpanded && (
          <>
            <div className="px-3 sm:px-4 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Activities ({activities.length})
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

            {/* Scrollable Activities List with Drag & Drop */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 pb-2 overscroll-contain">
              <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                <WeatherCard weatherData={weatherData} />
              </div>

              <DraggableActivitiesList
                activities={activities}
                accommodation={accommodation}
                selectedActivityId={selectedActivityId}
                activityStatus={activityStatus}
                onActivitySelect={onActivitySelect}
                onToggleDone={onToggleDone}
                onReorder={onReorder}
              />
              {/* Export Button */}
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-white/20 pt-3 sm:pt-4">
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
                  <span className="text-sm sm:text-base">Download Updated Trip JSON</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
