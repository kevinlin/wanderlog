import { closestCenter, DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type React from 'react';
import { ActivityCard } from '@/components/Cards/ActivityCard';
import type { Accommodation, Activity } from '@/types';

// Main draggable activities list component
interface DraggableActivitiesListProps {
  accommodation?: Accommodation;
  activities: Activity[];
  activityStatus: Record<string, boolean>;
  isDragDisabled?: boolean;
  onActivitySelect: (activityId: string) => void;
  onDeleteActivity?: (activity: Activity) => void;
  onEditActivity?: (activity: Activity) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onToggleDone: (activityId: string, done: boolean) => void;
  selectedActivityId?: string | null;
}

export const DraggableActivitiesList: React.FC<DraggableActivitiesListProps> = ({
  activities,
  accommodation,
  selectedActivityId,
  activityStatus,
  isDragDisabled = false,
  onActivitySelect,
  onToggleDone,
  onReorder,
  onEditActivity,
  onDeleteActivity,
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
          {activities.map((activity) => (
            <ActivityCard
              accommodation={accommodation}
              activity={activity}
              isDone={activityStatus[activity.activity_id]}
              isDraggable={!isDragDisabled}
              isSelected={activity.activity_id === selectedActivityId}
              key={activity.activity_id}
              onDelete={onDeleteActivity}
              onEdit={onEditActivity}
              onSelect={onActivitySelect}
              onToggleDone={onToggleDone}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
