import React, { useState, useEffect, useRef } from 'react';
import { Activity, Accommodation } from '@/types';
import { AccommodationCard } from '@/components/Cards/AccommodationCard';
import { DraggableActivitiesList } from './DraggableActivity';
import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

interface ActivitiesPanelProps {
  accommodation: Accommodation;
  activities: Activity[];
  stopName: string;
  selectedActivityId?: string | null;
  activityStatus: Record<string, boolean>;
  onActivitySelect: (activityId: string) => void;
  onToggleDone: (activityId: string, done: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  className?: string;
}

export const ActivitiesPanel: React.FC<ActivitiesPanelProps> = ({
  accommodation,
  activities,
  stopName,
  selectedActivityId,
  activityStatus,
  onActivitySelect,
  onToggleDone,
  onReorder,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activityRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

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
        absolute top-4 right-4 
        rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md
        transition-all duration-300 ease-in-out
        ${isExpanded 
          ? 'bottom-4 w-96 overflow-hidden' 
          : 'w-96 max-h-[calc(100vh-8rem)]'
        }
        ${className}
      `}
    >
      {/* Panel Content */}
      <div className={`
        ${isExpanded ? 'h-full flex flex-col' : ''}
      `}>
        {/* Accommodation Card - Always Visible */}
        <div className="p-4">
          <AccommodationCard
            accommodation={accommodation}
            stopName={stopName}
          />
        </div>

        {/* Expand/Collapse Control */}
        {!isExpanded && (
          <div className="px-4 pb-4">
            <button
              onClick={toggleExpanded}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 
                       bg-sky-500/20 hover:bg-sky-500/30 
                       border border-sky-500/30 rounded-lg
                       text-sky-700 font-medium transition-all duration-200
                       hover:shadow-md"
            >
              <span>View Activities ({activities.length})</span>
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Activities Section - Expanded State */}
        {isExpanded && (
          <>
            <div className="px-4 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  Activities ({activities.length})
                </h3>
                <button
                  onClick={toggleExpanded}
                  className="p-2 hover:bg-orange-500/20 rounded-lg transition-colors"
                  aria-label="Collapse activities panel"
                >
                  <ChevronUpIcon className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Scrollable Activities List with Drag & Drop */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-4">
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
          </>
        )}
      </div>
    </div>
  );
};
