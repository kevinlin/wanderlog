import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type React from 'react';
import { ActivityListItem } from '@/components/Activities/ActivityListItem';
import type { Accommodation, Activity } from '@/types';
import type { TripData } from '@/types/trip';

// Main draggable activities list component
interface DraggableActivitiesListProps {
  accommodation?: Accommodation;
  activities: Activity[];
  isDragDisabled?: boolean;
  onActivitySelect: (activityId: string) => void;
  onDeleteActivity?: (activity: Activity) => void;
  onDone: (activityId: string) => void;
  onEditActivity?: (activity: Activity) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  selectedActivityId?: string | null;
  trip: TripData;
  tripId: string;
}

export const DraggableActivitiesList: React.FC<DraggableActivitiesListProps> = ({
  activities,
  accommodation,
  selectedActivityId,
  isDragDisabled = false,
  onActivitySelect,
  onDone,
  onReorder,
  onEditActivity,
  onDeleteActivity,
  trip,
  tripId,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Increased for better touch handling
        delay: 100, // Add delay to distinguish from scrolling
        tolerance: 5, // Allow some tolerance for touch jitter
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = activities.findIndex((activity) => activity.activity_id === active.id);
      const newIndex = activities.findIndex((activity) => activity.activity_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  if (activities.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-gray-500">No activities planned for this stop.</p>
      </div>
    );
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd} sensors={sensors}>
      <SortableContext items={activities.map((a) => a.activity_id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {activities.map((activity, index) => (
            // Presentational entrance wrapper — keeps the stagger off the card's
            // own drag transform. Replays only when the list remounts (stop change).
            <div className="activity-enter" key={activity.activity_id} style={{ '--enter-index': index } as React.CSSProperties}>
              <ActivityListItem
                accommodation={accommodation}
                activity={activity}
                isDraggable={!isDragDisabled}
                isSelected={activity.activity_id === selectedActivityId}
                onDelete={onDeleteActivity}
                onDone={onDone}
                onEdit={onEditActivity}
                onSelect={onActivitySelect}
                trip={trip}
                tripId={tripId}
              />
            </div>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
