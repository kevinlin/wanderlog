import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TripBase } from '@/types';
import { getCurrentStop } from '@/utils/dateUtils';

interface StopProgress {
  done: number;
  total: number;
}

interface TimelineStripProps {
  className?: string;
  currentStopId: string | null;
  onStopSelect: (stopId: string) => void;
  stopProgress?: Record<string, StopProgress>;
  stops: TripBase[];
}

export const TimelineStrip: React.FC<TimelineStripProps> = ({ stops, currentStopId, onStopSelect, stopProgress, className = '' }) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number>(0);
  const touchEndX = useRef<number>(0);

  // Expand/collapse state with localStorage persistence
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    const stored = localStorage.getItem('wanderlog_timeline_expanded');
    return stored === null ? true : JSON.parse(stored); // Default to expanded
  });

  // Persist expand/collapse state
  useEffect(() => {
    localStorage.setItem('wanderlog_timeline_expanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  // Toggle handler
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Determine current stop
  const currentStop = useMemo(
    () => stops.find((stop) => stop.stop_id === currentStopId) || getCurrentStop(stops) || stops[0],
    [stops, currentStopId]
  );

  // Get stop initials for mobile collapsed view
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2); // Max 2 letters
  };

  // Colorful palette from Tailwind Colors - cycling through vibrant colors
  const colorPalette = [
    { base: 'bg-blue-700', text: 'text-white', selected: 'bg-blue-800', ring: 'ring-blue-500' },
    { base: 'bg-emerald-700', text: 'text-white', selected: 'bg-emerald-800', ring: 'ring-emerald-500' },
    { base: 'bg-violet-700', text: 'text-white', selected: 'bg-violet-800', ring: 'ring-violet-500' },
    { base: 'bg-orange-700', text: 'text-white', selected: 'bg-orange-800', ring: 'ring-orange-500' },
    { base: 'bg-rose-700', text: 'text-white', selected: 'bg-rose-800', ring: 'ring-rose-500' },
    { base: 'bg-cyan-700', text: 'text-white', selected: 'bg-cyan-800', ring: 'ring-cyan-500' },
    { base: 'bg-amber-700', text: 'text-white', selected: 'bg-amber-800', ring: 'ring-amber-500' },
    { base: 'bg-pink-700', text: 'text-white', selected: 'bg-pink-800', ring: 'ring-pink-500' },
    { base: 'bg-indigo-700', text: 'text-white', selected: 'bg-indigo-800', ring: 'ring-indigo-500' },
    { base: 'bg-teal-700', text: 'text-white', selected: 'bg-teal-800', ring: 'ring-teal-500' },
    { base: 'bg-lime-700', text: 'text-white', selected: 'bg-lime-800', ring: 'ring-lime-500' },
    { base: 'bg-fuchsia-700', text: 'text-white', selected: 'bg-fuchsia-800', ring: 'ring-fuchsia-500' },
  ];

  // Function to get color for a stop based on its index
  const getStopColor = (index: number) => colorPalette[index % colorPalette.length];

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
    if (!(touchStartX.current && touchEndX.current)) return;

    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50; // Minimum distance for a swipe

    if (Math.abs(swipeDistance) < minSwipeDistance) return;

    const currentIndex = stops.findIndex((stop) => stop.stop_id === currentStopId);
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

  // Render individual stop button
  const renderStopButton = (stop: TripBase, index: number) => {
    const isSelected = stop.stop_id === currentStopId;
    const colors = getStopColor(index);
    const stopWidth = getStopWidth(stop);

    // "Watching the timeline fill in": each stop shows how much of it is done.
    const progress = stopProgress?.[stop.stop_id];
    const total = progress?.total ?? 0;
    const done = progress?.done ?? 0;
    const donePct = total > 0 ? Math.round((done / total) * 100) : 0;
    const isComplete = total > 0 && done === total;

    const stopLabel = `${stop.name}${total > 0 ? `, ${done} of ${total} done` : ''}`;

    return (
      <button
        aria-current={isSelected ? 'true' : undefined}
        aria-label={stopLabel}
        className={`relative min-h-[36px] shrink-0 touch-manipulation whitespace-nowrap rounded-lg font-medium text-xs transition-all duration-300 ease-in-out sm:min-h-auto ${
          isSelected
            ? `${colors.selected} ${colors.text} ring-2 ${colors.ring} px-2.5 py-1.5 shadow-lg ring-offset-2 ring-offset-white/20 sm:px-4 sm:py-2`
            : `${colors.base} ${colors.text} px-2 py-1 sm:px-3 sm:py-1.5`
        } hover:scale-105 hover:shadow-lg active:scale-95`}
        key={stop.stop_id}
        onClick={() => onStopSelect(stop.stop_id)}
        // The selection carries a view-transition-name so it morphs across the strip on stop change
        style={{ width: `${stopWidth}px`, viewTransitionName: isSelected ? 'timeline-selected' : undefined }}
        type="button"
      >
        {/* Duration badge at top-right */}
        <div
          aria-label={`${stop.duration_days} nights`}
          className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-gray-200 bg-white px-1.5 font-bold text-gray-800 text-xs shadow-xs"
        >
          {stop.duration_days}
        </div>

        {/* Completion seal at top-left — the non-color cue that this stop is fully done */}
        {isComplete && (
          <div className="absolute -top-1 -left-1 flex h-5 w-5 items-center justify-center rounded-full border border-emerald-200 bg-white text-emerald-600 shadow-xs">
            <svg aria-hidden="true" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}

        <div className="text-center">
          <div className={`font-semibold text-sm ${isSelected ? 'sm:text-base' : ''}`}>{stop.name}</div>
          <div className="text-xs">
            {new Date(stop.date.from).toLocaleDateString('en-NZ', {
              month: 'short',
              day: 'numeric',
              weekday: 'short',
            })}
          </div>
        </div>

        {/* Progress fill: the stop visibly "fills in" as activities get checked off */}
        {total > 0 && (
          <div className="absolute right-2 bottom-1 left-2 h-1 overflow-hidden rounded-full bg-black/20">
            <div className="h-full rounded-full bg-white/85 transition-[width] duration-500 ease-out" style={{ width: `${donePct}%` }} />
          </div>
        )}

        {isSelected && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 transform">
            <div
              className={`timeline-pointer-enter h-0 w-0 border-t-4 border-r-4 border-r-transparent border-l-4 border-l-transparent ${colors.ring.replace('ring-', 'border-t-')}`}
            />
          </div>
        )}
      </button>
    );
  };

  // Get current stop index and color for collapsed state
  const currentStopIndex = stops.findIndex((stop) => stop.stop_id === currentStop?.stop_id);
  const currentStopColor = currentStopIndex === -1 ? getStopColor(0) : getStopColor(currentStopIndex);

  return (
    <div
      className={`absolute top-0 left-0 z-20 touch-pan-x select-none overflow-hidden bg-white/30 p-1.5 shadow-md backdrop-blur-sm transition-all duration-300 ease-in-out sm:top-4 sm:left-2 sm:rounded-xl sm:border sm:p-2 ${
        isExpanded
          ? 'right-0 w-full rounded-none border-white/20 border-b sm:right-auto sm:w-auto sm:max-w-[calc(100vw-2rem)]'
          : 'w-auto rounded-xl border border-white/20 sm:max-w-[calc(100vw-26rem)]'
      } ${className}`}
      onTouchEnd={isExpanded ? handleTouchEnd : undefined}
      onTouchMove={isExpanded ? handleTouchMove : undefined}
      onTouchStart={isExpanded ? handleTouchStart : undefined}
      ref={timelineRef}
      // Named so the strip keeps occluding the panel snapshot during the stop page-turn
      style={{ viewTransitionName: 'timeline-strip' }}
    >
      {/* Collapsed State */}
      {!isExpanded && currentStop && (
        <div className="flex items-center p-1">
          {/* Mobile: Initials button */}
          <div className="sm:hidden">
            <button
              className={`flex h-12 w-12 items-center justify-center rounded-full ${currentStopColor.base} ${currentStopColor.text} font-bold text-sm shadow-md transition-all duration-300 hover:scale-105 active:scale-95`}
              onClick={() => onStopSelect(currentStop.stop_id)}
              type="button"
            >
              {getInitials(currentStop.name)}
            </button>
          </div>

          {/* Desktop: Full stop button */}
          <div className="hidden p-1 sm:block">{renderStopButton(currentStop, currentStopIndex)}</div>

          {/* Chevron expand button */}
          <button
            aria-label="Expand timeline"
            className="shrink-0 rounded-lg p-2 text-gray-700 transition-all duration-200 hover:bg-white/30 active:scale-95"
            onClick={toggleExpanded}
            type="button"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Expanded State */}
      {isExpanded && (
        <div className="flex items-center gap-2">
          {/* All stops */}
          <div className="scrollbar-hide flex-1 overflow-x-auto overflow-y-hidden p-1">
            <div className="flex items-center gap-2">{stops.map((stop, index) => renderStopButton(stop, index))}</div>
          </div>

          {/* Chevron collapse button */}
          <button
            aria-label="Collapse timeline"
            className="shrink-0 rounded-lg p-2 text-gray-700 transition-all duration-200 hover:bg-white/30 active:scale-95"
            onClick={toggleExpanded}
            type="button"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
};
