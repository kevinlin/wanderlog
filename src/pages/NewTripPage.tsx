import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { differenceInCalendarDays } from 'date-fns';
import { useState } from 'react';
import { Link } from 'react-router';
import { ImportTripPanel } from '@/components/TripLibrary/ImportTripPanel';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCreateTrip } from '@/hooks/useTripLibraryMutations';

const nightsLabel = (start: string, end: string): string | null => {
  if (!(start && end) || end < start) {
    return null;
  }
  const nights = differenceInCalendarDays(new Date(end), new Date(start));
  if (nights === 0) {
    return 'Day trip';
  }
  return nights === 1 ? '1 night' : `${nights} nights`;
};

const inputClasses =
  'min-h-[44px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base placeholder:text-gray-500 focus:border-alpine-teal focus:outline-none focus:ring-2 focus:ring-alpine-teal/30';

export const NewTripPage = () => {
  const createMutation = useCreateTrip();
  const isOnline = useOnlineStatus();
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const nights = nightsLabel(startDate, endDate);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setValidationError('Please enter a trip name');
      return;
    }
    if (!(startDate && endDate)) {
      setValidationError('Pick a start and end date');
      return;
    }
    if (endDate < startDate) {
      setValidationError('End date must be on or after the start date');
      return;
    }
    setValidationError(null);
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      startDate,
      endDate,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    });
  };

  const error = validationError ?? createMutation.error?.message;

  return (
    <div className="min-h-screen bg-linear-to-br from-sandy-beige via-white to-lake-blue/30">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="threshold-enter" style={{ '--enter-index': 0 } as React.CSSProperties}>
          <Link
            className="inline-flex min-h-[44px] items-center gap-1.5 font-medium text-gray-700 text-sm transition-colors hover:text-gray-900"
            to="/trips"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to trips
          </Link>
          <h1 className="mt-2 font-bold text-3xl text-gray-900">Where to next?</h1>
          <p className="mt-2 text-gray-700 text-sm">Give it a name and some dates. You can shape the rest as you go.</p>
        </div>

        <form
          className="threshold-enter mt-6 flex flex-col gap-4 rounded-xl bg-white/80 p-6 shadow-2xl backdrop-blur sm:p-8"
          noValidate
          onSubmit={handleSubmit}
          style={{ '--enter-index': 1 } as React.CSSProperties}
        >
          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="new-trip-name">
              Trip name
            </label>
            <input
              autoFocus
              className={inputClasses}
              id="new-trip-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Japan in spring, lakes road trip…"
              required
              type="text"
              value={name}
            />
          </div>

          <div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="new-trip-start-date">
                  Start date
                </label>
                <input
                  className={inputClasses}
                  id="new-trip-start-date"
                  onChange={(event) => setStartDate(event.target.value)}
                  required
                  type="date"
                  value={startDate}
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="new-trip-end-date">
                  End date
                </label>
                <input
                  className={inputClasses}
                  id="new-trip-end-date"
                  min={startDate || undefined}
                  onChange={(event) => setEndDate(event.target.value)}
                  required
                  type="date"
                  value={endDate}
                />
              </div>
            </div>
            {/* Fixed-height row so the badge popping in never shifts the form. */}
            <div className="mt-1 flex h-5 justify-end">
              {nights && (
                <span
                  className="inline-flex animate-check-pop items-center rounded-full bg-white px-2.5 font-medium text-gray-700 text-xs shadow-xs ring-1 ring-gray-200"
                  key={nights}
                >
                  {nights}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="new-trip-description">
              Description <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <textarea
              className={inputClasses}
              id="new-trip-description"
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              value={description}
            />
          </div>

          {!isOnline && <p className="rounded-md bg-amber-50 p-3 text-amber-800 text-sm">You're offline. Connect to create a trip.</p>}
          {error && (
            <p className="text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            className="flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2 rounded-lg bg-alpine-teal px-4 py-2 font-medium text-white transition-colors hover:bg-alpine-teal/90 active:bg-alpine-teal/80 disabled:opacity-50"
            disabled={createMutation.isPending || !isOnline}
            type="submit"
          >
            {createMutation.isPending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
            {createMutation.isPending ? 'Creating trip…' : 'Create trip'}
          </button>
        </form>

        <div className="threshold-enter mt-8" style={{ '--enter-index': 2 } as React.CSSProperties}>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-300" />
            <span className="text-gray-600 text-sm">Already have a plan?</span>
            <div className="h-px flex-1 bg-gray-300" />
          </div>
          <ImportTripPanel />
        </div>
      </main>
    </div>
  );
};
