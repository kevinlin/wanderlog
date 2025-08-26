import React, { useRef } from 'react';
import { TripBase } from '@/types';
import { getStopTimeStatus } from '@/utils/dateUtils';

interface TimelineStripProps {
  stops: TripBase[];
  currentStopId: string | null;
  onStopSelect: (stopId: string) => void;
  className?: string;
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({
  stops,
  currentStopId,
  onStopSelect,
  className = '',
}) => {
  const totalDays = stops.reduce((total, stop) => total + stop.duration_days, 0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Handle swipe gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum distance for a swipe
    
    if (Math.abs(swipeDistance) < minSwipeDistance) return;
    
    const currentIndex = stops.findIndex(stop => stop.stop_id === currentStopId);
    if (currentIndex === -1) return;
    
    // Swipe left (next stop)
    if (swipeDistance > 0 && currentIndex < stops.length - 1) {
      onStopSelect(stops[currentIndex + 1].stop_id);
    }
    // Swipe right (previous stop)
    else if (swipeDistance < 0 && currentIndex > 0) {
      onStopSelect(stops[currentIndex - 1].stop_id);
    }
    
    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  return (
    <div 
      ref={timelineRef}
      className={`
        absolute top-2 left-2 sm:top-4 sm:left-4 
        rounded-xl bg-white/30 backdrop-blur border border-white/20 shadow-md
        p-2 sm:p-3 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-2xl lg:max-w-6xl
        transition-all duration-300 ease-in-out
        touch-pan-x select-none
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide">
        {stops  .map((stop) => {
          const isSelected = stop.stop_id === currentStopId;
          const status = getStopTimeStatus(stop);
          const widthPercentage = (stop.duration_days / totalDays) * 100;
          
          // Apply new color palette: Sky-500 for current, with opacity variations for status
          let statusColor = 'bg-sky-500 text-white';
          if (status === 'past') {
            statusColor = 'bg-sky-500/30 text-sky-900';
          } else if (status === 'upcoming') {
            statusColor = 'bg-sky-500/70 text-white';
          }

          return (
            <button
              key={stop.stop_id}
              onClick={() => onStopSelect(stop.stop_id)}
              className={`
                relative px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-medium whitespace-nowrap
                transition-all duration-300 ease-in-out flex-shrink-0
                min-h-[44px] sm:min-h-auto touch-manipulation
                ${isSelected ? 'ring-2 ring-sky-500 ring-offset-2 ring-offset-white/20' : ''}
                ${statusColor}
                hover:shadow-lg hover:scale-105 hover:bg-orange-500/90
                active:scale-95 active:bg-orange-500
              `}
              style={{ minWidth: `${Math.max(widthPercentage * 4, 60)}px` }}
            >
              <div className="text-center">
                <div className="text-lg font-semibold">{stop.name}</div>
                <div className="text-xs">
                  {new Date(stop.date.from).toLocaleDateString('en-NZ', { 
                    month: 'short', 
                    day: 'numeric',
                    weekday: 'short'
                  })}
                </div>
                <div className="text-xs">
                  {stop.duration_days} day{stop.duration_days !== 1 ? 's' : ''}
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-sky-500"></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
