import { XMarkIcon } from '@heroicons/react/24/outline';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useTrips } from '@/hooks/useTrips';
import { LoadingSpinner } from './LoadingSpinner';
import { TripCard } from './TripCard';

interface TripSelectorModalProps {
  isOpen: boolean;
  currentTripId: string | null;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
}

/**
 * Modal component for selecting a trip from available trips
 */
export const TripSelectorModal: React.FC<TripSelectorModalProps> = ({ isOpen, currentTripId, onClose, onSelectTrip }) => {
  const { trips, isLoading, error } = useTrips();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(currentTripId);

  useEffect(() => {
    setSelectedTripId(currentTripId);
  }, [currentTripId]);

  const handleSelectTrip = (tripId: string) => {
    setSelectedTripId(tripId);
  };

  const handleConfirm = () => {
    if (selectedTripId && selectedTripId !== currentTripId) {
      onSelectTrip(selectedTripId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative mx-4 flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-gray-200 border-b p-6">
          <h2 className="font-bold text-2xl text-gray-900">Select a Trip</h2>
          <button
            aria-label="Close modal"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="font-medium text-red-600">Failed to load trips</p>
                <p className="mt-1 text-gray-500 text-sm">{error}</p>
              </div>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="font-medium text-gray-600">No trips found</p>
                <p className="mt-1 text-gray-500 text-sm">Create your first trip by running the migration script</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <TripCard isSelected={selectedTripId === trip.trip_id} key={trip.trip_id} onSelect={handleSelectTrip} trip={trip} />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-gray-200 border-t p-6">
          <button
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className={`rounded-lg px-4 py-2 font-medium transition-colors ${
              !selectedTripId || selectedTripId === currentTripId
                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                : 'bg-alpine-teal-600 text-white hover:bg-alpine-teal-700'
            }
            `}
            disabled={!selectedTripId || selectedTripId === currentTripId}
            onClick={handleConfirm}
          >
            Switch Trip
          </button>
        </div>
      </div>
    </div>
  );
};
