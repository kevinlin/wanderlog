import { PencilIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import type { TripSummary } from '@/types/trip';
import type { TripStatus } from '@/utils/tripStatusUtils';

interface TripLibraryCardProps {
  isHero: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onOpen: () => void;
  status: TripStatus;
  trip: TripSummary;
}

const STATUS_BADGE_CLASSES: Record<TripStatus, string> = {
  active: 'bg-fern-green',
  upcoming: 'bg-lake-blue',
  past: 'bg-gray-400',
};

const formatDateRange = (startDate: string, endDate: string): string => {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, 'd MMM yyyy')} - ${format(end, 'd MMM yyyy')}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
  }
  return `${format(start, 'd')} - ${format(end, 'd MMM yyyy')}`;
};

export const TripLibraryCard = ({ trip, status, isHero, onOpen, onDelete, onEdit }: TripLibraryCardProps) => (
  <div
    className="group relative rounded-xl border border-gray-200 bg-white shadow-xs transition-all hover:border-alpine-teal hover:shadow-md"
    data-testid={isHero ? 'hero-trip' : undefined}
  >
    <button className={`w-full cursor-pointer text-left ${isHero ? 'p-6 sm:p-8' : 'p-4 sm:p-5'}`} onClick={onOpen} type="button">
      <div className="flex items-start justify-between gap-3">
        <h3 className={`font-bold text-gray-900 ${isHero ? 'text-2xl sm:text-3xl' : 'text-lg'}`}>{trip.trip_name}</h3>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 font-medium text-white text-xs capitalize ${STATUS_BADGE_CLASSES[status]}`}>
          {status}
        </span>
      </div>
      <div className={`mt-2 flex flex-col gap-1 text-gray-600 ${isHero ? 'text-base' : 'text-sm'}`}>
        {trip.destination && <span>{trip.destination}</span>}
        <span>{formatDateRange(trip.start_date, trip.end_date)}</span>
      </div>
    </button>
    {onEdit && (
      <button
        aria-label={`Edit ${trip.trip_name}`}
        className="absolute right-12 bottom-3 rounded-lg p-2 text-gray-400 opacity-0 transition-opacity hover:bg-alpine-teal/10 hover:text-alpine-teal focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onEdit();
        }}
        type="button"
      >
        <PencilIcon className="h-4 w-4" />
      </button>
    )}
    <button
      aria-label={`Delete ${trip.trip_name}`}
      className="absolute right-3 bottom-3 rounded-lg p-2 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={(event) => {
        event.stopPropagation();
        onDelete();
      }}
      type="button"
    >
      <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path
          d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  </div>
);
