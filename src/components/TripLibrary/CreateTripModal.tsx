import { XMarkIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { useCreateTrip } from '@/hooks/useTripLibraryMutations';

interface CreateTripModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateTripModal = ({ isOpen, onClose }: CreateTripModalProps) => {
  const { mutate, isPending, error } = useCreateTrip();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const handleBackdropClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (!(startDate && endDate)) {
      setValidationError('Start and end dates are required');
      return;
    }
    if (endDate < startDate) {
      setValidationError('End date must be after start date');
      return;
    }
    setValidationError(null);
    mutate({
      name: name.trim(),
      destination: destination.trim() || undefined,
      startDate,
      endDate,
      timezone,
    });
  };

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-alpine-teal focus:outline-hidden focus:ring-2 focus:ring-alpine-teal/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleBackdropClick}>
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-gray-200 border-b px-6 py-4">
          <h2 className="font-bold text-gray-900 text-xl">New trip</h2>
          <button
            aria-label="Close"
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            onClick={onClose}
            type="button"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form className="flex flex-col gap-4 p-6" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-name">
              Trip name
            </label>
            <input
              className={inputClass}
              id="trip-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Japan Spring 2027"
              type="text"
              value={name}
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-destination">
              Destination (optional)
            </label>
            <input
              className={inputClass}
              id="trip-destination"
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Japan"
              type="text"
              value={destination}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-start-date">
                Start date
              </label>
              <input
                className={inputClass}
                id="trip-start-date"
                onChange={(event) => setStartDate(event.target.value)}
                type="date"
                value={startDate}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="trip-end-date">
                End date
              </label>
              <input
                className={inputClass}
                id="trip-end-date"
                onChange={(event) => setEndDate(event.target.value)}
                type="date"
                value={endDate}
              />
            </div>
          </div>

          <p className="text-gray-500 text-xs">Timezone: {timezone}</p>

          {(validationError || error) && <p className="text-red-600 text-sm">{validationError ?? error?.message}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 transition-colors hover:bg-gray-50"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 disabled:opacity-50"
              disabled={isPending}
              type="submit"
            >
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
