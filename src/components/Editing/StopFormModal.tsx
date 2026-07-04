import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { PlacesService } from '@/services/placesService';
import type { StopInput } from '@/services/supabaseService';
import type { Coordinates } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import type { TripBase } from '@/types/trip';

const MAX_PLACE_RESULTS = 5;

interface StopFormModalProps {
  error?: string | null;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (input: StopInput) => void;
  searchLocation: Coordinates;
  stop?: TripBase;
}

// `stop` absent means create mode; present means edit mode (pre-filled).
// Submission is delegated to the StopsEditor, which owns the mutations and
// the date-cascade preview.
export const StopFormModal = ({ stop, onClose, onSubmit, isPending, error, searchLocation }: StopFormModalProps) => {
  const [name, setName] = useState(stop?.name ?? '');
  const [address, setAddress] = useState('');
  const [dateFrom, setDateFrom] = useState(stop?.date.from ?? '');
  const [dateTo, setDateTo] = useState(stop?.date.to ?? '');
  const [lat, setLat] = useState<number | undefined>(stop?.location.lat);
  const [lng, setLng] = useState<number | undefined>(stop?.location.lng);

  const [placeResults, setPlaceResults] = useState<POIDetails[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleFindPlace = async () => {
    const query = address.trim() || name.trim();
    if (!query) {
      return;
    }
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await PlacesService.getInstance().textSearchWithLocationBias(query, searchLocation);
      setPlaceResults(results.slice(0, MAX_PLACE_RESULTS));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Place search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickPlace = (poi: POIDetails) => {
    setAddress(poi.formatted_address ?? '');
    setLat(poi.location.lat);
    setLng(poi.location.lng);
    setPlaceResults(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }
    if (!(dateFrom && dateTo)) {
      setValidationError('Both dates are required');
      return;
    }
    if (dateTo < dateFrom) {
      setValidationError('End date must be on or after the start date');
      return;
    }
    if (lat === undefined || lng === undefined) {
      setValidationError('Pick a location with "Find place" so the stop can appear on the map');
      return;
    }
    setValidationError(null);
    onSubmit({ name: name.trim(), lat, lng, dateFrom, dateTo });
  };

  return (
    <ItemModalShell
      error={validationError ?? error}
      isOpen
      isPending={isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={stop ? 'Edit stop' : 'Add stop'}
    >
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="stop-name">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="stop-name"
          onChange={(e) => setName(e.target.value)}
          required
          type="text"
          value={name}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="stop-address">
          Location
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="stop-address"
            onChange={(e) => setAddress(e.target.value)}
            placeholder={lat !== undefined && lng !== undefined ? `Current: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Search for a place…'}
            type="text"
            value={address}
          />
          <button
            className="flex shrink-0 items-center gap-1 rounded-lg border border-alpine-teal/40 bg-alpine-teal/10 px-3 py-2 font-medium text-alpine-teal text-sm transition-colors hover:bg-alpine-teal/20 disabled:opacity-50"
            disabled={isSearching || !(address.trim() || name.trim())}
            onClick={handleFindPlace}
            type="button"
          >
            {isSearching ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-alpine-teal border-t-transparent" />
            ) : (
              <MagnifyingGlassIcon className="h-4 w-4" />
            )}
            Find place
          </button>
        </div>
        {searchError && <p className="mt-1 text-red-600 text-xs">{searchError}</p>}
        {placeResults && (
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
            {placeResults.length === 0 && <li className="px-3 py-2 text-gray-500 text-sm">No places found.</li>}
            {placeResults.map((poi) => (
              <li key={poi.place_id}>
                <button
                  className="w-full px-3 py-2 text-left text-sm transition-colors hover:bg-alpine-teal/10"
                  onClick={() => handlePickPlace(poi)}
                  type="button"
                >
                  <span className="font-medium text-gray-900">{poi.name}</span>
                  {poi.formatted_address && <span className="block text-gray-500 text-xs">{poi.formatted_address}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="stop-date-from">
            From
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="stop-date-from"
            onChange={(e) => setDateFrom(e.target.value)}
            type="date"
            value={dateFrom}
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="stop-date-to">
            To
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="stop-date-to"
            onChange={(e) => setDateTo(e.target.value)}
            type="date"
            value={dateTo}
          />
        </div>
      </div>

      <p className="text-gray-500 text-xs">Date changes cascade to the stops that follow when you save the stop list.</p>
    </ItemModalShell>
  );
};
