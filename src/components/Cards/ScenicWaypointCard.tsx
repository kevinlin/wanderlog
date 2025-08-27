import React from 'react';
import { ScenicWaypoint, Accommodation } from '@/types';
import { generateGoogleMapsUrl } from '@/utils/tripUtils';
import { activityHasLocationIssues } from '@/utils/validationUtils';
import { LocationWarning } from '@/components/Layout/LocationWarning';

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
    <div
      onClick={() => onSelect(waypoint.activity_id)}
      className={`
        bg-gradient-to-r from-violet-50 to-sky-50 border border-violet-200/50 rounded-lg shadow-md p-3 sm:p-4 mb-3 cursor-pointer transition-all duration-200
        ${isSelected ? 'ring-2 ring-violet-500 ring-offset-2 bg-violet-500/10' : ''}
        ${isDone ? 'opacity-75 bg-emerald-500/10' : ''}
        hover:shadow-lg hover:bg-violet-500/5 active:bg-violet-500/10
        touch-manipulation min-h-[60px] sm:min-h-auto
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 pt-1">
          <input
            type="checkbox"
            checked={isDone}
            onChange={handleCheckboxChange}
            className="w-5 h-5 sm:w-4 sm:h-4 text-violet-500 border-gray-300 rounded focus:ring-violet-500 focus:ring-2 touch-manipulation"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-2">
                <span className="text-violet-500 mr-2">🏞️</span>
                <h4 className={`text-base sm:text-lg font-semibold ${isDone ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                  {waypoint.activity_name}
                </h4>
              </div>
              
              {waypoint.location?.address && (
                <p className="text-sm text-gray-600 mb-2">
                  📍 {waypoint.location.address}
                </p>
              )}

              {waypoint.duration && (
                <div className="mb-3 text-sm">
                  <span className="text-gray-500 font-medium">Duration:</span>
                  <span className="text-gray-900 ml-1">{waypoint.duration}</span>
                </div>
              )}

              {waypoint.remarks && (
                <p className="text-sm text-gray-700 mb-3 italic">
                  💡 {waypoint.remarks}
                </p>
              )}

              {/* Location warning */}
              {showLocationWarning && (
                <div className="mb-3">
                  <LocationWarning
                    type="activity"
                    message="This scenic waypoint cannot be displayed on the map due to missing or invalid location data."
                  />
                </div>
              )}
            </div>

            {waypoint.thumbnail_url && (
              <div className="ml-3 sm:ml-4 flex-shrink-0">
                <img 
                  src={waypoint.thumbnail_url} 
                  alt={waypoint.activity_name}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-0 pt-3 border-t border-violet-100">
            {waypoint.url && (
              <a
                href={waypoint.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-violet-500 hover:text-violet-600 active:text-violet-700 text-sm font-medium touch-manipulation min-h-[44px] sm:min-h-auto flex items-center justify-center sm:justify-start"
              >
                View Details →
              </a>
            )}
            
            <button
              onClick={handleNavigate}
              className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-white px-3 py-2 sm:py-1 rounded text-sm transition-colors touch-manipulation min-h-[44px] sm:min-h-auto"
            >
              🧭 Navigate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
