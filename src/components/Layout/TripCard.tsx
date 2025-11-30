import { format } from 'date-fns';
import type React from 'react';
import type { TripSummary } from '@/contexts/AppStateContext';

interface TripCardProps {
  trip: TripSummary;
  isSelected: boolean;
  onSelect: (tripId: string) => void;
}

/**
 * Card component to display trip information in the trip selector
 */
export const TripCard: React.FC<TripCardProps> = ({ trip, isSelected, onSelect }) => {
  const handleClick = () => {
    onSelect(trip.trip_id);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return null;
    }
  };

  return (
    <button
      className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
        isSelected
          ? 'border-alpine-teal-500 bg-alpine-teal-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-alpine-teal-300 hover:shadow-sm'
      }
      `}
      onClick={handleClick}
    >
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-gray-900 text-lg">{trip.trip_name}</h3>
          {isSelected && (
            <span className="flex-shrink-0 rounded bg-alpine-teal-100 px-2 py-1 font-medium text-alpine-teal-700 text-xs">Current</span>
          )}
        </div>

        <div className="flex flex-col gap-1 text-gray-600 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium">Timezone:</span>
            <span>{trip.timezone}</span>
          </div>

          {trip.created_at && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Created:</span>
              <span>{formatDate(trip.created_at)}</span>
            </div>
          )}

          {trip.updated_at && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Updated:</span>
              <span>{formatDate(trip.updated_at)}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};
