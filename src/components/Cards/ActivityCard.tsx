import React from 'react';
import { Activity, Accommodation } from '@/types';
import { generateGoogleMapsUrl } from '@/utils/tripUtils';

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
        bg-white rounded-lg shadow-md p-4 mb-3 cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-alpine-teal ring-offset-2' : ''}
        ${isDone ? 'opacity-75 bg-gray-50' : ''}
        hover:shadow-lg
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isDone}
            onChange={handleCheckboxChange}
            className="w-5 h-5 text-alpine-teal border-gray-300 rounded focus:ring-alpine-teal focus:ring-2"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className={`text-lg font-semibold mb-2 ${isDone ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {activity.activity_name}
              </h4>
              
              {activity.location?.address && (
                <p className="text-sm text-gray-600 mb-2">
                  📍 {activity.location.address}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
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
            </div>

            {activity.thumbnail_url && (
              <div className="ml-4 flex-shrink-0">
                <img 
                  src={activity.thumbnail_url} 
                  alt={activity.activity_name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-alpine-teal hover:text-opacity-80 text-sm font-medium"
            >
              View Details →
            </a>
            
            <button
              onClick={handleNavigate}
              className="bg-alpine-teal hover:bg-opacity-90 text-white px-3 py-1 rounded text-sm transition-colors"
            >
              🧭 Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
