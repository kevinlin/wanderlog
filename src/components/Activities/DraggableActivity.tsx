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
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity, Accommodation } from '@/types';
import { ActivityCard } from '@/components/Cards/ActivityCard';

// Individual sortable item wrapper
interface SortableActivityItemProps {
  activity: Activity;
  accommodation: Accommodation;
  isSelected: boolean;
  isDone: boolean;
  onToggleDone: (activityId: string, done: boolean) => void;
  onSelect: (activityId: string) => void;
}

const SortableActivityItem: React.FC<SortableActivityItemProps> = ({
  activity,
  accommodation,
  isSelected,
  isDone,
  onToggleDone,
  onSelect,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.activity_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        ${isDragging ? 'opacity-50 z-50 scale-105' : ''}
        touch-none transition-transform duration-200
      `}
      {...attributes}
    >
      {/* Drag Handle - positioned at the left edge */}
      <div className="relative">
        <div
          {...listeners}
          className="absolute left-1 sm:left-2 top-1/2 transform -translate-y-1/2 z-10 
                     cursor-grab active:cursor-grabbing
                     p-2 sm:p-2 hover:bg-sky-500/20 active:bg-sky-500/30 rounded-lg transition-all duration-200
                     touch-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Drag to reorder activity"
        >
          {/* Drag handle icon - enhanced for mobile */}
          <svg className="w-5 h-5 sm:w-4 sm:h-4 text-gray-400 hover:text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8m-8 6h8" />
          </svg>
        </div>
        
        {/* Activity Card with left padding for drag handle */}
        <div className="pl-12 sm:pl-10">
          <ActivityCard
            activity={activity}
            accommodation={accommodation}
            isSelected={isSelected}
            isDone={isDone}
            onToggleDone={onToggleDone}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
};

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
            <SortableActivityItem
              key={activity.activity_id}
              activity={activity}
              accommodation={accommodation}
              isSelected={activity.activity_id === selectedActivityId}
              isDone={activityStatus[activity.activity_id] || false}
              onToggleDone={onToggleDone}
              onSelect={onActivitySelect}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
};
