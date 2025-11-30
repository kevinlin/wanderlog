import React, { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { TripCard } from './TripCard';
import { useTrips } from '@/hooks/useTrips';
import { LoadingSpinner } from './LoadingSpinner';

interface TripSelectorModalProps {
  isOpen: boolean;
  currentTripId: string | null;
  onClose: () => void;
  onSelectTrip: (tripId: string) => void;
}

/**
 * Modal component for selecting a trip from available trips
 */
export const TripSelectorModal: React.FC<TripSelectorModalProps> = ({
  isOpen,
  currentTripId,
  onClose,
  onSelectTrip,
}) => {
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
      <div className="relative w-full max-w-2xl max-h-[80vh] mx-4 bg-white rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Select a Trip</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close modal"
          >
            <XMarkIcon className="w-6 h-6" />
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
                <p className="text-red-600 font-medium">Failed to load trips</p>
                <p className="text-sm text-gray-500 mt-1">{error}</p>
              </div>
            </div>
          ) : trips.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <p className="text-gray-600 font-medium">No trips found</p>
                <p className="text-sm text-gray-500 mt-1">
                  Create your first trip by running the migration script
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {trips.map((trip) => (
                <TripCard
                  key={trip.trip_id}
                  trip={trip}
                  isSelected={selectedTripId === trip.trip_id}
                  onSelect={handleSelectTrip}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedTripId || selectedTripId === currentTripId}
            className={`
              px-4 py-2 rounded-lg font-medium transition-colors
              ${
                !selectedTripId || selectedTripId === currentTripId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-alpine-teal-600 text-white hover:bg-alpine-teal-700'
              }
            `}
          >
            Switch Trip
          </button>
        </div>
      </div>
    </div>
  );
};
