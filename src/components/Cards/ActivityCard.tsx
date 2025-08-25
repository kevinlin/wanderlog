import React from 'react';
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
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  accommodation,
  isSelected,
  isDone,
  onToggleDone,
  onSelect,
}) => {
  const showLocationWarning = activityHasLocationIssues(activity);

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
      onClick={() => onSelect(activity.activity_id)}
      className={`
        bg-white rounded-lg shadow-md p-3 sm:p-4 mb-3 cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-sky-500 ring-offset-2 bg-sky-500/10' : ''}
        ${isDone ? 'opacity-75 bg-emerald-500/10' : ''}
        hover:shadow-lg hover:bg-orange-500/5 active:bg-orange-500/10
        touch-manipulation min-h-[60px] sm:min-h-auto
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isDone}
            onChange={handleCheckboxChange}
            className="w-5 h-5 sm:w-4 sm:h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500 focus:ring-2 touch-manipulation"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`text-base sm:text-lg font-semibold mb-2 ${isDone ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {activity.activity_name}
              </h4>
              
              {activity.location?.address && (
                <p className="text-sm text-gray-600 mb-2">
                  📍 {activity.location.address}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 text-sm">
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
                <p className="text-sm text-gray-700 mb-3 italic">
                  💡 {activity.remarks}
                </p>
              )}

              {/* Location warning */}
              {showLocationWarning && (
                <div className="mb-3">
                  <LocationWarning
                    type="activity"
                    message="This activity cannot be displayed on the map due to missing or invalid location data."
                  />
                </div>
              )}
            </div>

            {activity.thumbnail_url && (
              <div className="ml-3 sm:ml-4 flex-shrink-0">
                <img 
                  src={activity.thumbnail_url} 
                  alt={activity.activity_name}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-3 border-t border-gray-100">
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-sky-500 hover:text-sky-600 active:text-sky-700 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-auto flex items-center justify-center sm:justify-start"
            >
              View Details →
            </a>
            
            <button
              onClick={handleNavigate}
              className="bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white px-3 py-2 sm:py-1 rounded text-sm transition-colors touch-manipulation min-h-[44px] sm:min-h-auto"
            >
              🧭 Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
