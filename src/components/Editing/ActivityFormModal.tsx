import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { useCreateActivity, useUpdateActivity } from '@/hooks/useTripMutations';
import { PlacesService } from '@/services/placesService';
import type { ActivityInput } from '@/services/supabaseService';
import type { Coordinates } from '@/types/map';
import type { POIDetails } from '@/types/poi';
import { type Activity, ActivityType } from '@/types/trip';

const MAX_PLACE_RESULTS = 5;

interface ActivityFormModalProps {
  activity?: Activity;
  isOpen: boolean;
  onClose: () => void;
  searchLocation: Coordinates;
  sortOrder: number;
  stopId: string;
  tripId: string;
}

// `activity` absent means create mode; present means edit mode (pre-filled).
export const ActivityFormModal = ({ activity, isOpen, onClose, searchLocation, sortOrder, stopId, tripId }: ActivityFormModalProps) => {
  const createMutation = useCreateActivity(tripId);
  const updateMutation = useUpdateActivity(tripId);

  const [name, setName] = useState(activity?.activity_name ?? '');
  const [type, setType] = useState<string>(activity?.activity_type ?? '');
  const [address, setAddress] = useState(activity?.location?.address ?? '');
  const [duration, setDuration] = useState(activity?.duration ?? '');
  const [url, setUrl] = useState(activity?.url ?? '');
  const [remarks, setRemarks] = useState(activity?.remarks ?? '');
  const [lat, setLat] = useState<number | undefined>(activity?.location?.lat);
  const [lng, setLng] = useState<number | undefined>(activity?.location?.lng);
  const [googlePlaceId, setGooglePlaceId] = useState<string | undefined>(activity?.google_place_id);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(activity?.thumbnail_url);

  const [placeResults, setPlaceResults] = useState<POIDetails[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error?.message ?? updateMutation.error?.message;

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
    setThumbnailUrl(poi.photos?.[0]?.photo_reference);
    setPlaceResults(null);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      return;
    }
    const input: ActivityInput = {
      name: name.trim(),
      type: type || undefined,
      address: address.trim() || undefined,
      lat,
      lng,
      duration: duration.trim() || undefined,
      url: url.trim() || undefined,
      remarks: remarks.trim() || undefined,
      thumbnailUrl,
      googlePlaceId,
    };
    if (activity) {
      updateMutation.mutate({ activityId: activity.activity_id, input }, { onSuccess: onClose });
    } else {
      createMutation.mutate({ stopId, sortOrder, tempId: crypto.randomUUID(), input }, { onSuccess: onClose });
    }
  };

  return (
    <ItemModalShell
      error={mutationError}
      isOpen={isOpen}
      isPending={isPending}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={activity ? 'Edit activity' : 'Add activity'}
    >
      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-name">
          Name
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="activity-name"
          onChange={(e) => setName(e.target.value)}
          required
          type="text"
          value={name}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-type">
          Type
        </label>
        <select
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="activity-type"
          onChange={(e) => setType(e.target.value)}
          value={type}
        >
          <option value="">Select a type…</option>
          {Object.values(ActivityType).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-address">
          Address
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
            id="activity-address"
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

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-duration">
          Duration
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="activity-duration"
          onChange={(e) => setDuration(e.target.value)}
          placeholder="e.g. 1-2 hours"
          type="text"
          value={duration}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-url">
          URL
        </label>
        <input
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="activity-url"
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          value={url}
        />
      </div>

      <div>
        <label className="mb-1 block font-medium text-gray-700 text-sm" htmlFor="activity-remarks">
          Remarks
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal"
          id="activity-remarks"
          onChange={(e) => setRemarks(e.target.value)}
          rows={3}
          value={remarks}
        />
      </div>
    </ItemModalShell>
  );
};
