import type React from 'react';
import { useState } from 'react';
import { ImageViewerModal } from '@/components/Layout/ImageViewerModal';
import { LocationWarning } from '@/components/Layout/LocationWarning';
import type { Accommodation, ScenicWaypoint } from '@/types';
import { generateGoogleMapsUrl } from '@/utils/tripUtils';
import { activityHasLocationIssues } from '@/utils/validationUtils';

interface ScenicWaypointCardProps {
  waypoint: ScenicWaypoint;
  accommodation?: Accommodation;
  isSelected: boolean;
  isDone: boolean;
  onToggleDone: (waypointId: string, done: boolean) => void;
  onSelect: (waypointId: string) => void;
}

export const ScenicWaypointCard: React.FC<ScenicWaypointCardProps> = ({
  waypoint,
  accommodation,
  isSelected,
  isDone,
  onToggleDone,
  onSelect,
}) => {
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);

  // Convert ScenicWaypoint to Activity-like structure for validation
  const waypointAsActivity = {
    activity_id: waypoint.activity_id,
    activity_name: waypoint.activity_name,
    location: waypoint.location,
  };

  const showLocationWarning = activityHasLocationIssues(waypointAsActivity);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onToggleDone(waypoint.activity_id, e.target.checked);
  };

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = generateGoogleMapsUrl(waypointAsActivity, accommodation?.location ? { location: accommodation.location } : undefined);
    window.open(url, '_blank');
  };

  return (
    <>
      <div
        className={`cursor-pointer rounded-lg border border-violet-200/50 bg-gradient-to-r from-violet-50 to-sky-50 p-3 shadow-md transition-all duration-200 ${isSelected ? 'bg-violet-500/10 ring-2 ring-violet-500 ring-offset-2' : ''}
          ${isDone ? 'bg-emerald-500/10 opacity-75' : ''}hover:shadow-lg min-h-[60px] touch-manipulation hover:bg-violet-500/5 active:bg-violet-500/10`}
        onClick={() => onSelect(waypoint.activity_id)}
      >
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0 pt-1">
            <input
              checked={isDone}
              className="h-4 w-4 touch-manipulation rounded border-gray-300 text-violet-500 focus:ring-2 focus:ring-violet-500"
              onChange={handleCheckboxChange}
              type="checkbox"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="mb-2 flex items-center">
                  <h4 className={`font-semibold text-base ${isDone ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                    {waypoint.activity_name}
                  </h4>
                </div>

                {waypoint.location?.address && <p className="mb-2 text-gray-600 text-sm">📍 {waypoint.location.address}</p>}

                {waypoint.duration && (
                  <div className="mb-3 text-sm">
                    <span className="font-medium text-gray-500">Duration:</span>
                    <span className="ml-1 text-gray-900">{waypoint.duration}</span>
                  </div>
                )}

                {waypoint.remarks && <p className="mb-3 text-gray-700 text-sm italic">💡 {waypoint.remarks}</p>}

                {/* Location warning */}
                {showLocationWarning && (
                  <div className="mb-3">
                    <LocationWarning
                      message="This scenic waypoint cannot be displayed on the map due to missing or invalid location data."
                      type="activity"
                    />
                  </div>
                )}
              </div>

              {waypoint.thumbnail_url && (
                <div className="ml-3 flex-shrink-0">
                  <img
                    alt={waypoint.activity_name}
                    className="h-16 w-16 cursor-pointer rounded-lg object-cover transition-transform hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsImageViewerOpen(true);
                    }}
                    src={waypoint.thumbnail_url}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 border-violet-100 border-t pt-3">
              {waypoint.url && (
                <a
                  className="flex min-h-[30px] flex-1 touch-manipulation items-center justify-center rounded border border-violet-200 font-medium text-sm text-violet-500 transition-colors hover:border-violet-300 hover:text-violet-600 active:text-violet-700"
                  href={waypoint.url}
                  onClick={(e) => e.stopPropagation()}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View Details →
                </a>
              )}

              <button
                className={`${waypoint.url ? 'flex-1' : 'w-full'} min-h-[30px] touch-manipulation rounded bg-violet-500 px-1.5 py-1 text-sm text-white transition-colors hover:bg-violet-600 active:bg-violet-700`}
                onClick={handleNavigate}
              >
                🧭 Navigate
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Image Viewer Modal */}
      {waypoint.thumbnail_url && (
        <ImageViewerModal
          altText={waypoint.activity_name}
          imageUrl={waypoint.thumbnail_url}
          isOpen={isImageViewerOpen}
          onClose={() => setIsImageViewerOpen(false)}
        />
      )}
    </>
  );
};
