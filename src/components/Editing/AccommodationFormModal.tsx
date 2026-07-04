import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { useUpsertAccommodation } from '@/hooks/useTripMutations';
import { PlacesService } from '@/services/placesService';
import type { AccommodationInput } from '@/services/supabaseService';
import type { Coordinates } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import type { Accommodation } from '@/types/trip';

const MAX_PLACE_RESULTS = 5;

// Storage format is local-to-trip text ('YYYY-MM-DD HH:mm') by design;
// datetime-local inputs use 'YYYY-MM-DDTHH:mm'.
const toDatetimeLocal = (value: string | undefined): string => (value ? value.replace(' ', 'T') : '');
const fromDatetimeLocal = (value: string): string | undefined => (value ? value.replace('T', ' ') : undefined);

interface AccommodationFormModalProps {
  accommodation?: Accommodation;
  isOpen: boolean;
  onClose: () => void;
  searchLocation: Coordinates;
  stopId: string;
  tripId: string;
}

// `accommodation` absent means the stop has none yet (create mode).
export const AccommodationFormModal = ({ accommodation, isOpen, onClose, searchLocation, stopId, tripId }: AccommodationFormModalProps) => {
  const upsertMutation = useUpsertAccommodation(tripId);

  const [name, setName] = useState(accommodation?.name ?? '');
  const [address, setAddress] = useState(accommodation?.address ?? '');
  const [checkIn, setCheckIn] = useState(toDatetimeLocal(accommodation?.check_in));
  const [checkOut, setCheckOut] = useState(toDatetimeLocal(accommodation?.check_out));
  const [confirmation, setConfirmation] = useState(accommodation?.confirmation ?? '');
  const [url, setUrl] = useState(accommodation?.url ?? '');
  const [remarks, setRemarks] = useState(accommodation?.remarks ?? '');
  const [lat, setLat] = useState<number | undefined>(accommodation?.location?.lat);
  const [lng, setLng] = useState<number | undefined>(accommodation?.location?.lng);
  const [googlePlaceId, setGooglePlaceId] = useState<string | undefined>(accommodation?.google_place_id);

  const [placeResults, setPlaceResults] = useState<POIDetails[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

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
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : 'Place search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handlePickPlace = (poi: POIDetails) => {
    setAddress(poi.formatted_address ?? '');
    setLat(poi.location.lat);
    setLng(poi.location.lng);
    setGooglePlaceId(poi.place_id);
    setPlaceResults(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }
    const input: AccommodationInput = {
      name: name.trim(),
      address: address.trim() || undefined,
      checkIn: fromDatetimeLocal(checkIn),
      checkOut: fromDatetimeLocal(checkOut),
      confirmation: confirmation.trim() || undefined,
      url: url.trim() || undefined,
      remarks: remarks.trim() || undefined,
      lat,
      lng,
      googlePlaceId,
    };
    upsertMutation.mutate({ stopId, input }, { onSuccess: onClose });
  };

  return (
    <ItemModalShell
      error={upsertMutation.error?.message}
      isOpen={isOpen}
      isPending={upsertMutation.isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={accommodation ? 'Edit accommodation' : 'Add accommodation'}
    >
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-name">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="accommodation-name"
          onChange={(e) => setName(e.target.value)}
          required
          type="text"
          value={name}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-address">
          Address
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="accommodation-address"
            onChange={(e) => setAddress(e.target.value)}
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
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-check-in">
            Check-in
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="accommodation-check-in"
            onChange={(e) => setCheckIn(e.target.value)}
            type="datetime-local"
            value={checkIn}
          />
        </div>
        <div>
          <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-check-out">
            Check-out
          </label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="accommodation-check-out"
            onChange={(e) => setCheckOut(e.target.value)}
            type="datetime-local"
            value={checkOut}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-confirmation">
          Confirmation
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="accommodation-confirmation"
          onChange={(e) => setConfirmation(e.target.value)}
          type="text"
          value={confirmation}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-url">
          URL
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="accommodation-url"
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          value={url}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="accommodation-remarks">
          Remarks
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="accommodation-remarks"
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          value={remarks}
        />
      </div>
    </ItemModalShell>
  );
};
