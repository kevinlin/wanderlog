import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Activity, Accommodation } from '@/types';
import { ActivityCard } from '@/components/Cards/ActivityCard';

// Main draggable activities list component
interface DraggableActivitiesListProps {
  activities: Activity[];
  accommodation: Accommodation;
  selectedActivityId?: string | null;
  activityStatus: Record<string, boolean>;
  onActivitySelect: (activityId: string) => void;
  onToggleDone: (activityId: string, done: boolean) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

export const DraggableActivitiesList: React.FC<DraggableActivitiesListProps> = ({
  activities,
  accommodation,
  selectedActivityId,
  activityStatus,
  onActivitySelect,
  onToggleDone,
  onReorder,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10, // Increased for better touch handling
        delay: 100,   // Add delay to distinguish from scrolling
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
      const oldIndex = activities.findIndex(activity => activity.activity_id === active.id);
      const newIndex = activities.findIndex(activity => activity.activity_id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        onReorder(oldIndex, newIndex);
      }
    }
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No activities planned for this stop.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={activities.map(a => a.activity_id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.activity_id}
              activity={activity}
              accommodation={accommodation}
              isSelected={activity.activity_id === selectedActivityId}
              isDone={activityStatus[activity.activity_id] || false}
              onToggleDone={onToggleDone}
              onSelect={onActivitySelect}
              isDraggable={true}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
