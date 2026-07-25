import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ActivityListItem } from '@/components/Activities/ActivityListItem';
import { WaypointListItem } from '@/components/Activities/WaypointListItem';
import type { Accommodation, Activity } from '@/types';
import type { ScenicWaypoint } from '@/types/map';
import type { TripData } from '@/types/trip';
import { formatVisitDay, type VisitedGroup } from '@/utils/tripUtils';

interface VisitedSectionProps {
  accommodation?: Accommodation;
  groups: VisitedGroup[];
  onDeleteActivity?: (activity: Activity) => void;
  onDeleteWaypoint?: (waypoint: ScenicWaypoint) => void;
  onEditActivity?: (activity: Activity) => void;
  onEditWaypoint?: (waypoint: ScenicWaypoint) => void;
  onItemDone: (itemId: string) => void;
  onSelect: (itemId: string) => void;
  selectedActivityId?: string | null;
  trip: TripData;
  tripId: string;
}

// Chronology owns this order, so there is no DndContext here and every item is
// rendered undraggable (Req 3.4). The cards are the same ones the planned lists
// use, so a visited item can still be unticked, edited, and re-noted.
export const VisitedSection = ({
  groups,
  accommodation,
  selectedActivityId,
  trip,
  tripId,
  onSelect,
  onItemDone,
  onEditActivity,
  onDeleteActivity,
  onEditWaypoint,
  onDeleteWaypoint,
}: VisitedSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const total = groups.reduce((count, group) => count + group.items.length, 0);

  if (total === 0) {
    return null;
  }

  return (
    <div className="px-3 pb-3">
      <button
        className="flex min-h-[30px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/20 px-4 py-3 font-medium text-emerald-700 transition-all duration-200 hover:bg-emerald-500/30 hover:shadow-md active:bg-emerald-500/40"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <span>🗓️ Visited ({total})</span>
        {isExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-4">
          {groups.map((group) => (
            <div key={group.date ?? 'undated'}>
              <h4 className="mb-2 font-semibold text-emerald-800 text-xs uppercase tracking-wide">
                {group.date ? formatVisitDay(group.date) : 'Time not recorded'}
              </h4>
              <div className="space-y-3">
                {group.items.map((entry) =>
                  entry.kind === 'activity' ? (
                    <ActivityListItem
                      accommodation={accommodation}
                      activity={entry.item}
                      isDraggable={false}
                      isSelected={selectedActivityId === entry.item.activity_id}
                      key={entry.item.activity_id}
                      onDelete={onDeleteActivity}
                      onDone={onItemDone}
                      onEdit={onEditActivity}
                      onSelect={onSelect}
                      trip={trip}
                      tripId={tripId}
                    />
                  ) : (
                    <WaypointListItem
                      accommodation={accommodation}
                      isSelected={selectedActivityId === entry.item.activity_id}
                      key={entry.item.activity_id}
                      onDelete={onDeleteWaypoint}
                      onDone={onItemDone}
                      onEdit={onEditWaypoint}
                      onSelect={onSelect}
                      trip={trip}
                      tripId={tripId}
                      waypoint={entry.item}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
