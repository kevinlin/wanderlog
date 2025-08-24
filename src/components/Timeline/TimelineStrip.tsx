import React from 'react';
import { TripStop } from '@/types';
import { getStopTimeStatus } from '@/utils/dateUtils';

interface TimelineStripProps {
  stops: TripStop[];
  currentStopId: string;
  onStopSelect: (stopId: string) => void;
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  stops,
  currentStopId,
  onStopSelect,
}) => {
  const totalDays = stops.reduce((total, stop) => total + stop.duration_days, 0);

  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {stops.map((stop) => {
          const isSelected = stop.stop_id === currentStopId;
          const status = getStopTimeStatus(stop);
          const widthPercentage = (stop.duration_days / totalDays) * 100;
          
          let statusColor = 'bg-alpine-teal text-white';
          if (status === 'past') {
            statusColor = 'bg-gray-400 text-white opacity-60';
          } else if (status === 'upcoming') {
            statusColor = 'bg-gray-300 text-gray-700 opacity-80';
          }

          return (
            <button
              key={stop.stop_id}
              onClick={() => onStopSelect(stop.stop_id)}
              className={`
                relative px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap
                transition-all duration-200 flex-shrink-0
                ${isSelected ? 'ring-2 ring-alpine-teal ring-offset-2' : ''}
                ${statusColor}
                hover:shadow-md
              `}
              style={{ minWidth: `${Math.max(widthPercentage * 4, 80)}px` }}
            >
              <div className="text-center">
                <div className="font-semibold">{stop.name}</div>
                <div className="text-xs opacity-90">
                  {stop.duration_days} day{stop.duration_days !== 1 ? 's' : ''}
                </div>
                <div className="text-xs opacity-75">
                  {new Date(stop.date.from).toLocaleDateString('en-NZ', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-alpine-teal"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
