import { useState } from 'react';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { useUpdateTripMetadata } from '@/hooks/useTripLibraryMutations';
import type { TripSummary } from '@/types/trip';

interface TripMetadataFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripSummary;
}

export const TripMetadataFormModal = ({ trip, isOpen, onClose }: TripMetadataFormModalProps) => {
  const updateMutation = useUpdateTripMetadata();

  const [name, setName] = useState(trip.trip_name);
  const [description, setDescription] = useState(trip.description ?? '');
  const [startDate, setStartDate] = useState(trip.start_date);
  const [endDate, setEndDate] = useState(trip.end_date);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setValidationError('End date must be on or after the start date');
      return;
    }
    setValidationError(null);
    updateMutation.mutate(
      {
        tripId: trip.trip_id,
        patch: {
          name: name.trim(),
          // null clears the description; undefined would leave it untouched
          description: description.trim() || null,
          startDate,
          endDate,
        },
      },
      { onSuccess: onClose }
    );
  };

  return (
    <ItemModalShell
      error={validationError ?? updateMutation.error?.message}
      isOpen={isOpen}
      isPending={updateMutation.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      title="Edit trip"
    >
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-name">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="trip-name"
          onChange={(e) => setName(e.target.value)}
          required
          type="text"
          value={name}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-description">
          Description
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="trip-description"
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          value={description}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-start-date">
            Start date
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="trip-start-date"
            onChange={(e) => setStartDate(e.target.value)}
            type="date"
            value={startDate}
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-end-date">
            End date
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="trip-end-date"
            onChange={(e) => setEndDate(e.target.value)}
            type="date"
            value={endDate}
          />
        </div>
      </div>
    </ItemModalShell>
  );
};
