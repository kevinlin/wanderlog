import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Activity, Accommodation } from '@/types';
import { generateGoogleMapsUrl } from '@/utils/tripUtils';
import { activityHasLocationIssues } from '@/utils/validationUtils';
import { LocationWarning } from '@/components/Layout/LocationWarning';

interface ActivityCardProps {
  activity: Activity;
  accommodation: Accommodation;
  isSelected: boolean;
  isDone: boolean;
  onToggleDone: (activityId: string, done: boolean) => void;
  onSelect: (activityId: string) => void;
  isDraggable?: boolean;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  accommodation,
  isSelected,
  isDone,
  onToggleDone,
  onSelect,
  isDraggable = false,
}) => {
  const showLocationWarning = activityHasLocationIssues(activity);

  // Only use sortable if draggable is enabled
  const sortable = useSortable({ 
    id: activity.activity_id,
    disabled: !isDraggable
  });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = sortable;

  const style = isDraggable ? {
    transform: CSS.Transform.toString(transform),
    transition,
  } : {};

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleDone(activity.activity_id, e.target.checked);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = generateGoogleMapsUrl(activity, accommodation.location ? { location: accommodation.location } : undefined);
    window.open(url, '_blank');
  };

  return (
    <div
      ref={isDraggable ? setNodeRef : undefined}
      style={style}
      className={`
        ${isDraggable && isDragging ? 'opacity-50 z-50 scale-105' : ''}
        ${isDraggable ? 'touch-none' : ''} 
        transition-transform duration-200 w-full
      `}
      {...(isDraggable ? attributes : {})}
    >
      <div
        onClick={() => onSelect(activity.activity_id)}
        className={`
          relative w-full bg-white rounded-lg shadow-md p-3 cursor-pointer transition-all duration-200
          ${isSelected ? 'ring-2 ring-sky-500 ring-offset-2 bg-sky-500/10' : ''}
          ${isDone ? 'opacity-75 bg-emerald-500/10' : ''}
          hover:shadow-lg hover:bg-orange-500/5 active:bg-orange-500/10
          touch-manipulation min-h-[60px]
        `}
      >
        {/* Drag Handle - positioned inside the card on the left edge middle */}
        {isDraggable && (
          <div
            {...listeners}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 z-10 
                       cursor-grab active:cursor-grabbing
                       p-1 hover:bg-sky-500/20 active:bg-sky-500/30 rounded-md transition-all duration-200
                       touch-none min-h-[32px] min-w-[32px] flex items-center justify-center"
            aria-label="Drag to reorder activity"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle icon */}
            <svg className="w-4 h-4 text-gray-400 hover:text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 9h8m-8 6h8" />
            </svg>
          </div>
        )}

        {/* Card content with left padding when draggable */}
        <div className={isDraggable ? 'pl-8' : ''}>
          {/* Header with checkbox and title */}
          <div className="flex items-start space-x-3 mb-2">
            <div className="flex-shrink-0 pt-1">
              <input
                type="checkbox"
                checked={isDone}
                onChange={handleCheckboxChange}
                className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 focus:ring-2 touch-manipulation"
              />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className={`text-base font-semibold ${isDone ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {activity.activity_name}
                  </h4>
                </div>

                {activity.thumbnail_url && (
                  <div className="ml-3 flex-shrink-0">
                    <img 
                      src={activity.thumbnail_url} 
                      alt={activity.activity_name}
                      className="w-12 h-12 object-cover rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content section */}
          {activity.location?.address && (
            <p className="text-sm text-gray-600 mb-2">
              📍 {activity.location.address}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2 mb-2 text-sm">
            <div>
              <span className="text-gray-500 font-medium">Duration:</span>
              <span className="text-gray-900 ml-1">{activity.duration}</span>
            </div>
            <div>
              <span className="text-gray-500 font-medium">Travel time:</span>
              <span className="text-gray-900 ml-1">{activity.travel_time_from_accommodation}</span>
            </div>
          </div>

          {activity.remarks && (
            <p className="text-sm text-gray-700 mb-2 italic">
              💡 {activity.remarks}
            </p>
          )}

          {/* Location warning */}
          {showLocationWarning && (
            <div className="mb-2">
              <LocationWarning
                type="activity"
                message="This activity cannot be displayed on the map due to missing or invalid location data."
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sky-500 hover:text-sky-600 active:text-sky-700 text-sm font-medium touch-manipulation min-h-[44px] flex items-center justify-center border border-sky-200 hover:border-sky-300 rounded transition-colors"
            >
              View Details →
            </a>
            
            <button
              onClick={handleNavigate}
              className="flex-1 bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white px-3 py-2 rounded text-sm transition-colors touch-manipulation min-h-[44px]"
            >
              🧭 Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
