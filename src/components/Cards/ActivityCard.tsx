import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type React from 'react';
import { useState } from 'react';
import { ImageViewerModal } from '@/components/Layout/ImageViewerModal';
import { LocationWarning } from '@/components/Layout/LocationWarning';
import type { Accommodation, Activity } from '@/types';
import { generateGoogleMapsUrl } from '@/utils/tripUtils';
import { activityHasLocationIssues } from '@/utils/validationUtils';

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
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const showLocationWarning = activityHasLocationIssues(activity);

  // Only use sortable if draggable is enabled
  const sortable = useSortable({
    id: activity.activity_id,
    disabled: !isDraggable,
  });

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const style = isDraggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : {};

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
    <>
      <div
        className={`
          ${isDraggable && isDragging ? 'z-50 scale-105 opacity-50' : ''}
          ${isDraggable ? 'touch-none' : ''} w-full transition-transform duration-200`}
        ref={isDraggable ? setNodeRef : undefined}
        style={style}
        {...(isDraggable ? attributes : {})}
      >
        <div
          className={`relative w-full cursor-pointer rounded-lg bg-white p-3 shadow-md transition-all duration-200 ${isSelected ? 'bg-sky-500/10 ring-2 ring-sky-500 ring-offset-2' : ''}
            ${isDone ? 'bg-emerald-500/10 opacity-75' : ''}hover:shadow-lg min-h-[60px] touch-manipulation active:bg-orange-500/10`}
          onClick={() => onSelect(activity.activity_id)}
        >
          {/* Drag Handle - positioned inside the card on the left edge middle */}
          {isDraggable && (
            <div
              {...listeners}
              aria-label="Drag to reorder activity"
              className="-translate-y-1/2 absolute top-1/2 left-2 z-10 flex min-h-[32px] min-w-[32px] transform cursor-grab touch-none items-center justify-center rounded-md p-1 transition-all duration-200 hover:bg-sky-500/20 active:cursor-grabbing active:bg-sky-500/30"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle icon */}
              <svg
                className="h-4 w-4 text-gray-400 hover:text-sky-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path d="M8 9h8m-8 6h8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {/* Card content with left padding when draggable */}
          <div className={isDraggable ? 'pl-8' : ''}>
            {/* Header with checkbox and title */}
            <div className="mb-2 flex items-start space-x-3">
              <div className="flex-shrink-0 pt-1">
                <input
                  checked={isDone}
                  className="h-4 w-4 touch-manipulation rounded border-gray-300 text-emerald-500 focus:ring-2 focus:ring-emerald-500"
                  onChange={handleCheckboxChange}
                  type="checkbox"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className={`font-semibold text-base ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                      {activity.activity_name}
                    </h4>
                  </div>

                  {activity.thumbnail_url && (
                    <div className="ml-3 flex-shrink-0">
                      <img
                        alt={activity.activity_name}
                        className="h-16 w-16 cursor-pointer rounded-lg object-cover transition-transform hover:scale-105"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsImageViewerOpen(true);
                        }}
                        src={activity.thumbnail_url}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Content section */}
            {activity.location?.address && <p className="mb-2 text-gray-600 text-sm">📍 {activity.location.address}</p>}

            <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="font-medium text-gray-500">Duration:</span>
                <span className="ml-1 text-gray-900">{activity.duration}</span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Travel time:</span>
                <span className="ml-1 text-gray-900">{activity.travel_time_from_accommodation}</span>
              </div>
            </div>

            {activity.remarks && <p className="mb-2 text-gray-700 text-sm italic">💡 {activity.remarks}</p>}

            {/* Location warning */}
            {showLocationWarning && (
              <div className="mb-2">
                <LocationWarning
                  message="This activity cannot be displayed on the map due to missing or invalid location data."
                  type="activity"
                />
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 border-gray-100 border-t pt-2">
              <a
                className="flex min-h-[44px] flex-1 touch-manipulation items-center justify-center rounded border border-sky-200 font-medium text-sky-500 text-sm transition-colors hover:border-sky-300 hover:text-sky-600 active:text-sky-700"
                href={activity.url}
                onClick={(e) => e.stopPropagation()}
                rel="noopener noreferrer"
                target="_blank"
              >
                View Details →
              </a>

              <button
                className="min-h-[44px] flex-1 touch-manipulation rounded bg-sky-500 px-3 py-2 text-sm text-white transition-colors hover:bg-sky-600 active:bg-sky-700"
                onClick={handleNavigate}
              >
                🧭 Navigate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {activity.thumbnail_url && (
        <ImageViewerModal
          altText={activity.activity_name}
          imageUrl={activity.thumbnail_url}
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </>
  );
};
