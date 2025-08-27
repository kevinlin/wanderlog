import React, { useRef } from 'react';
import { TripBase } from '@/types';

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
  const timelineRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Colorful palette from Tailwind Colors - cycling through vibrant colors
  const colorPalette = [
    { base: 'bg-blue-500', text: 'text-white', selected: 'bg-blue-600', ring: 'ring-blue-500' },
    { base: 'bg-emerald-500', text: 'text-white', selected: 'bg-emerald-600', ring: 'ring-emerald-500' },
    { base: 'bg-violet-500', text: 'text-white', selected: 'bg-violet-600', ring: 'ring-violet-500' },
    { base: 'bg-orange-500', text: 'text-white', selected: 'bg-orange-600', ring: 'ring-orange-500' },
    { base: 'bg-rose-500', text: 'text-white', selected: 'bg-rose-600', ring: 'ring-rose-500' },
    { base: 'bg-cyan-500', text: 'text-white', selected: 'bg-cyan-600', ring: 'ring-cyan-500' },
    { base: 'bg-amber-500', text: 'text-white', selected: 'bg-amber-600', ring: 'ring-amber-500' },
    { base: 'bg-pink-500', text: 'text-white', selected: 'bg-pink-600', ring: 'ring-pink-500' },
    { base: 'bg-indigo-500', text: 'text-white', selected: 'bg-indigo-600', ring: 'ring-indigo-500' },
    { base: 'bg-teal-500', text: 'text-white', selected: 'bg-teal-600', ring: 'ring-teal-500' },
    { base: 'bg-lime-500', text: 'text-white', selected: 'bg-lime-600', ring: 'ring-lime-500' },
    { base: 'bg-fuchsia-500', text: 'text-white', selected: 'bg-fuchsia-600', ring: 'ring-fuchsia-500' }
  ];

  // Function to get color for a stop based on its index
  const getStopColor = (index: number) => {
    return colorPalette[index % colorPalette.length];
  };

  // Calculate proportional width based on stay period with minimum 0.5 days
  const getStopWidth = (stop: TripBase) => {
    const effectiveDays = Math.max(stop.duration_days, 0.5); // Minimum 0.5 days
    const totalEffectiveDays = stops.reduce((total, s) => total + Math.max(s.duration_days, 0.5), 0);
    const widthRatio = effectiveDays / totalEffectiveDays;
    
    // Use a base width that scales much better - aim for 120-300px range
    // Minimum width of 100px, with proportional scaling up to reasonable maximums
    const baseWidth = Math.max(widthRatio * 1200, 100); // Much better scaling
    const maxWidth = 300; // Cap maximum width for very long stays
    
    return Math.min(baseWidth, maxWidth);
  };

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
        p-1.5 sm:p-2 max-w-[calc(100vw-1rem)] sm:max-w-[calc(100vw-2rem)] md:max-w-2xl lg:max-w-6xl
        transition-all duration-300 ease-in-out
        touch-pan-x select-none
        ${className}
      `}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-hide">
        {stops.map((stop, index) => {
          const isSelected = stop.stop_id === currentStopId;
          const colors = getStopColor(index);
          const stopWidth = getStopWidth(stop);

          return (
            <button
              key={stop.stop_id}
              onClick={() => onStopSelect(stop.stop_id)}
              className={`
                relative rounded-lg text-xs font-medium whitespace-nowrap
                transition-all duration-300 ease-in-out flex-shrink-0
                min-h-[36px] sm:min-h-auto touch-manipulation
                ${isSelected 
                  ? `${colors.selected} ${colors.text} ring-2 ${colors.ring} ring-offset-2 ring-offset-white/20 scale-110 shadow-lg px-1.5 py-0.5 sm:px-2 sm:py-1` 
                  : `${colors.base} ${colors.text} px-2 py-1 sm:px-3 sm:py-1.5`
                }
                hover:shadow-lg hover:scale-105
                active:scale-95
              `}
              style={{ width: `${stopWidth}px` }}
            >
              {/* Duration badge at top-right */}
              <div className="absolute -top-1 -right-1 bg-white text-gray-800 text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-sm border border-gray-200">
                {stop.duration_days}
              </div>
              
              <div className="text-center">
                <div className={`font-semibold ${isSelected ? 'text-sm' : 'text-base'}`}>{stop.name}</div>
                <div className="text-xs">
                  {new Date(stop.date.from).toLocaleDateString('en-NZ', { 
                    month: 'short', 
                    day: 'numeric',
                    weekday: 'short'
                  })}
                </div>
              </div>
              
              {isSelected && (
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                  <div className={`w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent ${colors.ring.replace('ring-', 'border-t-')}`}></div>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
